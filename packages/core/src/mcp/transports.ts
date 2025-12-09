import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport as SDKStreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport as SDKSSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { EventEmitter } from "events";
import { ContentLengthStdioTransport } from "./content-length-transport.js";

export type TransportType = 'stdio' | 'http' | 'sse' | 'streamable_http';

/**
 * Framing protocol for stdio transport.
 * - 'ndjson': Newline-delimited JSON (MCP SDK default)
 * - 'content-length': Content-Length header framing (LSP-style, used by AutomatosX)
 */
export type StdioFraming = 'ndjson' | 'content-length';

export interface TransportConfig {
  type: TransportType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  /** Framing protocol for stdio (default: 'content-length' for better compatibility) */
  framing?: StdioFraming;
  /** Suppress stderr output from the MCP server (hides INFO/DEBUG logs) */
  quiet?: boolean;
}

export interface MCPTransport {
  connect(): Promise<Transport>;
  disconnect(): Promise<void>;
  getType(): TransportType;
}

export class StdioTransport implements MCPTransport {
  private transport?: StdioClientTransport | ContentLengthStdioTransport;
  private command: string;
  private args: string[];
  private env?: Record<string, string>;
  private framing: StdioFraming;
  private quiet: boolean;

  constructor(config: TransportConfig) {
    if (!config.command) {
      throw new Error('Command is required for stdio transport');
    }
    this.command = config.command;
    this.args = config.args || [];
    this.env = config.env;
    // Default to content-length for better compatibility with servers like AutomatosX
    this.framing = config.framing || 'content-length';
    // Suppress stderr output if quiet mode is enabled
    this.quiet = config.quiet ?? false;
  }

  async connect(): Promise<Transport> {
    // Create transport with environment variables to suppress verbose output
    const env = {
      ...process.env,
      ...this.env,
      // Try to suppress verbose output from mcp-remote
      MCP_REMOTE_QUIET: '1',
      MCP_REMOTE_SILENT: '1',
      DEBUG: '',
      NODE_ENV: 'production'
    };

    if (this.framing === 'content-length') {
      // Use Content-Length framing (LSP-style) for better compatibility
      this.transport = new ContentLengthStdioTransport({
        command: this.command,
        args: this.args,
        env,
        quiet: this.quiet
      });
      // ContentLengthStdioTransport implements Transport directly
      return this.transport as Transport;
    } else {
      // Use NDJSON framing (MCP SDK default)
      // Note: StdioClientTransport from MCP SDK doesn't support quiet mode directly
      // stderr is controlled by the SDK internals
      this.transport = new StdioClientTransport({
        command: this.command,
        args: this.args,
        env,
        // MCP SDK's StdioClientTransport handles stderr internally
        // Setting stderr: 'pipe' would suppress output
        ...(this.quiet ? { stderr: 'pipe' as const } : {})
      });
      return this.transport;
    }
  }

  async disconnect(): Promise<void> {
    // Handle transport cleanup with error handling to ensure process cleanup runs
    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        console.warn('Error closing stdio transport:', error);
      } finally {
        this.transport = undefined;
      }
    }
  }

  getType(): TransportType {
    return 'stdio';
  }
}

export class HttpTransport extends EventEmitter implements MCPTransport {
  private transport?: SDKStreamableHTTPClientTransport;
  private url: string;
  private headers?: Record<string, string>;

  constructor(config: TransportConfig) {
    super();
    if (!config.url) {
      throw new Error('URL is required for HTTP transport');
    }
    this.url = config.url;
    this.headers = config.headers;
  }

  async connect(): Promise<Transport> {
    // Use MCP SDK's StreamableHTTPClientTransport for proper MCP protocol support
    // MCP Streamable HTTP requires Accept header with both application/json and text/event-stream
    // See: https://spec.modelcontextprotocol.io/specification/basic/transports/#streamable-http
    const mergedHeaders: Record<string, string> = {
      'Accept': 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      ...this.headers, // Allow custom headers (like Authorization) to be added
    };

    const requestInit: RequestInit = {
      headers: mergedHeaders,
    };

    this.transport = new SDKStreamableHTTPClientTransport(
      new URL(this.url),
      { requestInit }
    );

    return this.transport;
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      try {
        await this.transport.close();
      } catch {
        // Ignore close errors during disconnect
      }
      this.transport = undefined;
    }
    this.removeAllListeners();
  }

  getType(): TransportType {
    return 'http';
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }
}

export class SSETransport extends EventEmitter implements MCPTransport {
  private transport?: SDKSSEClientTransport;
  private url: string;
  private headers?: Record<string, string>;

  constructor(config: TransportConfig) {
    super();
    if (!config.url) {
      throw new Error('URL is required for SSE transport');
    }
    this.url = config.url;
    this.headers = config.headers;
  }

  async connect(): Promise<Transport> {
    // Use MCP SDK's SSEClientTransport
    const requestInit: RequestInit = {};
    if (this.headers) {
      requestInit.headers = this.headers;
    }

    this.transport = new SDKSSEClientTransport(
      new URL(this.url),
      { requestInit }
    );

    return this.transport;
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      try {
        await this.transport.close();
      } catch {
        // Ignore close errors during disconnect
      }
      this.transport = undefined;
    }
    this.removeAllListeners();
  }

  getType(): TransportType {
    return 'sse';
  }

  /**
   * Clean up resources and remove all event listeners.
   * Required for EventEmitter-extending classes to prevent memory leaks.
   */
  destroy(): void {
    this.removeAllListeners();
  }
}

export class StreamableHttpTransport extends EventEmitter implements MCPTransport {
  private transport?: SDKStreamableHTTPClientTransport;
  private url: string;
  private headers?: Record<string, string>;

  constructor(config: TransportConfig) {
    super();
    if (!config.url) {
      throw new Error('URL is required for streamable_http transport');
    }
    this.url = config.url;
    this.headers = config.headers;
  }

  async connect(): Promise<Transport> {
    // Use MCP SDK's StreamableHTTPClientTransport
    // MCP Streamable HTTP requires Accept header with both application/json and text/event-stream
    // See: https://spec.modelcontextprotocol.io/specification/basic/transports/#streamable-http
    const mergedHeaders: Record<string, string> = {
      'Accept': 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      ...this.headers, // Allow custom headers (like Authorization) to be added
    };

    const requestInit: RequestInit = {
      headers: mergedHeaders,
    };

    this.transport = new SDKStreamableHTTPClientTransport(
      new URL(this.url),
      { requestInit }
    );

    return this.transport;
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      try {
        await this.transport.close();
      } catch {
        // Ignore close errors during disconnect
      }
      this.transport = undefined;
    }
    this.removeAllListeners();
  }

  getType(): TransportType {
    return 'streamable_http';
  }

  /**
   * Clean up resources and remove all event listeners.
   * Required for EventEmitter-extending classes to prevent memory leaks.
   */
  destroy(): void {
    this.removeAllListeners();
  }
}

export function createTransport(config: TransportConfig): MCPTransport {
  switch (config.type) {
    case 'stdio':
      return new StdioTransport(config);
    case 'http':
      return new HttpTransport(config);
    case 'sse':
      return new SSETransport(config);
    case 'streamable_http':
      return new StreamableHttpTransport(config);
    default:
      throw new Error(`Unsupported transport type: ${config.type}`);
  }
}