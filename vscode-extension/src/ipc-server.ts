/**
 * IPC Server for VS Code Extension
 *
 * WebSocket server that enables bidirectional communication between
 * the AX CLI running in terminal and the VS Code extension.
 *
 * Protocol:
 * - CLI connects when it starts and detects extension is running
 * - CLI sends diff_preview events before file modifications
 * - Extension shows diff UI and sends approved/rejected response
 * - CLI sends task_complete events with summary data
 * - Extension shows summary popup
 */

import * as vscode from 'vscode';
import { WebSocketServer, WebSocket } from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';

// IPC Message Types
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

// Streaming message payloads
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

export interface ChatRequestPayload {
  sessionId: string;
  prompt: string;
  context?: {
    files?: string[];
    selection?: string;
    diagnostics?: string;
    extendedThinking?: boolean;
  };
}

// File reveal payload - opens files in VS Code after writing (like Claude Code)
export interface FileRevealPayload {
  file: string;
  operation: 'create' | 'edit';
  preview?: boolean;  // Open in preview mode (default: true)
  focus?: boolean;    // Focus the editor (default: true)
}

export interface IPCMessage {
  type: 'diff_preview' | 'task_complete' | 'status_update' | 'ping' | 'stream_chunk' | 'chat_request' | 'file_reveal';
  payload: DiffPayload | TaskSummaryPayload | StreamChunkPayload | ChatRequestPayload | FileRevealPayload | { status: string } | null;
  requestId: string;
}

export interface IPCResponse {
  type: 'approved' | 'rejected' | 'pong' | 'error' | 'chat_started';
  requestId: string;
  payload?: { reason?: string; sessionId?: string };
}

interface PortFileContent {
  port: number;
  pid: number;
  started: string;
  version: string;
}

const IPC_PORT_FILE = path.join(os.homedir(), '.ax-cli', 'vscode-ipc.json');
const EXTENSION_VERSION = '0.3.2';

export class IPCServer {
  private server: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private port: number = 0;
  private disposables: vscode.Disposable[] = [];

  // Handlers for different message types
  private diffPreviewHandler: ((payload: DiffPayload) => Promise<boolean>) | null = null;
  private taskCompleteHandler: ((payload: TaskSummaryPayload) => void) | null = null;
  private statusUpdateHandler: ((status: string) => void) | null = null;
  private streamChunkHandler: ((payload: StreamChunkPayload) => void) | null = null;
  private chatRequestHandler: ((payload: ChatRequestPayload) => Promise<string>) | null = null;
  private fileRevealHandler: ((payload: FileRevealPayload) => void) | null = null;

  constructor() {}

  /**
   * Start the IPC server
   */
  async start(): Promise<void> {
    try {
      // Find available port
      this.port = await this.findAvailablePort();

      // Create WebSocket server
      this.server = new WebSocketServer({ port: this.port });

      this.server.on('connection', (ws) => {
        console.log('[AX IPC] Client connected');
        this.clients.add(ws);

        ws.on('message', async (data) => {
          try {
            const message: IPCMessage = JSON.parse(data.toString());
            await this.handleMessage(ws, message);
          } catch (error) {
            console.error('[AX IPC] Error parsing message:', error);
            this.sendResponse(ws, {
              type: 'error',
              requestId: 'unknown',
              payload: { reason: 'Invalid message format' }
            });
          }
        });

        ws.on('close', () => {
          console.log('[AX IPC] Client disconnected');
          this.clients.delete(ws);
        });

        ws.on('error', (error) => {
          console.error('[AX IPC] WebSocket error:', error);
          this.clients.delete(ws);
        });
      });

      this.server.on('error', (error) => {
        console.error('[AX IPC] Server error:', error);
        vscode.window.showErrorMessage(`AX CLI IPC server error: ${error.message}`);
      });

      // Write port file for CLI discovery
      await this.writePortFile();

      console.log(`[AX IPC] Server started on port ${this.port}`);

    } catch (error) {
      console.error('[AX IPC] Failed to start server:', error);
      throw error;
    }
  }

