/**
 * Agentic Behaviors Configuration
 *
 * Centralized configuration for advanced agent capabilities:
 * - ReAct Loop: Explicit Thought/Action/Observation reasoning
 * - Self-Correction: Failure detection with reflective retry
 * - Verification: Post-execution validation
 *
 * @module agent/config/agentic-config
 */

// ============================================================================
// ReAct Loop Configuration
// ============================================================================

/**
 * Trace level for ReAct reasoning visibility
 */
export type ReActTraceLevel = 'none' | 'summary' | 'full';

/**
 * Configuration for ReAct (Reason-Act) loop behavior
 */
export interface ReActConfig {
  /** Enable ReAct loop mode */
  enabled: boolean;

  /** Maximum reasoning steps before forcing completion (default: 20) */
  maxSteps: number;

  /** Level of reasoning trace visibility */
  traceLevel: ReActTraceLevel;

  /** Use GLM-4.6 thinking mode for reasoning steps (recommended for ax-glm) */
  useThinkingMode: boolean;

  /** Maximum tokens for scratchpad history before pruning (default: 8000) */
  maxScratchpadTokens: number;

  /** Emit react_step events for UI display */
  emitStepEvents: boolean;
}

// ============================================================================
// Self-Correction Configuration
// ============================================================================

/**
 * Depth of context included in reflection prompts
 */
export type ReflectionDepth = 'shallow' | 'deep';

/**
 * Configuration for self-correction behavior
 */
export interface SelfCorrectionConfig {
  /** Enable self-correction on failures */
  enabled: boolean;

  /** Maximum retry attempts per failure signature (default: 3) */
  maxRetries: number;

  /** Delay between retries in milliseconds (default: 1000) */
  retryDelayMs: number;

  /** Custom failure patterns to detect (regex strings) */
  customFailurePatterns: string[];

  /** How much context to include in reflection prompts */
  reflectionDepth: ReflectionDepth;

  /** Use GLM-4.6 thinking mode for reflection analysis */
  useThinkingModeForReflection: boolean;

  /** Reset retry budget after successful tool execution */
  resetBudgetOnSuccess: boolean;
}

// ============================================================================
// Verification Configuration
// ============================================================================

/**
 * Type of verification callback
 */
export type VerificationCallbackType = 'typecheck' | 'lint' | 'test' | 'custom';

/**
 * Configuration for a single verification callback
 */
export interface VerificationCallbackConfig {
  /** Display name for the callback */
  name: string;

  /** Type of verification */
  type: VerificationCallbackType;

  /** Whether this callback is enabled */
  enabled: boolean;

  /** Custom command (required for 'custom' type) */
  command?: string;

  /** Timeout in milliseconds (default: 60000) */
  timeout: number;

  /** If true, verification failure blocks execution */
  required: boolean;

  /** If true, only run on modified files (for test/lint) */
  scopeToModifiedFiles: boolean;

  /** Working directory for the command */
  cwd?: string;

  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * Configuration for post-execution verification
 */
export interface VerificationConfig {
  /** Enable verification after phase execution */
  enabled: boolean;

  /** Verification callbacks to run */
  callbacks: VerificationCallbackConfig[];

  /** Rollback changes if verification fails */
  rollbackOnFailure: boolean;

  /** Run verification after each phase (vs only at end) */
  verifyAfterEachPhase: boolean;

  /** Attempt self-correction on verification failure */
  attemptCorrectionOnFailure: boolean;
}

// ============================================================================
// Parallel Execution Configuration
// ============================================================================

/**
 * Rate limiting configuration for API calls
 */
export interface RateLimitConfig {
  /** Maximum requests per second */
  requestsPerSecond: number;

  /** Maximum burst size */
  burstLimit: number;
}

/**
 * Configuration for parallel tool execution
 */
export interface ParallelExecutionConfig {
  /** Maximum concurrent tool executions (default: 5) */
  maxConcurrent: number;

  /** Rate limiting for GLM API calls */
  rateLimit?: RateLimitConfig;

