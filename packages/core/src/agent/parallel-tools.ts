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

  // Todo tool - stateful, keep sequential
  todo: "sequential",

  // Ask user - requires user interaction, sequential
  ask_user: "sequential",

  // Design tools - may write files
  figma_export: "sequential",
  figma_get_styles: "parallel",
  figma_get_components: "parallel",
  figma_resolve_alias: "parallel",
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
): Promise<Array<{ toolCall: LLMToolCall; result?: T; error?: Error }>> {
  const {
    maxConcurrency = DEFAULT_PARALLEL_CONFIG.maxConcurrency,
    enabled = DEFAULT_PARALLEL_CONFIG.enabled,
  } = config;

  if (toolCalls.length === 0) {
    return [];
  }

  // If parallel execution is disabled, or only one tool, or concurrency is 1, execute sequentially
  if (!enabled || toolCalls.length === 1 || maxConcurrency === 1) {
    const results: Array<{ toolCall: LLMToolCall; result?: T; error?: Error }> = [];
    for (const toolCall of toolCalls) {
      try {
        const result = await executor(toolCall);
        results.push({ toolCall, result });
      } catch (error) {
        results.push({
          toolCall,
          result: undefined,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }
    return results;
  }

  // Use Promise.allSettled with concurrency limiting
  const results: Array<{ toolCall: LLMToolCall; result?: T; error?: Error }> = [];
  const pending: Array<Promise<void>> = [];
  let index = 0;

  const executeNext = async (): Promise<void> => {
    const currentIndex = index++;
    if (currentIndex >= toolCalls.length) return;

    const toolCall = toolCalls[currentIndex];
    try {
      const result = await executor(toolCall);
      results[currentIndex] = { toolCall, result };
    } catch (error) {
      results[currentIndex] = {
        toolCall,
        result: undefined,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }

    // Execute next if there are more
    if (index < toolCalls.length) {
      await executeNext();
    }
  };

  // Start initial batch up to maxConcurrency
  const initialBatch = Math.min(maxConcurrency, toolCalls.length);
  for (let i = 0; i < initialBatch; i++) {
    pending.push(executeNext());
  }

  await Promise.all(pending);

  return results;
}
