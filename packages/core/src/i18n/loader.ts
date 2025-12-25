/**
 * i18n Locale Loader
 *
 * Loads translations from JSON files with caching and fallback to English.
 *
 * @packageDocumentation
 */

import { createRequire } from 'node:module';
import type { UITranslations, CommandTranslations } from './types.js';

// Define supported languages locally (will be moved to schemas later)
export type SupportedLanguage = 'en' | 'zh-CN' | 'zh-TW' | 'ja' | 'ko' | 'th' | 'vi' | 'de' | 'fr' | 'es' | 'pt';

// Use createRequire for JSON imports (Node.js v24+ compatible)
// This avoids the deprecated 'assert' vs 'with' import assertion issue
const require = createRequire(import.meta.url);

// English (base)
const enUI = require('./locales/en/ui.json') as UITranslations;
const enCommands = require('./locales/en/commands.json') as CommandTranslations;

// Simplified Chinese
const zhCNUI = require('./locales/zh-CN/ui.json') as UITranslations;
const zhCNCommands = require('./locales/zh-CN/commands.json') as CommandTranslations;

// Traditional Chinese
const zhTWUI = require('./locales/zh-TW/ui.json') as UITranslations;
const zhTWCommands = require('./locales/zh-TW/commands.json') as CommandTranslations;

// Japanese
const jaUI = require('./locales/ja/ui.json') as UITranslations;
const jaCommands = require('./locales/ja/commands.json') as CommandTranslations;

// Korean
const koUI = require('./locales/ko/ui.json') as UITranslations;
const koCommands = require('./locales/ko/commands.json') as CommandTranslations;

// Thai
const thUI = require('./locales/th/ui.json') as UITranslations;
const thCommands = require('./locales/th/commands.json') as CommandTranslations;

// Vietnamese
const viUI = require('./locales/vi/ui.json') as UITranslations;
const viCommands = require('./locales/vi/commands.json') as CommandTranslations;

// German
const deUI = require('./locales/de/ui.json') as UITranslations;
const deCommands = require('./locales/de/commands.json') as CommandTranslations;

// French
const frUI = require('./locales/fr/ui.json') as UITranslations;
const frCommands = require('./locales/fr/commands.json') as CommandTranslations;

// Spanish
const esUI = require('./locales/es/ui.json') as UITranslations;
const esCommands = require('./locales/es/commands.json') as CommandTranslations;

// Portuguese
const ptUI = require('./locales/pt/ui.json') as UITranslations;
const ptCommands = require('./locales/pt/commands.json') as CommandTranslations;

// ═══════════════════════════════════════════════════════════════════════════
// Locale Registry
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Registry of loaded UI translations by language
 * All 11 languages now have full JSON translations
 */
const uiTranslations: Record<SupportedLanguage, UITranslations> = {
  'en': enUI,
  'zh-CN': zhCNUI,
  'zh-TW': zhTWUI,
  'ja': jaUI,
  'ko': koUI,
  'th': thUI,
  'vi': viUI,
  'de': deUI,
  'fr': frUI,
  'es': esUI,
  'pt': ptUI,
};

/**
 * Registry of loaded command translations by language
 * All 11 languages now have full JSON translations
 */
const commandTranslations: Record<SupportedLanguage, CommandTranslations> = {
  'en': enCommands,
  'zh-CN': zhCNCommands,
  'zh-TW': zhTWCommands,
  'ja': jaCommands,
  'ko': koCommands,
  'th': thCommands,
  'vi': viCommands,
  'de': deCommands,
  'fr': frCommands,
  'es': esCommands,
  'pt': ptCommands,
};

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get UI translations for a specific language
 *
 * @param language - The language code (e.g., 'en', 'zh-CN', 'ja')
 * @returns UI translations object, falls back to English if not found
 */
export function getUITranslations(language: SupportedLanguage): UITranslations {
  return uiTranslations[language] || uiTranslations['en'];
}

/**
 * Get command translations for a specific language
 *
 * @param language - The language code (e.g., 'en', 'zh-CN', 'ja')
 * @returns Command translations object, falls back to English if not found
 */
export function getCommandTranslations(language: SupportedLanguage): CommandTranslations {
  return commandTranslations[language] || commandTranslations['en'];
}

/**
 * Check if a language has full translations available
 *
 * @param language - The language code to check
 * @returns true if full translations exist, false if using fallback
 */
export function hasFullTranslations(language: SupportedLanguage): boolean {
  // All 11 languages now have full JSON translations
  return getSupportedLanguages().includes(language);
}

/**
 * Get list of all supported languages
 */
export function getSupportedLanguages(): SupportedLanguage[] {
  return ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'th', 'vi', 'de', 'fr', 'es', 'pt'];
}

// ═══════════════════════════════════════════════════════════════════════════
// Dynamic Registration (for future use)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Register UI translations for a language
 * Used during migration to add new language JSON files
 *
 * @internal
 */
export function registerUITranslations(
  language: SupportedLanguage,
  translations: UITranslations
): void {
  uiTranslations[language] = translations;
}

/**
 * Register command translations for a language
 * Used during migration to add new language JSON files
 *
 * @internal
 */
export function registerCommandTranslations(
  language: SupportedLanguage,
  translations: CommandTranslations
): void {
  commandTranslations[language] = translations;
}
