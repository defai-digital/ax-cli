/**
 * Parallel Tool Execution
 *
 * Classifies tools for safe parallel execution based on their side effects.
 * Read-only and isolated tools can run concurrently, while write operations
 * are executed sequentially to prevent race conditions.
 *
 * Features:
 * - Tool classification (parallel vs sequential)
 * - Dependency detection between tool calls
 * - Batched execution respecting dependencies
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
  const results: Array<{ toolCall: LLMToolCall; result?: T; error?: Error }> = new Array(toolCalls.length);
  let nextIndex = 0;

  // Worker function that processes items from the shared queue
  const worker = async (): Promise<void> => {
    while (true) {
      // Atomically grab the next index BEFORE any async operation
      // This prevents race conditions where multiple workers could grab the same index
      const currentIndex = nextIndex;
      if (currentIndex >= toolCalls.length) {
        return; // No more work
      }
      nextIndex++; // Increment synchronously before any await

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
    }
  };

  // Start workers up to maxConcurrency
  const workerCount = Math.min(maxConcurrency, toolCalls.length);
  const workers: Array<Promise<void>> = [];
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);

  return results;
}

// ============================================================================
// Dependency Detection
// ============================================================================

/**
 * Tools that read files
 */
const READ_TOOLS = new Set(['view_file', 'search', 'list_directory']);

/**
 * Tools that write files
 */
const WRITE_TOOLS = new Set(['create_file', 'str_replace_editor', 'multi_edit']);

/**
 * Extract all file paths from tool arguments (for multi-file operations)
 */
function extractFilePaths(toolCall: LLMToolCall): string[] {
  try {
    const args = JSON.parse(toolCall.function.arguments || '{}');
    const paths: string[] = [];

    // Single path
    if (args.path) paths.push(args.path);
    if (args.file_path) paths.push(args.file_path);
    if (args.filename) paths.push(args.filename);
    if (args.file) paths.push(args.file);
    if (args.target) paths.push(args.target);

    // Array of paths (for multi_edit)
    if (Array.isArray(args.edits)) {
      for (const edit of args.edits) {
        if (edit.path) paths.push(edit.path);
        if (edit.file_path) paths.push(edit.file_path);
      }
    }

    // Bash commands may reference files
    if (args.command && typeof args.command === 'string') {
      // Extract file paths from bash commands (basic heuristic)
      const bashPaths = extractPathsFromCommand(args.command);
      paths.push(...bashPaths);
    }

    return [...new Set(paths)]; // Deduplicate
  } catch {
    return [];
  }
}

/**
 * Extract potential file paths from a bash command (basic heuristic)
 */
