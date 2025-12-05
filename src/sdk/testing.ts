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
    // BUG FIX: Clone responses array to prevent external mutation
    // Without this, the caller could modify the responses array after construction
    // and unexpectedly change the mock's behavior during tests
    this.responses = options.responses ? [...options.responses] : ['Mock response'];
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
    // Guard against empty responses array to prevent modulo-by-zero
    const response = this.responses.length > 0
      ? this.responses[this.currentResponseIndex % this.responses.length]
      : 'No response configured';
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

    // BUG FIX: Return deep copies to prevent external mutation of internal history
    // Without this, callers could modify the returned entries and corrupt
    // the mock agent's internal chat history
    return this.history.map(entry => ({
      ...entry,
      timestamp: new Date(entry.timestamp.getTime()),
    }));
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
    // Guard against empty responses array to prevent modulo-by-zero
    const response = this.responses.length > 0
      ? this.responses[this.currentResponseIndex % this.responses.length]
      : 'No response configured';
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
   *
   * Returns deep copies of chat entries to prevent external mutation.
   */
  getChatHistory(): ChatEntry[] {
    this.checkDisposed();
    // BUG FIX: Return deep copies to prevent external mutation of internal history
    // Without this, callers could modify the returned entries and corrupt
    // the mock agent's internal chat history (e.g., change timestamps, content)
    return this.history.map(entry => ({
      ...entry,
      // Clone Date objects to prevent mutation
      timestamp: new Date(entry.timestamp.getTime()),
    }));
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
   * Note: Returns void to match LLMAgent.dispose() signature
   */
  dispose(): void {
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
    this.checkDisposed();
    this.history = [];
    this.currentResponseIndex = 0;
  }

  /**
   * Set new responses
   *
   * @param responses - New responses to use (must have at least one response)
   * @throws Error if responses array is empty
   */
  setResponses(responses: string[]): void {
    this.checkDisposed();
    if (!responses || responses.length === 0) {
      throw new Error('MockAgent.setResponses: responses array must not be empty');
    }
    // BUG FIX: Clone responses array to prevent external mutation
    // Without this, the caller could modify the responses array after setting
    // and unexpectedly change the mock's behavior during tests
    this.responses = [...responses];
    this.currentResponseIndex = 0;
  }

  /**
   * Get number of messages processed
   */
  getMessageCount(): number {
    this.checkDisposed();
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
    // BUG FIX: Clone settings to prevent external mutation
    // Without this, the caller could modify the settings object after construction
    // and unexpectedly change the mock's behavior during tests
    this.settings = { ...settings };
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
    // Validate key is one of the valid settings keys
    const validKeys = ['apiKey', 'baseURL', 'model'];
    if (!validKeys.includes(key)) {
      console.warn(`MockSettingsManager.updateUserSetting: '${key}' is not a recognized setting key`);
    }
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

/**
 * Mock MCP Server Options
 */
export interface MockMCPServerOptions {
  name: string;
  version?: string;
  tools?: Array<{
    name: string;
    description: string;
    inputSchema: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
    handler: (args: any) => Promise<any>;
  }>;
  resources?: Array<{
    uri: string;
    name: string;
    mimeType?: string;
    handler: () => Promise<string>;
  }>;
  prompts?: Array<{
    name: string;
    description?: string;
    handler: (args?: any) => Promise<any>;
  }>;
}

/**
 * Mock MCP Server for Testing
 *
 * Simplified MCP server that can be used in tests without needing
 * real MCP server infrastructure.
 *
 * @example
 * ```typescript
 * import { createMockMCPServer } from '@defai.digital/ax-cli/sdk/testing';
 *
 * const mockServer = createMockMCPServer({
 *   name: 'test-server',
 *   tools: [{
 *     name: 'test_tool',
 *     description: 'A test tool',
 *     inputSchema: {
 *       type: 'object',
 *       properties: { input: { type: 'string' } },
 *       required: ['input']
 *     },
 *     handler: async (args) => ({ result: `Processed: ${args.input}` })
 *   }]
 * });
 *
 * await mockServer.connect();
 * const tools = await mockServer.listTools();
 * const result = await mockServer.callTool('test_tool', { input: 'test' });
 * ```
 */
export class MockMCPServer {
  private options: MockMCPServerOptions;
  private connected: boolean = false;

  constructor(options: MockMCPServerOptions) {
    // BUG FIX: Deep clone options to prevent external mutation
    // Without this, external code could modify the options after construction
    // (e.g., modify tools array, change handlers) and unexpectedly affect
    // the mock server's behavior during tests
    this.options = {
      name: options.name,
      version: options.version,
      // Clone arrays to prevent external mutation, but keep handler references
      // (handlers are functions and cannot be cloned)
      tools: options.tools ? options.tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: JSON.parse(JSON.stringify(t.inputSchema)),
        handler: t.handler,
      })) : undefined,
      resources: options.resources ? options.resources.map(r => ({
        uri: r.uri,
        name: r.name,
        mimeType: r.mimeType,
        handler: r.handler,
      })) : undefined,
      prompts: options.prompts ? options.prompts.map(p => ({
        name: p.name,
        description: p.description,
        handler: p.handler,
      })) : undefined,
    };
  }

  /**
   * Connect the mock server
   */
  async connect(): Promise<void> {
    this.connected = true;
  }

  /**
   * Disconnect the mock server
   */
  async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * List available tools
   *
   * Returns deep copies of tool definitions to prevent external mutation.
   */
  async listTools(): Promise<Array<{ name: string; description: string; inputSchema: any }>> {
    if (!this.connected) {
      throw new Error('Server not connected');
    }

    // BUG FIX: Deep clone inputSchema to prevent external mutation of internal state
    // Without this, callers could modify the returned schema and corrupt
    // the mock server's tool definitions
    return (this.options.tools || []).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: JSON.parse(JSON.stringify(tool.inputSchema))
    }));
  }

  /**
   * Call a tool on the mock server
   *
   * @param name - Tool name to call
   * @param args - Arguments to pass to the tool
   * @throws Error if server not connected, tool not found, or handler throws
   */
  async callTool(name: string, args: any): Promise<any> {
    if (!this.connected) {
      throw new Error('Server not connected');
    }

    const tool = this.options.tools?.find(t => t.name === name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    try {
      // BUG FIX: Clone args before passing to handler to prevent mutation
      // Without this, the handler could modify the caller's args object
      const clonedArgs = args !== null && args !== undefined
        ? JSON.parse(JSON.stringify(args))
        : args;
      return await tool.handler(clonedArgs);
    } catch (error) {
      // Wrap handler errors with context
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Tool '${name}' execution failed: ${message}`);
    }
  }

  /**
   * List available resources
   */
  async listResources(): Promise<Array<{ uri: string; name: string; mimeType?: string }>> {
    if (!this.connected) {
      throw new Error('Server not connected');
    }

    return (this.options.resources || []).map(resource => ({
      uri: resource.uri,
      name: resource.name,
      mimeType: resource.mimeType
    }));
  }

  /**
   * Read a resource from the mock server
   *
   * @param uri - Resource URI to read
   * @throws Error if server not connected, resource not found, or handler throws
   */
  async readResource(uri: string): Promise<string> {
    if (!this.connected) {
      throw new Error('Server not connected');
    }

    const resource = this.options.resources?.find(r => r.uri === uri);
    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }

    try {
      return await resource.handler();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Resource '${uri}' read failed: ${message}`);
    }
  }

  /**
   * List available prompts
   */
  async listPrompts(): Promise<Array<{ name: string; description?: string }>> {
    if (!this.connected) {
      throw new Error('Server not connected');
    }

    return (this.options.prompts || []).map(prompt => ({
      name: prompt.name,
      description: prompt.description
    }));
  }

  /**
   * Execute a prompt
   *
   * @param name - Prompt name to execute
   * @param args - Optional arguments for the prompt
   * @throws Error if server not connected, prompt not found, or handler throws
   */
  async executePrompt(name: string, args?: any): Promise<any> {
    if (!this.connected) {
      throw new Error('Server not connected');
    }

    const prompt = this.options.prompts?.find(p => p.name === name);
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`);
    }

    try {
      // BUG FIX: Clone args before passing to handler to prevent mutation
      // Without this, the handler could modify the caller's args object
      const clonedArgs = args !== null && args !== undefined
        ? JSON.parse(JSON.stringify(args))
        : args;
      return await prompt.handler(clonedArgs);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Prompt '${name}' execution failed: ${message}`);
    }
  }

  /**
   * Check if server is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get server info
   */
  getInfo() {
    return {
      name: this.options.name,
      version: this.options.version || '1.0.0',
      toolCount: this.options.tools?.length || 0,
      resourceCount: this.options.resources?.length || 0,
      promptCount: this.options.prompts?.length || 0
    };
  }
}

