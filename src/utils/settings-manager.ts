import { existsSync, mkdirSync, chmodSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";
import { UserSettingsSchema, ProjectSettingsSchema } from "../schemas/settings-schemas.js";
import type { UserSettings, ProjectSettings } from "../schemas/settings-schemas.js";
import { ModelIdSchema } from '@ax-cli/schemas';
import { parseJsonFile, writeJsonFile } from "./json-utils.js";

// Re-export types for external use
export type { UserSettings, ProjectSettings };

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

  private userSettingsPath: string;
  private projectSettingsPath: string;

  // Cache for settings to avoid repeated file I/O
  private userSettingsCache: UserSettings | null = null;
  private projectSettingsCache: ProjectSettings | null = null;
  private cacheTimestamp = {
    user: 0,
    project: 0
  };
  private readonly CACHE_TTL = 5000; // 5 seconds TTL for cache

  private constructor() {
    // User settings path: ~/.ax-cli/config.json
    this.userSettingsPath = join(homedir(), ".ax-cli", "config.json");

    // Project settings path: .ax-cli/settings.json
    this.projectSettingsPath = join(process.cwd(), ".ax-cli", "settings.json");
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
        console.warn(
          "Failed to load user settings:",
          parseResult.error
        );
        const defaultSettings = { ...DEFAULT_USER_SETTINGS };
        // Cache defaults even on parse failure to avoid repeated file reads
        this.userSettingsCache = defaultSettings;
        this.cacheTimestamp.user = Date.now();
        return defaultSettings;
      }

      // Merge with defaults to ensure all required fields exist
      const settings = { ...DEFAULT_USER_SETTINGS, ...parseResult.data };
      this.userSettingsCache = settings;
      this.cacheTimestamp.user = Date.now();
      return settings;
    } catch (error) {
      console.warn(
        "Failed to load user settings:",
        error instanceof Error ? error.message : "Unknown error"
      );
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
          existingSettings = { ...DEFAULT_USER_SETTINGS, ...parseResult.data };
        } else {
          // If file is corrupted, use defaults
          console.warn("Corrupted user settings file, using defaults");
        }
      }

      const mergedSettings = { ...existingSettings, ...settings };

      // Use json-utils for consistent writing
      const writeResult = writeJsonFile(
        this.userSettingsPath,
        mergedSettings,
        undefined, // no schema
        true // pretty
      );

      if (!writeResult.success) {
        throw new Error(`Failed to write settings: ${writeResult.error}`);
      }

      // Set secure permissions for API key
      chmodSync(this.userSettingsPath, 0o600);

      // Invalidate cache after save
      this.userSettingsCache = null;
      this.cacheTimestamp.user = 0;
    } catch (error) {
      console.error(
        "Failed to save user settings:",
        error instanceof Error ? error.message : "Unknown error"
      );
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
        console.warn(
          "Failed to load project settings:",
          parseResult.error
        );
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
      console.warn(
        "Failed to load project settings:",
        error instanceof Error ? error.message : "Unknown error"
      );
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
          // If file is corrupted, use defaults
          console.warn("Corrupted project settings file, using defaults");
        }
      }

      const mergedSettings = { ...existingSettings, ...settings };

      // Use json-utils for consistent writing
      const writeResult = writeJsonFile(
        this.projectSettingsPath,
        mergedSettings,
        undefined, // no schema
        true // pretty
      );

      if (!writeResult.success) {
        throw new Error(`Failed to write settings: ${writeResult.error}`);
      }

      // Invalidate cache after save
      this.projectSettingsCache = null;
      this.cacheTimestamp.project = 0;
    } catch (error) {
      console.error(
        "Failed to save project settings:",
        error instanceof Error ? error.message : "Unknown error"
      );
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
   */
  public getApiKey(): string | undefined {
    // First check environment variable
    const envApiKey = process.env.YOUR_API_KEY;
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
}

/**
 * Convenience function to get the singleton instance
 */
export function getSettingsManager(): SettingsManager {
  return SettingsManager.getInstance();
}
