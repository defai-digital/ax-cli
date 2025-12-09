import { getSettingsManager } from "../utils/settings-manager.js";
import { MCPServerConfig } from "./client.js";
import { MCPServerConfigSchema } from "../schemas/settings-schemas.js";
import { ErrorCategory, createErrorMessage } from "../utils/error-handler.js";
import { loadAutomatosXMCPServers, mergeConfigs, getConfigRecommendation, formatMergeResult } from "./automatosx-loader.js";
import { migrateConfig } from "./config-migrator.js";
import { detectConfigFormat } from "./config-detector.js";
import { formatMCPConfigError, formatWarning, formatInfo } from "./error-formatter.js";
import { ZAI_SERVER_NAMES, isZAIServer } from "./zai-templates.js";
import { loadProviderMCPConfig } from "./provider-mcp-loader.js";
import { getAutoDiscoveredServers, detectAutomatosX } from "./automatosx-auto-discovery.js";

export interface MCPConfig {
  servers: MCPServerConfig[];
}

// Track if we've already shown migration warnings this session
let hasShownMigrationWarnings = false;
// Track which REPL warnings we've already shown
const shownReplWarnings = new Set<string>();

/**
 * Commands that require at least one argument to avoid starting a REPL.
 * Without args, these commands start an interactive REPL that waits for input,
 * causing MCP initialization to hang and eventually timeout.
 */
const COMMANDS_REQUIRING_ARGS = ['node', 'python', 'python3', 'deno', 'bun', 'ruby', 'irb'];

/**
 * Check if a server config has a REPL command without arguments.
 * Returns a warning message if problematic, null otherwise.
 */
function checkReplCommand(config: MCPServerConfig): string | null {
  const transport = config.transport;
  if (!transport || transport.type !== 'stdio') return null;

  const command = transport.command;
  if (!command) return null;

  const args = transport.args || [];
  // BUG FIX: Use optional chaining to safely handle edge cases where split
  // might return unexpected results or pop returns undefined
  const commandParts = command.trim().split(/\s+/);
  const baseCommand = commandParts[0]?.split('/').pop() || command;

  if (COMMANDS_REQUIRING_ARGS.includes(baseCommand) && args.length === 0) {
    return (
      `MCP server "${config.name}" uses "${command}" without arguments. ` +
      `This will start a REPL that hangs forever. ` +
      `Add a script file to args or remove this server.`
    );
  }

  return null;
}

/**
 * Apply Z.AI-specific defaults to server configs that were created before these defaults existed.
 * This ensures zai-vision servers get the appropriate timeout and quiet mode settings.
 */
function applyZAIDefaults(config: MCPServerConfig): MCPServerConfig {
  // Only apply to Z.AI servers
  if (!isZAIServer(config.name)) {
    return config;
  }

  // Apply zai-vision specific defaults
  if (config.name === ZAI_SERVER_NAMES.VISION) {
    return {
      ...config,
      // Use npx-friendly timeout (2 minutes) if not explicitly set
      initTimeout: config.initTimeout ?? 120000,
      // Suppress INFO/DEBUG logs by default if not explicitly set
      quiet: config.quiet ?? true,
    };
  }

  return config;
}

/**
 * Load MCP configuration from all sources with validation and auto-migration
 *
 * This function loads MCP servers from multiple sources with the following priority
 * (highest to lowest):
 * 1. Project settings (.ax-glm/settings.json or .ax-grok/settings.json)
 * 2. User settings (~/.ax-glm/config.json or ~/.ax-grok/config.json)
 * 3. Provider MCP config (.ax-glm/.mcp.json or .ax-grok/.mcp.json)
 * 4. AutomatosX config (.automatosx/config.json)
 * 5. Auto-discovered AutomatosX MCP server
 *
 * Legacy formats are auto-migrated to the modern format.
 */
