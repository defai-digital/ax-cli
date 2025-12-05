/**
 * Color constants and theme utilities for the CLI interface
 */

import { getTheme, type ThemeColors } from '../themes/index.js';
import type { ThemeName } from '../../schemas/settings-schemas.js';
import { getSettingsManager } from '../../utils/settings-manager.js';

// Re-export ThemeColors for convenience
export type { ThemeColors } from '../themes/index.js';

/**
 * Legacy color constants (for backward compatibility)
 * @deprecated Use getThemeColors() instead for theme-aware colors
 */
export const Colors = {
  AccentYellow: 'yellow',
  Gray: 'gray',
  Red: 'red',
  Green: 'green',
  Blue: 'blue',
  Cyan: 'cyan',
  Magenta: 'magenta',
  White: 'white',
  Black: 'black'
} as const;

/**
 * Cached theme colors to avoid repeated lookups
 */
let cachedThemeName: ThemeName | undefined;
let cachedColors: ThemeColors | null = null;

/**
 * Get the current theme colors based on user settings
 * Caches the result to avoid repeated file reads
 * Falls back to default theme if settings cannot be loaded
 */
export function getThemeColors(): ThemeColors {
  let currentTheme: ThemeName = 'default';

  try {
    const settings = getSettingsManager();
    const uiConfig = settings.getUIConfig();
    // Theme may be undefined in config, fall back to default
    if (uiConfig && uiConfig.theme !== undefined) {
      currentTheme = uiConfig.theme;
    }
  } catch {
    // Settings not available (e.g., during early startup), use default theme
    currentTheme = 'default';
  }

  // Return cached colors if theme hasn't changed
  if (cachedColors && cachedThemeName === currentTheme) {
    // Return a shallow copy to prevent callers from mutating the cache
    return { ...cachedColors };
  }

  // Update cache with a shallow copy to prevent mutation of original theme
  cachedThemeName = currentTheme;
  cachedColors = { ...getTheme(currentTheme).colors };
  // Return a copy, not the cache itself, to prevent external mutation
  return { ...cachedColors };
}

/**
 * Get a specific color from the current theme
 */
export function getColor(colorKey: keyof ThemeColors): string {
  return getThemeColors()[colorKey];
}

/**
 * Clear the theme cache (call when theme setting changes)
 */
export function clearThemeCache(): void {
  cachedThemeName = undefined;
  cachedColors = null;
}

/**
 * Get the current theme name
 * Falls back to 'default' if settings cannot be loaded
 */
export function getCurrentThemeName(): ThemeName {
  try {
    const settings = getSettingsManager();
    const uiConfig = settings.getUIConfig();
    if (uiConfig && uiConfig.theme !== undefined) {
      return uiConfig.theme;
    }
    return 'default';
  } catch {
    return 'default';
  }
}
