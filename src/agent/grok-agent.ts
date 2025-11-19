import { GrokClient, GrokMessage, GrokToolCall, GrokTool } from "../grok/client.js";
import {
  getAllGrokTools,
  getMCPManager,
  initializeMCPServers,
} from "../grok/tools.js";
import { loadMCPConfig } from "../mcp/config.js";
import {
  TextEditorTool,
  MorphEditorTool,
  BashTool,
  TodoTool,
  SearchTool,
} from "../tools/index.js";
import { ToolResult } from "../types/index.js";
import { EventEmitter } from "events";
import { createTokenCounter, TokenCounter } from "../utils/token-counter.js";
import { loadCustomInstructions } from "../utils/custom-instructions.js";
import { getSettingsManager } from "../utils/settings-manager.js";
import { ContextManager } from "./context-manager.js";
import { buildSystemPrompt } from "../utils/prompt-builder.js";

export interface ChatEntry {
  type: "user" | "assistant" | "tool_result" | "tool_call";
  content: string;
  timestamp: Date;
  toolCalls?: GrokToolCall[];
  toolCall?: GrokToolCall;
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
  toolCalls?: GrokToolCall[];
  toolCall?: GrokToolCall;
  toolResult?: ToolResult;
  tokenCount?: number;
}

export class GrokAgent extends EventEmitter {
  private grokClient: GrokClient;
  private textEditor: TextEditorTool;
  private morphEditor: MorphEditorTool | null;
  private bash: BashTool;
  private todoTool: TodoTool;
  private search: SearchTool;
  private chatHistory: ChatEntry[] = [];
  private messages: GrokMessage[] = [];
  private tokenCounter: TokenCounter;
  private contextManager: ContextManager;
  private abortController: AbortController | null = null;
  private maxToolRounds: number;

