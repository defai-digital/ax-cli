/**
 * Doctor command - Diagnose AX CLI configuration and environment
 * Checks API configuration, file system, MCP servers, models, and dependencies
 */

import { Command } from "commander";
import chalk from "chalk";
import { existsSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import OpenAI from "openai";
import { getSettingsManager } from "../utils/settings-manager.js";
import { GLM_MODELS, CONFIG_PATHS } from "../constants.js";
import {
  detectZAIServices,
  isGLMModel,
  isZAIBaseURL,
  ZAI_SERVER_NAMES,
  ZAI_MCP_TEMPLATES,
} from "../mcp/index.js";
import { parseJsonFile } from "../utils/json-utils.js";
import { formatTokenCount } from "../utils/token-counter.js";
import { extractErrorMessage } from "../utils/error-handler.js";
import type { ProjectSettings, UserSettings } from "../schemas/settings-schemas.js";

const execAsync = promisify(exec);

interface CheckResult {
  name: string;
  status: "pass" | "warning" | "fail";
  message: string;
  details?: string[];
  suggestion?: string;
}

export function createDoctorCommand(): Command {
  const doctorCmd = new Command("doctor")
    .description("Diagnose AX CLI configuration and environment")
    .option("--json", "Output results in JSON format")
    .option("--verbose", "Show detailed diagnostic information")
    .action(async (options) => {
      try {
        console.log(chalk.bold.cyan("\n🏥 AX CLI Doctor - Running diagnostics...\n"));

        const results: CheckResult[] = [];

        // 1. Check Node.js version
        results.push(await checkNodeVersion());

        // 2. Check config files
        results.push(...checkConfigFiles());

        // 3. Check API configuration
        results.push(...await checkApiConfiguration());

        // 4. Check model configuration
        results.push(checkModelConfiguration());

        // 5. Check MCP servers
        results.push(...await checkMCPServers());

        // 6. Check Z.AI MCP integration (if using Z.AI)
        results.push(...await checkZAIMCPStatus());

        // 7. Check dependencies
        results.push(...await checkDependencies());

        // Output results
        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
        } else {
          displayResults(results, options.verbose);
        }

        // Exit code based on results
        const hasFailures = results.some(r => r.status === "fail");
        process.exit(hasFailures ? 1 : 0);

      } catch (error: any) {
        console.error(chalk.red("\n❌ Doctor command failed:"), extractErrorMessage(error));
        process.exit(1);
      }
    });

  return doctorCmd;
}

/**
 * Check Node.js version
 */
async function checkNodeVersion(): Promise<CheckResult> {
  const currentVersion = process.version;
  const majorVersion = parseInt(currentVersion.slice(1).split('.')?.[0] || '0', 10);
  const requiredVersion = 24;

  if (majorVersion >= requiredVersion) {
    return {
      name: "Node.js Version",
      status: "pass",
      message: `${currentVersion}`,
      details: [`Required: Node.js ${requiredVersion}+`],
    };
  }

  return {
    name: "Node.js Version",
    status: "fail",
    message: `${currentVersion} (requires ${requiredVersion}+)`,
    suggestion: `Upgrade Node.js to version ${requiredVersion} or higher`,
  };
}

/**
 * Check configuration files
 */
function checkConfigFiles(): CheckResult[] {
  const results: CheckResult[] = [];

  // User config - use centralized path constant
  if (existsSync(CONFIG_PATHS.USER_CONFIG)) {
    const parseResult = parseJsonFile<UserSettings>(CONFIG_PATHS.USER_CONFIG);
    if (parseResult.success) {
      results.push({
        name: "User Config File",
        status: "pass",
        message: "Found and valid",
        details: [`Location: ${CONFIG_PATHS.USER_CONFIG}`],
      });
    } else {
      results.push({
        name: "User Config File",
        status: "fail",
        message: "Found but corrupted",
        details: [`Location: ${CONFIG_PATHS.USER_CONFIG}`, `Error: ${parseResult.error}`],
        suggestion: "Run 'ax-cli setup' to recreate configuration",
      });
    }
  } else {
    results.push({
      name: "User Config File",
      status: "warning",
      message: "Not found",
      details: [`Expected location: ${CONFIG_PATHS.USER_CONFIG}`],
      suggestion: "Run 'ax-cli setup' to create configuration",
    });
  }

  // Project settings - use centralized path constant
  if (existsSync(CONFIG_PATHS.PROJECT_SETTINGS)) {
    const parseResult = parseJsonFile<ProjectSettings>(CONFIG_PATHS.PROJECT_SETTINGS);
    if (parseResult.success) {
      results.push({
        name: "Project Settings",
        status: "pass",
        message: "Found and valid",
        details: [`Location: ${CONFIG_PATHS.PROJECT_SETTINGS}`],
      });
    } else {
      results.push({
        name: "Project Settings",
        status: "warning",
        message: "Found but corrupted",
        details: [`Location: ${CONFIG_PATHS.PROJECT_SETTINGS}`, `Error: ${parseResult.error}`],
        suggestion: "Run 'ax-cli init' to recreate project settings",
      });
    }
  } else {
    results.push({
      name: "Project Settings",
      status: "pass",
      message: "Not configured (using user settings)",
      details: [`Optional: ${CONFIG_PATHS.PROJECT_SETTINGS}`],
    });
  }

  return results;
}

