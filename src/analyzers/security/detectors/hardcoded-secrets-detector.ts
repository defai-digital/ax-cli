/**
 * Hardcoded Secrets Detector
 *
 * Detects hardcoded passwords, API keys, tokens, and other secrets
 * OWASP A02:2021 - Cryptographic Failures
 */

import { BaseSecurityDetector } from '../base-detector.js';
import type { SecurityVulnerability } from '../types.js';

export class HardcodedSecretsDetector extends BaseSecurityDetector {
  constructor() {
    super({
      id: 'hardcoded-secrets',
      name: 'Hardcoded Secrets',
      description: 'Detects hardcoded passwords, API keys, and tokens',
      severity: 'critical',
      owaspCategory: 'A02:2021 - Cryptographic Failures',
      cweId: 'CWE-798',
    });
  }

  async scan(content: string, filePath: string): Promise<SecurityVulnerability[]> {
    if (!this.appliesTo(filePath)) {
      return [];
    }

    const vulnerabilities: SecurityVulnerability[] = [];

    // Pattern 1: Common secret variable names with hardcoded values
    const secretVarPatterns = [
      {
        pattern: /(?:password|passwd|pwd|secret|token|apikey|api_key|private_key|privatekey)\s*[:=]\s*['"`]([^'"`]{8,})['"`]/gi,
        type: 'password/token',
      },
      {
        pattern: /(?:auth|authorization|bearer)\s*[:=]\s*['"`]([^'"`]{20,})['"`]/gi,
        type: 'auth token',
      },
      {
        pattern: /(?:access_token|accesstoken|refresh_token|refreshtoken)\s*[:=]\s*['"`]([^'"`]{20,})['"`]/gi,
        type: 'access token',
      },
    ];

    for (const { pattern, type } of secretVarPatterns) {
      let match;
      const regex = new RegExp(pattern);
      while ((match = regex.exec(content)) !== null) {
        if (this.shouldIgnore(content, match.index)) {
          continue;
        }

        // Skip if it looks like a placeholder
        const value = match[1];
        if (this.isPlaceholder(value)) {
          continue;
        }

        const line = this.findLineNumber(content, match.index);
        const code = this.extractCodeSnippet(content, match.index, 0);

        vulnerabilities.push(
          this.createVulnerability(
            filePath,
            line,
            code,
            `Hardcoded ${type} detected in source code`,
            'Use environment variables or secure secret management systems (e.g., AWS Secrets Manager, HashiCorp Vault)',
            [
              'https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password',
              'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
            ]
          )
        );
      }
    }

    // Pattern 2: AWS Access Keys
    const awsKeyPattern = /(?:AKIA|A3T|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g;
    let match;
    while ((match = awsKeyPattern.exec(content)) !== null) {
      if (this.shouldIgnore(content, match.index)) {
        continue;
      }

      const line = this.findLineNumber(content, match.index);
      const code = this.extractCodeSnippet(content, match.index, 0);

      vulnerabilities.push(
        this.createVulnerability(
          filePath,
          line,
          code,
          'AWS Access Key ID detected in source code',
          'Remove hardcoded AWS credentials. Use IAM roles or environment variables',
          [
            'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html',
          ]
        )
      );
    }

    // Pattern 3: Generic API key patterns
    const apiKeyPattern = /['"`]([a-zA-Z0-9_-]{32,})['"`]/g;
    while ((match = apiKeyPattern.exec(content)) !== null) {
      if (this.shouldIgnore(content, match.index)) {
        continue;
      }

      // Check if preceded by key-related variable names
      const beforeMatch = content.substring(Math.max(0, match.index - 50), match.index);
      if (/(?:key|token|secret|api)/i.test(beforeMatch)) {
        const value = match[1];
        if (this.isPlaceholder(value)) {
          continue;
        }

        const line = this.findLineNumber(content, match.index);
        const code = this.extractCodeSnippet(content, match.index, 0);

        vulnerabilities.push(
          this.createVulnerability(
            filePath,
            line,
            code,
            'Potential API key or token detected in source code',
            'Use environment variables to store sensitive credentials',
            [
              'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
            ]
          )
        );
      }
    }

    // Pattern 4: JWT tokens
    const jwtPattern = /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;
    while ((match = jwtPattern.exec(content)) !== null) {
      if (this.shouldIgnore(content, match.index)) {
        continue;
      }

      const line = this.findLineNumber(content, match.index);
      const code = this.extractCodeSnippet(content, match.index, 0);

      vulnerabilities.push(
        this.createVulnerability(
          filePath,
          line,
          code,
          'JWT token detected in source code',
          'Never hardcode JWT tokens. Generate them at runtime',
          [
            'https://jwt.io/introduction',
          ]
        )
      );
    }

    // Pattern 5: Database connection strings
    const dbConnectionPattern = /(?:mongodb|mysql|postgresql|postgres|redis):\/\/[^\s;'"]+:[^\s;'"]+@/gi;
    while ((match = dbConnectionPattern.exec(content)) !== null) {
      if (this.shouldIgnore(content, match.index)) {
        continue;
      }

      const line = this.findLineNumber(content, match.index);
      const code = this.extractCodeSnippet(content, match.index, 0);

      vulnerabilities.push(
        this.createVulnerability(
          filePath,
          line,
          code,
          'Database connection string with credentials detected in source code',
          'Use environment variables for database credentials',
          [
            'https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html',
          ]
        )
      );
    }

    return vulnerabilities;
  }

  /**
   * Check if value looks like a placeholder
   */
  private isPlaceholder(value: string): boolean {
    const placeholders = [
      /^[xX]+$/,
      /^[*]+$/,
      /^your[_-]?/i,
      /^test[_-]?/i,
      /^example/i,
      /^placeholder/i,
      /^dummy/i,
      /^fake/i,
      /^sample/i,
      /^xxx/i,
      /^todo/i,
      /^changeme/i,
      /^replace/i,
    ];

    return placeholders.some(pattern => pattern.test(value));
  }
}
