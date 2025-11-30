/**
 * Architecture Analysis Module
 *
 * Exports all architecture analysis components
 */

export { ArchitectureAnalyzer } from './architecture-analyzer.js';
export { ProjectStructureScanner } from './project-structure-scanner.js';

// Pattern Detectors
export { MVCDetector } from './pattern-detectors/mvc-detector.js';
export { CleanArchitectureDetector } from './pattern-detectors/clean-architecture-detector.js';
export { RepositoryDetector } from './pattern-detectors/repository-detector.js';
export type { PatternDetector } from './pattern-detectors/base-detector.js';

// Anti-Pattern Detectors
export { GodObjectDetector } from './anti-pattern-detectors/god-object-detector.js';
