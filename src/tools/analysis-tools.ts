/**
 * Analysis Tools for LLM Integration
 *
 * Exposes code analyzers as LLM tools
 */

import type { ToolResult } from '../types/index.js';
import type { LLMTool } from '../llm/client.js';
import { DependencyAnalyzer } from '../analyzers/dependency/index.js';
import { CodeSmellAnalyzer } from '../analyzers/code-smells/index.js';
import { GitAnalyzer } from '../analyzers/git/index.js';
import { MetricsAnalyzer } from '../analyzers/metrics/index.js';
import { SecurityAnalyzer } from '../analyzers/security/index.js';

/**
 * Analyze dependencies in a directory
 */
export class AnalyzeDependenciesTool {
  private analyzer: DependencyAnalyzer;

  constructor() {
    this.analyzer = new DependencyAnalyzer();
  }

  async execute(args: {
    directory: string;
    includePatterns?: string[];
    excludePatterns?: string[];
  }): Promise<ToolResult> {
    try {
      const result = await this.analyzer.analyzeDependencies(args.directory);

      const summary = result.summary;
      const circularDeps = result.circularDependencies.slice(0, 5); // Top 5
      const orphans = result.orphanedFiles.slice(0, 5);
      const hubs = result.hubFiles.slice(0, 5);

      let output = `# Dependency Analysis\n\n`;
      output += `**Files Analyzed**: ${summary.totalFiles}\n`;
      output += `**Dependencies**: ${summary.totalDependencies}\n`;
      output += `**Circular Dependencies**: ${summary.circularDependencyCount}\n`;
      output += `**Orphan Files**: ${result.orphanedFiles.length}\n`;
      output += `**Hub Files**: ${result.hubFiles.length}\n`;
      output += `**Health Score**: ${summary.healthScore}/100\n\n`;

      if (circularDeps.length > 0) {
        output += `## Top Circular Dependencies\n\n`;
        for (const dep of circularDeps) {
          output += `- **Cycle**: ${dep.cycle.join(' → ')}\n`;
          output += `  - Severity: ${dep.severity}\n`;
          output += `  - Cycle length: ${dep.cycle.length} files\n\n`;
        }
      }

      if (orphans.length > 0) {
        output += `## Orphan Files\n\n`;
        for (const file of orphans) {
          output += `- ${file}\n`;
        }
        output += `\n`;
      }

      if (hubs.length > 0) {
        output += `## Hub Files\n\n`;
        for (const file of hubs) {
          output += `- ${file}\n`;
        }
      }

      return { success: true, output };
    } catch (error) {
      return {
        success: false,
        error: `Failed to analyze dependencies: ${(error as Error).message}`,
      };
    }
  }

  getToolDefinition(): LLMTool {
    return {
      type: 'function',
      function: {
        name: 'analyze_dependencies',
        description:
          'Analyzes code dependencies, detects circular dependencies, identifies orphan and hub files, and calculates coupling metrics. Use this to understand code structure and dependency health.',
        parameters: {
          type: 'object',
          properties: {
            directory: {
              type: 'string',
              description: 'Directory to analyze',
            },
            includePatterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'File patterns to include (e.g., ["**/*.ts"])',
            },
            excludePatterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'File patterns to exclude (e.g., ["**/*.test.ts"])',
            },
          },
          required: ['directory'],
        },
      },
    };
  }
}

/**
 * Detect code smells in a directory
 */
export class DetectCodeSmellsTool {
  private analyzer: CodeSmellAnalyzer;

  constructor() {
    this.analyzer = new CodeSmellAnalyzer();
  }

  async execute(args: {
    directory: string;
    includePatterns?: string[];
    excludePatterns?: string[];
  }): Promise<ToolResult> {
    try {
      const result = await this.analyzer.analyzeDirectory(
        args.directory,
        '**/*.{ts,tsx,js,jsx}'
      );

      const summary = result.summary;
      const criticalSmells = result.smells.filter((s: any) => s.severity === 'CRITICAL').slice(0, 10);
      const highSmells = result.smells.filter((s: any) => s.severity === 'HIGH').slice(0, 5);

      // Calculate counts from smellsBySeverity
      const criticalCount = summary.smellsBySeverity['CRITICAL'] || 0;
      const highCount = summary.smellsBySeverity['HIGH'] || 0;
      const mediumCount = summary.smellsBySeverity['MEDIUM'] || 0;
      const lowCount = summary.smellsBySeverity['LOW'] || 0;

      let output = `# Code Smell Analysis\n\n`;
      output += `**Files Analyzed**: ${summary.filesAnalyzed}\n`;
      output += `**Total Smells**: ${summary.totalSmells}\n`;
      output += `**Critical**: ${criticalCount}\n`;
      output += `**High**: ${highCount}\n`;
      output += `**Medium**: ${mediumCount}\n`;
      output += `**Low**: ${lowCount}\n`;
      output += `**Health Score**: ${summary.codeHealthScore}/100\n\n`;

      if (criticalSmells.length > 0) {
        output += `## Critical Smells\n\n`;
        for (const smell of criticalSmells) {
          output += `- **${smell.type}** in ${smell.filePath}:${smell.startLine}\n`;
          output += `  - ${smell.message}\n`;
          output += `  - ${smell.suggestion}\n\n`;
        }
      }

      if (highSmells.length > 0) {
        output += `## High Priority Smells\n\n`;
        for (const smell of highSmells) {
          output += `- **${smell.type}** in ${smell.filePath}:${smell.startLine}\n`;
          output += `  - ${smell.message}\n\n`;
        }
      }

      return { success: true, output };
    } catch (error) {
      return {
        success: false,
        error: `Failed to detect code smells: ${(error as Error).message}`,
      };
    }
  }

