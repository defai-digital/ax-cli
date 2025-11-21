/**
 * Subagent System Types
 *
 * Type definitions for the autonomous subagent system that enables
 * parallel task execution and specialized agent capabilities.
 */

import type { LLMToolCall } from '../llm/client.js';

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
 * Chat entry (from llm-agent.ts to avoid circular dependency)
 */
export interface ChatEntry {
  type: 'user' | 'assistant' | 'tool_result' | 'tool_call';
  content: string;
  timestamp: Date;
  toolCalls?: LLMToolCall[];
  toolCall?: LLMToolCall;
  toolResult?: { success: boolean; output?: string; error?: string };
  isStreaming?: boolean;
  reasoningContent?: string;
  isReasoningStreaming?: boolean;
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
    allowedTools: ['bash', 'text_editor', 'search', 'todo'],
    maxToolRounds: 30,
    contextDepth: 20,
    priority: 1,
  },
  [SubagentRole.TESTING]: {
    allowedTools: ['bash', 'text_editor', 'search'],
    maxToolRounds: 20,
    contextDepth: 15,
    priority: 2,
  },
  [SubagentRole.DOCUMENTATION]: {
    allowedTools: ['text_editor', 'search'],
    maxToolRounds: 15,
    contextDepth: 10,
    priority: 2,
  },
  [SubagentRole.REFACTORING]: {
    allowedTools: ['text_editor', 'search', 'bash'],
    maxToolRounds: 25,
    contextDepth: 20,
    priority: 2,
  },
  [SubagentRole.ANALYSIS]: {
    allowedTools: ['search', 'bash'],
    maxToolRounds: 15,
    contextDepth: 15,
    priority: 3,
  },
  [SubagentRole.DEBUG]: {
    allowedTools: ['bash', 'text_editor', 'search'],
    maxToolRounds: 25,
    contextDepth: 20,
    priority: 3,
  },
  [SubagentRole.PERFORMANCE]: {
    allowedTools: ['bash', 'search', 'text_editor'],
    maxToolRounds: 20,
    contextDepth: 15,
    priority: 2,
  },
};

/**
 * System prompts for each subagent role
 */
export const SUBAGENT_SYSTEM_PROMPTS: Record<SubagentRole, string> = {
  [SubagentRole.GENERAL]: `You are a general-purpose AI coding assistant.
You can handle any coding task assigned to you.
Be thorough, clear, and follow best practices.`,

  [SubagentRole.TESTING]: `You are a specialized testing agent.
Your role is to:
- Write comprehensive unit tests
- Write integration tests
- Ensure high test coverage
- Follow testing best practices for the project's framework
- Write clear, maintainable test code
- Include edge cases and error scenarios
Focus ONLY on testing tasks.`,

  [SubagentRole.DOCUMENTATION]: `You are a specialized documentation agent.
Your role is to:
- Generate clear, comprehensive documentation
- Follow documentation standards (JSDoc, Markdown, etc.)
- Include usage examples
- Document edge cases and limitations
- Write in clear, concise language
- Structure documentation logically
Focus ONLY on documentation tasks.`,

  [SubagentRole.REFACTORING]: `You are a specialized refactoring agent.
Your role is to:
- Improve code structure and readability
- Apply SOLID principles
- Reduce code duplication
- Optimize performance where applicable
- Maintain backward compatibility
- Preserve existing functionality
Focus ONLY on refactoring tasks.`,

  [SubagentRole.ANALYSIS]: `You are a specialized code analysis agent.
Your role is to:
- Analyze code for potential bugs
- Identify security vulnerabilities
- Detect code smells and anti-patterns
- Suggest improvements
- Check for best practice violations
- Provide detailed analysis reports
Focus ONLY on analysis tasks.`,

  [SubagentRole.DEBUG]: `You are a specialized debugging agent.
Your role is to:
- Identify and fix bugs
- Add proper error handling
- Improve error messages
- Add logging where helpful
- Test fixes thoroughly
- Explain the root cause of issues
Focus ONLY on debugging tasks.`,

  [SubagentRole.PERFORMANCE]: `You are a specialized performance optimization agent.
Your role is to:
- Identify performance bottlenecks
- Optimize algorithms and data structures
- Reduce memory usage
- Improve execution speed
- Add performance monitoring
- Benchmark optimizations
Focus ONLY on performance tasks.`,
};
