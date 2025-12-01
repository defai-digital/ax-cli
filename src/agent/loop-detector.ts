/**
 * Intelligent Loop Detection System
 *
 * Based on Claude Code and industry best practices:
 * 1. Progress-based detection (checks if state changes)
 * 2. Tool-specific thresholds (different tools have different legitimate repeat patterns)
 * 3. Sequence pattern detection (A→B→A→B cycles)
 * 4. Configurable and transparent
 *
 * Key insight: The problem isn't repeated tool calls, it's repeated tool calls
 * that don't make progress. Creating 10 files is fine. Trying to edit the same
 * file 10 times with the same failing edit is not.
 */

import { LLMToolCall } from "../llm/client.js";
import { AGENT_CONFIG } from "../constants.js";

/**
 * Tool call record with context for intelligent detection
 */
interface ToolCallRecord {
  signature: string;
  toolName: string;
  args: Record<string, unknown>;
  timestamp: number;
  /** Result of the tool call (success/failure) */
  success?: boolean;
  /** File path if applicable */
  filePath?: string;
  /** Hash of output for state-change detection */
  outputHash?: string;
}

/**
 * Configuration for tool-specific thresholds
 * Higher thresholds for tools that are legitimately called repeatedly
 */
const TOOL_THRESHOLDS: Record<string, number> = {
  // File exploration - often need to view many files
  view_file: 10,
  read_file: 10,
  list_files: 8,

  // File creation - creating multiple files is normal
  create_file: 15,
  write_to_file: 15,

  // Editing - more restrictive since repeated edits usually mean failure
  str_replace_editor: 4,

  // Search - may need multiple searches
  search_files: 6,
  search: 6,

  // Bash - varies widely, use moderate threshold
  bash: 8,
  execute_bash: 8,

  // Todo list - frequently updated
  create_todo_list: 3,
  update_todo_list: 10,  // Higher because progress updates are normal

  // Default for unknown tools
  default: 5,
};

/**
 * Tools that should be tracked by unique path/target
 * These count repetitions per-target rather than globally
 */
const PATH_TRACKED_TOOLS = new Set([
  'view_file',
  'read_file',
  'create_file',
  'write_to_file',
  'str_replace_editor',
]);

/**
 * Tools where failure should lower the threshold
 * (repeated failures are more likely to be loops)
 */
const FAILURE_SENSITIVE_TOOLS = new Set([
  'str_replace_editor',
  'bash',
  'execute_bash',
]);

export interface LoopDetectionResult {
  isLoop: boolean;
  reason?: string;
  suggestion?: string;
  /** Current count for this signature */
  count: number;
  /** Threshold that would trigger loop detection */
  threshold: number;
}

export class LoopDetector {
  /** Recent tool calls with full context */
  private callHistory: ToolCallRecord[] = [];

  /** Signature -> count for quick lookup */
  private signatureCounts: Map<string, number> = new Map();

  /** Signature -> consecutive failure count */
  private failureCounts: Map<string, number> = new Map();

  /** Last N signatures for sequence detection */
  private recentSequence: string[] = [];

  /** Maximum history size */
  private maxHistorySize = 100;

  /** Maximum sequence length for pattern detection */
  private maxSequenceLength = 20;

  /**
   * Check if a tool call would create a loop
   * Call this BEFORE executing the tool
   */
  checkForLoop(toolCall: LLMToolCall): LoopDetectionResult {
    // Check if loop detection is disabled
    if (!AGENT_CONFIG.ENABLE_LOOP_DETECTION) {
      return { isLoop: false, count: 0, threshold: Infinity };
    }

    try {
      const args = this.parseArgs(toolCall);
      const signature = this.createSignature(toolCall.function.name, args);
      const threshold = this.getThreshold(toolCall.function.name, signature);

      const currentCount = this.signatureCounts.get(signature) || 0;
      const failureCount = this.failureCounts.get(signature) || 0;

      // Adjust threshold based on failures
      const adjustedThreshold = this.adjustThresholdForFailures(
        toolCall.function.name,
        threshold,
        failureCount
      );

      // Check 1: Simple count-based detection with tool-specific threshold
      if (currentCount >= adjustedThreshold) {
        return {
          isLoop: true,
          reason: `Tool "${toolCall.function.name}" called ${currentCount + 1} times with same signature (threshold: ${adjustedThreshold})`,
          suggestion: this.getSuggestion(toolCall.function.name, args),
          count: currentCount + 1,
          threshold: adjustedThreshold,
        };
      }

      // Check 2: Sequence pattern detection (A→B→A→B cycles)
      const cycleResult = this.detectCycle(signature);
      if (cycleResult.isLoop) {
        return {
          ...cycleResult,
          count: currentCount + 1,
          threshold: adjustedThreshold,
        };
      }

      return {
        isLoop: false,
        count: currentCount + 1,
        threshold: adjustedThreshold,
      };

    } catch {
      // On parse error, don't block
      return { isLoop: false, count: 0, threshold: Infinity };
    }
  }

