/**
 * Project Index Manager
 *
 * Manages ax.index.json (full analysis) and ax.summary.json (prompt summary).
 * Handles:
 * - Loading and caching both files
 * - Checking staleness (24-hour threshold)
 * - Auto-regenerating when stale
 * - Providing pre-computed summary for system prompts (fast, no runtime computation)
 */

import * as fs from 'fs';
import * as path from 'path';
import { FILE_NAMES } from '../constants.js';
import { ProjectAnalyzer } from './project-analyzer.js';
import { LLMOptimizedInstructionGenerator } from './llm-optimized-instruction-generator.js';

/** Default staleness threshold in hours */
const DEFAULT_STALENESS_HOURS = 24;

/** Staleness threshold in milliseconds */
const STALENESS_MS = DEFAULT_STALENESS_HOURS * 60 * 60 * 1000;

export interface ProjectIndexData {
  projectName: string;
  version?: string;
  projectType: string;
  primaryLanguage?: string;
  techStack?: string[];
  generatedAt: string;
  [key: string]: unknown;
}

export interface ProjectSummaryData {
  schemaVersion: string;
  generatedAt: string;
  project: {
    name: string;
    type: string;
    language: string;
    version?: string;
    techStack?: string[];
    entryPoint?: string;
    packageManager?: string;
  };
  directories?: Record<string, string>;
  commands?: Record<string, string>;
  gotchas?: string[];
  indexFile: string;
}

export interface IndexStatus {
  exists: boolean;
  isStale: boolean;
  ageHours?: number;
  path: string;
  summaryExists?: boolean;
  summaryPath?: string;
}

/**
 * Project Index Manager
 */
