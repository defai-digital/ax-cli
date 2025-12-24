/**
 * Tool Executor
 *
 * Handles execution of tool calls from the LLM.
 * Extracted from llm-agent.ts for better separation of concerns.
 *
 * @packageDocumentation
 */

import type { LLMToolCall } from "../../llm/client.js";
import type { ToolResult } from "../../types/index.js";
import { getMCPManager } from "../../llm/tools.js";
import {
  TextEditorTool,
  BashTool,
  TodoTool,
  SearchTool,
} from "../../tools/index.js";
import { BashOutputTool } from "../../tools/bash-output.js";
import { getAskUserTool, type Question } from "../../tools/ask-user.js";
import { executeAxAgent, executeAxAgentsParallel, type AxAgentOptions, type AxAgentsParallelOptions } from "../../tools/ax-agent.js";
import { extractErrorMessage } from "../../utils/error-handler.js";
import type { ToolParseResult } from "../core/types.js";
import { getHooksManager } from "../../hooks/index.js";
import { getDefaultGuard } from "../../guard/index.js";
import { getSettingsManager } from "../../utils/settings-manager.js";
import type { GateContext } from "@defai.digital/ax-schemas";

/**
 * Tool executor configuration
 */
export interface ToolExecutorConfig {
  /** Callback for checkpoint creation on file edits */
  checkpointCallback?: (files: Array<{ path: string; content: string }>, description: string) => Promise<void>;
  /** Callback when ax_agent starts executing */
  onAxAgentStart?: (agentName: string) => void;
  /** Callback when ax_agent finishes executing */
  onAxAgentEnd?: (agentName: string) => void;
}

/**
 * Tool Executor
 *
 * Manages tool instances and executes tool calls from the LLM.
 * Supports built-in tools and MCP (Model Context Protocol) tools.
 */
export class ToolExecutor {
  private textEditor: TextEditorTool;
  private bash: BashTool;
  private bashOutput: BashOutputTool;
  private todoTool: TodoTool;
  private search: SearchTool;

  // Callbacks for ax_agent events
  private onAxAgentStart?: (agentName: string) => void;
  private onAxAgentEnd?: (agentName: string) => void;

  constructor(config?: ToolExecutorConfig) {
    this.textEditor = new TextEditorTool();
    this.bash = new BashTool();
    this.bashOutput = new BashOutputTool();
    this.todoTool = new TodoTool();
    this.search = new SearchTool();

    // Set checkpoint callback if provided
    if (config?.checkpointCallback) {
      this.textEditor.setCheckpointCallback(config.checkpointCallback);
    }

    // Set ax_agent callbacks if provided
    this.onAxAgentStart = config?.onAxAgentStart;
    this.onAxAgentEnd = config?.onAxAgentEnd;
  }

