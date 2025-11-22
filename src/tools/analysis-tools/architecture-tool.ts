/**
 * Architecture Analysis Tool
 *
 * LLM tool for architecture analysis
 */

import type { ToolResult } from '../../types/index.js';
import { ArchitectureAnalyzer } from '../../analyzers/architecture/index.js';
import type { AnalysisDepth } from '../../types/analysis.js';

export class ArchitectureTool {
  private analyzer: ArchitectureAnalyzer;

  constructor() {
    this.analyzer = new ArchitectureAnalyzer();
  }

  /**
   * Analyze project architecture
   */
  async execute(args: {
    projectPath?: string;
    depth?: string;
  }): Promise<ToolResult> {
    try {
      // Use current directory if no path specified
      const projectPath = args.projectPath || process.cwd();

      // Validate depth parameter
      const depth: AnalysisDepth =
        args.depth === 'deep' ? 'deep' : 'quick';

      // Run analysis
      const result = await this.analyzer.analyzeProject(projectPath, depth);

      // Format output
      const output = this.formatOutput(result);

      return {
        success: true,
        output,
      };
    } catch (error) {
      return {
        success: false,
        error: `Architecture analysis failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Format analysis result for display
   */
  private formatOutput(result: any): string {
    const lines: string[] = [];

    lines.push('# Architecture Analysis\n');
    lines.push(`**Project**: ${result.projectPath}`);
    lines.push(`**Score**: ${result.architectureScore}/100`);
    lines.push(`**Duration**: ${result.durationMs}ms\n`);

    // Summary
    lines.push('## Summary\n');
    lines.push(result.summary);
    lines.push('');

    // Detected Patterns
    if (result.detectedPatterns.length > 0) {
      lines.push('## Detected Patterns\n');
      for (const pattern of result.detectedPatterns) {
        lines.push(`### ${pattern.name}`);
        lines.push(`- **Category**: ${pattern.category}`);
        lines.push(`- **Confidence**: ${Math.round(pattern.confidence * 100)}%`);
        lines.push(`- **Description**: ${pattern.description}`);
        lines.push(`- **Locations**: ${pattern.locations.join(', ')}`);
        lines.push('');
      }
    }

    // Anti-Patterns
    if (result.antiPatterns.length > 0) {
      lines.push('## Anti-Patterns Found\n');
      for (const antiPattern of result.antiPatterns) {
        lines.push(`### ⚠️  ${antiPattern.name} (${antiPattern.severity})`);
        lines.push(`- **Description**: ${antiPattern.description}`);
        lines.push(`- **Impact**: ${antiPattern.impact}`);
        lines.push(`- **Suggestion**: ${antiPattern.suggestion}`);
        lines.push(`- **Locations**: ${antiPattern.locations.join(', ')}`);
        lines.push('');
      }
    }

    // Recommendations
    if (result.recommendations.length > 0) {
      lines.push('## Recommendations\n');
      for (const rec of result.recommendations) {
        lines.push(`### ${rec.title} (Priority: ${rec.priority})`);
        lines.push(`**Description**: ${rec.description}\n`);
        lines.push(`**Rationale**: ${rec.rationale}\n`);
        lines.push(`**Estimated Effort**: ${rec.estimatedEffort}\n`);

        if (rec.benefits.length > 0) {
          lines.push('**Benefits**:');
          for (const benefit of rec.benefits) {
            lines.push(`- ${benefit}`);
          }
          lines.push('');
        }

        if (rec.relatedPatterns.length > 0) {
          lines.push(`**Related Patterns**: ${rec.relatedPatterns.join(', ')}\n`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Get tool definition for LLM
   */
  getToolDefinition() {
    return {
      type: 'function' as const,
      function: {
        name: 'analyze_architecture',
        description:
          'Analyze project architecture to detect patterns, anti-patterns, and generate improvement recommendations',
        parameters: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description:
                'Path to project root directory (default: current directory)',
            },
            depth: {
              type: 'string',
              enum: ['quick', 'deep'],
              default: 'quick',
              description:
                'Analysis depth: "quick" for pattern detection only, "deep" includes anti-pattern detection',
            },
          },
        },
      },
    };
  }
}