export class ProjectIndexManager {
  private projectRoot: string;
  private indexPath: string;
  private summaryPath: string;
  private cachedIndex: string | null = null;
  private cachedData: ProjectIndexData | null = null;
  private cachedSummary: string | null = null;
  private cachedSummaryData: ProjectSummaryData | null = null;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.indexPath = path.join(projectRoot, FILE_NAMES.AX_INDEX_JSON);
    this.summaryPath = path.join(projectRoot, FILE_NAMES.AX_SUMMARY_JSON);
  }

  /**
   * Get the path to ax.index.json
   */
  getIndexPath(): string {
    return this.indexPath;
  }

  /**
   * Get the path to ax.summary.json
   */
  getSummaryPath(): string {
    return this.summaryPath;
  }

  /**
   * Check if ax.index.json exists
   */
  exists(): boolean {
    return fs.existsSync(this.indexPath);
  }

  /**
   * Check if ax.summary.json exists
   */
  summaryExists(): boolean {
    return fs.existsSync(this.summaryPath);
  }

  /**
   * Get the status of the project index and summary
   */
  getStatus(): IndexStatus {
    const hasSummary = this.summaryExists();

    if (!this.exists()) {
      return {
        exists: false,
        isStale: true,
        path: this.indexPath,
        summaryExists: hasSummary,
        summaryPath: this.summaryPath,
      };
    }

    try {
      const stats = fs.statSync(this.indexPath);
      const ageMs = Date.now() - stats.mtimeMs;
      const ageHours = ageMs / (60 * 60 * 1000);
      const isStale = ageMs > STALENESS_MS;

      return {
        exists: true,
        isStale,
        ageHours: Math.round(ageHours * 10) / 10, // Round to 1 decimal
        path: this.indexPath,
        summaryExists: hasSummary,
        summaryPath: this.summaryPath,
      };
    } catch {
      return {
        exists: false,
        isStale: true,
        path: this.indexPath,
        summaryExists: hasSummary,
        summaryPath: this.summaryPath,
      };
    }
  }

  /**
   * Check if the index is stale (older than 24 hours)
   */
  isStale(): boolean {
    return this.getStatus().isStale;
  }

  /**
   * Load the index content as a string
   */
  load(): string | null {
    if (this.cachedIndex) {
      return this.cachedIndex;
    }

    if (!this.exists()) {
      return null;
    }

    try {
      const content = fs.readFileSync(this.indexPath, 'utf-8');
      this.cachedIndex = content;
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Load and parse the index as JSON
   */
  loadData(): ProjectIndexData | null {
    if (this.cachedData) {
      return this.cachedData;
    }

    const content = this.load();
    if (!content) {
      return null;
    }

    try {
      const data = JSON.parse(content) as ProjectIndexData;
      this.cachedData = data;
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Load the summary content as a string
   */
  loadSummary(): string | null {
    if (this.cachedSummary) {
      return this.cachedSummary;
    }

    if (!this.summaryExists()) {
      return null;
    }

    try {
      const content = fs.readFileSync(this.summaryPath, 'utf-8');
      this.cachedSummary = content;
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Load and parse the summary as JSON
   */
  loadSummaryData(): ProjectSummaryData | null {
    if (this.cachedSummaryData) {
      return this.cachedSummaryData;
    }

    const content = this.loadSummary();
    if (!content) {
      return null;
    }

    try {
      const data = JSON.parse(content) as ProjectSummaryData;
      this.cachedSummaryData = data;
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cachedIndex = null;
    this.cachedData = null;
    this.cachedSummary = null;
    this.cachedSummaryData = null;
  }

  /**
   * Regenerate the project index and summary
   * Returns true if successful, false otherwise
   */
  async regenerate(options: { verbose?: boolean } = {}): Promise<boolean> {
    const tmpIndexPath = `${this.indexPath}.tmp`;
    const tmpSummaryPath = `${this.summaryPath}.tmp`;

    try {
      // Analyze the project
      const analyzer = new ProjectAnalyzer(this.projectRoot);
      const result = await analyzer.analyze();

      if (!result.success || !result.projectInfo) {
        if (options.verbose) {
          console.error('Project analysis failed:', result.error);
        }
        return false;
      }

      // Generate LLM-optimized index and summary
      const generator = new LLMOptimizedInstructionGenerator({
        compressionLevel: 'moderate',
        hierarchyEnabled: true,
        criticalRulesCount: 5,
        includeDODONT: true,
        includeTroubleshooting: true,
      });

      const index = generator.generateIndex(result.projectInfo);
      const summary = generator.generateSummary(result.projectInfo);

      // Write both files atomically
      fs.writeFileSync(tmpIndexPath, index, 'utf-8');
      fs.renameSync(tmpIndexPath, this.indexPath);

      fs.writeFileSync(tmpSummaryPath, summary, 'utf-8');
      fs.renameSync(tmpSummaryPath, this.summaryPath);

      // Clear cache so next load gets fresh data
      this.clearCache();

      if (options.verbose) {
        console.log(`Regenerated project index: ${this.indexPath}`);
        console.log(`Regenerated project summary: ${this.summaryPath}`);
      }

      return true;
    } catch (error) {
      if (options.verbose) {
        console.error('Failed to regenerate project files:', error);
      }
      // Cleanup temp files if they exist
      try {
        if (fs.existsSync(tmpIndexPath)) {
          fs.unlinkSync(tmpIndexPath);
        }
        if (fs.existsSync(tmpSummaryPath)) {
          fs.unlinkSync(tmpSummaryPath);
        }
      } catch {
        // Ignore cleanup errors
      }
      return false;
    }
  }

  /**
   * Ensure the index is fresh - regenerate if stale or missing
   * Returns the index content or null if regeneration failed
   */
  async ensureFresh(options: { verbose?: boolean; force?: boolean } = {}): Promise<string | null> {
    const status = this.getStatus();

    // If exists and not stale (and not forced), just return current
    if (status.exists && !status.isStale && !options.force) {
      return this.load();
    }

    // Need to regenerate
    if (options.verbose) {
      if (!status.exists) {
        console.log('Project index not found, generating...');
      } else if (status.isStale) {
        console.log(`Project index is ${status.ageHours}h old (>24h), regenerating...`);
      } else if (options.force) {
        console.log('Force regenerating project index...');
      }
    }

    const success = await this.regenerate(options);
    if (success) {
      return this.load();
    }

    // If regeneration failed but index exists, return old index
    if (status.exists) {
      return this.load();
    }

    return null;
  }

  /**
   * Get formatted context for system prompt injection
   * Returns null if no summary/index exists
   *
   * Uses pre-computed ax.summary.json for fast loading (~500 tokens).
   * Falls back to dynamic generation from ax.index.json if summary is missing.
   * The AI can read ax.index.json directly if it needs more details.
   */
  getPromptContext(): string | null {
    // Try to load pre-computed summary first (fast path)
    const summaryData = this.loadSummaryData();
    if (summaryData) {
      return this.formatSummaryForPrompt(summaryData);
    }

    // Fallback: dynamically generate from index (backward compatibility)
    const content = this.load();
    if (!content) {
      return null;
    }

    return this.generateDynamicSummary(content);
  }

  /**
   * Format pre-computed summary data for prompt injection
   * This is the fast path - just formats the already-computed summary
   */
  private formatSummaryForPrompt(summary: ProjectSummaryData): string {
    const lines: string[] = [
      '<project-context>',
      `Project: ${summary.project.name}`,
    ];

    if (summary.project.type) {
      lines.push(`Type: ${summary.project.type}`);
    }
    if (summary.project.language) {
      lines.push(`Language: ${summary.project.language}`);
    }
    if (summary.project.techStack && summary.project.techStack.length > 0) {
      lines.push(`Tech Stack: ${summary.project.techStack.join(', ')}`);
    }

    // Add directories
    if (summary.directories && Object.keys(summary.directories).length > 0) {
      const dirList = Object.entries(summary.directories)
        .map(([key, val]) => `${key}: ${val}`)
        .join(', ');
      lines.push(`Directories: ${dirList}`);
    }

    // Add commands
    if (summary.commands && Object.keys(summary.commands).length > 0) {
      const cmds = Object.entries(summary.commands)
        .map(([key, val]) => `${key}: ${val}`)
        .join(' | ');
      lines.push(`Commands: ${cmds}`);
    }

    // Add gotchas
    if (summary.gotchas && summary.gotchas.length > 0) {
      lines.push(`Key Notes: ${summary.gotchas.join('; ')}`);
    }

    lines.push('');
    lines.push(`For full project analysis, read: ${summary.indexFile}`);
    lines.push('</project-context>');

    return lines.join('\n');
  }

  /**
   * Dynamically generate summary from index content
   * This is the fallback path for backward compatibility
   */
  private generateDynamicSummary(content: string): string | null {
    try {
      const data = JSON.parse(content) as Record<string, unknown>;

      const lines: string[] = [
        '<project-context>',
        `Project: ${data.name || data.projectName || 'Unknown'}`,
      ];

      if (data.projectType) {
        lines.push(`Type: ${data.projectType}`);
      }
      if (data.primaryLanguage) {
        lines.push(`Language: ${data.primaryLanguage}`);
      }
      if (data.techStack && Array.isArray(data.techStack)) {
        lines.push(`Tech Stack: ${(data.techStack as string[]).join(', ')}`);
      }

      // Add key directories if available
      if (data.directories && typeof data.directories === 'object') {
        const dirs = data.directories as Record<string, string>;
        const dirList = Object.entries(dirs)
          .slice(0, 5) // Limit to 5 directories
          .map(([key, val]) => `${key}: ${val}`)
          .join(', ');
        if (dirList) {
          lines.push(`Directories: ${dirList}`);
        }
      }

      // Add build/test commands if available
      if (data.scripts && typeof data.scripts === 'object') {
        const scripts = data.scripts as Record<string, unknown>;
        const cmds: string[] = [];
        if (scripts.build) cmds.push(`build: ${scripts.build}`);
        if (scripts.test) cmds.push(`test: ${scripts.test}`);
        if (scripts.lint) cmds.push(`lint: ${scripts.lint}`);
        if (cmds.length > 0) {
          lines.push(`Commands: ${cmds.join(' | ')}`);
        }
      }

      // Add gotchas if available (important warnings)
      if (data.gotchas && Array.isArray(data.gotchas)) {
        const gotchas = (data.gotchas as string[]).slice(0, 3); // Max 3 gotchas
        if (gotchas.length > 0) {
          lines.push(`Key Notes: ${gotchas.join('; ')}`);
        }
      }

      lines.push('');
      lines.push('For full project analysis, read: ax.index.json');
      lines.push('</project-context>');

      return lines.join('\n');
    } catch {
      // If parsing fails, return minimal context with file reference
      return '<project-context>\nProject index available at: ax.index.json\n</project-context>';
    }
  }
}

// Singleton instance
let defaultManager: ProjectIndexManager | null = null;

/**
 * Get a ProjectIndexManager instance
 *
 * @param projectRoot - Optional custom project root. If provided, returns a new instance.
 * @returns ProjectIndexManager instance
 */
export function getProjectIndexManager(projectRoot?: string): ProjectIndexManager {
  if (projectRoot) {
    return new ProjectIndexManager(projectRoot);
  }

  if (!defaultManager) {
    defaultManager = new ProjectIndexManager();
  }

  return defaultManager;
}

/**
 * Reset the default manager (mainly for testing)
 */
export function resetProjectIndexManager(): void {
  defaultManager = null;
}
