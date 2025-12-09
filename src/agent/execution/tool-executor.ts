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
import { DesignTool } from "../../tools/design-tool.js";
import { getAskUserTool, type Question } from "../../tools/ask-user.js";
import { executeAxAgent, executeAxAgentsParallel, type AxAgentOptions, type AxAgentsParallelOptions } from "../../tools/ax-agent.js";
import { extractErrorMessage } from "../../utils/error-handler.js";
import type { ToolParseResult } from "../core/types.js";
import { getHooksManager } from "../../hooks/index.js";

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

  // Lazy-loaded tools (rarely used)
  private _designTool?: DesignTool;

  // Callbacks for ax_agent events
  private onAxAgentStart?: (agentName: string) => void;
  private onAxAgentEnd?: (agentName: string) => void;

  // REFACTOR: Static helper for extracting typed arguments from parsed args
  // Avoids recreating closures on every tool execution
  private static getString(args: Record<string, unknown>, key: string, required = true): string {
    const value = args[key];
    if (typeof value !== 'string') {
      if (required) throw new Error(`Tool argument '${key}' must be a string, got ${typeof value}`);
      return '';
    }
    return value;
  }

  private static getNumber(args: Record<string, unknown>, key: string): number | undefined {
    const value = args[key];
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'number') return undefined;
    return value;
  }

  private static getBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
    const value = args[key];
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'boolean') return undefined;
    return value;
  }

  // REFACTOR: Generic enum validator to reduce repetitive validation code
  private static getEnum<T extends string>(
    args: Record<string, unknown>,
    key: string,
    validValues: readonly T[]
  ): T | undefined {
    const value = args[key];
    if (validValues.includes(value as T)) {
      return value as T;
    }
    return undefined;
  }

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
   * Lazy-loaded getter for DesignTool
   * Only instantiates when first accessed to reduce startup time
   */
  private get designTool(): DesignTool {
    if (!this._designTool) {
      this._designTool = new DesignTool();
    }
    return this._designTool;
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

      // REFACTOR: Use static methods instead of recreating closures
      const getString = (key: string, required = true) => ToolExecutor.getString(args, key, required);
      const getNumber = (key: string) => ToolExecutor.getNumber(args, key);
      const getBoolean = (key: string) => ToolExecutor.getBoolean(args, key);
      const getEnum = <T extends string>(key: string, validValues: readonly T[]) =>
        ToolExecutor.getEnum(args, key, validValues);

      switch (toolCall.function.name) {
        case "view_file": {
          const startLine = getNumber('start_line');
          const endLine = getNumber('end_line');
          // BUG FIX: Validate that if either start_line or end_line is provided, both must be
          if ((startLine !== undefined) !== (endLine !== undefined)) {
            return {
              success: false,
              error: `view_file: both start_line and end_line must be provided together, got start_line=${startLine}, end_line=${endLine}`,
            };
          }
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

        case "multi_edit": {
          // BUG FIX: Validate edits array structure before passing to textEditor
          const rawEdits = Array.isArray(args.edits) ? args.edits : [];
          const validatedEdits = rawEdits.filter((edit): edit is { old_str: string; new_str: string } => {
            return (
              edit !== null &&
              typeof edit === 'object' &&
              typeof edit.old_str === 'string' &&
              typeof edit.new_str === 'string'
            );
          });
          if (validatedEdits.length !== rawEdits.length) {
            return {
              success: false,
              error: `multi_edit: ${rawEdits.length - validatedEdits.length} edit(s) have invalid structure (missing old_str or new_str)`,
            };
          }
          return await this.textEditor.multiEdit(getString('path'), validatedEdits);
        }

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
          // REFACTOR: Use getEnum helper for cleaner validation
          const fileTypes = Array.isArray(args.file_types)
            ? args.file_types.filter((ft): ft is string => typeof ft === 'string')
            : undefined;
          return await this.search.search(getString('query'), {
            searchType: getEnum('search_type', ['text', 'files', 'both'] as const),
            includePattern: getString('include_pattern', false) || undefined,
            excludePattern: getString('exclude_pattern', false) || undefined,
            caseSensitive: getBoolean('case_sensitive'),
            wholeWord: getBoolean('whole_word'),
            regex: getBoolean('regex'),
            maxResults: getNumber('max_results'),
            fileTypes: fileTypes && fileTypes.length > 0 ? fileTypes : undefined,
            includeHidden: getBoolean('include_hidden'),
          });
        }

        case "ask_user": {
          const questions = args.questions;
          if (!Array.isArray(questions)) {
            return {
              success: false,
              error: "ask_user requires a 'questions' array",
            };
          }

          // Validate and transform questions
          const validQuestions: Question[] = [];
          for (const q of questions) {
            if (typeof q !== 'object' || q === null) continue;
            const qObj = q as Record<string, unknown>;
            if (typeof qObj.question !== 'string' || !Array.isArray(qObj.options)) continue;

            const validOptions = (qObj.options as unknown[]).filter(
              (opt): opt is { label: string; description?: string } =>
                typeof opt === 'object' && opt !== null && typeof (opt as Record<string, unknown>).label === 'string'
            ).map(opt => ({
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

          if (validQuestions.length === 0) {
            return {
              success: false,
              error: "No valid questions provided",
            };
          }

          const askUserTool = getAskUserTool();
          return await askUserTool.execute(validQuestions);
        }

        // =====================================================================
        // Design Tools (Figma Integration)
        // =====================================================================
        case "figma_map": {
          // REFACTOR: Use getEnum helper for cleaner validation
          return await this.designTool.mapFile(getString('file_key'), {
            depth: getNumber('depth'),
            format: getEnum('format', ['tree', 'json', 'flat'] as const),
            showIds: getBoolean('show_ids'),
            showTypes: getBoolean('show_types'),
            framesOnly: getBoolean('frames_only'),
          });
        }

        case "figma_tokens": {
          // REFACTOR: Use getEnum helper for cleaner validation
          return await this.designTool.extractTokens(getString('file_key'), {
            format: getEnum('format', ['json', 'tailwind', 'css', 'scss'] as const),
            colorFormat: getEnum('color_format', ['hex', 'rgb', 'hsl'] as const),
            dimensionUnit: getEnum('dimension_unit', ['px', 'rem'] as const),
            remBase: getNumber('rem_base'),
          });
        }

        case "figma_audit": {
          const fileKey = getString('file_key');
          const rules = Array.isArray(args.rules)
            ? args.rules.filter((r: unknown): r is string => typeof r === 'string')
            : undefined;
          const excludeRules = Array.isArray(args.exclude_rules)
            ? args.exclude_rules.filter((r: unknown): r is string => typeof r === 'string')
            : undefined;
          return await this.designTool.auditFile(fileKey, {
            depth: getNumber('depth'),
            rules,
            excludeRules,
          });
        }

        case "figma_search": {
          const fileKey = getString('file_key');
          return await this.designTool.searchNodes(fileKey, {
            name: typeof args.name === 'string' ? args.name : undefined,
            type: typeof args.type === 'string' ? args.type : undefined,
            text: typeof args.text === 'string' ? args.text : undefined,
            limit: getNumber('limit'),
          });
        }

        case "figma_alias_list": {
          return await this.designTool.listAliases();
        }

        case "figma_alias_resolve": {
          const alias = getString('alias');
          return await this.designTool.resolveAlias(alias);
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
          // Parse agents array from arguments
          const agentsArg = args.agents;
          if (!Array.isArray(agentsArg) || agentsArg.length === 0) {
            return {
              success: false,
              error: "agents parameter must be a non-empty array of {agent, task} objects",
            };
          }

          // Validate and transform agents array
          const agents: AxAgentsParallelOptions['agents'] = [];
          for (const item of agentsArg) {
            if (typeof item !== 'object' || item === null) {
              return {
                success: false,
                error: "Each agent entry must be an object with agent and task properties",
              };
            }
            const agentItem = item as Record<string, unknown>;
            if (typeof agentItem.agent !== 'string' || typeof agentItem.task !== 'string') {
              return {
                success: false,
                error: "Each agent entry must have string 'agent' and 'task' properties",
              };
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

          const parallelOptions: AxAgentsParallelOptions = { agents };

          // Notify that parallel agents are starting (notify for first agent as summary)
          const agentNames = agents.map(a => a.agent).join(', ');
          this.onAxAgentStart?.(`parallel: ${agentNames}`);

          try {
            const result = await executeAxAgentsParallel(parallelOptions);
            return result;
          } finally {
            this.onAxAgentEnd?.(`parallel: ${agentNames}`);
          }
        }

        default:
          // Check if this is an MCP tool
          if (toolCall.function.name.startsWith("mcp__")) {
            const mcpResult = await this.executeMCPTool(toolCall);
            // Execute PostToolUse hooks (fire-and-forget)
            void hooksManager.executePostToolHooks(
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
