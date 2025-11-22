/**
 * Analysis Types
 *
 * Type definitions for architecture analysis and best practice validation.
 * All types are immutable and follow strict type safety principles.
 */

/**
 * Analysis depth level
 */
export type AnalysisDepth = 'quick' | 'deep';

/**
 * Pattern detection confidence level (0.0 to 1.0)
 */
export type ConfidenceLevel = number;

/**
 * Severity levels for violations and anti-patterns
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Base analysis result containing common metadata
 */
export interface BaseAnalysisResult {
  readonly timestamp: number;
  readonly durationMs: number;
  readonly projectPath: string;
}

/**
 * Detected architectural or design pattern
 */
export interface DetectedPattern {
  readonly name: string;
  readonly category: 'architectural' | 'creational' | 'structural' | 'behavioral';
  readonly confidence: ConfidenceLevel;
  readonly locations: ReadonlyArray<string>;
  readonly description: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Detected anti-pattern or code smell
 */
export interface AntiPattern {
  readonly name: string;
  readonly severity: Severity;
  readonly locations: ReadonlyArray<string>;
  readonly description: string;
  readonly suggestion: string;
  readonly impact: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Architecture improvement recommendation
 */
export interface ArchitectureRecommendation {
  readonly title: string;
  readonly priority: Severity;
  readonly description: string;
  readonly rationale: string;
  readonly estimatedEffort: 'low' | 'medium' | 'high';
  readonly benefits: ReadonlyArray<string>;
  readonly tradeoffs: ReadonlyArray<string>;
  readonly relatedPatterns: ReadonlyArray<string>;
}

/**
 * Complete architecture analysis result
 */
export interface ArchitectureAnalysis extends BaseAnalysisResult {
  readonly detectedPatterns: ReadonlyArray<DetectedPattern>;
  readonly antiPatterns: ReadonlyArray<AntiPattern>;
  readonly recommendations: ReadonlyArray<ArchitectureRecommendation>;
  readonly architectureScore: number; // 0-100
  readonly summary: string;
}

/**
 * Position in text (line and column)
 */
export interface Position {
  readonly line: number;
  readonly column: number;
}

/**
 * Text range (start and end positions)
 */
export interface TextRange {
  readonly start: Position;
  readonly end: Position;
}

/**
 * Text edit for automated fixes
 */
export interface TextEdit {
  readonly range: TextRange;
  readonly newText: string;
}

/**
 * Automated fix for a validation violation
 */
export interface ViolationFix {
  readonly description: string;
  readonly edits: ReadonlyArray<TextEdit>;
}

/**
 * Code validation violation
 */
export interface Violation {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
  readonly suggestion?: string;
  readonly fix?: ViolationFix;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Single file validation result
 */
export interface ValidationResult extends BaseAnalysisResult {
  readonly file: string;
  readonly language: string;
  readonly violations: ReadonlyArray<Violation>;
  readonly score: number; // 0-100
  readonly summary: string;
}

/**
 * Batch validation result for multiple files
 */
export interface BatchValidationResult extends BaseAnalysisResult {
  readonly files: ReadonlyArray<ValidationResult>;
  readonly totalViolations: number;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly averageScore: number;
  readonly summary: string;
}

/**
 * File information
 */
export interface FileInfo {
  readonly path: string;
  readonly relativePath: string;
  readonly lines: number;
  readonly size: number;
  readonly extension: string;
}

/**
 * Directory information
 */
export interface DirectoryInfo {
  readonly path: string;
  readonly relativePath: string;
  readonly fileCount: number;
  readonly subdirCount: number;
}

/**
 * Project structure snapshot
 */
export interface ProjectStructure {
  readonly rootPath: string;
  readonly files: ReadonlyArray<FileInfo>;
  readonly directories: ReadonlyArray<DirectoryInfo>;
  readonly filesByExtension: ReadonlyMap<string, ReadonlyArray<FileInfo>>;
  readonly totalLines: number;
  readonly totalFiles: number;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  readonly rules?: Readonly<Record<string, { enabled: boolean; severity?: Severity; options?: Readonly<Record<string, unknown>> }>>;
  readonly language?: 'typescript' | 'javascript';
  readonly fix?: boolean;
}
