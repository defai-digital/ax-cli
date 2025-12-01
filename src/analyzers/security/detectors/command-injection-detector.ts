/**
 * Command Injection Detector
 *
 * Detects potential command injection vulnerabilities
 * OWASP A03:2021 - Injection
 */

import { BaseSecurityDetector } from '../base-detector.js';
import type { SecurityVulnerability } from '../types.js';

export class CommandInjectionDetector extends BaseSecurityDetector {
  constructor() {
    super({
      id: 'command-injection',
      name: 'Command Injection',
      description: 'Detects potential command injection vulnerabilities',
      severity: 'critical',
      owaspCategory: 'A03:2021 - Injection',
      cweId: 'CWE-78',
    });
  }

  async scan(content: string, filePath: string): Promise<SecurityVulnerability[]> {
    if (!this.appliesTo(filePath)) {
      return [];
    }

    const vulnerabilities: SecurityVulnerability[] = [];

    // Pattern 1: exec/execSync with user input
    const execPatterns = [
      {
        pattern: /(?:exec|execSync|spawn|spawnSync)\([^)]*(?:req\.|params\.|query\.|input|user)/gi,
        method: 'child_process method',
      },
      {
        pattern: /(?:exec|execSync|spawn|spawnSync)\([`'][^`']*\$\{(?:req\.|params\.|query\.|input|user)/gi,
        method: 'child_process method with template literal',
      },
    ];

    for (const { pattern, method } of execPatterns) {
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
            `${method} uses user input which may lead to command injection`,
            'Never pass user input directly to shell commands. Use execFile with array arguments or validate/sanitize input strictly',
            [
              'https://owasp.org/www-community/attacks/Command_Injection',
              'https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html',
            ]
          )
        );
      }
    }

    // Pattern 2: Shell: true option with user input
    const shellTruePattern = /(?:exec|spawn)\([^,)]*,\s*\{[^}]*shell:\s*true[^}]*\}/gi;
    let match;
    while ((match = shellTruePattern.exec(content)) !== null) {
      if (this.shouldIgnore(content, match.index)) {
        continue;
      }

      // Check if user input is nearby
      const contextStart = Math.max(0, match.index - 100);
      const contextEnd = Math.min(content.length, match.index + 200);
      const context = content.substring(contextStart, contextEnd);

      if (/(?:req\.|params\.|query\.|input|user)/.test(context)) {
        const line = this.findLineNumber(content, match.index);
        const code = this.extractCodeSnippet(content, match.index, 1);

        vulnerabilities.push(
          this.createVulnerability(
            filePath,
            line,
            code,
            'Using shell: true with user input is extremely dangerous',
            'Avoid shell: true. Use execFile or spawn with array arguments',
            [
              'https://owasp.org/www-community/attacks/Command_Injection',
            ]
          )
        );
      }
    }

    // Pattern 3: String concatenation in commands
    const commandConcatPattern = /(?:exec|execSync)\(['"`][^'"`]*\+\s*(?:req\.|params\.|query\.|input|user)/gi;
    while ((match = commandConcatPattern.exec(content)) !== null) {
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
          'Command constructed using string concatenation with user input',
          'Use execFile with array arguments to avoid command injection',
          [
            'https://owasp.org/www-community/attacks/Command_Injection',
          ]
        )
      );
    }

    return vulnerabilities;
  }
}
