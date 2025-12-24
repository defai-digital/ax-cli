/**
 * Guard Gates - Public Exports
 *
 * @packageDocumentation
 */

// Base utilities
export { pass, warn, fail, matchesAnyPattern, findMatchingPatterns } from './base.js';

// Gate implementations
export { PathViolationGate } from './path-violation.js';
export { CredentialExposureGate } from './credential-exposure.js';
export { InjectionAttemptGate } from './injection-attempt.js';
export {
  SchemaViolationGate,
  registerToolSchema,
  getToolSchema,
  clearToolSchemas,
} from './schema-violation.js';
