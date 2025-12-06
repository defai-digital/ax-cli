/**
 * Parallel Tool Execution
 *
 * Classifies tools for safe parallel execution based on their side effects.
 * Read-only and isolated tools can run concurrently, while write operations
 * are executed sequentially to prevent race conditions.
 *
 * @packageDocumentation
 */

import type { LLMToolCall } from "../llm/client.js";

/**
 * Tool execution classification
 */
export type ToolExecutionMode = "parallel" | "sequential";

/**
 * Tool classification for parallel execution safety
 *
 * Categories:
 * - parallel: Safe to run concurrently (read-only, isolated external processes)
 * - sequential: Must run one at a time (file writes, stateful operations)
 */
/**
 * BUG FIX: Added missing tool classifications to ensure all tools
 * have explicit parallel/sequential classification
 */
export const TOOL_CLASSIFICATION: Record<string, ToolExecutionMode> = {
  // Read-only tools - safe to parallelize
  view_file: "parallel",
  search: "parallel",
  list_directory: "parallel",

  // External process tools - isolated, safe to parallelize
  ax_agent: "parallel",
  ax_agents_parallel: "parallel", // Internally manages its own parallelism

  // Write tools - must be sequential to prevent conflicts
  create_file: "sequential",
  str_replace_editor: "sequential",
  multi_edit: "sequential",

  // Bash - conservative: sequential by default (may have side effects)
  bash: "sequential",
  bash_output: "parallel", // Read-only (checks output of background task)

  // Todo tools - stateful, keep sequential
  todo: "sequential",
  create_todo_list: "sequential",
  update_todo_list: "sequential",

  // Ask user - requires user interaction, sequential
  ask_user: "sequential",

  // Design tools - read-only are parallel, write operations are sequential
  figma_export: "sequential",
  figma_get_styles: "parallel",
  figma_get_components: "parallel",
  figma_resolve_alias: "parallel",
  figma_get_file: "parallel",        // Read-only file metadata
  figma_audit_tokens: "parallel",    // Read-only analysis
  figma_get_variables: "parallel",   // Read-only variable fetch

  // BUG FIX: Add missing tool classifications
  // File viewing tools - read-only
  read_file: "parallel",

  // Directory listing - read-only
  ls: "parallel",

  // Web tools - isolated external operations
  web_search: "parallel",
  web_fetch: "parallel",
};

/**
 * Check if a tool is safe for parallel execution
 *
 * @param toolName - Name of the tool to check
 * @returns true if tool can run in parallel, false if must be sequential
 */
export function isParallelSafe(toolName: string): boolean {
  // MCP tools - conservative: treat as sequential unless we know better
  if (toolName.startsWith("mcp__")) {
    return false;
  }

  const mode = TOOL_CLASSIFICATION[toolName];

  // Unknown tools default to sequential for safety
  return mode === "parallel";
}

/**
 * Partition tool calls into parallel-safe and sequential groups
 *
 * @param toolCalls - Array of tool calls to partition
 * @returns Object with parallel and sequential arrays
 */
export function partitionToolCalls(toolCalls: LLMToolCall[]): {
  parallel: LLMToolCall[];
  sequential: LLMToolCall[];
} {
  const parallel: LLMToolCall[] = [];
  const sequential: LLMToolCall[] = [];

  for (const toolCall of toolCalls) {
    if (isParallelSafe(toolCall.function.name)) {
      parallel.push(toolCall);
    } else {
      sequential.push(toolCall);
    }
  }

  return { parallel, sequential };
}

/**
 * Configuration for parallel execution
 */
export interface ParallelExecutionConfig {
  /** Maximum number of concurrent tool executions (default: 4) */
  maxConcurrency?: number;
  /** Enable parallel execution (default: true) */
  enabled?: boolean;
}

/**
 * Default parallel execution configuration
 */
export const DEFAULT_PARALLEL_CONFIG: Required<ParallelExecutionConfig> = {
  maxConcurrency: 4,
  enabled: true,
};

/**
 * Execute tools in parallel with concurrency limit
 *
 * @param toolCalls - Tools to execute
 * @param executor - Function to execute a single tool
 * @param config - Parallel execution configuration
 * @returns Array of results in the same order as input
 */
export async function executeToolsInParallel<T>(
  toolCalls: LLMToolCall[],
  executor: (toolCall: LLMToolCall) => Promise<T>,
  config: ParallelExecutionConfig = {}
): Promise<Array<{ toolCall: LLMToolCall; result: T; error?: Error }>> {
  const {
    maxConcurrency = DEFAULT_PARALLEL_CONFIG.maxConcurrency,
    enabled = DEFAULT_PARALLEL_CONFIG.enabled,
  } = config;

  if (toolCalls.length === 0) {
    return [];
  }

  // BUG FIX: Check enabled flag - if disabled, execute all tools sequentially
  if (!enabled) {
    const results: Array<{ toolCall: LLMToolCall; result: T; error?: Error }> = [];
    for (const toolCall of toolCalls) {
      try {
        const result = await executor(toolCall);
        results.push({ toolCall, result });
      } catch (error) {
        results.push({
          toolCall,
          result: undefined!,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }
    return results;
  }

  // REFACTOR: Helper to execute single tool with error handling
  // BUG FIX: Use proper discriminated union instead of unsafe type coercion
  const executeSingle = async (
    toolCall: LLMToolCall
  ): Promise<{ toolCall: LLMToolCall; result: T; error?: Error }> => {
    try {
      const result = await executor(toolCall);
      return { toolCall, result };
    } catch (error) {
      // Return with result as undefined - callers must check error field
      // This is safer than casting undefined to T
      return {
        toolCall,
        result: undefined!,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  };

  // If only one tool or concurrency is 1, execute sequentially
  if (toolCalls.length === 1 || maxConcurrency === 1) {
    const results: Array<{ toolCall: LLMToolCall; result: T; error?: Error }> = [];
    for (const toolCall of toolCalls) {
      results.push(await executeSingle(toolCall));
    }
    return results;
  }

  // Use concurrency-limited parallel execution with proper work-stealing pattern
  const results: Array<{ toolCall: LLMToolCall; result: T; error?: Error }> = new Array(toolCalls.length);
  let nextIndex = 0;

  // BUG FIX: Use synchronous index access - JavaScript is single-threaded
  // so synchronous operations on nextIndex are atomic. The previous async
  // getNextIndex was unnecessary and the indexLock was never actually used.
  const getNextIndex = (): number => {
    if (nextIndex >= toolCalls.length) return -1;
    const current = nextIndex;
    nextIndex++;
    return current;
  };

  const executeNext = async (): Promise<void> => {
    while (true) {
      // Get next index synchronously (atomic in JS single-threaded model)
      const currentIndex = getNextIndex();
      if (currentIndex === -1) return; // No more work

      // Execute the tool
      results[currentIndex] = await executeSingle(toolCalls[currentIndex]);
    }
  };

  // Start worker pool up to maxConcurrency
  const workers: Array<Promise<void>> = [];
  const workerCount = Math.min(maxConcurrency, toolCalls.length);
  for (let i = 0; i < workerCount; i++) {
    workers.push(executeNext());
  }

  await Promise.all(workers);

  return results;
}
