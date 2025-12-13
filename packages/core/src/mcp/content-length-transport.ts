/**
 * Content-Length framing transport for MCP SDK
 *
 * The MCP SDK uses NDJSON (newline-delimited JSON) format by default,
 * but some MCP servers (like AutomatosX) use Content-Length framing
 * (similar to LSP - Language Server Protocol).
 *
 * This transport wrapper converts between the two formats:
 * - Outgoing: Wraps JSON messages with Content-Length headers
 * - Incoming: Parses Content-Length framed messages
 */

import { spawn, ChildProcess } from "child_process";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage, JSONRPCMessageSchema } from "@modelcontextprotocol/sdk/types.js";
import { EventEmitter } from "events";
import { MCP_TIMEOUTS, MCP_LIMITS } from "./constants.js";

/**
 * Configuration for the Content-Length stdio transport
 */
export interface ContentLengthStdioConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  /** Suppress stderr output from the MCP server (hides INFO/DEBUG logs) */
  quiet?: boolean;
  /** Timeout in ms for the process to start (default: 30000) */
  startupTimeout?: number;
  /** Maximum buffer size in bytes (default: 100MB) - protects against memory exhaustion */
  maxBufferSize?: number;
}

/**
 * Stdio transport that uses Content-Length framing instead of NDJSON.
 *
 * Message format:
 * ```
 * Content-Length: <byte-length>\r\n
 * \r\n
 * <JSON-RPC message>
 * ```
 */
export class ContentLengthStdioTransport extends EventEmitter implements Transport {
  private process?: ChildProcess;
  private buffer: Buffer = Buffer.alloc(0);
  private config: ContentLengthStdioConfig;
  private _started = false;

  // Transport callbacks (required by Transport interface)
  onmessage?: (message: JSONRPCMessage) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;

  constructor(config: ContentLengthStdioConfig) {
    super();
    this.config = config;
  }

  /**
   * Start the transport (spawn the subprocess)
   * Includes startup timeout to prevent hanging on slow npx/npm commands
   */
  async start(): Promise<void> {
    if (this._started) {
      throw new Error("Transport already started");
    }
    this._started = true;

    const startupTimeout = this.config.startupTimeout ?? MCP_TIMEOUTS.STARTUP;

    const startupPromise = new Promise<void>((resolve, reject) => {
      let resolved = false;
      let timeoutId: NodeJS.Timeout | undefined;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
      };

      const handleResolve = () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve();
      };

      const handleReject = (error: Error) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        // Kill the process if it was spawned but timed out
        if (this.process && !this.process.killed) {
          try {
            this.process.kill();
          } catch {
            // Ignore kill errors
          }
        }
        reject(error);
      };

      // Set up startup timeout
      timeoutId = setTimeout(() => {
        handleReject(new Error(`Process startup timeout after ${startupTimeout}ms: ${this.config.command}`));
      }, startupTimeout);

      try {
        // Use "pipe" for stderr in quiet mode to suppress INFO/DEBUG logs
        // Use "inherit" otherwise to show all output (default behavior)
        const stderrOption = this.config.quiet ? "pipe" : "inherit";

        this.process = spawn(this.config.command, this.config.args || [], {
          stdio: ["pipe", "pipe", stderrOption],
          env: {
            ...process.env,
            ...this.config.env,
          },
          cwd: this.config.cwd,
        });

        this.process.on("error", (error) => {
          this.onerror?.(error);
          handleReject(error);
        });

        this.process.on("spawn", () => {
          handleResolve();
        });

        this.process.on("close", (code) => {
          // If process exits before spawn event, reject
          if (!resolved) {
            handleReject(new Error(`Process exited with code ${code} before starting`));
          }
          this.onclose?.();
          this.emit("close", code);
        });

        this.process.stdout?.on("data", (chunk: Buffer) => {
          this.handleData(chunk);
        });

        this.process.stdout?.on("error", (error) => {
          this.onerror?.(error);
        });

        this.process.stdin?.on("error", (error) => {
          this.onerror?.(error);
        });

      } catch (error) {
        handleReject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    // Attach catch to avoid unhandled rejections when callers forget to await
    startupPromise.catch((error) => {
      this.onerror?.(error instanceof Error ? error : new Error(String(error)));
    });

    return startupPromise;
  }

