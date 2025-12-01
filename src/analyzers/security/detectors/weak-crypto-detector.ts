/**
 * Weak Cryptography Detector
 *
 * Detects use of weak or deprecated cryptographic algorithms
 * OWASP A02:2021 - Cryptographic Failures
 */

import { BaseSecurityDetector } from '../base-detector.js';
import type { SecurityVulnerability } from '../types.js';

export class WeakCryptoDetector extends BaseSecurityDetector {
  constructor() {
    super({
      id: 'weak-cryptography',
      name: 'Weak Cryptography',
      description: 'Detects use of weak or deprecated cryptographic algorithms',
      severity: 'high',
      owaspCategory: 'A02:2021 - Cryptographic Failures',
      cweId: 'CWE-327',
    });
  }

  async scan(content: string, filePath: string): Promise<SecurityVulnerability[]> {
    if (!this.appliesTo(filePath)) {
      return [];
    }

    const vulnerabilities: SecurityVulnerability[] = [];

    // Pattern 1: Weak hashing algorithms
    const weakHashAlgorithms = ['md5', 'sha1', 'md4', 'md2'];
    for (const algorithm of weakHashAlgorithms) {
      const pattern = new RegExp(`createHash\\(['"\`]${algorithm}['"\`]\\)`, 'gi');
      let match;

      while ((match = pattern.exec(content)) !== null) {
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
            `Weak hashing algorithm ${algorithm.toUpperCase()} detected`,
            `Use SHA-256, SHA-384, or SHA-512 instead of ${algorithm.toUpperCase()}`,
            [
              'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/09-Testing_for_Weak_Cryptography/',
              'https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html',
            ]
          )
        );
      }
    }

    // Pattern 2: Weak cipher algorithms
    const weakCipherAlgorithms = ['des', 'des-ede', 'des-ede-cbc', 'des3', 'rc4', 'rc2', 'blowfish'];
    for (const algorithm of weakCipherAlgorithms) {
      const pattern = new RegExp(`createCipher(?:iv)?\\(['"\`]${algorithm}['"\`]`, 'gi');
      let match;

      while ((match = pattern.exec(content)) !== null) {
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
            `Weak cipher algorithm ${algorithm.toUpperCase()} detected`,
            'Use AES-256-GCM or ChaCha20-Poly1305 for encryption',
            [
              'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/09-Testing_for_Weak_Cryptography/',
            ]
          )
        );
      }
    }

    // Pattern 3: ECB mode (insecure block cipher mode)
    const ecbPattern = /createCipher(?:iv)?\(['"`][^'"`]*-ecb['"`]/gi;
    let match;
    while ((match = ecbPattern.exec(content)) !== null) {
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
          'ECB mode is insecure and should not be used',
          'Use GCM or CBC mode with proper IV instead of ECB',
          [
            'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/09-Testing_for_Weak_Cryptography/',
          ]
        )
      );
    }

    // Pattern 4: Deprecated createCipher (should use createCipheriv)
    const createCipherPattern = /createCipher\(/g;
    while ((match = createCipherPattern.exec(content)) !== null) {
      if (this.shouldIgnore(content, match.index)) {
        continue;
      }

      // Check if it's not createCipheriv
      const afterMatch = content.substring(match.index, match.index + 20);
      if (!afterMatch.includes('createCipheriv')) {
        const line = this.findLineNumber(content, match.index);
        const code = this.extractCodeSnippet(content, match.index, 1);

        vulnerabilities.push(
          this.createVulnerability(
            filePath,
            line,
            code,
            'createCipher is deprecated and insecure',
            'Use createCipheriv with a random IV instead',
            [
              'https://nodejs.org/api/crypto.html#cryptocreatecipherivalgorithm-key-iv-options',
            ]
          )
        );
      }
    }

    // Pattern 5: Small RSA key sizes
    const rsaKeyPattern = /(?:modulusLength|keySize)['"\s:]*(\d+)/gi;
    while ((match = rsaKeyPattern.exec(content)) !== null) {
      if (this.shouldIgnore(content, match.index)) {
        continue;
      }

      const keySize = parseInt(match[1], 10);
      if (keySize < 2048) {
        const line = this.findLineNumber(content, match.index);
        const code = this.extractCodeSnippet(content, match.index, 1);

        vulnerabilities.push(
          this.createVulnerability(
            filePath,
            line,
            code,
            `RSA key size of ${keySize} bits is too small`,
            'Use at least 2048 bits for RSA keys, preferably 4096 bits',
            [
              'https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html',
            ]
          )
        );
      }
    }

    return vulnerabilities;
  }
}
