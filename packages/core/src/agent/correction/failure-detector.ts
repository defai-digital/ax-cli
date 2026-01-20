/**
 * Failure Detector
 *
 * Detects failure patterns in tool executions and determines
 * when self-correction should be triggered.
 *
 * Integrates with the existing LoopDetector for loop-based failures.
 *
 * @module agent/correction/failure-detector
 */

import { createHash } from 'crypto';
import type { LLMToolCall } from '../../llm/client.js';
import type { ToolResult } from '../../types/index.js';
import type { LoopDetectionResult } from '../loop-detector.js';
import type {
  FailureSignal,
  FailureType,
  FailureSeverity,
  FailureContext,
  FailureSignature,
  FailureDetectorState,
  FailureDetectionOptions,
} from './types.js';
import { DEFAULT_FAILURE_DETECTION_OPTIONS } from './types.js';

/**
 * Generates unique IDs for failure signals
 */
function generateFailureId(): string {
  return `fail_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Creates a hash of tool arguments for signature matching
 */
function hashArgs(args: Record<string, unknown>): string {
  const normalized = JSON.stringify(args, Object.keys(args).sort());
  return createHash('md5').update(normalized).digest('hex').substring(0, 12);
}

/**
 * Extracts file path from tool arguments if present
 * BUG FIX: Properly validate types instead of using unsafe type assertion.
 * Previously, non-string values (numbers, booleans) would pass through incorrectly.
 */
function extractFilePath(args: Record<string, unknown>): string | undefined {
  // Check each potential path argument and validate it's actually a string
  const candidates = [args.path, args.file_path, args.filename];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Severity mapping for failure types
 */
const FAILURE_SEVERITY_MAP: Record<FailureType, FailureSeverity> = {
  tool_error: 'medium',
  repeated_failure: 'high',
  no_progress: 'medium',
  loop_detected: 'high',
  validation_error: 'low',
  timeout: 'medium',
  custom: 'medium',
};

/**
 * Recovery strategy for a failure pattern
 * PRD-001 P1: Enhanced failure patterns with recovery strategies
 */
export interface RecoveryStrategy {
  /** Strategy type for handling the failure */
  strategy: 'retry' | 'search_alternative' | 'reread_and_retry' | 'broaden_search' | 'escalate' | 'background_retry' | 'simplify' | 'verify_first' | 'different_approach';
  /** Prompt to guide the AI in recovery */
  prompt: string;
  /** Maximum retries for this specific pattern */
  maxRetries: number;
}

/**
 * Enhanced error pattern with recovery strategy
 */
interface ErrorPatternWithRecovery {
  pattern: RegExp;
  type: FailureType;
  severity: FailureSeverity;
  recovery: RecoveryStrategy;
}

/**
 * Common error patterns that indicate specific failure types
 * PRD-001 P1: Expanded from 6 to 25+ patterns with recovery strategies
 */
const ERROR_PATTERNS: ErrorPatternWithRecovery[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // FILE SYSTEM ERRORS
  // ═══════════════════════════════════════════════════════════════════════════

  // File not found - search for alternatives
  {
    pattern: /ENOENT|no such file|file not found|does not exist/i,
    type: 'tool_error',
    severity: 'medium',
    recovery: {
      strategy: 'search_alternative',
      prompt: 'File not found. Search for similar filenames or check the path. The file may have been moved, renamed, or may not exist yet.',
      maxRetries: 2,
    },
  },

  // Permission denied - escalate to user
  {
    pattern: /EACCES|permission denied|access denied|operation not permitted/i,
    type: 'tool_error',
    severity: 'high',
    recovery: {
      strategy: 'escalate',
      prompt: 'Permission denied. Report this to the user - do not attempt sudo or permission changes. Suggest alternative approaches.',
      maxRetries: 0,
    },
  },

  // Directory not found
  {
    pattern: /ENOTDIR|not a directory|is a file/i,
    type: 'tool_error',
    severity: 'medium',
    recovery: {
      strategy: 'verify_first',
      prompt: 'Path issue detected. Verify the path exists and is the correct type (file vs directory) before retrying.',
      maxRetries: 1,
    },
  },

  // File already exists
  {
    pattern: /EEXIST|already exists|file exists/i,
    type: 'tool_error',
    severity: 'low',
    recovery: {
      strategy: 'different_approach',
      prompt: 'File already exists. Consider editing the existing file instead of creating a new one, or ask user if overwrite is intended.',
      maxRetries: 1,
    },
  },

  // Disk space
  {
    pattern: /ENOSPC|no space left|disk full|out of space/i,
    type: 'tool_error',
    severity: 'critical',
    recovery: {
      strategy: 'escalate',
      prompt: 'Disk full. Report to user immediately. This requires manual intervention to free disk space.',
      maxRetries: 0,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EDIT/REPLACE ERRORS
  // ═══════════════════════════════════════════════════════════════════════════

  // Edit target not found - reread file
  {
    pattern: /old_string not found|no match for replacement|string not found|text to replace not found/i,
    type: 'tool_error',
    severity: 'high',
    recovery: {
      strategy: 'reread_and_retry',
      prompt: 'Edit target not found. The file may have changed. Re-read the file to get current content, then adjust the edit with the exact text.',
      maxRetries: 2,
    },
  },

  // Multiple matches for edit
  {
    pattern: /multiple matches|not unique|ambiguous|found \d+ occurrences/i,
    type: 'tool_error',
    severity: 'medium',
    recovery: {
      strategy: 'reread_and_retry',
      prompt: 'Edit target is not unique. Provide more context around the string to make it unique, or use replace_all if all occurrences should change.',
      maxRetries: 2,
    },
  },

  // File not read before edit
  {
    pattern: /must read.*before edit|haven't read.*file|read the file first/i,
    type: 'tool_error',
    severity: 'high',
    recovery: {
      strategy: 'verify_first',
      prompt: 'You must read the file before editing it. Use view_file first to understand the current content, then make your edit.',
      maxRetries: 1,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH ERRORS
  // ═══════════════════════════════════════════════════════════════════════════

  // No search results
  {
    pattern: /no matches found|nothing found|0 results|no files matched/i,
    type: 'no_progress',
    severity: 'low',
    recovery: {
      strategy: 'broaden_search',
      prompt: 'No matches found. Try broader search terms, different patterns, or search in different directories. Consider alternative naming conventions.',
      maxRetries: 3,
    },
  },

  // Invalid regex pattern
  {
    pattern: /invalid regex|regex error|invalid pattern|bad pattern/i,
    type: 'validation_error',
    severity: 'medium',
    recovery: {
      strategy: 'simplify',
      prompt: 'Invalid regex pattern. Simplify the pattern or escape special characters. Remember ripgrep uses different syntax than grep.',
      maxRetries: 2,
    },
  },

  // Too many results
  {
    pattern: /too many results|result limit exceeded|truncated/i,
    type: 'no_progress',
    severity: 'low',
    recovery: {
      strategy: 'simplify',
      prompt: 'Too many results. Narrow your search with more specific patterns, file type filters, or directory constraints.',
      maxRetries: 2,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNTAX/VALIDATION ERRORS
  // ═══════════════════════════════════════════════════════════════════════════

  // JSON parse error
  {
    pattern: /JSON\.parse|unexpected token|invalid json|json syntax/i,
    type: 'validation_error',
    severity: 'medium',
    recovery: {
      strategy: 'verify_first',
      prompt: 'JSON parse error. Check the JSON syntax - look for missing commas, brackets, or quotes. Validate the JSON before retrying.',
      maxRetries: 2,
    },
  },

  // YAML parse error
  {
    pattern: /yaml.*error|invalid yaml|yaml syntax|indentation error/i,
    type: 'validation_error',
    severity: 'medium',
    recovery: {
      strategy: 'verify_first',
      prompt: 'YAML parse error. Check indentation (must be consistent spaces, not tabs) and syntax. Validate the YAML structure.',
      maxRetries: 2,
    },
  },

  // General syntax error
  {
    pattern: /syntax error|parse error|unexpected token|unexpected end/i,
    type: 'validation_error',
    severity: 'medium',
    recovery: {
      strategy: 'reread_and_retry',
      prompt: 'Syntax error detected. Review the code for missing brackets, semicolons, or typos. Check the specific line mentioned in the error.',
      maxRetries: 2,
    },
  },

  // Type error
  {
    pattern: /type error|type mismatch|incompatible type|cannot assign/i,
    type: 'validation_error',
    severity: 'medium',
    recovery: {
      strategy: 'reread_and_retry',
      prompt: 'Type error detected. Review the types involved and ensure they are compatible. Check function signatures and variable declarations.',
      maxRetries: 2,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMAND EXECUTION ERRORS
  // ═══════════════════════════════════════════════════════════════════════════

  // Command not found
  {
    pattern: /command not found|not recognized|unknown command|executable not found/i,
    type: 'tool_error',
    severity: 'medium',
    recovery: {
      strategy: 'different_approach',
      prompt: 'Command not found. Check if the tool is installed, or try an alternative command. Suggest installing the required tool if appropriate.',
      maxRetries: 1,
    },
  },

  // Timeout
  {
    pattern: /timeout|timed out|deadline exceeded|operation.*timeout/i,
    type: 'timeout',
    severity: 'medium',
    recovery: {
      strategy: 'background_retry',
      prompt: 'Operation timed out. Consider running in background, breaking into smaller steps, or increasing timeout. Report progress to user.',
      maxRetries: 1,
    },
  },

  // Exit code non-zero
  {
    pattern: /exit code [1-9]|exited with [1-9]|non-zero exit|failed with code/i,
    type: 'tool_error',
    severity: 'medium',
    recovery: {
      strategy: 'retry',
      prompt: 'Command failed with non-zero exit code. Check the error output for details and adjust the command or fix the underlying issue.',
      maxRetries: 2,
    },
  },

  // Out of memory
  {
    pattern: /out of memory|ENOMEM|memory.*exceeded|heap.*limit/i,
    type: 'tool_error',
    severity: 'critical',
    recovery: {
      strategy: 'simplify',
      prompt: 'Out of memory. Break the operation into smaller chunks, process fewer files at once, or use streaming approaches.',
      maxRetries: 1,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GIT ERRORS
  // ═══════════════════════════════════════════════════════════════════════════

  // Git conflict
  {
    pattern: /merge conflict|conflict.*marker|<<<<<<|>>>>>>|=======/,
    type: 'tool_error',
    severity: 'high',
    recovery: {
      strategy: 'escalate',
      prompt: 'Merge conflict detected. Report to user with the conflicting files. Do not attempt automatic resolution without explicit approval.',
      maxRetries: 0,
    },
  },

  // Git dirty working tree
  {
    pattern: /uncommitted changes|working tree.*dirty|changes.*uncommitted/i,
    type: 'tool_error',
    severity: 'medium',
    recovery: {
      strategy: 'escalate',
      prompt: 'Uncommitted changes detected. Ask user how to proceed: commit, stash, or discard changes before continuing.',
      maxRetries: 0,
    },
  },

  // Git not a repository
  {
    pattern: /not a git repository|git.*not found|fatal: not a git/i,
    type: 'tool_error',
    severity: 'medium',
    recovery: {
      strategy: 'escalate',
      prompt: 'Not a git repository. This operation requires git. Ask user if they want to initialize a repository.',
      maxRetries: 0,
    },
  },

  // Git authentication failed
  {
    pattern: /authentication failed|invalid credentials|auth.*failed|could not read.*credentials/i,
    type: 'tool_error',
    severity: 'high',
    recovery: {
      strategy: 'escalate',
      prompt: 'Git authentication failed. Report to user - they may need to configure credentials, SSH keys, or personal access tokens.',
      maxRetries: 0,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NETWORK ERRORS
  // ═══════════════════════════════════════════════════════════════════════════

  // Connection refused/failed
  {
    pattern: /ECONNREFUSED|connection refused|network.*unreachable|host not found/i,
    type: 'tool_error',
    severity: 'medium',
    recovery: {
      strategy: 'retry',
      prompt: 'Network connection failed. Check if the service is running and the address is correct. Retry after a brief wait.',
      maxRetries: 2,
    },
  },

  // Rate limit
  {
    pattern: /rate limit|too many requests|429|throttled/i,
    type: 'tool_error',
    severity: 'medium',
    recovery: {
      strategy: 'retry',
      prompt: 'Rate limited. Wait before retrying. Consider reducing request frequency or batching operations.',
      maxRetries: 2,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROGRESS INDICATORS
  // ═══════════════════════════════════════════════════════════════════════════

  // Stuck in loop
  {
    pattern: /infinite loop|maximum.*iterations|recursion.*limit|stack overflow/i,
    type: 'loop_detected',
    severity: 'high',
    recovery: {
      strategy: 'different_approach',
      prompt: 'Possible infinite loop or recursion detected. Step back and reconsider the approach. Add termination conditions or limits.',
      maxRetries: 1,
    },
  },

  // Test failures
  {
    pattern: /test.*failed|tests.*failing|\d+ failed|FAIL.*test/i,
    type: 'tool_error',
    severity: 'medium',
    recovery: {
      strategy: 'reread_and_retry',
      prompt: 'Tests are failing. Review the test output, understand why, and fix the code or tests before proceeding.',
      maxRetries: 2,
    },
  },

  // Lint errors
  {
    pattern: /lint.*error|eslint.*error|prettier.*error|formatting.*error/i,
    type: 'validation_error',
    severity: 'low',
    recovery: {
      strategy: 'retry',
      prompt: 'Lint/formatting errors detected. Fix the issues or run the auto-fix command, then retry.',
      maxRetries: 2,
    },
  },
];

/**
 * FailureDetector - Identifies failures and determines correction eligibility
 */
export class FailureDetector {
  private state: FailureDetectorState;
  private options: FailureDetectionOptions;
  private customPatterns: RegExp[];

  constructor(options: Partial<FailureDetectionOptions> = {}) {
    this.options = { ...DEFAULT_FAILURE_DETECTION_OPTIONS, ...options };
    this.customPatterns = this.options.customPatterns.map(p => new RegExp(p, 'i'));
    this.state = this.createInitialState();
  }

  /**
   * Create fresh detector state
   */
  private createInitialState(): FailureDetectorState {
    return {
      records: new Map(),
      recentCalls: [],
      totalFailures: 0,
      totalCorrections: 0,
      successfulCorrections: 0,
    };
  }

  /**
   * Analyze a tool result and detect any failures
   *
   * @param toolCall - The tool call that was executed
   * @param result - The result from execution
   * @param loopResult - Optional loop detection result
   * @returns FailureSignal if failure detected, null otherwise
   */
  detectFailure(
    toolCall: LLMToolCall,
    result: ToolResult,
    loopResult?: LoopDetectionResult
  ): FailureSignal | null {
    // Parse arguments safely
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(toolCall.function.arguments || '{}');
    } catch {
      args = {};
    }

    // Record this call
    this.recordCall(toolCall, result);

    // Check for various failure conditions
    const failure = this.checkForFailure(toolCall, result, args, loopResult);

    if (failure) {
      this.recordFailure(failure);
      return failure;
    }

    return null;
  }

  /**
   * Check all failure conditions
   */
  private checkForFailure(
    toolCall: LLMToolCall,
    result: ToolResult,
    args: Record<string, unknown>,
    loopResult?: LoopDetectionResult
  ): FailureSignal | null {
    const toolName = toolCall.function.name;
    const filePath = extractFilePath(args);
    const signature = this.createSignature(toolName, args);

    // 1. Check for tool execution error
    if (!result.success) {
      return this.createFailureSignal(
        'tool_error',
        toolName,
        args,
        result.error,
        filePath,
        undefined,
        signature
      );
    }

    // 2. Check for loop detection
    if (this.options.includeLoopDetection && loopResult?.isLoop) {
      return this.createFailureSignal(
        'loop_detected',
        toolName,
        args,
        loopResult.reason,
        filePath,
        loopResult,
        signature
      );
    }

    // 3. Check for repeated failures (same signature failed before)
    const record = this.state.records.get(this.signatureToString(signature));
    if (record && record.failures.length >= 2 && !record.everSucceeded) {
      return this.createFailureSignal(
        'repeated_failure',
        toolName,
        args,
        `Same operation failed ${record.failures.length} times`,
        filePath,
        undefined,
        signature
      );
    }

    // 4. Check for custom patterns in output
    const output = result.output || '';
    for (let i = 0; i < this.customPatterns.length; i++) {
      if (this.customPatterns[i].test(output)) {
        return this.createFailureSignal(
          'custom',
          toolName,
          args,
          `Custom pattern matched: ${this.options.customPatterns[i]}`,
          filePath,
          undefined,
          signature,
          this.options.customPatterns[i]
        );
      }
    }

    // 5. Check for known error patterns in successful but problematic results
    const errorPattern = this.matchErrorPattern(output);
    if (errorPattern) {
      return this.createFailureSignal(
        errorPattern.type,
        toolName,
        args,
        `Pattern detected: ${errorPattern.pattern.source}`,
        filePath,
        undefined,
        signature
      );
    }

    // No failure detected
    return null;
  }

  /**
   * Match output against known error patterns
   * PRD-001 P1: Returns recovery strategy along with pattern match
   */
  private matchErrorPattern(
    output: string
  ): ErrorPatternWithRecovery | null {
    for (const errorPattern of ERROR_PATTERNS) {
      if (errorPattern.pattern.test(output)) {
        return errorPattern;
      }
    }
    return null;
  }

  /**
   * Get recovery strategy for a failure type and error message
   * PRD-001 P1: Enhanced recovery strategy lookup
   */
  getRecoveryStrategy(type: FailureType, errorMessage?: string): RecoveryStrategy | null {
    // BUG FIX: Check for undefined/null explicitly, not falsiness
    // Empty string "" is falsy but should still be checked against patterns
    if (errorMessage !== undefined && errorMessage !== null && errorMessage.length > 0) {
      const pattern = this.matchErrorPattern(errorMessage);
      if (pattern) {
        return pattern.recovery;
      }
    }

    // Default recovery strategies by type
    const defaultStrategies: Record<FailureType, RecoveryStrategy> = {
      tool_error: {
        strategy: 'retry',
        prompt: 'Tool error occurred. Review the error message and adjust parameters.',
        maxRetries: 2,
      },
      repeated_failure: {
        strategy: 'different_approach',
        prompt: 'This operation has failed multiple times. Try a completely different approach.',
        maxRetries: 1,
      },
      no_progress: {
        strategy: 'broaden_search',
        prompt: 'No meaningful progress. Re-evaluate your approach and try different methods.',
        maxRetries: 3,
      },
      loop_detected: {
        strategy: 'different_approach',
        prompt: 'Loop detected. Step back and try a fundamentally different strategy.',
        maxRetries: 1,
      },
      validation_error: {
        strategy: 'verify_first',
        prompt: 'Validation error. Check the input format and syntax before retrying.',
        maxRetries: 2,
      },
      timeout: {
        strategy: 'background_retry',
        prompt: 'Operation timed out. Consider background execution or breaking into smaller steps.',
        maxRetries: 1,
      },
      custom: {
        strategy: 'retry',
        prompt: 'Custom pattern detected. Review and adjust.',
        maxRetries: 2,
      },
    };

    return defaultStrategies[type] || null;
  }

  /**
   * Create a failure signal
   */
  private createFailureSignal(
    type: FailureType,
    toolName: string,
    args: Record<string, unknown>,
    errorMessage: string | undefined,
    filePath: string | undefined,
    loopResult: LoopDetectionResult | undefined,
    signature: FailureSignature,
    matchedPattern?: string
  ): FailureSignal {
    const record = this.state.records.get(this.signatureToString(signature));
    const attemptCount = record ? record.failures.length + 1 : 1;

    // Determine severity
    let severity = FAILURE_SEVERITY_MAP[type];

    // Escalate severity for repeated failures
    if (attemptCount >= 3) {
      severity = 'high';
    }
    if (attemptCount >= 5) {
      severity = 'critical';
    }

    const context: FailureContext = {
      toolName,
      toolArgs: args,
      errorMessage,
      attemptCount,
      filePath,
      loopResult,
      matchedPattern,
      timestamp: new Date(),
    };

    return {
      id: generateFailureId(),
      type,
      severity,
      context,
      suggestion: this.generateSuggestion(type, toolName, args, errorMessage),
      recoverable: this.isRecoverable(type, severity, attemptCount),
    };
  }

  /**
   * Generate a suggestion for fixing the failure
   * PRD-001 P1: Uses recovery strategies from pattern matching
   */
  private generateSuggestion(
    type: FailureType,
    toolName: string,
    _args: Record<string, unknown>,
    errorMessage?: string
  ): string {
    // First, try to get suggestion from matched pattern's recovery strategy
    if (errorMessage) {
      const pattern = this.matchErrorPattern(errorMessage);
      if (pattern) {
        return pattern.recovery.prompt;
      }
    }

    // Fall back to type-based suggestions
    switch (type) {
      case 'tool_error':
        if (errorMessage?.includes('not found')) {
          return `The file or resource may not exist. Try searching for it first or check the path.`;
        }
        if (errorMessage?.includes('permission')) {
          return `Permission denied. Check if the file is writable or try a different approach.`;
        }
        if (errorMessage?.includes('old_string not found')) {
          return `The text to replace was not found. Read the file first to get the exact content.`;
        }
        return `Review the error message and adjust the ${toolName} arguments accordingly.`;

      case 'repeated_failure':
        return `This operation has failed multiple times. Consider a completely different approach.`;

      case 'loop_detected':
        return `You appear to be repeating the same actions. Step back and try a new strategy.`;

      case 'no_progress':
        return `No meaningful progress is being made. Re-evaluate your approach to the problem.`;

      case 'validation_error':
        return `The tool arguments appear to be invalid. Check the expected format.`;

      case 'timeout':
        return `The operation timed out. Try breaking it into smaller steps or use a simpler approach.`;

      case 'custom':
        return `A problematic pattern was detected in the output. Review and adjust.`;

      default:
        return `An unexpected error occurred. Review and try again.`;
    }
  }

  /**
   * Get the maximum retries allowed for a specific failure
   * PRD-001 P1: Pattern-specific retry limits
   */
  getMaxRetriesForFailure(failure: FailureSignal): number {
    const errorMessage = failure.context.errorMessage;
    if (errorMessage) {
      const pattern = this.matchErrorPattern(errorMessage);
      if (pattern) {
        return pattern.recovery.maxRetries;
      }
    }
    // Default max retries
    return 2;
  }

  /**
   * Determine if a failure is recoverable through correction
   */
  private isRecoverable(
    _type: FailureType,
    severity: FailureSeverity,
    attemptCount: number
  ): boolean {
    // Too many attempts - not recoverable
    if (attemptCount >= 5) {
      return false;
    }

    // Critical severity usually means fundamental issue
    if (severity === 'critical') {
      return false;
    }

    // Most failure types are recoverable with reflection
    return true;
  }

  /**
   * Create a signature for a tool call
   */
  private createSignature(
    toolName: string,
    args: Record<string, unknown>
  ): FailureSignature {
    return {
      tool: toolName,
      argsHash: hashArgs(args),
      filePath: extractFilePath(args),
    };
  }

  /**
   * Convert signature to string key
   */
  private signatureToString(sig: FailureSignature): string {
    return `${sig.tool}:${sig.argsHash}:${sig.filePath || ''}`;
  }

  /**
   * Record a tool call in history
   */
  private recordCall(toolCall: LLMToolCall, result: ToolResult): void {
    this.state.recentCalls.push({
      toolCall,
      result,
      timestamp: new Date(),
    });

    // Trim history
    const cutoff = Date.now() - this.options.failureHistoryWindowMs;
    this.state.recentCalls = this.state.recentCalls.filter(
      c => c.timestamp.getTime() > cutoff
    );
  }

  /**
   * Record a detected failure
   */
  private recordFailure(failure: FailureSignal): void {
    const sigStr = this.signatureToString({
      tool: failure.context.toolName,
      argsHash: hashArgs(failure.context.toolArgs),
      filePath: failure.context.filePath,
    });

    let record = this.state.records.get(sigStr);
    if (!record) {
      record = {
        signature: {
          tool: failure.context.toolName,
          argsHash: hashArgs(failure.context.toolArgs),
          filePath: failure.context.filePath,
        },
        failures: [],
        correctionAttempts: 0,
        everSucceeded: false,
        lastFailureAt: new Date(),
      };
      this.state.records.set(sigStr, record);
    }

    record.failures.push(failure);
    record.lastFailureAt = new Date();

    // Trim failures per signature
    if (record.failures.length > this.options.maxFailuresPerSignature) {
      record.failures = record.failures.slice(-this.options.maxFailuresPerSignature);
    }

    this.state.totalFailures++;
  }

  /**
   * Record that a correction was attempted
   */
  recordCorrectionAttempt(failure: FailureSignal, succeeded: boolean): void {
    const sigStr = this.signatureToString({
      tool: failure.context.toolName,
      argsHash: hashArgs(failure.context.toolArgs),
      filePath: failure.context.filePath,
    });

    const record = this.state.records.get(sigStr);
    if (record) {
      record.correctionAttempts++;
      if (succeeded) {
        record.everSucceeded = true;
        this.state.successfulCorrections++;
      }
    }

    this.state.totalCorrections++;
  }

  /**
   * Check if correction should be attempted for a failure
   */
  shouldAttemptCorrection(failure: FailureSignal): boolean {
    // Not recoverable
    if (!failure.recoverable) {
      return false;
    }

    // Below minimum severity threshold
    const severityOrder: FailureSeverity[] = ['low', 'medium', 'high', 'critical'];
    const failureSeverityIndex = severityOrder.indexOf(failure.severity);
    const minSeverityIndex = severityOrder.indexOf(this.options.minSeverityForCorrection);

    if (failureSeverityIndex < minSeverityIndex) {
      return false;
    }

    return true;
  }

  /**
   * Get current detector statistics
   */
  getStats(): {
    totalFailures: number;
    totalCorrections: number;
    successfulCorrections: number;
    activeRecords: number;
    successRate: number;
  } {
    const successRate = this.state.totalCorrections > 0
      ? this.state.successfulCorrections / this.state.totalCorrections
      : 0;

    return {
      totalFailures: this.state.totalFailures,
      totalCorrections: this.state.totalCorrections,
      successfulCorrections: this.state.successfulCorrections,
      activeRecords: this.state.records.size,
      successRate,
    };
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.state = this.createInitialState();
  }

  /**
   * Clean up old records
   */
  cleanup(): void {
    const cutoff = Date.now() - this.options.failureHistoryWindowMs;

    // Convert to array first to avoid modifying Map during iteration
    // This prevents potential issues with iterator invalidation
    const keysToDelete: string[] = [];
    for (const [key, record] of this.state.records) {
      if (record.lastFailureAt.getTime() < cutoff) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.state.records.delete(key);
    }
  }
}
