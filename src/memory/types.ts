/**
 * Project Memory type definitions
 *
 * Provides types for the Project Memory feature which enables
 * z.ai GLM-4.6 implicit caching through consistent prompt prefixes.
 */

import { CONFIG_DIR_NAME } from '../constants.js';

/**
 * Configuration for a directory to scan
 */
export interface DirectoryConfig {
  /** Relative path from project root */
  path: string;
  /** Maximum depth to scan (1-10) */
  max_depth: number;
}

/**
 * Source configuration for context generation
 */
export interface SourceConfig {
  /** Directories to scan for structure */
  directories: DirectoryConfig[];
  /** Specific files to include (relative paths) */
  files: string[];
  /** Glob patterns to ignore */
  ignore: string[];
}

/**
 * Token distribution across context sections
 */
export interface ContextSections {
  /** Directory structure tokens */
  structure?: number;
  /** README content tokens */
  readme?: number;
  /** Config files tokens */
  config?: number;
  /** Architecture patterns tokens */
  patterns?: number;
}

/**
 * Generated context data
 */
export interface ContextData {
  /** Formatted context string for injection */
  formatted: string;
  /** Estimated token count */
  token_estimate: number;
  /** Token distribution by section */
  sections: ContextSections;
}

/**
 * Cache statistics collected from API responses
 */
export interface CacheStats {
  /** Cached tokens from last API call */
  last_cached_tokens?: number;
  /** Total prompt tokens from last API call */
  last_prompt_tokens?: number;
  /** Cumulative tokens saved through caching */
  total_tokens_saved?: number;
  /** Number of API calls with this memory */
  usage_count?: number;
  /** Last time memory was used */
  last_used_at?: string;
}

/**
 * Main Project Memory structure
 * Stored in .ax-cli/memory.json
 */
export interface ProjectMemory {
  /** Schema version for future migrations */
  version: 1;
  /** Creation timestamp (ISO 8601) */
  created_at: string;
  /** Last update timestamp (ISO 8601) */
  updated_at: string;
  /** Absolute path to project root */
  project_root: string;
  /** SHA-256 hash of context content for change detection */
  content_hash: string;
  /** Source configuration used for generation */
  source: SourceConfig;
  /** Generated context data */
  context: ContextData;
  /** Cache statistics (optional, updated after API calls) */
  stats?: CacheStats;
}

/**
 * Options for warmup command
 */
export interface WarmupOptions {
  /** Directory scan depth (default: 3) */
  depth?: number;
  /** Maximum tokens for context (default: 8000) */
  maxTokens?: number;
  /** Show detailed progress */
  verbose?: boolean;
  /** Preview without saving */
  dryRun?: boolean;
}

/**
 * Options for refresh command
 */
export interface RefreshOptions {
  /** Show change details */
  verbose?: boolean;
  /** Force refresh even if unchanged */
  force?: boolean;
}

/**
 * Options for status command
 */
export interface StatusOptions {
  /** Show full context content */
  verbose?: boolean;
  /** Output as JSON */
  json?: boolean;
}

/**
 * Result of warmup operation
 */
export interface WarmupResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Generated memory (if successful) */
  memory?: ProjectMemory;
  /** Error message (if failed) */
  error?: string;
  /** Non-fatal warnings */
  warnings?: string[];
}

/**
 * Result of refresh operation
 */
export interface RefreshResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Whether content changed */
  changed: boolean;
  /** Previous token count */
  previousTokens?: number;
  /** Current token count */
  currentTokens?: number;
  /** List of detected changes */
  changes?: string[];
  /** Error message (if failed) */
  error?: string;
}

/**
 * Default configuration values
 */
export const MEMORY_DEFAULTS = {
  /** Default scan depth */
  DEPTH: 3,
  /** Default max tokens */
  MAX_TOKENS: 8000,
  /** Max recommended tokens for optimal caching */
  MAX_RECOMMENDED_TOKENS: 10000,
  /** Max file size to read (4KB) */
  MAX_FILE_SIZE: 4096,
  /** Memory filename */
  FILENAME: 'memory.json',
  /** Config directory */
  CONFIG_DIR: CONFIG_DIR_NAME,
} as const;

/**
 * Default ignore patterns
 */
export const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  '.next',
  '.nuxt',
  'coverage',
  '.cache',
  '.turbo',
  '.vercel',
  '__pycache__',
  '.pytest_cache',
  'target',
  'vendor',
  '*.log',
  '*.lock',
  '.DS_Store',
] as const;

/**
 * Default files to include in context
 */
export const DEFAULT_INCLUDE_FILES = [
  'README.md',
  'readme.md',
  'package.json',
  'tsconfig.json',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'docker-compose.yml',
  'docker-compose.yaml',
  'Dockerfile',
  '.ax-cli/CUSTOM.md',
] as const;

/**
 * Default directories to scan
 */
export const DEFAULT_SCAN_DIRECTORIES: readonly DirectoryConfig[] = [
  { path: 'src', max_depth: 3 },
  { path: 'lib', max_depth: 3 },
  { path: 'app', max_depth: 3 },
  { path: 'packages', max_depth: 2 },
  { path: 'apps', max_depth: 2 },
] as const;
