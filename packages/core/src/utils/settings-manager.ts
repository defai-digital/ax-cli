import { existsSync, mkdirSync, chmodSync } from "fs";
import { dirname } from "path";
import { UserSettingsSchema, ProjectSettingsSchema } from "../schemas/settings-schemas.js";
import type { UserSettings, ProjectSettings, SamplingSettings, ThinkingSettings, InputSettings, ShortcutsSettings, PasteSettings, UISettings, StatusBarSettings, AutoAcceptSettings, ExternalEditorSettings, ThinkingModeSettings, AutoUpdateSettings } from "../schemas/settings-schemas.js";
import { ModelIdSchema } from '@defai.digital/ax-schemas';
import { parseJsonFile, writeJsonFile } from "./json-utils.js";
import { encrypt, decrypt } from "./encryption.js";
import { extractErrorMessage } from "./error-handler.js";
import { getLogger } from "./logger.js";
import { TIMEOUT_CONFIG } from "../constants.js";
import { getActiveConfigPaths, getActiveProvider, getApiKeyFromEnv } from "../provider/config.js";

// Re-export types for external use
export type { UserSettings, ProjectSettings };

// Phase 1: Define non-optional config types for internal use
type RequiredInputSettings = Required<InputSettings>;
type RequiredShortcutsSettings = Required<ShortcutsSettings>;
type RequiredPasteSettings = Required<PasteSettings>;

/**
 * Helper to get config with defaults
 * Reduces repetition in getXxxConfig() methods
 * Always returns a new object to prevent mutation of defaults
 */
function getConfigWithDefaults<T extends object>(
  userConfig: T | undefined,
  defaults: T
): T {
  if (!userConfig) {
    // Return a shallow copy to prevent mutation of the defaults object
    return { ...defaults };
  }
  // Merge user config with defaults (user config takes precedence)
  return Object.keys(defaults).reduce((result, key) => {
    const k = key as keyof T;
    result[k] = userConfig[k] ?? defaults[k];
    return result;
  }, {} as T);
}

/**
 * Default values for user settings
 * Note: These are minimal defaults. Users should run 'ax-cli setup' to configure properly.
 */
const DEFAULT_USER_SETTINGS: Partial<UserSettings> = {
  // No hardcoded defaults - users must configure via setup command
};

/**
 * Default values for project settings
 */
const DEFAULT_PROJECT_SETTINGS: Partial<ProjectSettings> = {
  // Project settings inherit from user settings, no hardcoded defaults
};

/**
 * Unified settings manager that handles both user-level and project-level settings
 */
export class SettingsManager {
  private static instance: SettingsManager;

  /** Public defaults (exposed for tests and external consumers) */
  public static readonly INPUT_DEFAULTS: RequiredInputSettings = {
    enterBehavior: 'submit',
    submitKeys: ['enter'],
    multilineIndicator: '│ ',
    smartDetection: {
      enabled: true,
      checkBrackets: true,
      checkOperators: true,
      checkStatements: true,
    },
  };

  public static readonly SHORTCUTS_DEFAULTS: RequiredShortcutsSettings = {
    showOnStartup: false,
    hintTimeout: 3000,
    customBindings: {},
  };

  public static readonly PASTE_DEFAULTS: RequiredPasteSettings = {
    autoCollapse: true,
    collapseThreshold: 20,
    characterThreshold: 500,
    maxCollapsedBlocks: 50,
    showLineCount: true,
    showPreview: true,
    previewLines: 2,
    enableHistory: true,
    maxHistoryItems: 10,
    enableBracketedPaste: true,
    showPasteIndicator: true,
    maxPasteSize: 100 * 1024 * 1024, // 100MB
    pasteTimeout: 30000,
    enableFallback: true,
  };

  public static readonly AUTO_ACCEPT_DEFAULTS: AutoAcceptSettings = {
    enabled: false,
    persistAcrossSessions: false,
    alwaysConfirm: ['git_push_main', 'mass_delete', 'rm_rf', 'npm_publish'],
    scope: 'session',
    auditLog: {
      enabled: true,
      maxEntries: 1000,
      filepath: undefined,
    },
  };

  // Cache for settings to avoid repeated file I/O
  private userSettingsCache: UserSettings | null = null;
  private projectSettingsCache: ProjectSettings | null = null;
  private cacheTimestamp = {
    user: 0,
    project: 0
  };
  private readonly CACHE_TTL = TIMEOUT_CONFIG.SETTINGS_CACHE_TTL;

  // BUG FIX: Paths are now computed dynamically via getters instead of being
  // cached in constructor. This fixes a race condition where the singleton
  // could be created before setActiveProviderConfigPaths() is called,
  // resulting in permanently wrong paths (GLM defaults) being used.

  /**
   * Get user settings path dynamically from active provider
   * This ensures correct paths even if provider is set after singleton creation
   */
  private get userSettingsPath(): string {
    return getActiveConfigPaths().USER_CONFIG;
  }

  /**
   * Get project settings path dynamically from active provider
   * This ensures correct paths even if provider is set after singleton creation
   */
  private get projectSettingsPath(): string {
    return getActiveConfigPaths().PROJECT_SETTINGS;
  }

