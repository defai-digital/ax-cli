/**
 * Validation Tool
 *
 * LLM tool for best practice validation
 */

import type { ToolResult } from '../../types/index.js';
import { BestPracticeValidator } from '../../analyzers/best-practices/best-practice-validator.js';
import type { ValidationOptions, BatchValidationResult } from '../../types/analysis.js';
import { glob } from 'glob';

export class ValidationTool {
  private validator: BestPracticeValidator;

  constructor() {
    this.validator = new BestPracticeValidator();
  }

  /**
   * Validate files
   */
  async execute(args: {
    path?: string;
    pattern?: string;
    rules?: Record<string, { enabled: boolean }>;
  }): Promise<ToolResult> {
    try {
      const targetPath = args.path || process.cwd();
      const pattern = args.pattern || '**/*.{ts,tsx}';

      // Find files to validate
      const files = await glob(pattern, {
        cwd: targetPath,
        absolute: true,
        ignore: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**',
        ],
      });

      if (files.length === 0) {
        return {
          success: true,
          output: 'No files found matching pattern',
        };
      }

      // Validate files
      const options: ValidationOptions = {
        rules: args.rules,
      };

      const result = await this.validator.validateBatch(files, options);

      // Format output
      const output = this.formatOutput(result);

      return {
        success: true,
        output,
      };
    } catch (error) {
      return {
        success: false,
        error: `Validation failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Format validation result for display
   */
  private formatOutput(result: BatchValidationResult): string {
    const lines: string[] = [];

    lines.push('# Best Practice Validation\n');
    lines.push(`**Files Checked**: ${result.files.length}`);
    lines.push(`**Total Violations**: ${result.totalViolations}`);
    lines.push(`**Average Score**: ${result.averageScore}/100\n`);

    // Summary by severity
    lines.push('## Violations by Severity\n');
    lines.push(`- **Critical**: ${result.criticalCount}`);
    lines.push(`- **High**: ${result.highCount}\n`);

    // Top violations
    if (result.files.length > 0) {
      lines.push('## Files with Most Violations\n');

      const sortedFiles = result.files
        .slice()
        .sort((a, b) => b.violations.length - a.violations.length)
        .slice(0, 5);

      for (const file of sortedFiles) {
        if (file.violations.length > 0) {
          lines.push(`### ${file.file} (${file.violations.length} violations)\n`);

          for (const violation of file.violations.slice(0, 3)) {
            lines.push(`- **Line ${violation.line}**: ${violation.message}`);
            if (violation.suggestion) {
              lines.push(`  *Suggestion*: ${violation.suggestion}`);
            }
          }

          lines.push('');
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
        name: 'validate_best_practices',
        description:
          'Validate TypeScript/JavaScript files against best practices and coding standards',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to directory or file to validate (default: current directory)',
            },
            pattern: {
              type: 'string',
              description: 'Glob pattern for files to validate (default: **/*.{ts,tsx})',
            },
            rules: {
              type: 'object',
              description: 'Rule configuration (e.g., {"no-any-type": {"enabled": false}})',
            },
          },
        },
      },
    };
  }
}
