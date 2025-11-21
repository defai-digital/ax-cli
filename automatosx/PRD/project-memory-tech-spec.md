# Project Memory - Technical Specification

> **版本**: 1.0
> **日期**: 2025-11-21
> **相關 PRD**: project-memory-prd.md

---

## 1. 檔案結構

### 1.1 新增檔案

```
src/
├── memory/
│   ├── index.ts                    # 模組入口，匯出公開 API
│   ├── types.ts                    # TypeScript 介面定義
│   ├── schemas.ts                  # Zod schemas
│   ├── context-generator.ts        # 掃描專案產生 context
│   ├── context-store.ts            # 讀寫 memory.json
│   ├── context-injector.ts         # 注入到 system prompt
│   ├── stats-collector.ts          # 收集快取統計
│   └── change-detector.ts          # 偵測專案變更
├── commands/
│   └── memory.ts                   # 更新：新增 warmup/refresh/status/clear/stats
```

### 1.2 修改檔案

```
src/
├── agent/index.ts                  # 整合 memory context 到 system prompt
├── llm/client.ts                   # 收集 cached_tokens 統計
├── index.ts                        # 註冊新的 memory subcommands
└── schemas/index.ts                # 匯出 memory schemas
```

---

## 2. 詳細設計

### 2.1 `src/memory/types.ts`

```typescript
/**
 * Project Memory type definitions
 */

export interface DirectoryConfig {
  path: string;
  max_depth: number;
}

export interface SourceConfig {
  directories: DirectoryConfig[];
  files: string[];
  ignore: string[];
}

export interface ContextSections {
  structure?: number;
  readme?: number;
  config?: number;
  patterns?: number;
}

export interface ContextData {
  formatted: string;
  token_estimate: number;
  sections: ContextSections;
}

export interface CacheStats {
  last_cached_tokens?: number;
  last_prompt_tokens?: number;
  total_tokens_saved?: number;
  usage_count?: number;
  last_used_at?: string;
}

export interface ProjectMemory {
  version: 1;
  created_at: string;
  updated_at: string;
  project_root: string;
  content_hash: string;
  source: SourceConfig;
  context: ContextData;
  stats?: CacheStats;
}

export interface WarmupOptions {
  depth?: number;
  maxTokens?: number;
  verbose?: boolean;
  dryRun?: boolean;
}

export interface RefreshOptions {
  verbose?: boolean;
  force?: boolean;
}

export interface StatusOptions {
  verbose?: boolean;
  json?: boolean;
}

export interface WarmupResult {
  success: boolean;
  memory?: ProjectMemory;
  error?: string;
  warnings?: string[];
}

export interface RefreshResult {
  success: boolean;
  changed: boolean;
  previousTokens?: number;
  currentTokens?: number;
  changes?: string[];
  error?: string;
}
```

### 2.2 `src/memory/schemas.ts`

```typescript
/**
 * Zod schemas for Project Memory validation
 */

import { z } from 'zod';

export const DirectoryConfigSchema = z.object({
  path: z.string().min(1),
  max_depth: z.number().int().min(1).max(10),
});

export const SourceConfigSchema = z.object({
  directories: z.array(DirectoryConfigSchema),
  files: z.array(z.string()),
  ignore: z.array(z.string()),
});

export const ContextSectionsSchema = z.object({
  structure: z.number().int().min(0).optional(),
  readme: z.number().int().min(0).optional(),
  config: z.number().int().min(0).optional(),
  patterns: z.number().int().min(0).optional(),
});

export const ContextDataSchema = z.object({
  formatted: z.string(),
  token_estimate: z.number().int().min(0),
  sections: ContextSectionsSchema,
});

export const CacheStatsSchema = z.object({
  last_cached_tokens: z.number().int().min(0).optional(),
  last_prompt_tokens: z.number().int().min(0).optional(),
  total_tokens_saved: z.number().int().min(0).optional(),
  usage_count: z.number().int().min(0).optional(),
  last_used_at: z.string().datetime().optional(),
});

export const ProjectMemorySchema = z.object({
  version: z.literal(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  project_root: z.string(),
  content_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  source: SourceConfigSchema,
  context: ContextDataSchema,
  stats: CacheStatsSchema.optional(),
});

export type ProjectMemoryType = z.infer<typeof ProjectMemorySchema>;

// Safe validation helpers
export function safeValidateProjectMemory(data: unknown) {
  const result = ProjectMemorySchema.safeParse(data);
  if (result.success) {
    return { success: true as const, data: result.data };
  }
  return { success: false as const, error: result.error.message };
}
```