  private constructor() {
    // No longer cache paths in constructor - they're now computed dynamically
    // via getters to avoid race conditions with provider initialization
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  /**
   * Reset singleton instance (for testing or when provider changes)
   * This clears the instance and all caches, forcing re-creation on next access
   */
  public static resetInstance(): void {
    if (SettingsManager.instance) {
      SettingsManager.instance.userSettingsCache = null;
      SettingsManager.instance.projectSettingsCache = null;
      SettingsManager.instance.cacheTimestamp = { user: 0, project: 0 };
    }
    SettingsManager.instance = null as unknown as SettingsManager;
  }

  /**
   * Ensure directory exists for a given file path
   */
  private ensureDirectoryExists(filePath: string): void {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Load user settings from ~/.ax-cli/config.json
   */
  public loadUserSettings(): UserSettings {
    // Check cache first
    const now = Date.now();
    if (this.userSettingsCache && (now - this.cacheTimestamp.user) < this.CACHE_TTL) {
      return this.userSettingsCache;
    }

    try {
      if (!existsSync(this.userSettingsPath)) {
        // Create default user settings if file doesn't exist
        this.saveUserSettings(DEFAULT_USER_SETTINGS);
        const defaultSettings = { ...DEFAULT_USER_SETTINGS };
        // Update cache after creating file
        this.userSettingsCache = defaultSettings;
        this.cacheTimestamp.user = Date.now();
        return defaultSettings;
      }

      // Use json-utils for consistent JSON handling
      const parseResult = parseJsonFile<UserSettings>(
        this.userSettingsPath,
        UserSettingsSchema
      );

      if (!parseResult.success) {
        const logger = getLogger();
        logger.warn("Failed to load user settings", { error: parseResult.error });
        const defaultSettings = { ...DEFAULT_USER_SETTINGS };
        // Cache defaults even on parse failure to avoid repeated file reads
        this.userSettingsCache = defaultSettings;
        this.cacheTimestamp.user = Date.now();
        return defaultSettings;
      }

      // REQ-SEC-003: Handle API key encryption migration
      // Priority: apiKeyEncrypted > apiKey (plain-text)
      let decryptedApiKey: string | undefined;

      if (parseResult.data.apiKeyEncrypted) {
        // Already encrypted - decrypt it
        try {
          decryptedApiKey = decrypt(parseResult.data.apiKeyEncrypted);
        } catch (error) {
          const logger = getLogger();
          logger.error('Failed to decrypt API key', { error: error instanceof Error ? error.message : 'Unknown error' });
          // Fall back to plain-text if decryption fails
          if (parseResult.data.apiKey && typeof parseResult.data.apiKey === 'string') {
            decryptedApiKey = parseResult.data.apiKey;
          }
        }
      } else if (parseResult.data.apiKey && typeof parseResult.data.apiKey === 'string') {
        // Plain-text API key found - needs migration
        decryptedApiKey = parseResult.data.apiKey;

        // Migrate to encrypted format
        const logger = getLogger();
        logger.info('Detected plain-text API key - migrating to encrypted format');
        try {
          if (!decryptedApiKey) {
            throw new Error('API key is empty');
          }
          const encrypted = encrypt(decryptedApiKey);

          // Update the config file: add apiKeyEncrypted, remove apiKey
          const migratedConfig = {
            ...parseResult.data,
            apiKeyEncrypted: encrypted,
            apiKey: undefined, // Clear plain-text field
          };

          // Save the migrated config
          const writeResult = writeJsonFile(
            this.userSettingsPath,
            migratedConfig,
            UserSettingsSchema,
            true // pretty
          );

          if (writeResult.success) {
            logger.info('API key encrypted and saved successfully');
          } else {
            logger.warn('Failed to save encrypted API key', { error: writeResult.error });
          }
        } catch (error) {
          logger.warn('Failed to encrypt API key', { error: error instanceof Error ? error.message : 'Unknown error' });
          // Continue with plain-text for now, will retry on next load
        }
      }

      // Build settings object with decrypted API key
      const settings = {
        ...DEFAULT_USER_SETTINGS,
        ...parseResult.data,
        apiKey: decryptedApiKey, // Always use decrypted value in memory
        apiKeyEncrypted: undefined, // Don't keep encrypted version in memory
      };

      this.userSettingsCache = settings;
      this.cacheTimestamp.user = Date.now();
      return settings;
    } catch (error) {
      const logger = getLogger();
      logger.warn("Failed to load user settings", {
        error: error instanceof Error ? error.message : "Unknown error"
      });
      const defaultSettings = { ...DEFAULT_USER_SETTINGS };
      this.userSettingsCache = defaultSettings;
      this.cacheTimestamp.user = Date.now();
      return defaultSettings;
    }
  }

  /**
   * Save user settings to ~/.ax-cli/config.json
   */
  public saveUserSettings(settings: Partial<UserSettings>): void {
    try {
      this.ensureDirectoryExists(this.userSettingsPath);

      // Read existing settings directly to avoid recursion
      let existingSettings: UserSettings = { ...DEFAULT_USER_SETTINGS };
      if (existsSync(this.userSettingsPath)) {
        const parseResult = parseJsonFile<UserSettings>(this.userSettingsPath);
        if (parseResult.success) {
          // Decrypt API key if encrypted, but only if caller isn't providing a new one
          // If caller provides new apiKey, we don't need to preserve the old one
          let apiKey: string | undefined;
          if (settings.apiKey) {
            // Caller is providing a new API key - use that instead of old one
            apiKey = undefined; // Will be overwritten by settings.apiKey in merge
          } else if (parseResult.data.apiKeyEncrypted) {
            try {
              apiKey = decrypt(parseResult.data.apiKeyEncrypted);
            } catch (error) {
              // CRITICAL: Don't continue if we can't decrypt existing data - fail fast to prevent data loss
              throw new Error(`Cannot save settings: failed to decrypt existing API key. This would result in data loss. ${extractErrorMessage(error)}`);
            }
          } else if (parseResult.data.apiKey) {
            apiKey = parseResult.data.apiKey as string;
          }

          existingSettings = {
            ...DEFAULT_USER_SETTINGS,
            ...parseResult.data,
            apiKey, // Use decrypted value (or undefined if caller provides new key)
            apiKeyEncrypted: undefined, // Don't keep encrypted in memory
          };
        } else {
          // If file is corrupted, throw error instead of silently discarding user data
          throw new Error(`Cannot save settings: existing file is corrupted. ${parseResult.error || 'Unknown parse error'}`);
        }
      }

      const mergedSettings = { ...existingSettings, ...settings };

      // REQ-SEC-003: Encrypt API key into apiKeyEncrypted field
      const settingsToSave = { ...mergedSettings };

      if (settingsToSave.apiKey) {
        // Encrypt the API key
        settingsToSave.apiKeyEncrypted = encrypt(settingsToSave.apiKey);
        // Clear the plain-text field
        delete settingsToSave.apiKey;
      }

      // Use json-utils for consistent writing with schema validation
      const writeResult = writeJsonFile(
        this.userSettingsPath,
        settingsToSave,
        UserSettingsSchema, // validate before writing
        true // pretty
      );

      if (!writeResult.success) {
        throw new Error(`Failed to write settings: ${writeResult.error}`);
      }

      // Set secure permissions for API key
      chmodSync(this.userSettingsPath, 0o600);

      // Update cache with new settings instead of invalidating
      // This improves performance and prevents race conditions
      this.userSettingsCache = mergedSettings;
      this.cacheTimestamp.user = Date.now();
    } catch (error) {
      const logger = getLogger();
      logger.error("Failed to save user settings", {
        error: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
  }

  /**
   * Update a specific user setting
   */
  public updateUserSetting<K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ): void {
    const settings = { [key]: value } as Partial<UserSettings>;
    this.saveUserSettings(settings);
  }

  /**
   * Get a specific user setting
   */
  public getUserSetting<K extends keyof UserSettings>(key: K): UserSettings[K] {
    const settings = this.loadUserSettings();
    return settings[key];
  }

  /**
   * Load project settings from .ax-cli/settings.json
   */
  public loadProjectSettings(): ProjectSettings {
    // Check cache first
    const now = Date.now();
    if (this.projectSettingsCache && (now - this.cacheTimestamp.project) < this.CACHE_TTL) {
      return this.projectSettingsCache;
    }

    try {
      if (!existsSync(this.projectSettingsPath)) {
        // Create default project settings if file doesn't exist
        this.saveProjectSettings(DEFAULT_PROJECT_SETTINGS);
        const defaultSettings = { ...DEFAULT_PROJECT_SETTINGS };
        // Update cache after creating file
        this.projectSettingsCache = defaultSettings;
        this.cacheTimestamp.project = Date.now();
        return defaultSettings;
      }

      // Use json-utils for consistent JSON handling
      const parseResult = parseJsonFile<ProjectSettings>(
        this.projectSettingsPath,
        ProjectSettingsSchema
      );

      if (!parseResult.success) {
        const logger = getLogger();
        logger.warn("Failed to load project settings", { error: parseResult.error });
        const defaultSettings = { ...DEFAULT_PROJECT_SETTINGS };
        // Cache defaults even on parse failure to avoid repeated file reads
        this.projectSettingsCache = defaultSettings;
        this.cacheTimestamp.project = Date.now();
        return defaultSettings;
      }

      // Merge with defaults
      const settings = { ...DEFAULT_PROJECT_SETTINGS, ...parseResult.data };
      this.projectSettingsCache = settings;
      this.cacheTimestamp.project = Date.now();
      return settings;
    } catch (error) {
      const logger = getLogger();
      logger.warn("Failed to load project settings", {
        error: error instanceof Error ? error.message : "Unknown error"
      });
      const defaultSettings = { ...DEFAULT_PROJECT_SETTINGS };
      this.projectSettingsCache = defaultSettings;
      this.cacheTimestamp.project = Date.now();
      return defaultSettings;
    }
  }

  /**
   * Save project settings to .ax-cli/settings.json
   */
  public saveProjectSettings(settings: Partial<ProjectSettings>): void {
    try {
      this.ensureDirectoryExists(this.projectSettingsPath);

      // Read existing settings directly to avoid recursion
      let existingSettings: ProjectSettings = { ...DEFAULT_PROJECT_SETTINGS };
      if (existsSync(this.projectSettingsPath)) {
        const parseResult = parseJsonFile<ProjectSettings>(this.projectSettingsPath);
        if (parseResult.success) {
          existingSettings = { ...DEFAULT_PROJECT_SETTINGS, ...parseResult.data };
        } else {
          // BUG FIX: Throw error on corruption instead of silently discarding data
          // This is consistent with saveUserSettings behavior and prevents data loss
          throw new Error(`Cannot save settings: existing project settings file is corrupted. ${parseResult.error || 'Unknown parse error'}`);
        }
      }

      const mergedSettings = { ...existingSettings, ...settings };

      // Use json-utils for consistent writing with schema validation
      const writeResult = writeJsonFile(
        this.projectSettingsPath,
        mergedSettings,
        ProjectSettingsSchema, // validate before writing
        true // pretty
      );

      if (!writeResult.success) {
        throw new Error(`Failed to write settings: ${writeResult.error}`);
      }

      // Update cache with new settings instead of invalidating
      // This improves performance and prevents race conditions
      this.projectSettingsCache = mergedSettings;
      this.cacheTimestamp.project = Date.now();
    } catch (error) {
      const logger = getLogger();
      logger.error("Failed to save project settings", {
        error: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
  }

  /**
   * Update a specific project setting
   */
  public updateProjectSetting<K extends keyof ProjectSettings>(
    key: K,
    value: ProjectSettings[K]
  ): void {
    const settings = { [key]: value } as Partial<ProjectSettings>;
    this.saveProjectSettings(settings);
  }

  /**
   * Get a specific project setting
   */
  public getProjectSetting<K extends keyof ProjectSettings>(
    key: K
  ): ProjectSettings[K] {
    const settings = this.loadProjectSettings();
    return settings[key];
  }

  /**
   * Phase 3: Get paste settings with proper defaults
   * Priority: Project settings > User settings > Schema defaults
   * v3.8.0: Now includes bracketed paste mode settings
   */
  public getPasteSettings() {
    const userPaste = this.getUserSetting("paste");
    const projectPaste = this.getProjectSetting("paste");
    const merged = { ...(userPaste || {}), ...(projectPaste || {}) };

    return {
      allowLargePaste: merged.allowLargePaste ?? true,  // Changed to true - allow large pastes by default
      maxPasteLength: merged.maxPasteLength ?? 50000,   // Increased from 5000 to 50000
      warningThreshold: merged.warningThreshold ?? 10000, // Increased from 1000 to 10000
      // v3.8.0: Bracketed paste mode settings
      enableBracketedPaste: merged.enableBracketedPaste ?? true,
      showPasteIndicator: merged.showPasteIndicator ?? true,
      maxPasteSize: merged.maxPasteSize ?? (100 * 1024 * 1024),
      pasteTimeout: merged.pasteTimeout ?? 30000,
      enableFallback: merged.enableFallback ?? true,
    };
  }

  /**
   * Get the current model with proper fallback logic:
   * 1. Project-specific model setting
   * 2. User's default model
   * 3. Undefined (user must configure)
   */
  public getCurrentModel(): string | undefined {
    const projectModel = this.getProjectSetting("model");
    if (projectModel) {
      return projectModel;
    }

    const userDefaultModel = this.getUserSetting("defaultModel");
    if (userDefaultModel) {
      return userDefaultModel;
    }

    return undefined; // No hardcoded fallback - user must run setup
  }

  /**
   * Get current vision model for image analysis tasks
   * Priority: project setting > user setting > provider default
   */
  public getVisionModel(): string | undefined {
    // Check project-level override first
    const projectVisionModel = this.getProjectSetting("visionModel");
    if (projectVisionModel) {
      return projectVisionModel;
    }

    // Then check user setting
    const userVisionModel = this.getUserSetting("visionModel");
    if (userVisionModel) {
      return userVisionModel;
    }

    // Fall back to provider default
    const provider = getActiveProvider();
    return provider?.defaultVisionModel;
  }

  /**
   * Set the vision model for the user
   */
  public setVisionModel(model: string): void {
    const result = ModelIdSchema.safeParse(model);
    if (!result.success) {
      throw new Error(`Invalid model ID: ${model}. ${result.error.message}`);
    }
    this.updateUserSetting("visionModel", result.data);
  }

  /**
   * Set the current model for the project
   */
  public setCurrentModel(model: string): void {
    const result = ModelIdSchema.safeParse(model);
    if (!result.success) {
      throw new Error(`Invalid model ID: ${model}. ${result.error.message}`);
    }
    this.updateProjectSetting("model", result.data);
  }

  /**
   * Get available models list from user settings
   */
  public getAvailableModels(): string[] {
    const models = this.getUserSetting("models");
    return models || [];
  }

  /**
   * Get API key from user settings or environment
   * Checks provider-specific env vars (e.g., ZAI_API_KEY for GLM, XAI_API_KEY for Grok)
   */
  public getApiKey(): string | undefined {
    // First check provider-specific environment variables
    const provider = getActiveProvider();
    const envApiKey = getApiKeyFromEnv(provider);
    if (envApiKey) {
      return envApiKey;
    }

    // Then check user settings
    return this.getUserSetting("apiKey");
  }

  /**
   * Get base URL from user settings or environment
   */
  public getBaseURL(): string | undefined {
    // First check environment variable
    const envBaseURL = process.env.AI_BASE_URL;
    if (envBaseURL) {
      return envBaseURL;
    }

    // Then check user settings
    const userBaseURL = this.getUserSetting("baseURL");
    return userBaseURL; // No hardcoded fallback - user must run setup
  }

  /**
   * Get sampling settings with proper fallback logic:
   * 1. Environment variables (AI_DO_SAMPLE, AI_SEED, AI_TOP_P)
   * 2. Project-specific sampling settings
   * 3. User's default sampling settings
   * 4. Undefined (default behavior - sampling enabled)
   *
   * @returns Merged sampling settings or undefined for default behavior
   */
  public getSamplingSettings(): SamplingSettings | undefined {
    // Start with user settings as base
    const userSampling = this.getUserSetting("sampling");
    const projectSampling = this.getProjectSetting("sampling");

    // Merge project settings over user settings
    const baseSampling: Record<string, unknown> = { ...(userSampling || {}), ...(projectSampling || {}) };

    // Environment variables take highest priority
    const envDoSample = process.env.AI_DO_SAMPLE;
    const envSeed = process.env.AI_SEED;
    const envTopP = process.env.AI_TOP_P;

    const result: { doSample?: boolean; seed?: number; topP?: number } = { ...baseSampling } as { doSample?: boolean; seed?: number; topP?: number };

    if (envDoSample !== undefined) {
      result.doSample = envDoSample.toLowerCase() === "true";
    }

    if (envSeed !== undefined) {
      const seedNum = parseInt(envSeed, 10);
      if (Number.isFinite(seedNum) && seedNum >= 0) {
        result.seed = seedNum;
      }
    }

    if (envTopP !== undefined) {
      const topPNum = parseFloat(envTopP);
      if (Number.isFinite(topPNum) && topPNum >= 0 && topPNum <= 1) {
        result.topP = topPNum;
      }
    }

    // Return undefined if no settings were configured (use defaults)
    if (Object.keys(result).length === 0) {
      return undefined;
    }

    return result;
  }

  /**
   * Check if deterministic mode is enabled
   * Returns true if do_sample is explicitly set to false
   */
  public isDeterministicMode(): boolean {
    const sampling = this.getSamplingSettings();
    return sampling?.doSample === false;
  }

  /**
   * Get thinking settings with proper fallback logic:
   * 1. Environment variable (AI_THINK)
   * 2. Project-specific thinking settings
   * 3. User's default thinking settings
   * 4. Undefined (default behavior - thinking disabled)
   *
   * @returns Thinking settings or undefined for default behavior
   */
  public getThinkingSettings(): ThinkingSettings | undefined {
    // Start with user settings as base
    const userThinking = this.getUserSetting("thinking");
    const projectThinking = this.getProjectSetting("thinking");

    // Merge project settings over user settings
    const baseThinking: Record<string, unknown> = { ...(userThinking || {}), ...(projectThinking || {}) };

    // Environment variable takes highest priority
    const envThink = process.env.AI_THINK;

    const result: { enabled?: boolean } = { ...baseThinking } as { enabled?: boolean };

    if (envThink !== undefined) {
      result.enabled = envThink.toLowerCase() === "true";
    }

    // Return undefined if no settings were configured (use defaults)
    if (Object.keys(result).length === 0) {
      return undefined;
    }

    return result;
  }

  /**
   * Get merged agent-first settings with priority:
   * 1. Project settings (highest priority)
   * 2. User settings
   * 3. Defaults (enabled: true, confidenceThreshold: 0.6)
   */
  public getAgentFirstSettings(): {
    enabled: boolean;
    confidenceThreshold: number;
    showAgentIndicator: boolean;
    defaultAgent: string | null;
    excludedAgents: string[];
  } {
    const userSettings = this.getUserSetting("agentFirst");
    const projectSettings = this.getProjectSetting("agentFirst");

    // Merge with project settings taking priority
    const merged = { ...(userSettings || {}), ...(projectSettings || {}) } as Record<string, unknown>;

    return {
      enabled: (merged.enabled as boolean) ?? true,
      confidenceThreshold: (merged.confidenceThreshold as number) ?? 0.6,
      showAgentIndicator: (merged.showAgentIndicator as boolean) ?? true,
      defaultAgent: (merged.defaultAgent as string | null) ?? 'standard',
      excludedAgents: (merged.excludedAgents as string[]) ?? [],
    };
  }

  /**
   * Get the actual user settings path being used
   */
  public getUserSettingsPath(): string {
    return this.userSettingsPath;
  }

  /**
   * Get the actual project settings path being used
   */
  public getProjectSettingsPath(): string {
    return this.projectSettingsPath;
  }

  // ==================== Phase 1: Input Configuration ====================

  /**
   * Get input configuration with proper defaults
   * Priority: User settings > Schema defaults
   */
  public getInputConfig(): RequiredInputSettings {
    const userSettings = this.loadUserSettings();
    // Use non-null assertion since we know INPUT_DEFAULTS is always defined
    const defaults = SettingsManager.INPUT_DEFAULTS!;

    // Return schema defaults if no user config exists
    if (!userSettings.input) {
      return {
        ...defaults,
        smartDetection: { ...defaults.smartDetection },
      };
    }

    // Merge user config with defaults
    return {
      enterBehavior: userSettings.input.enterBehavior || defaults.enterBehavior,
      submitKeys: userSettings.input.submitKeys || defaults.submitKeys,
      multilineIndicator: userSettings.input.multilineIndicator || defaults.multilineIndicator,
      smartDetection: {
        enabled: userSettings.input.smartDetection?.enabled ?? defaults.smartDetection.enabled,
        checkBrackets: userSettings.input.smartDetection?.checkBrackets ?? defaults.smartDetection.checkBrackets,
        checkOperators: userSettings.input.smartDetection?.checkOperators ?? defaults.smartDetection.checkOperators,
        checkStatements: userSettings.input.smartDetection?.checkStatements ?? defaults.smartDetection.checkStatements,
      },
    };
  }

  /**
   * Update input configuration
   * Merges with existing config and saves to user settings
   */
  public updateInputConfig(config: Partial<InputSettings>): void {
    const userSettings = this.loadUserSettings();
    const currentConfig = this.getInputConfig();

    // Deep merge for nested smartDetection object
    // BUG FIX: Use optional chaining instead of non-null assertion on Partial<T> parameter
    const currentSmart = currentConfig?.smartDetection ?? {};
    const configSmart = config?.smartDetection;

    // Spread operator handles the merge cleanly
    const newConfig = {
      ...currentConfig,
      ...config,
      smartDetection: configSmart ? { ...currentSmart, ...configSmart } : currentSmart,
    } as InputSettings;

    this.saveUserSettings({ ...userSettings, input: newConfig });
  }

  // ==================== Phase 1: Shortcuts Configuration ====================

  /**
   * Get shortcuts configuration with proper defaults
   * Priority: User settings > Schema defaults
   */
  public getShortcutsConfig(): RequiredShortcutsSettings {
    const userSettings = this.loadUserSettings();
    const defaults = SettingsManager.SHORTCUTS_DEFAULTS!;

    // Return schema defaults if no user config exists
    if (!userSettings.shortcuts) {
      return { ...defaults, customBindings: { ...defaults.customBindings } };
    }

    // Merge user config with defaults
    return {
      showOnStartup: userSettings.shortcuts.showOnStartup ?? defaults.showOnStartup,
      hintTimeout: userSettings.shortcuts.hintTimeout ?? defaults.hintTimeout,
      customBindings: userSettings.shortcuts.customBindings || {},
    };
  }

  /**
   * Update shortcuts configuration
   * Merges with existing config and saves to user settings
   */
  public updateShortcutsConfig(config: Partial<ShortcutsSettings>): void {
    const userSettings = this.loadUserSettings();
    const currentConfig = this.getShortcutsConfig();

    // Deep merge for nested customBindings object
    // getShortcutsConfig() always returns a valid config with customBindings
    const currentBindings = currentConfig?.customBindings ?? {};
    const configBindings = config?.customBindings;

    // Spread operator handles the merge cleanly
    const newConfig = {
      ...currentConfig,
      ...config,
      customBindings: configBindings ? { ...currentBindings, ...configBindings } : currentBindings,
    } as ShortcutsSettings;

    this.saveUserSettings({ ...userSettings, shortcuts: newConfig });
  }

  // ==================== Phase 1: Paste Configuration ====================

  /**
   * Get paste configuration with proper defaults
   * Priority: User settings > Schema defaults
   */
  public getPasteConfig(): RequiredPasteSettings {
    const userSettings = this.loadUserSettings();
    const defaults = SettingsManager.PASTE_DEFAULTS!;

    // Return schema defaults if no user config exists
    if (!userSettings.paste) {
      return { ...defaults };
    }

    // Merge user config with defaults
    return {
      autoCollapse: userSettings.paste.autoCollapse ?? defaults.autoCollapse,
      collapseThreshold: userSettings.paste.collapseThreshold ?? defaults.collapseThreshold,
      characterThreshold: userSettings.paste.characterThreshold ?? defaults.characterThreshold,
      maxCollapsedBlocks: userSettings.paste.maxCollapsedBlocks ?? defaults.maxCollapsedBlocks,
      showLineCount: userSettings.paste.showLineCount ?? defaults.showLineCount,
      showPreview: userSettings.paste.showPreview ?? defaults.showPreview,
      previewLines: userSettings.paste.previewLines ?? defaults.previewLines,
      enableHistory: userSettings.paste.enableHistory ?? defaults.enableHistory,
      maxHistoryItems: userSettings.paste.maxHistoryItems ?? defaults.maxHistoryItems,
      enableBracketedPaste: userSettings.paste.enableBracketedPaste ?? defaults.enableBracketedPaste,
      showPasteIndicator: userSettings.paste.showPasteIndicator ?? defaults.showPasteIndicator,
      maxPasteSize: userSettings.paste.maxPasteSize ?? defaults.maxPasteSize,
      pasteTimeout: userSettings.paste.pasteTimeout ?? defaults.pasteTimeout,
      enableFallback: userSettings.paste.enableFallback ?? defaults.enableFallback,
    };
  }

  /**
   * Update paste configuration
   * Merges with existing config and saves to user settings
   */
  public updatePasteConfig(config: Partial<PasteSettings>): void {
    const userSettings = this.loadUserSettings();
    const currentConfig = this.getPasteConfig();

    // Spread operator handles the merge cleanly
    const newConfig = {
      ...currentConfig,
      ...config,
    } as PasteSettings;

    this.saveUserSettings({ ...userSettings, paste: newConfig });
  }

  // ==================== UI Configuration (Theme, Verbosity, etc.) ====================

  /** Default UI configuration */
  private static readonly UI_DEFAULTS: Required<UISettings> = {
    verbosityLevel: 'quiet',
    groupToolCalls: true,
    maxGroupSize: 20,
    groupTimeWindow: 500,
    theme: 'default',
  };

  /**
   * Get UI configuration with proper defaults
   * Priority: User settings > Schema defaults
   */
  public getUIConfig(): Required<UISettings> {
    const userSettings = this.loadUserSettings();
    return getConfigWithDefaults(userSettings.ui, SettingsManager.UI_DEFAULTS);
  }

  /** Alias for backward compatibility with older callers/tests */
  public getUISettings(): Required<UISettings> {
    return this.getUIConfig();
  }

  /**
   * Update UI configuration
   * Merges with existing config and saves to user settings
   */
  public updateUIConfig(config: Partial<UISettings>): void {
    const userSettings = this.loadUserSettings();
    const currentConfig = this.getUIConfig();

    const newConfig = {
      ...currentConfig,
      ...config,
    } as UISettings;

    this.saveUserSettings({ ...userSettings, ui: newConfig });
  }

  // ==================== Phase 2: Status Bar Configuration ====================

  /** Default status bar configuration */
  private static readonly STATUS_BAR_DEFAULTS: Required<StatusBarSettings> = {
    enabled: true,
    compact: true,
    showCost: true,
    showTokens: true,
    showContext: true,
    showSession: true,
    showModes: true,
    updateInterval: 1000,
    position: 'top',
  };

  /**
   * Get status bar configuration with proper defaults
   * Priority: User settings > Schema defaults
   */
  public getStatusBarConfig(): Required<StatusBarSettings> {
    const userSettings = this.loadUserSettings();
    return getConfigWithDefaults(userSettings.statusBar, SettingsManager.STATUS_BAR_DEFAULTS);
  }

  /**
   * Update status bar configuration
   * Merges with existing config and saves to user settings
   */
  public updateStatusBarConfig(config: Partial<StatusBarSettings>): void {
    const userSettings = this.loadUserSettings();
    const currentConfig = this.getStatusBarConfig();

    // Spread operator handles the merge cleanly
    const newConfig = {
      ...currentConfig,
      ...config,
    } as StatusBarSettings;

    this.saveUserSettings({ ...userSettings, statusBar: newConfig });
  }

  // ==================== Phase 2: Auto-accept Configuration ====================

  /**
   * Get auto-accept configuration with proper defaults
   * Priority: User settings > Schema defaults
   */
  public getAutoAcceptConfig(): AutoAcceptSettings {
    const userSettings = this.loadUserSettings();
    const defaults = SettingsManager.AUTO_ACCEPT_DEFAULTS!;
    const defaultAuditLog = defaults.auditLog!; // We know auditLog is defined in our defaults

    // Return schema defaults if no user config exists
    if (!userSettings.autoAccept) {
      return { ...defaults, auditLog: { ...defaultAuditLog } };
    }

    // Merge user config with defaults
    return {
      enabled: userSettings.autoAccept.enabled ?? defaults.enabled,
      persistAcrossSessions: userSettings.autoAccept.persistAcrossSessions ?? defaults.persistAcrossSessions,
      alwaysConfirm: userSettings.autoAccept.alwaysConfirm || defaults.alwaysConfirm,
      scope: userSettings.autoAccept.scope ?? defaults.scope,
      auditLog: {
        enabled: userSettings.autoAccept.auditLog?.enabled ?? defaultAuditLog.enabled,
        maxEntries: userSettings.autoAccept.auditLog?.maxEntries ?? defaultAuditLog.maxEntries,
        filepath: userSettings.autoAccept.auditLog?.filepath,
      },
    };
  }

  /** Alias to maintain compatibility */
  public getAutoAcceptSettings(): AutoAcceptSettings {
    return this.getAutoAcceptConfig();
  }

  /**
   * Update auto-accept configuration
   * Merges with existing config and saves to user settings
   */
  public updateAutoAcceptConfig(config: Partial<AutoAcceptSettings>): void {
    if (!config) return; // Early exit if no config provided

    const userSettings = this.loadUserSettings();
    const currentConfig = this.getAutoAcceptConfig();

    // Deep merge for nested auditLog object
    // Note: currentConfig.auditLog is guaranteed by getAutoAcceptConfig() defaults
    const currentAuditLog = currentConfig?.auditLog ?? {
      enabled: false,
      path: '.ax-cli/audit.log',
      maxSize: 10,
      retentionDays: 30,
    };
    const configAuditLog = config?.auditLog;

    // Spread operator handles the merge cleanly
    const newConfig = {
      ...currentConfig,
      ...config,
      auditLog: configAuditLog ? { ...currentAuditLog, ...configAuditLog } : currentAuditLog,
    } as AutoAcceptSettings;

    this.saveUserSettings({ ...userSettings, autoAccept: newConfig });
  }

  // ==================== Phase 2: External Editor Configuration ====================

  /** Default external editor configuration */
  private static readonly EXTERNAL_EDITOR_DEFAULTS: ExternalEditorSettings = {
    enabled: true,
    editor: undefined,
    shortcut: 'ctrl+g',
    tempDir: undefined,
    confirmBeforeSubmit: true,
    syntaxHighlighting: true,
  };

  /**
   * Get external editor configuration with proper defaults
   * Priority: User settings > Schema defaults
   */
  public getExternalEditorConfig(): ExternalEditorSettings {
    const userSettings = this.loadUserSettings();
    return getConfigWithDefaults(userSettings.externalEditor, SettingsManager.EXTERNAL_EDITOR_DEFAULTS);
  }

  /**
   * Update external editor configuration
   * Merges with existing config and saves to user settings
   */
  public updateExternalEditorConfig(config: Partial<ExternalEditorSettings>): void {
    const userSettings = this.loadUserSettings();
    const currentConfig = this.getExternalEditorConfig();

    // Spread operator handles the merge cleanly
    const newConfig = {
      ...currentConfig,
      ...config,
    } as ExternalEditorSettings;

    this.saveUserSettings({ ...userSettings, externalEditor: newConfig });
  }

  // ==================== Phase 2: Thinking Mode Configuration ====================

  /** Default thinking mode configuration */
  private static readonly THINKING_MODE_DEFAULTS: ThinkingModeSettings = {
    enabled: false,
    quickToggle: true,
    showInStatusBar: true,
    budgetTokens: undefined,
  };

  /**
   * Get thinking mode configuration with proper defaults
   * Priority: User settings > Schema defaults
   */
  public getThinkingModeConfig(): ThinkingModeSettings {
    const userSettings = this.loadUserSettings();
    return getConfigWithDefaults(userSettings.thinkingMode, SettingsManager.THINKING_MODE_DEFAULTS);
  }

  /**
   * Update thinking mode configuration
   * Merges with existing config and saves to user settings
   */
  public updateThinkingModeConfig(config: Partial<ThinkingModeSettings>): void {
    const userSettings = this.loadUserSettings();
    const currentConfig = this.getThinkingModeConfig();

    // Spread operator handles the merge cleanly
    const newConfig = {
      ...currentConfig,
      ...config,
    } as ThinkingModeSettings;

    this.saveUserSettings({ ...userSettings, thinkingMode: newConfig });
  }

  // ==================== Auto-Update Configuration ====================

  /** Default auto-update configuration */
  private static readonly AUTO_UPDATE_DEFAULTS: AutoUpdateSettings = {
    enabled: true,
    checkIntervalHours: 24,
    lastCheckTimestamp: undefined,
    autoInstall: false,
  };

  /**
   * Get auto-update configuration with proper defaults
   * Priority: User settings > Schema defaults
   */
  public getAutoUpdateConfig(): AutoUpdateSettings {
    const userSettings = this.loadUserSettings();
    return getConfigWithDefaults(userSettings.autoUpdate, SettingsManager.AUTO_UPDATE_DEFAULTS);
  }

  /**
   * Update auto-update configuration
   * Merges with existing config and saves to user settings
   */
  public updateAutoUpdateConfig(config: Partial<AutoUpdateSettings>): void {
    const userSettings = this.loadUserSettings();
    const currentConfig = this.getAutoUpdateConfig();

    // Spread operator handles the merge cleanly
    const newConfig = {
      ...currentConfig,
      ...config,
    } as AutoUpdateSettings;

    this.saveUserSettings({ ...userSettings, autoUpdate: newConfig });
  }

  /**
   * Check if enough time has passed since the last update check
   * @returns true if an update check should be performed
   */
  public shouldCheckForUpdates(): boolean {
    const config = this.getAutoUpdateConfig();

    // If config is undefined, use defaults (enabled by default)
    if (!config) {
      return true;
    }

    // Auto-update disabled
    if (config.enabled === false) {
      return false;
    }

    // No interval set (always check)
    if (config.checkIntervalHours === 0) {
      return true;
    }

    // No previous check recorded
    if (!config.lastCheckTimestamp) {
      return true;
    }

    // Check if enough time has passed
    const lastCheck = new Date(config.lastCheckTimestamp).getTime();

    // If lastCheckTimestamp is invalid, check for updates
    if (Number.isNaN(lastCheck)) {
      return true;
    }

    const now = Date.now();
    const intervalMs = (config.checkIntervalHours ?? 24) * 60 * 60 * 1000;

    return (now - lastCheck) >= intervalMs;
  }

  /**
   * Record that an update check was performed
   * Silently fails if settings cannot be saved
   */
  public recordUpdateCheck(): void {
    try {
      this.updateAutoUpdateConfig({
        lastCheckTimestamp: new Date().toISOString(),
      });
    } catch {
      // Silently ignore - don't crash CLI if we can't save timestamp
    }
  }

  /**
   * Delete the user settings file (for --force flag in setup)
   * Returns true if file was deleted or didn't exist
   */
  public deleteUserSettings(): boolean {
    const { unlinkSync } = require('fs');
    try {
      if (existsSync(this.userSettingsPath)) {
        unlinkSync(this.userSettingsPath);
        // Clear cache after deletion
        this.userSettingsCache = null;
        this.cacheTimestamp.user = 0;
        return true;
      }
      return true; // File didn't exist, which is fine
    } catch (error) {
      const logger = getLogger();
      logger.error("Failed to delete user settings", {
        error: error instanceof Error ? error.message : "Unknown error",
        path: this.userSettingsPath,
      });
      return false;
    }
  }

  /**
   * Migrate/repair user settings by adding missing fields with defaults
   * This ensures existing configs get updated with new schema fields
   * @returns Object describing what was migrated
   */
  public migrateUserSettings(): { migrated: boolean; addedFields: string[] } {
    const addedFields: string[] = [];

    try {
      // Load current settings (will create defaults if file doesn't exist)
      const currentSettings = this.loadUserSettings();

      // Define all settings that should have defaults
      const defaultConfigs: Record<string, unknown> = {
        // UI settings
        ui: SettingsManager.UI_DEFAULTS,
        // Input settings
        input: SettingsManager.INPUT_DEFAULTS,
        // Shortcuts settings
        shortcuts: SettingsManager.SHORTCUTS_DEFAULTS,
        // Paste settings
        paste: SettingsManager.PASTE_DEFAULTS,
        // Status bar settings
        statusBar: SettingsManager.STATUS_BAR_DEFAULTS,
        // Auto-accept settings
        autoAccept: SettingsManager.AUTO_ACCEPT_DEFAULTS,
        // External editor settings
        externalEditor: SettingsManager.EXTERNAL_EDITOR_DEFAULTS,
        // Thinking mode settings
        thinkingMode: SettingsManager.THINKING_MODE_DEFAULTS,
        // Auto-update settings
        autoUpdate: SettingsManager.AUTO_UPDATE_DEFAULTS,
      };

      // Check each default config and add if missing
      const updatedSettings: Partial<UserSettings> = {};

      for (const [key, defaultValue] of Object.entries(defaultConfigs)) {
        const typedKey = key as keyof UserSettings;
        const currentValue = currentSettings[typedKey];
        if (currentValue === undefined) {
          // Use type assertion to bypass strict type checking
          (updatedSettings as Record<string, unknown>)[key] = defaultValue;
          addedFields.push(key);
        }
      }

      // If any fields were added, save the updated settings
      if (addedFields.length > 0) {
        this.saveUserSettings(updatedSettings);
        const logger = getLogger();
        logger.info("Migrated user settings", { addedFields });
      }

      return { migrated: addedFields.length > 0, addedFields };
    } catch (error) {
      const logger = getLogger();
      logger.error("Failed to migrate user settings", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { migrated: false, addedFields: [] };
    }
  }

  /**
   * Check if user settings file exists and has required fields
   * @returns Object with validation status
   */
  public validateUserSettings(): {
    exists: boolean;
    isValid: boolean;
    missingFields: string[];
    hasApiKey: boolean;
    hasBaseURL: boolean;
    hasModel: boolean;
  } {
    const missingFields: string[] = [];
    let hasApiKey = false;
    let hasBaseURL = false;
    let hasModel = false;

    if (!existsSync(this.userSettingsPath)) {
      return {
        exists: false,
        isValid: false,
        missingFields: ['all'],
        hasApiKey: false,
        hasBaseURL: false,
        hasModel: false,
      };
    }

    try {
      const settings = this.loadUserSettings();

      // Check critical fields
      hasApiKey = !!(settings.apiKey || settings.apiKeyEncrypted);
      hasBaseURL = !!settings.baseURL;
      hasModel = !!(settings.defaultModel || settings.currentModel);

      if (!hasApiKey) missingFields.push('apiKey');
      if (!hasBaseURL) missingFields.push('baseURL');
      if (!hasModel) missingFields.push('defaultModel');

      // Check optional fields that should have defaults
      if (!settings.ui) missingFields.push('ui');
      if (!settings.input) missingFields.push('input');
      if (!settings.shortcuts) missingFields.push('shortcuts');
      if (!settings.paste) missingFields.push('paste');
      if (!settings.statusBar) missingFields.push('statusBar');
      if (!settings.autoAccept) missingFields.push('autoAccept');
      if (!settings.externalEditor) missingFields.push('externalEditor');
      if (!settings.thinkingMode) missingFields.push('thinkingMode');
      if (!settings.autoUpdate) missingFields.push('autoUpdate');

      return {
        exists: true,
        isValid: hasApiKey && hasBaseURL && hasModel,
        missingFields,
        hasApiKey,
        hasBaseURL,
        hasModel,
      };
    } catch (error) {
      return {
        exists: true,
        isValid: false,
        missingFields: ['parse_error'],
        hasApiKey: false,
        hasBaseURL: false,
        hasModel: false,
      };
    }
  }
}

/**
 * Convenience function to get the singleton instance
 */
export function getSettingsManager(): SettingsManager {
  return SettingsManager.getInstance();
}