  /** Enable automatic dependency detection between tools */
  dependencyDetection: boolean;
}

// ============================================================================
// Combined Configuration
// ============================================================================

/**
 * Complete agentic configuration
 */
export interface AgenticConfig {
  /** ReAct loop configuration */
  react: ReActConfig;

  /** Self-correction configuration */
  correction: SelfCorrectionConfig;

  /** Verification configuration */
  verification: VerificationConfig;

  /** Parallel execution configuration */
  parallelExecution: ParallelExecutionConfig;
}

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Default ReAct configuration (disabled by default)
 */
export const DEFAULT_REACT_CONFIG: ReActConfig = {
  enabled: false,
  maxSteps: 20,
  traceLevel: 'summary',
  useThinkingMode: true, // GLM-optimized
  maxScratchpadTokens: 8000,
  emitStepEvents: true,
};

/**
 * Default self-correction configuration (enabled by default)
 */
export const DEFAULT_CORRECTION_CONFIG: SelfCorrectionConfig = {
  enabled: true, // ON by default for reliability
  maxRetries: 3,
  retryDelayMs: 1000,
  customFailurePatterns: [],
  reflectionDepth: 'shallow',
  useThinkingModeForReflection: true, // GLM-optimized
  resetBudgetOnSuccess: true,
};

/**
 * Default TypeScript verification callback
 */
export const DEFAULT_TYPECHECK_CALLBACK: VerificationCallbackConfig = {
  name: 'TypeScript Check',
  type: 'typecheck',
  enabled: true,
  timeout: 60000,
  required: true,
  scopeToModifiedFiles: false, // Full project check
};

/**
 * Default verification configuration (disabled by default)
 */
export const DEFAULT_VERIFICATION_CONFIG: VerificationConfig = {
  enabled: false,
  callbacks: [DEFAULT_TYPECHECK_CALLBACK],
  rollbackOnFailure: false,
  verifyAfterEachPhase: false,
  attemptCorrectionOnFailure: true,
};

/**
 * Default parallel execution configuration
 */
export const DEFAULT_PARALLEL_CONFIG: ParallelExecutionConfig = {
  maxConcurrent: 5,
  rateLimit: {
    requestsPerSecond: 10,
    burstLimit: 20,
  },
  dependencyDetection: true, // ON by default
};

/**
 * Default complete agentic configuration
 */
export const DEFAULT_AGENTIC_CONFIG: AgenticConfig = {
  react: DEFAULT_REACT_CONFIG,
  correction: DEFAULT_CORRECTION_CONFIG,
  verification: DEFAULT_VERIFICATION_CONFIG,
  parallelExecution: DEFAULT_PARALLEL_CONFIG,
};

// ============================================================================
// Configuration Helpers
// ============================================================================

/**
 * Merge partial config with defaults
 */
export function mergeAgenticConfig(
  partial: Partial<AgenticConfig>
): AgenticConfig {
  return {
    react: { ...DEFAULT_REACT_CONFIG, ...partial.react },
    correction: { ...DEFAULT_CORRECTION_CONFIG, ...partial.correction },
    verification: { ...DEFAULT_VERIFICATION_CONFIG, ...partial.verification },
    parallelExecution: { ...DEFAULT_PARALLEL_CONFIG, ...partial.parallelExecution },
  };
}

/**
 * Create config from CLI flags
 */
export function createConfigFromFlags(flags: {
  react?: boolean;
  verify?: boolean;
  noCorrection?: boolean;
}): Partial<AgenticConfig> {
  const config: Partial<AgenticConfig> = {};

  if (flags.react !== undefined) {
    config.react = { ...DEFAULT_REACT_CONFIG, enabled: flags.react };
  }

  if (flags.verify !== undefined) {
    config.verification = { ...DEFAULT_VERIFICATION_CONFIG, enabled: flags.verify };
  }

  if (flags.noCorrection !== undefined) {
    config.correction = { ...DEFAULT_CORRECTION_CONFIG, enabled: !flags.noCorrection };
  }

  return config;
}
