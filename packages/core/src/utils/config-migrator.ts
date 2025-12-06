/**
 * Config Migration Service
 *
 * Handles migration from legacy ~/.ax-cli/ to provider-specific directories.
 *
 * Key principles:
 * - Interactive migration (user confirms each step)
 * - Does NOT migrate API keys (security - user re-enters)
 * - Properly handles encrypted API keys from legacy configs
 * - Migrates only non-sensitive settings
 * - Full isolation between ax-glm and ax-grok
 *
 * @module config-migrator
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import * as prompts from '@clack/prompts';
import chalk from 'chalk';
import type { ProviderDefinition } from '../provider/config.js';
import { getProviderConfigPaths } from '../provider/config.js';
import { isEncrypted, decrypt, type EncryptedValue } from './encryption.js';

// Legacy ax-cli config location
const LEGACY_CONFIG_DIR = join(homedir(), '.ax-cli');
const LEGACY_CONFIG_FILE = join(LEGACY_CONFIG_DIR, 'config.json');

/**
 * Settings safe to migrate (non-sensitive, provider-agnostic)
 */
const MIGRATABLE_SETTINGS = [
  'ui',
  'shortcuts',
  'paste',
  'input',
  'statusBar',
  'autoAccept',
  'externalEditor',
  'thinkingMode',
  'autoUpdate',
  'sampling',
  'thinking',
  'agentFirst',
  'temperature',
  'maxTokens',
] as const;

/**
 * Settings that require re-entry (sensitive or provider-specific)
 */
const NON_MIGRATABLE_SETTINGS = [
  'apiKey',
  'apiKeyEncrypted',
  'baseURL',
  'defaultModel',
  'model',
  'models',
  'currentModel',
] as const;

/**
 * Human-readable descriptions for settings
 */
const SETTING_DESCRIPTIONS: Record<string, string> = {
  ui: 'UI preferences (theme, verbosity)',
  shortcuts: 'Keyboard shortcuts',
  paste: 'Paste settings',
  input: 'Input behavior settings',
  statusBar: 'Status bar configuration',
  autoAccept: 'Auto-accept settings',
  externalEditor: 'External editor settings',
  thinkingMode: 'Thinking mode preferences',
  autoUpdate: 'Auto-update settings',
  sampling: 'Sampling parameters',
  thinking: 'Thinking configuration',
  agentFirst: 'Agent-first mode settings',
  temperature: 'Temperature setting',
  maxTokens: 'Max tokens setting',
  apiKey: 'API Key (re-enter for security)',
  apiKeyEncrypted: 'Encrypted API Key',
  baseURL: 'API Base URL',
  defaultModel: 'Default model',
  model: 'Current model',
  models: 'Available models list',
  currentModel: 'Currently selected model',
};

/**
 * API key status in legacy config
 */
export type ApiKeyStatus =
  | { type: 'none' }
  | { type: 'plain-text'; masked: string }
  | { type: 'encrypted'; masked: string | null; decryptable: boolean };

/**
 * Summary of what will be migrated
 */
export interface MigrationSummary {
  /** Settings that will be migrated */
  willMigrate: string[];
  /** Settings that will be skipped (unknown) */
  willSkip: string[];
  /** Settings that require re-entry (security) */
  requiresReentry: string[];
  /** Whether there's anything worth migrating */
  hasMigratableSettings: boolean;
  /** Status of API key in legacy config */
  apiKeyStatus: ApiKeyStatus;
}

/**
 * Result of migration operation
 */
export interface MigrationResult {
  /** Whether migration succeeded */
  success: boolean;
  /** Settings that were migrated */
  migratedSettings: string[];
  /** Any errors encountered */
  errors: string[];
}

/**
 * User's choice from migration prompt
 */
export type MigrationChoice = 'migrate' | 'fresh' | 'skip';

/**
 * Mask an API key for safe display
 * Shows first 4 and last 4 characters with dots in between
 */
function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 12) {
    return apiKey ? `${apiKey.substring(0, Math.min(4, apiKey.length))}...` : '***';
  }
  return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
}

/**
 * Detect API key status in legacy config
 * Handles both plain-text and encrypted formats
 */
