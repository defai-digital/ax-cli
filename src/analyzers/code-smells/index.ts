/**
 * Code Smell Analyzer Module
 */

export { CodeSmellAnalyzer } from './code-smell-analyzer.js';
export { BaseSmellDetector } from './base-smell-detector.js';

// Detectors
export { LongMethodDetector } from './detectors/long-method-detector.js';
export { LargeClassDetector } from './detectors/large-class-detector.js';
export { LongParameterListDetector } from './detectors/long-parameter-list-detector.js';
export { MagicNumbersDetector } from './detectors/magic-numbers-detector.js';
export { NestedConditionalsDetector } from './detectors/nested-conditionals-detector.js';
export { DeadCodeDetector } from './detectors/dead-code-detector.js';
export { DuplicateCodeDetector } from './detectors/duplicate-code-detector.js';
export { FeatureEnvyDetector } from './detectors/feature-envy-detector.js';
export { DataClumpsDetector } from './detectors/data-clumps-detector.js';
export { InappropriateIntimacyDetector } from './detectors/inappropriate-intimacy-detector.js';

// Types
export {
  SmellType,
  SmellSeverity,
  type CodeSmell,
  type DetectorConfig,
  type CodeSmellAnalysisOptions,
  type CodeSmellAnalysisResult,
  type CodeSmellSummary,
  type SmellDetector,
} from './types.js';