export function loadMCPConfig(): MCPConfig {
  const manager = getSettingsManager();
  const projectSettings = manager.loadProjectSettings();
  const userSettings = manager.loadUserSettings();

  // Load user-level MCP servers (global across all projects)
  // These are typically provider-specific servers like Z.AI MCP servers
  // Stored in: ~/.ax-glm/config.json or ~/.ax-grok/config.json
  const userLevelRawServers = userSettings.mcpServers
    ? Object.values(userSettings.mcpServers)
    : [];

  // Load project-level MCP servers (project-specific)
  // Stored in: .ax-glm/settings.json or .ax-grok/settings.json
  const projectLevelRawServers = projectSettings.mcpServers
    ? Object.values(projectSettings.mcpServers)
    : [];

  // Combine: project-level servers take precedence over user-level servers
  // Put project-level first so they're added first and take precedence
  const combinedRawServers = [...projectLevelRawServers, ...userLevelRawServers];

  // Process combined servers with migration
  // This includes both user-level and project-level servers
  const settingsServers: MCPServerConfig[] = [];
  let hadLegacyFormat = false;
  const seenServerNames = new Set<string>();

  for (const server of combinedRawServers) {
    // Skip duplicate servers (project-level takes precedence since it's processed first)
    const serverName = (server as any)?.name;
    if (serverName && seenServerNames.has(serverName)) {
      continue; // Skip - a higher-priority server with this name was already added
    }
    // Note: We add to seenServerNames AFTER successful processing, not before
    // This allows fallback to user-level servers if project-level validation fails

    // Detect format
    const detection = detectConfigFormat(server);

    if (detection.isLegacy) {
      hadLegacyFormat = true;

      // Auto-migrate legacy format
      const migration = migrateConfig(server);

      if (migration.success && migration.migratedConfig) {
        // Check for REPL commands that would hang
        const replWarning = checkReplCommand(migration.migratedConfig);
        if (replWarning) {
          if (!shownReplWarnings.has(migration.migratedConfig.name)) {
            shownReplWarnings.add(migration.migratedConfig.name);
            console.warn(formatWarning('Skipping problematic MCP server:', [replWarning]));
          }
          continue; // Skip this server instead of causing timeout
        }
        // Apply Z.AI-specific defaults (timeout, quiet mode)
        settingsServers.push(applyZAIDefaults(migration.migratedConfig));
        // Mark as seen only after successful processing
        if (serverName) seenServerNames.add(serverName);

        if (!hasShownMigrationWarnings) {
          console.warn(
            formatWarning(
              `Legacy MCP config format detected for "${(server as any)?.name || 'unknown'}"`,
              [
                'Auto-migrated to new format (temporary - not saved to file)',
                'Please update your config with: ax mcp migrate',
                'See: https://docs.ax-cli.dev/mcp/migration'
              ]
            )
          );
        }
      } else {
        // Migration failed - use formatted error
        if (detection.issues.length > 0 && !hasShownMigrationWarnings) {
          console.warn(
            formatMCPConfigError(
              (server as any)?.name || 'unknown',
              { issues: detection.issues.map(i => ({ path: [], message: i })) } as any
            )
          );
        }
      }
    } else {
      // Modern format - validate
      const result = MCPServerConfigSchema.safeParse(server);

      if (result.success && result.data) {
        // Check for REPL commands that would hang
        const replWarning = checkReplCommand(result.data as MCPServerConfig);
        if (replWarning) {
          const currentServerName = (result.data as MCPServerConfig).name;
          if (!shownReplWarnings.has(currentServerName)) {
            shownReplWarnings.add(currentServerName);
            console.warn(formatWarning('Skipping problematic MCP server:', [replWarning]));
          }
          continue; // Skip this server instead of causing timeout
        }
        // Apply Z.AI-specific defaults (timeout, quiet mode)
        settingsServers.push(applyZAIDefaults(result.data as MCPServerConfig));
        // Mark as seen only after successful processing
        if (serverName) seenServerNames.add(serverName);
      } else {
        // Show user-friendly error instead of technical validation error
        if (!hasShownMigrationWarnings && result.error) {
          console.warn(
            formatMCPConfigError(
              (server as any)?.name || 'unknown',
              result.error
            )
          );
        }
      }
    }
  }

  // Load provider-specific MCP config following Claude Code best practices:
  // 1. .ax-glm/.mcp.json or .ax-grok/.mcp.json (Claude Code format - recommended)
  // 2. .ax-glm/mcp-config.json or .ax-grok/mcp-config.json (legacy format)
  // This ensures ax-glm and ax-grok use their own config directories
  const providerMCPResult = loadProviderMCPConfig();
  const providerMCPServers = providerMCPResult.serverConfigs;

  if (providerMCPResult.found && !hasShownMigrationWarnings) {
    if (providerMCPResult.error) {
      console.warn(
        formatWarning('Provider MCP config found but has errors:', [providerMCPResult.error])
      );
    }

    if (providerMCPResult.warnings.length > 0 && process.env.DEBUG) {
      providerMCPResult.warnings.forEach(warning => {
        console.warn(formatInfo(warning));
      });
    }
  }

  // Load AutomatosX servers from .automatosx/config.json (legacy location)
  const automatosXResult = loadAutomatosXMCPServers();

  if (automatosXResult.found && !hasShownMigrationWarnings) {
    if (automatosXResult.errors.length > 0) {
      console.warn(
        formatWarning('AutomatosX config found but has errors:', automatosXResult.errors)
      );
    }

    if (automatosXResult.warnings.length > 0 && process.env.DEBUG) {
      automatosXResult.warnings.forEach(warning => {
        console.warn(formatInfo(warning));
      });
    }
  }

  // Auto-discover AutomatosX MCP server if installed
  // This provides seamless integration when AutomatosX is available
  // BUT skip auto-discovery if an "automatosx" server is already configured
  // (to avoid duplicate servers: "automatosx" from .mcp.json + "automatosx-{provider}" from auto-discovery)
  const hasExistingAutomatosX =
    providerMCPServers.some(s => s.name === 'automatosx' || s.name.startsWith('automatosx-')) ||
    automatosXResult.servers.some(s => s.name === 'automatosx' || s.name.startsWith('automatosx-')) ||
    settingsServers.some(s => s.name === 'automatosx' || s.name.startsWith('automatosx-'));

  const autoDiscoveredServers = hasExistingAutomatosX ? [] : getAutoDiscoveredServers();
  const autoDiscoveryDetection = detectAutomatosX();

  if (autoDiscoveredServers.length > 0 && !hasShownMigrationWarnings && process.env.DEBUG) {
    console.log(formatInfo(
      `Auto-discovered AutomatosX MCP (v${autoDiscoveryDetection.version || 'unknown'})`
    ));
  }

  // Merge all config sources with priority (highest to lowest):
  // 1. Settings servers (project + user settings - already merged above)
  // 2. Provider-specific MCP config (.ax-glm/.mcp.json or .ax-grok/.mcp.json)
  // 3. AutomatosX config (.automatosx/config.json)
  // 4. Auto-discovered AutomatosX MCP server
  let finalServers: MCPServerConfig[];

  // Start with auto-discovered servers (lowest priority)
  let mergedServers = autoDiscoveredServers;

  // Merge AutomatosX config servers (higher priority than auto-discovered)
  if (automatosXResult.found && automatosXResult.servers.length > 0) {
    const automatosXMergeResult = mergeConfigs(automatosXResult.servers, mergedServers);
    mergedServers = automatosXMergeResult.servers;
  }

  // Merge provider-specific MCP servers (higher priority than AutomatosX)
  if (providerMCPServers.length > 0) {
    const providerMergeResult = mergeConfigs(providerMCPServers, mergedServers);
    mergedServers = providerMergeResult.servers;

    if (!hasShownMigrationWarnings && process.env.DEBUG) {
      console.log(formatInfo(`Loaded ${providerMCPServers.length} server(s) from provider MCP config`));
    }
  }

  // Merge settings servers (highest priority - from project and user config)
  if (settingsServers.length > 0 || mergedServers.length > 0) {
    const settingsMergeResult = mergeConfigs(settingsServers, mergedServers);
    finalServers = settingsMergeResult.servers;

    // Show merge info only in debug mode or if there are conflicts
    if (!hasShownMigrationWarnings && (settingsMergeResult.conflicts.length > 0 || process.env.DEBUG)) {
      if (process.env.DEBUG) {
        console.log(formatMergeResult(settingsMergeResult));
      }

      const recommendation = getConfigRecommendation(settingsMergeResult);
      if (recommendation && settingsMergeResult.conflicts.length > 0) {
        console.warn(formatInfo(recommendation));
      }
    }
  } else {
    finalServers = settingsServers;
  }

  // Mark that we've shown warnings this session
  if (hadLegacyFormat || automatosXResult.found || providerMCPResult.found || autoDiscoveredServers.length > 0) {
    hasShownMigrationWarnings = true;
  }

  return { servers: finalServers };
}

