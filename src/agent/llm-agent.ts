import { LLMClient, LLMMessage, LLMToolCall, LLMTool } from "../llm/client.js";
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
import { ToolResult } from "../types/index.js";
import { EventEmitter } from "events";
import { AGENT_CONFIG } from "../constants.js";
import { createTokenCounter, TokenCounter } from "../utils/token-counter.js";
import { loadCustomInstructions } from "../utils/custom-instructions.js";
import { getSettingsManager } from "../utils/settings-manager.js";
import { ContextManager } from "./context-manager.js";
import { buildSystemPrompt } from "../utils/prompt-builder.js";
import { getUsageTracker } from "../utils/usage-tracker.js";
import { extractErrorMessage } from "../utils/error-handler.js";

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
}

export class LLMAgent extends EventEmitter {
  private llmClient: LLMClient;
  private textEditor: TextEditorTool;
  private bash: BashTool;
  private todoTool: TodoTool;
  private search: SearchTool;
  private chatHistory: ChatEntry[] = [];
  private messages: LLMMessage[] = [];
  private tokenCounter: TokenCounter;
  private contextManager: ContextManager;
  private abortController: AbortController | null = null;
  private maxToolRounds: number;
  private recentToolCalls: Map<string, number> = new Map(); // Track recent tool calls to detect loops

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
    this.todoTool = new TodoTool();
    this.search = new SearchTool();
    this.tokenCounter = createTokenCounter(modelToUse);
    this.contextManager = new ContextManager({ model: modelToUse });

    // Initialize MCP servers if configured
    this.initializeMCP();

    // Build system prompt from YAML configuration
    const customInstructions = loadCustomInstructions();
    const systemPrompt = buildSystemPrompt({
      customInstructions: customInstructions || undefined,
    });

