/**
 * SQL Injection Detector
 *
 * Detects potential SQL injection vulnerabilities
 * OWASP A03:2021 - Injection
 */

import { BaseSecurityDetector } from '../base-detector.js';
import type { SecurityVulnerability } from '../types.js';

export class SQLInjectionDetector extends BaseSecurityDetector {
  constructor() {
    super({
      id: 'sql-injection',
      name: 'SQL Injection',
      description: 'Detects potential SQL injection vulnerabilities',
      severity: 'critical',
      owaspCategory: 'A03:2021 - Injection',
      cweId: 'CWE-89',
    });
  }

  async scan(content: string, filePath: string): Promise<SecurityVulnerability[]> {
    if (!this.appliesTo(filePath)) {
      return [];
    }

    const vulnerabilities: SecurityVulnerability[] = [];

    // Pattern 1: String concatenation in SQL queries
    const concatPatterns = [
      /(?:query|sql|execute|exec)\s*(?:=|:)\s*['"`][\s\S]*?\$\{[^}]+\}/gi,
      /(?:query|sql|execute|exec)\s*(?:=|:)\s*['"`][\s\S]*?\+\s*\w+/gi,
      /(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE)[\s\S]*?\+\s*\w+/gi,
    ];

    for (const pattern of concatPatterns) {
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
            'SQL query uses string concatenation which may lead to SQL injection',
            'Use parameterized queries or prepared statements instead of string concatenation',
            [
              'https://owasp.org/www-community/attacks/SQL_Injection',
              'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html',
            ]
          )
        );
      }
    }

    // Pattern 2: Direct use of user input in queries
    const userInputPatterns = [
      /(?:query|sql|execute|exec)\s*(?:=|:)\s*['"`][\s\S]*?(?:req\.body|req\.query|req\.params|params|input|userInput)/gi,
      /(?:SELECT|INSERT|UPDATE|DELETE)[\s\S]{0,100}(?:req\.body|req\.query|req\.params|params|input)/gi,
    ];

    for (const pattern of userInputPatterns) {
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
            'SQL query directly uses user input without sanitization',
            'Always sanitize and validate user input. Use parameterized queries or ORM methods',
            [
              'https://owasp.org/www-community/attacks/SQL_Injection',
              'https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html',
            ]
          )
        );
      }
    }

    // Pattern 3: Unsafe query execution methods
    const unsafeMethodPatterns = [
      /\.query\(['"`][^'"`]*\$\{/gi,
      /\.exec\(['"`][^'"`]*\$\{/gi,
      /\.raw\(['"`][^'"`]*\$\{/gi,
    ];

    for (const pattern of unsafeMethodPatterns) {
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
            'Database method uses template literals which may be vulnerable to SQL injection',
            'Use parameterized queries with placeholders (?, $1, etc.) instead of template literals',
            [
              'https://owasp.org/www-community/attacks/SQL_Injection',
            ]
          )
        );
      }
    }

    return vulnerabilities;
  }
}