/**
 * Check API configuration
 */
async function checkApiConfiguration(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const manager = getSettingsManager();

  // API Key
  const apiKey = manager.getApiKey();
  if (apiKey && apiKey.trim()) {
    results.push({
      name: "API Key",
      status: "pass",
      message: "Configured",
      details: [`Length: ${apiKey.length} characters`],
    });
  } else {
    results.push({
      name: "API Key",
      status: "fail",
      message: "Not configured",
      suggestion: "Run 'ax-cli setup' to configure API key",
    });
  }

  // Base URL
  const baseURL = manager.getBaseURL();
  if (baseURL && baseURL.trim()) {
    // Test reachability
    const reachable = await testEndpointReachability(baseURL);
    if (reachable.success) {
      results.push({
        name: "Base URL",
        status: "pass",
        message: "Configured and reachable",
        details: [`URL: ${baseURL}`],
      });
    } else {
      results.push({
        name: "Base URL",
        status: "warning",
        message: "Configured but unreachable",
        details: [`URL: ${baseURL}`, `Error: ${reachable.error}`],
        suggestion: "Check internet connection or firewall settings",
      });
    }
  } else {
    results.push({
      name: "Base URL",
      status: "fail",
      message: "Not configured",
      suggestion: "Run 'ax-cli setup' to configure base URL",
    });
  }

  // Test API with minimal request
  if (apiKey && baseURL) {
    const model = manager.getCurrentModel();
    if (model) {
      const apiTest = await testApiConnection(baseURL, apiKey, model);
      if (apiTest.success) {
        results.push({
          name: "API Connection",
          status: "pass",
          message: "Successfully connected",
          details: [`Model: ${model}`],
        });
      } else {
        results.push({
          name: "API Connection",
          status: "fail",
          message: "Connection failed",
          details: [`Error: ${apiTest.error}`],
          suggestion: "Verify API key and base URL are correct",
        });
      }
    }
  }

  return results;
}

/**
 * Check model configuration
 */
function checkModelConfiguration(): CheckResult {
  const manager = getSettingsManager();
  const model = manager.getCurrentModel();

  if (!model) {
    return {
      name: "Model Configuration",
      status: "fail",
      message: "No model configured",
      suggestion: "Run 'ax-cli setup' to configure default model",
    };
  }

  // Check if model is in predefined list
  const modelConfig = GLM_MODELS[model as keyof typeof GLM_MODELS];
  if (modelConfig) {
    return {
      name: "Model Configuration",
      status: "pass",
      message: `${model} (supported)`,
      details: [
        `Context: ${formatTokenCount(modelConfig.contextWindow, { suffix: true, uppercase: true })}`,
        `Max Output: ${formatTokenCount(modelConfig.maxOutputTokens, { suffix: true, uppercase: true })}`,
        `Thinking: ${modelConfig.supportsThinking ? "Yes" : "No"}`,
      ],
    };
  }

  // Custom model (Ollama, etc)
  return {
    name: "Model Configuration",
    status: "pass",
    message: `${model} (custom)`,
    details: ["This is a custom model not in predefined list"],
  };
}

/**
 * Check MCP servers
 */
