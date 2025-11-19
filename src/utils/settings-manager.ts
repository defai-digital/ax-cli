import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { UserSettingsSchema, ProjectSettingsSchema } from "../schemas/settings-schemas.js";
import type { UserSettings, ProjectSettings } from "../schemas/settings-schemas.js";
import { ModelIdSchema } from '@ax-cli/schemas';

// Re-export types for external use
export type { UserSettings, ProjectSettings };

/**
 * Default values for user settings
 */
const DEFAULT_USER_SETTINGS: Partial<UserSettings> = {
  baseURL: "https://api.x.ai/v1",
  defaultModel: ModelIdSchema.parse("grok-code-fast-1"),
  models: [
    ModelIdSchema.parse("grok-code-fast-1"),
    ModelIdSchema.parse("grok-4-latest"),
    ModelIdSchema.parse("grok-3-latest"),
    ModelIdSchema.parse("grok-3-fast"),
    ModelIdSchema.parse("grok-3-mini-fast"),
  ],
};

/**
 * Default values for project settings
 */
const DEFAULT_PROJECT_SETTINGS: Partial<ProjectSettings> = {
  model: ModelIdSchema.parse("grok-code-fast-1"),
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
    // NEW: User settings path: ~/.ax-cli/config.json
    // Fallback to ~/.grok/user-settings.json for backward compatibility
    const newUserPath = path.join(os.homedir(), ".ax-cli", "config.json");
    const oldUserPath = path.join(os.homedir(), ".grok", "user-settings.json");

    this.userSettingsPath = fs.existsSync(oldUserPath) && !fs.existsSync(newUserPath)
      ? oldUserPath  // Use old path if it exists and new doesn't
      : newUserPath; // Prefer new path

    // NEW: Project settings path: .ax-cli/settings.json
    // Fallback to .grok/settings.json for backward compatibility
    const newProjectPath = path.join(process.cwd(), ".ax-cli", "settings.json");
    const oldProjectPath = path.join(process.cwd(), ".grok", "settings.json");

    this.projectSettingsPath = fs.existsSync(oldProjectPath) && !fs.existsSync(newProjectPath)
      ? oldProjectPath  // Use old path if it exists and new doesn't
      : newProjectPath; // Prefer new path
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
   * Migrate from old .grok paths to new .ax-cli paths
   * This is a one-time migration helper
   */
  public migrateFromGrokToAxCli(): { migrated: boolean; details: string[] } {
    const details: string[] = [];
    let migrated = false;

    // Migrate user settings
    const oldUserPath = path.join(os.homedir(), ".grok", "user-settings.json");
    const newUserPath = path.join(os.homedir(), ".ax-cli", "config.json");

    if (fs.existsSync(oldUserPath) && !fs.existsSync(newUserPath)) {
      try {
        // Create new directory
        const newUserDir = path.dirname(newUserPath);
        if (!fs.existsSync(newUserDir)) {
          fs.mkdirSync(newUserDir, { recursive: true, mode: 0o700 });
        }

        // Copy file
        fs.copyFileSync(oldUserPath, newUserPath);
        fs.chmodSync(newUserPath, 0o600); // Secure permissions for API key

        details.push(`✅ Migrated user settings: ${oldUserPath} → ${newUserPath}`);
        migrated = true;
      } catch (error) {
        details.push(`❌ Failed to migrate user settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Migrate project settings
    const oldProjectPath = path.join(process.cwd(), ".grok", "settings.json");
    const newProjectPath = path.join(process.cwd(), ".ax-cli", "settings.json");

    if (fs.existsSync(oldProjectPath) && !fs.existsSync(newProjectPath)) {
      try {
        // Create new directory
        const newProjectDir = path.dirname(newProjectPath);
        if (!fs.existsSync(newProjectDir)) {
          fs.mkdirSync(newProjectDir, { recursive: true });
        }

        // Copy file
        fs.copyFileSync(oldProjectPath, newProjectPath);

        details.push(`✅ Migrated project settings: ${oldProjectPath} → ${newProjectPath}`);
        migrated = true;
      } catch (error) {
        details.push(`❌ Failed to migrate project settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (!migrated) {
      details.push('ℹ️  No migration needed - already using .ax-cli paths or no old settings found');
    }

    // Update the instance paths to use new locations
    this.userSettingsPath = newUserPath;
    this.projectSettingsPath = newProjectPath;

    // Invalidate cache after migration
    this.userSettingsCache = null;
    this.projectSettingsCache = null;
    this.cacheTimestamp = { user: 0, project: 0 };

    return { migrated, details };
  }

  /**
   * Ensure directory exists for a given file path
   */
  private ensureDirectoryExists(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Load user settings from ~/.grok/user-settings.json
   */
  public loadUserSettings(): UserSettings {
    // Check cache first
    const now = Date.now();
    if (this.userSettingsCache && (now - this.cacheTimestamp.user) < this.CACHE_TTL) {
      return this.userSettingsCache;
    }

    try {
      if (!fs.existsSync(this.userSettingsPath)) {
        // Create default user settings if file doesn't exist
        this.saveUserSettings(DEFAULT_USER_SETTINGS);
        return { ...DEFAULT_USER_SETTINGS };
      }

      const content = fs.readFileSync(this.userSettingsPath, "utf-8");
      const rawSettings = JSON.parse(content);

      // Validate with Zod schema
      const validationResult = UserSettingsSchema.safeParse(rawSettings);

      if (!validationResult.success) {
        console.warn(
          "User settings validation failed, using defaults:",
          validationResult.error.message
        );
        return { ...DEFAULT_USER_SETTINGS };
      }

      // Merge with defaults to ensure all required fields exist
      const settings = { ...DEFAULT_USER_SETTINGS, ...validationResult.data };
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
   * Save user settings to ~/.grok/user-settings.json
   */
  public saveUserSettings(settings: Partial<UserSettings>): void {
    try {
      this.ensureDirectoryExists(this.userSettingsPath);

      // Read existing settings directly to avoid recursion
      let existingSettings: UserSettings = { ...DEFAULT_USER_SETTINGS };
      if (fs.existsSync(this.userSettingsPath)) {
        try {
          const content = fs.readFileSync(this.userSettingsPath, "utf-8");
          const parsed = JSON.parse(content);
          existingSettings = { ...DEFAULT_USER_SETTINGS, ...parsed };
        } catch {
          // If file is corrupted, use defaults
          console.warn("Corrupted user settings file, using defaults");
        }
      }

      const mergedSettings = { ...existingSettings, ...settings };

      fs.writeFileSync(
        this.userSettingsPath,
        JSON.stringify(mergedSettings, null, 2),
        { mode: 0o600 } // Secure permissions for API key
      );

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
   * Load project settings from .grok/settings.json
   */
  public loadProjectSettings(): ProjectSettings {
    // Check cache first
    const now = Date.now();
    if (this.projectSettingsCache && (now - this.cacheTimestamp.project) < this.CACHE_TTL) {
      return this.projectSettingsCache;
    }

    try{
      if (!fs.existsSync(this.projectSettingsPath)) {
        // Create default project settings if file doesn't exist
        this.saveProjectSettings(DEFAULT_PROJECT_SETTINGS);
        return { ...DEFAULT_PROJECT_SETTINGS };
      }

      const content = fs.readFileSync(this.projectSettingsPath, "utf-8");
      const rawSettings = JSON.parse(content);

      // Validate with Zod schema
      const validationResult = ProjectSettingsSchema.safeParse(rawSettings);

      if (!validationResult.success) {
        console.warn(
          "Project settings validation failed, using defaults:",
          validationResult.error.message
        );
        return { ...DEFAULT_PROJECT_SETTINGS };
      }

      // Merge with defaults
      const settings = { ...DEFAULT_PROJECT_SETTINGS, ...validationResult.data };
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
   * Save project settings to .grok/settings.json
   */
  public saveProjectSettings(settings: Partial<ProjectSettings>): void {
    try {
      this.ensureDirectoryExists(this.projectSettingsPath);

      // Read existing settings directly to avoid recursion
      let existingSettings: ProjectSettings = { ...DEFAULT_PROJECT_SETTINGS };
      if (fs.existsSync(this.projectSettingsPath)) {
        try {
          const content = fs.readFileSync(this.projectSettingsPath, "utf-8");
          const parsed = JSON.parse(content);
          existingSettings = { ...DEFAULT_PROJECT_SETTINGS, ...parsed };
        } catch {
          // If file is corrupted, use defaults
          console.warn("Corrupted project settings file, using defaults");
        }
      }

      const mergedSettings = { ...existingSettings, ...settings };

      fs.writeFileSync(
        this.projectSettingsPath,
        JSON.stringify(mergedSettings, null, 2)
      );

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
   * 3. System default
   */
  public getCurrentModel(): string {
    const projectModel = this.getProjectSetting("model");
    if (projectModel) {
      return projectModel;
    }

    const userDefaultModel = this.getUserSetting("defaultModel");
    if (userDefaultModel) {
      return userDefaultModel;
    }

    return DEFAULT_PROJECT_SETTINGS.model || ModelIdSchema.parse("grok-code-fast-1");
  }

  /**
   * Set the current model for the project
   */
  public setCurrentModel(model: string): void {
    this.updateProjectSetting("model", ModelIdSchema.parse(model));
  }

  /**
   * Get available models list from user settings
   */
  public getAvailableModels(): string[] {
    const models = this.getUserSetting("models");
    return models || DEFAULT_USER_SETTINGS.models || [];
  }

  /**
   * Get API key from user settings or environment
   */
  public getApiKey(): string | undefined {
    // First check environment variable
    const envApiKey = process.env.GROK_API_KEY;
    if (envApiKey) {
      return envApiKey;
    }

    // Then check user settings
    return this.getUserSetting("apiKey");
  }

  /**
   * Get base URL from user settings or environment
   */
  public getBaseURL(): string {
    // First check environment variable
    const envBaseURL = process.env.GROK_BASE_URL;
    if (envBaseURL) {
      return envBaseURL;
    }

    // Then check user settings
    const userBaseURL = this.getUserSetting("baseURL");
    return (
      userBaseURL || DEFAULT_USER_SETTINGS.baseURL || "https://api.x.ai/v1"
    );
  }
}

/**
 * Convenience function to get the singleton instance
 */
export function getSettingsManager(): SettingsManager {
  return SettingsManager.getInstance();
}