    // Initialize with system message
    this.messages.push({
      role: "system",
      content: `${systemPrompt}\n\nCurrent working directory: ${process.cwd()}`,
    });
  }

  private async initializeMCP(): Promise<void> {
    // Initialize MCP in the background without blocking
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
    }).catch((error) => {
      // Catch any unhandled promise rejections
      const errorMsg = extractErrorMessage(error);
      console.warn("Unexpected error during MCP initialization:", errorMsg);
      this.emit('system', `Unexpected MCP error: ${errorMsg}`);
    });
  }

  private isGrokModel(): boolean {
    const currentModel = this.llmClient.getCurrentModel();
    return currentModel.toLowerCase().includes("grok");
  }

  /**
   * Detect if a tool call is repetitive (likely causing a loop)
   * Returns true if the same tool with similar arguments was called multiple times recently
   */
  private isRepetitiveToolCall(toolCall: LLMToolCall): boolean {
    try {
      const args = JSON.parse(toolCall.function.arguments || '{}');

      // Create a detailed signature that includes key arguments
      // This allows multiple different commands but catches true repetitions
      let signature = toolCall.function.name;

      if (toolCall.function.name === 'bash' && args.command) {
        // Normalize command: trim whitespace, collapse multiple spaces
        const normalizedCommand = args.command.trim().replace(/\s+/g, ' ');
        // Use full command for exact matching (catches true duplicates)
        signature = `bash:${normalizedCommand}`;
      } else if (toolCall.function.name === 'read_file' && args.file_path) {
        // For file reads, include the path
        signature = `read:${args.file_path}`;
      } else if (toolCall.function.name === 'write_file' && args.file_path) {
        // For file writes, include the path
        signature = `write:${args.file_path}`;
      } else if (toolCall.function.name === 'text_editor' && args.path) {
        // For text editor, include the path
        signature = `edit:${args.path}`;
      }

      // Track by detailed signature
      const count = this.recentToolCalls.get(signature) || 0;

      // Debug logging (remove after fixing)
      if (process.env.DEBUG_LOOP_DETECTION === '1') {
        console.error(`[LOOP DETECTION] Tool: ${toolCall.function.name}`);
        console.error(`[LOOP DETECTION] Signature: ${signature}`);
        console.error(`[LOOP DETECTION] Count: ${count}`);
        console.error(`[LOOP DETECTION] Map size: ${this.recentToolCalls.size}`);
      }

      // If we've seen this EXACT tool call even once before, it's definitely looping
      // This catches exact duplicates (same command, same file, etc.) on 2nd occurrence
      if (count >= 1) {
        if (process.env.DEBUG_LOOP_DETECTION === '1') {
          console.error(`[LOOP DETECTION] ⚠️ LOOP DETECTED! Signature: ${signature}`);
        }
        return true;
      }

      // Increment the count
      this.recentToolCalls.set(signature, count + 1);

      if (process.env.DEBUG_LOOP_DETECTION === '1') {
        console.error(`[LOOP DETECTION] ✅ Allowed, count now: ${count + 1}`);
      }

      // Clean up old entries (keep only last N unique calls)
      if (this.recentToolCalls.size > AGENT_CONFIG.MAX_RECENT_TOOL_CALLS) {
        const firstKey = this.recentToolCalls.keys().next().value;
        // Map.keys().next().value is guaranteed to exist when size > 0, but TypeScript doesn't know this
        if (firstKey) {
          this.recentToolCalls.delete(firstKey);
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
    this.recentToolCalls.clear();
  }

  // Heuristic: enable web search only when likely needed
  private shouldUseSearchFor(message: string): boolean {
    const q = message.toLowerCase();
    const keywords = [
      "today",
      "latest",
      "news",
      "trending",
      "breaking",
      "current",
      "now",
      "recent",
      "x.com",
      "twitter",
      "tweet",
      "what happened",
      "as of",
      "update on",
      "release notes",
      "changelog",
      "price",
    ];
    if (keywords.some((k) => q.includes(k))) return true;
    // crude date pattern (e.g., 2024/2025) may imply recency
    if (/(20\d{2})/.test(q)) return true;
    return false;
  }

  async processUserMessage(message: string): Promise<ChatEntry[]> {
    // Reset tool call tracking for new message
    this.resetToolCallTracking();

    // Add user message to conversation
    const userEntry: ChatEntry = {
      type: "user",
      content: message,
      timestamp: new Date(),
    };
    this.chatHistory.push(userEntry);
    this.messages.push({ role: "user", content: message });

    const newEntries: ChatEntry[] = [userEntry];
    const maxToolRounds = this.maxToolRounds; // Prevent infinite loops
    let toolRounds = 0;

    try {
      const tools = await getAllGrokTools();
      let currentResponse = await this.llmClient.chat(
        this.messages,
        tools,
        {
          searchOptions: this.isGrokModel() && this.shouldUseSearchFor(message)
            ? { search_parameters: { mode: "auto" } }
            : { search_parameters: { mode: "off" } }
        }
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
          } as any);

          // Create initial tool call entries to show tools are being executed
          assistantMessage.tool_calls.forEach((toolCall) => {
            const toolCallEntry: ChatEntry = {
              type: "tool_call",
              content: "Executing...",
              timestamp: new Date(),
              toolCall: toolCall,
            };
            this.chatHistory.push(toolCallEntry);
            newEntries.push(toolCallEntry);
          });

          // Execute tool calls and update the entries
          for (const toolCall of assistantMessage.tool_calls) {
            const result = await this.executeTool(toolCall);

            // Update the existing tool_call entry with the result
            const entryIndex = this.chatHistory.findIndex(
              (entry) =>
                entry.type === "tool_call" && entry.toolCall?.id === toolCall.id
            );

            if (entryIndex !== -1) {
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

          // Get next response - this might contain more tool calls
          currentResponse = await this.llmClient.chat(
            this.messages,
            tools,
            {
              searchOptions: this.isGrokModel() && this.shouldUseSearchFor(message)
                ? { search_parameters: { mode: "auto" } }
                : { search_parameters: { mode: "off" } }
            }
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
    } catch (error: any) {
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
   * Recursively merge streaming delta into accumulated message
   */
  private reduceStreamDelta(acc: any, delta: any): any {
    acc = { ...acc };
    for (const [key, value] of Object.entries(delta)) {
      if (acc[key] === undefined || acc[key] === null) {
        acc[key] = value;
        // Clean up index properties from tool calls
        if (Array.isArray(acc[key])) {
          for (const arr of acc[key]) {
            delete arr.index;
          }
        }
      } else if (typeof acc[key] === "string" && typeof value === "string") {
        (acc[key] as string) += value;
      } else if (Array.isArray(acc[key]) && Array.isArray(value)) {
        const accArray = acc[key] as any[];
        for (let i = 0; i < value.length; i++) {
          // Validate that value[i] exists before processing
          if (value[i] === undefined || value[i] === null) continue;
          if (!accArray[i]) accArray[i] = {};
          accArray[i] = this.reduceStreamDelta(accArray[i], value[i]);
        }
      } else if (typeof acc[key] === "object" && typeof value === "object") {
        acc[key] = this.reduceStreamDelta(acc[key], value);
      }
    }
    return acc;
  }

  /**
   * Accumulate streaming message chunks
   */
  private messageReducer(previous: any, item: any): any {
    // Safety check: ensure item has valid structure
    if (!item?.choices || item.choices.length === 0 || !item.choices[0]?.delta) {
      return previous;
    }
    return this.reduceStreamDelta(previous, item.choices[0].delta);
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
    if (this.contextManager.shouldPrune(this.messages, this.tokenCounter)) {
      this.messages = this.contextManager.pruneMessages(this.messages, this.tokenCounter);
    }

    // Calculate input tokens
    return this.tokenCounter.countMessageTokens(this.messages as any);
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
    } catch (error: any) {
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
    stream: AsyncIterable<any>,
    inputTokens: number,
    lastTokenUpdate: { value: number },
    totalOutputTokens: { value: number }
  ): AsyncGenerator<StreamingChunk | { accumulated: any; content: string; yielded: boolean }, { accumulated: any; content: string; yielded: boolean }, unknown> {
    let accumulatedMessage: any = {};
    let accumulatedContent = "";
    let toolCallsYielded = false;
    let usageData: any = null;

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
      if (!toolCallsYielded && accumulatedMessage.tool_calls?.length > 0) {
        const hasCompleteTool = accumulatedMessage.tool_calls.some(
          (tc: any) => tc.function?.name
        );
        if (hasCompleteTool) {
          yield {
            type: "tool_calls",
            toolCalls: accumulatedMessage.tool_calls,
          };
          toolCallsYielded = true;
        }
      }

      // Stream reasoning content (GLM-4.6 thinking mode)
      if (chunk.choices[0].delta?.reasoning_content) {
        yield {
          type: "reasoning",
          reasoningContent: chunk.choices[0].delta.reasoning_content,
        };
      }

      // Stream content as it comes
      if (chunk.choices[0].delta?.content) {
        accumulatedContent += chunk.choices[0].delta.content;

        // Update token count in real-time
        const currentOutputTokens =
          this.tokenCounter.estimateStreamingTokens(accumulatedContent) +
          (accumulatedMessage.tool_calls
            ? this.tokenCounter.countTokens(JSON.stringify(accumulatedMessage.tool_calls))
            : 0);
        totalOutputTokens.value = currentOutputTokens;

        yield {
          type: "content",
          content: chunk.choices[0].delta.content,
        };

        // Emit token count update (throttled to 250ms)
        const now = Date.now();
        if (now - lastTokenUpdate.value > 250) {
          lastTokenUpdate.value = now;
          yield {
            type: "token_count",
            tokenCount: inputTokens + totalOutputTokens.value,
          };
        }
      }
    }

    // Track usage if available
    if (usageData) {
      const tracker = getUsageTracker();
      tracker.trackUsage(this.llmClient.getCurrentModel(), usageData);
    }

    return { accumulated: accumulatedMessage, content: accumulatedContent, yielded: toolCallsYielded };
  }

  /**
   * Add assistant message to history and conversation
   */
  private addAssistantMessage(accumulatedMessage: any): void {
    const assistantEntry: ChatEntry = {
      type: "assistant",
      content: accumulatedMessage.content || "Using tools to help you...",
      timestamp: new Date(),
      toolCalls: accumulatedMessage.tool_calls || undefined,
    };
    this.chatHistory.push(assistantEntry);

    this.messages.push({
      role: "assistant",
      content: accumulatedMessage.content || "",
      tool_calls: accumulatedMessage.tool_calls,
    } as any);
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

      const result = await this.executeTool(toolCall);

      const toolResultEntry: ChatEntry = {
        type: "tool_result",
        content: result.success
          ? result.output || "Success"
          : result.error || "Error occurred",
        timestamp: new Date(),
        toolCall: toolCall,
        toolResult: result,
      };
      this.chatHistory.push(toolResultEntry);

      yield {
        type: "tool_result",
        toolCall,
        toolResult: result,
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

    // Update token count after processing all tool calls
    inputTokens.value = this.tokenCounter.countMessageTokens(this.messages as any);
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
          {
            searchOptions: this.isGrokModel() && this.shouldUseSearchFor(message)
              ? { search_parameters: { mode: "auto" } }
              : { search_parameters: { mode: "off" } }
          }
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

        if (!streamResult) continue;

        // Add assistant message to history
        this.addAssistantMessage(streamResult.accumulated);

        // Handle tool calls if present
        if (streamResult.accumulated.tool_calls?.length > 0) {
          toolRounds++;

          // Check for repetitive tool calls (loop detection)
          if (process.env.DEBUG_LOOP_DETECTION === '1') {
            console.error(`\n[LOOP CHECK STREAM] Checking ${streamResult.accumulated.tool_calls.length} tool calls...`);
          }

          const hasRepetitiveCall = streamResult.accumulated.tool_calls.some(
            (tc: LLMToolCall) => this.isRepetitiveToolCall(tc)
          );

          if (process.env.DEBUG_LOOP_DETECTION === '1') {
            console.error(`[LOOP CHECK STREAM] hasRepetitiveCall: ${hasRepetitiveCall}\n`);
          }

          if (hasRepetitiveCall) {
            if (process.env.DEBUG_LOOP_DETECTION === '1') {
              console.error(`[LOOP CHECK STREAM] 🛑 Breaking loop!`);
            }
            yield {
              type: "content",
              content: "\n\n⚠️ Detected repetitive tool calls. Stopping to prevent infinite loop.\n\nI apologize, but I seem to be stuck in a loop trying to answer your question. Let me provide what I can without further tool use.",
            };
            break;
          }

          yield* this.executeToolCalls(
            streamResult.accumulated.tool_calls,
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
    } catch (error: any) {
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
  ): { success: true; args: any } | { success: false; error: string } {
    if (!toolCall.function.arguments || toolCall.function.arguments.trim() === '') {
      return {
        success: false,
        error: `${toolType} ${toolCall.function.name} called with empty arguments`,
      };
    }

    try {
      const args = JSON.parse(toolCall.function.arguments);

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

      switch (toolCall.function.name) {
        case "view_file":
          const range: [number, number] | undefined =
            args.start_line && args.end_line
              ? [args.start_line, args.end_line]
              : undefined;
          return await this.textEditor.view(args.path, range);

        case "create_file":
          return await this.textEditor.create(args.path, args.content);

        case "str_replace_editor":
          return await this.textEditor.strReplace(
            args.path,
            args.old_str,
            args.new_str,
            args.replace_all
          );

        case "bash":
          return await this.bash.execute(args.command);

        case "create_todo_list":
          return await this.todoTool.createTodoList(args.todos);

        case "update_todo_list":
          return await this.todoTool.updateTodoList(args.updates);

        case "search":
          return await this.search.search(args.query, {
            searchType: args.search_type,
            includePattern: args.include_pattern,
            excludePattern: args.exclude_pattern,
            caseSensitive: args.case_sensitive,
            wholeWord: args.whole_word,
            regex: args.regex,
            maxResults: args.max_results,
            fileTypes: args.file_types,
            includeHidden: args.include_hidden,
          });

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
    } catch (error: any) {
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

      const args = parseResult.args;
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
              return item.text;
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
    } catch (error: any) {
      const errorMsg = extractErrorMessage(error);
      return {
        success: false,
        error: `MCP tool execution error: ${errorMsg}`,
      };
    }
  }

  getChatHistory(): ChatEntry[] {
    return [...this.chatHistory];
  }

  getCurrentDirectory(): string {
    return this.bash.getCurrentDirectory();
  }

  async executeBashCommand(command: string): Promise<ToolResult> {
    return await this.bash.execute(command);
  }

  getCurrentModel(): string {
    return this.llmClient.getCurrentModel();
  }

  setModel(model: string): void {
    this.llmClient.setModel(model);
    // Update token counter for new model
    this.tokenCounter.dispose();
    this.tokenCounter = createTokenCounter(model);
  }

  abortCurrentOperation(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Dispose of resources and remove event listeners
   * Call this when the agent is no longer needed
   */
  dispose(): void {
    this.removeAllListeners();
    this.tokenCounter.dispose();
    this.contextManager.dispose();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
