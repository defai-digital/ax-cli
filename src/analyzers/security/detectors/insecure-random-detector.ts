/**
 * Insecure Random Detector
 *
 * Detects use of cryptographically weak random number generators
 * OWASP A02:2021 - Cryptographic Failures
 */

import { BaseSecurityDetector } from '../base-detector.js';
import type { SecurityVulnerability } from '../types.js';

export class InsecureRandomDetector extends BaseSecurityDetector {
  constructor() {
    super({
      id: 'insecure-random',
      name: 'Insecure Random Number Generation',
      description: 'Detects use of Math.random() for security-sensitive operations',
      severity: 'medium',
      owaspCategory: 'A02:2021 - Cryptographic Failures',
      cweId: 'CWE-338',
    });
  }

  async scan(content: string, filePath: string): Promise<SecurityVulnerability[]> {
    if (!this.appliesTo(filePath)) {
      return [];
    }

    const vulnerabilities: SecurityVulnerability[] = [];

    // Pattern: Math.random() used in security contexts
    const securityContextKeywords = [
      'token',
      'secret',
      'password',
      'salt',
      'key',
      'nonce',
      'session',
      'csrf',
      'auth',
      'crypto',
    ];

    const mathRandomPattern = /Math\.random\(\)/gi;
    let match;

    while ((match = mathRandomPattern.exec(content)) !== null) {
      if (this.shouldIgnore(content, match.index)) {
        continue;
      }

      // Check surrounding context (100 characters before and after)
      const contextStart = Math.max(0, match.index - 100);
      const contextEnd = Math.min(content.length, match.index + 100);
      const context = content.substring(contextStart, contextEnd).toLowerCase();

      // Check if in security-sensitive context
      const isSecurityContext = securityContextKeywords.some(keyword =>
        context.includes(keyword)
      );

      if (isSecurityContext) {
        const line = this.findLineNumber(content, match.index);
        const code = this.extractCodeSnippet(content, match.index, 1);

        vulnerabilities.push(
          this.createVulnerability(
            filePath,
            line,
            code,
            'Math.random() is not cryptographically secure and should not be used for security-sensitive operations',
            'Use crypto.randomBytes() (Node.js) or crypto.getRandomValues() (browser) for cryptographic randomness',
            [
              'https://owasp.org/www-community/vulnerabilities/Insecure_Randomness',
              'https://nodejs.org/api/crypto.html#cryptorandombytessize-callback',
            ]
          )
        );
      }
    }

    return vulnerabilities;
  }
}