  /**
   * Stop the IPC server
   */
  async stop(): Promise<void> {
    // Close all client connections
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();

    // Close server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    // Remove port file
    await this.removePortFile();

    console.log('[AX IPC] Server stopped');
  }

  /**
   * Handle incoming IPC message
   */
  private async handleMessage(ws: WebSocket, message: IPCMessage): Promise<void> {
    console.log(`[AX IPC] Received message: ${message.type}`);

    switch (message.type) {
      case 'ping':
        this.sendResponse(ws, {
          type: 'pong',
          requestId: message.requestId
        });
        break;

      case 'diff_preview':
        if (this.diffPreviewHandler && message.payload) {
          try {
            const approved = await this.diffPreviewHandler(message.payload as DiffPayload);
            this.sendResponse(ws, {
              type: approved ? 'approved' : 'rejected',
              requestId: message.requestId
            });
          } catch (error) {
            this.sendResponse(ws, {
              type: 'rejected',
              requestId: message.requestId,
              payload: { reason: `Error: ${error}` }
            });
          }
        } else {
          // No handler, auto-approve (for backwards compatibility)
          this.sendResponse(ws, {
            type: 'approved',
            requestId: message.requestId
          });
        }
        break;

      case 'task_complete':
        if (this.taskCompleteHandler && message.payload) {
          this.taskCompleteHandler(message.payload as TaskSummaryPayload);
        }
        // Acknowledge receipt
        this.sendResponse(ws, {
          type: 'pong',
          requestId: message.requestId
        });
        break;

      case 'status_update':
        if (this.statusUpdateHandler && message.payload) {
          const payload = message.payload as { status: string };
          this.statusUpdateHandler(payload.status);
        }
        // Acknowledge receipt (consistent with other message types)
        this.sendResponse(ws, {
          type: 'pong',
          requestId: message.requestId
        });
        break;

      case 'stream_chunk':
        // CLI is sending a streaming chunk
        if (this.streamChunkHandler && message.payload) {
          this.streamChunkHandler(message.payload as StreamChunkPayload);
        }
        // No response needed for stream chunks (fire-and-forget)
        break;

      case 'chat_request':
        // Extension is requesting a chat (sent TO CLI, not from CLI)
        // This is handled differently - see sendChatRequest method
        if (this.chatRequestHandler && message.payload) {
          try {
            const sessionId = await this.chatRequestHandler(message.payload as ChatRequestPayload);
            this.sendResponse(ws, {
              type: 'chat_started',
              requestId: message.requestId,
              payload: { sessionId }
            });
          } catch (error) {
            this.sendResponse(ws, {
              type: 'error',
              requestId: message.requestId,
              payload: { reason: `Error: ${error}` }
            });
          }
        }
        break;

      case 'file_reveal':
        // Open/reveal file in VS Code after it's been written
        if (this.fileRevealHandler && message.payload) {
          this.fileRevealHandler(message.payload as FileRevealPayload);
        }
        // No response needed (fire-and-forget)
        break;

      default:
        console.warn(`[AX IPC] Unknown message type: ${message.type}`);
    }
  }

