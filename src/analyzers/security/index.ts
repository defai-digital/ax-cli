/**
 * Security Analyzer Module
 *
 * Provides security vulnerability detection with OWASP-aligned detectors
 */

export { SecurityAnalyzer } from './security-analyzer.js';
export { BaseSecurityDetector } from './base-detector.js';
export * from './types.js';

// Export all detectors
export { SQLInjectionDetector } from './detectors/sql-injection-detector.js';
export { XSSDetector } from './detectors/xss-detector.js';
export { HardcodedSecretsDetector } from './detectors/hardcoded-secrets-detector.js';
export { InsecureRandomDetector } from './detectors/insecure-random-detector.js';
export { PathTraversalDetector } from './detectors/path-traversal-detector.js';
export { CommandInjectionDetector } from './detectors/command-injection-detector.js';
export { WeakCryptoDetector } from './detectors/weak-crypto-detector.js';
export { InsecureDeserializationDetector } from './detectors/insecure-deserialization-detector.js';
