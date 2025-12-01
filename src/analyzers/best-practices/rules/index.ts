/**
 * Validation Rule Registry
 *
 * Singleton registry managing all validation rules
 */

import type { ValidationRule, RuleRegistry, RuleCategory } from '../types.js';

/**
 * Singleton rule registry
 * Manages all validation rules
 */
class ValidationRuleRegistry implements RuleRegistry {
  private static instance: ValidationRuleRegistry;
  private rules = new Map<string, ValidationRule>();

  private constructor() {}

  static getInstance(): ValidationRuleRegistry {
    if (!ValidationRuleRegistry.instance) {
      ValidationRuleRegistry.instance = new ValidationRuleRegistry();
    }
    return ValidationRuleRegistry.instance;
  }

  register(rule: ValidationRule): void {
    if (this.rules.has(rule.id)) {
      console.warn(`Rule ${rule.id} is already registered, overwriting`);
    }
    this.rules.set(rule.id, rule);
  }

  get(id: string): ValidationRule | undefined {
    return this.rules.get(id);
  }

  getAll(): readonly ValidationRule[] {
    return Object.freeze(Array.from(this.rules.values()));
  }

  getByCategory(category: RuleCategory): readonly ValidationRule[] {
    return Object.freeze(
      Array.from(this.rules.values()).filter(r => r.category === category)
    );
  }

  clear(): void {
    this.rules.clear();
  }
}

export function getRuleRegistry(): RuleRegistry {
  return ValidationRuleRegistry.getInstance();
}

// Auto-register all TypeScript rules
import {
  NoAnyTypeRule,
  PreferConstRule,
  NoImplicitAnyRule,
  ProperErrorHandlingRule,
  ConsistentNamingRule,
  NoUnusedVarsRule,
  FunctionComplexityRule,
  MaxFileLengthRule,
  NoMagicNumbersRule,
  PreferReadonlyRule,
} from './typescript/index.js';

// Register TypeScript rules on module load
const registry = getRuleRegistry();
registry.register(new NoAnyTypeRule());
registry.register(new PreferConstRule());
registry.register(new NoImplicitAnyRule());
registry.register(new ProperErrorHandlingRule());
registry.register(new ConsistentNamingRule());
registry.register(new NoUnusedVarsRule());
registry.register(new FunctionComplexityRule());
registry.register(new MaxFileLengthRule());
registry.register(new NoMagicNumbersRule());
registry.register(new PreferReadonlyRule());
