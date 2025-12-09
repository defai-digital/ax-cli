/**
 * Context Generator - Scans project and generates context for GLM caching
 *
 * Produces a standardized context string that z.ai can automatically cache
 * when used as a consistent system prompt prefix.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type {
  ProjectMemory,
  SourceConfig,
  DirectoryConfig,
  WarmupOptions,
  WarmupResult,
  ContextSections,
} from './types.js';
import {
  MEMORY_DEFAULTS,
  DEFAULT_IGNORE_PATTERNS,
  DEFAULT_INCLUDE_FILES,
  DEFAULT_SCAN_DIRECTORIES,
} from './types.js';
import { createTokenCounter } from '../utils/token-counter.js';
import { ProjectAnalyzer } from '../utils/project-analyzer.js';

/**
 * Section content with token count
 */
interface SectionContent {
  content: string;
  tokens: number;
}

/**
 * ContextGenerator - Creates project memory context
 */
export class ContextGenerator {
  private projectRoot: string;
  private tokenCounter: ReturnType<typeof createTokenCounter>;
  private warnings: string[] = [];

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.tokenCounter = createTokenCounter();
  }

  /**
   * Generate project memory from scanning the codebase
   */
  async generate(options: WarmupOptions = {}): Promise<WarmupResult> {
    const {
      depth = MEMORY_DEFAULTS.DEPTH,
      maxTokens = MEMORY_DEFAULTS.MAX_TOKENS,
      verbose = false,
    } = options;

    this.warnings = [];

    try {
      // Build source configuration
      const source = this.buildSourceConfig(depth);

      if (verbose) {
        console.log(`  Scanning ${source.directories.length} directories...`);
      }

      // Generate each section
      const sections: Record<string, SectionContent> = {};

      // 1. Directory structure
      if (verbose) console.log('  Generating directory structure...');
      const structure = this.generateStructure(source.directories);
      sections.structure = {
        content: structure,
        tokens: this.tokenCounter.countTokens(structure),
      };

      // 2. README content
      if (verbose) console.log('  Reading README...');
      const readme = this.generateReadmeSummary();
      if (readme) {
        sections.readme = {
          content: readme,
          tokens: this.tokenCounter.countTokens(readme),
        };
      }

      // 3. Config files summary
      if (verbose) console.log('  Analyzing config files...');
      const config = this.generateConfigSummary(source.files);
      if (config) {
        sections.config = {
          content: config,
          tokens: this.tokenCounter.countTokens(config),
        };
      }

      // 4. Architecture patterns
      if (verbose) console.log('  Detecting architecture patterns...');
      const patterns = await this.generatePatternsSummary();
      if (patterns) {
        sections.patterns = {
          content: patterns,
          tokens: this.tokenCounter.countTokens(patterns),
        };
      }

      // Assemble final context
      const formatted = this.assembleContext(sections, maxTokens);
      const tokenEstimate = this.tokenCounter.countTokens(formatted);

      // Calculate content hash
      const contentHash = this.calculateHash(formatted);

      // Build section token counts
      const sectionTokens: ContextSections = {
        structure: sections.structure?.tokens,
        readme: sections.readme?.tokens,
        config: sections.config?.tokens,
        patterns: sections.patterns?.tokens,
      };

      // Create memory object
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
          sections: sectionTokens,
        },
      };

      return {
        success: true,
        memory,
        warnings: this.warnings.length > 0 ? this.warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown generation error',
        warnings: this.warnings.length > 0 ? this.warnings : undefined,
      };
    }
  }

  /**
   * Build source configuration based on project structure
   */
  private buildSourceConfig(depth: number): SourceConfig {
    // Find existing directories from defaults (single stat call per path)
    const directories: DirectoryConfig[] = [];

    for (const defaultDir of DEFAULT_SCAN_DIRECTORIES) {
      const fullPath = path.join(this.projectRoot, defaultDir.path);
      try {
        if (fs.statSync(fullPath).isDirectory()) {
          directories.push({
            path: defaultDir.path,
            max_depth: Math.min(defaultDir.max_depth, depth),
          });
        }
      } catch {
        // Path doesn't exist, skip
      }
    }

    // If no default directories found, scan from root with limited depth
    if (directories.length === 0) {
      directories.push({ path: '.', max_depth: Math.min(2, depth) });
    }

    // Find existing files from defaults (single stat call per path)
    const files: string[] = [];
    for (const defaultFile of DEFAULT_INCLUDE_FILES) {
      const fullPath = path.join(this.projectRoot, defaultFile);
      try {
        if (fs.statSync(fullPath).isFile()) {
          files.push(defaultFile);
        }
      } catch {
        // File doesn't exist, skip
      }
    }

    return {
      directories,
      files,
      ignore: [...DEFAULT_IGNORE_PATTERNS],
    };
  }

  /**
   * Generate directory tree structure
   */
  private generateStructure(directories: DirectoryConfig[]): string {
    const lines: string[] = ['## Directory Structure', '```'];

    for (const dir of directories) {
      const tree = this.buildTree(dir.path, dir.max_depth);
      if (tree.length > 0) {
        if (dir.path !== '.') {
          lines.push(`${dir.path}/`);
        }
        lines.push(...tree);
      }
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

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(fullPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const lines: string[] = [];

    // Filter and sort entries
    const filtered = entries
      .filter((e) => !this.shouldIgnore(e.name))
      .sort((a, b) => {
        // Directories first
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    // Limit entries per directory to avoid huge trees
    const maxEntries = 30;
    const limited = filtered.slice(0, maxEntries);
    const hasMore = filtered.length > maxEntries;

    limited.forEach((entry, index) => {
      const isLast = index === limited.length - 1 && !hasMore;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = isLast ? '    ' : '│   ';

      const displayName = entry.name + (entry.isDirectory() ? '/' : '');
      lines.push(`${prefix}${connector}${displayName}`);

      if (entry.isDirectory() && currentDepth + 1 < maxDepth) {
        const childPath = path.join(dirPath, entry.name);
        const childLines = this.buildTree(
          childPath,
          maxDepth,
          prefix + childPrefix,
          currentDepth + 1
        );
        lines.push(...childLines);
      }
    });

    if (hasMore) {
      lines.push(`${prefix}└── ... (${filtered.length - maxEntries} more)`);
    }

    return lines;
  }

  /**
   * Check if a file/directory should be ignored
   */
  private shouldIgnore(name: string): boolean {
    for (const pattern of DEFAULT_IGNORE_PATTERNS) {
      if (pattern.startsWith('*.')) {
        // Extension pattern
        if (name.endsWith(pattern.slice(1))) return true;
      } else if (name === pattern) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generate README summary
   */
  private generateReadmeSummary(): string | null {
    const readmePaths = ['README.md', 'readme.md', 'Readme.md', 'README.rst'];

    for (const readmePath of readmePaths) {
      const fullPath = path.join(this.projectRoot, readmePath);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const maxSize = MEMORY_DEFAULTS.MAX_FILE_SIZE;
          const truncated = content.slice(0, maxSize);
          const isTruncated = content.length > maxSize;

          const lines = [
            '## README Summary',
            '',
            truncated.trim(),
          ];

          if (isTruncated) {
            lines.push('', '[...truncated]');
          }

          return lines.join('\n');
        } catch (error) {
          this.warnings.push(`Failed to read ${readmePath}: ${error}`);
        }
      }
    }

    return null;
  }

  /**
   * Generate config files summary
   */
  private generateConfigSummary(files: string[]): string | null {
    const summaries: string[] = ['## Key Configuration'];
    let hasContent = false;

    for (const file of files) {
      const fullPath = path.join(this.projectRoot, file);
      if (!fs.existsSync(fullPath)) continue;

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const summary = this.summarizeConfigFile(file, content);

        if (summary) {
          summaries.push('', `### ${file}`, '', summary);
          hasContent = true;
        }
      } catch (error) {
        this.warnings.push(`Failed to read ${file}: ${error}`);
      }
    }

    return hasContent ? summaries.join('\n') : null;
  }

  /**
   * Summarize a config file based on its type
   */
  private summarizeConfigFile(filename: string, content: string): string | null {
    const basename = path.basename(filename);

    try {
      if (basename === 'package.json') {
        return this.summarizePackageJson(content);
      }

      if (basename === 'tsconfig.json') {
        return this.summarizeTsConfig(content);
      }

      if (basename === 'pyproject.toml') {
        return this.summarizePyproject(content);
      }

      if (basename === 'Cargo.toml') {
        return this.summarizeCargoToml(content);
      }

      if (basename === 'go.mod') {
        return this.summarizeGoMod(content);
      }

      if (basename.startsWith('docker-compose') || basename === 'Dockerfile') {
        // Just show first few lines
        const lines = content.split('\n').slice(0, 15);
        return '```\n' + lines.join('\n') + '\n```';
      }

      if (basename === 'CUSTOM.md') {
        // Show first portion of custom instructions
        const truncated = content.slice(0, 1000);
        return truncated + (content.length > 1000 ? '\n[...truncated]' : '');
      }

      // Default: show first 500 chars
      const maxLen = 500;
      const truncated = content.slice(0, maxLen);
      return '```\n' + truncated + (content.length > maxLen ? '\n...' : '') + '\n```';
    } catch {
      return null;
    }
  }

  /**
   * Summarize package.json
   */
  private summarizePackageJson(content: string): string {
    const pkg = JSON.parse(content);
    const parts: string[] = [];

    if (pkg.name) parts.push(`- **Name**: ${pkg.name}`);
    if (pkg.version) parts.push(`- **Version**: ${pkg.version}`);
    if (pkg.description) parts.push(`- **Description**: ${pkg.description}`);
    if (pkg.type) parts.push(`- **Type**: ${pkg.type}`);
    if (pkg.bin) parts.push(`- **CLI**: Yes`);

    if (pkg.dependencies) {
      const deps = Object.keys(pkg.dependencies);
      const display = deps.slice(0, 10).join(', ');
      const more = deps.length > 10 ? ` (+${deps.length - 10} more)` : '';
      parts.push(`- **Dependencies**: ${display}${more}`);
    }

    if (pkg.devDependencies) {
      const deps = Object.keys(pkg.devDependencies);
      const display = deps.slice(0, 8).join(', ');
      const more = deps.length > 8 ? ` (+${deps.length - 8} more)` : '';
      parts.push(`- **Dev Dependencies**: ${display}${more}`);
    }

    if (pkg.scripts) {
      const scripts = Object.keys(pkg.scripts).slice(0, 6);
      parts.push(`- **Scripts**: ${scripts.join(', ')}`);
    }

    return parts.join('\n');
  }

  /**
   * Summarize tsconfig.json
   */
  private summarizeTsConfig(content: string): string {
    const config = JSON.parse(content);
    const opts = config.compilerOptions || {};
    const parts: string[] = [];

    if (opts.target) parts.push(`- **Target**: ${opts.target}`);
    if (opts.module) parts.push(`- **Module**: ${opts.module}`);
    if (opts.moduleResolution) parts.push(`- **Module Resolution**: ${opts.moduleResolution}`);
    if (opts.strict !== undefined) parts.push(`- **Strict**: ${opts.strict}`);
    if (opts.outDir) parts.push(`- **Output**: ${opts.outDir}`);

    return parts.join('\n') || '(minimal configuration)';
  }

  /**
   * Summarize pyproject.toml (basic extraction)
   */
  private summarizePyproject(content: string): string {
    const parts: string[] = [];

    // Simple regex extraction for common fields
    const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
    if (nameMatch) parts.push(`- **Name**: ${nameMatch[1]}`);

    const versionMatch = content.match(/version\s*=\s*"([^"]+)"/);
    if (versionMatch) parts.push(`- **Version**: ${versionMatch[1]}`);

    const pythonMatch = content.match(/python\s*=\s*"([^"]+)"/);
    if (pythonMatch) parts.push(`- **Python**: ${pythonMatch[1]}`);

    return parts.join('\n') || content.slice(0, 300);
  }

  /**
   * Summarize Cargo.toml (basic extraction)
   */
  private summarizeCargoToml(content: string): string {
    const parts: string[] = [];

    const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
    if (nameMatch) parts.push(`- **Name**: ${nameMatch[1]}`);

    const versionMatch = content.match(/version\s*=\s*"([^"]+)"/);
    if (versionMatch) parts.push(`- **Version**: ${versionMatch[1]}`);

    const editionMatch = content.match(/edition\s*=\s*"([^"]+)"/);
    if (editionMatch) parts.push(`- **Edition**: ${editionMatch[1]}`);

    return parts.join('\n') || content.slice(0, 300);
  }

  /**
   * Summarize go.mod
   */
  private summarizeGoMod(content: string): string {
    const parts: string[] = [];

    const moduleMatch = content.match(/module\s+(\S+)/);
    if (moduleMatch) parts.push(`- **Module**: ${moduleMatch[1]}`);

    const goMatch = content.match(/go\s+(\S+)/);
    if (goMatch) parts.push(`- **Go Version**: ${goMatch[1]}`);

    return parts.join('\n') || content.slice(0, 300);
  }

  /**
   * Generate architecture patterns summary using ProjectAnalyzer
   */
  private async generatePatternsSummary(): Promise<string | null> {
    try {
      const analyzer = new ProjectAnalyzer(this.projectRoot);
      const result = await analyzer.analyze();

      if (!result.success || !result.projectInfo) {
        return null;
      }

      const info = result.projectInfo;
      const lines: string[] = ['## Architecture Patterns'];

      if (info.projectType) {
        lines.push(`- **Project Type**: ${info.projectType}`);
      }
      if (info.primaryLanguage) {
        lines.push(`- **Primary Language**: ${info.primaryLanguage}`);
      }
      if (info.techStack && info.techStack.length > 0) {
        lines.push(`- **Tech Stack**: ${info.techStack.join(', ')}`);
      }
      if (info.packageManager) {
        lines.push(`- **Package Manager**: ${info.packageManager}`);
      }
      if (info.entryPoint) {
        lines.push(`- **Entry Point**: ${info.entryPoint}`);
      }

      // Add conventions
      if (info.conventions) {
        const conv = info.conventions;
        if (conv.moduleSystem) lines.push(`- **Module System**: ${conv.moduleSystem.toUpperCase()}`);
        if (conv.testFramework) lines.push(`- **Test Framework**: ${conv.testFramework}`);
        if (conv.validation) lines.push(`- **Validation**: ${conv.validation}`);
        if (conv.linter) lines.push(`- **Linter**: ${conv.linter}`);
      }

      // Add directories
      if (info.directories) {
        const dirs = info.directories;
        const dirList: string[] = [];
        if (dirs.source) dirList.push(`source: ${dirs.source}`);
        if (dirs.tests) dirList.push(`tests: ${dirs.tests}`);
        if (dirList.length > 0) {
          lines.push(`- **Key Directories**: ${dirList.join(', ')}`);
        }
      }

      return lines.length > 1 ? lines.join('\n') : null;
    } catch (error) {
      this.warnings.push(`Pattern analysis failed: ${error}`);
      return null;
    }
  }

  /**
   * Assemble final context from sections, respecting token limit
   */
  private assembleContext(
    sections: Record<string, SectionContent>,
    maxTokens: number
  ): string {
    const header = `# Project Context\n\n`;
    let currentTokens = this.tokenCounter.countTokens(header);

    const parts: string[] = [header];

    // Priority order for sections
    const priority = ['patterns', 'structure', 'config', 'readme'];

    for (const key of priority) {
      const section = sections[key];
      if (!section) continue;

      if (currentTokens + section.tokens <= maxTokens) {
        parts.push(section.content, '\n');
        currentTokens += section.tokens;
      } else {
        // Try to fit partial content
        const remaining = maxTokens - currentTokens - 50; // Buffer for truncation note
        if (remaining > 200) {
          const truncated = this.truncateToTokens(section.content, remaining);
          parts.push(truncated, '\n[...truncated due to token limit]\n');
          this.warnings.push(`Section '${key}' was truncated to fit token limit`);
        }
        break; // Stop adding more sections
      }
    }

    return parts.join('\n').trim();
  }

  /**
   * Truncate text to approximate token count
   */
  private truncateToTokens(text: string, maxTokens: number): string {
    // Rough estimate: ~4 chars per token
    const estimatedChars = maxTokens * 4;
    if (text.length <= estimatedChars) return text;

    // Find a good break point (end of line)
    const truncated = text.slice(0, estimatedChars);
    const lastNewline = truncated.lastIndexOf('\n');

    if (lastNewline > estimatedChars * 0.8) {
      return truncated.slice(0, lastNewline);
    }

    return truncated;
  }

  /**
   * Calculate SHA-256 hash of content
   */
  private calculateHash(content: string): string {
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return `sha256:${hash}`;
  }
}