  /**
   * Send response to client
   */
  private sendResponse(ws: WebSocket, response: IPCResponse): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(response));
      } catch (error) {
        // WebSocket may have closed between state check and send
        console.warn('[AX IPC] Failed to send response:', error);
        this.clients.delete(ws);
      }
    }
  }

  /**
   * Set handler for diff preview requests
   */
  setDiffPreviewHandler(handler: (payload: DiffPayload) => Promise<boolean>): void {
    this.diffPreviewHandler = handler;
  }

  /**
   * Set handler for task completion events
   */
  setTaskCompleteHandler(handler: (payload: TaskSummaryPayload) => void): void {
    this.taskCompleteHandler = handler;
  }

  /**
   * Set handler for status updates
   */
  setStatusUpdateHandler(handler: (status: string) => void): void {
    this.statusUpdateHandler = handler;
  }

  /**
   * Set handler for stream chunks from CLI
   */
  setStreamChunkHandler(handler: (payload: StreamChunkPayload) => void): void {
    this.streamChunkHandler = handler;
  }

  /**
   * Set handler for chat requests (extension -> CLI)
   */
  setChatRequestHandler(handler: (payload: ChatRequestPayload) => Promise<string>): void {
    this.chatRequestHandler = handler;
  }

  /**
   * Set handler for file reveal events (opens files in VS Code after write)
   */
  setFileRevealHandler(handler: (payload: FileRevealPayload) => void): void {
    this.fileRevealHandler = handler;
  }

  /**
   * Send a chat request to connected CLI
   * Returns sessionId if successful
   */
  async sendChatRequest(payload: ChatRequestPayload): Promise<string | null> {
    if (this.clients.size === 0) {
      return null;
    }

    // Send to first connected client (usually there's only one CLI)
    const client = this.clients.values().next().value;
    if (!client || client.readyState !== WebSocket.OPEN) {
      return null;
    }

    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return new Promise((resolve) => {
      // Listen for response
      const messageHandler = (data: Buffer) => {
        try {
          const response: IPCResponse = JSON.parse(data.toString());
          if (response.requestId === requestId) {
            clearTimeout(timeout);
            client.off('message', messageHandler);
            if (response.type === 'chat_started' && response.payload?.sessionId) {
              resolve(response.payload.sessionId);
            } else {
              resolve(null);
            }
          }
        } catch {
          // Ignore parse errors
        }
      };

      const timeout = setTimeout(() => {
        // Remove handler to prevent memory leak
        client.off('message', messageHandler);
        resolve(null);
      }, 5000);

      client.on('message', messageHandler);

      // Send the request
      const message: IPCMessage = {
        type: 'chat_request',
        payload,
        requestId
      };

      try {
        client.send(JSON.stringify(message));
      } catch {
        // Send failed - clean up handler and timeout to prevent memory leak
        clearTimeout(timeout);
        client.off('message', messageHandler);
        resolve(null);
      }
    });
  }

  /**
   * Find an available port
   */
  private findAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(0, () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          const port = address.port;
          server.close(() => resolve(port));
        } else {
          reject(new Error('Could not get port'));
        }
      });
      server.on('error', reject);
    });
  }

  /**
   * Write port file for CLI discovery
   */
  private async writePortFile(): Promise<void> {
    try {
      const dir = path.dirname(IPC_PORT_FILE);

      // Ensure directory exists
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const content: PortFileContent = {
        port: this.port,
        pid: process.pid,
        started: new Date().toISOString(),
        version: EXTENSION_VERSION
      };

      fs.writeFileSync(IPC_PORT_FILE, JSON.stringify(content, null, 2));
      console.log(`[AX IPC] Port file written: ${IPC_PORT_FILE}`);
    } catch (error) {
      // Log error but don't throw - server can still work without port file
      // CLI will fall back to other discovery methods
      console.error('[AX IPC] Failed to write port file:', error);
      vscode.window.showWarningMessage(
        'AX CLI: Failed to write IPC port file. Terminal integration may not work.'
      );
    }
  }

  /**
   * Remove port file on shutdown
   */
  private async removePortFile(): Promise<void> {
    try {
      if (fs.existsSync(IPC_PORT_FILE)) {
        fs.unlinkSync(IPC_PORT_FILE);
        console.log('[AX IPC] Port file removed');
      }
    } catch (error) {
      console.warn('[AX IPC] Failed to remove port file:', error);
    }
  }

  /**
   * Get server port
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null;
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    // Synchronously close connections and clean up
    // We can't await in dispose, so do cleanup synchronously
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();

    if (this.server) {
      this.server.close();
      this.server = null;
    }

    // Remove port file synchronously
    try {
      if (fs.existsSync(IPC_PORT_FILE)) {
        fs.unlinkSync(IPC_PORT_FILE);
      }
    } catch {
      // Ignore cleanup errors
    }

    this.disposables.forEach(d => d.dispose());
  }
}