### 2.3 `src/memory/context-generator.ts`

```typescript
/**
 * Generates project context by scanning the codebase
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { ProjectMemory, SourceConfig, WarmupOptions, WarmupResult } from './types.js';
import { createTokenCounter } from '../utils/token-counter.js';
import { ProjectAnalyzer } from '../utils/project-analyzer.js';

// Default ignore patterns
const DEFAULT_IGNORE = [
  'node_modules',
  'dist',
  'build',
  '.git',
  '.next',
  '.nuxt',
  'coverage',
  '.cache',
  '*.log',
  '*.lock',
];

// Default files to include
const DEFAULT_FILES = [
  'README.md',
  'package.json',
  'tsconfig.json',
  'docker-compose.yml',
  'docker-compose.yaml',
  'Dockerfile',
];

// Default directories to scan
const DEFAULT_DIRECTORIES = [
  { path: 'src', max_depth: 3 },
  { path: 'lib', max_depth: 3 },
  { path: 'packages', max_depth: 2 },
  { path: 'apps', max_depth: 2 },
];

export class ContextGenerator {
  private projectRoot: string;
  private tokenCounter: ReturnType<typeof createTokenCounter>;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.tokenCounter = createTokenCounter();
  }

  /**
   * Generate project memory from scanning the codebase
   */
  async generate(options: WarmupOptions = {}): Promise<WarmupResult> {
    const { depth = 3, maxTokens = 8000, verbose = false } = options;
    const warnings: string[] = [];

    try {
      // Build source config
      const source = this.buildSourceConfig(depth);

      // Generate context sections
      const sections: Record<string, { content: string; tokens: number }> = {};

      // 1. Directory structure
      if (verbose) console.log('  Scanning directory structure...');
      const structure = await this.generateStructure(source.directories);
      sections.structure = {
        content: structure,
        tokens: this.tokenCounter.countTokens(structure),
      };

      // 2. README content
      if (verbose) console.log('  Reading README...');
      const readme = await this.generateReadmeSummary();
      if (readme) {
        sections.readme = {
          content: readme,
          tokens: this.tokenCounter.countTokens(readme),
        };
      }

      // 3. Config files summary
      if (verbose) console.log('  Analyzing config files...');
      const config = await this.generateConfigSummary(source.files);
      sections.config = {
        content: config,
        tokens: this.tokenCounter.countTokens(config),
      };

      // 4. Architecture patterns (from ProjectAnalyzer)
      if (verbose) console.log('  Detecting patterns...');
      const patterns = await this.generatePatternsSummary();
      sections.patterns = {
        content: patterns,
        tokens: this.tokenCounter.countTokens(patterns),
      };

      // Assemble formatted context
      const formatted = this.assembleContext(sections, maxTokens);
      const tokenEstimate = this.tokenCounter.countTokens(formatted);

      // Calculate content hash
      const contentHash = this.calculateHash(formatted);

      // Build result
      const memory: ProjectMemory = {
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        project_root: this.projectRoot,
        content_hash: contentHash,
        source,
        context: {
          formatted,
          token_estimate: tokenEstimate,
          sections: {
            structure: sections.structure?.tokens,
            readme: sections.readme?.tokens,
            config: sections.config?.tokens,
            patterns: sections.patterns?.tokens,
          },
        },
      };

      return {
        success: true,
        memory,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }
  }

  /**
   * Build source config from defaults and project structure
   */
  private buildSourceConfig(depth: number): SourceConfig {
    const directories = DEFAULT_DIRECTORIES
      .filter(d => fs.existsSync(path.join(this.projectRoot, d.path)))
      .map(d => ({ ...d, max_depth: Math.min(d.max_depth, depth) }));

    // If no default directories found, scan from root
    if (directories.length === 0) {
      directories.push({ path: '.', max_depth: depth });
    }

    const files = DEFAULT_FILES.filter(f =>
      fs.existsSync(path.join(this.projectRoot, f))
    );

    return {
      directories,
      files,
      ignore: [...DEFAULT_IGNORE],
    };
  }

  /**
   * Generate directory tree structure
   */
  private async generateStructure(directories: Array<{ path: string; max_depth: number }>): Promise<string> {
    const lines: string[] = ['## Directory Structure', '```'];

    for (const dir of directories) {
      const tree = this.buildTree(dir.path, dir.max_depth);
      lines.push(...tree);
    }

    lines.push('```');
    return lines.join('\n');
  }

  /**
   * Recursively build tree representation
   */
  private buildTree(
    dirPath: string,
    maxDepth: number,
    prefix: string = '',
    currentDepth: number = 0
  ): string[] {
    if (currentDepth >= maxDepth) return [];

    const fullPath = path.join(this.projectRoot, dirPath);
    if (!fs.existsSync(fullPath)) return [];

    const lines: string[] = [];
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });

    // Filter and sort entries
    const filtered = entries
      .filter(e => !DEFAULT_IGNORE.some(pattern => {
        if (pattern.startsWith('*')) {
          return e.name.endsWith(pattern.slice(1));
        }
        return e.name === pattern;
      }))
      .sort((a, b) => {
        // Directories first
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    filtered.forEach((entry, index) => {
      const isLast = index === filtered.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = isLast ? '    ' : '│   ';

      lines.push(`${prefix}${connector}${entry.name}${entry.isDirectory() ? '/' : ''}`);

      if (entry.isDirectory() && currentDepth + 1 < maxDepth) {
        const childPath = path.join(dirPath, entry.name);
        const childLines = this.buildTree(childPath, maxDepth, prefix + childPrefix, currentDepth + 1);
        lines.push(...childLines);
      }
    });

    return lines;
  }

  /**
   * Generate README summary
   */
  private async generateReadmeSummary(): Promise<string | null> {
    const readmePaths = ['README.md', 'readme.md', 'Readme.md'];

    for (const readmePath of readmePaths) {
      const fullPath = path.join(this.projectRoot, readmePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        // Truncate to first 4KB
        const truncated = content.slice(0, 4096);
        const isTruncated = content.length > 4096;

        return [
          '## README Summary',
          truncated,
          isTruncated ? '\n[...truncated]' : '',
        ].join('\n');
      }
    }

    return null;
  }

  /**
   * Generate config files summary
   */
  private async generateConfigSummary(files: string[]): Promise<string> {
    const lines: string[] = ['## Key Configuration'];

    for (const file of files) {
      const fullPath = path.join(this.projectRoot, file);
      if (!fs.existsSync(fullPath)) continue;

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const summary = this.summarizeConfigFile(file, content);
        if (summary) {
          lines.push('', `### ${file}`, summary);
        }
      } catch {
        // Skip unreadable files
      }
    }

    return lines.join('\n');
  }

  /**
   * Summarize a config file based on its type
   */
  private summarizeConfigFile(filename: string, content: string): string | null {
    try {
      if (filename === 'package.json') {
        const pkg = JSON.parse(content);
        const parts: string[] = [];

        if (pkg.name) parts.push(`- Name: ${pkg.name}`);
        if (pkg.version) parts.push(`- Version: ${pkg.version}`);
        if (pkg.type) parts.push(`- Type: ${pkg.type}`);
        if (pkg.bin) parts.push(`- CLI: Yes`);

        if (pkg.dependencies) {
          const deps = Object.keys(pkg.dependencies).slice(0, 10);
          parts.push(`- Dependencies: ${deps.join(', ')}${Object.keys(pkg.dependencies).length > 10 ? '...' : ''}`);
        }

        if (pkg.scripts) {
          const scripts = Object.keys(pkg.scripts).slice(0, 5);
          parts.push(`- Scripts: ${scripts.join(', ')}`);
        }

        return parts.join('\n');
      }

      if (filename === 'tsconfig.json') {
        const config = JSON.parse(content);
        const opts = config.compilerOptions || {};
        const parts: string[] = [];

        if (opts.target) parts.push(`- Target: ${opts.target}`);
        if (opts.module) parts.push(`- Module: ${opts.module}`);
        if (opts.strict) parts.push(`- Strict: ${opts.strict}`);

        return parts.join('\n');
      }

      // For other files, show first 500 chars
      return '```\n' + content.slice(0, 500) + (content.length > 500 ? '\n...' : '') + '\n```';
    } catch {
      return null;
    }
  }

  /**
   * Generate patterns summary using ProjectAnalyzer
   */
  private async generatePatternsSummary(): Promise<string> {
    const analyzer = new ProjectAnalyzer(this.projectRoot);
    const result = await analyzer.analyze();

    if (!result.success || !result.projectInfo) {
      return '## Architecture Patterns\n(Analysis failed)';
    }

    const info = result.projectInfo;
    const lines: string[] = ['## Architecture Patterns'];

    if (info.projectType) {
      lines.push(`- Project Type: ${info.projectType}`);
    }
    if (info.primaryLanguage) {
      lines.push(`- Primary Language: ${info.primaryLanguage}`);
    }
    if (info.techStack.length > 0) {
      lines.push(`- Tech Stack: ${info.techStack.join(', ')}`);
    }
    if (info.conventions) {
      const conv = info.conventions;
      if (conv.moduleSystem) lines.push(`- Module System: ${conv.moduleSystem}`);
      if (conv.testFramework) lines.push(`- Test Framework: ${conv.testFramework}`);
      if (conv.validation) lines.push(`- Validation: ${conv.validation}`);
    }

    return lines.join('\n');
  }

  /**
   * Assemble final context from sections
   */
  private assembleContext(
    sections: Record<string, { content: string; tokens: number }>,
    maxTokens: number
  ): string {
    const projectName = path.basename(this.projectRoot);
    const parts: string[] = [`# Project: ${projectName}`, ''];

    let currentTokens = this.tokenCounter.countTokens(parts.join('\n'));

    // Priority order for sections
    const priority = ['structure', 'config', 'patterns', 'readme'];

    for (const key of priority) {
      const section = sections[key];
      if (!section) continue;

      if (currentTokens + section.tokens <= maxTokens) {
        parts.push(section.content, '');
        currentTokens += section.tokens;
      } else {
        // Truncate section to fit
        const remaining = maxTokens - currentTokens - 100; // Buffer
        if (remaining > 200) {
          const truncated = this.truncateToTokens(section.content, remaining);
          parts.push(truncated, '\n[...truncated due to token limit]', '');
        }
        break;
      }
    }

    return parts.join('\n').trim();
  }

  /**
   * Truncate text to approximate token count
   */
  private truncateToTokens(text: string, maxTokens: number): string {
    // Rough estimate: 4 chars per token
    const maxChars = maxTokens * 4;
    return text.slice(0, maxChars);
  }

  /**
   * Calculate SHA-256 hash of content
   */
  private calculateHash(content: string): string {
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return `sha256:${hash}`;
  }
}
```

### 2.4 `src/memory/context-store.ts`

```typescript
/**
 * Handles reading and writing memory.json
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ProjectMemory, CacheStats } from './types.js';
import { safeValidateProjectMemory } from './schemas.js';
import { parseJsonFile } from '../utils/json-utils.js';

const MEMORY_FILENAME = 'memory.json';
const AX_CLI_DIR = '.ax-cli';

export class ContextStore {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Get path to memory.json
   */
  getMemoryPath(): string {
    return path.join(this.projectRoot, AX_CLI_DIR, MEMORY_FILENAME);
  }

  /**
   * Check if memory.json exists
   */
  exists(): boolean {
    return fs.existsSync(this.getMemoryPath());
  }

  /**
   * Load project memory from disk
   */
  load(): { success: true; data: ProjectMemory } | { success: false; error: string } {
    const memoryPath = this.getMemoryPath();

    if (!fs.existsSync(memoryPath)) {
      return { success: false, error: 'Memory file not found. Run: ax memory warmup' };
    }

    const result = parseJsonFile<unknown>(memoryPath);
    if (!result.success) {
      return { success: false, error: `Failed to parse memory.json: ${result.error}` };
    }

    // Validate schema
    const validation = safeValidateProjectMemory(result.data);
    if (!validation.success) {
      return { success: false, error: `Invalid memory.json schema: ${validation.error}` };
    }

    return { success: true, data: validation.data };
  }

  /**
   * Save project memory to disk
   */
  save(memory: ProjectMemory): { success: boolean; error?: string } {
    const memoryPath = this.getMemoryPath();
    const axCliDir = path.dirname(memoryPath);

    try {
      // Ensure .ax-cli directory exists
      if (!fs.existsSync(axCliDir)) {
        fs.mkdirSync(axCliDir, { recursive: true });
      }

      // Atomic write
      const tmpPath = `${memoryPath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(memory, null, 2), 'utf-8');
      fs.renameSync(tmpPath, memoryPath);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update stats in memory.json
   */
  updateStats(stats: Partial<CacheStats>): { success: boolean; error?: string } {
    const loadResult = this.load();
    if (!loadResult.success) {
      return { success: false, error: loadResult.error };
    }

    const memory = loadResult.data;
    memory.stats = {
      ...memory.stats,
      ...stats,
      last_used_at: new Date().toISOString(),
    };
    memory.updated_at = new Date().toISOString();

    return this.save(memory);
  }

  /**
   * Delete memory.json
   */
  clear(): { success: boolean; error?: string } {
    const memoryPath = this.getMemoryPath();

    if (!fs.existsSync(memoryPath)) {
      return { success: true }; // Already cleared
    }

    try {
      fs.unlinkSync(memoryPath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

### 2.5 `src/memory/context-injector.ts`

```typescript
/**
 * Injects project memory into system prompts
 */

import { ContextStore } from './context-store.js';
import type { ProjectMemory } from './types.js';

export class ContextInjector {
  private store: ContextStore;
  private cachedMemory: ProjectMemory | null = null;

  constructor(projectRoot: string = process.cwd()) {
    this.store = new ContextStore(projectRoot);
  }

  /**
   * Get project memory context for injection
   * Returns null if no memory exists
   */
  getContext(): string | null {
    if (this.cachedMemory) {
      return this.cachedMemory.context.formatted;
    }

    const result = this.store.load();
    if (!result.success) {
      return null;
    }

    this.cachedMemory = result.data;
    return result.data.context.formatted;
  }

  /**
   * Inject memory context into system prompt
   */
  injectIntoPrompt(basePrompt: string): string {
    const memoryContext = this.getContext();

    if (!memoryContext) {
      return basePrompt;
    }

    // Memory context as prefix for consistent caching
    return `${memoryContext}\n\n---\n\n${basePrompt}`;
  }

  /**
   * Clear cached memory (call when memory is updated)
   */
  clearCache(): void {
    this.cachedMemory = null;
  }

  /**
   * Check if project memory exists
   */
  hasMemory(): boolean {
    return this.store.exists();
  }

  /**
   * Get memory metadata without full context
   */
  getMetadata(): {
    exists: boolean;
    tokenEstimate?: number;
    updatedAt?: string;
    contentHash?: string;
  } {
    if (!this.store.exists()) {
      return { exists: false };
    }

    const result = this.store.load();
    if (!result.success) {
      return { exists: false };
    }

    return {
      exists: true,
      tokenEstimate: result.data.context.token_estimate,
      updatedAt: result.data.updated_at,
      contentHash: result.data.content_hash,
    };
  }
}
```

### 2.6 `src/memory/stats-collector.ts`

```typescript
/**
 * Collects and reports cache statistics
 */

import { ContextStore } from './context-store.js';
import type { CacheStats } from './types.js';

export class StatsCollector {
  private store: ContextStore;

  constructor(projectRoot: string = process.cwd()) {
    this.store = new ContextStore(projectRoot);
  }

  /**
   * Record API response stats
   */
  recordResponse(promptTokens: number, cachedTokens: number): void {
    const result = this.store.load();
    if (!result.success) return;

    const currentStats = result.data.stats || {};

    this.store.updateStats({
      last_cached_tokens: cachedTokens,
      last_prompt_tokens: promptTokens,
      total_tokens_saved: (currentStats.total_tokens_saved || 0) + cachedTokens,
      usage_count: (currentStats.usage_count || 0) + 1,
    });
  }

  /**
   * Get current stats
   */
  getStats(): CacheStats | null {
    const result = this.store.load();
    if (!result.success) return null;
    return result.data.stats || null;
  }

  /**
   * Format stats for display
   */
  formatStats(): string | null {
    const stats = this.getStats();
    if (!stats) return null;

    const cacheRate = stats.last_prompt_tokens && stats.last_cached_tokens
      ? Math.round((stats.last_cached_tokens / stats.last_prompt_tokens) * 100)
      : 0;

    const lines: string[] = [
      '📈 Cache Statistics',
      '',
      `   Usage count:      ${stats.usage_count || 0}`,
      `   Last cache rate:  ${cacheRate}%`,
      `   Tokens saved:     ${stats.total_tokens_saved?.toLocaleString() || 0}`,
    ];

    if (stats.last_used_at) {
      lines.push(`   Last used:        ${new Date(stats.last_used_at).toLocaleString()}`);
    }

    return lines.join('\n');
  }
}
```

---

## 3. CLI 命令實作

### 3.1 更新 `src/commands/memory.ts`

```typescript
/**
 * Memory command - extended for Project Memory
 */

import { Command } from 'commander';
import * as prompts from '@clack/prompts';
import { ContextGenerator } from '../memory/context-generator.js';
import { ContextStore } from '../memory/context-store.js';
import { StatsCollector } from '../memory/stats-collector.js';
import type { WarmupOptions, RefreshOptions, StatusOptions } from '../memory/types.js';

export function createMemoryCommand(): Command {
  const memoryCommand = new Command('memory')
    .description('Manage project memory and custom instructions')
    .alias('mem');

  // ... existing show/edit/add/reset/stats subcommands ...

  // NEW: warmup subcommand
  memoryCommand
    .command('warmup')
    .description('Scan project and create reusable context for GLM')
    .option('-d, --depth <n>', 'Directory scan depth', '3')
    .option('-m, --max-tokens <n>', 'Maximum context tokens', '8000')
    .option('-v, --verbose', 'Show detailed scan progress', false)
    .option('--dry-run', 'Preview without saving', false)
    .action(async (options: {
      depth?: string;
      maxTokens?: string;
      verbose?: boolean;
      dryRun?: boolean;
    }) => {
      const warmupOptions: WarmupOptions = {
        depth: parseInt(options.depth || '3', 10),
        maxTokens: parseInt(options.maxTokens || '8000', 10),
        verbose: options.verbose,
        dryRun: options.dryRun,
      };

      console.log('🔄 Scanning project...\n');

      const generator = new ContextGenerator(process.cwd());
      const result = await generator.generate(warmupOptions);

      if (!result.success) {
        console.error(`❌ Failed to generate context: ${result.error}`);
        process.exit(1);
      }

      const memory = result.memory!;

      // Display results
      console.log(`✓ Project memory generated (${memory.context.token_estimate.toLocaleString()} tokens)\n`);

      console.log('📊 Context breakdown:');
      const sections = memory.context.sections;
      const total = memory.context.token_estimate;

      if (sections.structure) {
        const pct = Math.round((sections.structure / total) * 100);
        console.log(`   Structure:  ${sections.structure.toLocaleString()} tokens (${pct}%)`);
      }
      if (sections.readme) {
        const pct = Math.round((sections.readme / total) * 100);
        console.log(`   README:     ${sections.readme.toLocaleString()} tokens (${pct}%)`);
      }
      if (sections.config) {
        const pct = Math.round((sections.config / total) * 100);
        console.log(`   Config:     ${sections.config.toLocaleString()} tokens (${pct}%)`);
      }
      if (sections.patterns) {
        const pct = Math.round((sections.patterns / total) * 100);
        console.log(`   Patterns:   ${sections.patterns.toLocaleString()} tokens (${pct}%)`);
      }

      if (options.dryRun) {
        console.log('\n📝 Dry-run mode - no files written');
        if (options.verbose) {
          console.log('\n--- Generated Context ---');
          console.log(memory.context.formatted);
          console.log('--- End Context ---');
        }
        return;
      }

      // Save to disk
      const store = new ContextStore(process.cwd());
      const saveResult = store.save(memory);

      if (!saveResult.success) {
        console.error(`\n❌ Failed to save: ${saveResult.error}`);
        process.exit(1);
      }

      console.log(`\n✅ Saved to .ax-cli/memory.json`);
      console.log('\n💡 This context will be automatically included in ax plan/think/spec');
      console.log('   z.ai will cache identical content for faster responses');
    });

  // NEW: refresh subcommand
  memoryCommand
    .command('refresh')
    .description('Update project memory with latest changes')
    .option('-v, --verbose', 'Show change details', false)
    .option('-f, --force', 'Force refresh even if unchanged', false)
    .action(async (options: RefreshOptions) => {
      const store = new ContextStore(process.cwd());

      if (!store.exists()) {
        console.error('❌ No project memory found');
        console.error('   Run: ax memory warmup');
        process.exit(1);
      }

      const previousResult = store.load();
      if (!previousResult.success) {
        console.error(`❌ Failed to load existing memory: ${previousResult.error}`);
        process.exit(1);
      }

      const previousMemory = previousResult.data;
      const previousTokens = previousMemory.context.token_estimate;

      console.log('🔄 Refreshing project memory...\n');

      const generator = new ContextGenerator(process.cwd());
      const result = await generator.generate({ verbose: options.verbose });

      if (!result.success) {
        console.error(`❌ Failed to regenerate: ${result.error}`);
        process.exit(1);
      }

      const newMemory = result.memory!;

      // Check if changed
      if (newMemory.content_hash === previousMemory.content_hash && !options.force) {
        console.log('✓ No changes detected');
        console.log(`   Current: ${previousTokens.toLocaleString()} tokens`);
        console.log('\n💡 Use --force to regenerate anyway');
        return;
      }

      // Preserve stats
      newMemory.stats = previousMemory.stats;

      const saveResult = store.save(newMemory);
      if (!saveResult.success) {
        console.error(`❌ Failed to save: ${saveResult.error}`);
        process.exit(1);
      }

      const diff = newMemory.context.token_estimate - previousTokens;
      const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;

      console.log('✓ Project memory updated');
      console.log(`   Previous: ${previousTokens.toLocaleString()} tokens`);
      console.log(`   Current:  ${newMemory.context.token_estimate.toLocaleString()} tokens (${diffStr})`);
    });

  // NEW: status subcommand (for memory.json)
  memoryCommand
    .command('status')
    .description('Show project memory status')
    .option('-v, --verbose', 'Show full context', false)
    .option('--json', 'Output as JSON', false)
    .action(async (options: StatusOptions) => {
      const store = new ContextStore(process.cwd());

      if (!store.exists()) {
        console.log('📦 Project Memory: Not initialized');
        console.log('\n💡 Run: ax memory warmup');
        return;
      }

      const result = store.load();
      if (!result.success) {
        console.error(`❌ Failed to load: ${result.error}`);
        process.exit(1);
      }

      const memory = result.data;

      if (options.json) {
        console.log(JSON.stringify(memory, null, 2));
        return;
      }

      console.log('📦 Project Memory Status\n');
      console.log(`   Created:  ${new Date(memory.created_at).toLocaleString()}`);
      console.log(`   Updated:  ${new Date(memory.updated_at).toLocaleString()}`);
      console.log(`   Context:  ${memory.context.token_estimate.toLocaleString()} tokens`);
      console.log(`   Hash:     ${memory.content_hash.slice(0, 20)}...`);

      // Show stats if available
      if (memory.stats) {
        const collector = new StatsCollector(process.cwd());
        const statsDisplay = collector.formatStats();
        if (statsDisplay) {
          console.log('\n' + statsDisplay);
        }
      }

      if (options.verbose) {
        console.log('\n--- Full Context ---');
        console.log(memory.context.formatted);
        console.log('--- End Context ---');
      }
    });

  // NEW: clear subcommand
  memoryCommand
    .command('clear')
    .description('Remove project memory')
    .option('-y, --yes', 'Skip confirmation', false)
    .action(async (options: { yes?: boolean }) => {
      const store = new ContextStore(process.cwd());

      if (!store.exists()) {
        console.log('✓ No project memory to clear');
        return;
      }

      if (!options.yes) {
        const confirmed = await prompts.confirm({
          message: 'Remove project memory?',
          initialValue: false,
        });

        if (prompts.isCancel(confirmed) || !confirmed) {
          console.log('Operation cancelled');
          return;
        }
      }

      const result = store.clear();
      if (!result.success) {
        console.error(`❌ Failed to clear: ${result.error}`);
        process.exit(1);
      }

      console.log('✓ Project memory cleared');
    });

  return memoryCommand;
}
```

---

## 4. Agent 整合

### 4.1 修改 `src/agent/index.ts`

```typescript
// 在 buildSystemPrompt 或類似位置

import { ContextInjector } from '../memory/context-injector.js';
import { StatsCollector } from '../memory/stats-collector.js';

// ... existing code ...

class Agent {
  private memoryInjector: ContextInjector;
  private statsCollector: StatsCollector;

  constructor(/* ... */) {
    // ... existing init ...
    this.memoryInjector = new ContextInjector(process.cwd());
    this.statsCollector = new StatsCollector(process.cwd());
  }

  private async buildSystemPrompt(): Promise<string> {
    // Load base prompt (CUSTOM.md etc)
    const basePrompt = await this.loadCustomInstructions();

    // Inject memory context as prefix (for z.ai auto-caching)
    return this.memoryInjector.injectIntoPrompt(basePrompt);
  }

  // After API response
  private handleApiResponse(response: LLMResponse): void {
    // ... existing handling ...

    // Collect cache stats
    const usage = response.usage;
    if (usage?.prompt_tokens_details?.cached_tokens !== undefined) {
      this.statsCollector.recordResponse(
        usage.prompt_tokens,
        usage.prompt_tokens_details.cached_tokens
      );
    }
  }
}
```

---

## 5. 測試計畫

### 5.1 單元測試

```
tests/memory/
├── context-generator.test.ts
├── context-store.test.ts
├── context-injector.test.ts
├── stats-collector.test.ts
└── schemas.test.ts
```

### 5.2 關鍵測試案例

1. **context-generator.test.ts**
   - 空專案掃描
   - 深度限制正確
   - ignore patterns 生效
   - token 估算準確度 (±10%)
   - 大型專案效能 (< 5s for 5k files)

2. **context-store.test.ts**
   - 讀寫 memory.json
   - schema 驗證
   - atomic write
   - stats 更新

3. **context-injector.test.ts**
   - 正確注入 prefix
   - 無 memory 時 fallback

---

## 6. 效能考量

### 6.1 掃描效能

- 使用 `fs.readdirSync` with `withFileTypes` 減少 stat calls
- 預設 depth=3 避免深度掃描
- ignore patterns 儘早過濾

### 6.2 Token 估算

- 使用 tiktoken 準確計算
- 快取 tokenizer instance
- 大檔案先 truncate 再計算

### 6.3 記憶體使用

- 流式讀取大檔案
- 不載入完整 context 到記憶體（除非需要）

---

## 7. 錯誤處理

| 情境 | 處理方式 |
|------|---------|
| .ax-cli 不存在 | 自動建立 |
| memory.json 損壞 | 提示重新 warmup |
| 掃描失敗 | 顯示錯誤，不中斷 CLI |
| 寫入失敗 | 原子寫入，失敗時保留舊檔 |
