/**
 * Design Check Configuration Loader
 * Handles loading and merging configuration from multiple sources
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { DesignCheckConfig, RulesConfig, TokenConfig } from './types.js';

/**
 * Path to the JSON schema for design check configuration
 * Use this in $schema field for IDE auto-completion
 */
export const SCHEMA_URL = 'https://ax-cli.dev/schemas/design-check.json';

/**
 * Get the local path to the JSON schema file
 */
export function getSchemaPath(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.join(__dirname, 'schemas', 'design-check.schema.json');
}

/**
 * Default configuration used when no config file is found
 */
export const DEFAULT_CONFIG: DesignCheckConfig = {
  tokens: {
    colors: {},
    spacing: {
      '0': '0',
      'px': '1px',
      'xs': '4px',
      'sm': '8px',
      'md': '16px',
      'lg': '24px',
      'xl': '32px',
      '2xl': '48px',
    },
  },
  rules: {
    'no-hardcoded-colors': 'error',
    'no-raw-spacing': 'warn',
    'no-inline-styles': 'warn',
    'missing-alt-text': 'error',
    'missing-form-labels': 'error',
  },
  include: [
    'src/**/*.tsx',
    'src/**/*.jsx',
    'src/**/*.ts',
    'src/**/*.js',
    'src/**/*.css',
  ],
  ignore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/*.stories.*',
    '**/__tests__/**',
    '**/__mocks__/**',
  ],
};

/**
 * Config file names to search for (in priority order)
 */
const CONFIG_FILE_NAMES = [
  'design.json',
  'design-check.json',
];

/**
 * Find config file in a directory
 */
function findConfigInDir(dir: string): string | null {
  for (const fileName of CONFIG_FILE_NAMES) {
    const configPath = path.join(dir, fileName);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}

/**
 * Discover config file path
 * Search order: CLI arg > .ax-cli/ > ~/.ax-cli/
 */
export function discoverConfigPath(cliConfigPath?: string): string | null {
  // 1. CLI-provided path
  if (cliConfigPath) {
    if (fs.existsSync(cliConfigPath)) {
      return cliConfigPath;
    }
    throw new Error(`Config file not found: ${cliConfigPath}`);
  }

  // 2. Project-level: .ax-cli/
  const projectConfigDir = path.join(process.cwd(), '.ax-cli');
  const projectConfig = findConfigInDir(projectConfigDir);
  if (projectConfig) {
    return projectConfig;
  }

  // 3. User-level: ~/.ax-cli/
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  if (homeDir) {
    const userConfigDir = path.join(homeDir, '.ax-cli');
    const userConfig = findConfigInDir(userConfigDir);
    if (userConfig) {
      return userConfig;
    }
  }

  return null;
}

/**
 * Parse and validate config file
 */
function parseConfigFile(configPath: string): Partial<DesignCheckConfig> {
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Basic validation
    if (parsed && typeof parsed === 'object') {
      return parsed as Partial<DesignCheckConfig>;
    }

    throw new Error('Invalid config format: expected object');
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file: ${configPath}`);
    }
    throw error;
  }
}

/**
 * Deep merge two config objects
 */
function mergeConfigs(
  base: DesignCheckConfig,
  override: Partial<DesignCheckConfig>
): DesignCheckConfig {
  return {
    tokens: {
      colors: { ...base.tokens.colors, ...override.tokens?.colors },
      spacing: { ...base.tokens.spacing, ...override.tokens?.spacing },
    },
    rules: { ...base.rules, ...override.rules } as RulesConfig,
    include: override.include ?? base.include,
    ignore: override.ignore ?? base.ignore,
  };
}

/**
 * Load configuration from all sources and merge
 */
export async function loadConfig(
  cliConfigPath?: string,
  cliIgnorePatterns?: string[]
): Promise<DesignCheckConfig> {
  let config = { ...DEFAULT_CONFIG };

  // Find and load config file
  const configPath = discoverConfigPath(cliConfigPath);
  if (configPath) {
    const fileConfig = parseConfigFile(configPath);
    config = mergeConfigs(config, fileConfig);
  }

  // Add CLI ignore patterns
  if (cliIgnorePatterns && cliIgnorePatterns.length > 0) {
    config.ignore = [...config.ignore, ...cliIgnorePatterns];
  }

  return config;
}

/**
 * Validate token configuration
 */
export function validateTokens(tokens: TokenConfig): string[] {
  const errors: string[] = [];

  // Validate color format
  for (const [name, value] of Object.entries(tokens.colors)) {
    if (!isValidColor(value)) {
      errors.push(`Invalid color token "${name}": ${value}`);
    }
  }

  // Validate spacing format
  for (const [name, value] of Object.entries(tokens.spacing)) {
    if (!isValidSpacing(value)) {
      errors.push(`Invalid spacing token "${name}": ${value}`);
    }
  }

  return errors;
}

/**
 * Check if a string is a valid color value
 */
function isValidColor(value: string): boolean {
  // Hex colors
  if (/^#([0-9a-fA-F]{3,8})$/.test(value)) {
    return true;
  }
  // RGB/RGBA
  if (/^rgba?\(.+\)$/.test(value)) {
    return true;
  }
  // HSL/HSLA
  if (/^hsla?\(.+\)$/.test(value)) {
    return true;
  }
  // Named colors (basic check)
  if (/^[a-zA-Z]+$/.test(value)) {
    return true;
  }
  return false;
}

/**
 * Check if a string is a valid spacing value
 */
function isValidSpacing(value: string): boolean {
  // Zero
  if (value === '0') {
    return true;
  }
  // Pixel values
  if (/^\d+px$/.test(value)) {
    return true;
  }
  // Rem/em values
  if (/^[\d.]+r?em$/.test(value)) {
    return true;
  }
  return false;
}

/**
 * Get the effective severity for a rule
 */
export function getRuleSeverity(
  ruleId: string,
  config: DesignCheckConfig
): 'error' | 'warning' | null {
  const setting = config.rules[ruleId];
  if (setting === 'off') {
    return null;
  }
  return setting === 'warn' ? 'warning' : 'error';
}
