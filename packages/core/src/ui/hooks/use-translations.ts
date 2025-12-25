/**
 * useTranslations Hook
 *
 * Provides easy access to UI translations in React components.
 * Memoizes translations to avoid unnecessary re-renders.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { ui, cmd } = useTranslations();
 *   return <Text>{ui.session.thinking}</Text>;
 * }
 * ```
 */

import { useMemo } from 'react';
import { getUITranslations, getCommandTranslations } from '../../i18n/loader.js';
import type { UITranslations, CommandTranslations } from '../../i18n/types.js';
import type { SupportedLanguage } from '../../i18n/loader.js';
import { SettingsManager } from '../../utils/settings-manager.js';

export interface UseTranslationsResult {
  /** UI translations (session, status, tools, usage, toast, etc.) */
  ui: UITranslations;
  /** Command translations (/status, /usage, /doctor, /memory, /help) */
  cmd: CommandTranslations;
  /** Current language code */
  language: SupportedLanguage;
}

// Cache for current language (invalidated on setLanguage)
let cachedLanguage: SupportedLanguage | null = null;

/**
 * Get current language from settings
 * Uses caching to avoid repeated file reads
 */
function getCurrentLanguage(): SupportedLanguage {
  if (!cachedLanguage) {
    try {
      const settingsManager = SettingsManager.getInstance();
      cachedLanguage = settingsManager.getLanguage() as SupportedLanguage;
    } catch {
      // Fallback to English if settings can't be read
      cachedLanguage = 'en';
    }
  }
  return cachedLanguage;
}

/**
 * Reset cached language (call when language changes)
 */
export function resetCachedLanguage(): void {
  cachedLanguage = null;
}

/**
 * Set the current language and persist to settings
 */
export function setCurrentLanguage(language: SupportedLanguage): void {
  try {
    const settingsManager = SettingsManager.getInstance();
    settingsManager.setLanguage(language);
    cachedLanguage = language;
  } catch {
    // Fallback: just update cache without persisting
    cachedLanguage = language;
  }
}

/**
 * Hook to get UI and command translations for current language
 *
 * @returns Object with ui and cmd translations plus current language
 */
export function useTranslations(): UseTranslationsResult {
  const language = getCurrentLanguage();

  // Memoize translations to avoid re-creating objects on every render
  const translations = useMemo(() => ({
    ui: getUITranslations(language),
    cmd: getCommandTranslations(language),
    language,
  }), [language]);

  return translations;
}

/**
 * Non-hook version for use outside React components
 * Use this in event handlers, utilities, or class methods
 */
export function getTranslations(): UseTranslationsResult {
  const language = getCurrentLanguage();
  return {
    ui: getUITranslations(language),
    cmd: getCommandTranslations(language),
    language,
  };
}