  /**
   * Handle incoming data with Content-Length framing
   */
  private handleData(chunk: Buffer): void {
    const maxBufferSize = this.config.maxBufferSize ?? MCP_LIMITS.MAX_BUFFER_SIZE;

    // BUG FIX: Check buffer size limit before appending to prevent memory exhaustion
    if (this.buffer.length + chunk.length > maxBufferSize) {
      this.onerror?.(new Error(
        `Buffer size limit exceeded (${maxBufferSize} bytes). ` +
        `This may indicate a malformed message or malicious server.`
      ));
      // Reset buffer to recover
      this.buffer = Buffer.alloc(0);
      return;
    }

    // Append to buffer
    this.buffer = Buffer.concat([this.buffer, chunk]);

    // Process all complete messages in buffer
    while (true) {
      const message = this.readMessage();
      if (!message) break;

      try {
        // Validate and emit message
        const parsed = JSONRPCMessageSchema.parse(message);
        this.onmessage?.(parsed);
      } catch (error) {
        this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  /**
   * Read a single Content-Length framed message from buffer
   *
   * BUG FIX: Now supports both Content-Length framing (LSP-style) and NDJSON fallback.
   * This handles community MCP servers that don't implement proper JSON-RPC 2.0 stdio spec.
   *
   * Supported formats:
   * 1. Content-Length framing: `Content-Length: N\r\n\r\n{...json...}`
   * 2. NDJSON fallback: `{...json...}\n` (newline-delimited JSON)
   */
  private readMessage(): unknown | null {
    // Skip any leading whitespace/newlines (common in NDJSON streams)
    while (this.buffer.length > 0) {
      const firstByte = this.buffer[0];
      // Skip whitespace: space (32), tab (9), CR (13), LF (10)
      if (firstByte === 32 || firstByte === 9 || firstByte === 13 || firstByte === 10) {
        this.buffer = this.buffer.subarray(1);
      } else {
        break;
      }
    }

    if (this.buffer.length === 0) {
      return null;
    }

    // Check if this looks like Content-Length framing or raw JSON
    const bufferStr = this.buffer.toString("utf8", 0, Math.min(50, this.buffer.length));
    const startsWithContentLength = /^Content-Length:\s*\d+/i.test(bufferStr);
    const startsWithJson = bufferStr.trimStart().startsWith("{");

    if (startsWithContentLength) {
      // Content-Length framing (LSP-style)
      return this.readContentLengthMessage();
    } else if (startsWithJson) {
      // NDJSON fallback - try to parse as newline-delimited JSON
      return this.readNdjsonMessage();
    } else {
      // Unknown format - skip until we find something parseable
      // Look for either Content-Length or { character
      const nextContentLength = this.buffer.indexOf("Content-Length:");
      const nextJsonStart = this.buffer.indexOf("{");

      let skipTo = -1;
      if (nextContentLength >= 0 && nextJsonStart >= 0) {
        skipTo = Math.min(nextContentLength, nextJsonStart);
      } else if (nextContentLength >= 0) {
        skipTo = nextContentLength;
      } else if (nextJsonStart >= 0) {
        skipTo = nextJsonStart;
      }

      // BUG FIX: Changed from > 0 to >= 0 to handle case where valid message
      // is at position 0. When indexOf returns 0, we should NOT clear the buffer.
      if (skipTo >= 0) {
        // Skip to the next potentially valid message
        this.buffer = this.buffer.subarray(skipTo);
        return null; // Caller will retry
      } else {
        // No valid message found (skipTo is -1) - clear buffer (corrupted data)
        this.buffer = Buffer.alloc(0);
        return null;
      }
    }
  }

  /**
   * Read a Content-Length framed message (LSP-style)
   */
  private readContentLengthMessage(): unknown | null {
    const headerEnd = this.buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return null;

    // Parse headers
    const headerSection = this.buffer.toString("utf8", 0, headerEnd);
    const contentLengthMatch = headerSection.match(/Content-Length:\s*(\d+)/i);

    if (!contentLengthMatch) {
      // Invalid format - skip header section
      this.buffer = this.buffer.subarray(headerEnd + 4);
      return null;
    }

    const contentLength = parseInt(contentLengthMatch[1], 10);

    // Validate content-length is a reasonable positive number
    const maxBufferSize = this.config.maxBufferSize ?? MCP_LIMITS.MAX_BUFFER_SIZE;
    if (isNaN(contentLength) || contentLength < 0 || contentLength > maxBufferSize) {
      // Invalid content-length - skip this message
      this.buffer = this.buffer.subarray(headerEnd + 4);
      return null;
    }

    const messageStart = headerEnd + 4; // Skip \r\n\r\n
    const messageEnd = messageStart + contentLength;

    // Check if we have the complete message
    if (this.buffer.length < messageEnd) {
      return null; // Wait for more data
    }

    // Extract message
    const messageBuffer = this.buffer.subarray(messageStart, messageEnd);
    const messageStr = messageBuffer.toString("utf8");

    // Remove processed data from buffer
    this.buffer = this.buffer.subarray(messageEnd);

    try {
      return JSON.parse(messageStr);
    } catch {
      return null;
    }
  }

  /**
   * Read a NDJSON (newline-delimited JSON) message
   *
   * BUG FIX: Fallback for MCP servers that don't use Content-Length framing
   * (e.g., community mcp-figma package)
   */
  private readNdjsonMessage(): unknown | null {
    // Find end of JSON object by looking for newline after complete JSON
    // We need to handle nested braces properly
    const bufferStr = this.buffer.toString("utf8");

    let braceCount = 0;
    let inString = false;
    let escaped = false;
    let endIndex = -1;

    for (let i = 0; i < bufferStr.length; i++) {
      const char = bufferStr[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\' && inString) {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }

    if (endIndex === -1) {
      return null; // Incomplete JSON - wait for more data
    }

    const jsonStr = bufferStr.substring(0, endIndex);

    // Remove processed data from buffer
    this.buffer = this.buffer.subarray(Buffer.byteLength(jsonStr, "utf8"));

    try {
      return JSON.parse(jsonStr);
    } catch {
      // JSON parse error - skip this malformed message
      return null;
    }
  }

  /**
   * Send a message with Content-Length framing
   * BUG FIX: Only resolve when write callback completes, not when write() returns true
   * This ensures the message was actually transmitted, not just buffered
   */
  send(message: JSONRPCMessage): Promise<void> {
    const writePromise = new Promise<void>((resolve, reject) => {
      if (!this.process?.stdin?.writable) {
        reject(new Error("Not connected"));
        return;
      }

      // Serialize message
      const body = JSON.stringify(message);
      const contentLength = Buffer.byteLength(body, "utf8");

      // Format with Content-Length header
      const framed = `Content-Length: ${contentLength}\r\n\r\n${body}`;

      // BUG FIX: Track if already resolved to prevent double-resolution
      let resolved = false;

      // Write to stdin - only resolve on callback completion
      this.process.stdin.write(framed, (error) => {
        if (resolved) return;  // Prevent double-resolution
        resolved = true;
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
      // BUG FIX: Removed early resolve on success=true
      // The callback ensures the write completed, not just that it was buffered
    });

    // Report send failures even if caller forgets to await
    writePromise.catch((error) => {
      this.onerror?.(error instanceof Error ? error : new Error(String(error)));
    });

    return writePromise;
  }

  /**
   * Close the transport
   *
   * BUG FIX: Now properly waits for process to terminate before resolving.
   * This prevents resource leaks and zombie processes.
   */
  async close(): Promise<void> {
    if (this.process) {
      const proc = this.process;
      this.process = undefined;

      // BUG FIX: Wait for the process to actually exit, not just send kill signal
      await new Promise<void>((resolve) => {
        // Set up close handler first
        const onClose = () => {
          clearTimeout(forceKillTimeout);
          resolve();
        };

        // If already exited, resolve immediately
        if (proc.exitCode !== null || proc.killed) {
          resolve();
          return;
        }

        proc.once('close', onClose);
        proc.once('exit', onClose);

        // Send SIGTERM first for graceful shutdown
        proc.kill('SIGTERM');

        // Force kill after 5 seconds if process doesn't exit
        const forceKillTimeout = setTimeout(() => {
          try {
            proc.kill('SIGKILL');
          } catch {
            // Process may have already exited
          }
          // Resolve anyway after force kill attempt
          setTimeout(resolve, 100);
        }, 5000);
      });
    }
    this.buffer = Buffer.alloc(0);
    this._started = false;
  }

  /**
   * Get the process ID
   */
  get pid(): number | undefined {
    return this.process?.pid;
  }

  /**
   * Clean up resources and remove all event listeners.
   * Required for EventEmitter-extending classes to prevent memory leaks.
   */
  destroy(): void {
    this.removeAllListeners();
  }
}

/**
 * Factory function to create Content-Length transport
 */
export function createContentLengthTransport(config: ContentLengthStdioConfig): ContentLengthStdioTransport {
  return new ContentLengthStdioTransport(config);
}
