/**
 * Theme Registry - Color theme definitions for ax-cli
 *
 * Provides preset color themes that can be selected via settings.
 * Each theme defines semantic colors that map to Ink color strings.
 */

import type { ThemeName } from '../../schemas/settings-schemas.js';

/**
 * Semantic color tokens used throughout the UI
 */
export interface ThemeColors {
  // Primary accent color (used for highlights, active states)
  primary: string;
  // Secondary accent color
  secondary: string;
  // Success indicators (checkmarks, completed states)
  success: string;
  // Warning indicators (caution, attention needed)
  warning: string;
  // Error indicators (failures, critical states)
  error: string;
  // Muted/dimmed text (secondary info, hints)
  muted: string;
  // Border colors for boxes and separators
  border: string;
  // Accent color for special highlights
  accent: string;
  // Info/neutral indicators
  info: string;
  // Text on highlighted backgrounds
  textOnHighlight: string;
}

/**
 * Theme definition with metadata
 */
export interface Theme {
  name: ThemeName;
  displayName: string;
  description: string;
  colors: ThemeColors;
}

/**
 * Helper to create a frozen theme (prevents accidental mutation)
 */
function createTheme(theme: Theme): Readonly<Theme> {
  return Object.freeze({
    ...theme,
    colors: Object.freeze(theme.colors),
  });
}

/**
 * Default theme - current ax-cli colors
 * Cyan-based with standard terminal colors
 */
const defaultTheme = createTheme({
  name: 'default',
  displayName: 'Default',
  description: 'Standard ax-cli theme with cyan accents',
  colors: {
    primary: 'cyan',
    secondary: 'magenta',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    muted: 'gray',
    border: 'gray',
    accent: 'magenta',
    info: 'blue',
    // White for flash effects on dark terminal backgrounds
    textOnHighlight: 'white',
  },
});

/**
 * Dark theme - deeper, muted colors optimized for dark terminals
 */
const darkTheme = createTheme({
  name: 'dark',
  displayName: 'Dark',
  description: 'Muted colors optimized for dark terminal backgrounds',
  colors: {
    primary: 'blueBright',
    secondary: 'cyan',
    success: 'greenBright',
    warning: 'yellowBright',
    error: 'redBright',
    muted: 'gray',
    border: 'gray',
    accent: 'cyanBright',
    info: 'blueBright',
    // White for flash effects on dark terminal backgrounds
    textOnHighlight: 'white',
  },
});

/**
 * Light theme - adapted for light terminal backgrounds
 */
const lightTheme = createTheme({
  name: 'light',
  displayName: 'Light',
  description: 'Colors adapted for light terminal backgrounds',
  colors: {
    primary: 'blue',
    secondary: 'magenta',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    muted: 'blackBright',
    border: 'blackBright',
    accent: 'magenta',
    info: 'blue',
    // Use black for flash/highlight on light backgrounds (high contrast)
    textOnHighlight: 'black',
  },
});

/**
 * Dracula theme - popular purple-based dark theme
 * Inspired by https://draculatheme.com/
 */
const draculaTheme = createTheme({
  name: 'dracula',
  displayName: 'Dracula',
  description: 'Purple-based theme inspired by Dracula',
  colors: {
    primary: 'magenta',
    secondary: 'cyan',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    muted: 'gray',
    border: 'magenta',
    accent: 'cyan',
    info: 'magentaBright',
    // White for flash effects on dark terminal backgrounds
    textOnHighlight: 'white',
  },
});

/**
 * Monokai theme - warm orange/yellow accents
 * Inspired by the Monokai color scheme
 */
const monokaiTheme = createTheme({
  name: 'monokai',
  displayName: 'Monokai',
  description: 'Warm theme with orange and yellow accents',
  colors: {
    primary: 'yellow',
    secondary: 'magenta',
    success: 'greenBright',
    warning: 'yellowBright',
    error: 'redBright',
    muted: 'gray',
    border: 'yellow',
    accent: 'magentaBright',
    info: 'cyan',
    // White for flash effects on dark terminal backgrounds
    textOnHighlight: 'white',
  },
});

/**
 * Registry of all available themes
 * Frozen to prevent accidental modification of the registry
 */
export const themes: Readonly<Record<ThemeName, Theme>> = Object.freeze({
  default: defaultTheme,
  dark: darkTheme,
  light: lightTheme,
  dracula: draculaTheme,
  monokai: monokaiTheme,
});

/**
 * List of available theme names
 * Derived from themes object to ensure consistency
 */
export const themeNames: ThemeName[] = Object.keys(themes) as ThemeName[];

/**
 * Get a theme by name
 * Falls back to default theme if not found
 */
export function getTheme(name: ThemeName | undefined): Theme {
  return themes[name ?? 'default'] ?? themes.default;
}

/**
 * Get all available themes
 */
export function getAllThemes(): Theme[] {
  return Object.values(themes);
}

/**
 * Check if a theme name is valid
 * Uses Object.hasOwn to avoid prototype chain pollution
 */
export function isValidTheme(name: string): name is ThemeName {
  return Object.hasOwn(themes, name);
}
