/**
 * Reflection Prompt Templates
 *
 * Templates for prompting the LLM to reflect on failures
 * and propose corrections.
 *
 * @module agent/correction/reflection-prompts
 */

import type { FailureSignal, FailureType } from './types.js';
import type { ReflectionDepth } from '../config/agentic-config.js';

// ============================================================================
// Prompt Templates
// ============================================================================

/**
 * Base reflection prompt structure
 */
const BASE_REFLECTION_TEMPLATE = `
The previous operation failed and needs correction.

## Failure Details
- **Operation**: {toolName}
- **Failure Type**: {failureType}
- **Error**: {errorMessage}
- **Attempts**: {attemptCount}
{filePathSection}

## Your Task
1. **Analyze**: What went wrong? Why did this approach fail?
2. **Reflect**: What assumptions were incorrect?
3. **Propose**: What alternative approach would work better?
4. **Execute**: Implement the corrected solution.

{additionalContext}

Please think step-by-step about the failure, then take corrective action.
`;

/**
 * Type-specific context additions
 */
const TYPE_SPECIFIC_CONTEXT: Record<FailureType, string> = {
  tool_error: `
## Guidance for Tool Errors
- Check if the file/resource exists before operating on it
- Verify the exact content matches what you expect
- Use search tools to find the correct path or content
- Consider if permissions might be an issue`,

  repeated_failure: `
## Guidance for Repeated Failures
- The same approach has failed multiple times
- You MUST try a fundamentally different strategy
- Consider if your understanding of the problem is incorrect
- Step back and re-read the original requirements`,

  loop_detected: `
## Guidance for Loop Detection
- You appear to be repeating similar actions without progress
- Break the pattern by trying something completely different
- Consider if you're missing information needed to proceed
- Ask clarifying questions if the requirements are unclear`,

  no_progress: `
## Guidance for No Progress
- The recent actions have not moved toward the goal
- Re-evaluate what the actual goal is
- Check if there are prerequisites you've missed
- Consider if the task needs to be broken into smaller steps`,

  validation_error: `
## Guidance for Validation Errors
- The tool arguments appear to be malformed
- Check the expected schema for this tool
- Ensure all required fields are present
- Verify data types match expectations`,

  timeout: `
## Guidance for Timeouts
- The operation took too long to complete
- Break the task into smaller, faster operations
- Consider if there's a simpler approach
- Check if external services are available`,

  custom: `
## Guidance
- A problematic pattern was detected in the output
- Review what triggered this detection
- Consider if the approach needs adjustment`,
};

/**
 * Deep context template (includes recent history)
 */
const DEEP_CONTEXT_TEMPLATE = `
## Recent History
The following actions were taken before this failure:
{recentHistory}

## Patterns Observed
{patterns}
`;

// ============================================================================
// Prompt Builder
// ============================================================================

export interface ReflectionPromptOptions {
  /** The failure to reflect on */
  failure: FailureSignal;

  /** Depth of context to include */
  depth: ReflectionDepth;

  /** Recent chat history (for deep context) */
  recentHistory?: Array<{
    role: string;
    content: string;
    toolName?: string;
  }>;

  /** Original task description */
  originalTask?: string;

  /** Any additional context */
  additionalContext?: string;
}

/**
 * Build a reflection prompt for the given failure
 */
