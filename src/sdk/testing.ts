/**
 * Testing utilities for AX CLI SDK
 *
 * This module provides mock implementations and test helpers to make
 * it easy to test code that uses the AX CLI SDK.
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'events';
import type { ChatEntry, StreamingChunk } from '../agent/llm-agent.js';
import type { ToolResult } from '../types/index.js';

/**
 * Mock agent for testing
 *
 * Implements the same interface as LLMAgent but with predictable,
 * controllable behavior for testing.
 *
 * @example
 * ```typescript
 * import { MockAgent } from '@defai.digital/ax-cli/sdk/testing';
 *
 * test('my integration', async () => {
 *   const agent = new MockAgent({
 *     responses: ['First response', 'Second response']
 *   });
 *
 *   const result = await agent.processUserMessage('Hello');
 *   expect(result[0].content).toBe('First response');
 * });
 * ```
 */
export class MockAgent extends EventEmitter {
  private responses: string[];
  private currentResponseIndex = 0;
  private history: ChatEntry[] = [];
  private disposed = false;

  /**
   * Create a new mock agent
   *
   * @param options - Configuration for mock behavior
   */
  constructor(options: {
    /** Predefined responses to return (cycles through) */
    responses?: string[];
  } = {}) {
    super();
    this.responses = options.responses || ['Mock response'];
  }

  /**
   * Process a user message (mock implementation)
   *
   * Returns the next predefined response and adds it to history.
   * Cycles through responses if called more times than responses available.
   *
   * @param message - User message (stored in history)
   * @returns Mock chat history
   */
  async processUserMessage(message: string): Promise<ChatEntry[]> {
    this.checkDisposed();

    // Add user message to history
    const userEntry: ChatEntry = {
      type: 'user',
      content: message,
      timestamp: new Date(),
    };
    this.history.push(userEntry);

    // Get next response (cycle through)
    const response = this.responses[this.currentResponseIndex % this.responses.length];
    this.currentResponseIndex++;

    // Add assistant response to history
    const assistantEntry: ChatEntry = {
      type: 'assistant',
      content: response,
      timestamp: new Date(),
    };
    this.history.push(assistantEntry);

    // Emit stream event for compatibility
    this.emit('stream', {
      type: 'content',
      content: response,
    } as StreamingChunk);

    this.emit('stream', {
      type: 'done',
    } as StreamingChunk);

    return [...this.history];
  }

  /**
   * Process user message with streaming (mock implementation)
   *
   * Yields mock stream chunks for the response.
   */
  async *processUserMessageStream(message: string): AsyncGenerator<StreamingChunk> {
    this.checkDisposed();

    // Add user message to history
    const userEntry: ChatEntry = {
      type: 'user',
      content: message,
      timestamp: new Date(),
    };
    this.history.push(userEntry);

    // Get next response
    const response = this.responses[this.currentResponseIndex % this.responses.length];
    this.currentResponseIndex++;

    // Stream the response character by character (for realistic testing)
    const words = response.split(' ');
    for (const word of words) {
      yield {
        type: 'content',
        content: word + ' ',
      } as StreamingChunk;
    }

    // Add assistant response to history
    const assistantEntry: ChatEntry = {
      type: 'assistant',
      content: response,
      timestamp: new Date(),
    };
    this.history.push(assistantEntry);

    yield {
      type: 'done',
    } as StreamingChunk;
  }

  /**
   * Get chat history (mock implementation)
   */
  getChatHistory(): ChatEntry[] {
    this.checkDisposed();
    return [...this.history];
  }

  /**
   * Execute bash command (mock implementation)
   *
   * Always returns success with predefined output.
   */
  async executeBashCommand(command: string): Promise<ToolResult> {
    this.checkDisposed();
    return {
      success: true,
      output: `Mock output for command: ${command}`,
    };
  }

  /**
   * Get current directory (mock implementation)
   */
  getCurrentDirectory(): string {
    this.checkDisposed();
    return '/mock/directory';
  }