function detectApiKeyStatus(config: Record<string, unknown>): ApiKeyStatus {
  // Check for encrypted API key (v4.0.2+ format)
  if (config.apiKeyEncrypted && isEncrypted(config.apiKeyEncrypted)) {
    try {
      // Try to decrypt to verify it's valid and get masked version
      const decrypted = decrypt(config.apiKeyEncrypted as EncryptedValue);
      return {
        type: 'encrypted',
        masked: maskApiKey(decrypted),
        decryptable: true,
      };
    } catch {
      // Encrypted but can't decrypt (different machine, corrupted, etc.)
      return {
        type: 'encrypted',
        masked: null,
        decryptable: false,
      };
    }
  }

  // Check for plain-text API key (older format)
  if (config.apiKey && typeof config.apiKey === 'string' && config.apiKey.trim().length > 0) {
    return {
      type: 'plain-text',
      masked: maskApiKey(config.apiKey),
    };
  }

  // No API key found
  return { type: 'none' };
}

/**
 * Config Migration Service
 *
 * Provides methods to detect, analyze, and perform migrations
 * from legacy ax-cli configurations to provider-specific ones.
 */
export class ConfigMigrator {
  /**
   * Check if legacy ax-cli config exists
   */
  static hasLegacyConfig(): boolean {
    return existsSync(LEGACY_CONFIG_FILE);
  }

  /**
   * Get legacy config directory path
   */
  static getLegacyConfigDir(): string {
    return LEGACY_CONFIG_DIR;
  }

  /**
   * Get legacy config file path
   */
  static getLegacyConfigFile(): string {
    return LEGACY_CONFIG_FILE;
  }

  /**
   * Check if already migrated to a specific provider
   * Uses marker files to track migration status per provider
   */
  static wasAlreadyMigrated(provider: ProviderDefinition): boolean {
    const markerFile = join(LEGACY_CONFIG_DIR, `.migrated-to-${provider.name}`);
    return existsSync(markerFile);
  }

  /**
   * Mark legacy config as migrated to a specific provider
   */
  static markAsMigrated(provider: ProviderDefinition): void {
    try {
      // Ensure legacy dir exists (should, but be safe)
      if (!existsSync(LEGACY_CONFIG_DIR)) {
        mkdirSync(LEGACY_CONFIG_DIR, { recursive: true, mode: 0o700 });
      }
      const markerFile = join(LEGACY_CONFIG_DIR, `.migrated-to-${provider.name}`);
      const markerContent = JSON.stringify({
        migratedAt: new Date().toISOString(),
        provider: provider.name,
        providerDisplayName: provider.displayName,
      }, null, 2);
      writeFileSync(markerFile, markerContent, { mode: 0o600 });
    } catch {
      // Ignore marker file errors - not critical
    }
  }

