/**
 * Provider-Aware Settings Manager
 *
 * This module wraps the SettingsManager to provide provider-specific settings
 * when running ax-glm and ax-grok in parallel.
 *
 * Key differences from base SettingsManager:
 * - Uses provider-specific config directories (~/.ax-glm/ vs ~/.ax-grok/)
 * - Supports instance-based configuration (no global singleton)
 * - Integrates with ProviderContext for path resolution
 * - Uses file locking for concurrent access
 *
 * @example
 * ```typescript
 * // Get settings for current provider context
 * const settings = getProviderSettings();
 * const apiKey = settings.getApiKey();
 *
 * // Get settings for specific provider
 * const glmSettings = getProviderSettings('glm');
 * const grokSettings = getProviderSettings('grok');
 * ```
 */

import { existsSync, mkdirSync, chmodSync } from 'fs';
import { dirname } from 'path';
import { z } from 'zod';
import {
  ProviderContext,
  ProviderType,
  getProviderContext,
} from './provider-context.js';
import { SafeJsonFile, withFileLockSync } from './file-lock.js';
import { encrypt, decrypt } from './encryption.js';
import { TIMEOUT_CONFIG } from '../constants.js';

/**
 * Encrypted value schema for API keys
 */
const EncryptedValueSchema = z.object({
  encrypted: z.string(),
  iv: z.string(),
  salt: z.string(),
  tag: z.string(),
  version: z.number(),
});

/**
 * Provider-specific user settings schema
 */
const ProviderUserSettingsSchema = z.object({
  // API Configuration
  apiKey: z.string().optional(),
  apiKeyEncrypted: EncryptedValueSchema.optional(),
  baseURL: z.string().optional(),
  defaultModel: z.string().optional(),
  models: z.array(z.string()).optional(),

  // Provider-specific settings
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),

  // Grok-specific
  grok: z.object({
    thinkingMode: z.enum(['off', 'low', 'high']).optional(),
    liveSearch: z.boolean().optional(),
    seed: z.number().optional(),
  }).optional(),

  // GLM-specific
  glm: z.object({
    thinkingEnabled: z.boolean().optional(),
  }).optional(),

  // Common settings
  thinking: z.object({
    enabled: z.boolean().optional(),
  }).optional(),

  sampling: z.object({
    doSample: z.boolean().optional(),
    seed: z.number().optional(),
    topP: z.number().min(0).max(1).optional(),
  }).optional(),

  // Passthrough for other settings
}).passthrough();

type ProviderUserSettings = z.infer<typeof ProviderUserSettingsSchema>;

/**
 * Provider-aware settings manager
 * Unlike the base SettingsManager, this is instance-based to support
 * multiple concurrent provider contexts.
 */
export class ProviderSettingsManager {
  private static instances = new Map<string, ProviderSettingsManager>();

  readonly context: ProviderContext;
  private userSettingsCache: ProviderUserSettings | null = null;
  private cacheTimestamp = 0;
  private readonly cacheTTL = TIMEOUT_CONFIG.SETTINGS_CACHE_TTL;

  private constructor(context: ProviderContext) {
    this.context = context;
  }

  /**
   * Get or create a settings manager for a provider context
   */
  static forContext(context: ProviderContext): ProviderSettingsManager {
    const key = `${context.provider}:${context.userDir}`;
    let instance = ProviderSettingsManager.instances.get(key);
    if (!instance) {
      instance = new ProviderSettingsManager(context);
      ProviderSettingsManager.instances.set(key, instance);
    }
    return instance;
  }

  /**
   * Get settings manager for a specific provider
   */
  static forProvider(provider: ProviderType): ProviderSettingsManager {
    const context = ProviderContext.create(provider);
    return ProviderSettingsManager.forContext(context);
  }

  /**
   * Get settings manager for current context
   */
  static current(): ProviderSettingsManager {
    return ProviderSettingsManager.forContext(getProviderContext());
  }

  /**
   * Clear all cached instances (for testing)
   */
  static clearInstances(): void {
    ProviderSettingsManager.instances.clear();
  }

