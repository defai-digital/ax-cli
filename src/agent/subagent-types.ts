/**
 * Subagent System Types
 *
 * Type definitions for the autonomous subagent system that enables
 * parallel task execution and specialized agent capabilities.
 */

import type { LLMToolCall } from '../llm/client.js';
import { SUBAGENT_CONFIG } from '../constants.js';

// Import ChatEntry from llm-agent (which extends @defai.digital/ax-schemas)
// This avoids circular dependency by importing the concrete type
import type { ChatEntry } from './llm-agent.js';

// Re-export ChatEntry for consumers that import from this file
export type { ChatEntry };

/**
 * Types of specialized agents available
 */
export enum SubagentRole {
  /** General-purpose agent for any task */
  GENERAL = 'general',
  /** Specialized in writing and running tests */
  TESTING = 'testing',
  /** Specialized in generating documentation */
  DOCUMENTATION = 'documentation',
  /** Specialized in code refactoring */
  REFACTORING = 'refactoring',
  /** Specialized in code analysis and bug detection */
  ANALYSIS = 'analysis',
  /** Specialized in debugging and error resolution */
  DEBUG = 'debug',
  /** Specialized in performance optimization */
  PERFORMANCE = 'performance',
}

/**
 * Configuration for creating a subagent
 */
export interface SubagentConfig {
  /** Role/specialization of the subagent */
  role: SubagentRole;

  /** Tools this subagent is allowed to use */
  allowedTools: string[];

  /** Maximum tool execution rounds */
  maxToolRounds: number;

  /** Number of conversation messages to include as context */
  contextDepth: number;

  /** Custom system prompt (overrides role-based prompt) */
  customSystemPrompt?: string;

  /** Execution timeout in milliseconds */
  timeout?: number;

  /** Priority level (higher = executed first) */
  priority?: number;
}

/**
 * Task to be executed by a subagent
 */
export interface SubagentTask {
  /** Unique task identifier */
  id: string;

  /** Human-readable task description */
  description: string;

  /** Subagent role to use for this task */
  role: SubagentRole;

  /** Priority level (higher = executed first) */
  priority: number;

  /** Context to provide to the subagent */
  context: SubagentContext;

  /** IDs of tasks that must complete before this one */
  dependencies?: string[];

  /** Maximum tool rounds for this task */
  maxToolRounds?: number;

  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Context provided to a subagent
 */
export interface SubagentContext {
  /** File paths to include in context */
  files?: string[];

  /** Code snippets to include */
  codeSnippets?: CodeSnippet[];

  /** Relevant conversation history */
  conversationHistory?: ChatEntry[];

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Code snippet for context
 */
export interface CodeSnippet {
  /** File path this snippet is from */
  path: string;

  /** The code content */
  content: string;

  /** Programming language */
  language: string;

  /** Starting line number */
  startLine?: number;

  /** Ending line number */
  endLine?: number;
}

/**
 * Execution state of a subagent
 */
export enum SubagentState {
  /** Waiting to be started */
  PENDING = 'pending',
  /** Currently executing */
  RUNNING = 'running',
  /** Successfully completed */
  COMPLETED = 'completed',
  /** Failed with error */
  FAILED = 'failed',
  /** Cancelled by user or system */
  CANCELLED = 'cancelled',
}

/**
 * Status information for a subagent
 */
export interface SubagentStatus {
  /** Subagent unique identifier */
  id: string;

  /** Task being executed */
  taskId: string;

  /** Subagent role */
  role: SubagentRole;

  /** Current execution state */
  state: SubagentState;

  /** Progress percentage (0-100) */
  progress: number;

  /** When execution started */
  startTime: Date;

  /** When execution ended (if completed/failed) */
  endTime?: Date;

  /** Error message if failed */
  error?: string;

  /** Current action being performed */
  currentAction?: string;

  /** Tools used so far */
  toolsUsed?: string[];

  /** Number of tool rounds used */
  toolRoundsUsed?: number;
}

/**
 * Result of subagent execution
 */
export interface SubagentResult {
  /** Subagent identifier */
  id: string;

  /** Task identifier */
  taskId: string;

  /** Subagent role */
  role: SubagentRole;

  /** Whether execution was successful */
  success: boolean;

  /** Output/response from the subagent */
  output: string;

  /** Files modified */
  filesModified?: string[];

  /** Files created */
  filesCreated?: string[];

  /** Tool calls made during execution */
  toolCalls?: LLMToolCall[];

  /** Error message if failed */
  error?: string;

  /** Execution time in milliseconds */
  executionTime: number;

  /** Final status */
  status: SubagentStatus;

  /** Artifacts produced (file paths, URLs, etc) */
  artifacts?: string[];
}

/**
 * Message sent to/from a subagent
 */
export interface SubagentMessage {
  /** Message sender */
  from: 'parent' | 'subagent';

  /** Message recipient */
  to: 'parent' | 'subagent';

  /** Message type */
  type: 'instruction' | 'progress' | 'result' | 'error' | 'cancellation';

  /** Message content */
  content: string;