  /**
   * Load legacy config (read-only)
   * Returns null if file doesn't exist or is invalid
   */
  static loadLegacyConfig(): Record<string, unknown> | null {
    try {
      if (!existsSync(LEGACY_CONFIG_FILE)) {
        return null;
      }
      const content = readFileSync(LEGACY_CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(content);

      // Basic validation - should be an object
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return null;
      }

      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /**
   * Get file stats for legacy config (for display)
   */
  static getLegacyConfigStats(): { size: number; mtime: Date } | null {
    try {
      if (!existsSync(LEGACY_CONFIG_FILE)) {
        return null;
      }
      const stats = statSync(LEGACY_CONFIG_FILE);
      return { size: stats.size, mtime: stats.mtime };
    } catch {
      return null;
    }
  }

  /**
   * Get migration summary for display to user
   * Categorizes all settings into migratable, skippable, and re-entry required
   * Also detects API key status (plain-text, encrypted, or none)
   */
  static getMigrationSummary(legacyConfig: Record<string, unknown>): MigrationSummary {
    const willMigrate: string[] = [];
    const willSkip: string[] = [];
    const requiresReentry: string[] = [];

    for (const key of Object.keys(legacyConfig)) {
      // Skip internal fields (start with _)
      if (key.startsWith('_')) {
        willSkip.push(key);
        continue;
      }

      if (MIGRATABLE_SETTINGS.includes(key as typeof MIGRATABLE_SETTINGS[number])) {
        willMigrate.push(key);
      } else if (NON_MIGRATABLE_SETTINGS.includes(key as typeof NON_MIGRATABLE_SETTINGS[number])) {
        requiresReentry.push(key);
      } else {
        willSkip.push(key);
      }
    }

    // Detect API key status (handles both encrypted and plain-text)
    const apiKeyStatus = detectApiKeyStatus(legacyConfig);

    return {
      willMigrate,
      willSkip,
      requiresReentry,
      hasMigratableSettings: willMigrate.length > 0,
      apiKeyStatus,
    };
  }

  /**
   * Get human-readable description for a setting
   */
  static getSettingDescription(key: string): string {
    return SETTING_DESCRIPTIONS[key] || key;
  }

  /**
   * Perform migration of non-sensitive settings
   *
   * @param legacyConfig - The loaded legacy configuration
   * @param provider - Target provider to migrate to
   * @returns Migration result with success status and details
   */
  static migrate(
    legacyConfig: Record<string, unknown>,
    provider: ProviderDefinition
  ): MigrationResult {
    const migratedSettings: string[] = [];
    const errors: string[] = [];

    try {
      const configPaths = getProviderConfigPaths(provider);

      // Ensure target directory exists with secure permissions
      if (!existsSync(configPaths.USER_DIR)) {
        mkdirSync(configPaths.USER_DIR, { recursive: true, mode: 0o700 });
      }

      // Build new config with only migratable settings
      const newConfig: Record<string, unknown> = {};

      for (const key of MIGRATABLE_SETTINGS) {
        if (key in legacyConfig && legacyConfig[key] !== undefined) {
          newConfig[key] = legacyConfig[key];
          migratedSettings.push(key);
        }
      }

      // Only write if there's something to migrate
      if (migratedSettings.length > 0) {
        // Check if target config already exists
        let existingConfig: Record<string, unknown> = {};
        if (existsSync(configPaths.USER_CONFIG)) {
          try {
            const content = readFileSync(configPaths.USER_CONFIG, 'utf-8');
            existingConfig = JSON.parse(content);
          } catch {
            // Ignore parse errors, will merge with empty object
          }
        }

        // Merge: existing config takes precedence
        // This ensures we don't overwrite settings user has already configured
        const mergedConfig = { ...newConfig, ...existingConfig };

        // Add migration metadata
        mergedConfig._migratedFrom = 'ax-cli';
        mergedConfig._migratedAt = new Date().toISOString();

        writeFileSync(
          configPaths.USER_CONFIG,
          JSON.stringify(mergedConfig, null, 2),
          { mode: 0o600 }
        );
      }

      // Mark as migrated regardless of whether settings were copied
      // This prevents repeated prompts
      this.markAsMigrated(provider);

      return { success: true, migratedSettings, errors };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error during migration');
      return { success: false, migratedSettings, errors };
    }
  }

  /**
   * Interactive migration prompt
   * Shows user what will be migrated and asks for confirmation
   *
   * @param provider - Target provider
   * @param summary - Migration summary to display
   * @returns User's choice: 'migrate', 'fresh', or 'skip'
   */
  static async promptForMigration(
    provider: ProviderDefinition,
    summary: MigrationSummary
  ): Promise<MigrationChoice> {
    console.log(''); // Blank line for spacing

    // Show header
    await prompts.note(
      `Found: ${LEGACY_CONFIG_FILE}\n\n` +
      `We detected a legacy ax-cli configuration. You can migrate\n` +
      `non-sensitive settings to ${provider.branding.cliName}.`,
      'Legacy Configuration Found'
    );

    // Show API key status prominently
    console.log(chalk.cyan('\n  API Key Status:'));
    switch (summary.apiKeyStatus.type) {
      case 'encrypted':
        if (summary.apiKeyStatus.decryptable && summary.apiKeyStatus.masked) {
          console.log(chalk.yellow(`    - Encrypted key found: ${summary.apiKeyStatus.masked}`));
          console.log(chalk.dim(`      (Will NOT be migrated - please re-enter during setup)`));
        } else {
          console.log(chalk.yellow(`    - Encrypted key found (cannot decrypt on this machine)`));
          console.log(chalk.dim(`      (Will NOT be migrated - please re-enter during setup)`));
        }
        break;
      case 'plain-text':
        console.log(chalk.yellow(`    - Plain-text key found: ${summary.apiKeyStatus.masked}`));
        console.log(chalk.dim(`      (Will NOT be migrated - please re-enter during setup)`));
        break;
      case 'none':
        console.log(chalk.dim(`    - No API key found in legacy config`));
        break;
    }

    // Show what will be migrated
    if (summary.willMigrate.length > 0) {
      console.log(chalk.green('\n  Will migrate (non-sensitive settings):'));
      for (const setting of summary.willMigrate) {
        const desc = this.getSettingDescription(setting);
        console.log(chalk.gray(`    - ${desc}`));
      }
    }

    // Show what requires re-entry (excluding API key which is shown above)
    const otherReentry = summary.requiresReentry.filter(
      s => s !== 'apiKey' && s !== 'apiKeyEncrypted'
    );
    if (otherReentry.length > 0) {
      console.log(chalk.yellow('\n  Requires re-entry (provider-specific):'));
      for (const setting of otherReentry) {
        const desc = this.getSettingDescription(setting);
        console.log(chalk.gray(`    - ${desc}`));
      }
    }

    // Show what will be skipped (only if there are items)
    if (summary.willSkip.length > 0) {
      console.log(chalk.dim('\n  Will skip (internal/unknown):'));
      for (const setting of summary.willSkip) {
        console.log(chalk.dim(`    - ${setting}`));
      }
    }

    console.log(''); // Blank line before prompt

    // Ask user what to do
    const choice = await prompts.select({
      message: 'How would you like to proceed?',
      options: [
        {
          value: 'migrate',
          label: 'Migrate settings and continue to setup',
          hint: summary.hasMigratableSettings ? 'Recommended' : 'No settings to migrate',
        },
        {
          value: 'fresh',
          label: 'Start fresh (ignore legacy config)',
          hint: 'Clean slate - will not ask again',
        },
        {
          value: 'skip',
          label: 'Skip for now',
          hint: 'Will ask again next time',
        },
      ],
    });

    // Handle cancellation
    if (prompts.isCancel(choice)) {
      return 'skip';
    }

    return choice as MigrationChoice;
  }

  /**
   * Perform full migration flow (detection + prompt + migration)
   * Convenience method that combines all steps
   *
   * @param provider - Target provider
   * @returns Whether setup should continue
   */
  static async runMigrationFlow(provider: ProviderDefinition): Promise<{
    shouldContinue: boolean;
    migrationPerformed: boolean;
  }> {
    // Check if legacy config exists
    if (!this.hasLegacyConfig()) {
      return { shouldContinue: true, migrationPerformed: false };
    }

    // Check if already migrated
    if (this.wasAlreadyMigrated(provider)) {
      return { shouldContinue: true, migrationPerformed: false };
    }

    // Load legacy config
    const legacyConfig = this.loadLegacyConfig();
    if (!legacyConfig) {
      return { shouldContinue: true, migrationPerformed: false };
    }

    // Get summary
    const summary = this.getMigrationSummary(legacyConfig);

    // Prompt user
    const choice = await this.promptForMigration(provider, summary);

    switch (choice) {
      case 'migrate': {
        const result = this.migrate(legacyConfig, provider);
        if (result.success && result.migratedSettings.length > 0) {
          console.log(chalk.green(`\n  Migrated ${result.migratedSettings.length} settings\n`));
        } else if (result.success) {
          console.log(chalk.dim('\n  No settings to migrate\n'));
        } else {
          console.log(chalk.red(`\n  Migration errors: ${result.errors.join(', ')}\n`));
        }
        return { shouldContinue: true, migrationPerformed: true };
      }

      case 'fresh':
        // Mark as migrated so we don't ask again
        this.markAsMigrated(provider);
        return { shouldContinue: true, migrationPerformed: false };

      case 'skip':
      default:
        // Don't mark - will ask again next time
        return { shouldContinue: true, migrationPerformed: false };
    }
  }
}
