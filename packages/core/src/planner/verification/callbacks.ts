/**
 * Verification Callbacks
 *
 * Built-in verification callbacks for common checks.
 * Primary focus: TypeScript type checking (per user preference).
 *
 * @module planner/verification/callbacks
 */

import { spawn } from 'child_process';
import type {
  VerificationCallbackConfig,
  VerificationCallbackResult,
  VerificationIssue,
  VerificationStatus,
} from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for running a callback
 */
export interface CallbackRunOptions {
  /** Working directory */
  cwd?: string;

  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;

  /** Modified files (for scoped checks) */
  modifiedFiles?: string[];

  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * Callback runner function type
 */
export type CallbackRunner = (
  config: VerificationCallbackConfig,
  options: CallbackRunOptions
) => Promise<VerificationCallbackResult>;

// ============================================================================
// Command Execution Helper
// ============================================================================

/**
 * Execute a command and capture output
 */
async function executeCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    timeout: number;
    abortSignal?: AbortSignal;
    env?: Record<string, string>;
  }
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      shell: true,
      env: { ...process.env, ...options.env },
    });

    // Handle timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      }, 5000);
    }, options.timeout);

    // Handle abort signal
    if (options.abortSignal) {
      options.abortSignal.addEventListener('abort', () => {
        proc.kill('SIGTERM');
      });
    }

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
        timedOut,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      resolve({
        stdout,
        stderr: stderr + '\n' + err.message,
        exitCode: 1,
        timedOut: false,
      });
    });
  });
}

// ============================================================================
// TypeScript Verification
// ============================================================================

/**
 * Parse TypeScript errors from tsc output
 */
function parseTypeScriptErrors(output: string): VerificationIssue[] {
  const issues: VerificationIssue[] = [];

  // TypeScript error format: file(line,col): error TSxxxx: message
  const errorRegex = /^(.+)\((\d+),(\d+)\):\s*(error|warning)\s*(TS\d+):\s*(.+)$/gm;

  let match;
  while ((match = errorRegex.exec(output)) !== null) {
    issues.push({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      severity: match[4] === 'error' ? 'error' : 'warning',
      code: match[5],
      message: match[6],
    });
  }

  return issues;
}

/**
 * Run TypeScript type checking
 */
export async function runTypecheck(
  config: VerificationCallbackConfig,
  options: CallbackRunOptions
): Promise<VerificationCallbackResult> {
  const startedAt = new Date();
  const startTime = Date.now();

  // Determine the tsc command
  // First try npx tsc, then local node_modules
  const tscCommand = 'npx';
  const tscArgs = ['tsc', '--noEmit', '--pretty', 'false'];

  // If modified files provided and scopeToModifiedFiles is true,
  // we still run full typecheck because partial typecheck can miss issues
  // from type dependencies

  const result = await executeCommand(tscCommand, tscArgs, {
    cwd: options.cwd || config.cwd,
    timeout: config.timeout,
    abortSignal: options.abortSignal,
    env: options.env,
  });

  const completedAt = new Date();
  const durationMs = Date.now() - startTime;

  // Parse issues from output
  const output = result.stdout + '\n' + result.stderr;
  const issues = parseTypeScriptErrors(output);

  // Determine status
  let status: VerificationStatus;
  if (result.timedOut) {
    status = 'timeout';
  } else if (result.exitCode === 0) {
    status = 'passed';
  } else {
    status = 'failed';
  }

  return {
    name: config.name,
    type: 'typecheck',
    passed: result.exitCode === 0 && !result.timedOut,
    status,
    output: result.stdout,
    errorOutput: result.stderr,
    exitCode: result.exitCode,
    durationMs,
    startedAt,
    completedAt,
    issueCount: issues.length,
    issues,
  };
}

// ============================================================================
// ESLint Verification (Optional)
// ============================================================================

/**
 * Parse ESLint JSON output
 */
function parseESLintOutput(output: string): VerificationIssue[] {
  const issues: VerificationIssue[] = [];

  try {
    const results = JSON.parse(output) as Array<{
      filePath: string;
      messages: Array<{
        line: number;
        column: number;
        severity: number;
        message: string;
        ruleId: string | null;
      }>;
    }>;

    for (const file of results) {
      for (const msg of file.messages) {
        issues.push({
          file: file.filePath,
          line: msg.line,
          column: msg.column,
          severity: msg.severity === 2 ? 'error' : 'warning',
          code: msg.ruleId || undefined,
          message: msg.message,
        });
      }
    }
  } catch {
    // If JSON parsing fails, try to extract from text output
    const lineRegex = /^(.+):(\d+):(\d+):\s*(error|warning)\s*(.+)$/gm;
    let match;
    while ((match = lineRegex.exec(output)) !== null) {
      issues.push({
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        severity: match[4] === 'error' ? 'error' : 'warning',
        message: match[5],
      });
    }
  }

  return issues;
}

/**
 * Run ESLint
 */
