/**
 * i18n Module - Internationalization for AX CLI
 *
 * Architecture:
 * - JSON locale files in ./locales/{lang}/*.json
 * - TypeScript interfaces in ./types.ts
 * - Loader with caching in ./loader.ts
 *
 * Usage:
 * ```typescript
 * import { getUITranslations, getCommandTranslations } from '../i18n';
 *
 * const lang = 'en';
 * const ui = getUITranslations(lang);
 * console.log(ui.session.welcome);
 * ```
 */

// Loader functions
export {
  getUITranslations,
  getCommandTranslations,
  hasFullTranslations,
  getSupportedLanguages,
  registerUITranslations,
  registerCommandTranslations,
} from './loader.js';

// Type definitions
export type {
  UITranslations,
  CommandTranslations,
} from './types.js';

// Re-export language type from loader
export type { SupportedLanguage } from './loader.js';
