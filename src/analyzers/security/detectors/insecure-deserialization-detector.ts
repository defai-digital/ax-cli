/**
 * Insecure Deserialization Detector
 *
 * Detects insecure deserialization vulnerabilities
 * OWASP A08:2021 - Software and Data Integrity Failures
 */

import { BaseSecurityDetector } from '../base-detector.js';
import type { SecurityVulnerability } from '../types.js';

export class InsecureDeserializationDetector extends BaseSecurityDetector {
  constructor() {
    super({
      id: 'insecure-deserialization',
      name: 'Insecure Deserialization',
      description: 'Detects insecure deserialization vulnerabilities',
      severity: 'high',
      owaspCategory: 'A08:2021 - Software and Data Integrity Failures',
      cweId: 'CWE-502',
    });
  }

  async scan(content: string, filePath: string): Promise<SecurityVulnerability[]> {
    if (!this.appliesTo(filePath)) {
      return [];
    }

    const vulnerabilities: SecurityVulnerability[] = [];

    // Pattern 1: JSON.parse with user input without validation
    const jsonParsePattern = /JSON\.parse\((?:req\.|params\.|query\.|input|user)[^)]+\)/gi;
    let match;
    while ((match = jsonParsePattern.exec(content)) !== null) {
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
          'JSON.parse with user input without validation may lead to prototype pollution',
          'Validate JSON structure after parsing and use Object.create(null) to avoid prototype pollution',
          [
            'https://owasp.org/www-community/vulnerabilities/Deserialization_of_untrusted_data',
            'https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html',
          ]
        )
      );
    }

    // Pattern 2: eval() with JSON (extremely dangerous)
    const evalJsonPattern = /eval\([^)]*(?:JSON|json|parse)/gi;
    while ((match = evalJsonPattern.exec(content)) !== null) {
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
          'Using eval() for JSON parsing is extremely dangerous',
          'Use JSON.parse() instead of eval()',
          [
            'https://owasp.org/www-community/attacks/Code_Injection',
          ]
        )
      );
    }

    // Pattern 3: Node.js serialize packages with user input
    const serializePackages = ['node-serialize', 'serialize-javascript', 'funcster'];
    for (const pkg of serializePackages) {
      const pattern = new RegExp(`require\\(['"\`]${pkg}['"\`]\\)`, 'gi');
      let pkgMatch;

      while ((pkgMatch = pattern.exec(content)) !== null) {
        // Check if there's deserialization with user input nearby
        const contextStart = pkgMatch.index;
        const contextEnd = Math.min(content.length, pkgMatch.index + 500);
        const context = content.substring(contextStart, contextEnd);

        if (/(?:unserialize|deserialize|parse)\([^)]*(?:req\.|params\.|query\.|input|user)/i.test(context)) {
          const line = this.findLineNumber(content, pkgMatch.index);
          const code = this.extractCodeSnippet(content, pkgMatch.index, 2);

          vulnerabilities.push(
            this.createVulnerability(
              filePath,
              line,
              code,
              `Package ${pkg} used for deserialization of user input is dangerous`,
              'Avoid deserializing untrusted data. Use JSON.parse() with validation',
              [
                'https://owasp.org/www-community/vulnerabilities/Deserialization_of_untrusted_data',
              ]
            )
          );
        }
      }
    }

    // Pattern 4: Object.assign with user input (prototype pollution)
    const objectAssignPattern = /Object\.assign\([^,)]*,\s*(?:req\.|params\.|query\.|input|user)/gi;
    while ((match = objectAssignPattern.exec(content)) !== null) {
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
          'Object.assign with user input may lead to prototype pollution',
          'Validate and sanitize user input before using Object.assign. Consider using Object.create(null)',
          [
            'https://owasp.org/www-community/vulnerabilities/Deserialization_of_untrusted_data',
            'https://cheatsheetseries.owasp.org/cheatsheets/Prototype_Pollution_Prevention_Cheat_Sheet.html',
          ]
        )
      );
    }

    // Pattern 5: Spread operator with user input
    const spreadPattern = /\{\.\.\.(?:req\.|params\.|query\.|input|user)[^}]*\}/gi;
    while ((match = spreadPattern.exec(content)) !== null) {
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
          'Spread operator with user input may lead to prototype pollution',
          'Validate user input before spreading. Use allowlist of permitted fields',
          [
            'https://cheatsheetseries.owasp.org/cheatsheets/Prototype_Pollution_Prevention_Cheat_Sheet.html',
          ]
        )
      );
    }

    // Pattern 6: vm module with user input
    const vmPattern = /(?:runInContext|runInNewContext|runInThisContext)\([^)]*(?:req\.|params\.|query\.|input|user)/gi;
    while ((match = vmPattern.exec(content)) !== null) {
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
          'vm module with user input is extremely dangerous',
          'Never execute user-provided code. Find alternative solutions',
          [
            'https://nodejs.org/api/vm.html#vm_vm_executing_javascript',
          ]
        )
      );
    }

    return vulnerabilities;
  }
}
