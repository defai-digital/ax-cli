/**
 * Best Practice Analyzer Module
 *
 * Exports all best practice validation components
 */

export { BestPracticeValidator } from './best-practice-validator.js';
export { BaseValidationRule } from './base-rule.js';
export { getRuleRegistry } from './rules/index.js';

// Export all TypeScript rules
export * from './rules/typescript/index.js';

// Export types
export type {
  ValidationRule,
  RuleCategory,
  RuleConfig,
  ValidationOptions,
  RuleRegistry,
  ViolationFix,
  TextEdit,
  TextRange,
  Position,
} from './types.js';
