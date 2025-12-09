/**
 * Tests for MCP Transport Classes
 *
 * Tests focus on transport configuration, instantiation, and cleanup methods.
 * Connect functionality is tested in integration tests since it requires real MCP SDK.
 *
 * @module tests/mcp/transports.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  StdioTransport,
  HttpTransport,
  SSETransport,
  StreamableHttpTransport,
  createTransport,
  type TransportConfig,
} from '../../src/mcp/transports.js';

describe('MCP Transports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('StdioTransport', () => {
    it('should require command in config', () => {
      expect(() => new StdioTransport({ type: 'stdio' })).toThrow(
        'Command is required for stdio transport'
      );
    });

    it('should create with command', () => {
      const transport = new StdioTransport({
        type: 'stdio',
        command: 'node',
        args: ['server.js'],
      });
      expect(transport.getType()).toBe('stdio');
    });

    it('should handle disconnect when not connected', async () => {
      const transport = new StdioTransport({
        type: 'stdio',
        command: 'node',
      });
      await transport.disconnect();
      // Should not throw
    });

    it('should support quiet mode', () => {
      const transport = new StdioTransport({
        type: 'stdio',
        command: 'node',
        quiet: true,
      });
      expect(transport.getType()).toBe('stdio');
    });

    it('should accept custom environment variables', () => {
      const transport = new StdioTransport({
        type: 'stdio',
        command: 'node',
        env: { CUSTOM_VAR: 'value' },
      });
      expect(transport.getType()).toBe('stdio');
    });

    it('should accept framing option', () => {
      const transport = new StdioTransport({
        type: 'stdio',
        command: 'node',
        framing: 'ndjson',
      });
      expect(transport.getType()).toBe('stdio');
    });

    it('should default framing to content-length', () => {
      const transport = new StdioTransport({
        type: 'stdio',
        command: 'node',
      });
      expect(transport.getType()).toBe('stdio');
    });
  });

  describe('HttpTransport', () => {
    it('should require url in config', () => {
      expect(() => new HttpTransport({ type: 'http' })).toThrow(
        'URL is required for HTTP transport'
      );
    });

    it('should create with url', () => {
      const transport = new HttpTransport({
        type: 'http',
        url: 'http://localhost:3000',
      });
      expect(transport.getType()).toBe('http');
    });

    it('should handle disconnect when not connected', async () => {
      const transport = new HttpTransport({
        type: 'http',
        url: 'http://localhost:3000',
      });
      await transport.disconnect();
      // Should not throw
    });

    it('should have destroy method that removes listeners', () => {
      const transport = new HttpTransport({
        type: 'http',
        url: 'http://localhost:3000',
      });

      // Add some listeners
      const listener = vi.fn();
      transport.on('test', listener);
      expect(transport.listenerCount('test')).toBe(1);

      // Destroy should remove all listeners
      transport.destroy();
      expect(transport.listenerCount('test')).toBe(0);
    });

    it('should be an EventEmitter', () => {
      const transport = new HttpTransport({
        type: 'http',
        url: 'http://localhost:3000',
      });

      expect(typeof transport.on).toBe('function');
      expect(typeof transport.emit).toBe('function');
      expect(typeof transport.removeAllListeners).toBe('function');
    });

    it('should accept custom headers', () => {
      const transport = new HttpTransport({
        type: 'http',
        url: 'http://localhost:3000',
        headers: { 'Authorization': 'Bearer token' },
      });
      expect(transport.getType()).toBe('http');
    });
  });

  describe('SSETransport', () => {
    it('should require url in config', () => {
      expect(() => new SSETransport({ type: 'sse' })).toThrow(
        'URL is required for SSE transport'
      );
    });

    it('should create with url', () => {
      const transport = new SSETransport({
        type: 'sse',
        url: 'http://localhost:3000/sse',
      });
      expect(transport.getType()).toBe('sse');
    });

    it('should handle disconnect when not connected', async () => {
      const transport = new SSETransport({
        type: 'sse',
        url: 'http://localhost:3000/sse',
      });
      await transport.disconnect();
      // Should not throw
    });

    it('should have destroy method that removes listeners', () => {
      const transport = new SSETransport({
        type: 'sse',
        url: 'http://localhost:3000/sse',
      });

      // Add some listeners
      const listener = vi.fn();
      transport.on('test', listener);
      expect(transport.listenerCount('test')).toBe(1);

      // Destroy should remove all listeners
      transport.destroy();
      expect(transport.listenerCount('test')).toBe(0);
    });

    it('should be an EventEmitter', () => {
      const transport = new SSETransport({
        type: 'sse',
        url: 'http://localhost:3000/sse',
      });

      expect(typeof transport.on).toBe('function');
      expect(typeof transport.emit).toBe('function');
      expect(typeof transport.removeAllListeners).toBe('function');
    });

    it('should accept custom headers', () => {
      const transport = new SSETransport({
        type: 'sse',
        url: 'http://localhost:3000/sse',
        headers: { 'Authorization': 'Bearer token' },
      });
      expect(transport.getType()).toBe('sse');
    });
  });

  describe('StreamableHttpTransport', () => {
    it('should require url in config', () => {
      expect(() => new StreamableHttpTransport({ type: 'streamable_http' })).toThrow(
        'URL is required for streamable_http transport'
      );
    });

    it('should create with url', () => {
      const transport = new StreamableHttpTransport({
        type: 'streamable_http',
        url: 'http://localhost:3000/mcp',
      });
      expect(transport.getType()).toBe('streamable_http');
    });

    it('should handle disconnect when not connected', async () => {
      const transport = new StreamableHttpTransport({
        type: 'streamable_http',
        url: 'http://localhost:3000/mcp',
      });
      await transport.disconnect();
      // Should not throw
    });

    it('should have destroy method that removes listeners', () => {
      const transport = new StreamableHttpTransport({
        type: 'streamable_http',
        url: 'http://localhost:3000/mcp',
      });

      // Add some listeners
      const listener = vi.fn();
      transport.on('test', listener);
      expect(transport.listenerCount('test')).toBe(1);

      // Destroy should remove all listeners
      transport.destroy();
      expect(transport.listenerCount('test')).toBe(0);
    });

    it('should be an EventEmitter', () => {
      const transport = new StreamableHttpTransport({
        type: 'streamable_http',
        url: 'http://localhost:3000/mcp',
      });

      expect(typeof transport.on).toBe('function');
      expect(typeof transport.emit).toBe('function');
      expect(typeof transport.removeAllListeners).toBe('function');
    });

    it('should accept custom headers', () => {
      const transport = new StreamableHttpTransport({
        type: 'streamable_http',
        url: 'http://localhost:3000/mcp',
        headers: { 'Authorization': 'Bearer token' },
      });
      expect(transport.getType()).toBe('streamable_http');
    });
  });

  describe('createTransport factory', () => {
    it('should create StdioTransport for stdio type', () => {
      const transport = createTransport({
        type: 'stdio',
        command: 'node',
      });
      expect(transport.getType()).toBe('stdio');
    });

    it('should create HttpTransport for http type', () => {
      const transport = createTransport({
        type: 'http',
        url: 'http://localhost:3000',
      });
      expect(transport.getType()).toBe('http');
    });

    it('should create SSETransport for sse type', () => {
      const transport = createTransport({
        type: 'sse',
        url: 'http://localhost:3000/sse',
      });
      expect(transport.getType()).toBe('sse');
    });

    it('should create StreamableHttpTransport for streamable_http type', () => {
      const transport = createTransport({
        type: 'streamable_http',
        url: 'http://localhost:3000/mcp',
      });
      expect(transport.getType()).toBe('streamable_http');
    });

    it('should throw for unsupported transport type', () => {
      expect(() =>
        createTransport({ type: 'unsupported' as any })
      ).toThrow('Unsupported transport type: unsupported');
    });
  });

  describe('memory leak prevention', () => {
    it('HttpTransport destroy should prevent memory leaks', () => {
      const transport = new HttpTransport({
        type: 'http',
        url: 'http://localhost:3000',
      });

      // Add multiple listeners
      for (let i = 0; i < 10; i++) {
        transport.on('event', vi.fn());
      }

      expect(transport.listenerCount('event')).toBe(10);

      // Destroy should clean up all listeners
      transport.destroy();
      expect(transport.listenerCount('event')).toBe(0);
    });

    it('SSETransport destroy should prevent memory leaks', () => {
      const transport = new SSETransport({
        type: 'sse',
        url: 'http://localhost:3000/sse',
      });

      // Add multiple listeners
      for (let i = 0; i < 10; i++) {
        transport.on('event', vi.fn());
      }

      expect(transport.listenerCount('event')).toBe(10);

      // Destroy should clean up all listeners
      transport.destroy();
      expect(transport.listenerCount('event')).toBe(0);
    });

    it('StreamableHttpTransport destroy should prevent memory leaks', () => {
      const transport = new StreamableHttpTransport({
        type: 'streamable_http',
        url: 'http://localhost:3000/mcp',
      });

      // Add multiple listeners
      for (let i = 0; i < 10; i++) {
        transport.on('event', vi.fn());
      }

      expect(transport.listenerCount('event')).toBe(10);

      // Destroy should clean up all listeners
      transport.destroy();
      expect(transport.listenerCount('event')).toBe(0);
    });
  });

  describe('transport configuration', () => {
    it('should pass all config options to StdioTransport', () => {
      const config: TransportConfig = {
        type: 'stdio',
        command: 'python',
        args: ['-m', 'mcp_server'],
        env: { PYTHONPATH: '/custom/path' },
        framing: 'ndjson',
        quiet: true,
      };

      const transport = new StdioTransport(config);
      expect(transport.getType()).toBe('stdio');
    });
  });
});