/**
 * Reset migration warning flag (useful for testing)
 */
export function resetMigrationWarnings(): void {
  hasShownMigrationWarnings = false;
  shownReplWarnings.clear();
}

export function saveMCPConfig(config: MCPConfig): void {
  const manager = getSettingsManager();
  const mcpServers: Record<string, MCPServerConfig> = {};

  // Convert servers array to object keyed by name
  for (const server of config.servers) {
    mcpServers[server.name] = server;
  }

  manager.updateProjectSetting('mcpServers', mcpServers);
}

export function addMCPServer(config: MCPServerConfig): void {
  // Validate server config before adding
  const validationResult = MCPServerConfigSchema.safeParse(config);
  if (!validationResult.success) {
    throw new Error(
      createErrorMessage(
        ErrorCategory.VALIDATION,
        `Adding MCP server "${config.name}"`,
        validationResult.error || 'Invalid server configuration'
      )
    );
  }

  const manager = getSettingsManager();
  const projectSettings = manager.loadProjectSettings();
  const mcpServers = projectSettings.mcpServers || {};

  // Type narrowing: validationResult.success is true, so data is defined
  if (validationResult.data) {
    mcpServers[config.name] = validationResult.data;
    manager.updateProjectSetting('mcpServers', mcpServers);
  }
}

