/**
 * Provider Context - Instance-based configuration for multi-provider support
 *
 * This module enables running ax-glm and ax-grok in parallel without conflicts.
 * Each provider gets isolated:
 * - Configuration files (~/.ax-glm/ vs ~/.ax-grok/)
 * - Cache directories
 * - Memory stores
 * - History files
 * - Session data
 *
 * @example
 * ```typescript
 * // CLI usage (automatic from runCLI)
 * const ctx = ProviderContext.create('glm');
 * ctx.activate(); // Sets as current context
 *
 * // SDK usage (explicit)
 * const agent = await createAgent({
 *   provider: 'grok',
 *   // ... other options
 * });
 * ```
 */

import { homedir } from 'os';
import { join, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

/**
 * Supported provider types
 */
export type ProviderType = 'glm' | 'grok' | 'generic';

/**
 * Provider-specific configuration
 */
export interface ProviderConfig {
  /** Provider identifier */
  name: ProviderType;
  /** Display name for UI */
  displayName: string;
  /** CLI command name */
  cliName: string;
  /** npm package name */
  package: string;
  /** Default API base URL */
  defaultBaseURL: string;
  /** Default model */
  defaultModel: string;
  /** Environment variable for API key */
  apiKeyEnvVar: string;
  /** Provider website */
  website: string;
  /** Config directory name (e.g., '.ax-glm') */
  configDirName: string;
}

/**
 * Pre-defined provider configurations
 */
export const PROVIDER_CONFIGS: Record<ProviderType, ProviderConfig> = {
  glm: {
    name: 'glm',
    displayName: 'GLM (Z.AI)',
    cliName: 'ax-glm',
    package: '@defai.digital/ax-glm',
    defaultBaseURL: 'https://api.z.ai/api/coding/paas/v4',
    defaultModel: 'glm-4.6',
    apiKeyEnvVar: 'ZAI_API_KEY',
    website: 'https://z.ai',
    configDirName: '.ax-glm',
  },
  grok: {
    name: 'grok',
    displayName: 'Grok (xAI)',
    cliName: 'ax-grok',
    package: '@defai.digital/ax-grok',
    defaultBaseURL: 'https://api.x.ai/v1',
    defaultModel: 'grok-4-0709',
    apiKeyEnvVar: 'XAI_API_KEY',
    website: 'https://console.x.ai',
    configDirName: '.ax-grok',
  },
  generic: {
    name: 'generic',
    displayName: 'AX CLI',
    cliName: 'ax-cli',
    package: '@defai.digital/ax-cli',
    defaultBaseURL: '',
    defaultModel: '',
    apiKeyEnvVar: 'AI_API_KEY',
    website: '',
    configDirName: '.ax-cli',
  },
};

/**
 * File names used by the CLI
 */
export const PROVIDER_FILES = {
  CONFIG: 'config.json',
  SETTINGS: 'settings.json',
  CUSTOM_MD: 'CUSTOM.md',
  MEMORY: 'memory.json',
  HISTORY: 'history.json',
  INDEX: 'index.json',
} as const;

/**
 * Directory names used by the CLI
 */
export const PROVIDER_DIRS = {
  CACHE: 'cache',
  SESSIONS: 'sessions',
  PLANS: 'plans',
  TEMPLATES: 'templates',
  CHECKPOINTS: 'checkpoints',
  COMMANDS: 'commands',
  BACKUPS: 'backups',
} as const;

/**
 * Provider Context - Manages provider-specific paths and configuration
 *
 * This class provides instance-based configuration to avoid global state conflicts
 * when running multiple providers in parallel.
 */
export class ProviderContext {
  private static currentContext: ProviderContext | null = null;
  private static contextStack: ProviderContext[] = [];

  readonly provider: ProviderType;
  readonly config: ProviderConfig;
  readonly userDir: string;
  readonly projectDir: string;

  private constructor(
    provider: ProviderType,
    projectRoot: string = process.cwd()
  ) {
    this.provider = provider;
    this.config = PROVIDER_CONFIGS[provider];
    this.userDir = join(homedir(), this.config.configDirName);
    this.projectDir = join(projectRoot, this.config.configDirName);
  }

  /**
   * Create a new provider context
   */
  static create(
    provider: ProviderType,
    projectRoot?: string
  ): ProviderContext {
    return new ProviderContext(provider, projectRoot);
  }

  /**
   * Get the current active context
   * Falls back to generic if no context is set
   */
  static current(): ProviderContext {
    if (!ProviderContext.currentContext) {
      // Check environment variable for provider hint
      const envProvider = process.env.AX_PROVIDER as ProviderType | undefined;
      if (envProvider && PROVIDER_CONFIGS[envProvider]) {
        ProviderContext.currentContext = new ProviderContext(envProvider);
      } else {
        // Default to generic
        ProviderContext.currentContext = new ProviderContext('generic');
      }
    }
    return ProviderContext.currentContext;
  }

  /**
   * Set this context as the current active context
   */
  activate(): void {
    ProviderContext.currentContext = this;
  }

  /**
   * Push this context onto the stack and activate it
   * Useful for temporary context switches
   */
  push(): void {
    if (ProviderContext.currentContext) {
      ProviderContext.contextStack.push(ProviderContext.currentContext);
    }
    this.activate();
  }

  /**
   * Pop the current context and restore the previous one
   */
  static pop(): ProviderContext | null {
    const previous = ProviderContext.contextStack.pop();
    if (previous) {
      previous.activate();
    }
    return previous || null;
  }

  /**
   * Reset to no active context (for testing)
   */
  static reset(): void {
    ProviderContext.currentContext = null;
    ProviderContext.contextStack = [];
  }

  // ============================================================================
  // User-Level Paths (Home Directory)
  // ============================================================================

  /** User config file path: ~/.ax-{provider}/config.json */
  get userConfigPath(): string {
    return join(this.userDir, PROVIDER_FILES.CONFIG);
  }

  /** User history file path: ~/.ax-{provider}/history.json */
  get userHistoryPath(): string {
    return join(this.userDir, PROVIDER_FILES.HISTORY);
  }

  /** User custom instructions: ~/.ax-{provider}/CUSTOM.md */
  get userCustomMdPath(): string {
    return join(this.userDir, PROVIDER_FILES.CUSTOM_MD);
  }

  /** User cache directory: ~/.ax-{provider}/cache/ */
  get userCacheDir(): string {
    return join(this.userDir, PROVIDER_DIRS.CACHE);
  }

  /** User sessions directory: ~/.ax-{provider}/sessions/ */
  get userSessionsDir(): string {
    return join(this.userDir, PROVIDER_DIRS.SESSIONS);
  }

  /** User plans directory: ~/.ax-{provider}/plans/ */
  get userPlansDir(): string {
    return join(this.userDir, PROVIDER_DIRS.PLANS);
  }

  /** User templates directory: ~/.ax-{provider}/templates/ */
  get userTemplatesDir(): string {
    return join(this.userDir, PROVIDER_DIRS.TEMPLATES);
  }

  /** User commands directory: ~/.ax-{provider}/commands/ */
  get userCommandsDir(): string {
    return join(this.userDir, PROVIDER_DIRS.COMMANDS);
  }

  // ============================================================================
  // Project-Level Paths (Current Working Directory)
  // ============================================================================

  /** Project settings file: .ax-{provider}/settings.json */
  get projectSettingsPath(): string {
    return join(this.projectDir, PROVIDER_FILES.SETTINGS);
  }

  /** Project custom instructions: .ax-{provider}/CUSTOM.md */
  get projectCustomMdPath(): string {
    return join(this.projectDir, PROVIDER_FILES.CUSTOM_MD);
  }

  /** Project memory file: .ax-{provider}/memory.json */
  get projectMemoryPath(): string {
    return join(this.projectDir, PROVIDER_FILES.MEMORY);
  }

  /** Project index file: .ax-{provider}/index.json */
  get projectIndexPath(): string {
    return join(this.projectDir, PROVIDER_FILES.INDEX);
  }

  /** Project cache directory: .ax-{provider}/cache/ */
  get projectCacheDir(): string {
    return join(this.projectDir, PROVIDER_DIRS.CACHE);
  }

  /** Project checkpoints directory: .ax-{provider}/checkpoints/ */
  get projectCheckpointsDir(): string {
    return join(this.projectDir, PROVIDER_DIRS.CHECKPOINTS);
  }

  /** Project commands directory: .ax-{provider}/commands/ */
  get projectCommandsDir(): string {
    return join(this.projectDir, PROVIDER_DIRS.COMMANDS);
  }

  /** Project plans directory: .ax-{provider}/plans/ */
  get projectPlansDir(): string {
    return join(this.projectDir, PROVIDER_DIRS.PLANS);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Ensure user directory exists with proper permissions
   */
  ensureUserDir(): void {
    if (!existsSync(this.userDir)) {
      mkdirSync(this.userDir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Ensure project directory exists
   */
  ensureProjectDir(): void {
    if (!existsSync(this.projectDir)) {
      mkdirSync(this.projectDir, { recursive: true });
    }
  }

  /**
   * Ensure a subdirectory exists in user dir
   */
  ensureUserSubdir(subdir: string): string {
    const fullPath = join(this.userDir, subdir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true, mode: 0o700 });
    }
    return fullPath;
  }

  /**
   * Ensure a subdirectory exists in project dir
   */
  ensureProjectSubdir(subdir: string): string {
    const fullPath = join(this.projectDir, subdir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
    return fullPath;
  }

  /**
   * Get a namespaced cache key to avoid conflicts
   */
  getCacheNamespace(baseName: string): string {
    return `${this.provider}_${baseName}`;
  }

  /**
   * Get environment-based API key for this provider
   */
  getEnvApiKey(): string | undefined {
    return process.env[this.config.apiKeyEnvVar];
  }

  /**
   * Check if this provider is configured (has config file)
   */
  isConfigured(): boolean {
    return existsSync(this.userConfigPath);
  }

  /**
   * Get the lock file path for a given file
   */
  getLockPath(filePath: string): string {
    return `${filePath}.lock`;
  }

  /**
   * Create a context for a specific project root
   */
  withProjectRoot(projectRoot: string): ProviderContext {
    return new ProviderContext(this.provider, resolve(projectRoot));
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get the current provider context
 * Shorthand for ProviderContext.current()
 */
export function getProviderContext(): ProviderContext {
  return ProviderContext.current();
}

/**
 * Create and activate a provider context
 */
export function activateProvider(
  provider: ProviderType,
  projectRoot?: string
): ProviderContext {
  const ctx = ProviderContext.create(provider, projectRoot);
  ctx.activate();
  return ctx;
}

/**
 * Run a function with a temporary provider context
 */
export function withProvider<T>(
  provider: ProviderType,
  fn: (ctx: ProviderContext) => T,
  projectRoot?: string
): T {
  const ctx = ProviderContext.create(provider, projectRoot);
  ctx.push();
  try {
    return fn(ctx);
  } finally {
    ProviderContext.pop();
  }
}

/**
 * Run an async function with a temporary provider context
 *
 * WARNING: This function uses a global stack which is NOT safe for concurrent
 * async operations. If you need to run multiple providers in parallel, use
 * ProviderContext.create() directly and pass the context explicitly.
 *
 * @example Safe usage (sequential):
 * ```typescript
 * await withProviderAsync('glm', async (ctx) => { ... });
 * await withProviderAsync('grok', async (ctx) => { ... });
 * ```
 *
 * @example UNSAFE - DON'T DO THIS:
 * ```typescript
 * await Promise.all([
 *   withProviderAsync('glm', async () => { ... }),
 *   withProviderAsync('grok', async () => { ... }),
 * ]); // Race condition!
 * ```
 *
 * @example Safe parallel usage:
 * ```typescript
 * const glmCtx = ProviderContext.create('glm');
 * const grokCtx = ProviderContext.create('grok');
 * await Promise.all([
 *   doWorkWith(glmCtx),
 *   doWorkWith(grokCtx),
 * ]);
 * ```
 *
 * @deprecated For parallel operations, use ProviderContext.create() directly
 */
export async function withProviderAsync<T>(
  provider: ProviderType,
  fn: (ctx: ProviderContext) => Promise<T>,
  projectRoot?: string
): Promise<T> {
  const ctx = ProviderContext.create(provider, projectRoot);
  ctx.push();
  try {
    return await fn(ctx);
  } finally {
    ProviderContext.pop();
  }
}

/**
 * Validate and normalize a provider string
 * Returns the provider type or null if invalid
 */
export function validateProvider(value: string | undefined): ProviderType | null {
  if (!value) return null;

  const normalized = value.toLowerCase().trim() as ProviderType;
  if (PROVIDER_CONFIGS[normalized]) {
    return normalized;
  }

  return null;
}

// Track if we've already warned about invalid provider
let invalidProviderWarned = false;

/**
 * Detect provider from environment or fall back to generic
 */
export function detectProvider(): ProviderType {
  // Check explicit environment variable
  const envProvider = process.env.AX_PROVIDER;
  if (envProvider) {
    const validated = validateProvider(envProvider);
    if (validated) {
      return validated;
    }
    // Warn about invalid provider (only once)
    if (process.env.NODE_ENV !== 'test' && !invalidProviderWarned) {
      console.warn(
        `[ax-cli] Warning: Invalid AX_PROVIDER="${envProvider}". ` +
        `Valid values: glm, grok, generic. Falling back to auto-detection.`
      );
      invalidProviderWarned = true;
    }
  }

  // Check API key environment variables
  if (process.env.ZAI_API_KEY) {
    return 'glm';
  }
  if (process.env.XAI_API_KEY || process.env.GROK_API_KEY) {
    return 'grok';
  }

  return 'generic';
}