export function buildReflectionPrompt(options: ReflectionPromptOptions): string {
  const { failure, depth, recentHistory, originalTask, additionalContext } = options;

  // Build file path section
  const filePathSection = failure.context.filePath
    ? `- **File**: \`${failure.context.filePath}\``
    : '';

  // Get type-specific context
  const typeContext = TYPE_SPECIFIC_CONTEXT[failure.type] || '';

  // Build additional context section
  let contextSection = typeContext;

  if (failure.suggestion) {
    contextSection += `\n\n## Suggestion\n${failure.suggestion}`;
  }

  if (originalTask) {
    contextSection += `\n\n## Original Task\n${originalTask}`;
  }

  if (additionalContext) {
    contextSection += `\n\n## Additional Context\n${additionalContext}`;
  }

  // Add deep context if requested
  if (depth === 'deep' && recentHistory && recentHistory.length > 0) {
    const historyStr = recentHistory
      .slice(-5) // Last 5 entries
      .map((entry, i) => {
        if (entry.toolName) {
          return `${i + 1}. [${entry.role}] Called ${entry.toolName}`;
        }
        return `${i + 1}. [${entry.role}] ${entry.content.substring(0, 100)}...`;
      })
      .join('\n');

    const patterns = analyzePatterns(recentHistory);

    contextSection += DEEP_CONTEXT_TEMPLATE
      .replace('{recentHistory}', historyStr)
      .replace('{patterns}', patterns || 'No specific patterns detected.');
  }

  // Build final prompt
  return BASE_REFLECTION_TEMPLATE
    .replace('{toolName}', failure.context.toolName)
    .replace('{failureType}', formatFailureType(failure.type))
    .replace('{errorMessage}', failure.context.errorMessage || 'Unknown error')
    .replace('{attemptCount}', String(failure.context.attemptCount))
    .replace('{filePathSection}', filePathSection)
    .replace('{additionalContext}', contextSection)
    .trim();
}

/**
 * Format failure type for display
 */
function formatFailureType(type: FailureType): string {
  const mapping: Record<FailureType, string> = {
    tool_error: 'Tool Execution Error',
    repeated_failure: 'Repeated Failure',
    loop_detected: 'Loop Detected',
    no_progress: 'No Progress',
    validation_error: 'Validation Error',
    timeout: 'Operation Timeout',
    custom: 'Custom Pattern Match',
  };
  return mapping[type] || type;
}

/**
 * Analyze patterns in recent history
 */
function analyzePatterns(
  history: Array<{ role: string; content: string; toolName?: string }>
): string {
  const patterns: string[] = [];

  // Check for repeated tool calls
  const toolCalls = history.filter(h => h.toolName).map(h => h.toolName);
  const toolCounts = new Map<string, number>();
  for (const tool of toolCalls) {
    if (tool) {
      toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
    }
  }

  for (const [tool, count] of toolCounts) {
    if (count >= 2) {
      patterns.push(`- Tool "${tool}" called ${count} times`);
    }
  }

  // Check for alternating patterns (A→B→A→B)
  if (toolCalls.length >= 4) {
    const last4 = toolCalls.slice(-4);
    if (last4[0] === last4[2] && last4[1] === last4[3] && last4[0] !== last4[1]) {
      patterns.push(`- Alternating pattern detected: ${last4[0]} ↔ ${last4[1]}`);
    }
  }

  return patterns.join('\n');
}

// ============================================================================
// Quick Reflection Prompts
// ============================================================================

/**
 * Quick prompt for simple failures (shallow depth)
 */
export function buildQuickReflectionPrompt(failure: FailureSignal): string {
  return `The ${failure.context.toolName} operation failed: ${failure.context.errorMessage || 'Unknown error'}

This has happened ${failure.context.attemptCount} time(s).

${failure.suggestion || 'Please analyze what went wrong and try a different approach.'}`;
}

/**
 * Prompt for retry exhaustion (no more retries available)
 */
export function buildExhaustionPrompt(failure: FailureSignal, totalAttempts: number): string {
  return `I have attempted the "${failure.context.toolName}" operation ${totalAttempts} times without success.

The consistent failure suggests a fundamental issue with this approach. I need to:
1. Completely abandon this strategy
2. Re-read the requirements
3. Consider an entirely different solution

Let me step back and think about this problem differently.`;
}

/**
 * Prompt for acknowledging successful correction
 */
export function buildSuccessAcknowledgment(
  failure: FailureSignal,
  attemptNumber: number
): string {
  return `The corrected approach succeeded on attempt ${attemptNumber}.

Key learning: ${failure.suggestion || 'The original approach had issues that required adjustment.'}`;
}