  /**
   * Invalidate cache for this instance
   */
  invalidateCache(): void {
    this.userSettingsCache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Get the config file path for this provider
   */
  get configPath(): string {
    return this.context.userConfigPath;
  }

  /**
   * Ensure config directory exists with proper permissions
   */
  private ensureConfigDir(): void {
    const dir = dirname(this.configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Load user settings with caching and file locking
   */
  loadUserSettings(): ProviderUserSettings {
    const now = Date.now();
    if (this.userSettingsCache && (now - this.cacheTimestamp) < this.cacheTTL) {
      return this.userSettingsCache;
    }

    try {
      if (!existsSync(this.configPath)) {
        const defaults: ProviderUserSettings = {
          baseURL: this.context.config.defaultBaseURL,
          defaultModel: this.context.config.defaultModel,
        };
        this.saveUserSettings(defaults);
        this.userSettingsCache = defaults;
        this.cacheTimestamp = Date.now();
        return defaults;
      }

      // Use file locking for safe concurrent reads
      const data = SafeJsonFile.readSync<ProviderUserSettings>(this.configPath, {
        type: 'read',
        timeout: 5000,
      });

      if (!data) {
        const defaults: ProviderUserSettings = {};
        this.userSettingsCache = defaults;
        this.cacheTimestamp = Date.now();
        return defaults;
      }

      // Decrypt API key if encrypted
      let decryptedApiKey: string | undefined;
      if (data.apiKeyEncrypted) {
        try {
          decryptedApiKey = decrypt(data.apiKeyEncrypted);
        } catch {
          // Fall back to plain-text
          decryptedApiKey = data.apiKey;
        }
      } else if (data.apiKey) {
        decryptedApiKey = data.apiKey;
        // Migrate to encrypted format
        this.migrateToEncrypted(data, decryptedApiKey);
      }

      const settings: ProviderUserSettings = {
        ...data,
        apiKey: decryptedApiKey,
        apiKeyEncrypted: undefined,
      };

      this.userSettingsCache = settings;
      this.cacheTimestamp = Date.now();
      return settings;
    } catch (error) {
      console.warn(`Failed to load ${this.context.provider} settings:`, error);
      const defaults: ProviderUserSettings = {};
      this.userSettingsCache = defaults;
      this.cacheTimestamp = Date.now();
      return defaults;
    }
  }

  /**
   * Migrate plain-text API key to encrypted format
   */
  private migrateToEncrypted(data: ProviderUserSettings, apiKey: string): void {
    try {
      const encrypted = encrypt(apiKey);
      const migrated = {
        ...data,
        apiKeyEncrypted: encrypted,
        apiKey: undefined,
      };
      SafeJsonFile.writeSync(this.configPath, migrated);
      console.log(`Migrated ${this.context.provider} API key to encrypted format`);
    } catch {
      // Ignore migration errors
    }
  }

  /**
   * Save user settings with file locking
   * Uses atomic read-modify-write to prevent race conditions
   */
  saveUserSettings(settings: Partial<ProviderUserSettings>): void {
    this.ensureConfigDir();

    try {
      // Use withFileLockSync to make entire read-modify-write atomic
      withFileLockSync(
        this.configPath,
        () => {
          // Load existing settings (without lock - we already have it)
          let existing: ProviderUserSettings = {};
          if (existsSync(this.configPath)) {
            try {
              const content = require('fs').readFileSync(this.configPath, 'utf-8');
              const data = JSON.parse(content) as ProviderUserSettings;
              // Decrypt existing API key
              if (data.apiKeyEncrypted) {
                try {
                  data.apiKey = decrypt(data.apiKeyEncrypted);
                } catch {
                  // Keep as-is
                }
              }
              existing = data;
            } catch {
              // Ignore parse errors, start fresh
            }
          }

          // Merge settings
          const merged = { ...existing, ...settings };

          // Encrypt API key before saving
          const toSave = { ...merged };
          if (toSave.apiKey) {
            toSave.apiKeyEncrypted = encrypt(toSave.apiKey);
            delete toSave.apiKey;
          }

          // Write atomically
          const tempPath = `${this.configPath}.tmp.${process.pid}.${Date.now()}`;
          try {
            require('fs').writeFileSync(tempPath, JSON.stringify(toSave, null, 2));
            require('fs').renameSync(tempPath, this.configPath);
            chmodSync(this.configPath, 0o600);
          } catch (writeError) {
            // Clean up temp file
            try {
              if (existsSync(tempPath)) {
                require('fs').unlinkSync(tempPath);
              }
            } catch {
              // Ignore cleanup errors
            }
            throw writeError;
          }

          // Update cache
          this.userSettingsCache = merged;
          this.cacheTimestamp = Date.now();
        },
        { type: 'write', timeout: 10000, throwOnTimeout: true }
      );
    } catch (error) {
      console.error(`Failed to save ${this.context.provider} settings:`, error);
      throw error;
    }
  }

  /**
   * Get API key with fallback to environment variable
   */
  getApiKey(): string | undefined {
    // Check provider-specific environment variable first
    const envKey = this.context.getEnvApiKey();
    if (envKey) return envKey;

    // Check generic environment variable
    const genericKey = process.env.YOUR_API_KEY || process.env.AI_API_KEY;
    if (genericKey) return genericKey;

    // Fall back to settings
    return this.loadUserSettings().apiKey;
  }

  /**
   * Get base URL with fallback
   * Returns undefined if no valid URL is configured (empty string is treated as unconfigured)
   */
  getBaseURL(): string | undefined {
    const envURL = process.env.AI_BASE_URL;
    if (envURL && envURL.trim()) return envURL;

    const settings = this.loadUserSettings();
    const settingsURL = settings.baseURL;
    if (settingsURL && settingsURL.trim()) return settingsURL;

    const defaultURL = this.context.config.defaultBaseURL;
    if (defaultURL && defaultURL.trim()) return defaultURL;

    return undefined;
  }

  /**
   * Get current model with fallback
   * Returns undefined if no valid model is configured (empty string is treated as unconfigured)
   */
  getCurrentModel(): string | undefined {
    const envModel = process.env.AI_MODEL;
    if (envModel && envModel.trim()) return envModel;

    const settings = this.loadUserSettings();
    const settingsModel = settings.defaultModel;
    if (settingsModel && settingsModel.trim()) return settingsModel;

    const defaultModel = this.context.config.defaultModel;
    if (defaultModel && defaultModel.trim()) return defaultModel;

    return undefined;
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return this.loadUserSettings().models || [];
  }

  /**
   * Get thinking settings
   */
  getThinkingSettings(): { enabled?: boolean } | undefined {
    const envThink = process.env.AI_THINK;
    if (envThink !== undefined) {
      return { enabled: envThink.toLowerCase() === 'true' };
    }

    const settings = this.loadUserSettings();
    if (settings.thinking) {
      return settings.thinking;
    }

    // Provider-specific defaults
    if (this.context.provider === 'glm' && settings.glm?.thinkingEnabled !== undefined) {
      return { enabled: settings.glm.thinkingEnabled };
    }
    if (this.context.provider === 'grok' && settings.grok?.thinkingMode) {
      return { enabled: settings.grok.thinkingMode !== 'off' };
    }

    return undefined;
  }

  /**
   * Get Grok-specific settings
   */
  getGrokSettings(): {
    thinkingMode: 'off' | 'low' | 'high';
    liveSearch: boolean;
    seed?: number;
  } | undefined {
    if (this.context.provider !== 'grok') return undefined;

    const settings = this.loadUserSettings();
    return {
      thinkingMode: settings.grok?.thinkingMode || 'high',
      liveSearch: settings.grok?.liveSearch ?? true,
      seed: settings.grok?.seed,
    };
  }

  /**
   * Get GLM-specific settings
   */
  getGLMSettings(): {
    thinkingEnabled: boolean;
  } | undefined {
    if (this.context.provider !== 'glm') return undefined;

    const settings = this.loadUserSettings();
    return {
      thinkingEnabled: settings.glm?.thinkingEnabled ?? false,
    };
  }

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    const apiKey = this.getApiKey();
    const baseURL = this.getBaseURL();
    const model = this.getCurrentModel();
    return !!(apiKey && baseURL && model);
  }

  /**
   * Update a specific setting
   */
  updateSetting<K extends keyof ProviderUserSettings>(
    key: K,
    value: ProviderUserSettings[K]
  ): void {
    this.saveUserSettings({ [key]: value });
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get provider settings for current context or specific provider
 */
export function getProviderSettings(
  provider?: ProviderType
): ProviderSettingsManager {
  if (provider) {
    return ProviderSettingsManager.forProvider(provider);
  }
  return ProviderSettingsManager.current();
}

/**
 * Check if a provider is configured
 */
export function isProviderConfigured(provider: ProviderType): boolean {
  return getProviderSettings(provider).isConfigured();
}

/**
 * Get the best available provider (configured with API key)
 */
export function getBestAvailableProvider(): ProviderType | null {
  // Check in order of preference
  if (isProviderConfigured('glm')) return 'glm';
  if (isProviderConfigured('grok')) return 'grok';
  if (isProviderConfigured('generic')) return 'generic';
  return null;
}

/**
 * Get all configured providers
 */
export function getConfiguredProviders(): ProviderType[] {
  const providers: ProviderType[] = [];
  if (isProviderConfigured('glm')) providers.push('glm');
  if (isProviderConfigured('grok')) providers.push('grok');
  if (isProviderConfigured('generic')) providers.push('generic');
  return providers;
}