async function checkMCPServers(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const manager = getSettingsManager();

  try {
    const projectSettings = manager.loadProjectSettings();
    const mcpServers = projectSettings.mcpServers || {};
    const serverNames = Object.keys(mcpServers);

    if (serverNames.length === 0) {
      results.push({
        name: "MCP Servers",
        status: "pass",
        message: "No MCP servers configured",
        details: ["Optional feature - run 'ax-cli mcp add' to add servers"],
      });
      return results;
    }

    results.push({
      name: "MCP Servers",
      status: "pass",
      message: `${serverNames.length} server(s) configured`,
      details: serverNames.map(name => `• ${name}`),
    });

    // Check each server configuration
    for (const serverName of serverNames) {
      const serverConfig = mcpServers[serverName];
      const hasValidTransport = serverConfig.transport || (serverConfig.command && serverConfig.args);

      if (hasValidTransport) {
        results.push({
          name: `MCP Server: ${serverName}`,
          status: "pass",
          message: "Configuration valid",
          details: serverConfig.transport
            ? [`Transport: ${serverConfig.transport.type}`]
            : [`Command: ${serverConfig.command}`],
        });
      } else {
        results.push({
          name: `MCP Server: ${serverName}`,
          status: "warning",
          message: "Configuration incomplete",
          suggestion: "Check server configuration in .ax-cli/settings.json",
        });
      }
    }

  } catch (error: any) {
    results.push({
      name: "MCP Servers",
      status: "warning",
      message: "Could not check MCP configuration",
      details: [extractErrorMessage(error)],
    });
  }

  return results;
}

/**
 * Check Z.AI MCP integration status
 */
async function checkZAIMCPStatus(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const manager = getSettingsManager();

  // Check if using Z.AI
  const model = manager.getCurrentModel() || "";
  const baseURL = manager.getBaseURL() || "";
  const isZAIUser = isGLMModel(model) || isZAIBaseURL(baseURL);

  if (!isZAIUser) {
    // Not a Z.AI user, skip check
    return results;
  }

  try {
    const status = await detectZAIServices();

    // Check API key
    if (!status.hasApiKey) {
      results.push({
        name: "Z.AI MCP",
        status: "warning",
        message: "API key not configured for Z.AI MCP",
        suggestion: "Set API key with 'ax-cli config set apiKey YOUR_KEY'",
      });
      return results;
    }

    // Check enabled servers
    if (status.enabledServers.length === 0) {
      results.push({
        name: "Z.AI MCP",
        status: "warning",
        message: "No Z.AI MCP servers enabled",
        details: [
          "Available: Web Search, Web Reader, Vision",
          "These provide web access and image analysis capabilities",
        ],
        suggestion: "Enable with 'ax-cli mcp add-zai'",
      });
      return results;
    }

    // Report enabled servers
    const serverDetails = status.enabledServers.map(s => {
      const template = ZAI_MCP_TEMPLATES[s];
      return `• ${template.displayName}`;
    });

    results.push({
      name: "Z.AI MCP",
      status: "pass",
      message: `${status.enabledServers.length} server(s) enabled`,
      details: serverDetails,
    });

    // Check if vision is available but not enabled
    if (!status.enabledServers.includes(ZAI_SERVER_NAMES.VISION)) {
      if (status.nodeVersionOk) {
        results.push({
          name: "Z.AI Vision",
          status: "pass",
          message: "Available (not enabled)",
          details: ["Node.js version is compatible"],
          suggestion: "Enable with 'ax-cli mcp add-zai --server zai-vision'",
        });
      } else {
        results.push({
          name: "Z.AI Vision",
          status: "warning",
          message: "Not available",
          details: [`Requires Node.js 22+, you have v${status.nodeVersion}`],
        });
      }
    }

  } catch (error: any) {
    results.push({
      name: "Z.AI MCP",
      status: "warning",
      message: "Could not check Z.AI MCP status",
      details: [extractErrorMessage(error)],
    });
  }

  return results;
}

/**
 * Check dependencies
 */
