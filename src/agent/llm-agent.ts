import { LLMClient, LLMMessage, LLMToolCall, LLMTool } from "../llm/client.js";
import type { SamplingConfig, ChatOptions, ThinkingConfig, MessageContentPart } from "../llm/types.js";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import {
  getAllGrokTools,
  getMCPManager,
  initializeMCPServers,
} from "../llm/tools.js";
import { loadMCPConfig } from "../mcp/config.js";
import { ToolResult } from "../types/index.js";
import { EventEmitter } from "events";
import { AGENT_CONFIG, CACHE_CONFIG, TIMEOUT_CONFIG } from "../constants.js";
import { getTokenCounter, TokenCounter } from "../utils/token-counter.js";
import { loadCustomInstructions } from "../utils/custom-instructions.js";
import { getSettingsManager } from "../utils/settings-manager.js";
import { ContextManager } from "./context-manager.js";
import { buildSystemPrompt } from "../utils/prompt-builder.js";
// Note: getUsageTracker is now used by StreamHandler (Phase 2 refactoring)
import { extractErrorMessage } from "../utils/error-handler.js";
import { getCheckpointManager, CheckpointManager } from "../checkpoint/index.js";
import { SubagentOrchestrator } from "./subagent-orchestrator.js";
import {
  getTaskPlanner,
  TaskPlanner,
  TaskPlan,
  PhaseResult,
  PlanResult,
  isComplexRequest,
  shouldUseThinkingMode,
  getComplexityScore,
} from "../planner/index.js";
// Note: TaskPhase now used by PlanExecutor (Phase 2 refactoring)
import { PLANNER_CONFIG } from "../constants.js";
import { resolveMCPReferences, extractMCPReferences } from "../mcp/resources.js";
import { SDKError, SDKErrorCode } from "../sdk/errors.js";
import { getStatusReporter } from "./status-reporter.js";
import { getLoopDetector, resetLoopDetector, LoopDetectionResult } from "./loop-detector.js";

// Import from extracted modules (Phase 2 refactoring)
import { ToolExecutor } from "./execution/index.js";
import { StreamHandler } from "./streaming/index.js";
import { PlanExecutor } from "./planning/index.js";
import type { StreamResult } from "./core/index.js";

// Import and re-export types from core module (maintains backward compatibility)
import type {
  ChatEntry as CoreChatEntry,
  StreamingChunk as CoreStreamingChunk,
  AccumulatedMessage as CoreAccumulatedMessage,
} from "./core/index.js";

// Re-export types for backward compatibility with existing imports
export type ChatEntry = CoreChatEntry;
export type StreamingChunk = CoreStreamingChunk;
export type AccumulatedMessage = CoreAccumulatedMessage;

/** Debug flag for loop detection logging (set DEBUG_LOOP_DETECTION=1 to enable) */
const DEBUG_LOOP = process.env.DEBUG_LOOP_DETECTION === '1';

/** Log debug message for loop detection (only when DEBUG_LOOP_DETECTION=1) */
function debugLoop(message: string): void {
  if (DEBUG_LOOP) {
    console.error(`[LOOP DETECTION] ${message}`);
  }
}

export class LLMAgent extends EventEmitter {
  private llmClient: LLMClient;
  // Tool execution delegated to ToolExecutor (Phase 2 refactoring)
  private toolExecutor: ToolExecutor;
  // Stream processing delegated to StreamHandler (Phase 2 refactoring)
  private streamHandler: StreamHandler;
  // Plan execution delegated to PlanExecutor (Phase 2 refactoring)
  private planExecutor: PlanExecutor;
  private chatHistory: ChatEntry[] = [];
  private messages: LLMMessage[] = [];
  private tokenCounter: TokenCounter;
  private contextManager: ContextManager;
  private abortController: AbortController | null = null;
  private maxToolRounds: number;
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
  /** Track if auto-thinking was enabled for current message (for UI indicator) */
  private autoThinkingEnabled: boolean = false;
  /** User's explicit thinking preference (undefined = auto, true/false = explicit) */
  private userThinkingPreference: boolean | undefined = undefined;
  /** Stored reference to context overflow listener for proper cleanup */
  private contextOverflowListener: ((data: { messageCount: number; tokenCount: number; messages: LLMMessage[] }) => void) | undefined;
  /** Track if agent has been disposed */
  private disposed = false;
  /** Tool approval system for VSCode integration */
  private requireToolApproval: boolean = false;
  private toolApprovalCallbacks: Map<string, (approved: boolean) => void> = new Map();
  /** BUG FIX: Track approval timeouts for cleanup to prevent memory leaks */
  private toolApprovalTimeouts: Map<string, NodeJS.Timeout> = new Map();
  /** BUG FIX: Track resolved state to prevent double-resolution race condition */
  private toolApprovalResolved: Map<string, boolean> = new Map();

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