  /**
   * Create checkpoint (mock implementation)
   */
  async createCheckpoint(_description?: string): Promise<string> {
    this.checkDisposed();
    return `mock-checkpoint-${Date.now()}`;
  }

  /**
   * Rewind conversation (mock implementation)
   */
  async rewindConversation(_checkpointId: string): Promise<{ success: boolean; error?: string }> {
    this.checkDisposed();
    this.history = [];
    return { success: true };
  }

  /**
   * Check if bash is executing (mock implementation)
   */
  isBashExecuting(): boolean {
    this.checkDisposed();
    return false;
  }

  /**
   * Dispose of mock agent
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    this.removeAllListeners();
    this.history = [];
    this.responses = [];
  }

  /**
   * Reset mock agent state
   *
   * Clears history and resets response index.
   * Useful for reusing the same mock across multiple tests.
   */
  reset(): void {
    this.history = [];
    this.currentResponseIndex = 0;
  }

  /**
   * Set new responses
   *
   * @param responses - New responses to use
   */
  setResponses(responses: string[]): void {
    this.responses = responses;
    this.currentResponseIndex = 0;
  }

  /**
   * Get number of messages processed
   */
  getMessageCount(): number {
    return this.history.filter(entry => entry.type === 'user').length;
  }

  private checkDisposed(): void {
    if (this.disposed) {
      throw new Error('MockAgent has been disposed and cannot be used');
    }
  }
}

/**
 * Create a mock agent with predefined responses
 *
 * Convenience function for creating mock agents.
 *
 * @param responses - Predefined responses (optional)
 * @returns Mock agent instance
 *
 * @example
 * ```typescript
 * import { createMockAgent } from '@defai.digital/ax-cli/sdk/testing';
 *
 * const agent = createMockAgent(['Hello!', 'How can I help?']);
 * const result = await agent.processUserMessage('Hi');
 * expect(result[0].content).toBe('Hello!');
 * ```
 */
export function createMockAgent(responses?: string[]): MockAgent {
  return new MockAgent({ responses });
}

/**
 * Mock settings manager for testing
 *
 * Allows tests to control what settings are returned without
 * needing actual config files.
 *
 * @example
 * ```typescript
 * import { MockSettingsManager } from '@defai.digital/ax-cli/sdk/testing';
 *
 * const settings = new MockSettingsManager({
 *   apiKey: 'test-key',
 *   baseURL: 'https://test.api.com',
 *   model: 'glm-4.6'
 * });
 * ```
 */
export class MockSettingsManager {
  private settings: {
    apiKey?: string;
    baseURL?: string;
    model?: string;
  };

  constructor(settings: {
    apiKey?: string;
    baseURL?: string;
    model?: string;
  } = {}) {
    this.settings = settings;
  }

  loadUserSettings(): void {
    // No-op for mock
  }

  loadProjectSettings(): void {
    // No-op for mock
  }

  getApiKey(): string | undefined {
    return this.settings.apiKey;
  }

  getBaseURL(): string | undefined {
    return this.settings.baseURL;
  }

  getCurrentModel(): string {
    return this.settings.model || 'glm-4.6';
  }

  updateUserSetting(key: string, value: unknown): void {
    (this.settings as any)[key] = value;
  }

  saveUserSettings(): void {
    // No-op for mock
  }
}

/**
 * Create a mock settings manager
 *
 * @param settings - Settings to return
 * @returns Mock settings manager
 *
 * @example
 * ```typescript
 * import { createMockSettings } from '@defai.digital/ax-cli/sdk/testing';
 *
 * const settings = createMockSettings({
 *   apiKey: 'test-key',
 *   model: 'glm-4.6'
 * });
 * ```
 */
export function createMockSettings(settings?: {
  apiKey?: string;
  baseURL?: string;
  model?: string;
}): MockSettingsManager {
  return new MockSettingsManager(settings);
}