  constructor(
    apiKey: string,
    baseURL?: string,
    model?: string,
    maxToolRounds?: number
  ) {
    super();
    const manager = getSettingsManager();
    const savedModel = manager.getCurrentModel();
    const modelToUse = model || savedModel || "grok-code-fast-1";
    this.maxToolRounds = maxToolRounds || 400;
    this.grokClient = new GrokClient(apiKey, modelToUse, baseURL);
    this.textEditor = new TextEditorTool();
    this.morphEditor = process.env.MORPH_API_KEY ? new MorphEditorTool() : null;
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
      hasMorphEditor: !!this.morphEditor,
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
        }
      } catch (error) {
        console.warn("MCP initialization failed:", error);
      }
    });
  }

  private isGrokModel(): boolean {
    const currentModel = this.grokClient.getCurrentModel();
    return currentModel.toLowerCase().includes("grok");
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
      let currentResponse = await this.grokClient.chat(
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
          throw new Error("No response from Grok");
        }

        // Handle tool calls
        if (
          assistantMessage.tool_calls &&
          assistantMessage.tool_calls.length > 0
        ) {
          toolRounds++;

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
          currentResponse = await this.grokClient.chat(
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
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date(),
      };
      this.chatHistory.push(errorEntry);
      return [userEntry, errorEntry];
    }
  }

  private messageReducer(previous: any, item: any): any {
    const reduce = (acc: any, delta: any) => {
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
            if (!accArray[i]) accArray[i] = {};
            accArray[i] = reduce(accArray[i], value[i]);
          }
        } else if (typeof acc[key] === "object" && typeof value === "object") {
          acc[key] = reduce(acc[key], value);
        }
      }
      return acc;
    };

    // Safety check: ensure item has valid structure
    if (!item?.choices || item.choices.length === 0 || !item.choices[0]?.delta) {
      return previous;
    }
    return reduce(previous, item.choices[0].delta);
  }

  async *processUserMessageStream(
    message: string
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    // Create new abort controller for this request
    this.abortController = new AbortController();

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
    let inputTokens = this.tokenCounter.countMessageTokens(
      this.messages as any
    );
    yield {
      type: "token_count",
      tokenCount: inputTokens,
    };

    // Check for context warnings
    const stats = this.contextManager.getStats(this.messages, this.tokenCounter);
    if (stats.shouldPrune || stats.isNearLimit) {
      const warning = this.contextManager.createWarningMessage(stats);
      yield {
        type: "content",
        content: `\n${warning}\n\n`,
      };
    }

    const maxToolRounds = this.maxToolRounds; // Prevent infinite loops
    let toolRounds = 0;
    let totalOutputTokens = 0;
    let lastTokenUpdate = 0;

    try {
      // Agent loop - continue until no more tool calls or max rounds reached
      while (toolRounds < maxToolRounds) {
        // Check if operation was cancelled
        if (this.abortController?.signal.aborted) {
          yield {
            type: "content",
            content: "\n\n[Operation cancelled by user]",
          };
          yield { type: "done" };
          return;
        }

        // Stream response and accumulate
        let tools: GrokTool[];
        try {
          tools = await getAllGrokTools();
        } catch (error: any) {
          yield {
            type: "content",
            content: `\n⚠️ Error loading tools: ${error.message}\nContinuing with limited functionality...\n\n`
          };
          tools = []; // Continue with no tools
        }

        const stream = this.grokClient.chatStream(
          this.messages,
          tools,
          {
            searchOptions: this.isGrokModel() && this.shouldUseSearchFor(message)
              ? { search_parameters: { mode: "auto" } }
              : { search_parameters: { mode: "off" } }
          }
        );
        let accumulatedMessage: any = {};
        let accumulatedContent = "";
        let toolCallsYielded = false;

        for await (const chunk of stream) {
          // Check for cancellation in the streaming loop
          if (this.abortController?.signal.aborted) {
            yield {
              type: "content",
              content: "\n\n[Operation cancelled by user]",
            };
            yield { type: "done" };
            return;
          }

          if (!chunk.choices?.[0]) continue;

          // Accumulate the message using reducer
          accumulatedMessage = this.messageReducer(accumulatedMessage, chunk);

          // Check for tool calls - yield when we have complete tool calls with function names
          if (!toolCallsYielded && accumulatedMessage.tool_calls?.length > 0) {
            // Check if we have at least one complete tool call with a function name
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

            // Update token count in real-time including accumulated content and any tool calls
            const currentOutputTokens =
              this.tokenCounter.estimateStreamingTokens(accumulatedContent) +
              (accumulatedMessage.tool_calls
                ? this.tokenCounter.countTokens(
                    JSON.stringify(accumulatedMessage.tool_calls)
                  )
                : 0);
            totalOutputTokens = currentOutputTokens;

            yield {
              type: "content",
              content: chunk.choices[0].delta.content,
            };

            // Emit token count update
            const now = Date.now();
            if (now - lastTokenUpdate > 250) {
              lastTokenUpdate = now;
              yield {
                type: "token_count",
                tokenCount: inputTokens + totalOutputTokens,
              };
            }
        }
      }

        // Add assistant entry to history
        const assistantEntry: ChatEntry = {
          type: "assistant",
          content: accumulatedMessage.content || "Using tools to help you...",
          timestamp: new Date(),
          toolCalls: accumulatedMessage.tool_calls || undefined,
        };
        this.chatHistory.push(assistantEntry);

        // Add accumulated message to conversation
        this.messages.push({
          role: "assistant",
          content: accumulatedMessage.content || "",
          tool_calls: accumulatedMessage.tool_calls,
        } as any);

        // Handle tool calls if present
        if (accumulatedMessage.tool_calls?.length > 0) {
          toolRounds++;

          // Only yield tool_calls if we haven't already yielded them during streaming
          if (!toolCallsYielded) {
            yield {
              type: "tool_calls",
              toolCalls: accumulatedMessage.tool_calls,
            };
          }

          // Execute tools
          for (const toolCall of accumulatedMessage.tool_calls) {
            // Check for cancellation before executing each tool
            if (this.abortController?.signal.aborted) {
              yield {
                type: "content",
                content: "\n\n[Operation cancelled by user]",
              };
              yield { type: "done" };
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

          // Update token count after processing all tool calls to include tool results
          inputTokens = this.tokenCounter.countMessageTokens(
            this.messages as any
          );
          // Final token update after tools processed
          yield {
            type: "token_count",
            tokenCount: inputTokens + totalOutputTokens,
          };

          // Continue the loop to get the next response (which might have more tool calls)
        } else {
          // No tool calls, we're done
          break;
        }
      }

      if (toolRounds >= maxToolRounds) {
        yield {
          type: "content",
          content:
            "\n\nMaximum tool execution rounds reached. Stopping to prevent infinite loops.",
        };
      }

      yield { type: "done" };
    } catch (error: any) {
      // Check if this was a cancellation
      if (this.abortController?.signal.aborted) {
        yield {
          type: "content",
          content: "\n\n[Operation cancelled by user]",
        };
        yield { type: "done" };
        return;
      }

      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Sorry, I encountered an error: ${error.message}`,
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

  private async executeTool(toolCall: GrokToolCall): Promise<ToolResult> {
    try {
      // Defensive: ensure arguments is a valid JSON string
      if (!toolCall.function.arguments || toolCall.function.arguments.trim() === '') {
        return {
          success: false,
          error: `Tool ${toolCall.function.name} called with empty arguments`,
        };
      }

      const args = JSON.parse(toolCall.function.arguments);

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

        case "edit_file":
          if (!this.morphEditor) {
            return {
              success: false,
              error:
                "Morph Fast Apply not available. Please set MORPH_API_KEY environment variable to use this feature.",
            };
          }
          return await this.morphEditor.editFile(
            args.target_file,
            args.instructions,
            args.code_edit
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
      return {
        success: false,
        error: `Tool execution error: ${error.message}`,
      };
    }
  }

  private async executeMCPTool(toolCall: GrokToolCall): Promise<ToolResult> {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      const mcpManager = getMCPManager();

      const result = await mcpManager.callTool(toolCall.function.name, args);

      if (result.isError) {
        return {
          success: false,
          error: (result.content[0] as any)?.text || "MCP tool error",
        };
      }

      // Extract content from result
      const output = result.content
        .map((item) => {
          if (item.type === "text") {
            return item.text;
          } else if (item.type === "resource") {
            return `Resource: ${item.resource?.uri || "Unknown"}`;
          }
          return String(item);
        })
        .join("\n");

      return {
        success: true,
        output: output || "Success",
      };
    } catch (error: any) {
      return {
        success: false,
        error: `MCP tool execution error: ${error.message}`,
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
    return this.grokClient.getCurrentModel();
  }

  setModel(model: string): void {
    this.grokClient.setModel(model);
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
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