async function checkDependencies(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check ripgrep (for search tool)
  const rgCheck = await checkCommand("rg --version");
  if (rgCheck.found) {
    results.push({
      name: "ripgrep (search)",
      status: "pass",
      message: "Installed",
      details: rgCheck.version ? [`Version: ${rgCheck.version}`] : undefined,
    });
  } else {
    results.push({
      name: "ripgrep (search)",
      status: "warning",
      message: "Not found",
      suggestion: "Install ripgrep for faster file search: brew install ripgrep",
    });
  }

  // Check git
  const gitCheck = await checkCommand("git --version");
  if (gitCheck.found) {
    results.push({
      name: "git",
      status: "pass",
      message: "Installed",
      details: gitCheck.version ? [`Version: ${gitCheck.version}`] : undefined,
    });
  } else {
    results.push({
      name: "git",
      status: "warning",
      message: "Not found",
      details: ["Required for git operations"],
      suggestion: "Install git: https://git-scm.com/downloads",
    });
  }

  return results;
}

/**
 * Test endpoint reachability
 */
async function testEndpointReachability(baseURL: string): Promise<{ success: boolean; error?: string }> {
  try {
    // For local endpoints, check if service is running
    if (baseURL.includes("localhost") || baseURL.includes("127.0.0.1")) {
      const response = await fetch(baseURL.replace("/v1", "") + "/api/version", {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        return { success: true };
      }

      return {
        success: false,
        error: "Local service not responding",
      };
    }

    // For remote endpoints, try a simple request
    const response = await fetch(baseURL + "/models", {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    // Any response means endpoint is reachable
    if (response.status === 401 || response.status === 403 || response.ok) {
      return { success: true };
    }

    return {
      success: false,
      error: `Server returned ${response.status}`,
    };

  } catch (error: any) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      return { success: false, error: "Connection timeout" };
    }

    if (error?.code === "ECONNREFUSED") {
      return { success: false, error: "Connection refused" };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Test API connection with minimal request
 */
async function testApiConnection(
  baseURL: string,
  apiKey: string,
  model: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = new OpenAI({
      baseURL,
      apiKey,
      timeout: 10000, // 10 second timeout
    });

    await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "test" }],
      max_tokens: 1,
    });

    return { success: true };

  } catch (error: any) {
    let errorMessage = error instanceof Error ? error.message : "Connection failed";

    if (error?.status === 401) {
      errorMessage = "Invalid or expired API key";
    } else if (error?.status === 403) {
      errorMessage = "API key lacks required permissions";
    } else if (error?.status === 404) {
      errorMessage = "Model not found";
    } else if (error?.error?.message) {
      errorMessage = error.error.message;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Check if a command exists
 */
async function checkCommand(
  command: string
): Promise<{ found: boolean; version?: string }> {
  try {
    const { stdout } = await execAsync(command, { timeout: 3000 });
    const lines = stdout.trim().split("\n");
    const version = lines.length > 0 ? lines[0] : undefined;
    return { found: true, version };
  } catch {
    return { found: false };
  }
}

/**
 * Display results in formatted output
 */
function displayResults(results: CheckResult[], verbose: boolean): void {
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  console.log(chalk.bold("Diagnostic Results:\n"));

  for (const result of results) {
    let icon: string;
    let color: (text: string) => string;

    switch (result.status) {
      case "pass":
        icon = "✓";
        color = chalk.green;
        passCount++;
        break;
      case "warning":
        icon = "⚠";
        color = chalk.yellow;
        warnCount++;
        break;
      case "fail":
        icon = "✗";
        color = chalk.red;
        failCount++;
        break;
    }

    console.log(color(`${icon} ${result.name}: ${result.message}`));

    if (verbose && result.details) {
      result.details.forEach(detail => {
        console.log(chalk.dim(`    ${detail}`));
      });
    }

    if (result.suggestion) {
      console.log(chalk.cyan(`    💡 ${result.suggestion}`));
    }

    console.log();
  }

  // Summary
  console.log(chalk.bold("\nSummary:"));
  console.log(chalk.green(`  ✓ ${passCount} passed`));
  if (warnCount > 0) {
    console.log(chalk.yellow(`  ⚠ ${warnCount} warnings`));
  }
  if (failCount > 0) {
    console.log(chalk.red(`  ✗ ${failCount} failed`));
  }

  console.log();

  if (failCount === 0 && warnCount === 0) {
    console.log(chalk.green.bold("✅ All checks passed! AX CLI is configured correctly.\n"));
  } else if (failCount > 0) {
    console.log(chalk.red.bold("❌ Some checks failed. Please address the issues above.\n"));
  } else {
    console.log(chalk.yellow.bold("⚠️  Some warnings detected. Review suggestions above.\n"));
  }
}
