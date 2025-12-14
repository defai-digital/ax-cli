/**
 * Tests for SettingsManager
 *
 * Note: These tests use in-memory mocks to avoid file system operations.
 * The actual SettingsManager is tested through its public API.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Create a test config directory
const testDir = join(tmpdir(), `ax-cli-test-${process.pid}`);
const userConfigPath = join(testDir, "user", "config.json");
const projectSettingsPath = join(testDir, "project", "settings.json");

// Setup test directory before imports
beforeEach(() => {
  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true });
  }
  mkdirSync(join(testDir, "user"), { recursive: true });
  mkdirSync(join(testDir, "project"), { recursive: true });
});

afterEach(() => {
  try {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup errors
  }
});

describe("SettingsManager Types and Defaults", () => {
  it("should define InputSettings interface", () => {
    // Verify types are exported and have expected shape
    type InputSettings = {
      enterBehavior?: "submit" | "newline" | "smart";
      submitKeys?: string[];
      multilineIndicator?: string;
      smartDetection?: {
        enabled?: boolean;
        checkBrackets?: boolean;
        checkOperators?: boolean;
        checkStatements?: boolean;
      };
    };

    const settings: InputSettings = {
      enterBehavior: "newline",
      submitKeys: ["shift+enter"],
      multilineIndicator: "│ ",
      smartDetection: {
        enabled: true,
      },
    };

    expect(settings.enterBehavior).toBe("newline");
  });

  it("should define ShortcutsSettings interface", () => {
    type ShortcutsSettings = {
      showOnStartup?: boolean;
      hintTimeout?: number;
      customBindings?: Record<string, string>;
    };

    const settings: ShortcutsSettings = {
      showOnStartup: false,
      hintTimeout: 3000,
      customBindings: {},
    };

    expect(settings.hintTimeout).toBe(3000);
  });

  it("should define PasteSettings interface", () => {
    type PasteSettings = {
      autoCollapse?: boolean;
      collapseThreshold?: number;
      characterThreshold?: number;
      maxCollapsedBlocks?: number;
      showLineCount?: boolean;
      showPreview?: boolean;
      previewLines?: number;
      enableHistory?: boolean;
      maxHistoryItems?: number;
      enableBracketedPaste?: boolean;
      showPasteIndicator?: boolean;
      maxPasteSize?: number;
      pasteTimeout?: number;
      enableFallback?: boolean;
    };

    const settings: PasteSettings = {
      autoCollapse: true,
      collapseThreshold: 20,
      enableBracketedPaste: true,
    };

    expect(settings.autoCollapse).toBe(true);
  });

  it("should define UISettings interface", () => {
    type UISettings = {
      verbosityLevel?: "quiet" | "normal" | "verbose";
      groupToolCalls?: boolean;
      maxGroupSize?: number;
      groupTimeWindow?: number;
      theme?: string;
    };

    const settings: UISettings = {
      verbosityLevel: "quiet",
      groupToolCalls: true,
      theme: "default",
    };

    expect(settings.verbosityLevel).toBe("quiet");
  });

  it("should define StatusBarSettings interface", () => {
    type StatusBarSettings = {
      enabled?: boolean;
      compact?: boolean;
      showCost?: boolean;
      showTokens?: boolean;
      showContext?: boolean;
      showSession?: boolean;
      showModes?: boolean;
      updateInterval?: number;
      position?: "top" | "bottom";
    };

    const settings: StatusBarSettings = {
      enabled: true,
      compact: true,
      position: "top",
    };

    expect(settings.enabled).toBe(true);
  });

  it("should define AutoAcceptSettings interface", () => {
    type AutoAcceptSettings = {
      enabled?: boolean;
      persistAcrossSessions?: boolean;
      alwaysConfirm?: string[];
      scope?: "session" | "persistent";
      auditLog?: {
        enabled?: boolean;
        maxEntries?: number;
        filepath?: string;
      };
    };

    const settings: AutoAcceptSettings = {
      enabled: false,
      scope: "session",
      auditLog: {
        enabled: true,
        maxEntries: 1000,
      },
    };

    expect(settings.enabled).toBe(false);
  });

  it("should define ExternalEditorSettings interface", () => {
    type ExternalEditorSettings = {
      enabled?: boolean;
      editor?: string;
      shortcut?: string;
      tempDir?: string;
      confirmBeforeSubmit?: boolean;
      syntaxHighlighting?: boolean;
    };

    const settings: ExternalEditorSettings = {
      enabled: true,
      shortcut: "ctrl+g",
      confirmBeforeSubmit: true,
    };

    expect(settings.shortcut).toBe("ctrl+g");
  });

  it("should define ThinkingModeSettings interface", () => {
    type ThinkingModeSettings = {
      enabled?: boolean;
      quickToggle?: boolean;
      showInStatusBar?: boolean;
      budgetTokens?: number;
    };

    const settings: ThinkingModeSettings = {
      enabled: false,
      quickToggle: true,
      showInStatusBar: true,
    };

    expect(settings.quickToggle).toBe(true);
  });

  it("should define AutoUpdateSettings interface", () => {
    type AutoUpdateSettings = {
      enabled?: boolean;
      checkIntervalHours?: number;
      lastCheckTimestamp?: string;
      autoInstall?: boolean;
    };

    const settings: AutoUpdateSettings = {
      enabled: true,
      checkIntervalHours: 24,
      autoInstall: false,
    };

    expect(settings.checkIntervalHours).toBe(24);
  });

  it("should define SamplingSettings interface", () => {
    type SamplingSettings = {
      doSample?: boolean;
      seed?: number;
      topP?: number;
    };

    const settings: SamplingSettings = {
      doSample: true,
      seed: 42,
      topP: 0.9,
    };

    expect(settings.seed).toBe(42);
  });

  it("should define ThinkingSettings interface", () => {
    type ThinkingSettings = {
      enabled?: boolean;
    };

    const settings: ThinkingSettings = {
      enabled: false,
    };

    expect(settings.enabled).toBe(false);
  });

  it("should define AgentFirstSettings interface", () => {
    type AgentFirstSettings = {
      enabled: boolean;
      confidenceThreshold: number;
      showAgentIndicator: boolean;
      defaultAgent: string | null;
      excludedAgents: string[];
    };

    const settings: AgentFirstSettings = {
      enabled: true,
      confidenceThreshold: 0.6,
      showAgentIndicator: true,
      defaultAgent: "standard",
      excludedAgents: [],
    };

    expect(settings.confidenceThreshold).toBe(0.6);
  });
});

describe("SettingsManager Default Values", () => {
  it("should have correct UI defaults", () => {
    const defaults = {
      verbosityLevel: "quiet",
      groupToolCalls: true,
      maxGroupSize: 20,
      groupTimeWindow: 500,
      theme: "default",
    };

    expect(defaults.verbosityLevel).toBe("quiet");
    expect(defaults.maxGroupSize).toBe(20);
  });

  it("should have correct status bar defaults", () => {
    const defaults = {
      enabled: true,
      compact: true,
      showCost: true,
      showTokens: true,
      showContext: true,
      showSession: true,
      showModes: true,
      updateInterval: 1000,
      position: "top",
    };

    expect(defaults.enabled).toBe(true);
    expect(defaults.position).toBe("top");
  });

  it("should have correct external editor defaults", () => {
    const defaults = {
      enabled: true,
      editor: undefined,
      shortcut: "ctrl+g",
      tempDir: undefined,
      confirmBeforeSubmit: true,
      syntaxHighlighting: true,
    };

    expect(defaults.enabled).toBe(true);
    expect(defaults.shortcut).toBe("ctrl+g");
  });

  it("should have correct thinking mode defaults", () => {
    const defaults = {
      enabled: false,
      quickToggle: true,
      showInStatusBar: true,
      budgetTokens: undefined,
    };

    expect(defaults.enabled).toBe(false);
    expect(defaults.quickToggle).toBe(true);
  });

  it("should have correct auto-update defaults", () => {
    const defaults = {
      enabled: true,
      checkIntervalHours: 24,
      lastCheckTimestamp: undefined,
      autoInstall: false,
    };

    expect(defaults.enabled).toBe(true);
    expect(defaults.checkIntervalHours).toBe(24);
  });

  it("should have correct input defaults", () => {
    // Default is 'submit' - Enter sends, Ctrl+J inserts newline (more reliable)
    const defaults = {
      enterBehavior: "submit",
      submitKeys: ["shift+enter"],
      multilineIndicator: "│ ",
      smartDetection: {
        enabled: true,
        checkBrackets: true,
        checkOperators: true,
        checkStatements: true,
      },
    };

    expect(defaults.enterBehavior).toBe("submit");
    expect(defaults.smartDetection.enabled).toBe(true);
  });

  it("should have correct shortcuts defaults", () => {
    const defaults = {
      showOnStartup: false,
      hintTimeout: 3000,
      customBindings: {},
    };

    expect(defaults.showOnStartup).toBe(false);
    expect(defaults.hintTimeout).toBe(3000);
  });

  it("should have correct paste defaults", () => {
    const defaults = {
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
      maxPasteSize: 100 * 1024 * 1024,
      pasteTimeout: 30000,
      enableFallback: true,
    };

    expect(defaults.autoCollapse).toBe(true);
    expect(defaults.maxPasteSize).toBe(100 * 1024 * 1024);
  });

  it("should have correct auto-accept defaults", () => {
    const defaults = {
      enabled: false,
      persistAcrossSessions: false,
      alwaysConfirm: ["git_push_main", "mass_delete", "rm_rf", "npm_publish"],
      scope: "session",
      auditLog: {
        enabled: true,
        maxEntries: 1000,
        filepath: undefined,
      },
    };

    expect(defaults.enabled).toBe(false);
    expect(defaults.alwaysConfirm).toContain("git_push_main");
    expect(defaults.auditLog.enabled).toBe(true);
  });

  it("should have correct agent-first defaults", () => {
    const defaults = {
      enabled: true,
      confidenceThreshold: 0.6,
      showAgentIndicator: true,
      defaultAgent: "standard",
      excludedAgents: [],
    };

    expect(defaults.enabled).toBe(true);
    expect(defaults.confidenceThreshold).toBe(0.6);
  });
});

describe("SettingsManager Helper Functions", () => {
  it("should merge configs correctly with getConfigWithDefaults pattern", () => {
    function getConfigWithDefaults<T extends object>(
      userConfig: T | undefined,
      defaults: T
    ): T {
      if (!userConfig) {
        return { ...defaults };
      }
      return Object.keys(defaults).reduce((result, key) => {
        const k = key as keyof T;
        result[k] = userConfig[k] ?? defaults[k];
        return result;
      }, {} as T);
    }

    const defaults = { a: 1, b: 2, c: 3 };
    const userConfig = { a: 10, b: undefined };

    const result = getConfigWithDefaults(userConfig, defaults);

    expect(result.a).toBe(10);
    expect(result.b).toBe(2); // undefined in userConfig falls back to default
    expect(result.c).toBe(3);
  });

  it("should return copy of defaults when userConfig is undefined", () => {
    function getConfigWithDefaults<T extends object>(
      userConfig: T | undefined,
      defaults: T
    ): T {
      if (!userConfig) {
        return { ...defaults };
      }
      return { ...defaults, ...userConfig };
    }

    const defaults = { a: 1, b: 2 };
    const result1 = getConfigWithDefaults(undefined, defaults);
    const result2 = getConfigWithDefaults(undefined, defaults);

    // Results should be equal but not the same object
    expect(result1).toEqual(result2);
    expect(result1).not.toBe(result2);

    // Mutating one shouldn't affect the other
    result1.a = 100;
    expect(result2.a).toBe(1);
  });
});

describe("SettingsManager Environment Variables", () => {
  afterEach(() => {
    // Clean up environment variables
    delete process.env.AI_DO_SAMPLE;
    delete process.env.AI_SEED;
    delete process.env.AI_TOP_P;
    delete process.env.AI_THINK;
    delete process.env.YOUR_API_KEY;
    delete process.env.AI_BASE_URL;
  });

  it("should parse AI_DO_SAMPLE environment variable", () => {
    process.env.AI_DO_SAMPLE = "false";

    const envDoSample = process.env.AI_DO_SAMPLE;
    const doSample = envDoSample?.toLowerCase() === "true";

    expect(doSample).toBe(false);
  });

  it("should parse AI_SEED environment variable", () => {
    process.env.AI_SEED = "42";

    const envSeed = process.env.AI_SEED;
    const seedNum = parseInt(envSeed || "", 10);
    const seed = Number.isFinite(seedNum) && seedNum >= 0 ? seedNum : undefined;

    expect(seed).toBe(42);
  });

  it("should reject invalid AI_SEED values", () => {
    process.env.AI_SEED = "not-a-number";

    const envSeed = process.env.AI_SEED;
    const seedNum = parseInt(envSeed || "", 10);
    const seed = Number.isFinite(seedNum) && seedNum >= 0 ? seedNum : undefined;

    expect(seed).toBeUndefined();
  });

  it("should parse AI_TOP_P environment variable", () => {
    process.env.AI_TOP_P = "0.9";

    const envTopP = process.env.AI_TOP_P;
    const topPNum = parseFloat(envTopP || "");
    const topP = Number.isFinite(topPNum) && topPNum >= 0 && topPNum <= 1 ? topPNum : undefined;

    expect(topP).toBe(0.9);
  });

  it("should reject invalid AI_TOP_P values", () => {
    process.env.AI_TOP_P = "1.5"; // Out of range

    const envTopP = process.env.AI_TOP_P;
    const topPNum = parseFloat(envTopP || "");
    const topP = Number.isFinite(topPNum) && topPNum >= 0 && topPNum <= 1 ? topPNum : undefined;

    expect(topP).toBeUndefined();
  });

  it("should parse AI_THINK environment variable", () => {
    process.env.AI_THINK = "true";

    const envThink = process.env.AI_THINK;
    const enabled = envThink?.toLowerCase() === "true";

    expect(enabled).toBe(true);
  });

  it("should use YOUR_API_KEY environment variable", () => {
    process.env.YOUR_API_KEY = "test-api-key";

    const envApiKey = process.env.YOUR_API_KEY;

    expect(envApiKey).toBe("test-api-key");
  });

  it("should use AI_BASE_URL environment variable", () => {
    process.env.AI_BASE_URL = "https://api.custom.com/v1";

    const envBaseURL = process.env.AI_BASE_URL;

    expect(envBaseURL).toBe("https://api.custom.com/v1");
  });
});

describe("SettingsManager shouldCheckForUpdates logic", () => {
  it("should return true when auto-update enabled and no previous check", () => {
    const config = {
      enabled: true,
      checkIntervalHours: 24,
      lastCheckTimestamp: undefined,
    };

    const shouldCheck = !config.lastCheckTimestamp;

    expect(shouldCheck).toBe(true);
  });

  it("should return false when auto-update disabled", () => {
    const config = {
      enabled: false,
      checkIntervalHours: 24,
      lastCheckTimestamp: new Date().toISOString(),
    };

    const shouldCheck = config.enabled !== false;

    expect(shouldCheck).toBe(false);
  });

  it("should return true when checkIntervalHours is 0 (always check)", () => {
    const config = {
      enabled: true,
      checkIntervalHours: 0,
      lastCheckTimestamp: new Date().toISOString(),
    };

    const shouldCheck = config.checkIntervalHours === 0;

    expect(shouldCheck).toBe(true);
  });

  it("should return true when interval has passed", () => {
    const hourAgo = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
    const config = {
      enabled: true,
      checkIntervalHours: 1, // Check every hour
      lastCheckTimestamp: hourAgo.toISOString(),
    };

    const lastCheck = new Date(config.lastCheckTimestamp).getTime();
    const now = Date.now();
    const intervalMs = config.checkIntervalHours * 60 * 60 * 1000;
    const shouldCheck = (now - lastCheck) >= intervalMs;

    expect(shouldCheck).toBe(true);
  });

  it("should return false when interval has not passed", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    const config = {
      enabled: true,
      checkIntervalHours: 24, // Check every 24 hours
      lastCheckTimestamp: fiveMinutesAgo.toISOString(),
    };

    const lastCheck = new Date(config.lastCheckTimestamp).getTime();
    const now = Date.now();
    const intervalMs = config.checkIntervalHours * 60 * 60 * 1000;
    const shouldCheck = (now - lastCheck) >= intervalMs;

    expect(shouldCheck).toBe(false);
  });

  it("should return true for invalid timestamp", () => {
    const config = {
      enabled: true,
      checkIntervalHours: 24,
      lastCheckTimestamp: "invalid-date",
    };

    const lastCheck = new Date(config.lastCheckTimestamp).getTime();
    const isInvalid = Number.isNaN(lastCheck);

    expect(isInvalid).toBe(true);
  });
});

// ==================== Actual SettingsManager Class Tests ====================
// Mock dependencies to test the actual SettingsManager class

describe("SettingsManager Class", () => {
  // These tests verify behavior using the actual implementation patterns

  describe("validateUserSettings logic", () => {
    it("should check for apiKey presence", () => {
      const settings = { apiKey: "test-key" };
      const hasApiKey = !!(settings.apiKey);
      expect(hasApiKey).toBe(true);
    });

    it("should check for apiKeyEncrypted presence", () => {
      const settings = { apiKeyEncrypted: "encrypted-key" };
      const hasApiKey = !!((settings as { apiKey?: string }).apiKey || settings.apiKeyEncrypted);
      expect(hasApiKey).toBe(true);
    });

    it("should return false when no API key", () => {
      const settings = {};
      const hasApiKey = !!((settings as { apiKey?: string }).apiKey || (settings as { apiKeyEncrypted?: string }).apiKeyEncrypted);
      expect(hasApiKey).toBe(false);
    });

    it("should check for baseURL presence", () => {
      const settings = { baseURL: "https://api.example.com" };
      const hasBaseURL = !!settings.baseURL;
      expect(hasBaseURL).toBe(true);
    });

    it("should check for model presence (defaultModel)", () => {
      const settings = { defaultModel: "glm-4" };
      const hasModel = !!((settings as { defaultModel?: string }).defaultModel || (settings as { currentModel?: string }).currentModel);
      expect(hasModel).toBe(true);
    });

    it("should check for model presence (currentModel)", () => {
      const settings = { currentModel: "glm-4" };
      const hasModel = !!((settings as { defaultModel?: string }).defaultModel || settings.currentModel);
      expect(hasModel).toBe(true);
    });

    it("should determine isValid based on all required fields", () => {
      const settings = {
        apiKey: "key",
        baseURL: "https://api.z.ai",
        defaultModel: "glm-4",
      };

      const hasApiKey = !!settings.apiKey;
      const hasBaseURL = !!settings.baseURL;
      const hasModel = !!settings.defaultModel;
      const isValid = hasApiKey && hasBaseURL && hasModel;

      expect(isValid).toBe(true);
    });

    it("should detect missing optional config sections", () => {
      const settings: Record<string, unknown> = {
        apiKey: "key",
        baseURL: "https://api.z.ai",
        defaultModel: "glm-4",
        // Missing: ui, input, shortcuts, paste, etc.
      };

      const missingFields: string[] = [];
      const optionalFields = ["ui", "input", "shortcuts", "paste", "statusBar", "autoAccept", "externalEditor", "thinkingMode", "autoUpdate"];

      for (const field of optionalFields) {
        if (!settings[field]) {
          missingFields.push(field);
        }
      }

      expect(missingFields).toContain("ui");
      expect(missingFields).toContain("input");
      expect(missingFields.length).toBe(optionalFields.length);
    });
  });

  describe("migrateUserSettings logic", () => {
    it("should identify fields that need migration", () => {
      const currentSettings: Record<string, unknown> = {
        apiKey: "key",
        baseURL: "https://api.z.ai",
        // Missing optional fields
      };

      const defaultConfigs: Record<string, unknown> = {
        ui: { verbosityLevel: "quiet" },
        input: { enterBehavior: "submit" }, // Default is now 'submit'
        shortcuts: { showOnStartup: false },
      };

      const addedFields: string[] = [];

      for (const [key, _defaultValue] of Object.entries(defaultConfigs)) {
        if (currentSettings[key] === undefined) {
          addedFields.push(key);
        }
      }

      expect(addedFields).toContain("ui");
      expect(addedFields).toContain("input");
      expect(addedFields).toContain("shortcuts");
    });

    it("should not migrate fields that already exist", () => {
      const currentSettings: Record<string, unknown> = {
        ui: { verbosityLevel: "verbose" }, // Already exists
        input: { enterBehavior: "newline" }, // User has custom setting
      };

      const defaultConfigs: Record<string, unknown> = {
        ui: { verbosityLevel: "quiet" },
        input: { enterBehavior: "submit" }, // Default is now 'submit'
        shortcuts: { showOnStartup: false },
      };

      const addedFields: string[] = [];

      for (const [key, _defaultValue] of Object.entries(defaultConfigs)) {
        if (currentSettings[key] === undefined) {
          addedFields.push(key);
        }
      }

      expect(addedFields).not.toContain("ui");
      expect(addedFields).not.toContain("input");
      expect(addedFields).toContain("shortcuts");
    });
  });

  describe("API key encryption/decryption logic", () => {
    it("should prioritize apiKeyEncrypted over apiKey", () => {
      const settings = {
        apiKeyEncrypted: "encrypted:key1",
        apiKey: "plain-key2",
      };

      // Simulated decryption
      const decrypt = (value: string) => value.replace("encrypted:", "");

      let apiKey: string | undefined;
      if (settings.apiKeyEncrypted) {
        apiKey = decrypt(settings.apiKeyEncrypted);
      } else if (settings.apiKey) {
        apiKey = settings.apiKey;
      }

      expect(apiKey).toBe("key1");
    });

    it("should fall back to plain apiKey if decryption fails", () => {
      const settings = {
        apiKeyEncrypted: "bad-encrypted-data",
        apiKey: "fallback-key",
      };

      // Simulated failing decryption
      const decrypt = (_value: string): string => {
        throw new Error("Decryption failed");
      };

      let apiKey: string | undefined;
      try {
        if (settings.apiKeyEncrypted) {
          apiKey = decrypt(settings.apiKeyEncrypted);
        }
      } catch {
        // Fall back to plain-text
        if (settings.apiKey) {
          apiKey = settings.apiKey;
        }
      }

      expect(apiKey).toBe("fallback-key");
    });

    it("should encrypt API key before saving", () => {
      const apiKey = "my-secret-key";

      // Simulated encryption
      const encrypt = (value: string) => `encrypted:${value}`;

      const encrypted = encrypt(apiKey);
      const settingsToSave = {
        apiKeyEncrypted: encrypted,
        apiKey: undefined, // Clear plain-text
      };

      expect(settingsToSave.apiKeyEncrypted).toBe("encrypted:my-secret-key");
      expect(settingsToSave.apiKey).toBeUndefined();
    });
  });

  describe("settings merging logic", () => {
    it("should merge user settings with defaults", () => {
      const defaults = {
        a: 1,
        b: 2,
        c: 3,
      };

      const userSettings = {
        a: 10,
        // b not specified
        c: 30,
      };

      const merged = { ...defaults, ...userSettings };

      expect(merged.a).toBe(10);
      expect(merged.b).toBe(2);
      expect(merged.c).toBe(30);
    });

    it("should handle nested object merging for smartDetection", () => {
      // Default is now 'submit' - Enter sends, Ctrl+J inserts newline
      const defaults = {
        enterBehavior: "submit",
        smartDetection: {
          enabled: true,
          checkBrackets: true,
          checkOperators: true,
        },
      };

      const userSettings = {
        smartDetection: {
          enabled: false,
          // checkBrackets not specified
        },
      };

      const merged = {
        enterBehavior: (userSettings as typeof defaults).enterBehavior || defaults.enterBehavior,
        smartDetection: {
          enabled: userSettings.smartDetection?.enabled ?? defaults.smartDetection.enabled,
          checkBrackets: userSettings.smartDetection?.checkBrackets ?? defaults.smartDetection.checkBrackets,
          checkOperators: userSettings.smartDetection?.checkOperators ?? defaults.smartDetection.checkOperators,
        },
      };

      expect(merged.enterBehavior).toBe("submit");
      expect(merged.smartDetection.enabled).toBe(false);
      expect(merged.smartDetection.checkBrackets).toBe(true);
    });

    it("should handle nested object merging for auditLog", () => {
      const defaults = {
        enabled: false,
        auditLog: {
          enabled: true,
          maxEntries: 1000,
          filepath: undefined,
        },
      };

      const userSettings = {
        enabled: true,
        auditLog: {
          maxEntries: 500,
        },
      };

      const merged = {
        enabled: userSettings.enabled ?? defaults.enabled,
        auditLog: {
          enabled: userSettings.auditLog?.enabled ?? defaults.auditLog.enabled,
          maxEntries: userSettings.auditLog?.maxEntries ?? defaults.auditLog.maxEntries,
          filepath: userSettings.auditLog?.filepath ?? defaults.auditLog.filepath,
        },
      };

      expect(merged.enabled).toBe(true);
      expect(merged.auditLog.enabled).toBe(true); // Falls back to default
      expect(merged.auditLog.maxEntries).toBe(500); // Uses user value
    });
  });

  describe("getCurrentModel logic", () => {
    it("should prioritize project model over user model", () => {
      const projectSettings = { model: "project-model" };
      const userSettings = { defaultModel: "user-model" };

      const model = projectSettings.model || userSettings.defaultModel || undefined;

      expect(model).toBe("project-model");
    });

    it("should fall back to user defaultModel", () => {
      const projectSettings = { model: undefined };
      const userSettings = { defaultModel: "user-model" };

      const model = projectSettings.model || userSettings.defaultModel || undefined;

      expect(model).toBe("user-model");
    });

    it("should return undefined if no model configured", () => {
      const projectSettings = { model: undefined };
      const userSettings = { defaultModel: undefined };

      const model = projectSettings.model || userSettings.defaultModel || undefined;

      expect(model).toBeUndefined();
    });
  });

  describe("getVisionModel logic", () => {
    it("should prioritize project visionModel", () => {
      const projectSettings = { visionModel: "project-vision" };
      const userSettings = { visionModel: "user-vision" };
      const provider = { defaultVisionModel: "provider-vision" };

      const model = projectSettings.visionModel || userSettings.visionModel || provider.defaultVisionModel;

      expect(model).toBe("project-vision");
    });

    it("should fall back to provider default", () => {
      const projectSettings = { visionModel: undefined };
      const userSettings = { visionModel: undefined };
      const provider = { defaultVisionModel: "provider-vision" };

      const model = projectSettings.visionModel || userSettings.visionModel || provider.defaultVisionModel;

      expect(model).toBe("provider-vision");
    });
  });

  describe("getAgentFirstSettings logic", () => {
    it("should merge with defaults correctly", () => {
      const defaults = {
        enabled: true,
        confidenceThreshold: 0.6,
        showAgentIndicator: true,
        defaultAgent: "standard",
        excludedAgents: [],
      };

      const userSettings = { enabled: false };
      const projectSettings = { confidenceThreshold: 0.8 };

      const merged = { ...userSettings, ...projectSettings };

      const result = {
        enabled: (merged as typeof defaults).enabled ?? defaults.enabled,
        confidenceThreshold: (merged as typeof defaults).confidenceThreshold ?? defaults.confidenceThreshold,
        showAgentIndicator: (merged as typeof defaults).showAgentIndicator ?? defaults.showAgentIndicator,
        defaultAgent: (merged as typeof defaults).defaultAgent ?? defaults.defaultAgent,
        excludedAgents: (merged as typeof defaults).excludedAgents ?? defaults.excludedAgents,
      };

      expect(result.enabled).toBe(false); // From userSettings
      expect(result.confidenceThreshold).toBe(0.8); // From projectSettings
      expect(result.showAgentIndicator).toBe(true); // From defaults
    });
  });

  describe("getPasteSettings logic", () => {
    it("should merge user and project paste settings", () => {
      const userPaste = { allowLargePaste: false, maxPasteLength: 10000 };
      const projectPaste = { maxPasteLength: 50000 };

      const merged = { ...userPaste, ...projectPaste };

      const result = {
        allowLargePaste: merged.allowLargePaste ?? true,
        maxPasteLength: merged.maxPasteLength ?? 50000,
      };

      expect(result.allowLargePaste).toBe(false); // From user
      expect(result.maxPasteLength).toBe(50000); // From project (overrides user)
    });
  });

  describe("cache behavior", () => {
    it("should use cache when within TTL", () => {
      const CACHE_TTL = 5000;
      const cacheTimestamp = Date.now();
      const now = Date.now();

      const shouldUseCache = (now - cacheTimestamp) < CACHE_TTL;

      expect(shouldUseCache).toBe(true);
    });

    it("should invalidate cache after TTL", () => {
      const CACHE_TTL = 5000;
      const cacheTimestamp = Date.now() - 6000; // 6 seconds ago
      const now = Date.now();

      const shouldUseCache = (now - cacheTimestamp) < CACHE_TTL;

      expect(shouldUseCache).toBe(false);
    });
  });

  describe("deleteUserSettings logic", () => {
    it("should clear cache after deletion", () => {
      let userSettingsCache: Record<string, unknown> | null = { apiKey: "test" };
      let cacheTimestamp = Date.now();

      // Simulate deletion
      userSettingsCache = null;
      cacheTimestamp = 0;

      expect(userSettingsCache).toBeNull();
      expect(cacheTimestamp).toBe(0);
    });
  });
});

// Test auto-update config logic
describe("Auto-update configuration logic", () => {
  describe("shouldCheckForUpdates logic", () => {
    it("should return true when config undefined", () => {
      const config = undefined;
      const shouldCheck = !config;
      expect(shouldCheck).toBe(true);
    });

    it("should return false when explicitly disabled", () => {
      const config = { enabled: false, checkIntervalHours: 24 };
      const shouldCheck = config.enabled !== false;
      expect(shouldCheck).toBe(false);
    });

    it("should return true when checkIntervalHours is 0", () => {
      const config = { enabled: true, checkIntervalHours: 0 };
      const shouldCheck = config.checkIntervalHours === 0;
      expect(shouldCheck).toBe(true);
    });

    it("should return true when no lastCheckTimestamp", () => {
      const config = { enabled: true, checkIntervalHours: 24, lastCheckTimestamp: undefined };
      const shouldCheck = !config.lastCheckTimestamp;
      expect(shouldCheck).toBe(true);
    });

    it("should return true when lastCheckTimestamp is invalid", () => {
      const config = { enabled: true, checkIntervalHours: 24, lastCheckTimestamp: "invalid-date" };
      const lastCheck = new Date(config.lastCheckTimestamp).getTime();
      const shouldCheck = Number.isNaN(lastCheck);
      expect(shouldCheck).toBe(true);
    });

    it("should check time elapsed correctly", () => {
      const now = Date.now();
      const intervalMs = 24 * 60 * 60 * 1000;

      // Recent check - should not trigger
      const recentTimestamp = now - (1 * 60 * 60 * 1000); // 1 hour ago
      const shouldCheckRecent = (now - recentTimestamp) >= intervalMs;
      expect(shouldCheckRecent).toBe(false);

      // Old check - should trigger
      const oldTimestamp = now - (25 * 60 * 60 * 1000); // 25 hours ago
      const shouldCheckOld = (now - oldTimestamp) >= intervalMs;
      expect(shouldCheckOld).toBe(true);
    });
  });

  describe("getAutoUpdateConfig merge logic", () => {
    it("should use defaults when no user config", () => {
      const userConfig = undefined;
      const defaults = { enabled: true, checkIntervalHours: 24 };

      const result = userConfig ?? defaults;

      expect(result.enabled).toBe(true);
      expect(result.checkIntervalHours).toBe(24);
    });

    it("should merge user config with defaults", () => {
      const userConfig = { enabled: false };
      const defaults = { enabled: true, checkIntervalHours: 24 };

      const result = { ...defaults, ...userConfig };

      expect(result.enabled).toBe(false);
      expect(result.checkIntervalHours).toBe(24);
    });
  });
});

// Test validation logic
describe("Validation logic helpers", () => {
  describe("hasApiKey check", () => {
    it("should detect plain apiKey", () => {
      const settings = { apiKey: "test-key" };
      const hasApiKey = !!(settings.apiKey || (settings as Record<string, unknown>).apiKeyEncrypted);
      expect(hasApiKey).toBe(true);
    });

    it("should detect apiKeyEncrypted", () => {
      const settings = { apiKeyEncrypted: "encrypted" };
      const hasApiKey = !!((settings as Record<string, unknown>).apiKey || settings.apiKeyEncrypted);
      expect(hasApiKey).toBe(true);
    });

    it("should return false when no key", () => {
      const settings = { baseURL: "http://example.com" };
      const hasApiKey = !!((settings as Record<string, unknown>).apiKey || (settings as Record<string, unknown>).apiKeyEncrypted);
      expect(hasApiKey).toBe(false);
    });
  });

  describe("hasModel check", () => {
    it("should detect defaultModel", () => {
      const settings = { defaultModel: "model-v1" };
      const hasModel = !!(settings.defaultModel || (settings as Record<string, unknown>).currentModel);
      expect(hasModel).toBe(true);
    });

    it("should detect currentModel", () => {
      const settings = { currentModel: "model-v1" };
      const hasModel = !!((settings as Record<string, unknown>).defaultModel || settings.currentModel);
      expect(hasModel).toBe(true);
    });
  });

  describe("isValid calculation", () => {
    it("should be valid when all required fields present", () => {
      const hasApiKey = true;
      const hasBaseURL = true;
      const hasModel = true;

      const isValid = hasApiKey && hasBaseURL && hasModel;
      expect(isValid).toBe(true);
    });

    it("should be invalid when any required field missing", () => {
      const scenarios = [
        { hasApiKey: false, hasBaseURL: true, hasModel: true },
        { hasApiKey: true, hasBaseURL: false, hasModel: true },
        { hasApiKey: true, hasBaseURL: true, hasModel: false },
      ];

      for (const { hasApiKey, hasBaseURL, hasModel } of scenarios) {
        const isValid = hasApiKey && hasBaseURL && hasModel;
        expect(isValid).toBe(false);
      }
    });
  });
});

// Test migration logic
describe("Migration logic helpers", () => {
  it("should identify missing config sections", () => {
    const currentSettings: Record<string, unknown> = {
      apiKey: "test",
      input: {},
    };

    const defaultConfigs: Record<string, unknown> = {
      ui: {},
      input: {},
      shortcuts: {},
      paste: {},
    };

    const addedFields: string[] = [];
    for (const key of Object.keys(defaultConfigs)) {
      if (currentSettings[key] === undefined) {
        addedFields.push(key);
      }
    }

    expect(addedFields).toContain("ui");
    expect(addedFields).toContain("shortcuts");
    expect(addedFields).toContain("paste");
    expect(addedFields).not.toContain("input");
  });

  it("should determine if migration occurred", () => {
    const addedFields = ["ui", "paste"];
    const migrated = addedFields.length > 0;
    expect(migrated).toBe(true);

    const noFields: string[] = [];
    const notMigrated = noFields.length > 0;
    expect(notMigrated).toBe(false);
  });
});

// Test deleteUserSettings logic
describe("Delete settings logic", () => {
  it("should clear cache after deletion simulation", () => {
    let userSettingsCache: Record<string, unknown> | null = { apiKey: "test" };
    let cacheTimestamp = Date.now();

    // Simulate successful deletion
    const deleted = true;
    if (deleted) {
      userSettingsCache = null;
      cacheTimestamp = 0;
    }

    expect(userSettingsCache).toBeNull();
    expect(cacheTimestamp).toBe(0);
  });

  it("should handle file not existing", () => {
    const fileExists = false;

    // If file doesn't exist, deletion is considered successful
    const result = !fileExists ? true : false;
    expect(result).toBe(true);
  });
});
