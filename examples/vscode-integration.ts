/**
 * VSCode Extension Integration Example
 *
 * Shows how to replace CLI spawning with SDK for better performance.
 */

import { createAgent, type StreamingChunk } from '@defai.digital/ax-cli/sdk';
import type { LLMAgent } from '@defai.digital/ax-cli/sdk';

class VSCodeCLIBridge {
  private agent: LLMAgent | null = null;
  private messageId = 0;

  /**
   * Initialize the agent (call once at extension activation)
   */
  async initialize(config: {
    apiKey?: string;
    model?: string;
    baseURL?: string;
  }): Promise<void> {
    this.agent = await createAgent({
      apiKey: config.apiKey,
      model: config.model || 'glm-4.6',
      baseURL: config.baseURL,
      maxToolRounds: 50
    });

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for real-time updates
   */
  private setupEventListeners(): void {
    if (!this.agent) return;

    this.agent.on('stream', (chunk: StreamingChunk) => {
      // Send streaming updates to VSCode webview
      this.sendToWebview({
        type: 'stream',
        chunk
      });
    });

    this.agent.on('tool_start', (toolCall) => {
      this.sendToWebview({
        type: 'tool_start',
        toolCall
      });
    });

    this.agent.on('tool_complete', (toolCall, result) => {
      this.sendToWebview({
        type: 'tool_complete',
        toolCall,
        result
      });
    });

    this.agent.on('token_count', (count) => {
      this.sendToWebview({
        type: 'token_count',
        count
      });
    });
  }

  /**
   * Send message to agent
   *
   * BEFORE: spawn('ax-cli', ['--prompt', message]) - 50-200ms overhead
   * AFTER: Direct SDK call - ~5ms
   */
  async sendMessage(message: string, context?: {
    file?: string;
    selection?: string;
    lineRange?: string;
  }): Promise<void> {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    const messageId = ++this.messageId;

    // Add context to message if provided
    let fullMessage = message;
    if (context?.file) {
      fullMessage += `\n\nFile: ${context.file}`;
    }
    if (context?.selection) {
      fullMessage += `\n\nSelected code:\n\`\`\`\n${context.selection}\n\`\`\``;
    }

    try {
      // Process message with real-time streaming
      const result = await this.agent.processUserMessage(fullMessage);

      this.sendToWebview({
        type: 'complete',
        messageId,
        result
      });
    } catch (error) {
      this.sendToWebview({
        type: 'error',
        messageId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Interrupt current processing
   */
  interrupt(): void {
    if (this.agent) {
      this.agent.interrupt();
    }
  }

  /**
   * Get chat history
   */
  getChatHistory() {
    return this.agent?.getChatHistory() || [];
  }

  /**
   * Clear chat history
   */
  clearHistory(): void {
    if (this.agent) {
      this.agent.clearHistory();
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.agent) {
      this.agent.dispose();
      this.agent = null;
    }
  }

  /**
   * Send data to VSCode webview (mock implementation)
   */
  private sendToWebview(data: any): void {
    // In real VSCode extension, this would be:
    // webview.postMessage(data);
    console.log('[To Webview]', data.type);
  }
}

// Example usage in VSCode extension
async function exampleUsage() {
  const bridge = new VSCodeCLIBridge();

  // Initialize once at extension activation
  await bridge.initialize({
    apiKey: process.env.GROK_API_KEY,
    model: 'glm-4.6'
  });

  // Send messages (fast, no process spawning!)
  await bridge.sendMessage('Analyze this file', {
    file: '/path/to/file.ts',
    selection: 'function example() { ... }'
  });

  // Cleanup on extension deactivation
  bridge.dispose();
}

export { VSCodeCLIBridge, exampleUsage };
