/**
 * XSS (Cross-Site Scripting) Detector
 *
 * Detects potential XSS vulnerabilities
 * OWASP A03:2021 - Injection
 */

import { BaseSecurityDetector } from '../base-detector.js';
import type { SecurityVulnerability } from '../types.js';

export class XSSDetector extends BaseSecurityDetector {
  constructor() {
    super({
      id: 'xss-vulnerability',
      name: 'Cross-Site Scripting (XSS)',
      description: 'Detects potential XSS vulnerabilities',
      severity: 'high',
      owaspCategory: 'A03:2021 - Injection',
      cweId: 'CWE-79',
    });
  }

  async scan(content: string, filePath: string): Promise<SecurityVulnerability[]> {
    if (!this.appliesTo(filePath)) {
      return [];
    }

    const vulnerabilities: SecurityVulnerability[] = [];

    // Pattern 1: dangerouslySetInnerHTML in React
    const dangerouslySetInnerHTMLPattern = /dangerouslySetInnerHTML\s*=\s*\{\{?\s*__html:\s*(?!['"`])[^}]+\}\}?/gi;
    let match;
    while ((match = dangerouslySetInnerHTMLPattern.exec(content)) !== null) {
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
          'Using dangerouslySetInnerHTML with unsanitized content may lead to XSS',
          'Sanitize HTML content using a library like DOMPurify before rendering',
          [
            'https://owasp.org/www-community/attacks/xss/',
            'https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html',
          ]
        )
      );
    }

    // Pattern 2: innerHTML assignment
    const innerHTMLPattern = /\.innerHTML\s*=\s*(?!['"`])[^;]+/gi;
    while ((match = innerHTMLPattern.exec(content)) !== null) {
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
          'Direct innerHTML assignment with dynamic content may lead to XSS',
          'Use textContent for text or sanitize HTML before assignment',
          [
            'https://owasp.org/www-community/attacks/xss/',
            'https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html',
          ]
        )
      );
    }

    // Pattern 3: document.write with user input
    const documentWritePattern = /document\.write\([^)]*(?:req\.|params\.|input|user|query)/gi;
    while ((match = documentWritePattern.exec(content)) !== null) {
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
          'document.write with user input may lead to XSS',
          'Avoid document.write. Use DOM manipulation methods and sanitize input',
          [
            'https://owasp.org/www-community/attacks/xss/',
          ]
        )
      );
    }

    // Pattern 4: eval() with user input
    const evalPattern = /eval\([^)]*(?:req\.|params\.|input|user|query)/gi;
    while ((match = evalPattern.exec(content)) !== null) {
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
          'eval() with user input is extremely dangerous and may lead to code injection',
          'Never use eval() with user input. Find alternative solutions',
          [
            'https://owasp.org/www-community/attacks/Code_Injection',
          ]
        )
      );
    }

    // Pattern 5: Unescaped template rendering (Express, etc.)
    const unescapedRenderPattern = /res\.send\([^)]*\$\{(?:req\.|params\.|input|user|query)/gi;
    while ((match = unescapedRenderPattern.exec(content)) !== null) {
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
          'Sending unescaped user input in response may lead to XSS',
          'Escape HTML entities or use a templating engine with auto-escaping',
          [
            'https://owasp.org/www-community/attacks/xss/',
          ]
        )
      );
    }

    return vulnerabilities;
  }
}
