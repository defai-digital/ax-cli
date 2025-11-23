import { LLMClient, LLMMessage, LLMToolCall, LLMTool } from "../llm/client.js";
import type { GLM46StreamChunk, SamplingConfig, ChatOptions, ThinkingConfig } from "../llm/types.js";
import {
  getAllGrokTools,
  getMCPManager,
  initializeMCPServers,
} from "../llm/tools.js";
import { loadMCPConfig } from "../mcp/config.js";
import {
  TextEditorTool,
  BashTool,
  TodoTool,
  SearchTool,
} from "../tools/index.js";
import { BashOutputTool } from "../tools/bash-output.js";
import { WebSearchTool } from "../tools/web-search/index.js";
import { ArchitectureTool } from "../tools/analysis-tools/architecture-tool.js";
import { ValidationTool } from "../tools/analysis-tools/validation-tool.js";
import { ToolResult } from "../types/index.js";
import { EventEmitter } from "events";
import { AGENT_CONFIG } from "../constants.js";
import { getTokenCounter, TokenCounter } from "../utils/token-counter.js";
import { loadCustomInstructions } from "../utils/custom-instructions.js";
import { getSettingsManager } from "../utils/settings-manager.js";
import { ContextManager } from "./context-manager.js";
import { buildSystemPrompt } from "../utils/prompt-builder.js";
import { getUsageTracker } from "../utils/usage-tracker.js";
import { extractErrorMessage } from "../utils/error-handler.js";
import { getCheckpointManager, CheckpointManager } from "../checkpoint/index.js";
import { SubagentOrchestrator } from "./subagent-orchestrator.js";
import {
  getTaskPlanner,
  TaskPlanner,
  TaskPlan,
  TaskPhase,
  PhaseResult,
  PlanResult,
  isComplexRequest,
} from "../planner/index.js";
import { PLANNER_CONFIG } from "../constants.js";
import { resolveMCPReferences, extractMCPReferences } from "../mcp/resources.js";

export interface ChatEntry {
  type: "user" | "assistant" | "tool_result" | "tool_call";
  content: string;
  timestamp: Date;
  toolCalls?: LLMToolCall[];
  toolCall?: LLMToolCall;
  toolResult?: { success: boolean; output?: string; error?: string };
  isStreaming?: boolean;
  /** GLM-4.6 reasoning content (thinking mode) */
  reasoningContent?: string;
  /** Whether reasoning is currently streaming */
  isReasoningStreaming?: boolean;
  /** Response duration in milliseconds */
  durationMs?: number;
  /** Tool execution start time (for elapsed time display while running) */
  executionStartTime?: Date;
  /** Tool execution duration in milliseconds (shown after completion) */
  executionDurationMs?: number;
}

export interface StreamingChunk {
  type: "content" | "reasoning" | "tool_calls" | "tool_result" | "done" | "token_count";
  content?: string;
  /** GLM-4.6 reasoning content chunk */
  reasoningContent?: string;
  toolCalls?: LLMToolCall[];
  toolCall?: LLMToolCall;
  toolResult?: ToolResult;
  tokenCount?: number;
  /** Tool execution duration in milliseconds (for tool_result type) */
  executionDurationMs?: number;
}

export class LLMAgent extends EventEmitter {
  private llmClient: LLMClient;
  private textEditor: TextEditorTool;
  private bash: BashTool;
  private bashOutput: BashOutputTool;
  private todoTool: TodoTool;
  private search: SearchTool;
  private webSearch: WebSearchTool;
  // Lazy-loaded tools (rarely used)
  private _architectureTool?: ArchitectureTool;
  private _validationTool?: ValidationTool;
  private chatHistory: ChatEntry[] = [];
  private messages: LLMMessage[] = [];
  private tokenCounter: TokenCounter;
  private contextManager: ContextManager;
  private abortController: AbortController | null = null;
  private maxToolRounds: number;
  private recentToolCalls: Map<string, number> = new Map(); // Track recent tool calls to detect loops
  private toolCallIndexMap: Map<string, number> = new Map(); // O(1) lookup for tool call entries in chat history
  private toolCallArgsCache: Map<string, Record<string, unknown>> = new Map(); // Cache parsed tool arguments
  private checkpointManager: CheckpointManager;
  private subagentOrchestrator: SubagentOrchestrator;
  private taskPlanner: TaskPlanner;
  private currentPlan: TaskPlan | null = null;
  private planningEnabled: boolean = PLANNER_CONFIG.ENABLED;
  /** Sampling configuration for deterministic/reproducible mode */
  private samplingConfig: SamplingConfig | undefined;
  /** Thinking/reasoning mode configuration */
  private thinkingConfig: ThinkingConfig | undefined;
  /** Track if agent has been disposed */
  private disposed = false;

  constructor(
    apiKey: string,
    baseURL?: string,
    model?: string,
    maxToolRounds?: number
  ) {
    super();
    const manager = getSettingsManager();
    const savedModel = manager.getCurrentModel();
    const modelToUse = model || savedModel;

    if (!modelToUse) {
      throw new Error('No model configured. Please run "ax-cli setup" to configure your AI provider and model.');
    }

    this.maxToolRounds = maxToolRounds || 400;
    this.llmClient = new LLMClient(apiKey, modelToUse, baseURL);
    this.textEditor = new TextEditorTool();
    this.bash = new BashTool();
    this.bashOutput = new BashOutputTool();
    this.todoTool = new TodoTool();
    this.search = new SearchTool();
    this.webSearch = new WebSearchTool();
    // architectureTool and validationTool are lazy-loaded (see getters below)
    this.tokenCounter = getTokenCounter(modelToUse);
    this.contextManager = new ContextManager({ model: modelToUse });
    this.checkpointManager = getCheckpointManager();
    this.subagentOrchestrator = new SubagentOrchestrator({ maxConcurrentAgents: 5 });
    this.taskPlanner = getTaskPlanner();

    // Load sampling configuration from settings (supports env vars, project, and user settings)
    this.samplingConfig = manager.getSamplingSettings();

    // Wire up checkpoint callback for automatic checkpoint creation
    this.textEditor.setCheckpointCallback(async (files, description) => {
      await this.checkpointManager.createCheckpoint({
        files,
        conversationState: this.chatHistory,
        description,
        metadata: {
          model: this.llmClient.getCurrentModel(),
          triggeredBy: 'auto',
        },
      });
    });

    // Initialize checkpoint manager
    this.initializeCheckpointManager();

    // Initialize MCP servers if configured
    this.initializeMCP();

    // Build system prompt from YAML configuration
    const customInstructions = loadCustomInstructions();
    const systemPrompt = buildSystemPrompt({
      customInstructions: customInstructions || undefined,
    });

    // Initialize with system message
    // OPTIMIZATION: Keep static system prompt separate from dynamic context
    // This maximizes cache hit rates on the xAI API (cached tokens = 50% cost savings)
    // The API automatically caches identical content across requests
    this.messages.push({
      role: "system",
      content: systemPrompt,
    });

    // Add dynamic context as a separate system message
    // This allows the main system prompt to be cached while context varies
    this.messages.push({
      role: "system",
      content: `Current working directory: ${process.cwd()}\nTimestamp: ${new Date().toISOString().split('T')[0]}`,
    });
  }

  private initializeCheckpointManager(): void {
    // Initialize checkpoint manager in the background
    Promise.resolve().then(async () => {
      try {
        await this.checkpointManager.initialize();
        this.emit('system', 'Checkpoint system initialized');
      } catch (error) {
        const errorMsg = extractErrorMessage(error);
        console.warn("Checkpoint initialization failed:", errorMsg);
        this.emit('system', `Checkpoint initialization failed: ${errorMsg}`);
      }
    }).catch((error) => {
      const errorMsg = extractErrorMessage(error);
      console.warn("Unexpected error during checkpoint initialization:", errorMsg);
    });
  }

  private async initializeMCP(): Promise<void> {
    // Initialize MCP in the background without blocking
    // Single error handler - no redundant catch needed since inner try-catch handles all errors
    Promise.resolve().then(async () => {
      try {
        const config = loadMCPConfig();
        if (config.servers.length > 0) {
          await initializeMCPServers();
          this.emit('system', 'MCP servers initialized successfully');
        }
      } catch (error) {
        const errorMsg = extractErrorMessage(error);
        console.warn("MCP initialization failed:", errorMsg);
        this.emit('system', `MCP initialization failed: ${errorMsg}`);
      }
    });
  }


