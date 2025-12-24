/**
 * Credential Exposure Gate
 *
 * Detects credentials in content before exposure.
 *
 * @invariant INV-CRED-001: Scan all output content before returning to user
 * @invariant INV-CRED-002: Use pattern matching, not exact matching
 * @invariant INV-CRED-003: Support custom patterns via configuration
 *
 * @packageDocumentation
 */

import type {
  GateContext,
  GuardCheckResult,
  CredentialExposureConfig,
} from '@defai.digital/ax-schemas';

import type { GateImplementation } from '../types.js';
import { pass, fail, findMatchingPatterns } from './base.js';

/**
 * Default credential detection patterns
 */
const DEFAULT_CREDENTIAL_PATTERNS: RegExp[] = [
  // API Keys (generic)
  /(?:api[_-]?key|apikey)\s*[=:]\s*['"]?[a-zA-Z0-9_-]{20,}/i,
  /(?:secret|token)\s*[=:]\s*['"]?[a-zA-Z0-9_-]{20,}/i,
  /(?:access[_-]?token)\s*[=:]\s*['"]?[a-zA-Z0-9_-]{20,}/i,

  // AWS
  /AKIA[0-9A-Z]{16}/,
  /aws[_-]?secret[_-]?access[_-]?key\s*[=:]\s*['"]?[a-zA-Z0-9/+=]{40}/i,

  // Private Keys
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /-----BEGIN PGP PRIVATE KEY BLOCK-----/,

  // Passwords in common formats
  /(?:password|passwd|pwd)\s*[=:]\s*['"][^'"]{8,}/i,

  // Bearer tokens
  /Bearer\s+[a-zA-Z0-9_-]{20,}/i,

  // GitHub tokens
  /ghp_[a-zA-Z0-9]{36}/,
  /gho_[a-zA-Z0-9]{36}/,
  /ghu_[a-zA-Z0-9]{36}/,
  /ghs_[a-zA-Z0-9]{36}/,
  /ghr_[a-zA-Z0-9]{36}/,

  // OpenAI
  /sk-[a-zA-Z0-9]{48}/,
  /sk-proj-[a-zA-Z0-9]{48}/,

  // Anthropic
  /sk-ant-[a-zA-Z0-9-]{90,}/,

  // Slack
  /xox[baprs]-[a-zA-Z0-9-]+/,

  // Stripe
  /sk_live_[a-zA-Z0-9]{24,}/,
  /rk_live_[a-zA-Z0-9]{24,}/,

  // Twilio
  /SK[a-f0-9]{32}/,

  // SendGrid
  /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/,

  // Database connection strings with credentials
  /(?:mongodb|postgres|mysql|redis):\/\/[^:]+:[^@]+@/i,

  // JWT tokens (detect signature portion)
  /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/,

  // Generic password assignments
  /(?:PASSWORD|PASSWD|SECRET|CREDENTIAL)\s*=\s*['"][^'"]+['"]/i,

  // SSH private key markers
  /OPENSSH PRIVATE KEY/,
  /PuTTY-User-Key-File/,
];

/**
 * Credential Exposure Gate Implementation
 */
export class CredentialExposureGate implements GateImplementation {
  check(
    context: Readonly<GateContext>,
    config?: CredentialExposureConfig
  ): GuardCheckResult {
    const startTime = Date.now();

    // No content - nothing to check
    if (!context.content) {
      return pass('credential_exposure', 'No content to check', startTime);
    }

    // Build patterns list
    const patterns: (string | RegExp)[] = [];

    if (config?.useDefaultPatterns !== false) {
      patterns.push(...DEFAULT_CREDENTIAL_PATTERNS);
    }

    if (config?.customPatterns) {
      patterns.push(
        ...config.customPatterns.map((p) => new RegExp(p, 'i'))
      );
    }

    // INV-CRED-001 & INV-CRED-002: Scan content with patterns
    const matches = findMatchingPatterns(context.content, patterns);

    if (matches.length > 0) {
      return fail(
        'credential_exposure',
        `Potential credential exposure detected: ${matches.length} pattern(s) matched`,
        startTime,
        {
          matchCount: matches.length,
          patterns: matches.slice(0, 5), // Limit to first 5 for brevity
          reason: 'credential_detected',
        }
      );
    }

    return pass('credential_exposure', 'No credentials detected', startTime);
  }
}