  /** Timestamp */
  timestamp: Date;

  /** Additional data */
  data?: unknown;
}

/**
 * Event emitted by subagent system
 */
export interface SubagentEvent {
  /** Event type */
  type: 'spawn' | 'start' | 'progress' | 'complete' | 'fail' | 'cancel';

  /** Subagent ID */
  subagentId: string;

  /** Task ID */
  taskId: string;

  /** Event data */
  data?: unknown;

  /** Timestamp */
  timestamp: Date;
}

/**
 * Configuration for subagent orchestrator
 */
export interface OrchestratorConfig {
  /** Maximum concurrent subagents */
  maxConcurrentAgents: number;

  /** Default timeout for subagents */
  defaultTimeout: number;

  /** Enable automatic checkpoint before spawning */
  autoCheckpoint: boolean;

  /** Enable detailed logging */
  verbose: boolean;
}

/**
 * Dependency graph node
 */
export interface DependencyNode {
  /** Task ID */
  taskId: string;

  /** Tasks this depends on */
  dependencies: string[];

  /** Tasks that depend on this */
  dependents: string[];

  /** Execution level (0 = no dependencies) */
  level: number;
}

/**
 * Dependency graph
 */
export interface DependencyGraph {
  /** All nodes in the graph */
  nodes: Map<string, DependencyNode>;

  /** Execution order (batches that can run in parallel) */
  executionOrder: string[][];

  /** Whether graph has cycles */
  hasCycles: boolean;