  getToolDefinition(): LLMTool {
    return {
      type: 'function',
      function: {
        name: 'detect_code_smells',
        description:
          'Detects 10 types of code smells including Long Method, Large Class, Magic Numbers, and more. Provides severity ratings and actionable recommendations for improving code quality.',
        parameters: {
          type: 'object',
          properties: {
            directory: {
              type: 'string',
              description: 'Directory to analyze',
            },
            includePatterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'File patterns to include',
            },
            excludePatterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'File patterns to exclude',
            },
          },
          required: ['directory'],
        },
      },
    };
  }
}

/**
 * Find code hotspots using git history
 */
export class FindHotspotsTool {
  async execute(args: {
    directory: string;
    since?: string;
    until?: string;
    includePatterns?: string[];
    excludePatterns?: string[];
    hotspotThreshold?: number;
  }): Promise<ToolResult> {
    try {
      const analyzer = new GitAnalyzer(args.directory);
      const result = await analyzer.analyze({
        since: args.since,
        until: args.until,
        includePatterns: args.includePatterns,
        excludePatterns: args.excludePatterns,
        hotspotThreshold: args.hotspotThreshold,
      });

      const summary = result.summary;
      const criticalHotspots = result.hotspots.filter((h) => h.severity === 'CRITICAL');
      const highHotspots = result.hotspots.filter((h) => h.severity === 'HIGH').slice(0, 5);

      let output = `# Code Hotspot Analysis\n\n`;
      output += `**Total Commits**: ${summary.totalCommits}\n`;
      output += `**Files Analyzed**: ${summary.filesAnalyzed}\n`;
      output += `**Hotspots Found**: ${summary.hotspotCount}\n`;
      output += `**Date Range**: ${summary.dateRange}\n`;
      output += `**Top Contributor**: ${summary.topContributor}\n\n`;

      if (criticalHotspots.length > 0) {
        output += `## Critical Hotspots (Immediate Action Required)\n\n`;
        for (const hotspot of criticalHotspots) {
          output += `- **${hotspot.filePath}** (Score: ${hotspot.hotspotScore}/100)\n`;
          output += `  - Commits: ${hotspot.commitCount}\n`;
          output += `  - Churn: ${hotspot.churnScore}\n`;
          output += `  - Complexity: ${hotspot.maxComplexity}\n`;
          output += `  - Reason: ${hotspot.reason}\n`;
          output += `  - **${hotspot.recommendation}**\n\n`;
        }
      }

      if (highHotspots.length > 0) {
        output += `## High Priority Hotspots\n\n`;
        for (const hotspot of highHotspots) {
          output += `- **${hotspot.filePath}** (Score: ${hotspot.hotspotScore}/100)\n`;
          output += `  - ${hotspot.reason}\n`;
          output += `  - ${hotspot.recommendation}\n\n`;
        }
      }

      return { success: true, output };
    } catch (error) {
      return {
        success: false,
        error: `Failed to find hotspots: ${(error as Error).message}`,
      };
    }
  }

  getToolDefinition(): LLMTool {
    return {
      type: 'function',
      function: {
        name: 'find_hotspots',
        description:
          'Analyzes git history to identify code hotspots - files that change frequently and have high complexity. Hotspots indicate problematic code that needs refactoring. Formula: Hotspot = (Churn × 40%) + (Complexity × 30%) + (Commit Frequency × 30%)',
        parameters: {
          type: 'object',
          properties: {
            directory: {
              type: 'string',
              description: 'Git repository directory to analyze',
            },
            since: {
              type: 'string',
              description: 'Start date (e.g., "6 months ago", "2024-01-01")',
            },
            until: {
              type: 'string',
              description: 'End date',
            },
            includePatterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'File patterns to include',
            },
            excludePatterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'File patterns to exclude',
            },
            hotspotThreshold: {
              type: 'number',
              description: 'Minimum hotspot score to report (default: 70)',
            },
          },
          required: ['directory'],
        },
      },
    };
  }
}

/**
 * Calculate advanced code metrics
 */
export class CalculateMetricsTool {
  private analyzer: MetricsAnalyzer;

  constructor() {
    this.analyzer = new MetricsAnalyzer();
  }

