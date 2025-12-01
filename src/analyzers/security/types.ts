/**
 * Security Analyzer Types
 *
 * Type definitions for security vulnerability detection
 */

/**
 * Severity level for security vulnerabilities
 */
export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * OWASP Top 10 categories
 */
export type OWASPCategory =
  | 'A01:2021 - Broken Access Control'
  | 'A02:2021 - Cryptographic Failures'
  | 'A03:2021 - Injection'
  | 'A04:2021 - Insecure Design'
  | 'A05:2021 - Security Misconfiguration'
  | 'A06:2021 - Vulnerable and Outdated Components'
  | 'A07:2021 - Identification and Authentication Failures'
  | 'A08:2021 - Software and Data Integrity Failures'
  | 'A09:2021 - Security Logging and Monitoring Failures'
  | 'A10:2021 - Server-Side Request Forgery';

/**
 * Security vulnerability finding
 */
export interface SecurityVulnerability {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly severity: SecuritySeverity;
  readonly owaspCategory?: OWASPCategory;
  readonly cweId?: string; // Common Weakness Enumeration ID
  readonly file: string;
  readonly line: number;
  readonly column?: number;
  readonly code: string;
  readonly recommendation: string;
  readonly references: readonly string[];
}

/**
 * Security scan result for a single file
 */
export interface FileSecurityResult {
  readonly file: string;
  readonly vulnerabilities: readonly SecurityVulnerability[];
  readonly riskScore: number; // 0-100 (100 = highest risk)
  readonly timestamp: Date;
  readonly durationMs: number;
}

/**
 * Batch security scan result
 */
export interface BatchSecurityResult {
  readonly files: readonly FileSecurityResult[];
  readonly totalVulnerabilities: number;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly lowCount: number;
  readonly infoCount: number;
  readonly averageRiskScore: number;
  readonly highestRiskFiles: readonly { file: string; score: number }[];
  readonly timestamp: Date;
}

/**
 * Security detector configuration
 */
export interface SecurityDetectorConfig {
  readonly enabled: boolean;
  readonly severity?: SecuritySeverity; // Override default severity
  readonly customPatterns?: readonly string[]; // Additional regex patterns
  readonly excludePatterns?: readonly string[]; // Patterns to exclude
}

/**
 * Security scan options
 */
export interface SecurityScanOptions {
  readonly detectors?: Record<string, SecurityDetectorConfig>;
  readonly includeInfo?: boolean; // Include info-level findings
  readonly maxFileSize?: number; // Max file size to scan (bytes)
}

/**
 * Base security detector interface
 */
export interface SecurityDetector {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly severity: SecuritySeverity;
  readonly owaspCategory?: OWASPCategory;
  readonly cweId?: string;
  readonly enabled: boolean;

  /**
   * Scan file content for vulnerabilities
   */
  scan(content: string, filePath: string): Promise<SecurityVulnerability[]>;

  /**
   * Check if detector applies to this file type
   */
  appliesTo(filePath: string): boolean;
}
