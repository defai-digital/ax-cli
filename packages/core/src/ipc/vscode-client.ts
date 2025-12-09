/**
 * VS Code IPC Client
 *
 * WebSocket client that connects to the VS Code extension's IPC server.
 * Enables the CLI to:
 * - Show diff previews in VS Code before file modifications
 * - Display task completion summaries in VS Code
 * - Update status in VS Code status bar
 *
 * Falls back gracefully if extension is not running.
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Shared types with extension
export interface DiffPayload {
  id: string;
  file: string;
  oldContent: string;
  newContent: string;
  diff: string;
  operation: 'create' | 'edit' | 'delete';
  lineStart?: number;
  lineEnd?: number;
  toolCall: {
    name: string;
    command: string;
  };
}

export interface TaskSummaryPayload {
  id: string;
  description: string;
  status: 'completed' | 'failed' | 'partial';
  startTime: string;
  endTime: string;
  duration: number;
  changes: {
    filesModified: string[];
    filesCreated: string[];
    filesDeleted: string[];
    totalLinesAdded: number;
    totalLinesRemoved: number;
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
    toolCalls: number;
    toolsUsed: string[];
  };
  errors?: string[];
  warnings?: string[];
}

// Streaming chunk payload
export interface StreamChunkPayload {
  sessionId: string;
  type: 'thinking' | 'content' | 'tool_call' | 'tool_result' | 'done' | 'error';
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
  toolResult?: {
    id: string;
    result: string;
    isError: boolean;
  };
  error?: string;
}

// File reveal payload - to open files in VS Code after writing
export interface FileRevealPayload {
  file: string;
  operation: 'create' | 'edit';
  preview?: boolean;  // Open in preview mode (default: true)
  focus?: boolean;    // Focus the editor (default: true)
}

interface IPCMessage {
  type: 'diff_preview' | 'task_complete' | 'status_update' | 'ping' | 'stream_chunk' | 'file_reveal';
  payload: DiffPayload | TaskSummaryPayload | StreamChunkPayload | FileRevealPayload | { status: string } | null;
  requestId: string;
}

interface IPCResponse {
  type: 'approved' | 'rejected' | 'pong' | 'error';
  requestId: string;
  payload?: { reason?: string };
}

interface PortFileContent {
  port: number;
  pid: number;
  started: string;
  version: string;
}

interface PendingRequest {
  resolve: (response: IPCResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  resolved: boolean;  // BUG FIX: Track if promise already resolved to prevent double-resolution
}

const IPC_PORT_FILE = path.join(os.homedir(), '.ax-cli', 'vscode-ipc.json');
const CONNECTION_TIMEOUT = 5000;  // 5 seconds to connect
const REQUEST_TIMEOUT = 120000;   // 2 minutes for approval (user may need time to review)

export class VSCodeIPCClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private port: number = 0;
  private connected: boolean = false;
  private connecting: boolean = false;
  private disconnecting: boolean = false;  // BUG FIX: Prevent race between disconnect() and handleDisconnect()
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestCounter: number = 0;

  constructor() {
    super();
  }

  /**
   * Attempt to connect to VS Code extension IPC server
   * Returns true if connected, false if extension not available
   */
  async connect(): Promise<boolean> {
    if (this.connected) return true;
    if (this.connecting) return false;

    this.connecting = true;

    try {
      // Read port file
      const portInfo = this.readPortFile();
      if (!portInfo) {
        this.connecting = false;
        return false;
      }

      this.port = portInfo.port;

      // Connect to WebSocket server
      return await this.establishConnection();

    } catch {
      // Silently fail - CLI works standalone without VS Code extension
      this.connecting = false;
      return false;
    }
  }

  /**
   * Establish WebSocket connection
   */
  private establishConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      // BUG FIX: Track if we've already resolved to prevent race conditions
      // between timeout firing and 'open' event handler
      let resolved = false;

      const safeResolve = (success: boolean) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        this.connecting = false;
        if (success) {
          this.connected = true;
          this.emit('connected');
        }
        resolve(success);
      };

      const timeout = setTimeout(() => {
        if (this.ws) {
          this.ws.close();
        }
        safeResolve(false);
      }, CONNECTION_TIMEOUT);

      try {
        this.ws = new WebSocket(`ws://127.0.0.1:${this.port}`);

        this.ws.on('open', () => {
          safeResolve(true);
        });

        this.ws.on('message', (data) => {
          try {
            const response: IPCResponse = JSON.parse(data.toString());
            this.handleResponse(response);
          } catch {
            // Silently ignore parse errors - malformed responses shouldn't crash CLI
          }
        });

        this.ws.on('close', () => {
          clearTimeout(timeout);
          this.handleDisconnect();
          safeResolve(false);
        });

        this.ws.on('error', () => {
          safeResolve(false);
        });

      } catch {
        safeResolve(false);
      }
    });
  }

  /**
   * Handle disconnection
   * BUG FIX: Added guard against concurrent execution with disconnect()
   */
  private handleDisconnect(): void {
    // Prevent race condition with disconnect() method
    if (this.disconnecting) return;

    const wasConnected = this.connected;
    this.connected = false;
    this.ws = null;

    // Reject all pending requests - make a copy to avoid mutation during iteration
    const pendingCopy = Array.from(this.pendingRequests.entries());
    this.pendingRequests.clear();

    for (const [, pending] of pendingCopy) {
      clearTimeout(pending.timeout);
      // BUG FIX: Check if already resolved before rejecting
      if (!pending.resolved) {
        pending.resolved = true;
        pending.reject(new Error('Connection closed'));
      }
    }

    if (wasConnected) {
      // Don't log to console - would interfere with TUI
      this.emit('disconnected');
    }
  }

  /**
   * Handle incoming response
   * BUG FIX: Check if already resolved to prevent double-resolution race condition
   */
  private handleResponse(response: IPCResponse): void {
    const pending = this.pendingRequests.get(response.requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(response.requestId);
      // BUG FIX: Only resolve if not already resolved (e.g., by timeout)
      if (!pending.resolved) {
        pending.resolved = true;
        pending.resolve(response);
      }
    }
  }

  /**
   * Send diff preview and wait for approval
   * Returns true if approved, false if rejected or timeout
   */
  async requestDiffApproval(payload: DiffPayload): Promise<boolean> {
    if (!this.connected) {
      // Not connected to VS Code, auto-approve (CLI standalone mode)
      return true;
    }

    try {
      const response = await this.sendRequest({
        type: 'diff_preview',
        payload,
        requestId: this.generateRequestId()
      });

      return response.type === 'approved';
    } catch {
      // On error, fall back to auto-approve to not block the user
      return true;
    }
  }

  /**
   * Send task completion summary
   */
  async sendTaskComplete(payload: TaskSummaryPayload): Promise<void> {
    if (!this.connected) return;

    try {
      await this.sendRequest({
        type: 'task_complete',
        payload,
        requestId: this.generateRequestId()
      });
    } catch {
      // Task complete is fire-and-forget, don't throw
    }
  }

  /**
   * Send status update
   */
  sendStatusUpdate(status: string): void {
    if (!this.connected || !this.ws) return;

    const message: IPCMessage = {
      type: 'status_update',
      payload: { status },
      requestId: this.generateRequestId()
    };

    try {
      this.ws.send(JSON.stringify(message));
    } catch {
      // Status updates are fire-and-forget, silently ignore failures
    }
  }

  /**
   * Reveal/open a file in VS Code after it's been created or modified.
   * This is similar to how Claude Code shows files in the IDE after writing.
   */
  revealFile(file: string, operation: 'create' | 'edit', options?: { preview?: boolean; focus?: boolean }): void {
    if (!this.connected || !this.ws) return;

    const payload: FileRevealPayload = {
      file,
      operation,
      preview: options?.preview ?? true,
      focus: options?.focus ?? true,
    };

    const message: IPCMessage = {
      type: 'file_reveal',
      payload,
      requestId: this.generateRequestId()
    };

    try {
      this.ws.send(JSON.stringify(message));
    } catch {
      // File reveal is fire-and-forget, silently ignore failures
    }
  }

  /**
   * Send streaming chunk to VS Code extension
   * Used for real-time streaming in the chat panel
   */
  sendStreamChunk(payload: StreamChunkPayload): void {
    if (!this.connected || !this.ws) return;

    const message: IPCMessage = {
      type: 'stream_chunk',
      payload,
      requestId: this.generateRequestId()
    };

    try {
      this.ws.send(JSON.stringify(message));
    } catch {
      // Stream chunks are fire-and-forget, silently ignore failures
    }
  }

  /**
   * Create a streaming session and return a helper for sending chunks
   */
  createStreamSession(): StreamSession {
    const sessionId = `stream-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new StreamSession(this, sessionId);
  }

  /**
   * Send request and wait for response
   * BUG FIX: Use resolved flag to prevent race condition between timeout and actual response
   */
  private sendRequest(message: IPCMessage): Promise<IPCResponse> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }

      // BUG FIX: Create pending request object with resolved flag
      const pendingRequest: PendingRequest = {
        resolve,
        reject,
        timeout: null as unknown as NodeJS.Timeout,  // Will be set below
        resolved: false
      };

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.requestId);
        // BUG FIX: Only resolve if not already resolved by actual response
        if (!pendingRequest.resolved) {
          pendingRequest.resolved = true;
          // On timeout, auto-approve to not block forever
          resolve({ type: 'approved', requestId: message.requestId });
        }
      }, REQUEST_TIMEOUT);

      pendingRequest.timeout = timeout;
      this.pendingRequests.set(message.requestId, pendingRequest);

      try {
        this.ws.send(JSON.stringify(message));
      } catch {
        // Send failed - clean up and reject
        clearTimeout(timeout);
        this.pendingRequests.delete(message.requestId);
        // BUG FIX: Check resolved flag before rejecting
        if (!pendingRequest.resolved) {
          pendingRequest.resolved = true;
          reject(new Error('Failed to send message'));
        }
      }
    });
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${++this.requestCounter}`;
  }

  /**
   * Read port file to find server port
   */
  private readPortFile(): PortFileContent | null {
    try {
      if (!fs.existsSync(IPC_PORT_FILE)) {
        return null;
      }

      const content = fs.readFileSync(IPC_PORT_FILE, 'utf-8');
      const portInfo: PortFileContent = JSON.parse(content);

      // Check if the port file is stale (more than 1 hour old)
      const started = new Date(portInfo.started);
      const startedTime = started.getTime();
      // If date is invalid (NaN) or stale, reject the port file
      if (isNaN(startedTime)) {
        // Corrupted date string in port file
        return null;
      }
      const age = Date.now() - startedTime;
      if (age > 60 * 60 * 1000) {
        // Stale port file, extension may have crashed
        return null;
      }

      return portInfo;
    } catch {
      // Silently fail - port file may not exist or be corrupted
      return null;
    }
  }

  /**
   * Check if connected to VS Code extension
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Disconnect from server
   * BUG FIX: Use disconnecting flag to prevent race with handleDisconnect()
   */
  disconnect(): void {
    // Set flag to prevent handleDisconnect from running concurrently
    this.disconnecting = true;

    if (this.ws) {
      // BUG FIX: Remove all listeners before closing to prevent memory leak
      this.ws.removeAllListeners('open');
      this.ws.removeAllListeners('message');
      this.ws.removeAllListeners('close');
      this.ws.removeAllListeners('error');
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.connecting = false;

    // Clear pending request timeouts and reject - make copy to avoid mutation during iteration
    const pendingCopy = Array.from(this.pendingRequests.entries());
    this.pendingRequests.clear();

    for (const [, pending] of pendingCopy) {
      clearTimeout(pending.timeout);
      // BUG FIX: Check resolved flag before rejecting
      if (!pending.resolved) {
        pending.resolved = true;
        pending.reject(new Error('Disconnected'));
      }
    }

    // Reset flag after cleanup
    this.disconnecting = false;
  }

  /**
   * Ping server to check connection
   */
  async ping(): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const response = await this.sendRequest({
        type: 'ping',
        payload: null,
        requestId: this.generateRequestId()
      });
      return response.type === 'pong';
    } catch {
      return false;
    }
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }
}