  /**
   * Record a tool call after execution
   * Call this AFTER executing the tool
   */
  recordToolCall(
    toolCall: LLMToolCall,
    success: boolean,
    outputHash?: string
  ): void {
    const args = this.parseArgs(toolCall);
    const signature = this.createSignature(toolCall.function.name, args);
    const filePath = this.extractFilePath(args);

    // Record in history
    const record: ToolCallRecord = {
      signature,
      toolName: toolCall.function.name,
      args,
      timestamp: Date.now(),
      success,
      filePath,
      outputHash,
    };

    this.callHistory.push(record);

    // Update signature count
    const count = (this.signatureCounts.get(signature) || 0) + 1;
    this.signatureCounts.set(signature, count);

    // Update failure count
    if (!success) {
      const failures = (this.failureCounts.get(signature) || 0) + 1;
      this.failureCounts.set(signature, failures);
    } else {
      // Reset failure count on success
      this.failureCounts.delete(signature);
    }

    // Update sequence
    this.recentSequence.push(signature);
    if (this.recentSequence.length > this.maxSequenceLength) {
      this.recentSequence.shift();
    }

    // Cleanup old entries
    this.cleanup();
  }

  /**
   * Reset all tracking (call at start of new conversation)
   */
  reset(): void {
    this.callHistory = [];
    this.signatureCounts.clear();
    this.failureCounts.clear();
    this.recentSequence = [];
  }

