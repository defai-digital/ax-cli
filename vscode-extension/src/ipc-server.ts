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
import * as net from 'net';
import { generateId, getAppConfigDir } from './utils.js';
import * as crypto from 'crypto';
import {
  EXTENSION_VERSION,
  DIFF_PREVIEW_TIMEOUT_MS,
  CHAT_REQUEST_TIMEOUT_MS,
  IPC_RESPONSE_TIMEOUT_MS,
  WS_CLOSE_AUTH_FAILED,
  WS_CLOSE_NORMAL,
  MAX_IPC_CONTENT_LENGTH,
  MAX_IPC_PATH_LENGTH,
  MAX_IPC_PROMPT_LENGTH
} from './constants.js';

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
    // Image attachments with base64 data for vision models
    images?: Array<{
      path: string;
      name: string;
      dataUri?: string;  // Base64 encoded image data
      mimeType?: string;
    }>;
  };
}

// File reveal payload - opens files in VS Code after writing (like Claude Code)
export interface FileRevealPayload {
  file: string;
  operation: 'create' | 'edit';
  preview?: boolean;  // Open in preview mode (default: true)
  focus?: boolean;    // Focus the editor (default: true)
}

// Authentication payload for secure IPC
export interface AuthenticatePayload {
  nonce: string;
}

export interface IPCMessage {
  type: 'authenticate' | 'diff_preview' | 'task_complete' | 'status_update' | 'ping' | 'stream_chunk' | 'chat_request' | 'file_reveal';
  payload: AuthenticatePayload | DiffPayload | TaskSummaryPayload | StreamChunkPayload | ChatRequestPayload | FileRevealPayload | { status: string } | null;
  requestId: string;
}

export interface IPCResponse {
  type: 'approved' | 'rejected' | 'pong' | 'error' | 'chat_started' | 'authenticated' | 'auth_required';
  requestId: string;
  payload?: { reason?: string; sessionId?: string };
}

interface PortFileContent {
  port: number;
  pid: number;
  started: string;
  version: string;
  nonce: string;  // Authentication token - client must send this to authenticate
}

const IPC_PORT_FILE = path.join(getAppConfigDir(), 'vscode-ipc.json');

/**
 * Validate DiffPayload structure and field types
 */
function validateDiffPayload(payload: unknown): payload is DiffPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;

  return (
    typeof p.file === 'string' && p.file.length <= MAX_IPC_PATH_LENGTH &&
    typeof p.oldContent === 'string' && p.oldContent.length <= MAX_IPC_CONTENT_LENGTH &&
    typeof p.newContent === 'string' && p.newContent.length <= MAX_IPC_CONTENT_LENGTH &&
    ['create', 'edit', 'delete'].includes(p.operation as string) &&
    (p.lineStart === undefined || typeof p.lineStart === 'number') &&
    (p.lineEnd === undefined || typeof p.lineEnd === 'number') &&
    p.toolCall !== null && typeof p.toolCall === 'object'
  );
}

/**
 * Validate ChatRequestPayload structure and field types
 */
function validateChatRequestPayload(payload: unknown): payload is ChatRequestPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;

  if (typeof p.sessionId !== 'string' || typeof p.prompt !== 'string') return false;
  if (p.prompt.length > MAX_IPC_PROMPT_LENGTH) return false;

  if (p.context !== undefined) {
    if (typeof p.context !== 'object' || p.context === null) return false;
    const ctx = p.context as Record<string, unknown>;

    // Validate files array if present
    if (ctx.files !== undefined) {
      if (!Array.isArray(ctx.files)) return false;
      if (!ctx.files.every((f: unknown) => typeof f === 'string' && f.length <= MAX_IPC_PATH_LENGTH)) return false;
    }
  }

  return true;
}

/**
 * Validate FileRevealPayload structure and field types
 */
