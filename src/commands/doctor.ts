/**
 * Doctor command - Diagnose AX CLI configuration and environment
 * Checks API configuration, file system, MCP servers, models, and dependencies
 */

import { Command } from "commander";
import chalk from "chalk";
import * as prompts from "@clack/prompts";
import { existsSync, accessSync, constants, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
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
        // JSON mode uses plain output for parsing
        if (options.json) {
          const results: CheckResult[] = [];
          results.push(await checkNodeVersion());
          results.push(...checkConfigFiles());
          results.push(...await checkApiConfiguration());
          results.push(checkModelConfiguration());
          results.push(...await checkMCPServers());
          results.push(...await checkZAIMCPStatus());
          results.push(...await checkDependencies());
          console.log(JSON.stringify(results, null, 2));
          const hasFailures = results.some(r => r.status === "fail");
          process.exit(hasFailures ? 1 : 0);
          return;
        }

        // Interactive mode with @clack/prompts
        prompts.intro(chalk.cyan("AX CLI Doctor"));

        const results: CheckResult[] = [];
        const spinner = prompts.spinner();

        // 1. Check Node.js version
        spinner.start("Checking Node.js version...");
        results.push(await checkNodeVersion());
        spinner.stop(formatCheckResult(results[results.length - 1]));

        // 2. Check config files
        spinner.start("Checking configuration files...");
        const configResults = checkConfigFiles();
        results.push(...configResults);
        spinner.stop(`Configuration: ${configResults.filter(r => r.status === "pass").length}/${configResults.length} OK`);

        // 3. Check API configuration
        spinner.start("Checking API configuration...");
        const apiResults = await checkApiConfiguration();
        results.push(...apiResults);
        spinner.stop(`API: ${apiResults.filter(r => r.status === "pass").length}/${apiResults.length} OK`);

        // 4. Check model configuration
        spinner.start("Checking model configuration...");
        results.push(checkModelConfiguration());
        spinner.stop(formatCheckResult(results[results.length - 1]));

        // 5. Check MCP servers
        spinner.start("Checking MCP servers...");
        const mcpResults = await checkMCPServers();
        results.push(...mcpResults);
        spinner.stop(`MCP: ${mcpResults.length} server(s) checked`);

        // 6. Check Z.AI MCP integration (if using Z.AI)
        spinner.start("Checking Z.AI integration...");
        const zaiResults = await checkZAIMCPStatus();
        results.push(...zaiResults);
        if (zaiResults.length > 0) {
          spinner.stop(`Z.AI: ${zaiResults.filter(r => r.status === "pass").length}/${zaiResults.length} OK`);
        } else {
          spinner.stop("Z.AI: Not applicable");
        }

        // 7. Check dependencies
        spinner.start("Checking dependencies...");
        const depResults = await checkDependencies();
        results.push(...depResults);
        spinner.stop(`Dependencies: ${depResults.filter(r => r.status === "pass").length}/${depResults.length} OK`);

        // Display detailed results
        displayResults(results, options.verbose);

        // Exit code based on results
        const hasFailures = results.some(r => r.status === "fail");
        const hasWarnings = results.some(r => r.status === "warning");

        if (hasFailures) {
          prompts.outro(chalk.red("Some checks failed. Please address the issues above."));
        } else if (hasWarnings) {
          prompts.outro(chalk.yellow("Diagnostics complete with warnings."));
        } else {
          prompts.outro(chalk.green("All checks passed!"));
        }

        process.exit(hasFailures ? 1 : 0);

      } catch (error: unknown) {
        prompts.log.error(`Doctor command failed: ${extractErrorMessage(error)}`);
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

  // Check AutomatosX native module ABI compatibility
  results.push(await checkAutomatosXNativeModules());

  // Check file system permissions
  results.push(...checkFileSystemPermissions());

  return results;
}

/**
 * Check AutomatosX native module ABI compatibility
 * Native modules like better-sqlite3 are compiled for specific Node.js ABI versions
 */