    // Initialize ToolExecutor with checkpoint callback (Phase 2 refactoring)
    this.toolExecutor = new ToolExecutor({
      checkpointCallback: async (files, description) => {
        // BUG FIX: Check if agent is disposed before creating checkpoint
        if (this.disposed) return;
        // Create immutable snapshot of chat history at callback time (structuredClone is faster)
        const chatHistorySnapshot = structuredClone(this.chatHistory);
        await this.checkpointManager.createCheckpoint({
          files,
          conversationState: chatHistorySnapshot,
          description,
          metadata: {
            model: this.llmClient.getCurrentModel(),
            triggeredBy: 'auto',
          },
        });
      },
    });

    // Initialize StreamHandler with callbacks (Phase 2 refactoring)
    this.streamHandler = new StreamHandler({
      isCancelled: () => this.isCancelled(),
      yieldCancellation: () => this.yieldCancellation(),
      model: modelToUse,
    });

    this.tokenCounter = getTokenCounter(modelToUse);
    this.contextManager = new ContextManager({ model: modelToUse });
    this.checkpointManager = getCheckpointManager();
    this.subagentOrchestrator = new SubagentOrchestrator({ maxConcurrentAgents: 5 });

    // Forward subagent events for UI tracking
    this.subagentOrchestrator.on('subagent-start', (data) => {
      this.emit('subagent:start', data);
    });
    this.subagentOrchestrator.on('subagent-complete', (data) => {
      this.emit('subagent:complete', data);
    });
    this.subagentOrchestrator.on('spawn', (data) => {
      this.emit('subagent:spawn', data);
    });
    this.subagentOrchestrator.on('terminate', (data) => {
      this.emit('subagent:terminate', data);
    });

    this.taskPlanner = getTaskPlanner();

    // Initialize PlanExecutor with callbacks (Phase 2 refactoring)
    this.planExecutor = new PlanExecutor({
      llmClient: this.llmClient,
      tokenCounter: this.tokenCounter,
      toolExecutor: this.toolExecutor,
      getTools: () => getAllGrokTools(),
      executeTool: (toolCall) => this.executeTool(toolCall as LLMToolCall),
      parseToolArgumentsCached: (toolCall) => this.parseToolArgumentsCached(toolCall as LLMToolCall),
      buildChatOptions: (options) => this.buildChatOptions(options),
      applyContextPruning: () => this.applyContextPruning(),
      emitter: this,
      maxToolRounds: Math.min(this.maxToolRounds, 50),
      setPlanningEnabled: (enabled) => { this.planningEnabled = enabled; },
    });

    // Load sampling configuration from settings (supports env vars, project, and user settings)
    this.samplingConfig = manager.getSamplingSettings();

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
    // GLM 4.6 OPTIMIZATION: Merge static prompt with dynamic context in SINGLE message
    // Z.AI caches by PREFIX matching - keeping static content first maximizes cache hits
    // Dynamic content at END doesn't break cache prefix for the static portion
    // See: https://docs.z.ai/guides/capabilities/cache
    const dynamicContext = [
      '',
      '---',
      '[Session Context]',
      `Working Directory: ${process.cwd()}`,
      `Session Start: ${new Date().toISOString().split('T')[0]}`,
    ].join('\n');

    this.messages.push({
      role: "system",
      content: systemPrompt + dynamicContext,
    });