  /**
   * Parse and validate tool call arguments
   * @param toolCall The tool call to parse arguments from
   * @param toolType Type of tool (for error messages)
   * @returns Parsed arguments or error result
   */
  parseToolArguments(
    toolCall: LLMToolCall,
    toolType: string = 'Tool'
  ): ToolParseResult {
    const argsString = toolCall.function.arguments;
    if (!argsString || typeof argsString !== 'string' || argsString.trim() === '') {
      return {
        success: false,
        error: `${toolType} ${toolCall.function.name} called with empty arguments`,
      };
    }

    try {
      const args = JSON.parse(argsString);

      // Validate that args is an object (not null, array, or primitive)
      if (typeof args !== 'object' || args === null || Array.isArray(args)) {
        return {
          success: false,
          error: `${toolType} ${toolCall.function.name} arguments must be a JSON object, got ${Array.isArray(args) ? 'array' : typeof args}`,
        };
      }

      return { success: true, args };
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse ${toolType} arguments: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
      };
    }
  }

  /**
   * Execute a tool call with hooks integration
   */
  async execute(toolCall: LLMToolCall): Promise<ToolResult> {
    try {
      const parseResult = this.parseToolArguments(toolCall, 'Tool');
      if (!parseResult.success) {
        return { success: false, error: parseResult.error };
      }

      const args = parseResult.args;

      // Check PreToolUse hooks before execution
      const hooksManager = getHooksManager();
      const blockCheck = await hooksManager.shouldBlockTool(
        toolCall.function.name,
        args as Record<string, unknown>,
        toolCall.id
      );
      if (blockCheck.blocked) {
        return {
          success: false,
          error: `Tool blocked by hook: ${blockCheck.reason || 'No reason provided'}`,
        };
      }

      // Guard check - security governance layer
      const guardSettings = getSettingsManager().getGuardSettings();

      if (guardSettings.enabled) {
        const guard = getDefaultGuard();

        // Extract file path from various possible argument names
        const extractFilePath = (): string | undefined => {
          const pathArgs = ['path', 'file_path', 'filePath', 'file', 'filename', 'target'];
          for (const argName of pathArgs) {
            const value = args[argName];
            if (typeof value === 'string') {
              return value;
            }
          }
          return undefined;
        };

        // Build gate context from tool call
        const gateContext: GateContext = {
          cwd: process.cwd(),
          toolName: toolCall.function.name,
          toolArguments: args as Record<string, unknown>,
          // Extract file path if present (for file operations)
          filePath: extractFilePath(),
          // Extract command if present (for bash operations)
          command: typeof args.command === 'string' ? args.command : undefined,
          // Extract content if present (for content operations)
          content: typeof args.content === 'string' ? args.content : undefined,
        };

        // Check for tool-specific policy override from settings
        let policyId = guardSettings.toolPolicies[toolCall.function.name] || guardSettings.defaultPolicy;

        // Auto-detect policy based on tool type if using default
        if (policyId === 'tool-execution') {
          const toolName = toolCall.function.name.toLowerCase();

          // Command execution tools
          if (toolName === 'bash' || toolName === 'shell' || toolName === 'exec' || toolName === 'run_command') {
            policyId = 'command-execution';
          }
          // File write tools (various naming conventions)
          else if (
            toolName === 'create_file' ||
            toolName === 'str_replace_editor' ||
            toolName === 'multi_edit' ||
            toolName === 'write_file' ||
            toolName === 'edit_file' ||
            toolName === 'write' ||       // Claude's Write tool
            toolName === 'edit' ||        // Claude's Edit tool
            toolName === 'notebookedit' ||// Claude's NotebookEdit tool
            toolName === 'patch_file' ||
            toolName === 'update_file' ||
            toolName === 'save_file'
          ) {
            policyId = 'file-write';
          }
          // File read tools
          else if (
            toolName === 'view_file' ||
            toolName === 'read_file' ||
            toolName === 'read' ||        // Claude's Read tool
            toolName === 'cat_file' ||
            toolName === 'get_file'
          ) {
            policyId = 'file-read';
          }
        }

        try {
          // Build config overrides from settings
          const configOverrides: Record<string, Record<string, unknown>> = {};

          // Add custom blocked/allowed paths from settings
          // IMPORTANT: Only include non-empty arrays to avoid overriding policy defaults with empty arrays
          const pathViolationOverrides: Record<string, unknown> = {};
          if (guardSettings.customBlockedPaths.length > 0) {
            pathViolationOverrides.blockedPaths = guardSettings.customBlockedPaths;
          }
          if (guardSettings.customAllowedPaths.length > 0) {
            pathViolationOverrides.allowedPaths = guardSettings.customAllowedPaths;
          }
          if (Object.keys(pathViolationOverrides).length > 0) {
            configOverrides['path_violation'] = pathViolationOverrides;
          }

          const guardResult = guard.check(policyId, gateContext, configOverrides);

          // Log guard checks if configured
          if (guardSettings.logChecks) {
            console.log(`[Guard] ${toolCall.function.name}: ${guardResult.overallResult} (${guardResult.duration}ms)`);
          }

          if (guardResult.overallResult === 'FAIL') {
            // Collect all failed gate messages
            const failedMessages = guardResult.checks
              .filter(c => c.result === 'FAIL')
              .map(c => c.message)
              .join('; ');

            return {
              success: false,
              error: `Tool blocked by security guard: ${failedMessages}`,
            };
          }
        } catch (guardError) {
          // Handle guard errors based on failSilently setting
          if (!guardSettings.failSilently) {
            return {
              success: false,
              error: `Guard check failed: ${extractErrorMessage(guardError)}`,
            };
          }
          // If failSilently is true, continue with tool execution
          console.warn(`[Guard] Error during check (continuing): ${extractErrorMessage(guardError)}`);
        }
      }

      // Helper to safely get string argument with validation
      const getString = (key: string, required = true): string => {
        const value = args[key];
        if (typeof value !== 'string') {
          if (required) throw new Error(`Tool argument '${key}' must be a string, got ${typeof value}`);
          return '';
        }
        return value;
      };

      // Helper to safely get number argument
      const getNumber = (key: string): number | undefined => {
        const value = args[key];
        if (value === undefined || value === null) return undefined;
        if (typeof value !== 'number') return undefined;
        return value;
      };

      // Helper to safely get boolean argument
      const getBoolean = (key: string): boolean | undefined => {
        const value = args[key];
        if (value === undefined || value === null) return undefined;
        if (typeof value !== 'boolean') return undefined;
        return value;
      };

      switch (toolCall.function.name) {
        case "view_file": {
          const startLine = getNumber('start_line');
          const endLine = getNumber('end_line');
          const range: [number, number] | undefined =
            startLine !== undefined && endLine !== undefined
              ? [startLine, endLine]
              : undefined;
          return await this.textEditor.view(getString('path'), range);
        }

        case "create_file":
          return await this.textEditor.create(getString('path'), getString('content'));

        case "str_replace_editor":
          return await this.textEditor.strReplace(
            getString('path'),
            getString('old_str'),
            getString('new_str'),
            getBoolean('replace_all') ?? false
          );

        case "multi_edit":
          return await this.textEditor.multiEdit(
            getString('path'),
            Array.isArray(args.edits) ? args.edits : []
          );

        case "bash":
          return await this.bash.execute(getString('command'), {
            background: getBoolean('background'),
            timeout: getNumber('timeout'),
          });

        case "bash_output":
          return await this.bashOutput.execute(
            getString('task_id'),
            getBoolean('wait'),
            getNumber('timeout')
          );

        case "create_todo_list":
          return await this.todoTool.createTodoList(Array.isArray(args.todos) ? args.todos : []);

        case "update_todo_list":
          return await this.todoTool.updateTodoList(Array.isArray(args.updates) ? args.updates : []);

        case "search": {
          const searchTypeValue = args.search_type;
          const validSearchType = (searchTypeValue === 'text' || searchTypeValue === 'files' || searchTypeValue === 'both') ? searchTypeValue : undefined;
          // BUG FIX: Validate that file_types array contains only strings
          const fileTypes = Array.isArray(args.file_types)
            ? args.file_types.filter((ft): ft is string => typeof ft === 'string')
            : undefined;
          return await this.search.search(getString('query'), {
            searchType: validSearchType,
            includePattern: typeof args.include_pattern === 'string' ? args.include_pattern : undefined,
            excludePattern: typeof args.exclude_pattern === 'string' ? args.exclude_pattern : undefined,
            caseSensitive: getBoolean('case_sensitive'),
            wholeWord: getBoolean('whole_word'),
            regex: getBoolean('regex'),
            maxResults: getNumber('max_results'),
            fileTypes: fileTypes && fileTypes.length > 0 ? fileTypes : undefined,
            includeHidden: getBoolean('include_hidden'),
          });
        }

        case "ask_user": {
          const validQuestions = this.validateAskUserQuestions(args.questions);
          if (!validQuestions) {
            return {
              success: false,
              error: "ask_user requires a 'questions' array with valid questions (each needs question string, 2+ options with labels)",
            };
          }

          const askUserTool = getAskUserTool();
          return await askUserTool.execute(validQuestions);
        }

        // =====================================================================
        // AutomatosX Agent Invocation
        // =====================================================================
        case "ax_agent": {
          const agent = getString('agent');
          const task = getString('task');
          const formatValue = args.format;
          const validFormat = (formatValue === 'text' || formatValue === 'markdown') ? formatValue : 'markdown';
          const save = typeof args.save === 'string' ? args.save : undefined;

          const options: AxAgentOptions = {
            agent,
            task,
            format: validFormat,
            save,
          };

          // Notify that agent is starting
          this.onAxAgentStart?.(agent);

          try {
            const result = await executeAxAgent(options);
            return result;
          } finally {
            // Always notify agent has ended, even on error
            this.onAxAgentEnd?.(agent);
          }
        }

        case "ax_agents_parallel": {
          const validation = this.validateAgentsArray(args.agents);
          if ('error' in validation) {
            return { success: false, error: validation.error };
          }

          const { agents } = validation;
          const agentNames = agents.map(a => a.agent).join(', ');

          this.onAxAgentStart?.(`parallel: ${agentNames}`);
          try {
            return await executeAxAgentsParallel({ agents });
          } finally {
            this.onAxAgentEnd?.(`parallel: ${agentNames}`);
          }
        }

        default:
          // Check if this is an MCP tool
          if (toolCall.function.name.startsWith("mcp__")) {
            const mcpResult = await this.executeMCPTool(toolCall);
            // Execute PostToolUse hooks (fire-and-forget)
            hooksManager.executePostToolHooks(
              toolCall.function.name,
              args as Record<string, unknown>,
              toolCall.id,
              mcpResult
            );
            return mcpResult;
          }

          return {
            success: false,
            error: `Unknown tool: ${toolCall.function.name}`,
          };
      }
    } catch (error: unknown) {
      const errorMsg = extractErrorMessage(error);
      return {
        success: false,
        error: `Tool execution error: ${errorMsg}`,
      };
    }
  }

  /**
   * Validate and transform ask_user questions array
   * @returns Valid questions array or null if validation fails
   */
  private validateAskUserQuestions(questions: unknown): Question[] | null {
    if (!Array.isArray(questions)) return null;

    const validQuestions: Question[] = [];

    for (const q of questions) {
      if (typeof q !== 'object' || q === null) continue;

      const qObj = q as Record<string, unknown>;
      if (typeof qObj.question !== 'string' || !Array.isArray(qObj.options)) continue;

      const validOptions = (qObj.options as unknown[])
        .filter((opt): opt is { label: string; description?: string } =>
          typeof opt === 'object' && opt !== null && typeof (opt as Record<string, unknown>).label === 'string'
        )
        .map(opt => ({
          label: opt.label,
          description: typeof opt.description === 'string' ? opt.description : undefined,
        }));

      // Skip questions with fewer than 2 valid options
      if (validOptions.length < 2) continue;

      validQuestions.push({
        question: qObj.question,
        header: typeof qObj.header === 'string' ? qObj.header : undefined,
        options: validOptions,
        multiSelect: typeof qObj.multiSelect === 'boolean' ? qObj.multiSelect : false,
      });
    }

    return validQuestions.length > 0 ? validQuestions : null;
  }

  /**
   * Validate and transform ax_agents_parallel agents array
   * @returns Validated agents array or error message
   */
  private validateAgentsArray(agentsArg: unknown): { agents: AxAgentsParallelOptions['agents'] } | { error: string } {
    if (!Array.isArray(agentsArg) || agentsArg.length === 0) {
      return { error: "agents parameter must be a non-empty array of {agent, task} objects" };
    }

    const agents: AxAgentsParallelOptions['agents'] = [];

    for (const item of agentsArg) {
      if (typeof item !== 'object' || item === null) {
        return { error: "Each agent entry must be an object with agent and task properties" };
      }

      const agentItem = item as Record<string, unknown>;
      if (typeof agentItem.agent !== 'string' || typeof agentItem.task !== 'string') {
        return { error: "Each agent entry must have string 'agent' and 'task' properties" };
      }

      const formatValue = agentItem.format;
      const validFormat = (formatValue === 'text' || formatValue === 'markdown') ? formatValue : undefined;

      agents.push({
        agent: agentItem.agent,
        task: agentItem.task,
        format: validFormat,
        save: typeof agentItem.save === 'string' ? agentItem.save : undefined,
      });
    }

    return { agents };
  }

  /**
   * Format AutomatosX agent NDJSON output to human-readable format
   * @param ndjsonOutput Raw NDJSON output from AutomatosX agent
   * @returns Formatted output string
   */
  private formatAutomatosXOutput(ndjsonOutput: string): string {
    const lines = ndjsonOutput.trim().split('\n');
    const parts: string[] = [];
    let finalContent = '';
    let stats: { total_tokens?: number; duration_ms?: number; tool_calls?: number } | null = null;

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const parsed = JSON.parse(line);

        // Extract assistant's final response
        if (parsed.type === 'message' && parsed.role === 'assistant' && parsed.content) {
          finalContent = parsed.content;
        }

        // Extract execution stats
        if (parsed.type === 'result' && parsed.stats) {
          stats = parsed.stats;
        }
      } catch {
        // Not JSON, might be plain text - include it
        if (line.trim() && !line.startsWith('{')) {
          parts.push(line);
        }
      }
    }

    // Build formatted output
    const outputParts: string[] = [];

    // Add the main response content
    if (finalContent) {
      outputParts.push(finalContent);
    } else if (parts.length > 0) {
      outputParts.push(parts.join('\n'));
    }

    // Add stats summary if available
    if (stats) {
      const statsParts: string[] = [];
      if (stats.duration_ms) {
        statsParts.push(`${(stats.duration_ms / 1000).toFixed(1)}s`);
      }
      if (stats.total_tokens) {
        const tokens = stats.total_tokens >= 1000
          ? `${(stats.total_tokens / 1000).toFixed(1)}k`
          : String(stats.total_tokens);
        statsParts.push(`${tokens} tokens`);
      }
      if (stats.tool_calls) {
        statsParts.push(`${stats.tool_calls} tool calls`);
      }
      if (statsParts.length > 0) {
        outputParts.push(`\n_Agent completed in ${statsParts.join(', ')}_`);
      }
    }

    return outputParts.join('\n') || 'Agent completed successfully';
  }

  /**
   * Check if output looks like AutomatosX NDJSON
   */
  private isAutomatosXOutput(output: string): boolean {
    // Check for characteristic NDJSON patterns from AutomatosX
    return output.includes('{"type":"init"') ||
           output.includes('{"type":"message"') ||
           output.includes('{"type":"result"');
  }

  /**
   * Execute an MCP tool
   */
  private async executeMCPTool(toolCall: LLMToolCall): Promise<ToolResult> {
    try {
      const parseResult = this.parseToolArguments(toolCall, 'MCP tool');
      if (!parseResult.success) {
        return { success: false, error: parseResult.error };
      }

      const args = parseResult.args as Record<string, unknown>;
      const mcpManager = getMCPManager();

      const result = await mcpManager.callTool(toolCall.function.name, args);

      if (result.isError) {
        // Extract error message from MCP result content
        let errorMsg = "MCP tool error";
        if (result.content && Array.isArray(result.content) && result.content.length > 0) {
          const firstContent = result.content[0];
          if (typeof firstContent === 'object' && firstContent !== null && 'text' in firstContent) {
            const textValue = (firstContent as { text?: unknown }).text;
            errorMsg = typeof textValue === 'string' ? textValue : String(textValue || errorMsg);
          }
        }
        return {
          success: false,
          error: errorMsg,
        };
      }

      // Extract content from result
      let output = result.content && Array.isArray(result.content)
        ? result.content
          .map((item) => {
            if (item.type === "text") {
              return item.text || "";
            } else if (item.type === "resource") {
              return `Resource: ${item.resource?.uri || "Unknown"}`;
            }
            return String(item);
          })
          .join("\n")
        : "";

      // Format AutomatosX agent output if detected
      if (toolCall.function.name.startsWith("mcp__automatosx__") && this.isAutomatosXOutput(output)) {
        output = this.formatAutomatosXOutput(output);
      }

      return {
        success: true,
        output: output || "Success",
      };
    } catch (error: unknown) {
      const errorMsg = extractErrorMessage(error);
      return {
        success: false,
        error: `MCP tool execution error: ${errorMsg}`,
      };
    }
  }

  /**
   * Get the bash tool instance (for direct access)
   */
  getBashTool(): BashTool {
    return this.bash;
  }

  /**
   * Get the todo tool instance (for planning integration)
   */
  getTodoTool(): TodoTool {
    return this.todoTool;
  }

  /**
   * Get the text editor tool instance
   */
  getTextEditorTool(): TextEditorTool {
    return this.textEditor;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.bash.dispose();
  }
}
