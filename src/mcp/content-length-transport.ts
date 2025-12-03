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
   */
  async start(): Promise<void> {
    if (this._started) {
      throw new Error("Transport already started");
    }
    this._started = true;

    return new Promise((resolve, reject) => {
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
          reject(error);
        });

        this.process.on("spawn", () => {
          resolve();
        });

        this.process.on("close", (code) => {
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
        reject(error);
      }
    });
  }

  /**
   * Handle incoming data with Content-Length framing
   */
  private handleData(chunk: Buffer): void {
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
   */
  private readMessage(): unknown | null {
    // Look for Content-Length header
    const headerEnd = this.buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return null;

    // Parse headers
    const headerSection = this.buffer.toString("utf8", 0, headerEnd);
    const contentLengthMatch = headerSection.match(/Content-Length:\s*(\d+)/i);

    if (!contentLengthMatch) {
      // Invalid format - try to find next message
      this.buffer = this.buffer.subarray(headerEnd + 4);
      return null;
    }

    const contentLength = parseInt(contentLengthMatch[1], 10);
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
   * Send a message with Content-Length framing
   * BUG FIX: Only resolve when write callback completes, not when write() returns true
   * This ensures the message was actually transmitted, not just buffered
   */
  send(message: JSONRPCMessage): Promise<void> {
    return new Promise((resolve, reject) => {
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
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = undefined;
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
}

/**
 * Factory function to create Content-Length transport
 */
export function createContentLengthTransport(config: ContentLengthStdioConfig): ContentLengthStdioTransport {
  return new ContentLengthStdioTransport(config);
}
