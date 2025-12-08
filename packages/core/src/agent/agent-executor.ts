/**
 * Agent Executor - Executes tasks through AutomatosX agents
 *
 * Spawns `ax run <agent> "message"` and streams the output back.
 *
 * @module agent-executor
 */

import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

/**
 * Result chunk from agent execution
 */
export interface AgentExecutionChunk {
  type: 'output' | 'error' | 'done';
  content?: string;
  exitCode?: number;
}

/**
 * Options for agent execution
 */
export interface AgentExecutionOptions {
  /** Agent name to use */
  agent: string;
  /** Task/message to send to the agent */
  task: string;
  /** Working directory (defaults to cwd) */
  cwd?: string;
  /** Timeout in milliseconds (default: 60 minutes) */
  timeout?: number;
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Enable streaming mode */
  streaming?: boolean;
  /** Disable memory for this execution */
  noMemory?: boolean;
}

/**
 * Agent execution result
 */
export interface AgentExecutionResult {
  success: boolean;
  output: string;
  exitCode: number;
  duration: number;
}

/**
 * Executes a task through an AutomatosX agent
 *
 * @param options - Execution options
 * @returns AsyncGenerator that yields execution chunks
 */
export async function* executeAgent(
  options: AgentExecutionOptions
): AsyncGenerator<AgentExecutionChunk> {
  const {
    agent,
    task,
    cwd = process.cwd(),
    timeout = 3600000, // 60 minutes default
    env = {},
    streaming = true,
    noMemory = false,
  } = options;

  // Build command arguments
  const args = ['run', agent, task];

  if (streaming) {
    args.push('--streaming');
  }

  if (noMemory) {
    args.push('--no-memory');
  }

  // Force text format for consistent streaming output
  args.push('--format', 'text');

  // Create abort controller for timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, timeout);

  let process_: ChildProcess | null = null;
  let abortHandler: (() => void) | null = null;

  try {
    // Spawn ax process with unbuffered output
    process_ = spawn('ax', args, {
      cwd,
      env: {
        ...process.env,
        ...env,
        // Force unbuffered output for streaming
        FORCE_COLOR: '1',
        NODE_NO_WARNINGS: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });

    // Handle process spawn error
    if (!process_.stdout || !process_.stderr) {
      throw new Error('Failed to create process streams');
    }

    // Create event emitter for async iteration
    const emitter = new EventEmitter();

    // Handle stdout - emit data immediately for real-time streaming
    process_.stdout.on('data', (data: Buffer) => {
      const text = data.toString();

      // Emit immediately for real-time streaming experience
      if (text) {
        emitter.emit('chunk', { type: 'output', content: text });
      }
    });

    // Handle stderr
    process_.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      // Filter out common noise from stderr
      if (!text.includes('npm warn') && !text.includes('ExperimentalWarning')) {
        emitter.emit('chunk', { type: 'error', content: text });
      }
    });

    // Handle process close
    process_.on('close', (code) => {
      emitter.emit('chunk', { type: 'done', exitCode: code ?? 0 });
      emitter.emit('done');
    });

    // Handle process error
    process_.on('error', (err) => {
      emitter.emit('chunk', { type: 'error', content: err.message });
      emitter.emit('chunk', { type: 'done', exitCode: 1 });
      emitter.emit('done');
    });

    // Handle abort signal
    abortHandler = () => {
      if (process_ && !process_.killed) {
        process_.kill('SIGTERM');
        emitter.emit('chunk', { type: 'error', content: 'Agent execution timed out' });
        emitter.emit('chunk', { type: 'done', exitCode: 124 });
        emitter.emit('done');
      }
    };
    abortController.signal.addEventListener('abort', abortHandler);

    // Yield chunks as they arrive
    const chunkQueue: AgentExecutionChunk[] = [];
    let isDone = false;
    let resolveWait: (() => void) | null = null;

    emitter.on('chunk', (chunk: AgentExecutionChunk) => {
      chunkQueue.push(chunk);
      if (resolveWait) {
        resolveWait();
        resolveWait = null;
      }
    });

    emitter.on('done', () => {
      isDone = true;
      if (resolveWait) {
        resolveWait();
        resolveWait = null;
      }
    });

    while (!isDone || chunkQueue.length > 0) {
      if (chunkQueue.length > 0) {
        yield chunkQueue.shift()!;
      } else if (!isDone) {
        await new Promise<void>((resolve) => {
          resolveWait = resolve;
        });
      }
    }
  } finally {
    clearTimeout(timeoutId);
    // Clean up abort handler to prevent memory leak
    if (abortHandler) {
      abortController.signal.removeEventListener('abort', abortHandler);
    }
    if (process_ && !process_.killed) {
      process_.kill('SIGTERM');
    }
  }
}

/**
 * Executes a task through an AutomatosX agent and returns the full result
 *
 * @param options - Execution options
 * @returns Promise with execution result
 */
export async function executeAgentSync(
  options: AgentExecutionOptions
): Promise<AgentExecutionResult> {
  const startTime = Date.now();
  let output = '';
  let exitCode = 0;

  for await (const chunk of executeAgent(options)) {
    switch (chunk.type) {
      case 'output':
        output += chunk.content || '';
        break;
      case 'error':
        output += chunk.content || '';
        break;
      case 'done':
        exitCode = chunk.exitCode ?? 0;
        break;
    }
  }

  return {
    success: exitCode === 0,
    output: output.trim(),
    exitCode,
    duration: Date.now() - startTime,
  };
}

/**
 * Check if ax command is available (cross-platform)
 */
export async function isAxAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    // Use 'where' on Windows, 'which' on Unix-like systems
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'where' : 'which';

    const process_ = spawn(command, ['ax'], {
      stdio: 'pipe',
      shell: isWindows, // Windows needs shell for 'where'
    });

    // Timeout to prevent hanging if spawn process doesn't respond
    const timeout = setTimeout(() => {
      process_.kill();
      resolve(false);
    }, 5000);

    process_.on('close', (code) => {
      clearTimeout(timeout);
      resolve(code === 0);
    });
    process_.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}