function validateFileRevealPayload(payload: unknown): payload is FileRevealPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;

  return (
    typeof p.file === 'string' && p.file.length <= MAX_IPC_PATH_LENGTH &&
    ['create', 'edit'].includes(p.operation as string) &&
    (p.preview === undefined || typeof p.preview === 'boolean') &&
    (p.focus === undefined || typeof p.focus === 'boolean')
  );
}

/**
 * Validate StreamChunkPayload structure and field types
 */
function validateStreamChunkPayload(payload: unknown): payload is StreamChunkPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;

  const validTypes = ['thinking', 'content', 'tool_call', 'tool_result', 'done', 'error'];
  return (
    typeof p.sessionId === 'string' &&
    validTypes.includes(p.type as string) &&
    (p.content === undefined || typeof p.content === 'string')
  );
}

export class IPCServer {
  private server: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private authenticatedClients: Set<WebSocket> = new Set();  // Only authenticated clients can send commands
  private port: number = 0;
  private nonce: string = '';  // Authentication token
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

      // Generate cryptographic nonce for authentication
      this.nonce = crypto.randomBytes(32).toString('hex');

      // Create WebSocket server
      this.server = new WebSocketServer({ port: this.port });

      this.server.on('connection', (ws) => {
        console.log('[AX IPC] Client connected (awaiting authentication)');
        this.clients.add(ws);

        // Send auth_required message to prompt client to authenticate
        this.sendResponse(ws, {
          type: 'auth_required',
          requestId: 'auth',
          payload: { reason: 'Authentication required. Send authenticate message with nonce.' }
        });

        ws.on('message', async (data) => {
          try {
            const message: IPCMessage = JSON.parse(data.toString());

            // Handle authentication first
            if (message.type === 'authenticate') {
              await this.handleAuthentication(ws, message);
              return;
            }

            // Require authentication for all other messages
            if (!this.authenticatedClients.has(ws)) {
              console.warn('[AX IPC] Rejecting message from unauthenticated client');
              this.sendResponse(ws, {
                type: 'error',
                requestId: message.requestId,
                payload: { reason: 'Not authenticated. Send authenticate message first.' }
              });
              return;
            }

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
          this.authenticatedClients.delete(ws);
        });

        ws.on('error', (error) => {
          console.error('[AX IPC] WebSocket error:', error);
          this.clients.delete(ws);
          this.authenticatedClients.delete(ws);
        });
      });

      this.server.on('error', (error) => {
        console.error('[AX IPC] Server error:', error);
        vscode.window.showErrorMessage(`AX CLI IPC server error: ${error.message}`);
      });

      // Write port file for CLI discovery (includes nonce)
      await this.writePortFile();

      console.log(`[AX IPC] Server started on port ${this.port}`);

    } catch (error) {
      console.error('[AX IPC] Failed to start server:', error);
      throw error;
    }
  }

  /**
   * Handle authentication message
   */
  private async handleAuthentication(ws: WebSocket, message: IPCMessage): Promise<void> {
    const payload = message.payload as AuthenticatePayload;

    // Strict type validation - nonce must be a non-empty string
    if (!payload || typeof payload.nonce !== 'string' || payload.nonce.length === 0) {
      console.warn('[AX IPC] Authentication rejected: invalid or missing nonce');
      this.sendResponse(ws, {
        type: 'error',
        requestId: message.requestId,
        payload: { reason: 'Missing or invalid nonce in authentication payload' }
      });
      ws.close(WS_CLOSE_AUTH_FAILED, 'Invalid authentication payload');
      return;
    }

    // Validate nonce format - must be hex string of expected length (64 chars = 32 bytes)
    if (!/^[a-f0-9]{64}$/i.test(payload.nonce)) {
      console.warn('[AX IPC] Authentication rejected: malformed nonce');
      this.sendResponse(ws, {
        type: 'error',
        requestId: message.requestId,
        payload: { reason: 'Malformed nonce' }
      });
      ws.close(WS_CLOSE_AUTH_FAILED, 'Invalid nonce format');
      return;
    }

    // Use timing-safe comparison to prevent timing attacks
    const nonceBuffer = Buffer.from(this.nonce, 'hex');
    const providedBuffer = Buffer.from(payload.nonce, 'hex');

    if (nonceBuffer.length !== providedBuffer.length ||
        !crypto.timingSafeEqual(nonceBuffer, providedBuffer)) {
      console.warn('[AX IPC] Authentication failed: invalid nonce');
      this.sendResponse(ws, {
        type: 'error',
        requestId: message.requestId,
        payload: { reason: 'Invalid nonce' }
      });
      // Close connection after failed auth attempt
      ws.close(WS_CLOSE_AUTH_FAILED, 'Authentication failed');
      return;
    }

    // Authentication successful
    this.authenticatedClients.add(ws);
    console.log('[AX IPC] Client authenticated successfully');
    this.sendResponse(ws, {
      type: 'authenticated',
      requestId: message.requestId
    });
  }

  /**
   * Stop the IPC server
   */
  async stop(): Promise<void> {
    // Close all client connections - convert to array first to avoid
    // modifying Set during iteration
    const clientsToClose = Array.from(this.clients);
    for (const client of clientsToClose) {
      try {
        client.close(WS_CLOSE_NORMAL, 'Server shutting down');
      } catch (error) {
        console.warn('[AX IPC] Error closing client:', error);
      }
    }
    this.clients.clear();
    this.authenticatedClients.clear();

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
          // Validate payload structure before processing
          if (!validateDiffPayload(message.payload)) {
            console.warn('[AX IPC] Invalid diff_preview payload');
            this.sendResponse(ws, {
              type: 'rejected',
              requestId: message.requestId,
              payload: { reason: 'Invalid payload structure' }
            });
            break;
          }

          // Add timeout to prevent hanging indefinitely if handler never resolves
          let timeoutId: ReturnType<typeof setTimeout> | undefined;
          try {
            const timeoutPromise = new Promise<boolean>((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error('Diff preview timed out')), DIFF_PREVIEW_TIMEOUT_MS);
            });
            const approved = await Promise.race([
              this.diffPreviewHandler(message.payload),
              timeoutPromise
            ]);
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
          } finally {
            // Always clear the timeout to prevent memory leak
            if (timeoutId !== undefined) {
              clearTimeout(timeoutId);
            }
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
          // Validate payload structure
          if (!validateStreamChunkPayload(message.payload)) {
            console.warn('[AX IPC] Invalid stream_chunk payload, ignoring');
            break;
          }
          this.streamChunkHandler(message.payload);
        }
        // No response needed for stream chunks (fire-and-forget)
        break;

      case 'chat_request':
        // Extension is requesting a chat (sent TO CLI, not from CLI)
        // This is handled differently - see sendChatRequest method
        if (this.chatRequestHandler && message.payload) {
          // Validate payload structure before processing
          if (!validateChatRequestPayload(message.payload)) {
            console.warn('[AX IPC] Invalid chat_request payload');
            this.sendResponse(ws, {
              type: 'error',
              requestId: message.requestId,
              payload: { reason: 'Invalid payload structure' }
            });
            break;
          }

          // Add timeout to prevent hanging if chat handler never resolves
          let timeoutId: ReturnType<typeof setTimeout> | undefined;
          try {
            const timeoutPromise = new Promise<string>((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error('Chat request timed out')), CHAT_REQUEST_TIMEOUT_MS);
            });
            const sessionId = await Promise.race([
              this.chatRequestHandler(message.payload),
              timeoutPromise
            ]);
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
          } finally {
            // Always clear the timeout to prevent memory leak
            if (timeoutId !== undefined) {
              clearTimeout(timeoutId);
            }
          }
        }
        break;

      case 'file_reveal':
        // Open/reveal file in VS Code after it's been written
        if (this.fileRevealHandler && message.payload) {
          // Validate payload structure
          if (!validateFileRevealPayload(message.payload)) {
            console.warn('[AX IPC] Invalid file_reveal payload, ignoring');
            break;
          }
          this.fileRevealHandler(message.payload);
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
    // Only send to authenticated clients
    if (this.authenticatedClients.size === 0) {
      return null;
    }

    // Send to first authenticated client (usually there's only one CLI)
    // Use explicit undefined check for type safety
    const clientIterator = this.authenticatedClients.values().next();
    const client: WebSocket | undefined = clientIterator.value;
    if (client === undefined || client.readyState !== WebSocket.OPEN) {
      return null;
    }

    const requestId = generateId('chat');

    return new Promise((resolve) => {
      let resolved = false;

      // Cleanup function to remove all handlers
      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          client.off('message', messageHandler);
          client.off('close', closeHandler);
          client.off('error', errorHandler);
        }
      };

      // Listen for response - use on() not once() because we need to handle
      // multiple messages until we find the one matching our requestId
      const messageHandler = (data: Buffer) => {
        try {
          const response: IPCResponse = JSON.parse(data.toString());
          if (response.requestId === requestId) {
            cleanup();
            if (response.type === 'chat_started' && response.payload?.sessionId) {
              resolve(response.payload.sessionId);
            } else {
              resolve(null);
            }
          }
          // If requestId doesn't match, keep listening for more messages
        } catch {
          // Ignore parse errors, keep listening
        }
      };

      // Handle client disconnect - prevents memory leak
      const closeHandler = () => {
        cleanup();
        resolve(null);
      };

      // Handle client errors
      const errorHandler = () => {
        cleanup();
        resolve(null);
      };

      const timeout = setTimeout(() => {
        cleanup();
        resolve(null);
      }, IPC_RESPONSE_TIMEOUT_MS);

      // Use on() for message handler to receive multiple messages until match
      // Use once() for close/error since they're terminal events
      client.on('message', messageHandler);
      client.once('close', closeHandler);
      client.once('error', errorHandler);

      // Send the request
      const message: IPCMessage = {
        type: 'chat_request',
        payload,
        requestId
      };

      try {
        client.send(JSON.stringify(message));
      } catch {
        // Send failed - clean up handlers
        cleanup();
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
   * Write port file for CLI discovery using atomic write pattern
   * Uses write-to-temp-then-rename to prevent race conditions and symlink attacks
   */
  private async writePortFile(): Promise<void> {
    try {
      const dir = path.dirname(IPC_PORT_FILE);

      // Ensure directory exists with restrictive permissions
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }

      // Security: Check if existing file is a symlink (potential attack)
      if (fs.existsSync(IPC_PORT_FILE)) {
        const stats = fs.lstatSync(IPC_PORT_FILE);
        if (stats.isSymbolicLink()) {
          console.error('[AX IPC] Port file is a symlink - potential security issue, removing');
          fs.unlinkSync(IPC_PORT_FILE);
        }
      }

      const content: PortFileContent = {
        port: this.port,
        pid: process.pid,
        started: new Date().toISOString(),
        version: EXTENSION_VERSION,
        nonce: this.nonce  // Include nonce for authentication
      };

      // Atomic write: write to temp file first, then rename
      // This prevents race conditions where another process reads partial content
      const tempFile = `${IPC_PORT_FILE}.${process.pid}.tmp`;

      // Write to temp file with restrictive permissions
      fs.writeFileSync(tempFile, JSON.stringify(content, null, 2), { mode: 0o600 });

      // Atomic rename (on POSIX systems, rename is atomic)
      fs.renameSync(tempFile, IPC_PORT_FILE);

      // Verify permissions after write (defense in depth)
      fs.chmodSync(IPC_PORT_FILE, 0o600);

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
    // Return count of authenticated clients only
    return this.authenticatedClients.size;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    // Synchronously close connections and clean up
    // We can't await in dispose, so do cleanup synchronously
    // Convert to array first to avoid modifying Set during iteration
    // (close() triggers 'close' event which may modify the Set)
    const clientsToClose = Array.from(this.clients);
    for (const client of clientsToClose) {
      client.close();
    }
    this.clients.clear();
    this.authenticatedClients.clear();

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
