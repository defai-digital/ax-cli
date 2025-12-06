/**
 * Context Injector - Injects project memory into system prompts
 *
 * Handles loading and injection of memory context as a prefix
 * to enable z.ai automatic caching of repeated content.
 */

import { ContextStore } from './context-store.js';
import type { ProjectMemory } from './types.js';

/**
 * Memory metadata for quick access without loading full context
 */
export interface MemoryMetadata {
  exists: boolean;
  tokenEstimate?: number;
  updatedAt?: string;
  contentHash?: string;
  usageCount?: number;
}

/**
 * ContextInjector - Manages memory context injection
 */
export class ContextInjector {
  private store: ContextStore;
  private cachedMemory: ProjectMemory | null = null;
  private enabled: boolean = true;

  constructor(projectRoot: string = process.cwd()) {
    this.store = new ContextStore(projectRoot);
  }

  /**
   * Enable or disable memory injection
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if memory injection is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get project memory context string
   * Returns null if no memory exists or injection is disabled
   */
  getContext(): string | null {
    if (!this.enabled) {
      return null;
    }

    // Use cached memory if available
    if (this.cachedMemory) {
      return this.cachedMemory.context.formatted;
    }

    // Load from store
    const result = this.store.load();
    if (!result.success) {
      return null;
    }

    // Cache for subsequent calls
    this.cachedMemory = result.data;
    return result.data.context.formatted;
  }

  /**
   * Inject memory context into a system prompt
   *
   * Memory context is prepended as a prefix to enable z.ai
   * automatic caching when the same prefix is used across requests.
   *
   * @param basePrompt - The base system prompt
   * @returns Modified prompt with memory context prefix
   */
  injectIntoPrompt(basePrompt: string): string {
    const memoryContext = this.getContext();

    if (!memoryContext) {
      return basePrompt;
    }

    // Use consistent separator for cache stability
    const separator = '\n\n---\n\n';

    return `${memoryContext}${separator}${basePrompt}`;
  }

  /**
   * Check if project memory exists
   */
  hasMemory(): boolean {
    return this.store.exists();
  }

  /**
   * Get memory metadata without loading full context
   */
  getMetadata(): MemoryMetadata {
    return this.store.getMetadata();
  }

  /**
   * Get the full memory object (loads from disk if not cached)
   */
  getMemory(): ProjectMemory | null {
    if (this.cachedMemory) {
      return this.cachedMemory;
    }

    const result = this.store.load();
    if (!result.success) {
      return null;
    }

    this.cachedMemory = result.data;
    return result.data;
  }

  /**
   * Clear the cached memory
   * Call this when memory is updated externally
   */
  clearCache(): void {
    this.cachedMemory = null;
  }

  /**
   * Get estimated token count of the memory context
   */
  getTokenEstimate(): number {
    const memory = this.getMemory();
    return memory?.context.token_estimate ?? 0;
  }

  /**
   * Format a reminder message about missing memory
   * Returns null if memory exists
   */
  getMissingMemoryHint(): string | null {
    if (this.hasMemory()) {
      return null;
    }

    return 'No project memory found. Run "ax memory warmup" to improve context reuse.';
  }
}

/**
 * Singleton instance for convenience
 * NOTE: Singleton uses process.cwd() as projectRoot
 */
let defaultInjector: ContextInjector | null = null;

/**
 * Get a context injector instance
 *
 * IMPORTANT: Singleton behavior
 * - Without projectRoot: Returns singleton instance (uses process.cwd())
 * - With projectRoot: Returns NEW instance for that specific project
 *
 * Example:
 * ```typescript
 * const injector1 = getContextInjector();           // Singleton
 * const injector2 = getContextInjector();           // Same instance
 * const injector3 = getContextInjector('/custom'); // New instance
 * ```
 *
 * @param projectRoot - Optional custom project root. If provided, returns a new instance.
 * @returns ContextInjector instance
 */
export function getContextInjector(projectRoot?: string): ContextInjector {
  if (projectRoot) {
    // Custom project root - always return new instance
    return new ContextInjector(projectRoot);
  }

  // Default behavior - return singleton
  if (!defaultInjector) {
    defaultInjector = new ContextInjector();
  }

  return defaultInjector;
}

/**
 * Reset the default injector (mainly for testing)
 */
export function resetDefaultInjector(): void {
  defaultInjector = null;
}
