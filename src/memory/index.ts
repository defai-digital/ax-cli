/**
 * Project Memory Module
 *
 * Provides functionality for creating and managing project context
 * that enables z.ai GLM-4.6 implicit caching through consistent
 * system prompt prefixes.
 *
 * Key Components:
 * - ContextGenerator: Scans project and generates context
 * - ContextStore: Reads/writes memory.json
 * - ContextInjector: Injects context into system prompts
 * - StatsCollector: Tracks cache performance metrics
 *
 * Usage:
 * ```typescript
 * import {
 *   ContextGenerator,
 *   ContextStore,
 *   ContextInjector,
 *   getContextInjector,
 * } from './memory/index.js';
 *
 * // Generate memory
 * const generator = new ContextGenerator(projectRoot);
 * const result = await generator.generate({ depth: 3 });
 *
 * // Save memory
 * const store = new ContextStore(projectRoot);
 * store.save(result.memory);
 *
 * // Inject into prompts
 * const injector = getContextInjector();
 * const enhancedPrompt = injector.injectIntoPrompt(basePrompt);
 * ```
 */

// Types
export type {
  ProjectMemory,
  SourceConfig,
  DirectoryConfig,
  ContextData,
  ContextSections,
  CacheStats,
  WarmupOptions,
  WarmupResult,
  RefreshOptions,
  RefreshResult,
  StatusOptions,
} from './types.js';

export {
  MEMORY_DEFAULTS,
  DEFAULT_IGNORE_PATTERNS,
  DEFAULT_INCLUDE_FILES,
  DEFAULT_SCAN_DIRECTORIES,
} from './types.js';

// Schemas
export {
  ProjectMemorySchema,
  DirectoryConfigSchema,
  SourceConfigSchema,
  ContextDataSchema,
  ContextSectionsSchema,
  CacheStatsSchema,
  safeValidateProjectMemory,
  safeValidateCacheStats,
  safeValidateSourceConfig,
} from './schemas.js';

// Context Generator
export { ContextGenerator } from './context-generator.js';

// Context Store
export {
  ContextStore,
  getContextStore,
  resetDefaultStore,
  type StoreResult,
} from './context-store.js';

// Context Injector
export {
  ContextInjector,
  getContextInjector,
  resetDefaultInjector,
  type MemoryMetadata,
} from './context-injector.js';

// Stats Collector
export {
  StatsCollector,
  getStatsCollector,
  resetDefaultCollector,
  type FormattedStats,
} from './stats-collector.js';

// Provider-Aware Context Store (Multi-Provider Support)
export {
  ProviderContextStore,
  getProviderContextStore,
  getAllProviderMemoryMetadata,
} from './provider-context-store.js';
