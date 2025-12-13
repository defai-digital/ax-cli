/**
 * Tests for ipc/vscode-client module
 * Tests VS Code IPC communication, WebSocket handling, and streaming
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock WebSocket - create a mock class with EventEmitter functionality
class MockWebSocket extends EventEmitter {
  static OPEN = 1;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  send = vi.fn();
  close = vi.fn();

  simulateOpen() {
    this.emit('open');
  }

  simulateMessage(data: string) {
    this.emit('message', Buffer.from(data));
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close');
  }

  simulateError(error: Error) {
    this.emit('error', error);
  }
}

let mockWebSocketInstance: MockWebSocket | null = null;

vi.mock('ws', () => ({
  default: class {
    constructor(_url: string) {
      mockWebSocketInstance = new MockWebSocket();
      return mockWebSocketInstance;
    }
    static OPEN = 1;
    static CLOSED = 3;
  },
}));

import {
  VSCodeIPCClient,
  StreamSession,
  getVSCodeIPCClient,
  disposeVSCodeIPCClient,
  type DiffPayload,
  type TaskSummaryPayload,
  type StreamChunkPayload,
} from '../../packages/core/src/ipc/vscode-client.js';

describe('VSCodeIPCClient', () => {
  let client: VSCodeIPCClient;
  const validPortFile = {
    port: 12345,
    pid: 1234,
    started: new Date().toISOString(),
    version: '1.0.0',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWebSocketInstance = null;
    vi.useFakeTimers();

    // Reset singleton
    disposeVSCodeIPCClient();

    client = new VSCodeIPCClient();
  });

  afterEach(() => {
    client.disconnect();
    client.destroy();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create client instance', () => {
      expect(client).toBeInstanceOf(VSCodeIPCClient);
    });

    it('should start disconnected', () => {
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('connect', () => {
    it('should return false when port file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await client.connect();

      expect(result).toBe(false);
      expect(client.isConnected()).toBe(false);
    });

    it('should return false for stale port file', async () => {
      const staleDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          ...validPortFile,
          started: staleDate,
        })
      );

      const result = await client.connect();

      expect(result).toBe(false);
    });

    it('should return false for corrupted port file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');

      const result = await client.connect();

      expect(result).toBe(false);
    });

    it('should return false for port file with invalid date', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          ...validPortFile,
          started: 'invalid-date',
        })
      );

      const result = await client.connect();

      expect(result).toBe(false);
    });

    it('should return true when already connected', async () => {
      // First connection
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validPortFile));

      const connectPromise = client.connect();

      // Simulate successful connection
      await vi.advanceTimersByTimeAsync(10);
      mockWebSocketInstance?.simulateOpen();
      await connectPromise;

      // Second connection should return true immediately
      const result = await client.connect();
      expect(result).toBe(true);
    });

    it('should return false when already connecting', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validPortFile));

      // Start first connection
      const connectPromise1 = client.connect();

      // Try to connect again while connecting
      const result = await client.connect();

      expect(result).toBe(false);

      // Clean up
      mockWebSocketInstance?.simulateOpen();
      await connectPromise1;
    });

    it('should handle connection timeout', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validPortFile));

      const connectPromise = client.connect();

      // Advance past timeout (5000ms)
      await vi.advanceTimersByTimeAsync(6000);

      const result = await connectPromise;

      expect(result).toBe(false);
    });

    it('should emit connected event on successful connection', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validPortFile));

      const connectedHandler = vi.fn();
      client.on('connected', connectedHandler);

      const connectPromise = client.connect();

      await vi.advanceTimersByTimeAsync(10);
      mockWebSocketInstance?.simulateOpen();

      await connectPromise;

      expect(connectedHandler).toHaveBeenCalled();
    });

    it('should handle WebSocket error during connection', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validPortFile));

      const connectPromise = client.connect();

      await vi.advanceTimersByTimeAsync(10);
      mockWebSocketInstance?.simulateError(new Error('Connection failed'));

      const result = await connectPromise;

      expect(result).toBe(false);
    });

    it('should handle WebSocket close during connection', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validPortFile));

      const connectPromise = client.connect();

      await vi.advanceTimersByTimeAsync(10);
      mockWebSocketInstance?.simulateClose();

      const result = await connectPromise;

      expect(result).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should handle disconnect when not connected', () => {
      expect(() => client.disconnect()).not.toThrow();
    });

    it('should close WebSocket when connected', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validPortFile));

      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(10);
      mockWebSocketInstance?.simulateOpen();
      await connectPromise;

      client.disconnect();

      expect(mockWebSocketInstance?.close).toHaveBeenCalled();
      expect(client.isConnected()).toBe(false);
    });

    it('should reject pending requests on disconnect', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validPortFile));

      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(10);
      mockWebSocketInstance?.simulateOpen();
      await connectPromise;

      // Start a request
      const diffPromise = client.requestDiffApproval({
        id: 'test-1',
        file: '/test/file.ts',
        oldContent: 'old',
        newContent: 'new',
        diff: '- old\n+ new',
        operation: 'edit',
        toolCall: { name: 'edit', command: 'edit file' },
      });

      // Disconnect before response
      client.disconnect();

      // Should resolve true (fallback to auto-approve)
      await vi.advanceTimersByTimeAsync(1);
      const result = await diffPromise;
      expect(result).toBe(true);
    });
  });

  describe('requestDiffApproval', () => {
    const diffPayload: DiffPayload = {
      id: 'diff-1',
      file: '/test/file.ts',
      oldContent: 'old content',
      newContent: 'new content',
      diff: '- old content\n+ new content',
      operation: 'edit',
      toolCall: { name: 'str_replace_editor', command: 'str_replace' },
    };

    it('should auto-approve when not connected', async () => {
      const result = await client.requestDiffApproval(diffPayload);
      expect(result).toBe(true);
    });

    it('should send diff_preview request when connected', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validPortFile));

      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(10);
      mockWebSocketInstance?.simulateOpen();
      await connectPromise;

      const diffPromise = client.requestDiffApproval(diffPayload);

      // Verify message was sent
      expect(mockWebSocketInstance?.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWebSocketInstance?.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('diff_preview');
      expect(sentMessage.payload.id).toBe('diff-1');

      // Simulate approval response
      mockWebSocketInstance?.simulateMessage(
        JSON.stringify({
          type: 'approved',
          requestId: sentMessage.requestId,
        })
      );

      const result = await diffPromise;
      expect(result).toBe(true);
    });

    it('should return false when diff is rejected', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validPortFile));

      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(10);
      mockWebSocketInstance?.simulateOpen();
      await connectPromise;

      const diffPromise = client.requestDiffApproval(diffPayload);

      const sentMessage = JSON.parse(mockWebSocketInstance?.send.mock.calls[0][0]);

      mockWebSocketInstance?.simulateMessage(
        JSON.stringify({
          type: 'rejected',
          requestId: sentMessage.requestId,
        })
      );

      const result = await diffPromise;
      expect(result).toBe(false);
    });

    it('should auto-approve on timeout', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validPortFile));

      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(10);
      mockWebSocketInstance?.simulateOpen();
      await connectPromise;

      const diffPromise = client.requestDiffApproval(diffPayload);

      // Advance past request timeout (120s)
      await vi.advanceTimersByTimeAsync(130000);

      const result = await diffPromise;
      expect(result).toBe(true); // Auto-approve on timeout
    });
  });

  describe('sendTaskComplete', () => {
    const taskPayload: TaskSummaryPayload = {
      id: 'task-1',
      description: 'Test task',
      status: 'completed',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 1000,
      changes: {
        filesModified: ['file.ts'],
        filesCreated: [],
        filesDeleted: [],
        totalLinesAdded: 10,
        totalLinesRemoved: 5,
      },
      usage: {
        inputTokens: 1000,
        outputTokens: 500,
        toolCalls: 3,
        toolsUsed: ['view_file', 'str_replace_editor', 'bash'],
      },
    };

    it('should not throw when not connected', async () => {
      await expect(client.sendTaskComplete(taskPayload)).resolves.not.toThrow();
    });

    it('should send task_complete message when connected', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validPortFile));

      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(10);
      mockWebSocketInstance?.simulateOpen();
      await connectPromise;

      // Send task complete but don't wait for response since we need to simulate it
      const taskPromise = client.sendTaskComplete(taskPayload);

      // Simulate a response to the request
      const sentMessage = JSON.parse(mockWebSocketInstance?.send.mock.calls[0][0]);
      mockWebSocketInstance?.simulateMessage(
        JSON.stringify({
          type: 'approved',
          requestId: sentMessage.requestId,
        })
      );

      await taskPromise;

      // Should have sent message
      expect(mockWebSocketInstance?.send).toHaveBeenCalled();
    });
  });

  describe('sendStatusUpdate', () => {
    it('should not throw when not connected', () => {
      expect(() => client.sendStatusUpdate('Processing...')).not.toThrow();
    });

    it('should send status_update message when connected', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validPortFile));

      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(10);
      mockWebSocketInstance?.simulateOpen();
      await connectPromise;

      client.sendStatusUpdate('Processing files...');

      const sentMessage = JSON.parse(mockWebSocketInstance?.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('status_update');
      expect(sentMessage.payload.status).toBe('Processing files...');
    });
  });

  describe('revealFile', () => {
    it('should not throw when not connected', () => {
      expect(() => client.revealFile('/test/file.ts', 'create')).not.toThrow();
    });

    it('should send file_reveal message when connected', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validPortFile));

      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(10);
      mockWebSocketInstance?.simulateOpen();
      await connectPromise;

      client.revealFile('/test/file.ts', 'edit', { preview: false, focus: true });

      const sentMessage = JSON.parse(mockWebSocketInstance?.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('file_reveal');
      expect(sentMessage.payload.file).toBe('/test/file.ts');
      expect(sentMessage.payload.operation).toBe('edit');
      expect(sentMessage.payload.preview).toBe(false);
      expect(sentMessage.payload.focus).toBe(true);
    });

    it('should use default options when not provided', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validPortFile));

      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(10);
      mockWebSocketInstance?.simulateOpen();
      await connectPromise;

      client.revealFile('/test/file.ts', 'create');

      const sentMessage = JSON.parse(mockWebSocketInstance?.send.mock.calls[0][0]);
      expect(sentMessage.payload.preview).toBe(true);
      expect(sentMessage.payload.focus).toBe(true);
    });
  });

  describe('sendStreamChunk', () => {
    it('should not throw when not connected', () => {
      const payload: StreamChunkPayload = {
        sessionId: 'session-1',
        type: 'content',
        content: 'test content',
      };
      expect(() => client.sendStreamChunk(payload)).not.toThrow();
    });

    it('should send stream_chunk message when connected', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validPortFile));

      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(10);
      mockWebSocketInstance?.simulateOpen();
      await connectPromise;

      client.sendStreamChunk({
        sessionId: 'session-1',
        type: 'thinking',
        content: 'Analyzing code...',
      });

      const sentMessage = JSON.parse(mockWebSocketInstance?.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('stream_chunk');
      expect(sentMessage.payload.sessionId).toBe('session-1');
      expect(sentMessage.payload.type).toBe('thinking');
    });
  });

  describe('createStreamSession', () => {
    it('should create a stream session with unique ID', () => {
      const session = client.createStreamSession();

      expect(session).toBeInstanceOf(StreamSession);
      expect(session.sessionId).toContain('stream-');
    });
  });

  describe('ping', () => {
    it('should return false when not connected', async () => {
      const result = await client.ping();
      expect(result).toBe(false);
    });

    it('should return true on pong response', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validPortFile));

      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(10);
      mockWebSocketInstance?.simulateOpen();
      await connectPromise;

      const pingPromise = client.ping();

      const sentMessage = JSON.parse(mockWebSocketInstance?.send.mock.calls[0][0]);
      mockWebSocketInstance?.simulateMessage(
        JSON.stringify({
          type: 'pong',
          requestId: sentMessage.requestId,
        })
      );

      const result = await pingPromise;
      expect(result).toBe(true);
    });
  });

  describe('isConnected', () => {
    it('should return false initially', () => {
      expect(client.isConnected()).toBe(false);
    });

    it('should return true after successful connection', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validPortFile));

      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(10);
      mockWebSocketInstance?.simulateOpen();
      await connectPromise;

      expect(client.isConnected()).toBe(true);
    });
  });

  describe('handleDisconnect', () => {
    it('should emit disconnected event when previously connected', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validPortFile));

      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(10);
      mockWebSocketInstance?.simulateOpen();
      await connectPromise;

      const disconnectedHandler = vi.fn();
      client.on('disconnected', disconnectedHandler);

      mockWebSocketInstance?.simulateClose();

      expect(disconnectedHandler).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should remove all listeners', () => {
      client.on('connected', vi.fn());
      client.on('disconnected', vi.fn());

      client.destroy();

      expect(client.listenerCount('connected')).toBe(0);
      expect(client.listenerCount('disconnected')).toBe(0);
    });
  });
});

describe('StreamSession', () => {
  let client: VSCodeIPCClient;
  let session: StreamSession;
  let sendStreamChunkSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new VSCodeIPCClient();
    session = new StreamSession(client, 'test-session');
    sendStreamChunkSpy = vi.spyOn(client, 'sendStreamChunk').mockImplementation(() => {});
  });

  afterEach(() => {
    client.destroy();
  });

  describe('sessionId', () => {
    it('should have the session ID passed to constructor', () => {
      expect(session.sessionId).toBe('test-session');
    });
  });

  describe('sendThinking', () => {
    it('should send thinking chunk', () => {
      session.sendThinking('Analyzing the problem...');

      expect(sendStreamChunkSpy).toHaveBeenCalledWith({
        sessionId: 'test-session',
        type: 'thinking',
        content: 'Analyzing the problem...',
      });
    });
  });

  describe('sendContent', () => {
    it('should send content chunk', () => {
      session.sendContent('Here is the response...');

      expect(sendStreamChunkSpy).toHaveBeenCalledWith({
        sessionId: 'test-session',
        type: 'content',
        content: 'Here is the response...',
      });
    });
  });

  describe('sendToolCall', () => {
    it('should send tool_call chunk', () => {
      session.sendToolCall('call-1', 'view_file', '{"path": "/test.ts"}');

      expect(sendStreamChunkSpy).toHaveBeenCalledWith({
        sessionId: 'test-session',
        type: 'tool_call',
        toolCall: {
          id: 'call-1',
          name: 'view_file',
          arguments: '{"path": "/test.ts"}',
        },
      });
    });
  });

  describe('sendToolResult', () => {
    it('should send tool_result chunk', () => {
      session.sendToolResult('call-1', 'File contents...', false);

      expect(sendStreamChunkSpy).toHaveBeenCalledWith({
        sessionId: 'test-session',
        type: 'tool_result',
        toolResult: {
          id: 'call-1',
          result: 'File contents...',
          isError: false,
        },
      });
    });

    it('should send tool_result with error', () => {
      session.sendToolResult('call-1', 'File not found', true);

      expect(sendStreamChunkSpy).toHaveBeenCalledWith({
        sessionId: 'test-session',
        type: 'tool_result',
        toolResult: {
          id: 'call-1',
          result: 'File not found',
          isError: true,
        },
      });
    });

    it('should default isError to false', () => {
      session.sendToolResult('call-1', 'Result');

      expect(sendStreamChunkSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toolResult: expect.objectContaining({
            isError: false,
          }),
        })
      );
    });
  });

  describe('sendDone', () => {
    it('should send done chunk', () => {
      session.sendDone();

      expect(sendStreamChunkSpy).toHaveBeenCalledWith({
        sessionId: 'test-session',
        type: 'done',
      });
    });
  });

  describe('sendError', () => {
    it('should send error chunk', () => {
      session.sendError('Something went wrong');

      expect(sendStreamChunkSpy).toHaveBeenCalledWith({
        sessionId: 'test-session',
        type: 'error',
        error: 'Something went wrong',
      });
    });
  });
});

describe('getVSCodeIPCClient', () => {
  beforeEach(() => {
    disposeVSCodeIPCClient();
  });

  it('should return singleton instance', () => {
    const client1 = getVSCodeIPCClient();
    const client2 = getVSCodeIPCClient();

    expect(client1).toBe(client2);
  });

  it('should return new instance after dispose', () => {
    const client1 = getVSCodeIPCClient();
    disposeVSCodeIPCClient();
    const client2 = getVSCodeIPCClient();

    expect(client1).not.toBe(client2);
  });
});

describe('disposeVSCodeIPCClient', () => {
  it('should handle dispose when no instance exists', () => {
    expect(() => disposeVSCodeIPCClient()).not.toThrow();
  });

  it('should disconnect and null out instance', () => {
    const client = getVSCodeIPCClient();
    const disconnectSpy = vi.spyOn(client, 'disconnect');

    disposeVSCodeIPCClient();

    expect(disconnectSpy).toHaveBeenCalled();
  });
});