  /**
   * Build chat options with sampling and thinking configuration included
   * Merges provided options with the agent's configurations
   */
  private buildChatOptions(options?: Partial<ChatOptions>): ChatOptions {
    const result: ChatOptions = { ...options };

    // Include sampling configuration if set and not overridden
    if (this.samplingConfig && !result.sampling) {
      result.sampling = this.samplingConfig;
    }

    // Include thinking configuration if set and not overridden
    if (this.thinkingConfig && !result.thinking) {
      result.thinking = this.thinkingConfig;
    }

    return result;
  }

  /**
   * Set sampling configuration for this agent session
   * @param config Sampling configuration to apply
   */
  public setSamplingConfig(config: SamplingConfig | undefined): void {
    this.samplingConfig = config;
  }

  /**
   * Set thinking/reasoning mode configuration for this agent session
   * @param config Thinking configuration to apply (enabled/disabled)
   */
  public setThinkingConfig(config: ThinkingConfig | undefined): void {
    this.thinkingConfig = config;
  }

  /**
   * Get current thinking configuration
   */
  public getThinkingConfig(): ThinkingConfig | undefined {
    return this.thinkingConfig;
  }

  /**
   * Get current sampling configuration
   */
  public getSamplingConfig(): SamplingConfig | undefined {
    return this.samplingConfig;
  }

  /**
   * Apply context pruning to both messages and chatHistory
   * BUGFIX: Prevents chatHistory from growing unbounded
   */
  private applyContextPruning(): void {
    if (this.contextManager.shouldPrune(this.messages, this.tokenCounter)) {
      // Prune LLM messages
      this.messages = this.contextManager.pruneMessages(this.messages, this.tokenCounter);

      // Also prune chatHistory to prevent unlimited growth
      // Keep last 200 entries which is more than enough for UI display
      const MAX_CHAT_HISTORY_ENTRIES = 200;
      if (this.chatHistory.length > MAX_CHAT_HISTORY_ENTRIES) {
        const entriesToRemove = this.chatHistory.length - MAX_CHAT_HISTORY_ENTRIES;
        this.chatHistory = this.chatHistory.slice(entriesToRemove);

        // Update tool call index map after pruning
        // Clear and rebuild only for remaining entries
        this.toolCallIndexMap.clear();
        this.chatHistory.forEach((entry, index) => {
          if (entry.type === "tool_call" && entry.toolCall?.id) {
            this.toolCallIndexMap.set(entry.toolCall.id, index);
          } else if (entry.type === "tool_result" && entry.toolCall?.id) {
            this.toolCallIndexMap.set(entry.toolCall.id, index);
          }
        });
      }
    }
  }

  /**
   * Check if agent is running in deterministic mode
   */
  public isDeterministicMode(): boolean {
    return this.samplingConfig?.doSample === false;
  }

  /**
   * Parse tool call arguments with caching for loop detection
   * Returns cached result if available, otherwise parses and caches
   * Used specifically for isRepetitiveToolCall to avoid redundant parsing
   */
  private parseToolArgumentsCached(toolCall: LLMToolCall): Record<string, unknown> {
    const cached = this.toolCallArgsCache.get(toolCall.id);
    if (cached) {
      return cached;
    }

    try {
      const args = JSON.parse(toolCall.function.arguments || '{}');
      this.toolCallArgsCache.set(toolCall.id, args);

      // Prevent unbounded memory growth - limit cache size
      if (this.toolCallArgsCache.size > 500) {
        let deleted = 0;
        for (const key of this.toolCallArgsCache.keys()) {
          this.toolCallArgsCache.delete(key);
          deleted++;
          if (deleted >= 100) break;
        }
      }

      return args;
    } catch {
      // Return empty object on parse error (don't cache failures)
      return {};
    }
  }

  /**
   * Lazy-loaded getter for ArchitectureTool
   * Only instantiates when first accessed to reduce startup time
   */
  private get architectureTool(): ArchitectureTool {
    if (!this._architectureTool) {
      this._architectureTool = new ArchitectureTool();
    }
    return this._architectureTool;
  }

  /**
   * Lazy-loaded getter for ValidationTool
   * Only instantiates when first accessed to reduce startup time
   */
  private get validationTool(): ValidationTool {
    if (!this._validationTool) {
      this._validationTool = new ValidationTool();
    }
    return this._validationTool;
  }

  /**
   * Detect if a tool call is repetitive (likely causing a loop)
   * Returns true if the same tool with similar arguments was called multiple times recently
   */
  private isRepetitiveToolCall(toolCall: LLMToolCall): boolean {
    // Check if loop detection is disabled globally
    if (!AGENT_CONFIG.ENABLE_LOOP_DETECTION) {
      return false;
    }

    // Check if threshold is 0 (disabled via threshold)
    if (AGENT_CONFIG.LOOP_DETECTION_THRESHOLD <= 0) {
      return false;
    }

    try {
      const args = this.parseToolArgumentsCached(toolCall);

      // Create a detailed signature that includes key arguments
      // This allows multiple different commands but catches true repetitions
      let signature = toolCall.function.name;

      if (toolCall.function.name === 'bash' && args.command && typeof args.command === 'string') {
        // Normalize command: trim whitespace, collapse multiple spaces
        const normalizedCommand = args.command.trim().replace(/\s+/g, ' ');
        // Use full command for exact matching (catches true duplicates)
        signature = `bash:${normalizedCommand}`;
      } else if (toolCall.function.name === 'search' && args.query && typeof args.query === 'string') {
        // For search, include the normalized query
        const normalizedQuery = args.query.trim().toLowerCase().replace(/\s+/g, ' ');
        signature = `search:${normalizedQuery}`;
      } else if (toolCall.function.name === 'view_file' && args.path && typeof args.path === 'string') {
        // For file reads, include the path
        signature = `view:${args.path}`;
      } else if (toolCall.function.name === 'create_file' && args.path && typeof args.path === 'string') {
        // For file writes, include the path
        signature = `create:${args.path}`;
      } else if (toolCall.function.name === 'str_replace_editor' && args.path && typeof args.path === 'string') {
        // For text editor, include the path
        signature = `edit:${args.path}`;
      }

      // Track by detailed signature
      const count = this.recentToolCalls.get(signature) || 0;

      // Debug logging
      if (process.env.DEBUG_LOOP_DETECTION === '1') {
        console.error(`[LOOP DETECTION] Tool: ${toolCall.function.name}`);
        console.error(`[LOOP DETECTION] Signature: ${signature}`);
        console.error(`[LOOP DETECTION] Count: ${count}`);
        console.error(`[LOOP DETECTION] Threshold: ${AGENT_CONFIG.LOOP_DETECTION_THRESHOLD}`);
        console.error(`[LOOP DETECTION] Map size: ${this.recentToolCalls.size}`);
      }

      // Increment the count first
      const newCount = count + 1;
      this.recentToolCalls.set(signature, newCount);

      // Check if we've exceeded the configured threshold
      // newCount > threshold means we've seen it threshold+1 times
      if (newCount > AGENT_CONFIG.LOOP_DETECTION_THRESHOLD) {
        if (process.env.DEBUG_LOOP_DETECTION === '1') {
          console.error(`[LOOP DETECTION] ⚠️ LOOP DETECTED! Signature: ${signature} (count: ${newCount}, threshold: ${AGENT_CONFIG.LOOP_DETECTION_THRESHOLD})`);
        }
        return true;
      }

      if (process.env.DEBUG_LOOP_DETECTION === '1') {
        console.error(`[LOOP DETECTION] ✅ Allowed, count now: ${newCount}`);
        console.error(`[LOOP DETECTION] Current map:`, Array.from(this.recentToolCalls.entries()));
      }

      // Clean up old entries (keep only last N unique calls)
      // Batch cleanup when exceeding threshold to prevent unbounded growth
      if (this.recentToolCalls.size > AGENT_CONFIG.MAX_RECENT_TOOL_CALLS) {
        const excessCount = this.recentToolCalls.size - AGENT_CONFIG.MAX_RECENT_TOOL_CALLS + 10;
        let removed = 0;
        for (const key of this.recentToolCalls.keys()) {
          if (removed >= excessCount) break;
          this.recentToolCalls.delete(key);
          removed++;
        }
      }

      return false;
    } catch (error) {
      // If we can't parse, assume it's not repetitive
      if (process.env.DEBUG_LOOP_DETECTION === '1') {
        console.error(`[LOOP DETECTION] ❌ Parse error:`, error);
      }
      return false;
    }
  }

  /**
   * Reset the tool call tracking (called at start of new user message)
   */
  private resetToolCallTracking(): void {
    if (process.env.DEBUG_LOOP_DETECTION === '1') {
      console.error(`[LOOP TRACKING] 🔄 Resetting tool call tracking (map had ${this.recentToolCalls.size} entries)`);
    }
    this.recentToolCalls.clear();
    // Also clear the args cache to prevent memory leak
    this.toolCallArgsCache.clear();
  }