  /**
   * Get current stats for debugging
   */
  getStats(): {
    historySize: number;
    uniqueSignatures: number;
    failedSignatures: number;
  } {
    return {
      historySize: this.callHistory.length,
      uniqueSignatures: this.signatureCounts.size,
      failedSignatures: this.failureCounts.size,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private parseArgs(toolCall: LLMToolCall): Record<string, unknown> {
    if (!toolCall.function.arguments) {
      return {};
    }

    if (typeof toolCall.function.arguments === 'string') {
      try {
        return JSON.parse(toolCall.function.arguments);
      } catch {
        return { raw: toolCall.function.arguments };
      }
    }

    return toolCall.function.arguments as Record<string, unknown>;
  }

  private createSignature(toolName: string, args: Record<string, unknown>): string {
    // For path-tracked tools, use path as primary key
    if (PATH_TRACKED_TOOLS.has(toolName)) {
      const path = this.extractFilePath(args);
      if (path) {
        // For editors, include edit content hash to distinguish different edits
        if (toolName === 'str_replace_editor') {
          const oldStr = typeof args.old_str === 'string' ? args.old_str : '';
          const contentKey = this.hashString(oldStr.substring(0, 200));
          return `${toolName}:${path}:${contentKey}`;
        }
        return `${toolName}:${path}`;
      }
    }

    // For bash, use command as key
    if (toolName === 'bash' || toolName === 'execute_bash') {
      const cmd = typeof args.command === 'string'
        ? args.command.trim().replace(/\s+/g, ' ')
        : '';
      return `${toolName}:${cmd}`;
    }

    // For search, use query as key
    if (toolName === 'search' || toolName === 'search_files') {
      const query = typeof args.query === 'string'
        ? args.query.trim().toLowerCase()
        : '';
      return `${toolName}:${query}`;
    }

    // Default: tool name + stable hash of args
    return `${toolName}:${this.hashString(JSON.stringify(args))}`;
  }

  private extractFilePath(args: Record<string, unknown>): string | undefined {
    // Try common path argument names
    for (const key of ['path', 'file_path', 'filepath', 'file']) {
      if (typeof args[key] === 'string') {
        return args[key] as string;
      }
    }
    return undefined;
  }

  private getThreshold(toolName: string, _signature: string): number {
    // Use tool-specific threshold or default
    return TOOL_THRESHOLDS[toolName] || TOOL_THRESHOLDS.default;
  }

  private adjustThresholdForFailures(
    toolName: string,
    baseThreshold: number,
    failureCount: number
  ): number {
    // For failure-sensitive tools, reduce threshold based on consecutive failures
    if (FAILURE_SENSITIVE_TOOLS.has(toolName) && failureCount > 0) {
      // Each failure reduces threshold by 1, minimum of 2
      return Math.max(2, baseThreshold - failureCount);
    }
    return baseThreshold;
  }

  private detectCycle(currentSignature: string): LoopDetectionResult {
    // Need at least 4 items for a 2-element cycle (A-B-A-B)
    if (this.recentSequence.length < 4) {
      return { isLoop: false, count: 0, threshold: Infinity };
    }

    // Check for 2-element cycles (A-B-A-B pattern)
    const len = this.recentSequence.length;
    const last4 = [...this.recentSequence.slice(-3), currentSignature];

    if (last4[0] === last4[2] && last4[1] === last4[3]) {
      // Check if this pattern has repeated 3+ times
      let patternCount = 1;
      for (let i = len - 4; i >= 1; i -= 2) {
        if (this.recentSequence[i] === last4[1] && this.recentSequence[i - 1] === last4[0]) {
          patternCount++;
        } else {
          break;
        }
      }

      if (patternCount >= 3) {
        return {
          isLoop: true,
          reason: `Similar operation sequence repeated ${patternCount} times`,
          suggestion: 'I should step back and try a different approach to make progress.',
          count: patternCount,
          threshold: 3,
        };
      }
    }

    return { isLoop: false, count: 0, threshold: Infinity };
  }

  /** Lookup table for loop detection suggestions by tool name */
  private static readonly LOOP_SUGGESTIONS: Record<string, string> = {
    str_replace_editor: 'The text to replace may not match exactly. I should verify the file contents and adjust the search string.',
    bash: 'The command may need adjustment. I should check the error output and try a different approach.',
    execute_bash: 'The command may need adjustment. I should check the error output and try a different approach.',
    view_file: 'I may already have the information I need from previous reads.',
    read_file: 'I may already have the information I need from previous reads.',
    search: 'I should try a different search query or look in a different location.',
    search_files: 'I should try a different search query or look in a different location.',
  };

  private getSuggestion(toolName: string, _args: Record<string, unknown>): string {
    return LoopDetector.LOOP_SUGGESTIONS[toolName] ?? 'I should try a different approach.';
  }

  private hashString(str: string): string {
    // Simple hash for signature creation
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  private cleanup(): void {
    // Remove old history entries
    if (this.callHistory.length > this.maxHistorySize) {
      const removeCount = this.callHistory.length - this.maxHistorySize + 20;
      this.callHistory.splice(0, removeCount);
    }

    // Clean up signature counts for signatures not in recent history
    if (this.signatureCounts.size > this.maxHistorySize * 2) {
      const recentSignatures = new Set(
        this.callHistory.slice(-this.maxHistorySize).map(r => r.signature)
      );

      for (const sig of this.signatureCounts.keys()) {
        if (!recentSignatures.has(sig)) {
          this.signatureCounts.delete(sig);
          this.failureCounts.delete(sig);
        }
      }
    }
  }
}

/**
 * Singleton instance
 */
let loopDetectorInstance: LoopDetector | null = null;

export function getLoopDetector(): LoopDetector {
  if (!loopDetectorInstance) {
    loopDetectorInstance = new LoopDetector();
  }
  return loopDetectorInstance;
}

export function resetLoopDetector(): void {
  if (loopDetectorInstance) {
    loopDetectorInstance.reset();
  }
}