    // NEW: Listen for context pruning to generate summaries
    // CRITICAL FIX: Wrap async callback to prevent uncaught promise rejections
    // Event listeners don't handle async errors automatically, so we must catch them
    // Store listener reference for proper cleanup in dispose()
    this.contextOverflowListener = (data) => {
      // Skip if agent is disposed to prevent operations on disposed resources
      if (this.disposed) return;
      this.handleContextOverflow(data).catch((error) => {
        // BUG FIX: Check disposed again in catch handler since async operation may complete after disposal
        if (this.disposed) return;
        const errorMsg = extractErrorMessage(error);
        console.error('Error handling context overflow:', errorMsg);
        // Emit error event for monitoring - safe since we checked disposed above
        this.emit('error', error);
      });
    };
    this.contextManager.on('before_prune', this.contextOverflowListener);
  }

  /**
   * Run an async task in background with proper error handling
   * Centralizes the common pattern of background initialization
   */
  private runBackgroundTask(
    taskName: string,
    task: () => Promise<void>,
    options?: { emitSuccess?: string; warnOnError?: boolean }
  ): void {
    Promise.resolve().then(async () => {
      try {
        await task();
        if (options?.emitSuccess) {
          this.emit('system', options.emitSuccess);
        }
      } catch (error) {
        const errorMsg = extractErrorMessage(error);
        if (options?.warnOnError !== false) {
          console.warn(`${taskName} failed:`, errorMsg);
        }
        this.emit('system', `${taskName} failed: ${errorMsg}`);
      }
    }).catch((error) => {
      console.error(`Unexpected error during ${taskName}:`, error);
    });
  }

  private initializeCheckpointManager(): void {
    this.runBackgroundTask(
      'Checkpoint initialization',
      async () => {
        await this.checkpointManager.initialize();
      },
      { emitSuccess: 'Checkpoint system initialized' }
    );
  }

  private async initializeMCP(): Promise<void> {
    const config = loadMCPConfig();
    if (config.servers.length === 0) return; // Skip if no servers configured

    this.runBackgroundTask(
      'MCP initialization',
      async () => {
        await initializeMCPServers();
        // After MCP servers are initialized, update system prompt to include MCP tools
        this.updateSystemPromptWithMCPTools();
      },
      { emitSuccess: 'MCP servers initialized successfully', warnOnError: true }
    );
  }

  /**
   * Update the system prompt to include MCP tools after they're initialized
   * This ensures the LLM knows about available MCP capabilities (web search, etc.)
   */
  private updateSystemPromptWithMCPTools(): void {
    const mcpManager = getMCPManager();
    const mcpTools = mcpManager?.getTools() || [];

    if (mcpTools.length === 0) return; // No MCP tools to add

    // Find the system message
    const systemMessage = this.messages.find(m => m.role === 'system');
    if (!systemMessage || typeof systemMessage.content !== 'string') return;

    // Check if MCP tools are already in the prompt (avoid duplicate updates)
    if (systemMessage.content.includes('MCP Tools (External Capabilities)')) return;

    // Build MCP tools section
    const mcpToolsList = mcpTools
      .map(tool => {
        const friendlyName = tool.name.replace(/^mcp__[^_]+__/, '');
        const description = tool.description?.split('\n')[0] || 'External tool';
        return `- ${friendlyName}: ${description}`;
      })
      .join('\n');

    const mcpSection = [
      '\n\nMCP Tools (External Capabilities):',
      mcpToolsList,
      '\nIMPORTANT: Use MCP tools for web search, fetching URLs, and external data access. You HAVE network access through these tools.',
    ].join('\n');

    // Append MCP tools section to system prompt
    systemMessage.content += mcpSection;
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

    // Auto-switch to vision model if messages contain images
    if (!result.model && this.hasMultimodalContent()) {
      result.model = 'glm-4.5v';
    }

    return result;
  }

  /**
   * Check if current messages contain multimodal (image) content
   * Used to auto-switch to vision model
   */
  private hasMultimodalContent(): boolean {
    return this.messages.some(msg => {
      if (typeof msg.content !== 'string' && Array.isArray(msg.content)) {
        return msg.content.some(part =>
          typeof part === 'object' && 'type' in part && part.type === 'image_url'
        );
      }
      return false;
    });
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
   * @param isUserExplicit Whether this is an explicit user preference (vs auto-detection)
   */
  public setThinkingConfig(config: ThinkingConfig | undefined, isUserExplicit: boolean = true): void {
    this.thinkingConfig = config;
    // Track user's explicit preference to respect their choice over auto-detection
    if (isUserExplicit) {
      this.userThinkingPreference = config?.type === 'enabled' ? true :
                                    config?.type === 'disabled' ? false : undefined;
    }
  }

  /**
   * Get current thinking configuration
   */
  public getThinkingConfig(): ThinkingConfig | undefined {
    return this.thinkingConfig;
  }

  /**
   * Check if auto-thinking was enabled for the current message
   * Used by UI to show indicator when thinking was auto-activated
   */
  public isAutoThinkingEnabled(): boolean {
    return this.autoThinkingEnabled;
  }

  /**
   * Get current sampling configuration
   */
  public getSamplingConfig(): SamplingConfig | undefined {
    return this.samplingConfig;
  }

  /**
   * Apply auto-thinking mode detection for a user message
   * Only activates if user hasn't explicitly set a preference
   *
   * @param message User's message text
   * @returns true if thinking mode was auto-enabled, false otherwise
   */
  private applyAutoThinking(message: string): boolean {
    // Reset auto-thinking state
    this.autoThinkingEnabled = false;

    // If user has explicit preference, respect it
    if (this.userThinkingPreference !== undefined) {
      return false;
    }

    // Check if model supports thinking mode
    const model = this.llmClient.getCurrentModel();
    const modelLower = model.toLowerCase();
    const supportsThinking = modelLower.includes('glm') || modelLower.includes('4.6');

    if (!supportsThinking) {
      return false;
    }

    // Check if message would benefit from thinking mode
    if (shouldUseThinkingMode(message)) {
      const complexity = getComplexityScore(message);

      // Only auto-enable for moderately complex or higher tasks
      if (complexity >= 25) {
        this.thinkingConfig = { type: 'enabled' };
        this.autoThinkingEnabled = true;

        // Emit event for UI to show indicator
        this.emit('auto_thinking_enabled', {
          complexity,
          message: message.substring(0, 100)
        });

        return true;
      }
    }

    return false;
  }

  /**
   * Enable or disable tool approval requirement
   * When enabled, text_editor operations will emit 'tool:approval_required' events
   * and wait for approval before executing
   *
   * This is used by VSCode extension to show diff previews
   *
   * @param enabled - Whether to require approval for text_editor operations
   */
  public setRequireToolApproval(enabled: boolean): void {
    this.requireToolApproval = enabled;
  }

  /**
   * Approve or reject a pending tool call
   * Called by external integrations (e.g., VSCode extension) in response to
   * 'tool:approval_required' events
   *
   * @param toolCallId - The ID of the tool call to approve/reject
   * @param approved - true to execute the tool, false to reject it
   */
  public approveToolCall(toolCallId: string, approved: boolean): void {
    // BUG FIX: Check if already resolved to prevent race condition with timeout
    if (this.toolApprovalResolved.get(toolCallId)) {
      return;  // Already resolved by timeout or previous call
    }

    const callback = this.toolApprovalCallbacks.get(toolCallId);
    if (callback) {
      // BUG FIX: Mark as resolved BEFORE calling callback to prevent races
      this.toolApprovalResolved.set(toolCallId, true);

      // BUG FIX: Clear the timeout when approval is received (prevents memory leak)
      const timeout = this.toolApprovalTimeouts.get(toolCallId);
      if (timeout) {
        clearTimeout(timeout);
        this.toolApprovalTimeouts.delete(toolCallId);
      }

      callback(approved);
      this.toolApprovalCallbacks.delete(toolCallId);

      // Clean up resolved tracking after a short delay
      setTimeout(() => this.toolApprovalResolved.delete(toolCallId), 1000);
    }
  }

  /**
   * Wait for external approval of a tool call
   * Emits 'tool:approval_required' event and waits for approveToolCall() to be called
   *
   * @param toolCall - The tool call awaiting approval
   * @returns Promise<boolean> - true if approved, false if rejected or timeout
   */
  private waitForToolApproval(toolCall: LLMToolCall): Promise<boolean> {
    // If agent is already disposed, immediately reject approval wait to avoid dangling promises
    if (this.disposed) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      // Emit event so external integrations can show diff preview
      this.emit('tool:approval_required', toolCall);

      // Store callback
      this.toolApprovalCallbacks.set(toolCall.id, resolve);
      // BUG FIX: Initialize resolved state
      this.toolApprovalResolved.set(toolCall.id, false);

      // BUG FIX: Track the timeout so it can be cleared on approval/disposal
      // This prevents memory leaks from dangling timers
      const timeoutId = setTimeout(() => {
        // BUG FIX: Check resolved state to prevent race condition with approveToolCall
        if (this.toolApprovalResolved.get(toolCall.id)) {
          return;  // Already resolved by approveToolCall
        }

        // Mark as resolved BEFORE resolving to prevent races
        this.toolApprovalResolved.set(toolCall.id, true);

        // Clean up both the callback and timeout tracking
        this.toolApprovalTimeouts.delete(toolCall.id);
        this.toolApprovalCallbacks.delete(toolCall.id);
        resolve(false); // Auto-reject on timeout

        // Clean up resolved tracking after a short delay
        setTimeout(() => this.toolApprovalResolved.delete(toolCall.id), 1000);
      }, TIMEOUT_CONFIG.TOOL_APPROVAL);

      // Track the timeout for cleanup
      this.toolApprovalTimeouts.set(toolCall.id, timeoutId);
    });
  }

  /**
   * Handle context overflow by generating a summary
   * Called when context manager is about to prune messages
   */
  private async handleContextOverflow(data: { messageCount: number; tokenCount: number; messages: ChatCompletionMessageParam[] }): Promise<void> {
    try {
      const reporter = getStatusReporter();
      const summary = await reporter.generateContextSummary(
        data.messages,
        this.chatHistory,
        'context_overflow',
        data.tokenCount
      );

      // Log for debugging
      if (process.env.DEBUG) {
        console.log(`[Context Overflow] Summary generated: ${summary.path}`);
      }

      // Add a chat entry to inform user (non-blocking)
      const summaryEntry: ChatEntry = {
        type: 'assistant',
        content: `⚠️ Context window approaching limit (${data.tokenCount.toLocaleString()} tokens). Summary saved to:\n\`${summary.path}\``,
        timestamp: new Date(),
      };
      this.chatHistory.push(summaryEntry);

      // Emit event for UI/logging
      this.emit('context:summary', summary);
    } catch (error) {
      // Summary generation failure should not block execution
      const errorMsg = extractErrorMessage(error);
      console.warn('Failed to generate context summary:', errorMsg);
    }
  }

  /**
   * Apply context pruning to both messages and chatHistory
   * BUGFIX: Prevents chatHistory from growing unbounded
   */
  private applyContextPruning(): void {
    // Prune LLM messages if needed
    if (this.contextManager.shouldPrune(this.messages, this.tokenCounter)) {
      this.messages = this.contextManager.pruneMessages(this.messages, this.tokenCounter);
    }

    // CRITICAL FIX: Always check and prune chatHistory to prevent unbounded growth
    // This must happen UNCONDITIONALLY, even if context pruning is disabled
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

    // CRITICAL FIX: Add hard limit for messages array as safety backstop
    // In case contextManager.shouldPrune() always returns false
    if (this.messages.length > AGENT_CONFIG.MAX_MESSAGES) {
      // Keep system message (if exists) + last N messages
      const systemMessages = this.messages.filter(m => m.role === 'system');
      const nonSystemMessages = this.messages.filter(m => m.role !== 'system');
      const keepMessages = Math.min(nonSystemMessages.length, AGENT_CONFIG.MAX_MESSAGES - systemMessages.length);
      this.messages = [
        ...systemMessages,
        ...nonSystemMessages.slice(-keepMessages)
      ];
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

      // CRITICAL FIX: Prevent unbounded memory growth with proper cache eviction
      // When cache exceeds limit, reduce to 80% capacity (not just remove fixed entries)
      if (this.toolCallArgsCache.size > CACHE_CONFIG.TOOL_ARGS_CACHE_MAX_SIZE) {
        const targetSize = Math.floor(CACHE_CONFIG.TOOL_ARGS_CACHE_MAX_SIZE * 0.8);
        const toRemove = this.toolCallArgsCache.size - targetSize;

        // BUG FIX: Don't modify Map while iterating - create array of keys first
        const keysToDelete = Array.from(this.toolCallArgsCache.keys()).slice(0, toRemove);
        for (const key of keysToDelete) {
          this.toolCallArgsCache.delete(key);
        }
      }

      return args;
    } catch {
      // Return empty object on parse error (don't cache failures)
      return {};
    }
  }

  /**
   * Detect if a tool call is repetitive (likely causing a loop)
   * Uses the intelligent LoopDetector which provides:
   * - Tool-specific thresholds (file ops get higher limits)
   * - Progress-based detection (tracks success/failure)
   * - Cycle pattern detection (A→B→A→B loops)
   */
  private isRepetitiveToolCall(toolCall: LLMToolCall): boolean {
    // Check if loop detection is disabled globally
    if (!AGENT_CONFIG.ENABLE_LOOP_DETECTION) {
      return false;
    }

    // Use the new intelligent loop detector
    const detector = getLoopDetector();
    const result = detector.checkForLoop(toolCall);

    // Debug logging
    debugLoop(`Tool: ${toolCall.function.name}`);
    debugLoop(`Count: ${result.count}, Threshold: ${result.threshold}, Is Loop: ${result.isLoop}`);
    if (result.reason) debugLoop(`Reason: ${result.reason}`);
    if (DEBUG_LOOP) debugLoop(`Stats: ${JSON.stringify(detector.getStats())}`);

    if (result.isLoop) {
      // Store the result for generating better error message
      this.lastLoopResult = result;
      debugLoop(`⚠️ LOOP DETECTED! Reason: ${result.reason}, Suggestion: ${result.suggestion}`);
      return true;
    }

    // Note: We don't record here - recording happens AFTER execution
    // in executeToolCalls() with the actual success/failure status
    debugLoop(`✅ Allowed, count: ${result.count}/${result.threshold}`);

    return false;
  }

  /** Last loop detection result for error messages */
  private lastLoopResult?: LoopDetectionResult;

  /**
   * Reset the tool call tracking (called at start of new user message)
   */
  private resetToolCallTracking(): void {
    if (DEBUG_LOOP) {
      const stats = getLoopDetector().getStats();
      debugLoop(`🔄 Resetting tool call tracking (had ${stats.uniqueSignatures} signatures)`);
    }
    // Reset the intelligent loop detector
    resetLoopDetector();
    // Clear the args cache to prevent memory leak
    this.toolCallArgsCache.clear();
    // Clear last loop result
    this.lastLoopResult = undefined;
  }

  /**
   * Generate a helpful warning message when a loop is detected
   * Uses the lastLoopResult for context-aware suggestions
   *
   * Note: Messages are designed to be professional and actionable,
   * avoiding alarming language like "infinite loop" which can confuse users.
   */
  private getLoopWarningMessage(): string {
    const base = "\n\nI noticed I'm repeating similar operations without making progress.";

    if (this.lastLoopResult) {
      const parts = [base];

      if (this.lastLoopResult.suggestion) {
        parts.push(` ${this.lastLoopResult.suggestion}`);
      }

      parts.push("\n\nLet me try a different approach or provide what I've accomplished so far.");

      return parts.join('');
    }

    return base + " Let me step back and try a different approach.";
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
          await this.toolExecutor.getTodoTool().createTodoList(todoItems);
        } catch (todoError) {
          // TodoWrite failure is non-critical, continue execution
          console.warn("TodoWrite create failed:", extractErrorMessage(todoError));
        }
      } else {
        // Display explicit plan summary
        yield {
          type: "content",
          content: this.planExecutor.formatPlanSummary(plan),
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
            await this.toolExecutor.getTodoTool().updateTodoList([{
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

        // Execute the phase (delegated to PlanExecutor - Phase 2 refactoring)
        const context = {
          planId: plan.id,
          originalRequest: message,
          completedPhases: phaseResults.filter(r => r.success).map(r => r.phaseId),
        };

        const { result, messages: updatedMessages } = await this.planExecutor.executePhase(
          phase,
          context,
          this.messages,
          this.chatHistory
        );
        this.messages = updatedMessages; // Update messages with phase execution results
        phaseResults.push(result);
        totalTokensUsed += result.tokensUsed;

        // Report phase result
        if (result.success) {
          if (PLANNER_CONFIG.SILENT_MODE) {
            // Update TodoWrite: mark phase as completed
            try {
              await this.toolExecutor.getTodoTool().updateTodoList([{
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
              await this.toolExecutor.getTodoTool().updateTodoList([{
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
          content: this.planExecutor.formatPlanResult(planResult),
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

      // Generate status report on plan completion
      try {
        const reporter = getStatusReporter();
        const tokenCount = this.tokenCounter.countMessageTokens(this.messages);
        const statusReport = await reporter.generateStatusReport({
          messages: this.messages,
          chatHistory: this.chatHistory,
          tokenCount,
          plan,
        });

        // Notify user of status report
        yield {
          type: "content",
          content: `\n📊 Status report saved to: \`${statusReport.path}\`\n`,
        };

        // Emit event for UI/logging
        this.emit("plan:report", statusReport);
      } catch (error) {
        // Status report generation failure should not block execution
        const errorMsg = extractErrorMessage(error);
        console.warn("Failed to generate status report:", errorMsg);
      }

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

        // Process streaming chunks (delegated to StreamHandler - Phase 2 refactoring)
        const chunkGen = this.streamHandler.processChunks(stream, {
          inputTokens: inputTokensRef.value,
          lastTokenUpdate: lastTokenUpdateRef,
          totalOutputTokens: totalOutputTokensRef,
        });

        let streamResult: StreamResult | undefined;
        for await (const chunk of chunkGen) {
          if ('accumulated' in chunk) {
            streamResult = chunk as StreamResult;
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
        if (streamResult.accumulated.tool_calls && streamResult.accumulated.tool_calls.length > 0) {
          toolRounds++;

          // Check for repetitive tool calls (loop detection)
          const hasRepetitiveCall = (streamResult.accumulated.tool_calls as LLMToolCall[]).some(
            (tc: LLMToolCall) => this.isRepetitiveToolCall(tc)
          );

          if (hasRepetitiveCall) {
            const loopMsg = this.getLoopWarningMessage();
            yield {
              type: "content",
              content: loopMsg,
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

  async processUserMessage(message: string): Promise<ChatEntry[]> {
    // Check if agent has been disposed
    this.checkDisposed();

    // GLM-4.6 OPTIMIZATION: Auto-enable thinking mode for complex tasks
    this.applyAutoThinking(message);

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
          debugLoop(`Checking ${assistantMessage.tool_calls.length} tool calls...`);

          const hasRepetitiveCall = assistantMessage.tool_calls.some(
            (tc: LLMToolCall) => this.isRepetitiveToolCall(tc)
          );

          debugLoop(`hasRepetitiveCall: ${hasRepetitiveCall}`);

          if (hasRepetitiveCall) {
            debugLoop(`🛑 Breaking loop!`);
            const loopMsg = this.getLoopWarningMessage();
            const warningEntry: ChatEntry = {
              type: "assistant",
              content: loopMsg,
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

            // Validate entryIndex is still valid after potential context pruning
            // The index could become stale if chatHistory was modified between store and access
            if (entryIndex !== undefined &&
                entryIndex < this.chatHistory.length &&
                this.chatHistory[entryIndex]?.toolCall?.id === toolCall.id) {
              const updatedEntry: ChatEntry = {
                ...this.chatHistory[entryIndex],
                type: "tool_result",
                content: this.formatToolResultContent(result),
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
              content: this.formatToolResultContent(result, "Success", "Error"),
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
            "Maximum tool execution rounds reached. Let me provide what I've accomplished.",
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
   * Prepare user message and apply context management
   * Returns the calculated input tokens
   *
   * Supports both text-only and multimodal (with images) messages.
   */
  private prepareUserMessageForStreaming(
    message: string | MessageContentPart[]
  ): number {
    // Determine display content for chat history
    const displayContent = typeof message === 'string'
      ? message
      : this.extractDisplayContent(message);

    // Add user message to conversation (display format)
    const userEntry: ChatEntry = {
      type: "user",
      content: displayContent,
      timestamp: new Date(),
    };
    this.chatHistory.push(userEntry);

    // Add to LLM messages (full format including images)
    this.messages.push({ role: "user", content: message });

    // Apply context management before sending to API
    this.applyContextPruning();

    // Calculate input tokens
    return this.tokenCounter.countMessageTokens(this.messages);
  }

  /**
   * Extract display text from multimodal message content
   * Used for chat history display (excludes binary image data)
   */
  private extractDisplayContent(content: MessageContentPart[]): string {
    const parts: string[] = [];

    for (const part of content) {
      if (part.type === 'text') {
        parts.push(part.text);
      } else if (part.type === 'image_url') {
        parts.push('[Image attached]');
      }
    }

    return parts.join('\n');
  }

  /**
   * Extract text content from message for analysis purposes
   * Used by planning and complexity detection
   */
  private getTextContentFromMessage(message: string | MessageContentPart[]): string {
    if (typeof message === 'string') {
      return message;
    }

    // Extract only text parts from multimodal content
    return message
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map(part => part.text)
      .join('\n');
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
   * Format tool result content for display or message
   * Centralizes the common pattern of formatting success/error output
   *
   * @param result - Tool execution result
   * @param defaultSuccess - Default message if success but no output (default: "Success")
   * @param defaultError - Default message if error but no error message (default: "Error occurred")
   * @returns Formatted content string
   */
  private formatToolResultContent(
    result: ToolResult,
    defaultSuccess = "Success",
    defaultError = "Error occurred"
  ): string {
    return result.success
      ? result.output || defaultSuccess
      : result.error || defaultError;
  }

  /**
   * Add assistant message to history and conversation
   */
  private addAssistantMessage(accumulatedMessage: AccumulatedMessage): void {
    // Safely extract tool_calls with proper validation
    const toolCalls = Array.isArray(accumulatedMessage.tool_calls)
      ? accumulatedMessage.tool_calls
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

      // Record tool call with actual success/failure status for intelligent loop detection
      // This enables failure-based threshold adjustment (repeated failures = lower threshold)
      const detector = getLoopDetector();
      detector.recordToolCall(toolCall, result.success);

      debugLoop(`📝 Recorded: ${toolCall.function.name}, success=${result.success}`);

      const toolResultEntry: ChatEntry = {
        type: "tool_result",
        content: this.formatToolResultContent(result),
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
        content: this.formatToolResultContent(result, "Success", "Error"),
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
    message: string | MessageContentPart[]
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    // Create new abort controller for this request
    this.abortController = new AbortController();

    // Extract text content for analysis (planning, complexity detection)
    const textContent = this.getTextContentFromMessage(message);

    // GLM-4.6 OPTIMIZATION: Auto-enable thinking mode for complex tasks
    // This detects requests that would benefit from extended reasoning
    const autoThinkingApplied = this.applyAutoThinking(textContent);
    if (autoThinkingApplied) {
      // Notify UI that thinking mode was auto-enabled
      yield {
        type: "content",
        content: "🧠 *Auto-thinking enabled for complex task*\n\n"
      };
    }

    // Check if this is a complex request that should use multi-phase planning
    // Note: Planning currently only works with text-only messages
    if (typeof message === 'string' && this.shouldCreatePlan(textContent)) {
      // Delegate to planning processor
      yield* this.processWithPlanning(textContent);
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
        debugLoop(`Agent loop iteration, toolRounds: ${toolRounds}`);

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

        // Process streaming chunks (delegated to StreamHandler - Phase 2 refactoring)
        const chunkGen = this.streamHandler.processChunks(stream, {
          inputTokens: inputTokensRef.value,
          lastTokenUpdate: lastTokenUpdateRef,
          totalOutputTokens: totalOutputTokensRef,
        });

        let streamResult: StreamResult | undefined;
        for await (const chunk of chunkGen) {
          if ('accumulated' in chunk) {
            streamResult = chunk as StreamResult;
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
        if (streamResult.accumulated.tool_calls && streamResult.accumulated.tool_calls.length > 0) {
          toolRounds++;

          // Check for repetitive tool calls (loop detection)
          const hasRepetitiveCall = (streamResult.accumulated.tool_calls as LLMToolCall[]).some(
            (tc: LLMToolCall) => this.isRepetitiveToolCall(tc)
          );

          if (hasRepetitiveCall) {
            const loopMsg = this.getLoopWarningMessage();
            yield {
              type: "content",
              content: loopMsg,
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
          content: "\n\nMaximum tool execution rounds reached. Let me provide what I've accomplished.",
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
   * Execute a tool call using the ToolExecutor
   * Handles tool approval for VSCode integration before delegation
   */
  private async executeTool(toolCall: LLMToolCall): Promise<ToolResult> {
    // Check if tool approval is required (for VSCode integration)
    if (this.requireToolApproval) {
      // Only require approval for file modification operations
      const needsApproval = toolCall.function.name === "create_file" ||
                           toolCall.function.name === "str_replace_editor" ||
                           toolCall.function.name === "insert_text";

      if (needsApproval) {
        // Emit event and wait for approval
        const approved = await this.waitForToolApproval(toolCall);

        if (!approved) {
          // User rejected the change
          this.emit('tool:rejected', toolCall);
          return {
            success: false,
            error: 'Change rejected by user'
          };
        }

        // User approved
        this.emit('tool:approved', toolCall);
      }
    }

    // Delegate to ToolExecutor (Phase 2 refactoring)
    return await this.toolExecutor.execute(toolCall);
  }

  getChatHistory(): ChatEntry[] {
    this.checkDisposed();
    return [...this.chatHistory];
  }

  getCurrentDirectory(): string {
    return this.toolExecutor.getBashTool().getCurrentDirectory();
  }

  async executeBashCommand(command: string): Promise<ToolResult> {
    return await this.toolExecutor.getBashTool().execute(command);
  }

  /**
   * Check if a bash command is currently executing
   */
  isBashExecuting(): boolean {
    return this.toolExecutor.getBashTool().isExecuting();
  }

  /**
   * Move currently running bash command to background
   * Returns task ID if successful, null otherwise
   */
  moveBashToBackground(): string | null {
    return this.toolExecutor.getBashTool().moveToBackground();
  }

  getCurrentModel(): string {
    return this.llmClient.getCurrentModel();
  }

  setModel(model: string): void {
    this.llmClient.setModel(model);
    // Update token counter for new model (use singleton)
    this.tokenCounter = getTokenCounter(model);
    // Update stream handler model for usage tracking
    this.streamHandler.setModel(model);
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

      // CRITICAL FIX: Track tool calls to validate tool results
      // Prevents API errors from orphaned tool results without corresponding tool calls
      const toolCallIds = new Set<string>();

      for (const entry of conversationState) {
        if (entry.type === 'user') {
          this.messages.push({
            role: 'user',
            content: entry.content,
          });
        } else if (entry.type === 'assistant') {
          // Track tool call IDs from assistant messages
          if (entry.toolCalls && Array.isArray(entry.toolCalls)) {
            for (const toolCall of entry.toolCalls) {
              if (toolCall?.id) {
                toolCallIds.add(toolCall.id);
              }
            }
          }

          this.messages.push({
            role: 'assistant',
            content: entry.content,
            tool_calls: entry.toolCalls,
          } as LLMMessage);
        } else if (entry.type === 'tool_result' && entry.toolCall) {
          // CRITICAL FIX: Only add tool result if corresponding tool call exists
          // This prevents "tool message without corresponding tool call" API errors
          if (toolCallIds.has(entry.toolCall.id)) {
            this.messages.push({
              role: 'tool',
              content: entry.content,
              tool_call_id: entry.toolCall.id,
            });
          } else {
            console.warn(`Skipping orphaned tool result for tool_call_id: ${entry.toolCall.id}`);
          }
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
      // Import parseSubagentRole helper to convert string to enum
      const { parseSubagentRole } = await import('./subagent-types.js');

      const subagentRole = parseSubagentRole(role);

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
      // Import parseSubagentRole helper to convert string to enum
      const { parseSubagentRole } = await import('./subagent-types.js');

      // Convert tasks to SubagentTask format
      const subagentTasks = tasks.map((task, index) => ({
        id: task.id || `task-${index}-${Date.now()}`,
        description: task.description,
        role: parseSubagentRole(task.role),
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

    // CRITICAL FIX: Remove event listener from contextManager to prevent memory leak
    // Only remove the specific listener we registered, not all listeners for this event
    if (this.contextOverflowListener) {
      this.contextManager.removeListener('before_prune', this.contextOverflowListener);
      this.contextOverflowListener = undefined;
    }

    // Dispose tool executor (includes all tools with cleanup methods)
    this.toolExecutor.dispose();

    // Clear in-memory caches
    this.toolCallIndexMap.clear();
    this.toolCallArgsCache.clear();

    // BUG FIX: Clear all pending tool approval timeouts to prevent memory leaks
    // These timers would otherwise keep running for up to 5 minutes after dispose
    for (const timeout of this.toolApprovalTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.toolApprovalTimeouts.clear();

    // Resolve any pending approval callbacks so awaiting promises don't hang forever
    for (const [, callback] of this.toolApprovalCallbacks) {
      try {
        callback(false);
      } catch {
        // Ignore callback errors during teardown
      }
    }
    this.toolApprovalCallbacks.clear();

    // Clear conversation history to free memory
    this.chatHistory = [];
    this.messages = [];

    // Dispose context manager (tokenCounter is a singleton, don't dispose)
    // CRITICAL FIX: tokenCounter is obtained via getTokenCounter() which returns
    // a shared singleton instance. Disposing it would break other agent instances
    // using the same model. The singleton manages its own lifecycle.
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