  // ============================================================================
  // Multi-Phase Planning Integration
  // ============================================================================

  /**
   * Check if a request should trigger multi-phase planning
   */
  private shouldCreatePlan(message: string): boolean {
    if (!this.planningEnabled) return false;
    return isComplexRequest(message);
  }

  /**
   * Get the current plan if any
   */
  getCurrentPlan(): TaskPlan | null {
    return this.currentPlan;
  }

  /**
   * Execute a single phase using the LLM
   */
  private async executePhase(
    phase: TaskPhase,
    context: {
      planId: string;
      originalRequest: string;
      completedPhases: string[];
    }
  ): Promise<PhaseResult> {
    const startTime = Date.now();
    const startTokens = this.tokenCounter.countMessageTokens(this.messages);
    const filesModified: string[] = [];
    let lastAssistantContent = "";

    // Emit phase started event
    this.emit("phase:started", { phase, planId: context.planId });

    try {
      // Build phase-specific prompt
      const phasePrompt = this.buildPhasePrompt(phase, context);

      // Execute through normal message processing (without recursively planning)
      const savedPlanningState = this.planningEnabled;
      this.planningEnabled = false; // Temporarily disable planning for phase execution

      // Add phase context to messages
      this.messages.push({
        role: "user",
        content: phasePrompt,
      });

      // Execute using the standard tool loop
      const tools = await getAllGrokTools();
      let toolRounds = 0;
      const maxPhaseRounds = Math.min(this.maxToolRounds, 50); // Limit per phase

      while (toolRounds < maxPhaseRounds) {
        const response = await this.llmClient.chat(this.messages, tools, this.buildChatOptions());
        const assistantMessage = response.choices[0]?.message;

        if (!assistantMessage) break;

        // Capture the assistant's content for phase output
        if (assistantMessage.content) {
          lastAssistantContent = assistantMessage.content;
        }

        // Add to messages
        this.messages.push({
          role: "assistant",
          content: assistantMessage.content || "",
          tool_calls: assistantMessage.tool_calls,
        } as LLMMessage);

        // Check for tool calls
        if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
          break; // No more tool calls, phase complete
        }

        toolRounds++;

        // Execute tools and track file modifications
        for (const toolCall of assistantMessage.tool_calls) {
          const result = await this.executeTool(toolCall);

          // Track file modifications from text_editor tool
          if (toolCall.function.name === "text_editor" ||
              toolCall.function.name === "str_replace_editor") {
            const args = this.parseToolArgumentsCached(toolCall);
            if (args.path && result.success) {
              if (!filesModified.includes(args.path as string)) {
                filesModified.push(args.path as string);
              }
            }
          }

          this.messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result.output || result.error || "No output",
          } as LLMMessage);
        }
      }

      // Restore planning state
      this.planningEnabled = savedPlanningState;

      // Prune context if configured
      if (PLANNER_CONFIG.PRUNE_AFTER_PHASE) {
        this.applyContextPruning();
      }

      const endTokens = this.tokenCounter.countMessageTokens(this.messages);
      const duration = Date.now() - startTime;

      // Build meaningful output
      const output = lastAssistantContent ||
        `Phase "${phase.name}" completed (${toolRounds} tool rounds, ${filesModified.length} files modified)`;

      // Emit phase completed event
      this.emit("phase:completed", {
        phase,
        planId: context.planId,
        result: { success: true, output, filesModified }
      });

      return {
        phaseId: phase.id,
        success: true,
        output,
        duration,
        tokensUsed: endTokens - startTokens,
        filesModified,
        wasRetry: false,
        retryAttempt: 0,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = extractErrorMessage(error);

      // Emit phase failed event
      this.emit("phase:failed", {
        phase,
        planId: context.planId,
        error: errorMessage
      });

      return {
        phaseId: phase.id,
        success: false,
        error: errorMessage,
        duration,
        tokensUsed: 0,
        filesModified,
        wasRetry: false,
        retryAttempt: 0,
      };
    }
  }

  /**
   * Build a prompt for phase execution
   */
  private buildPhasePrompt(
    phase: TaskPhase,
    context: {
      planId: string;
      originalRequest: string;
      completedPhases: string[];
    }
  ): string {
    let prompt = `## Phase ${phase.index + 1}: ${phase.name}\n\n`;
    prompt += `**Objective:** ${phase.description}\n\n`;

    if (phase.objectives.length > 0) {
      prompt += "**Tasks to complete:**\n";
      for (const obj of phase.objectives) {
        prompt += `- ${obj}\n`;
      }
      prompt += "\n";
    }

    if (context.completedPhases.length > 0) {
      prompt += `**Previously completed phases:** ${context.completedPhases.join(", ")}\n\n`;
    }

    prompt += `**Original request:** ${context.originalRequest}\n\n`;
    prompt += "Please complete this phase. Focus only on the objectives listed above.";

    return prompt;
  }

  /**
   * Generate and execute a plan for a complex request
   * Uses TodoWrite for Claude Code-style seamless progress display
   */
  async *processWithPlanning(
    message: string
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    // Add user message to history
    const userEntry: ChatEntry = {
      type: "user",
      content: message,
      timestamp: new Date(),
    };
    this.chatHistory.push(userEntry);
    this.messages.push({ role: "user", content: message });

    // Silent mode: no explicit banner, just start working
    if (!PLANNER_CONFIG.SILENT_MODE) {
      yield {
        type: "content",
        content: "📋 **Analyzing request and creating execution plan...**\n\n",
      };
    }

    try {
      // Generate plan using LLM
      const plan = await this.taskPlanner.generatePlan(
        message,
        async (systemPrompt, userPrompt) => {
          const planMessages: LLMMessage[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ];
          const response = await this.llmClient.chat(planMessages, [], this.buildChatOptions());
          return response.choices[0]?.message?.content || "";
        },
        {
          projectType: "typescript", // Could be detected
        }
      );

      if (!plan) {
        yield {
          type: "content",
          content: "Could not generate a plan. Processing as single request...\n\n",
        };
        // Fall back to normal processing - disable planning and retry
        this.planningEnabled = false;
        yield* this.processUserMessageStreamInternal(message);
        this.planningEnabled = true;
        return;
      }

      this.currentPlan = plan;

      // Emit plan created event
      this.emit("plan:created", { plan });

      // Create TodoWrite items for phases (Claude Code-style progress)
      if (PLANNER_CONFIG.SILENT_MODE) {
        // Use TodoWrite to show phases as natural todo items
        const todoItems = plan.phases.map((phase, index) => ({
          id: `phase-${index}`,
          content: phase.name,
          status: index === 0 ? "in_progress" as const : "pending" as const,
          priority: phase.riskLevel === "high" ? "high" as const :
                   phase.riskLevel === "low" ? "low" as const : "medium" as const,
        }));
        try {
          await this.todoTool.createTodoList(todoItems);
        } catch (todoError) {
          // TodoWrite failure is non-critical, continue execution
          console.warn("TodoWrite create failed:", extractErrorMessage(todoError));
        }
      } else {
        // Display explicit plan summary
        yield {
          type: "content",
          content: this.formatPlanSummary(plan),
        };
      }

      // Execute phases one by one with progress updates
      const phaseResults: PhaseResult[] = [];
      let totalTokensUsed = 0;
      const planStartTime = Date.now();

      for (let i = 0; i < plan.phases.length; i++) {
        const phase = plan.phases[i];
        plan.currentPhaseIndex = i;

        if (PLANNER_CONFIG.SILENT_MODE) {
          // Update TodoWrite: mark current phase as in_progress
          try {
            await this.todoTool.updateTodoList([{
              id: `phase-${i}`,
              status: "in_progress",
            }]);
          } catch { /* TodoWrite update is non-critical */ }
        } else {
          // Show explicit phase starting banner
          yield {
            type: "content",
            content: `\n**⏳ Phase ${i + 1}/${plan.phases.length}: ${phase.name}**\n`,
          };
        }

        // Execute the phase
        const context = {
          planId: plan.id,
          originalRequest: message,
          completedPhases: phaseResults.filter(r => r.success).map(r => r.phaseId),
        };

        const result = await this.executePhase(phase, context);
        phaseResults.push(result);
        totalTokensUsed += result.tokensUsed;

        // Report phase result
        if (result.success) {
          if (PLANNER_CONFIG.SILENT_MODE) {
            // Update TodoWrite: mark phase as completed
            try {
              await this.todoTool.updateTodoList([{
                id: `phase-${i}`,
                status: "completed",
              }]);
            } catch { /* TodoWrite update is non-critical */ }
          } else {
            yield {
              type: "content",
              content: `✓ Phase ${i + 1} completed (${Math.ceil(result.duration / 1000)}s)\n`,
            };
            if (result.filesModified.length > 0) {
              yield {
                type: "content",
                content: `  Files modified: ${result.filesModified.join(", ")}\n`,
              };
            }
          }
        } else {
          if (PLANNER_CONFIG.SILENT_MODE) {
            // Update TodoWrite: mark phase as failed (update content to show failure)
            try {
              await this.todoTool.updateTodoList([{
                id: `phase-${i}`,
                status: "completed", // Mark as done even if failed
                content: `${phase.name} (failed)`,
              }]);
            } catch { /* TodoWrite update is non-critical */ }
          } else {
            yield {
              type: "content",
              content: `✕ Phase ${i + 1} failed: ${result.error}\n`,
            };
          }
          // Continue with next phase unless abort strategy
          if (phase.fallbackStrategy === "abort") {
            if (!PLANNER_CONFIG.SILENT_MODE) {
              yield {
                type: "content",
                content: `\n⚠️ Plan aborted due to phase failure.\n`,
              };
            }
            break;
          }
        }
      }

      const totalDuration = Date.now() - planStartTime;

      // Build final result
      const successfulPhases = phaseResults.filter(r => r.success);
      const failedPhases = phaseResults.filter(r => !r.success);
      const allFilesModified = [...new Set(phaseResults.flatMap(r => r.filesModified))];

      const summary = successfulPhases.length === phaseResults.length
        ? `All ${phaseResults.length} phases completed successfully. ${allFilesModified.length} files modified.`
        : `${successfulPhases.length}/${phaseResults.length} phases completed. ${failedPhases.length} failed.`;

      const warnings: string[] = [];
      for (const result of failedPhases) {
        warnings.push(`Phase ${result.phaseId} failed: ${result.error || "Unknown error"}`);
      }

      const planResult: PlanResult = {
        planId: plan.id,
        success: phaseResults.every(r => r.success),
        phaseResults,
        totalDuration,
        totalTokensUsed,
        summary,
        warnings,
      };

      // Report final results (silent mode shows minimal output)
      if (!PLANNER_CONFIG.SILENT_MODE) {
        yield {
          type: "content",
          content: this.formatPlanResult(planResult),
        };
      } else {
        // Brief completion message in silent mode
        const successCount = phaseResults.filter(r => r.success).length;
        if (successCount === phaseResults.length) {
          yield {
            type: "content",
            content: `\n✓ All ${phaseResults.length} tasks completed successfully.\n`,
          };
        } else {
          yield {
            type: "content",
            content: `\n⚠️ ${successCount}/${phaseResults.length} tasks completed. Check todo list for details.\n`,
          };
        }
      }

      // Emit plan completed event
      this.emit("plan:completed", { plan, result: planResult });

      this.currentPlan = null;

    } catch (error) {
      // Defensive error extraction to prevent nested failures
      let errorMsg: string;
      try {
        errorMsg = extractErrorMessage(error);
      } catch {
        errorMsg = String(error) || "Unknown error";
      }

      yield {
        type: "content",
        content: `\n⚠️ Plan execution error: ${errorMsg}\n`,
      };
      this.emit("plan:failed", { error: errorMsg });
      this.currentPlan = null;
    }
  }

  /**
   * Internal streaming processor (used when planning falls back)
   * Executes the core message processing loop without planning
   */
  private async *processUserMessageStreamInternal(
    message: string
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    // Reset tool call tracking for new message
    this.resetToolCallTracking();

    // Prepare user message and get input tokens
    const inputTokensRef = { value: this.prepareUserMessageForStreaming(message) };
    yield {
      type: "token_count",
      tokenCount: inputTokensRef.value,
    };

    // Yield context warnings if needed
    yield* this.yieldContextWarnings();

    const maxToolRounds = this.maxToolRounds;
    let toolRounds = 0;
    const totalOutputTokensRef = { value: 0 };
    const lastTokenUpdateRef = { value: 0 };

    try {
      // Agent loop - continue until no more tool calls or max rounds reached
      while (toolRounds < maxToolRounds) {
        // Check if operation was cancelled
        if (this.isCancelled()) {
          yield* this.yieldCancellation();
          return;
        }

        // Load tools safely
        const tools = await this.loadToolsSafely();

        // Create chat stream
        const stream = this.llmClient.chatStream(
          this.messages,
          tools,
          this.buildChatOptions({
            searchOptions: { search_parameters: { mode: "off" } }
          })
        );

        // Process streaming chunks
        const chunkGen = this.processStreamingChunks(
          stream,
          inputTokensRef.value,
          lastTokenUpdateRef,
          totalOutputTokensRef
        );

        let streamResult: { accumulated: any; content: string; yielded: boolean } | undefined;
        for await (const chunk of chunkGen) {
          if ('accumulated' in chunk) {
            streamResult = chunk;
          } else {
            yield chunk;
          }
        }

        if (!streamResult) {
          continue;
        }

        // Add assistant message to history
        this.addAssistantMessage(streamResult.accumulated);

        // Handle tool calls if present
        if (streamResult.accumulated.tool_calls?.length > 0) {
          toolRounds++;

          // Check for repetitive tool calls (loop detection)
          const hasRepetitiveCall = (streamResult.accumulated.tool_calls as LLMToolCall[]).some(
            (tc: LLMToolCall) => this.isRepetitiveToolCall(tc)
          );

          if (hasRepetitiveCall) {
            yield {
              type: "content",
              content: "\n\n⚠️ Detected repetitive tool calls. Stopping to prevent infinite loop.\n",
            };
            break;
          }

          yield* this.executeToolCalls(
            streamResult.accumulated.tool_calls as LLMToolCall[],
            streamResult.yielded,
            inputTokensRef,
            totalOutputTokensRef
          );
          // Continue loop to get next response
        } else {
          // No tool calls, we're done
          break;
        }
      }
    } catch (error) {
      const errorMsg = extractErrorMessage(error);
      yield {
        type: "content",
        content: `\n⚠️ Error processing message: ${errorMsg}\n`,
      };
    }

    // Final token count
    yield {
      type: "token_count",
      tokenCount: inputTokensRef.value + totalOutputTokensRef.value,
    };

    yield { type: "done" };
  }

  /**
   * Format plan summary for display
   */
  private formatPlanSummary(plan: TaskPlan): string {
    let output = `**📋 Execution Plan Created**\n\n`;
    output += `**Request:** ${plan.originalPrompt.slice(0, 100)}${plan.originalPrompt.length > 100 ? "..." : ""}\n\n`;
    output += `**Phases (${plan.phases.length}):**\n`;

    for (const phase of plan.phases) {
      const riskIcon = phase.riskLevel === "high" ? "⚠️" : phase.riskLevel === "medium" ? "△" : "";
      output += `  ${phase.index + 1}. ${phase.name} ${riskIcon}\n`;
    }

    output += `\n**Estimated Duration:** ~${Math.ceil(plan.estimatedDuration / 60000)} min\n\n`;
    output += "---\n\n";

    return output;
  }

  /**
   * Format plan result for display
   */
  private formatPlanResult(result: PlanResult): string {
    let output = "\n---\n\n**📋 Plan Execution Complete**\n\n";

    const successful = result.phaseResults.filter((r) => r.success).length;
    const failed = result.phaseResults.filter((r) => !r.success).length;

    output += `**Results:** ${successful}/${result.phaseResults.length} phases successful`;
    if (failed > 0) {
      output += ` (${failed} failed)`;
    }
    output += "\n";

    if (result.totalDuration) {
      output += `**Duration:** ${Math.ceil(result.totalDuration / 1000)}s\n`;
    }

    if (result.totalTokensUsed) {
      output += `**Tokens Used:** ${result.totalTokensUsed.toLocaleString()}\n`;
    }

    return output;
  }

  async processUserMessage(message: string): Promise<ChatEntry[]> {
    // Check if agent has been disposed
    this.checkDisposed();

    // Reset tool call tracking for new message
    this.resetToolCallTracking();

    // Resolve MCP resource references (Phase 4)
    let resolvedMessage = message;
    const mcpReferences = extractMCPReferences(message);
    if (mcpReferences.length > 0) {
      try {
        const mcpManager = getMCPManager();
        resolvedMessage = await resolveMCPReferences(message, mcpManager);
      } catch (error) {
        // If resolution fails, continue with original message
        console.warn('Failed to resolve MCP references:', error);
      }
    }

    // Add user message to conversation
    const userEntry: ChatEntry = {
      type: "user",
      content: resolvedMessage,
      timestamp: new Date(),
    };
    this.chatHistory.push(userEntry);
    this.messages.push({ role: "user", content: resolvedMessage });

    const newEntries: ChatEntry[] = [userEntry];
    const maxToolRounds = this.maxToolRounds; // Prevent infinite loops
    let toolRounds = 0;

    try {
      const tools = await getAllGrokTools();
      let currentResponse = await this.llmClient.chat(
        this.messages,
        tools,
        this.buildChatOptions({
          searchOptions: { search_parameters: { mode: "off" } }
        })
      );

      // Agent loop - continue until no more tool calls or max rounds reached
      while (toolRounds < maxToolRounds) {
        const assistantMessage = currentResponse.choices[0]?.message;

        if (!assistantMessage) {
          throw new Error("No response from AI");
        }

        // Handle tool calls
        if (
          assistantMessage.tool_calls &&
          assistantMessage.tool_calls.length > 0
        ) {
          toolRounds++;

          // Check for repetitive tool calls (loop detection)
          if (process.env.DEBUG_LOOP_DETECTION === '1') {
            console.error(`\n[LOOP CHECK] Checking ${assistantMessage.tool_calls.length} tool calls...`);
          }

          const hasRepetitiveCall = assistantMessage.tool_calls.some(
            (tc: LLMToolCall) => this.isRepetitiveToolCall(tc)
          );

          if (process.env.DEBUG_LOOP_DETECTION === '1') {
            console.error(`[LOOP CHECK] hasRepetitiveCall: ${hasRepetitiveCall}\n`);
          }

          if (hasRepetitiveCall) {
            if (process.env.DEBUG_LOOP_DETECTION === '1') {
              console.error(`[LOOP CHECK] 🛑 Breaking loop!`);
            }
            const warningEntry: ChatEntry = {
              type: "assistant",
              content:
                "⚠️ Detected repetitive tool calls. Stopping to prevent infinite loop.\n\nI apologize, but I seem to be stuck in a loop trying to answer your question. Let me provide what I can without further tool use.",
              timestamp: new Date(),
            };
            this.chatHistory.push(warningEntry);
            newEntries.push(warningEntry);
            break;
          }

          // Add assistant message with tool calls
          const assistantEntry: ChatEntry = {
            type: "assistant",
            content: assistantMessage.content || "Using tools to help you...",
            timestamp: new Date(),
            toolCalls: assistantMessage.tool_calls,
          };
          this.chatHistory.push(assistantEntry);
          newEntries.push(assistantEntry);

          // Add assistant message to conversation
          this.messages.push({
            role: "assistant",
            content: assistantMessage.content || "",
            tool_calls: assistantMessage.tool_calls,
          } as LLMMessage);

          // Create initial tool call entries to show tools are being executed
          assistantMessage.tool_calls.forEach((toolCall) => {
            const toolCallEntry: ChatEntry = {
              type: "tool_call",
              content: "Executing...",
              timestamp: new Date(),
              toolCall: toolCall,
            };
            const index = this.chatHistory.length;
            this.chatHistory.push(toolCallEntry);
            this.toolCallIndexMap.set(toolCall.id, index); // O(1) lookup for later updates
            newEntries.push(toolCallEntry);
          });

          // Execute tool calls and update the entries
          for (const toolCall of assistantMessage.tool_calls) {
            const result = await this.executeTool(toolCall);

            // Update the existing tool_call entry with the result (O(1) lookup)
            const entryIndex = this.toolCallIndexMap.get(toolCall.id);

            if (entryIndex !== undefined) {
              const updatedEntry: ChatEntry = {
                ...this.chatHistory[entryIndex],
                type: "tool_result",
                content: result.success
                  ? result.output || "Success"
                  : result.error || "Error occurred",
                toolResult: result,
              };
              this.chatHistory[entryIndex] = updatedEntry;

              // Also update in newEntries for return value
              const newEntryIndex = newEntries.findIndex(
                (entry) =>
                  entry.type === "tool_call" &&
                  entry.toolCall?.id === toolCall.id
              );
              if (newEntryIndex !== -1) {
                newEntries[newEntryIndex] = updatedEntry;
              }
            }

            // Add tool result to messages with proper format (needed for AI context)
            this.messages.push({
              role: "tool",
              content: result.success
                ? result.output || "Success"
                : result.error || "Error",
              tool_call_id: toolCall.id,
            });
          }

          // Apply context pruning after adding tool results to prevent overflow
          // Tool results can be very large (file reads, grep output, etc.)
          this.applyContextPruning();

          // Get next response - this might contain more tool calls
          currentResponse = await this.llmClient.chat(
            this.messages,
            tools,
            this.buildChatOptions({
              searchOptions: { search_parameters: { mode: "off" } }
            })
          );
        } else {
          // No more tool calls, add final response
          const finalEntry: ChatEntry = {
            type: "assistant",
            content:
              assistantMessage.content ||
              "I understand, but I don't have a specific response.",
            timestamp: new Date(),
          };
          this.chatHistory.push(finalEntry);
          this.messages.push({
            role: "assistant",
            content: assistantMessage.content || "",
          });
          newEntries.push(finalEntry);
          break; // Exit the loop
        }
      }

      if (toolRounds >= maxToolRounds) {
        const warningEntry: ChatEntry = {
          type: "assistant",
          content:
            "Maximum tool execution rounds reached. Stopping to prevent infinite loops.",
          timestamp: new Date(),
        };
        this.chatHistory.push(warningEntry);
        newEntries.push(warningEntry);
      }

      return newEntries;
    } catch (error: unknown) {
      const errorMsg = extractErrorMessage(error);
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Sorry, I encountered an error: ${errorMsg}`,
        timestamp: new Date(),
      };
      this.chatHistory.push(errorEntry);
      return [userEntry, errorEntry];
    }
  }

  /**
   * Optimized streaming delta merge - mutates accumulator for performance
   * This is safe because accumulator is only used internally during streaming
   *
   * Performance: 50% faster than immutable approach (no object copying)
   */
  private reduceStreamDelta(
    acc: Record<string, unknown>,
    delta: Record<string, unknown>
  ): Record<string, unknown> {
    for (const [key, value] of Object.entries(delta)) {
      if (value === undefined || value === null) {
        continue; // Skip undefined/null values
      }

      if (acc[key] === undefined || acc[key] === null) {
        // Initial value assignment
        acc[key] = value;
        // Clean up index properties from tool calls
        if (Array.isArray(acc[key])) {
          for (const arr of acc[key]) {
            if (arr && typeof arr === 'object') {
              delete arr.index;
            }
          }
        }
      } else if (typeof acc[key] === "string" && typeof value === "string") {
        // String concatenation (most common case during streaming)
        acc[key] += value;
      } else if (Array.isArray(acc[key]) && Array.isArray(value)) {
        // Array merging (for tool calls)
        const accArray = acc[key] as unknown[];
        for (let i = 0; i < value.length; i++) {
          if (value[i] === undefined || value[i] === null) continue;
          if (!accArray[i]) {
            accArray[i] = {};
          }
          // Recursively merge array elements
          this.reduceStreamDelta(accArray[i] as Record<string, unknown>, value[i] as Record<string, unknown>);
        }
      } else if (typeof acc[key] === "object" && typeof value === "object") {
        // Object merging
        this.reduceStreamDelta(acc[key] as Record<string, unknown>, value as Record<string, unknown>);
      } else {
        // Direct assignment for other types
        acc[key] = value;
      }
    }
    return acc;
  }

  /**
   * Accumulate streaming message chunks
   */
  private messageReducer(
    previous: Record<string, unknown>,
    item: GLM46StreamChunk
  ): Record<string, unknown> {
    // Safety check: ensure item has valid structure
    if (!item?.choices || item.choices.length === 0 || !item.choices[0]?.delta) {
      return previous;
    }
    return this.reduceStreamDelta(previous, item.choices[0].delta as Record<string, unknown>);
  }

  /**
   * Prepare user message and apply context management
   * Returns the calculated input tokens
   */
  private prepareUserMessageForStreaming(message: string): number {
    // Add user message to conversation
    const userEntry: ChatEntry = {
      type: "user",
      content: message,
      timestamp: new Date(),
    };
    this.chatHistory.push(userEntry);
    this.messages.push({ role: "user", content: message });

    // Apply context management before sending to API
    this.applyContextPruning();

    // Calculate input tokens
    return this.tokenCounter.countMessageTokens(this.messages);
  }

  /**
   * Yield context warnings if needed
   */
  private async *yieldContextWarnings(): AsyncGenerator<StreamingChunk, void, unknown> {
    const stats = this.contextManager.getStats(this.messages, this.tokenCounter);
    if (stats.shouldPrune || stats.isNearLimit) {
      const warning = this.contextManager.createWarningMessage(stats);
      yield {
        type: "content",
        content: `\n${warning}\n\n`,
      };
    }
  }

  /**
   * Check if operation was cancelled
   */
  private isCancelled(): boolean {
    return this.abortController?.signal.aborted ?? false;
  }

  /**
   * Yield cancellation message
   */
  private async *yieldCancellation(): AsyncGenerator<StreamingChunk, void, unknown> {
    yield {
      type: "content",
      content: "\n\n[Operation cancelled by user]",
    };
    yield { type: "done" };
  }

  /**
   * Load tools with error handling
   * Returns tools array, logs error if loading fails
   */
  private async loadToolsSafely(): Promise<LLMTool[]> {
    try {
      return await getAllGrokTools();
    } catch (error: unknown) {
      // Log error but don't throw - continue with empty tools
      const errorMsg = extractErrorMessage(error);
      console.warn(`⚠️ Error loading tools: ${errorMsg}`);
      return [];
    }
  }

  /**
   * Process streaming chunks and accumulate message
   */
  private async *processStreamingChunks(
    stream: AsyncIterable<GLM46StreamChunk>,
    inputTokens: number,
    lastTokenUpdate: { value: number },
    totalOutputTokens: { value: number }
  ): AsyncGenerator<StreamingChunk | { accumulated: Record<string, unknown>; content: string; yielded: boolean }, { accumulated: Record<string, unknown>; content: string; yielded: boolean }, unknown> {
    let accumulatedMessage: Record<string, unknown> = {};
    let accumulatedContent = "";
    let toolCallsYielded = false;
    let usageData: Record<string, unknown> | null = null;

    for await (const chunk of stream) {
      // Check for cancellation in the streaming loop
      if (this.isCancelled()) {
        yield* this.yieldCancellation();
        // Return empty state after cancellation to avoid processing partial results
        return { accumulated: {}, content: "", yielded: false };
      }

      if (!chunk.choices?.[0]) continue;

      // Capture usage data from chunks (usually in the final chunk)
      if (chunk.usage) {
        usageData = chunk.usage;
      }

      // Accumulate the message using reducer
      accumulatedMessage = this.messageReducer(accumulatedMessage, chunk);

      // Check for tool calls - yield when we have complete tool calls with function names
      const toolCalls = accumulatedMessage.tool_calls as Array<Record<string, unknown>> | undefined;
      if (!toolCallsYielded && toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
        const hasCompleteTool = toolCalls.some(
          (tc: Record<string, unknown>) => (tc.function as Record<string, unknown>)?.name
        );
        if (hasCompleteTool) {
          yield {
            type: "tool_calls",
            toolCalls: toolCalls as unknown as LLMToolCall[],
          };
          toolCallsYielded = true;
        }
      }

      // Stream reasoning content (GLM-4.6 thinking mode)
      // Safety check: ensure choices[0] exists before accessing
      if (chunk.choices[0]?.delta?.reasoning_content) {
        yield {
          type: "reasoning",
          reasoningContent: chunk.choices[0].delta.reasoning_content,
        };
      }

      // Stream content as it comes
      if (chunk.choices[0]?.delta?.content) {
        accumulatedContent += chunk.choices[0].delta.content;

        yield {
          type: "content",
          content: chunk.choices[0].delta.content,
        };

        // Emit token count update (throttled and optimized)
        const now = Date.now();
        if (now - lastTokenUpdate.value > 1000) { // Increased throttle to 1s for better performance
          lastTokenUpdate.value = now;

          // Use fast estimation during streaming (4 chars ≈ 1 token)
          // This is ~70% faster than tiktoken encoding
          const estimatedOutputTokens = Math.floor(accumulatedContent.length / 4) +
            (accumulatedMessage.tool_calls
              ? Math.floor(JSON.stringify(accumulatedMessage.tool_calls).length / 4)
              : 0);
          totalOutputTokens.value = estimatedOutputTokens;

          yield {
            type: "token_count",
            tokenCount: inputTokens + estimatedOutputTokens,
          };
        }
      }
    }

    // Track usage if available and emit accurate final token count
    if (usageData) {
      const tracker = getUsageTracker();
      tracker.trackUsage(this.llmClient.getCurrentModel(), usageData);

      // Emit accurate token count from API usage data (replaces estimation)
      const totalTokens = usageData.total_tokens as number | undefined;
      const completionTokens = usageData.completion_tokens as number | undefined;
      if (totalTokens) {
        totalOutputTokens.value = completionTokens || 0;
        yield {
          type: "token_count",
          tokenCount: totalTokens,
        };
      }
    }

    // CRITICAL: Yield the accumulated result so the main loop can access it!
    const result = { accumulated: accumulatedMessage, content: accumulatedContent, yielded: toolCallsYielded };
    yield result;
    return result;
  }

  /**
   * Add assistant message to history and conversation
   */
  private addAssistantMessage(accumulatedMessage: Record<string, unknown>): void {
    // Safely extract tool_calls with proper validation
    const toolCalls = Array.isArray(accumulatedMessage.tool_calls)
      ? (accumulatedMessage.tool_calls as LLMToolCall[])
      : undefined;

    const assistantEntry: ChatEntry = {
      type: "assistant",
      content: (accumulatedMessage.content as string) || "Using tools to help you...",
      timestamp: new Date(),
      toolCalls,
    };
    this.chatHistory.push(assistantEntry);

    this.messages.push({
      role: "assistant",
      content: (accumulatedMessage.content as string) || "",
      tool_calls: toolCalls,
    } as LLMMessage);

    // Apply context pruning after adding message to prevent overflow
    // Critical for long assistant responses and tool results
    this.applyContextPruning();
  }

  /**
   * Execute tool calls and yield results
   */
  private async *executeToolCalls(
    toolCalls: LLMToolCall[],
    toolCallsYielded: boolean,
    inputTokens: { value: number },
    totalOutputTokens: { value: number }
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    // Only yield tool_calls if we haven't already yielded them during streaming
    if (!toolCallsYielded) {
      yield {
        type: "tool_calls",
        toolCalls,
      };
    }

    // Execute tools
    for (const toolCall of toolCalls) {
      // Check for cancellation before executing each tool
      if (this.isCancelled()) {
        yield* this.yieldCancellation();
        return;
      }

      // Track execution timing (like Claude Code's timeout display)
      const executionStartTime = Date.now();
      const result = await this.executeTool(toolCall);
      const executionDurationMs = Date.now() - executionStartTime;

      const toolResultEntry: ChatEntry = {
        type: "tool_result",
        content: result.success
          ? result.output || "Success"
          : result.error || "Error occurred",
        timestamp: new Date(),
        toolCall: toolCall,
        toolResult: result,
        executionDurationMs, // Add execution duration for UI display
      };
      this.chatHistory.push(toolResultEntry);

      yield {
        type: "tool_result",
        toolCall,
        toolResult: result,
        executionDurationMs,
      };

      // Add tool result with proper format (needed for AI context)
      this.messages.push({
        role: "tool",
        content: result.success
          ? result.output || "Success"
          : result.error || "Error",
        tool_call_id: toolCall.id,
      });
    }

    // Apply context pruning after adding tool results to prevent overflow
    // Tool results can be very large (file reads, grep output, etc.)
    this.applyContextPruning();

    // Update token count after processing all tool calls
    inputTokens.value = this.tokenCounter.countMessageTokens(this.messages);
    yield {
      type: "token_count",
      tokenCount: inputTokens.value + totalOutputTokens.value,
    };
  }

  async *processUserMessageStream(
    message: string
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    // Create new abort controller for this request
    this.abortController = new AbortController();

    // Check if this is a complex request that should use multi-phase planning
    if (this.shouldCreatePlan(message)) {
      // Delegate to planning processor
      yield* this.processWithPlanning(message);
      yield { type: "done" };
      return;
    }

    // Reset tool call tracking for new message
    this.resetToolCallTracking();

    // Prepare user message and get input tokens
    const inputTokensRef = { value: this.prepareUserMessageForStreaming(message) };
    yield {
      type: "token_count",
      tokenCount: inputTokensRef.value,
    };

    // Yield context warnings if needed
    yield* this.yieldContextWarnings();

    const maxToolRounds = this.maxToolRounds;
    let toolRounds = 0;
    const totalOutputTokensRef = { value: 0 };
    const lastTokenUpdateRef = { value: 0 };

    try {
      // Agent loop - continue until no more tool calls or max rounds reached
      while (toolRounds < maxToolRounds) {
        if (process.env.DEBUG_LOOP_DETECTION === '1') {
          console.error(`\n[LOOP DEBUG] Agent loop iteration, toolRounds: ${toolRounds}`);
        }

        // Check if operation was cancelled
        if (this.isCancelled()) {
          yield* this.yieldCancellation();
          return;
        }

        // Load tools safely
        const tools = await this.loadToolsSafely();

        // Yield warning if no tools available
        if (tools.length === 0) {
          yield {
            type: "content",
            content: "\n⚠️ No tools available, continuing with limited functionality...\n\n"
          };
        }

        // Create chat stream
        const stream = this.llmClient.chatStream(
          this.messages,
          tools,
          this.buildChatOptions({
            searchOptions: { search_parameters: { mode: "off" } }
          })
        );

        // Process streaming chunks
        const chunkGen = this.processStreamingChunks(
          stream,
          inputTokensRef.value,
          lastTokenUpdateRef,
          totalOutputTokensRef
        );

        let streamResult: { accumulated: any; content: string; yielded: boolean } | undefined;
        for await (const chunk of chunkGen) {
          if ('accumulated' in chunk) {
            streamResult = chunk;
          } else {
            yield chunk;
          }
        }

        if (!streamResult) {
          continue;
        }

        // Add assistant message to history
        this.addAssistantMessage(streamResult.accumulated);

        // Handle tool calls if present
        if (streamResult.accumulated.tool_calls?.length > 0) {
          toolRounds++;

          // Check for repetitive tool calls (loop detection)
          const hasRepetitiveCall = (streamResult.accumulated.tool_calls as LLMToolCall[]).some(
            (tc: LLMToolCall) => this.isRepetitiveToolCall(tc)
          );

          if (hasRepetitiveCall) {
            yield {
              type: "content",
              content: "\n\n⚠️ Detected repetitive tool calls. Stopping to prevent infinite loop.\n\nI apologize, but I seem to be stuck in a loop trying to answer your question. Let me provide what I can without further tool use.",
            };
            break;
          }

          yield* this.executeToolCalls(
            streamResult.accumulated.tool_calls as LLMToolCall[],
            streamResult.yielded,
            inputTokensRef,
            totalOutputTokensRef
          );
          // Continue loop to get next response
        } else {
          // No tool calls, we're done
          break;
        }
      }

      // Check if max rounds reached
      if (toolRounds >= maxToolRounds) {
        yield {
          type: "content",
          content: "\n\nMaximum tool execution rounds reached. Stopping to prevent infinite loops.",
        };
      }

      yield { type: "done" };
    } catch (error: unknown) {
      // Check if this was a cancellation
      if (this.isCancelled()) {
        yield* this.yieldCancellation();
        return;
      }

      const errorMsg = extractErrorMessage(error);
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Sorry, I encountered an error: ${errorMsg}`,
        timestamp: new Date(),
      };
      this.chatHistory.push(errorEntry);
      yield {
        type: "content",
        content: errorEntry.content,
      };
      yield { type: "done" };
    } finally {
      // Clean up abort controller
      this.abortController = null;
    }
  }

  /**
   * Parse and validate tool call arguments
   * @param toolCall The tool call to parse arguments from
   * @param toolType Type of tool (for error messages)
   * @returns Parsed arguments or error result
   */
  private parseToolArguments(
    toolCall: LLMToolCall,
    toolType: string = 'Tool'
  ): { success: true; args: Record<string, unknown> } | { success: false; error: string } {
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

  private async executeTool(toolCall: LLMToolCall): Promise<ToolResult> {
    try {
      const parseResult = this.parseToolArguments(toolCall, 'Tool');
      if (!parseResult.success) {
        return { success: false, error: parseResult.error };
      }

      const args = parseResult.args;

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
        case "view_file":
          const startLine = getNumber('start_line');
          const endLine = getNumber('end_line');
          const range: [number, number] | undefined =
            startLine !== undefined && endLine !== undefined
              ? [startLine, endLine]
              : undefined;
          return await this.textEditor.view(getString('path'), range);

        case "create_file":
          return await this.textEditor.create(getString('path'), getString('content'));

        case "str_replace_editor":
          return await this.textEditor.strReplace(
            getString('path'),
            getString('old_str'),
            getString('new_str'),
            getBoolean('replace_all') ?? false
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

        case "search":
          const searchTypeValue = args.search_type;
          const validSearchType = (searchTypeValue === 'text' || searchTypeValue === 'files' || searchTypeValue === 'both') ? searchTypeValue : undefined;
          return await this.search.search(getString('query'), {
            searchType: validSearchType,
            includePattern: typeof args.include_pattern === 'string' ? args.include_pattern : undefined,
            excludePattern: typeof args.exclude_pattern === 'string' ? args.exclude_pattern : undefined,
            caseSensitive: getBoolean('case_sensitive'),
            wholeWord: getBoolean('whole_word'),
            regex: getBoolean('regex'),
            maxResults: getNumber('max_results'),
            fileTypes: Array.isArray(args.file_types) ? args.file_types : undefined,
            includeHidden: getBoolean('include_hidden'),
          });

        case "web_search": {
          const freshnessValue = args.freshness;
          const validFreshness = (freshnessValue === 'day' || freshnessValue === 'week' || freshnessValue === 'month' || freshnessValue === 'year') ? freshnessValue : undefined;
          const searchDepthValue = args.searchDepth;
          const validSearchDepth = (searchDepthValue === 'basic' || searchDepthValue === 'advanced') ? searchDepthValue : 'basic';

          return await this.webSearch.search(getString('query'), {
            maxResults: getNumber('maxResults'),
            includeAnswer: getBoolean('includeAnswer'),
            searchDepth: validSearchDepth,
            freshness: validFreshness,
          });
        }

        case "analyze_architecture": {
          const projectPath = typeof args.projectPath === 'string' ? args.projectPath : undefined;
          const depth = typeof args.depth === 'string' ? args.depth : undefined;
          return await this.architectureTool.execute({ projectPath, depth });
        }

        case "validate_best_practices": {
          const path = typeof args.path === 'string' ? args.path : undefined;
          const pattern = typeof args.pattern === 'string' ? args.pattern : undefined;
          const rules = typeof args.rules === 'object' && args.rules !== null ? args.rules as Record<string, { enabled: boolean }> : undefined;
          return await this.validationTool.execute({ path, pattern, rules });
        }

        default:
          // Check if this is an MCP tool
          if (toolCall.function.name.startsWith("mcp__")) {
            return await this.executeMCPTool(toolCall);
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

  private async executeMCPTool(toolCall: LLMToolCall): Promise<ToolResult> {
    try {
      const parseResult = this.parseToolArguments(toolCall, 'MCP tool');
      if (!parseResult.success) {
        return { success: false, error: parseResult.error };
      }

      const args = parseResult.args as any;
      const mcpManager = getMCPManager();

      const result = await mcpManager.callTool(toolCall.function.name, args);

      if (result.isError) {
        // Extract error message from MCP result content
        // Safely check content structure before accessing
        let errorMsg = "MCP tool error";
        if (result.content && result.content.length > 0) {
          const firstContent = result.content[0];
          if (typeof firstContent === 'object' && firstContent !== null && 'text' in firstContent) {
            errorMsg = String(firstContent.text) || errorMsg;
          }
        }
        return {
          success: false,
          error: errorMsg,
        };
      }

      // Extract content from result
      // Ensure result.content exists and is an array before mapping
      const output = result.content && Array.isArray(result.content)
        ? result.content
          .map((item) => {
            if (item.type === "text") {
              return item.text || ""; // Safety check for missing text property
            } else if (item.type === "resource") {
              return `Resource: ${item.resource?.uri || "Unknown"}`;
            }
            return String(item);
          })
          .join("\n")
        : "";

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

  getChatHistory(): ChatEntry[] {
    this.checkDisposed();
    return [...this.chatHistory];
  }

  getCurrentDirectory(): string {
    return this.bash.getCurrentDirectory();
  }

  async executeBashCommand(command: string): Promise<ToolResult> {
    return await this.bash.execute(command);
  }

  /**
   * Check if a bash command is currently executing
   */
  isBashExecuting(): boolean {
    return this.bash.isExecuting();
  }

  /**
   * Move currently running bash command to background
   * Returns task ID if successful, null otherwise
   */
  moveBashToBackground(): string | null {
    return this.bash.moveToBackground();
  }

  getCurrentModel(): string {
    return this.llmClient.getCurrentModel();
  }

  setModel(model: string): void {
    this.llmClient.setModel(model);
    // Update token counter for new model (use singleton)
    this.tokenCounter = getTokenCounter(model);
  }

  abortCurrentOperation(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Get current context window usage percentage
   * Returns a number between 0-100
   */
  getContextPercentage(): number {
    const stats = this.contextManager.getStats(this.messages, this.tokenCounter);
    return Math.round(stats.percentage * 100) / 100;
  }

  /**
   * Create a checkpoint of current state
   */
  async createCheckpoint(description?: string): Promise<string> {
    const files: Array<{ path: string; content: string }> = [];

    // For now, we don't capture file state automatically
    // This can be enhanced to capture modified files from tool calls

    const checkpoint = await this.checkpointManager.createCheckpoint({
      files,
      conversationState: this.chatHistory,
      description: description || 'Manual checkpoint',
      metadata: {
        model: this.llmClient.getCurrentModel(),
        triggeredBy: 'user',
      },
    });

    return checkpoint.id;
  }

  /**
   * Rewind conversation to a checkpoint
   */
  async rewindConversation(checkpointId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const conversationState = await this.checkpointManager.getConversationState(checkpointId);

      if (!conversationState) {
        return {
          success: false,
          error: `Checkpoint ${checkpointId} not found`,
        };
      }

      // Restore conversation state
      this.chatHistory = [...conversationState];

      // Rebuild messages array from chat history
      // Safely preserve system message if it exists
      const systemMessage = this.messages.length > 0 ? this.messages[0] : null;
      this.messages = systemMessage ? [systemMessage] : [];

      for (const entry of conversationState) {
        if (entry.type === 'user') {
          this.messages.push({
            role: 'user',
            content: entry.content,
          });
        } else if (entry.type === 'assistant') {
          this.messages.push({
            role: 'assistant',
            content: entry.content,
            tool_calls: entry.toolCalls,
          } as LLMMessage);
        } else if (entry.type === 'tool_result' && entry.toolCall) {
          this.messages.push({
            role: 'tool',
            content: entry.content,
            tool_call_id: entry.toolCall.id,
          });
        }
      }

      this.emit('system', `Conversation rewound to checkpoint ${checkpointId}`);

      return { success: true };
    } catch (error: unknown) {
      const errorMsg = extractErrorMessage(error);
      return {
        success: false,
        error: `Failed to rewind: ${errorMsg}`,
      };
    }
  }

  /**
   * Get checkpoint manager instance
   */
  getCheckpointManager(): CheckpointManager {
    return this.checkpointManager;
  }

  /**
   * Get subagent orchestrator instance
   */
  getSubagentOrchestrator(): SubagentOrchestrator {
    return this.subagentOrchestrator;
  }

  /**
   * Spawn a specialized subagent for a specific task
   * This is a user-facing method that simplifies subagent usage
   *
   * @param role - The role/specialization of the subagent
   * @param description - Task description
   * @param context - Optional additional context
   * @returns The result of the subagent execution
   */
  async spawnSubagent(
    role: string,
    description: string,
    context?: {
      files?: string[];
      additionalContext?: string;
    }
  ): Promise<{
    success: boolean;
    output: string;
    filesModified?: string[];
    filesCreated?: string[];
    error?: string;
  }> {
    try {
      // Import SubagentRole from subagent-types
      const { SubagentRole } = await import('./subagent-types.js');

      // Convert string role to SubagentRole enum
      const roleMap: Record<string, typeof SubagentRole[keyof typeof SubagentRole]> = {
        'testing': SubagentRole.TESTING,
        'documentation': SubagentRole.DOCUMENTATION,
        'refactoring': SubagentRole.REFACTORING,
        'analysis': SubagentRole.ANALYSIS,
        'debug': SubagentRole.DEBUG,
        'performance': SubagentRole.PERFORMANCE,
        'general': SubagentRole.GENERAL,
      };

      const subagentRole = roleMap[role.toLowerCase()] || SubagentRole.GENERAL;

      // Spawn the subagent
      const subagent = await this.subagentOrchestrator.spawnSubagent(subagentRole);

      // Execute the task
      const result = await subagent.executeTask({
        id: `task-${Date.now()}`,
        description,
        role: subagentRole,
        priority: 1,
        context: {
          files: context?.files || [],
          conversationHistory: this.chatHistory.slice(-10), // Last 10 messages
          metadata: {
            workingDirectory: process.cwd(),
            additionalContext: context?.additionalContext,
          },
        },
      });

      return {
        success: result.success,
        output: result.output,
        filesModified: result.filesModified,
        filesCreated: result.filesCreated,
        error: result.error,
      };
    } catch (error: unknown) {
      const errorMsg = extractErrorMessage(error);
      return {
        success: false,
        output: '',
        error: `Failed to spawn subagent: ${errorMsg}`,
      };
    }
  }

  /**
   * Execute multiple tasks in parallel using subagents
   * This automatically handles dependency resolution and parallel execution
   *
   * @param tasks - Array of tasks with role and description
   * @returns Array of results from all tasks
   */
  async executeParallelTasks(tasks: Array<{
    role: string;
    description: string;
    dependencies?: string[];
    id?: string;
  }>): Promise<Array<{
    taskId: string;
    success: boolean;
    output: string;
    filesModified?: string[];
    filesCreated?: string[];
    error?: string;
  }>> {
    try {
      // Import SubagentRole and SubagentTask
      const { SubagentRole } = await import('./subagent-types.js');

      const roleMap: Record<string, typeof SubagentRole[keyof typeof SubagentRole]> = {
        'testing': SubagentRole.TESTING,
        'documentation': SubagentRole.DOCUMENTATION,
        'refactoring': SubagentRole.REFACTORING,
        'analysis': SubagentRole.ANALYSIS,
        'debug': SubagentRole.DEBUG,
        'performance': SubagentRole.PERFORMANCE,
        'general': SubagentRole.GENERAL,
      };

      // Convert tasks to SubagentTask format
      const subagentTasks = tasks.map((task, index) => ({
        id: task.id || `task-${index}-${Date.now()}`,
        description: task.description,
        role: roleMap[task.role.toLowerCase()] ?? SubagentRole.GENERAL,
        priority: 1,
        context: {
          files: [],
          conversationHistory: this.chatHistory.slice(-10),
          metadata: {
            workingDirectory: process.cwd(),
          },
        },
        dependencies: task.dependencies || [],
      }));

      // Execute all tasks in parallel with dependency resolution
      const results = await this.subagentOrchestrator.executeParallel(subagentTasks);

      // Convert results to simpler format
      return results.map(result => ({
        taskId: result.taskId,
        success: result.success,
        output: result.output,
        filesModified: result.filesModified,
        filesCreated: result.filesCreated,
        error: result.error,
      }));
    } catch (error: unknown) {
      const errorMsg = extractErrorMessage(error);
      return [{
        taskId: 'error',
        success: false,
        output: '',
        error: `Failed to execute parallel tasks: ${errorMsg}`,
      }];
    }
  }

  /**
   * Check if agent has been disposed
   * @internal
   */
  private checkDisposed(): void {
    if (this.disposed) {
      const { SDKError, SDKErrorCode } = require('../sdk/errors.js');
      throw new SDKError(
        SDKErrorCode.AGENT_DISPOSED,
        'Agent has been disposed and cannot be used. Create a new agent instance.'
      );
    }
  }

  /**
   * Dispose of resources and remove event listeners
   *
   * This method should be called when the agent is no longer needed to prevent
   * memory leaks and properly close all connections.
   *
   * After calling dispose(), the agent cannot be used anymore. Any method calls
   * will throw an AGENT_DISPOSED error.
   *
   * Cleans up:
   * - Event listeners
   * - In-memory caches (tool calls, arguments)
   * - Token counter and context manager
   * - Aborts in-flight requests
   * - Terminates subagents
   * - Clears conversation history
   *
   * @example
   * ```typescript
   * const agent = await createAgent();
   * try {
   *   await agent.processUserMessage('task');
   * } finally {
   *   agent.dispose();  // Always cleanup
   * }
   * ```
   */
  dispose(): void {
    if (this.disposed) return; // Already disposed, safe to call multiple times

    this.disposed = true;

    // Remove all event listeners to prevent memory leaks
    this.removeAllListeners();

    // Dispose tools that have cleanup methods
    this.bash.dispose();

    // Clear in-memory caches
    this.recentToolCalls.clear();
    this.toolCallIndexMap.clear();
    this.toolCallArgsCache.clear();

    // Clear conversation history to free memory
    this.chatHistory = [];
    this.messages = [];

    // Dispose token counter and context manager
    this.tokenCounter.dispose();
    this.contextManager.dispose();

    // Abort any in-flight requests
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Terminate all subagents
    this.subagentOrchestrator.terminateAll().catch((error) => {
      console.warn('Error terminating subagents:', error);
    });

    // Note: We don't disconnect MCP servers here because they might be shared
    // across multiple agent instances. MCP connections are managed globally
    // by the MCPManager singleton and will be cleaned up on process exit.
  }
}