export function removeMCPServer(serverName: string): void {
  const manager = getSettingsManager();
  const projectSettings = manager.loadProjectSettings();
  const mcpServers = projectSettings.mcpServers;

  if (mcpServers) {
    delete mcpServers[serverName];
    manager.updateProjectSetting('mcpServers', mcpServers);
  }
}

export function getMCPServer(serverName: string): MCPServerConfig | undefined {
  const manager = getSettingsManager();
  const projectSettings = manager.loadProjectSettings();
  return projectSettings.mcpServers?.[serverName];
}

/**
 * Add an MCP server to user-level settings (global across all projects)
 *
 * Use this for provider-specific MCP servers (like Z.AI) that should be available
 * regardless of which project directory the user is in.
 *
 * User-level servers are stored in ~/.ax-glm/config.json or ~/.ax-grok/config.json
 * and are loaded with lower priority than project-level servers.
 */
export function addUserMCPServer(config: MCPServerConfig): void {
  // Validate server config before adding
  const validationResult = MCPServerConfigSchema.safeParse(config);
  if (!validationResult.success) {
    throw new Error(
      createErrorMessage(
        ErrorCategory.VALIDATION,
        `Adding user-level MCP server "${config.name}"`,
        validationResult.error || 'Invalid server configuration'
      )
    );
  }

  const manager = getSettingsManager();
  const userSettings = manager.loadUserSettings();
  const mcpServers = userSettings.mcpServers || {};

  // Type narrowing: validationResult.success is true, so data is defined
  if (validationResult.data) {
    mcpServers[config.name] = validationResult.data;
    manager.saveUserSettings({ mcpServers });
  }
}

/**
 * Remove an MCP server from user-level settings
 */
export function removeUserMCPServer(serverName: string): void {
  const manager = getSettingsManager();
  const userSettings = manager.loadUserSettings();
  const mcpServers = userSettings.mcpServers;

  if (mcpServers) {
    delete mcpServers[serverName];
    manager.saveUserSettings({ mcpServers });
  }
}

/**
 * Get an MCP server from user-level settings
 */
export function getUserMCPServer(serverName: string): MCPServerConfig | undefined {
  const manager = getSettingsManager();
  const userSettings = manager.loadUserSettings();
  return userSettings.mcpServers?.[serverName];
}

// Import templates
export { TEMPLATES as PREDEFINED_SERVERS, getTemplate, hasTemplate, generateConfigFromTemplate } from './templates.js';
