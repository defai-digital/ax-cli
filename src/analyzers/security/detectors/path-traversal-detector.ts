/**
 * Path Traversal Detector
 *
 * Detects potential path traversal vulnerabilities
 * OWASP A01:2021 - Broken Access Control
 */

import { BaseSecurityDetector } from '../base-detector.js';
import type { SecurityVulnerability } from '../types.js';

export class PathTraversalDetector extends BaseSecurityDetector {
  constructor() {
    super({
      id: 'path-traversal',
      name: 'Path Traversal',
      description: 'Detects potential path traversal vulnerabilities',
      severity: 'high',
      owaspCategory: 'A01:2021 - Broken Access Control',
      cweId: 'CWE-22',
    });
  }

  async scan(content: string, filePath: string): Promise<SecurityVulnerability[]> {
    if (!this.appliesTo(filePath)) {
      return [];
    }

    const vulnerabilities: SecurityVulnerability[] = [];

    // Pattern 1: File operations with user input
    const fileOpPatterns = [
      {
        pattern: /(?:readFile|writeFile|unlink|stat|access|open)\([^)]*(?:req\.|params\.|query\.|input|user)/gi,
        operation: 'file operation',
      },
      {
        pattern: /(?:fs\.|promises\.)(?:readFile|writeFile|unlink|stat|access|open)\([^)]*(?:req\.|params\.|query\.|input|user)/gi,
        operation: 'file system operation',
      },
      {
        pattern: /path\.join\([^)]*(?:req\.|params\.|query\.|input|user)/gi,
        operation: 'path concatenation',
      },
    ];

    for (const { pattern, operation } of fileOpPatterns) {
      let match;
      const regex = new RegExp(pattern);
      while ((match = regex.exec(content)) !== null) {
        if (this.shouldIgnore(content, match.index)) {
          continue;
        }

        const line = this.findLineNumber(content, match.index);
        const code = this.extractCodeSnippet(content, match.index, 1);

        vulnerabilities.push(
          this.createVulnerability(
            filePath,
            line,
            code,
            `${operation} uses user input which may lead to path traversal attacks`,
            'Validate and sanitize file paths. Use path.resolve() and check if resolved path is within allowed directory',
            [
              'https://owasp.org/www-community/attacks/Path_Traversal',
              'https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html',
            ]
          )
        );
      }
    }

    // Pattern 2: Direct string concatenation for file paths
    const pathConcatPattern = /['"`][./\\]*['"`]\s*\+\s*(?:req\.|params\.|query\.|input|user)/gi;
    let match;
    while ((match = pathConcatPattern.exec(content)) !== null) {
      if (this.shouldIgnore(content, match.index)) {
        continue;
      }

      const line = this.findLineNumber(content, match.index);
      const code = this.extractCodeSnippet(content, match.index, 1);

      vulnerabilities.push(
        this.createVulnerability(
          filePath,
          line,
          code,
          'File path constructed using string concatenation with user input',
          'Never concatenate user input directly into file paths. Use path.join() with validation',
          [
            'https://owasp.org/www-community/attacks/Path_Traversal',
          ]
        )
      );
    }

    // Pattern 3: Template literals with user input in file paths
    const templatePathPattern = /(?:readFile|writeFile|unlink|stat|access|open)\([`'][^`']*\$\{(?:req\.|params\.|query\.|input|user)/gi;
    while ((match = templatePathPattern.exec(content)) !== null) {
      if (this.shouldIgnore(content, match.index)) {
        continue;
      }

      const line = this.findLineNumber(content, match.index);
      const code = this.extractCodeSnippet(content, match.index, 1);

      vulnerabilities.push(
        this.createVulnerability(
          filePath,
          line,
          code,
          'File path uses template literal with user input',
          'Validate and sanitize file paths. Ensure path stays within allowed directory',
          [
            'https://owasp.org/www-community/attacks/Path_Traversal',
          ]
        )
      );
    }

    return vulnerabilities;
  }
}