function extractPathsFromCommand(command: string): string[] {
  const paths: string[] = [];

  // Match paths that look like files (contains / or ends with common extensions)
  const pathRegex = /(?:^|[\s'"=])([\/\w.-]+(?:\.(?:ts|js|tsx|jsx|json|md|css|html|py|go|rs|java|c|cpp|h|hpp|yaml|yml|toml|xml)|\/[\w.-]+))/g;

  let match;
  while ((match = pathRegex.exec(command)) !== null) {
    const path = match[1];
    // Skip common commands that look like paths
    if (!path.startsWith('/usr/') && !path.startsWith('/bin/')) {
      paths.push(path);
    }
  }

  return paths;
}

/**
 * Dependency between tool calls
 */
export interface ToolDependency {
  /** Index of the tool call that must run first */
  dependsOn: number;
  /** Index of the tool call that depends on the other */
  dependentIndex: number;
  /** Type of dependency */
  type: 'write-read' | 'write-write' | 'read-write';
  /** File path causing the dependency */
  filePath: string;
}

/**
 * Detect dependencies between tool calls based on file access patterns
 *
 * Dependencies are created when:
 * - A tool reads a file that another tool writes (write-read)
 * - Two tools write to the same file (write-write)
 * - A tool writes a file that was previously read (read-write, weaker)
 *
 * @param toolCalls - Array of tool calls to analyze
 * @returns Array of dependencies
 */
export function detectToolDependencies(toolCalls: LLMToolCall[]): ToolDependency[] {
  const dependencies: ToolDependency[] = [];

  // Track writes and reads by file path
  const writesByPath = new Map<string, number[]>(); // path -> indices of writes
  const readsByPath = new Map<string, number[]>();  // path -> indices of reads

  // First pass: categorize all file accesses
  for (let i = 0; i < toolCalls.length; i++) {
    const toolCall = toolCalls[i];
    const toolName = toolCall.function.name;
    const paths = extractFilePaths(toolCall);

    for (const path of paths) {
      if (WRITE_TOOLS.has(toolName) || toolName === 'bash') {
        // Bash is conservative - treat as write
        const writes = writesByPath.get(path) || [];
        writes.push(i);
        writesByPath.set(path, writes);
      }

      if (READ_TOOLS.has(toolName) || toolName === 'bash') {
        // Bash may also read
        const reads = readsByPath.get(path) || [];
        reads.push(i);
        readsByPath.set(path, reads);
      }
    }
  }

  // Second pass: detect dependencies
  for (const [path, writeIndices] of writesByPath) {
    const readIndices = readsByPath.get(path) || [];

    // Write-Read dependencies: reads after writes
    for (const writeIdx of writeIndices) {
      for (const readIdx of readIndices) {
        if (readIdx > writeIdx) {
          dependencies.push({
            dependsOn: writeIdx,
            dependentIndex: readIdx,
            type: 'write-read',
            filePath: path,
          });
        }
      }
    }

    // Write-Write dependencies: sequential writes to same file
    for (let i = 0; i < writeIndices.length - 1; i++) {
      dependencies.push({
        dependsOn: writeIndices[i],
        dependentIndex: writeIndices[i + 1],
        type: 'write-write',
        filePath: path,
      });
    }
  }

  return dependencies;
}

/**
 * Batch of tool calls that can execute in parallel
 */
export interface ToolBatch {
  /** Tool calls in this batch */
  toolCalls: LLMToolCall[];
  /** Original indices of tool calls */
  indices: number[];
}

/**
 * Partition tool calls into ordered batches respecting dependencies
 *
 * Within each batch, tools can run in parallel.
 * Batches must be executed sequentially.
 *
 * @param toolCalls - Array of tool calls to partition
 * @param config - Optional configuration
 * @returns Ordered array of batches
 */
export function partitionToolCallsWithDependencies(
  toolCalls: LLMToolCall[],
  config: { enableDependencyDetection?: boolean } = {}
): ToolBatch[] {
  const { enableDependencyDetection = true } = config;

  if (toolCalls.length === 0) {
    return [];
  }

  if (toolCalls.length === 1) {
    return [{ toolCalls: [...toolCalls], indices: [0] }];
  }

  // First, apply basic parallel/sequential classification
  const { parallel, sequential } = partitionToolCalls(toolCalls);

  // If dependency detection is disabled, simple split
  if (!enableDependencyDetection) {
    const batches: ToolBatch[] = [];

    // All parallel tools in one batch
    if (parallel.length > 0) {
      const indices = parallel.map(tc =>
        toolCalls.findIndex(t => t.id === tc.id)
      );
      batches.push({ toolCalls: parallel, indices });
    }

    // Each sequential tool in its own batch
    for (const tc of sequential) {
      const idx = toolCalls.findIndex(t => t.id === tc.id);
      batches.push({ toolCalls: [tc], indices: [idx] });
    }

    return batches;
  }

  // Detect dependencies
  const dependencies = detectToolDependencies(toolCalls);

  // Build dependency graph
  const dependsOn = new Map<number, Set<number>>(); // index -> set of indices it depends on
  for (let i = 0; i < toolCalls.length; i++) {
    dependsOn.set(i, new Set());
  }
  for (const dep of dependencies) {
    const deps = dependsOn.get(dep.dependentIndex);
    if (deps) {
      deps.add(dep.dependsOn);
    }
  }

  // Sequential tools create implicit dependencies on previous sequential tools
  const seqIndices = sequential.map(tc => toolCalls.findIndex(t => t.id === tc.id));
  for (let i = 1; i < seqIndices.length; i++) {
    const deps = dependsOn.get(seqIndices[i]);
    if (deps) {
      deps.add(seqIndices[i - 1]);
    }
  }

  // Topological sort into batches (Kahn's algorithm)
  const batches: ToolBatch[] = [];
  const completed = new Set<number>();
  const remaining = new Set(Array.from({ length: toolCalls.length }, (_, i) => i));

  while (remaining.size > 0) {
    // Find all tools with no unmet dependencies
    const ready: number[] = [];
    for (const idx of remaining) {
      const deps = dependsOn.get(idx);
      if (!deps || [...deps].every(d => completed.has(d))) {
        ready.push(idx);
      }
    }

    if (ready.length === 0) {
      // Circular dependency - shouldn't happen, but handle gracefully
      // Just take the first remaining tool
      const first = remaining.values().next().value;
      if (first !== undefined) {
        ready.push(first);
      }
    }

    // Separate ready tools into parallel-safe and sequential
    const batchParallel: number[] = [];
    const batchSequential: number[] = [];

    for (const idx of ready) {
      const tc = toolCalls[idx];
      if (isParallelSafe(tc.function.name)) {
        batchParallel.push(idx);
      } else {
        batchSequential.push(idx);
      }
    }

    // Add parallel batch if any
    if (batchParallel.length > 0) {
      batches.push({
        toolCalls: batchParallel.map(i => toolCalls[i]),
        indices: batchParallel,
      });
      for (const idx of batchParallel) {
        completed.add(idx);
        remaining.delete(idx);
      }
    }

    // Add sequential tools one by one
    for (const idx of batchSequential) {
      batches.push({
        toolCalls: [toolCalls[idx]],
        indices: [idx],
      });
      completed.add(idx);
      remaining.delete(idx);
    }
  }

  return batches;
}
