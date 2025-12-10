/**
 * Project Index Manager
 *
 * Manages the ax.index.json file which contains project analysis data.
 * Handles:
 * - Loading and caching the index
 * - Checking staleness (24-hour threshold)
 * - Auto-regenerating when stale
 * - Providing index content for system prompts
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

export interface IndexStatus {
  exists: boolean;
  isStale: boolean;
  ageHours?: number;
  path: string;
}

/**
 * Project Index Manager
 */
export class ProjectIndexManager {
  private projectRoot: string;
  private indexPath: string;
  private cachedIndex: string | null = null;
  private cachedData: ProjectIndexData | null = null;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.indexPath = path.join(projectRoot, FILE_NAMES.AX_INDEX_JSON);
  }

  /**
   * Get the path to ax.index.json
   */
  getIndexPath(): string {
    return this.indexPath;
  }

  /**
   * Check if ax.index.json exists
   */
  exists(): boolean {
    return fs.existsSync(this.indexPath);
  }

  /**
   * Get the status of the project index
   */
  getStatus(): IndexStatus {
    if (!this.exists()) {
      return {
        exists: false,
        isStale: true,
        path: this.indexPath,
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
      };
    } catch {
      return {
        exists: false,
        isStale: true,
        path: this.indexPath,
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
   * Clear the cache
   */
  clearCache(): void {
    this.cachedIndex = null;
    this.cachedData = null;
  }

  /**
   * Regenerate the project index
   * Returns true if successful, false otherwise
   */
  async regenerate(options: { verbose?: boolean } = {}): Promise<boolean> {
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

      // Generate LLM-optimized index
      const generator = new LLMOptimizedInstructionGenerator({
        compressionLevel: 'moderate',
        hierarchyEnabled: true,
        criticalRulesCount: 5,
        includeDODONT: true,
        includeTroubleshooting: true,
      });

      const index = generator.generateIndex(result.projectInfo);

      // Write atomically
      const tmpPath = `${this.indexPath}.tmp`;
      fs.writeFileSync(tmpPath, index, 'utf-8');
      fs.renameSync(tmpPath, this.indexPath);

      // Clear cache so next load gets fresh data
      this.clearCache();

      if (options.verbose) {
        console.log(`Regenerated project index: ${this.indexPath}`);
      }

      return true;
    } catch (error) {
      if (options.verbose) {
        console.error('Failed to regenerate project index:', error);
      }
      // Cleanup temp file if exists
      try {
        const tmpPath = `${this.indexPath}.tmp`;
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath);
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
   * Returns null if no index exists
   */
  getPromptContext(): string | null {
    const content = this.load();
    if (!content) {
      return null;
    }

    // Parse and format for prompt
    try {
      const data = JSON.parse(content) as ProjectIndexData;

      // Build a concise project context block
      const lines: string[] = [
        '<project-context>',
        `Project: ${data.projectName || 'Unknown'}`,
      ];

      if (data.projectType) {
        lines.push(`Type: ${data.projectType}`);
      }
      if (data.primaryLanguage) {
        lines.push(`Language: ${data.primaryLanguage}`);
      }
      if (data.techStack && data.techStack.length > 0) {
        lines.push(`Tech Stack: ${data.techStack.join(', ')}`);
      }

      // Add the full index data as JSON for detailed reference
      lines.push('');
      lines.push('Full project analysis:');
      lines.push('```json');
      lines.push(content);
      lines.push('```');
      lines.push('</project-context>');

      return lines.join('\n');
    } catch {
      // If parsing fails, just wrap the raw content
      return `<project-context>\n${content}\n</project-context>`;
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