export async function runLint(
  config: VerificationCallbackConfig,
  options: CallbackRunOptions
): Promise<VerificationCallbackResult> {
  const startedAt = new Date();
  const startTime = Date.now();

  // Build ESLint command
  const eslintArgs = ['eslint', '--format', 'json'];

  // Scope to modified files if configured
  if (config.scopeToModifiedFiles && options.modifiedFiles?.length) {
    // Filter to only JS/TS files
    const lintableFiles = options.modifiedFiles.filter(f =>
      /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(f)
    );
    if (lintableFiles.length === 0) {
      // No lintable files modified - skip
      return {
        name: config.name,
        type: 'lint',
        passed: true,
        status: 'skipped',
        output: 'No lintable files modified',
        durationMs: 0,
        startedAt,
        completedAt: new Date(),
        issueCount: 0,
      };
    }
    eslintArgs.push(...lintableFiles);
  } else {
    eslintArgs.push('.');
  }

  const result = await executeCommand('npx', eslintArgs, {
    cwd: options.cwd || config.cwd,
    timeout: config.timeout,
    abortSignal: options.abortSignal,
    env: options.env,
  });

  const completedAt = new Date();
  const durationMs = Date.now() - startTime;

  // Parse issues
  const issues = parseESLintOutput(result.stdout);
  const errorCount = issues.filter(i => i.severity === 'error').length;

  // Determine status
  let status: VerificationStatus;
  if (result.timedOut) {
    status = 'timeout';
  } else if (errorCount === 0) {
    status = 'passed';
  } else {
    status = 'failed';
  }

  return {
    name: config.name,
    type: 'lint',
    passed: errorCount === 0 && !result.timedOut,
    status,
    output: result.stdout,
    errorOutput: result.stderr,
    exitCode: result.exitCode,
    durationMs,
    startedAt,
    completedAt,
    issueCount: issues.length,
    issues,
  };
}

// ============================================================================
// Test Verification (Optional)
// ============================================================================

/**
 * Run tests
 */
export async function runTests(
  config: VerificationCallbackConfig,
  options: CallbackRunOptions
): Promise<VerificationCallbackResult> {
  const startedAt = new Date();
  const startTime = Date.now();

  // Detect test runner (check package.json or common patterns)
  // Default to npm test
  let testCommand = 'npm';
  let testArgs = ['test'];

  // If modified files provided, try to run only related tests
  if (config.scopeToModifiedFiles && options.modifiedFiles?.length) {
    // For vitest, use --related flag
    // For jest, use --findRelatedTests
    // Default behavior is to run all tests for safety
    testArgs = ['test', '--', '--passWithNoTests'];
  }

  const result = await executeCommand(testCommand, testArgs, {
    cwd: options.cwd || config.cwd,
    timeout: config.timeout,
    abortSignal: options.abortSignal,
    env: { ...options.env, CI: 'true' }, // Run in CI mode
  });

  const completedAt = new Date();
  const durationMs = Date.now() - startTime;

  // Determine status
  let status: VerificationStatus;
  if (result.timedOut) {
    status = 'timeout';
  } else if (result.exitCode === 0) {
    status = 'passed';
  } else {
    status = 'failed';
  }

  return {
    name: config.name,
    type: 'test',
    passed: result.exitCode === 0 && !result.timedOut,
    status,
    output: result.stdout,
    errorOutput: result.stderr,
    exitCode: result.exitCode,
    durationMs,
    startedAt,
    completedAt,
  };
}

// ============================================================================
// Custom Command Verification
// ============================================================================

/**
 * Run a custom verification command
 */
export async function runCustom(
  config: VerificationCallbackConfig,
  options: CallbackRunOptions
): Promise<VerificationCallbackResult> {
  const startedAt = new Date();
  const startTime = Date.now();

  if (!config.command) {
    return {
      name: config.name,
      type: 'custom',
      passed: false,
      status: 'failed',
      output: '',
      errorOutput: 'No command specified for custom verification',
      durationMs: 0,
      startedAt,
      completedAt: new Date(),
    };
  }

  // Parse command and args
  const parts = config.command.split(/\s+/);
  const command = parts[0];
  const args = parts.slice(1);

  const result = await executeCommand(command, args, {
    cwd: options.cwd || config.cwd,
    timeout: config.timeout,
    abortSignal: options.abortSignal,
    env: options.env,
  });

  const completedAt = new Date();
  const durationMs = Date.now() - startTime;

  // Determine status
  let status: VerificationStatus;
  if (result.timedOut) {
    status = 'timeout';
  } else if (result.exitCode === 0) {
    status = 'passed';
  } else {
    status = 'failed';
  }

  return {
    name: config.name,
    type: 'custom',
    passed: result.exitCode === 0 && !result.timedOut,
    status,
    output: result.stdout,
    errorOutput: result.stderr,
    exitCode: result.exitCode,
    durationMs,
    startedAt,
    completedAt,
  };
}

// ============================================================================
// Callback Registry
// ============================================================================

/**
 * Map of callback types to their runners
 */
export const CALLBACK_RUNNERS: Record<string, CallbackRunner> = {
  typecheck: runTypecheck,
  lint: runLint,
  test: runTests,
  custom: runCustom,
};

/**
 * Get the runner for a callback type
 */
export function getCallbackRunner(type: string): CallbackRunner | undefined {
  return CALLBACK_RUNNERS[type];
}

/**
 * Run a verification callback based on its type
 */
export async function runCallback(
  config: VerificationCallbackConfig,
  options: CallbackRunOptions
): Promise<VerificationCallbackResult> {
  const runner = getCallbackRunner(config.type);

  if (!runner) {
    const startedAt = new Date();
    return {
      name: config.name,
      type: config.type,
      passed: false,
      status: 'failed',
      output: '',
      errorOutput: `Unknown callback type: ${config.type}`,
      durationMs: 0,
      startedAt,
      completedAt: new Date(),
    };
  }

  return runner(config, options);
}
