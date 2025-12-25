/**
 * i18n Validation Script
 *
 * Validates translation completeness across all locales.
 * Ensures all translation keys are present in every language.
 *
 * Usage:
 *   npx tsx packages/core/src/i18n/validate.ts
 *
 * @packageDocumentation
 */

import { createRequire } from 'node:module';
import type { UITranslations, CommandTranslations } from './types.js';

const require = createRequire(import.meta.url);

// Supported languages
const LANGUAGES = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'th', 'vi'] as const;
type Language = (typeof LANGUAGES)[number];

interface ValidationResult {
  language: Language;
  missingKeys: string[];
  extraKeys: string[];
  emptyValues: string[];
}

/**
 * Flatten a nested object into dot-notation keys
 */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

/**
 * Get value at a dot-notation path
 */
function getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Load translations for a language
 */
function loadTranslations(language: Language): { ui: UITranslations; commands: CommandTranslations } {
  const ui = require(`./locales/${language}/ui.json`) as UITranslations;
  const commands = require(`./locales/${language}/commands.json`) as CommandTranslations;
  return { ui, commands };
}

// Keys that are intentionally allowed to be empty (language-specific prefixes/suffixes)
const ALLOWED_EMPTY_KEYS = new Set([
  'ui.welcome.tip2Pre',
  'ui.welcome.tip3Pre',
  'ui.welcome.tip4Pre',
  'ui.welcome.tip2Post',
  'ui.welcome.tip3Post',
  'ui.welcome.tip4Post',
]);

/**
 * Validate translations for a language against English (reference)
 */
function validateLanguage(language: Language, reference: { ui: UITranslations; commands: CommandTranslations }): ValidationResult {
  const result: ValidationResult = {
    language,
    missingKeys: [],
    extraKeys: [],
    emptyValues: [],
  };

  if (language === 'en') {
    // English is the reference, just check for empty values
    const uiKeys = flattenKeys(reference.ui as unknown as Record<string, unknown>);
    const cmdKeys = flattenKeys(reference.commands as unknown as Record<string, unknown>);

    for (const key of [...uiKeys, ...cmdKeys]) {
      const fullKey = key.startsWith('session') || key.startsWith('status') || key.startsWith('tools')
        ? `ui.${key}`
        : `commands.${key}`;
      const value = key.startsWith('session') || key.startsWith('status') || key.startsWith('tools')
        ? getValueAtPath(reference.ui as unknown as Record<string, unknown>, key)
        : getValueAtPath(reference.commands as unknown as Record<string, unknown>, key);

      if ((value === '' || value === null) && !ALLOWED_EMPTY_KEYS.has(fullKey)) {
        result.emptyValues.push(key);
      }
    }

    return result;
  }

  const target = loadTranslations(language);

  // Check UI translations
  const refUIKeys = new Set(flattenKeys(reference.ui as unknown as Record<string, unknown>));
  const targetUIKeys = new Set(flattenKeys(target.ui as unknown as Record<string, unknown>));

  for (const key of refUIKeys) {
    if (!targetUIKeys.has(key)) {
      result.missingKeys.push(`ui.${key}`);
    }
  }

  for (const key of targetUIKeys) {
    if (!refUIKeys.has(key)) {
      result.extraKeys.push(`ui.${key}`);
    }
    const value = getValueAtPath(target.ui as unknown as Record<string, unknown>, key);
    const fullKey = `ui.${key}`;
    if ((value === '' || value === null) && !ALLOWED_EMPTY_KEYS.has(fullKey)) {
      result.emptyValues.push(fullKey);
    }
  }

  // Check command translations
  const refCmdKeys = new Set(flattenKeys(reference.commands as unknown as Record<string, unknown>));
  const targetCmdKeys = new Set(flattenKeys(target.commands as unknown as Record<string, unknown>));

  for (const key of refCmdKeys) {
    if (!targetCmdKeys.has(key)) {
      result.missingKeys.push(`commands.${key}`);
    }
  }

  for (const key of targetCmdKeys) {
    if (!refCmdKeys.has(key)) {
      result.extraKeys.push(`commands.${key}`);
    }
    const value = getValueAtPath(target.commands as unknown as Record<string, unknown>, key);
    if (value === '' || value === null) {
      result.emptyValues.push(`commands.${key}`);
    }
  }

  return result;
}

/**
 * Run validation for all languages
 */
function runValidation(): void {
  console.log('🌐 i18n Translation Validation\n');
  console.log('═'.repeat(50));

  const reference = loadTranslations('en');
  let hasErrors = false;

  for (const language of LANGUAGES) {
    const result = validateLanguage(language, reference);

    console.log(`\n📁 ${language.toUpperCase()}`);

    if (result.missingKeys.length === 0 && result.extraKeys.length === 0 && result.emptyValues.length === 0) {
      console.log('   ✅ All translations complete');
    } else {
      if (result.missingKeys.length > 0) {
        hasErrors = true;
        console.log(`   ❌ Missing keys (${result.missingKeys.length}):`);
        for (const key of result.missingKeys.slice(0, 5)) {
          console.log(`      - ${key}`);
        }
        if (result.missingKeys.length > 5) {
          console.log(`      ... and ${result.missingKeys.length - 5} more`);
        }
      }

      if (result.extraKeys.length > 0) {
        console.log(`   ⚠️  Extra keys (${result.extraKeys.length}):`);
        for (const key of result.extraKeys.slice(0, 5)) {
          console.log(`      - ${key}`);
        }
        if (result.extraKeys.length > 5) {
          console.log(`      ... and ${result.extraKeys.length - 5} more`);
        }
      }

      if (result.emptyValues.length > 0) {
        hasErrors = true;
        console.log(`   ⚠️  Empty values (${result.emptyValues.length}):`);
        for (const key of result.emptyValues.slice(0, 5)) {
          console.log(`      - ${key}`);
        }
        if (result.emptyValues.length > 5) {
          console.log(`      ... and ${result.emptyValues.length - 5} more`);
        }
      }
    }
  }

  console.log('\n' + '═'.repeat(50));

  if (hasErrors) {
    console.log('❌ Validation failed - some translations need attention\n');
    process.exit(1);
  } else {
    console.log('✅ All translations validated successfully!\n');
  }
}

// Run if executed directly
runValidation();