  async execute(args: {
    directory: string;
    includePatterns?: string[];
    excludePatterns?: string[];
  }): Promise<ToolResult> {
    try {
      const result = await this.analyzer.analyze(args.directory, {
        includePatterns: args.includePatterns,
        excludePatterns: args.excludePatterns,
      });

      const summary = result.summary;
      const lowMI = result.fileMetrics
        .filter((m) => m.maintainability.score < 65)
        .sort((a, b) => a.maintainability.score - b.maintainability.score)
        .slice(0, 10);

      let output = `# Code Metrics Analysis\n\n`;
      output += `**Files Analyzed**: ${summary.filesAnalyzed}\n`;
      output += `**Average Maintainability**: ${summary.averageMaintainability}/100\n`;
      output += `**Average Halstead Volume**: ${summary.averageHalsteadVolume}\n`;
      output += `**Average Complexity**: ${summary.averageComplexity}\n`;
      output += `**Low Maintainability Files**: ${summary.lowMaintainabilityCount}\n`;
      output += `**High Complexity Files**: ${summary.highComplexityCount}\n\n`;

      if (lowMI.length > 0) {
        output += `## Files Needing Attention (Low Maintainability)\n\n`;
        for (const file of lowMI) {
          output += `- **${file.filePath}**\n`;
          output += `  - MI Score: ${file.maintainability.score}/100 (${file.maintainability.rating})\n`;
          output += `  - Halstead Volume: ${file.halstead.volume}\n`;
          output += `  - Avg Complexity: ${file.averageComplexity}\n`;
          output += `  - Max Complexity: ${file.maxComplexity}\n`;
          output += `  - Functions: ${file.totalFunctions}\n\n`;
        }
      }

      return { success: true, output };
    } catch (error) {
      return {
        success: false,
        error: `Failed to calculate metrics: ${(error as Error).message}`,
      };
    }
  }

  getToolDefinition(): LLMTool {
    return {
      type: 'function',
      function: {
        name: 'calculate_metrics',
        description:
          'Calculates advanced code metrics including Halstead metrics (volume, difficulty, effort) and Maintainability Index (0-100 scale with A-F rating). Use this to assess code complexity and maintainability objectively.',
        parameters: {
          type: 'object',
          properties: {
            directory: {
              type: 'string',
              description: 'Directory to analyze',
            },
            includePatterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'File patterns to include',
            },
            excludePatterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'File patterns to exclude',
            },
          },
          required: ['directory'],
        },
      },
    };
  }
}

/**
 * Analyze security vulnerabilities
 */
export class AnalyzeSecurityTool {
  private analyzer: SecurityAnalyzer;

  constructor() {
    this.analyzer = new SecurityAnalyzer();
  }

  async execute(args: {
    directory: string;
    includePatterns?: string[];
    excludePatterns?: string[];
  }): Promise<ToolResult> {
    try {
      const result = await this.analyzer.scanDirectory(
        args.directory,
        '**/*.{ts,tsx,js,jsx}'
      );

      // Flatten vulnerabilities from all files
      const allVulnerabilities: any[] = [];
      for (const file of result.files) {
        allVulnerabilities.push(...file.vulnerabilities);
      }

      const critical = allVulnerabilities.filter((v: any) => v.severity === 'CRITICAL').slice(0, 10);
      const high = allVulnerabilities.filter((v: any) => v.severity === 'HIGH').slice(0, 5);

      let output = `# Security Analysis\n\n`;
      output += `**Files Scanned**: ${result.files.length}\n`;
      output += `**Vulnerabilities**: ${result.totalVulnerabilities}\n`;
      output += `**Critical**: ${result.criticalCount}\n`;
      output += `**High**: ${result.highCount}\n`;
      output += `**Medium**: ${result.mediumCount}\n`;
      output += `**Low**: ${result.lowCount}\n\n`;

      if (critical.length > 0) {
        output += `## Critical Vulnerabilities\n\n`;
        for (const vuln of critical) {
          output += `- **${vuln.type}** in ${vuln.filePath}:${vuln.line}\n`;
          output += `  - ${vuln.message}\n`;
          output += `  - ${vuln.recommendation}\n\n`;
        }
      }

      if (high.length > 0) {
        output += `## High Severity Vulnerabilities\n\n`;
        for (const vuln of high) {
          output += `- **${vuln.type}** in ${vuln.filePath}:${vuln.line}\n`;
          output += `  - ${vuln.message}\n\n`;
        }
      }

      return { success: true, output };
    } catch (error) {
      return {
        success: false,
        error: `Failed to analyze security: ${(error as Error).message}`,
      };
    }
  }

  getToolDefinition(): LLMTool {
    return {
      type: 'function',
      function: {
        name: 'analyze_security',
        description:
          'Analyzes code for security vulnerabilities including SQL injection, XSS, command injection, path traversal, and more. Provides severity ratings and remediation recommendations.',
        parameters: {
          type: 'object',
          properties: {
            directory: {
              type: 'string',
              description: 'Directory to analyze',
            },
            includePatterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'File patterns to include',
            },
            excludePatterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'File patterns to exclude',
            },
          },
          required: ['directory'],
        },
      },
    };
  }
}