/**
 * Create a mock MCP server for testing
 *
 * @example
 * ```typescript
 * const mockServer = createMockMCPServer({
 *   name: 'test-server',
 *   tools: [{
 *     name: 'test_tool',
 *     description: 'A test tool',
 *     inputSchema: {
 *       type: 'object',
 *       properties: { input: { type: 'string' } },
 *       required: ['input']
 *     },
 *     handler: async (args) => ({ result: `Processed: ${args.input}` })
 *   }]
 * });
 *
 * await mockServer.connect();
 * const tools = await mockServer.listTools();
 * const result = await mockServer.callTool('test_tool', { input: 'test' });
 * ```
 */
export function createMockMCPServer(options: MockMCPServerOptions): MockMCPServer {
  return new MockMCPServer(options);
}

/**
 * Wait for agent to complete processing
 *
 * Useful in tests when you need to wait for async operations to complete.
 *
 * @example
 * ```typescript
 * const agent = await createAgent();
 *
 * agent.processUserMessage('Hello');
 *
 * // Wait for agent to finish
 * await waitForAgent(agent, { timeout: 5000 });
 *
 * // Now agent is idle
 * ```
 */
export async function waitForAgent(
  agent: any,
  options?: { timeout?: number }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = options?.timeout || 5000;
    let resolved = false;
    let completionTimer: ReturnType<typeof setTimeout> | undefined;
    let streamListener: ((chunk: any) => void) | undefined;
    let errorListener: ((error: Error) => void) | undefined;

    const cleanup = () => {
      // BUG FIX: Always clean up both timers and event listeners to prevent memory leaks
      if (completionTimer !== undefined) {
        clearTimeout(completionTimer);
        completionTimer = undefined;
      }
      // Remove stream listener if it was added
      if (streamListener && agent && typeof agent.off === 'function') {
        agent.off('stream', streamListener);
        streamListener = undefined;
      }
      // BUG FIX: Remove error listener if it was added
      if (errorListener && agent && typeof agent.off === 'function') {
        agent.off('error', errorListener);
        errorListener = undefined;
      }
    };

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error(`Agent did not complete within ${timeout}ms`));
      }
    }, timeout);

    // BUG FIX: Listen for 'done' stream event instead of arbitrary delay
    // This properly waits for the agent to complete rather than using a fixed timeout
    if (agent && typeof agent.on === 'function') {
      streamListener = (chunk: any) => {
        if (chunk && chunk.type === 'done' && !resolved) {
          resolved = true;
          clearTimeout(timer);
          cleanup();
          resolve();
        }
      };
      agent.on('stream', streamListener);

      // BUG FIX: Listen for error events so waitForAgent rejects with the actual error
      // Without this, agent errors would be silently ignored and waitForAgent would
      // either timeout or resolve via fallback, hiding the real failure
      errorListener = (error: Error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          cleanup();
          reject(error);
        }
      };
      agent.on('error', errorListener);
    }

    // Fallback: resolve after a short delay if no stream events
    // This handles agents that don't emit stream events
    completionTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        cleanup();
        resolve();
      }
    }, 100);

    // Allow process to exit if these are the only timers
    timer.unref?.();
    completionTimer.unref?.();
  });
}

/**
 * Create a mock tool result
 */
export function createMockToolResult(success: boolean, output?: string, error?: string): ToolResult {
  return {
    success,
    output,
    error
  };
}

/**
 * Assert tool result is successful
 */
export function assertToolSuccess(result: ToolResult): asserts result is ToolResult & { success: true; output: string } {
  if (!result.success) {
    throw new Error(`Tool execution failed: ${result.error || 'Unknown error'}`);
  }
}

/**
 * Assert tool result is a failure
 */
export function assertToolFailure(result: ToolResult): asserts result is ToolResult & { success: false; error: string } {
  if (result.success) {
    throw new Error('Expected tool to fail, but it succeeded');
  }
}