  /** Cycle details if any */
  cycles?: string[][];
}

/**
 * Default subagent configuration by role
 */
export const DEFAULT_SUBAGENT_CONFIG: Record<SubagentRole, Partial<SubagentConfig>> = {
  [SubagentRole.GENERAL]: {
    // BUG FIX: Removed 'todo' - subagents don't need todo functionality
    // and there's no factory for it in TOOL_FACTORIES
    allowedTools: ['bash', 'text_editor', 'search'],
    maxToolRounds: SUBAGENT_CONFIG.GENERAL_MAX_TOOL_ROUNDS,
    contextDepth: SUBAGENT_CONFIG.DEEP_CONTEXT_DEPTH,
    priority: 1,
  },
  [SubagentRole.TESTING]: {
    allowedTools: ['bash', 'text_editor', 'search'],
    maxToolRounds: SUBAGENT_CONFIG.TESTING_MAX_TOOL_ROUNDS,
    contextDepth: SUBAGENT_CONFIG.DEFAULT_CONTEXT_DEPTH,
    priority: 2,
  },
  [SubagentRole.DOCUMENTATION]: {
    allowedTools: ['text_editor', 'search'],
    maxToolRounds: SUBAGENT_CONFIG.DOCUMENTATION_MAX_TOOL_ROUNDS,
    contextDepth: SUBAGENT_CONFIG.SHALLOW_CONTEXT_DEPTH,
    priority: 2,
  },
  [SubagentRole.REFACTORING]: {
    allowedTools: ['text_editor', 'search', 'bash'],
    maxToolRounds: SUBAGENT_CONFIG.REFACTORING_MAX_TOOL_ROUNDS,
    contextDepth: SUBAGENT_CONFIG.DEEP_CONTEXT_DEPTH,
    priority: 2,
  },
  [SubagentRole.ANALYSIS]: {
    allowedTools: ['search', 'bash'],
    maxToolRounds: SUBAGENT_CONFIG.ANALYSIS_MAX_TOOL_ROUNDS,
    contextDepth: SUBAGENT_CONFIG.DEFAULT_CONTEXT_DEPTH,
    priority: 3,
  },
  [SubagentRole.DEBUG]: {
    allowedTools: ['bash', 'text_editor', 'search'],
    maxToolRounds: SUBAGENT_CONFIG.DEBUG_MAX_TOOL_ROUNDS,
    contextDepth: SUBAGENT_CONFIG.DEEP_CONTEXT_DEPTH,
    priority: 3,
  },
  [SubagentRole.PERFORMANCE]: {
    allowedTools: ['bash', 'search', 'text_editor'],
    maxToolRounds: SUBAGENT_CONFIG.PERFORMANCE_MAX_TOOL_ROUNDS,
    contextDepth: SUBAGENT_CONFIG.DEFAULT_CONTEXT_DEPTH,
    priority: 2,
  },
};

/**
 * System prompts for each subagent role
 *
 * GLM-4.6 Optimized Guidelines:
 * - Be direct and professional, no pleasantries
 * - Keep responses brief unless detail is needed
 * - Match existing code style in the project
 * - Validate changes with lint/typecheck when applicable
 * - Leverage large context for comprehensive analysis
 */
export const SUBAGENT_SYSTEM_PROMPTS: Record<SubagentRole, string> = {
  [SubagentRole.GENERAL]: `AI coding assistant. Handle the assigned task directly.
Be accurate and brief. Match existing code conventions. Validate your changes.`,

  [SubagentRole.TESTING]: `Testing agent. Write tests for the specified code.

WORKFLOW:
1. READ existing tests to understand patterns/framework
2. IDENTIFY test scenarios: happy path, edge cases, errors
3. WRITE tests matching project conventions
4. RUN tests to verify they pass

TEST QUALITY:
- Descriptive test names: "should [behavior] when [condition]"
- One assertion concept per test
- Mock external dependencies
- Cover: null/undefined, empty strings, boundary values

Keep responses brief. Focus only on testing.`,

  [SubagentRole.DOCUMENTATION]: `Documentation agent. Document the specified code.

WORKFLOW:
1. READ the code thoroughly
2. IDENTIFY public API, key concepts, edge cases
3. WRITE docs matching project style

DOC TYPES:
- API: Parameters, return types, examples
- README: Setup, usage, configuration
- PRD: Use the PRD template for design docs

RULES:
- Include runnable examples
- Document edge cases and limitations
- Don't over-document obvious code
- Be concise

Keep responses brief. Focus only on documentation.`,

  [SubagentRole.REFACTORING]: `Refactoring agent. Improve code structure.

WORKFLOW:
1. UNDERSTAND current behavior fully
2. IDENTIFY refactoring opportunities
3. PLAN changes (what changes, what stays)
4. EXECUTE one refactoring at a time
5. VERIFY with tests after each change

REFACTORING TYPES:
- Extract: Pull repeated code into functions
- Rename: Improve clarity of names
- Simplify: Reduce nested conditionals
- Consolidate: Merge similar code paths

RULES:
- Preserve behavior exactly
- Match existing conventions
- Don't over-abstract
- Run tests after changes

Keep responses brief. Focus only on refactoring.`,

  [SubagentRole.ANALYSIS]: `Code analysis agent. Analyze the specified code.

WORKFLOW:
1. SCAN for issues by category
2. CLASSIFY by severity
3. REPORT with actionable fixes

CATEGORIES:
□ Correctness: Logic errors, wrong behavior
□ Security: OWASP top 10 (injection, XSS, etc.)
□ Performance: O(n²) loops, memory leaks
□ Maintainability: Complexity, readability

SEVERITY:
- CRITICAL: Security, data loss, crashes
- MAJOR: Bugs, significant issues
- MINOR: Code style, small improvements
- INFO: Observations only

FALSE POSITIVE PREVENTION:
- catch (error: any) is VALID TypeScript
- let vs const is lint preference, not a bug
- setTimeout returns SYNCHRONOUSLY
- React useEffect closures are intentional

Keep responses brief. Focus only on analysis.`,

  [SubagentRole.DEBUG]: `Debugging agent. Fix verified bugs only.

WORKFLOW:
1. REPRODUCE: Confirm the bug exists
2. ISOLATE: Find the exact line/condition
3. UNDERSTAND: Why does this happen?
4. FIX: Minimal change to resolve
5. VERIFY: Test the fix works

CLASSIFICATION (required):
- CRITICAL: Crashes, data loss, security
- BUG: Incorrect behavior
- CODE_SMELL: Works but improvable (do NOT fix unless asked)
- NOT_A_BUG: False positive (do NOT report)

NOT A BUG (ignore these):
- catch (error: any) - valid TS pattern
- let vs const - lint preference
- Intentional type casts (as any)
- setTimeout/setInterval return IMMEDIATELY (sync)
- React useEffect local arrays - each effect has own closure

ONLY FIX if:
- Classification is CRITICAL or BUG
- You traced execution and confirmed issue
- You can describe exact error/behavior

Keep responses brief. Focus only on debugging.`,

  [SubagentRole.PERFORMANCE]: `Performance optimization agent. Optimize the specified code.

WORKFLOW:
1. PROFILE: Identify actual bottlenecks (don't guess)
2. MEASURE: Baseline performance numbers
3. OPTIMIZE: Target biggest impact first
4. VERIFY: Measure improvement

COMMON OPTIMIZATIONS:
- Algorithms: O(n²) → O(n log n)
- Caching: Memoize expensive computations
- Lazy loading: Defer work until needed
- Batching: Reduce I/O round trips

RULES:
- Don't optimize without measuring
- Don't sacrifice readability for micro-optimizations
- Document what was changed and why
- Include before/after metrics

Keep responses brief. Focus only on performance.`,
};

/**
 * Convert string role name to SubagentRole enum
 * Returns SubagentRole.GENERAL for unknown roles
 *
 * @param role - Role name string (case-insensitive)
 * @returns Corresponding SubagentRole enum value
 */
export function parseSubagentRole(role: string): SubagentRole {
  const roleMap: Record<string, SubagentRole> = {
    'testing': SubagentRole.TESTING,
    'documentation': SubagentRole.DOCUMENTATION,
    'refactoring': SubagentRole.REFACTORING,
    'analysis': SubagentRole.ANALYSIS,
    'debug': SubagentRole.DEBUG,
    'performance': SubagentRole.PERFORMANCE,
    'general': SubagentRole.GENERAL,
  };

  return roleMap[role.toLowerCase()] ?? SubagentRole.GENERAL;
}
