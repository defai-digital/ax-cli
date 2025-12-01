/**
 * Code Smell Detector Types
 */

/**
 * Type of code smell
 */
export enum SmellType {
  LONG_METHOD = 'LONG_METHOD',
  LARGE_CLASS = 'LARGE_CLASS',
  LONG_PARAMETER_LIST = 'LONG_PARAMETER_LIST',
  DUPLICATE_CODE = 'DUPLICATE_CODE',
  DEAD_CODE = 'DEAD_CODE',
  MAGIC_NUMBERS = 'MAGIC_NUMBERS',
  NESTED_CONDITIONALS = 'NESTED_CONDITIONALS',
  FEATURE_ENVY = 'FEATURE_ENVY',
  DATA_CLUMPS = 'DATA_CLUMPS',
  INAPPROPRIATE_INTIMACY = 'INAPPROPRIATE_INTIMACY',
}

/**
 * Severity of code smell
 */
export enum SmellSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Code smell detection result
 */
export interface CodeSmell {
  readonly type: SmellType;
  readonly severity: SmellSeverity;
  readonly filePath: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly message: string;
  readonly suggestion: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Detector configuration
 */
export interface DetectorConfig {
  readonly enabled: boolean;
  readonly thresholds?: Readonly<Record<string, number>>;
}

/**
 * Analysis options
 */
export interface CodeSmellAnalysisOptions {
  readonly detectorConfigs?: Readonly<Record<SmellType, DetectorConfig>>;
  readonly ignorePatterns?: readonly string[];
}

/**
 * Analysis result
 */
export interface CodeSmellAnalysisResult {
  readonly smells: ReadonlyArray<CodeSmell>;
  readonly summary: CodeSmellSummary;
  readonly timestamp: Date;
}

/**
 * Summary statistics
 */
export interface CodeSmellSummary {
  readonly totalSmells: number;
  readonly smellsByType: Readonly<Record<SmellType, number>>;
  readonly smellsBySeverity: Readonly<Record<SmellSeverity, number>>;
  readonly filesAnalyzed: number;
  readonly filesWithSmells: number;
  readonly averageSmellsPerFile: number;
  readonly codeHealthScore: number; // 0-100
}

/**
 * Base detector interface
 */
export interface SmellDetector {
  readonly type: SmellType;
  readonly config: DetectorConfig;
  detect(filePath: string): Promise<CodeSmell[]>;
}