/**
 * Helper class for sending streaming chunks with a consistent session ID
 */
export class StreamSession {
  constructor(
    private client: VSCodeIPCClient,
    public readonly sessionId: string
  ) {}

  /**
   * Send thinking/reasoning content
   */
  sendThinking(content: string): void {
    this.client.sendStreamChunk({
      sessionId: this.sessionId,
      type: 'thinking',
      content
    });
  }

  /**
   * Send response content
   */
  sendContent(content: string): void {
    this.client.sendStreamChunk({
      sessionId: this.sessionId,
      type: 'content',
      content
    });
  }

  /**
   * Send tool call notification
   */
  sendToolCall(id: string, name: string, args: string): void {
    this.client.sendStreamChunk({
      sessionId: this.sessionId,
      type: 'tool_call',
      toolCall: { id, name, arguments: args }
    });
  }

  /**
   * Send tool result
   */
  sendToolResult(id: string, result: string, isError: boolean = false): void {
    this.client.sendStreamChunk({
      sessionId: this.sessionId,
      type: 'tool_result',
      toolResult: { id, result, isError }
    });
  }

  /**
   * Send completion signal
   */
  sendDone(): void {
    this.client.sendStreamChunk({
      sessionId: this.sessionId,
      type: 'done'
    });
  }

  /**
   * Send error
   */
  sendError(error: string): void {
    this.client.sendStreamChunk({
      sessionId: this.sessionId,
      type: 'error',
      error
    });
  }
}

// Singleton instance
let instance: VSCodeIPCClient | null = null;

/**
 * Get or create the VS Code IPC client singleton
 */
export function getVSCodeIPCClient(): VSCodeIPCClient {
  if (!instance) {
    instance = new VSCodeIPCClient();
  }
  return instance;
}

/**
 * Cleanup the IPC client on process exit
 */
export function disposeVSCodeIPCClient(): void {
  if (instance) {
    instance.disconnect();
    instance = null;
  }
}
