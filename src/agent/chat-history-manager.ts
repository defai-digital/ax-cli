/**
 * Chat History Manager
 * 
 * Manages chat history, tool call tracking, and related operations.
 * Extracted from LLMAgent to reduce God Object anti-pattern.
 */

import type { ChatEntry } from "./llm-agent.js";

export class ChatHistoryManager {
  private chatHistory: ChatEntry[] = [];
  private toolCallIndexMap: Map<string, number> = new Map();
  private toolCallArgsCache: Map<string, Record<string, unknown>> = new Map();

  /**
   * Get all chat history
   */
  getHistory(): ChatEntry[] {
    return [...this.chatHistory];
  }

  /**
   * Get chat history for LLM (filtered format)
   */
  getLLMMessages(): any[] {
    return this.chatHistory
      .filter(entry => entry.type === 'user' || entry.type === 'assistant' || entry.type === 'tool_result')
      .map(entry => {
        if (entry.type === 'user') {
          return { role: 'user', content: entry.content };
        } else if (entry.type === 'assistant') {
          const message: any = { role: 'assistant', content: entry.content };
          if (entry.toolCalls && entry.toolCalls.length > 0) {
            message.tool_calls = entry.toolCalls.map((toolCall) => ({
              id: toolCall.id,
              type: 'function',
              function: {
                name: toolCall.function.name,
                arguments: toolCall.function.arguments,
              },
            }));
          }
          return message;
        } else if (entry.type === 'tool_result' && entry.toolCall) {
          return {
            role: 'tool',
            tool_call_id: entry.toolCall.id,
            content: entry.content,
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  /**
   * Add entry to chat history
   */
  addEntry(entry: ChatEntry): void {
    this.chatHistory.push(entry);
    
    // Track tool call indices for quick lookup
    if (entry.type === 'tool_call' && entry.toolCall) {
      this.toolCallIndexMap.set(entry.toolCall.id, this.chatHistory.length - 1);
    }
  }

  /**
   * Get recent history (last N entries)
   */
  getRecentHistory(count: number): ChatEntry[] {
    return this.chatHistory.slice(-count);
  }

  /**
   * Clear chat history
   */
  clearHistory(): void {
    this.chatHistory = [];
    this.toolCallIndexMap.clear();
    this.toolCallArgsCache.clear();
  }

  /**
   * Get tool call index by ID
   */
  getToolCallIndex(toolCallId: string): number | undefined {
    return this.toolCallIndexMap.get(toolCallId);
  }

  /**
   * Cache tool call arguments
   */
  cacheToolCallArgs(toolCallId: string, args: Record<string, unknown>): void {
    this.toolCallArgsCache.set(toolCallId, args);
  }

  /**
   * Get cached tool call arguments
   */
  getCachedToolCallArgs(toolCallId: string): Record<string, unknown> | undefined {
    return this.toolCallArgsCache.get(toolCallId);
  }

  /**
   * Get history size
   */
  getHistorySize(): number {
    return this.chatHistory.length;
  }

  /**
   * Get token count estimate for history
   */
  getTokenCount(): number {
    // Simple estimation - could be improved with actual tokenizer
    let totalTokens = 0;
    for (const entry of this.chatHistory) {
      totalTokens += Math.ceil(entry.content.length / 4); // Rough estimate: 1 token per 4 chars
      if (entry.reasoningContent) {
        totalTokens += Math.ceil(entry.reasoningContent.length / 4);
      }
    }
    return totalTokens;
  }

  /**
   * Trim history to stay within token limit
   */
  trimToTokenLimit(maxTokens: number): void {
    const currentTokens = this.getTokenCount();
    if (currentTokens <= maxTokens) {
      return;
    }

    // Keep recent entries (simple approach for now)
    let tokensToKeep = maxTokens;
    let entriesToKeep = 0;
    let tokenCount = 0;

    // Count from the end backwards
    for (let i = this.chatHistory.length - 1; i >= 0; i--) {
      const entry = this.chatHistory[i];
      const entryTokens = Math.ceil(entry.content.length / 4) + 
                         (entry.reasoningContent ? Math.ceil(entry.reasoningContent.length / 4) : 0);
      
      if (tokenCount + entryTokens <= tokensToKeep) {
        tokenCount += entryTokens;
        entriesToKeep++;
      } else {
        break;
      }
    }

    // Keep only recent entries
    this.chatHistory = this.chatHistory.slice(-entriesToKeep);
    
    // Rebuild tool call index map
    this.toolCallIndexMap.clear();
    this.chatHistory.forEach((entry, index) => {
      if (entry.type === 'tool_call' && entry.toolCall) {
        this.toolCallIndexMap.set(entry.toolCall.id, index);
      }
    });
  }
}
