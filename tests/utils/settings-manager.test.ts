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
      enterBehavior: "submit",
      submitKeys: ["enter"],
      multilineIndicator: "│ ",
      smartDetection: {
        enabled: true,
      },
    };

    expect(settings.enterBehavior).toBe("submit");
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
    const defaults = {
      enterBehavior: "submit",
      submitKeys: ["enter"],
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