async function checkAutomatosXNativeModules(): Promise<CheckResult> {
  try {
    // Check if AutomatosX is installed
    const axCheck = await checkCommand("ax --version");
    if (!axCheck.found) {
      return {
        name: "AutomatosX Native Modules",
        status: "pass",
        message: "Not applicable (AutomatosX not installed)",
      };
    }

    // Try to run ax to detect ABI issues
    const { stdout, stderr } = await execAsync("ax list agents 2>&1", { timeout: 10000 }).catch(e => ({
      stdout: '',
      stderr: e.message || e.stderr || ''
    }));
    const output = stdout + stderr;

    // Check for common ABI mismatch errors
    if (output.includes("NODE_MODULE_VERSION") || output.includes("was compiled against a different")) {
      const moduleMatch = output.match(/NODE_MODULE_VERSION (\d+)/g);
      const versions = moduleMatch?.map(m => m.match(/\d+/)?.[0]).filter(Boolean) || [];

      return {
        name: "AutomatosX Native Modules",
        status: "fail",
        message: "ABI version mismatch",
        details: [
          `Native modules compiled for different Node.js version`,
          versions.length >= 2 ? `Module ABI: ${versions[0]}, Runtime ABI: ${versions[1]}` : '',
          `Current Node.js: ${process.version}`,
        ].filter(Boolean),
        suggestion: "Rebuild native modules: cd ~/.automatosx && npm rebuild better-sqlite3",
      };
    }

    return {
      name: "AutomatosX Native Modules",
      status: "pass",
      message: "Compatible",
      details: [`Node.js ${process.version} ABI compatible`],
    };

  } catch (error) {
    return {
      name: "AutomatosX Native Modules",
      status: "warning",
      message: "Could not verify",
      details: [extractErrorMessage(error)],
    };
  }
}

/**
 * Check file system permissions for required directories
 */
function checkFileSystemPermissions(): CheckResult[] {
  const results: CheckResult[] = [];

  // Directories to check (deduplicated)
  const dirsToCheck = [
    { path: CONFIG_PATHS.USER_DIR, name: 'AX CLI config directory' },
    { path: join(homedir(), '.automatosx'), name: 'AutomatosX data directory' },
  ];

  for (const { path, name } of dirsToCheck) {
    try {
      // Check if directory exists
      if (!existsSync(path)) {
        // Try to create it
        try {
          mkdirSync(path, { recursive: true });
          results.push({
            name: `Permissions: ${name}`,
            status: "pass",
            message: "Created successfully",
            details: [`Path: ${path}`],
          });
        } catch (createError) {
          results.push({
            name: `Permissions: ${name}`,
            status: "fail",
            message: "Cannot create directory",
            details: [`Path: ${path}`, extractErrorMessage(createError)],
            suggestion: `Check parent directory permissions or create manually: mkdir -p "${path}"`,
          });
        }
        continue;
      }

      // Check read/write permissions
      accessSync(path, constants.R_OK | constants.W_OK);
      results.push({
        name: `Permissions: ${name}`,
        status: "pass",
        message: "Read/write OK",
        details: [`Path: ${path}`],
      });

    } catch (error) {
      const errorMsg = extractErrorMessage(error);
      const isEPERM = errorMsg.includes('EPERM') || errorMsg.includes('permission denied');

      results.push({
        name: `Permissions: ${name}`,
        status: "fail",
        message: isEPERM ? "Permission denied" : "Access error",
        details: [`Path: ${path}`, errorMsg],
        suggestion: isEPERM
          ? `Fix permissions: chmod 755 "${path}" or check if directory is owned by current user`
          : `Check directory access: ls -la "${path}"`,
      });
    }
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
 * Format a single check result for spinner stop message
 */
function formatCheckResult(result: CheckResult): string {
  const icon = result.status === "pass" ? "✓" : result.status === "warning" ? "⚠" : "✗";
  const color = result.status === "pass" ? chalk.green : result.status === "warning" ? chalk.yellow : chalk.red;
  return color(`${icon} ${result.name}: ${result.message}`);
}

/**
 * Display results in formatted output using @clack/prompts
 */
function displayResults(results: CheckResult[], verbose: boolean): void {
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  // Count results
  for (const result of results) {
    if (result.status === "pass") passCount++;
    else if (result.status === "warning") warnCount++;
    else failCount++;
  }

  // Build summary note
  const summaryLines: string[] = [];
  summaryLines.push(chalk.green(`✓ ${passCount} passed`));
  if (warnCount > 0) summaryLines.push(chalk.yellow(`⚠ ${warnCount} warnings`));
  if (failCount > 0) summaryLines.push(chalk.red(`✗ ${failCount} failed`));

  prompts.note(summaryLines.join("\n"), "Summary");

  // Show details for failures and warnings (always), or all if verbose
  const detailResults = verbose
    ? results
    : results.filter(r => r.status !== "pass");

  if (detailResults.length > 0) {
    console.log(); // spacing

    for (const result of detailResults) {
      if (result.status === "pass") {
        prompts.log.success(`${result.name}: ${result.message}`);
      } else if (result.status === "warning") {
        prompts.log.warn(`${result.name}: ${result.message}`);
      } else {
        prompts.log.error(`${result.name}: ${result.message}`);
      }

      if (result.details) {
        result.details.forEach(detail => {
          console.log(chalk.dim(`    ${detail}`));
        });
      }

      if (result.suggestion) {
        prompts.log.info(`  💡 ${result.suggestion}`);
      }
    }
  }
}
