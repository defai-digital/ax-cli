/**
 * CLI Factory
 *
 * Creates provider-specific CLI instances that share the same core functionality.
 * ax-glm and ax-grok use this to create their CLIs with provider-specific defaults.
 */

import React from "react";
import { render } from "ink";
import { Command } from "commander";
import * as dotenv from "dotenv";
import { LLMAgent } from "./agent/llm-agent.js";
import ChatInterface from "./ui/components/chat-interface.js";
import { getSettingsManager } from "./utils/settings-manager.js";
import { ConfirmationService } from "./utils/confirmation-service.js";
import { extractErrorMessage } from "./utils/error-handler.js";
import { createMCPCommand } from "./commands/mcp.js";
import { createMCPMigrateCommand } from "./commands/mcp-migrate.js";
import { createFrontendCommand } from "./commands/frontend.js";
import { createInitCommand } from "./commands/init.js";
import { createUpdateCommand, checkForUpdatesOnStartup, promptAndInstallUpdate } from "./commands/update.js";
import { createProviderSetupCommand } from "./commands/setup-provider.js";
import { createUsageCommand } from "./commands/usage.js";
import { createTemplatesCommand } from "./commands/templates.js";
import { createMemoryCommand } from "./commands/memory.js";
import { createCacheCommand } from "./commands/cache.js";
import { createModelsCommand } from "./commands/models.js";
import { createDoctorCommand } from "./commands/doctor.js";
import { createStatusCommand } from "./commands/status.js";
import { createVSCodeCommand } from "./commands/vscode.js";
import { createDesignCommand } from "./commands/design.js";
import { getVersionString } from "./utils/version.js";
import { migrateCommandHistory } from "./utils/history-migration.js";
import { AGENT_CONFIG } from "./constants.js";
import { getVSCodeIPCClient, disposeVSCodeIPCClient } from "./ipc/index.js";
import type { ProviderDefinition } from "./provider/config.js";
import { getApiKeyFromEnv, setActiveProviderConfigPaths } from "./provider/config.js";

// Load environment variables (quiet mode to suppress dotenv v17+ output)
dotenv.config({ quiet: true });

/**
 * CLI Factory Options
 */
export interface CLIFactoryOptions {
  /** Provider definition */
  provider: ProviderDefinition;
  /** Optional version override */
  version?: string;
}

// Global agent tracker for cleanup on exit
let activeAgent: LLMAgent | null = null;

/**
 * Setup global handlers
 */
function setupGlobalHandlers(): void {
  process.on("SIGTERM", () => {
    if (activeAgent) {
      activeAgent.dispose();
      activeAgent = null;
    }
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      try {
        process.stdin.setRawMode(false);
      } catch {
        // Ignore errors
      }
    }
    console.log("\nGracefully shutting down...");
    process.exit(0);
  });

  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    if (activeAgent) {
      try {
        activeAgent.dispose();
      } catch {
        // Ignore cleanup errors
      }
      activeAgent = null;
    }
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled rejection at:", promise, "reason:", reason);
    if (activeAgent) {
      try {
        activeAgent.dispose();
      } catch {
        // Ignore cleanup errors
      }
      activeAgent = null;
    }
    process.exit(1);
  });
}

/**
 * Create a CLI for a specific provider
 */
export function createCLI(options: CLIFactoryOptions): Command {
  const { provider } = options;
  const cliName = provider.branding.cliName;
  const version = options.version || getVersionString();

  // Set provider-specific config paths BEFORE any settings access
  // This ensures SettingsManager uses the correct paths (e.g., ~/.ax-glm or ~/.ax-grok)
  setActiveProviderConfigPaths(provider);

  // Set process title
  process.title = cliName;

  // Setup global handlers
  setupGlobalHandlers();

  // Create the program
  const cli = new Command();

  cli
    .name(cliName)
    .description(provider.branding.description)
    .version(version, "-v, --version", "output the current version")
    .enablePositionalOptions()
    .argument("[message...]", "Initial message to send to AI")
    .option("-d, --directory <dir>", "set working directory", process.cwd())
    .option("-k, --api-key <key>", `API key (or set ${provider.apiKeyEnvVar} env var)`)
    .option("-u, --base-url <url>", `API base URL (default: ${provider.defaultBaseURL})`)
    .option("-m, --model <model>", `Model to use (default: ${provider.defaultModel})`)
    .option("-p, --prompt <prompt>", "process a single prompt and exit (headless mode)")
    .option("--max-tool-rounds <rounds>", `maximum tool rounds (default: ${AGENT_CONFIG.MAX_TOOL_ROUNDS})`, String(AGENT_CONFIG.MAX_TOOL_ROUNDS))
    .option("-c, --continue", "continue the most recent conversation")
    .option("--json", "output responses in JSON format")
    .option("--file <path>", "include file context from specified path")
    .option("--selection <text>", "include selected text as context")
    .option("--line-range <range>", "include specific line range (e.g., 10-20)")
    .option("--git-diff", "include git diff as context")
    .option("--vscode", "optimize output for VSCode integration")
    .option("--no-agent", "bypass agent-first mode, use direct LLM")
    .option("--agent <name>", "force use of specific agent");

  // Add provider-specific options
  if (provider.features.supportsThinking) {
    cli.option("--think", "enable thinking/reasoning mode for complex tasks");
    cli.option("--no-think", "disable thinking mode");
  }

  if (provider.features.supportsSeed) {
    cli.option("--deterministic", "enable deterministic mode for reproducible outputs");
    cli.option("--seed <number>", "random seed for reproducible sampling");
  }

  cli.option("--top-p <number>", "nucleus sampling parameter (0.0-1.0)");

  // Main action
  cli.action(async (message, cliOptions) => {
    if (cliOptions.directory) {
      try {
        process.chdir(cliOptions.directory);
      } catch (error: unknown) {
        console.error(`Error changing directory to ${cliOptions.directory}:`, extractErrorMessage(error));
        process.exit(1);
      }
    }

    try {
      const manager = getSettingsManager();

      // Get API key: CLI flag > env var > settings
      let apiKey = cliOptions.apiKey || getApiKeyFromEnv(provider) || manager.getApiKey();

      // Get base URL: CLI flag > settings > provider default
      const baseURL = cliOptions.baseUrl || manager.getBaseURL() || provider.defaultBaseURL;

      // Get model: CLI flag > settings > provider default
      const model = cliOptions.model || manager.getCurrentModel() || provider.defaultModel;

      // Parse max tool rounds
      const parsedMaxToolRounds = cliOptions.maxToolRounds ? parseInt(cliOptions.maxToolRounds.toString(), 10) : AGENT_CONFIG.MAX_TOOL_ROUNDS;
      const maxToolRounds = Number.isFinite(parsedMaxToolRounds) && parsedMaxToolRounds > 0 ? parsedMaxToolRounds : AGENT_CONFIG.MAX_TOOL_ROUNDS;

      // Check if we need setup
      const isInteractiveMode = !cliOptions.prompt && !cliOptions.apiKey;
      if (isInteractiveMode && !apiKey) {
        console.log(`\n⚠️  ${cliName} is not configured yet.\n`);
        console.log(`Please run: ${cliName} setup\n`);
        process.exit(1);
      }

      if (!apiKey) {
        console.error(`❌ Error: API key required. Set ${provider.apiKeyEnvVar} environment variable or use --api-key flag`);
        process.exit(1);
      }

      // Headless mode
      if (cliOptions.prompt) {
        await processPromptHeadless(
          cliOptions.prompt,
          apiKey,
          baseURL,
          model,
          maxToolRounds,
          provider,
          {
            json: cliOptions.json,
            file: cliOptions.file,
            selection: cliOptions.selection,
            lineRange: cliOptions.lineRange,
            gitDiff: cliOptions.gitDiff,
            vscode: cliOptions.vscode,
            think: cliOptions.think,
          }
        );
        return;
      }

      // Interactive mode checks
      if (!process.stdin.isTTY || !process.stdin.setRawMode) {
        console.error("❌ Interactive mode not supported: Terminal does not support raw mode");
        console.error(`💡 Use --prompt flag for headless mode instead`);
        console.error(`   Example: ${cliName} --prompt 'your message here'`);
        process.exit(1);
      }

      // Check for updates
      const updateResult = await checkForUpdatesOnStartup();
      if (updateResult.hasUpdate) {
        const updated = await promptAndInstallUpdate(updateResult.currentVersion, updateResult.latestVersion);
        if (updated) {
          process.exit(0);
        }
      }

      // Create agent
      const agent = new LLMAgent(apiKey, baseURL, model, maxToolRounds);
      activeAgent = agent;

      // Configure thinking mode if supported
      if (provider.features.supportsThinking) {
        if (cliOptions.think === true) {
          agent.setThinkingConfig({ type: "enabled" });
        } else if (cliOptions.think === false) {
          agent.setThinkingConfig({ type: "disabled" });
        } else {
          const thinkingSettings = manager.getThinkingSettings();
          if (thinkingSettings?.enabled === true) {
            agent.setThinkingConfig({ type: "enabled" });
          } else if (thinkingSettings?.enabled === false) {
            agent.setThinkingConfig({ type: "disabled" });
          }
        }
      }

      // Initialize history manager with project directory
      // This ensures history is ALWAYS stored per-project so --continue can find it
      const currentDir = process.cwd();
      const { getHistoryManager } = await import("./utils/history-manager.js");
      // Always create with projectDir so ChatInterface gets the correct singleton
      getHistoryManager(currentDir, true);

      // Handle --continue flag: show status about loaded history
      if (cliOptions.continue) {
        const historyManager = getHistoryManager(currentDir);
        const previousHistory = historyManager.loadHistory();

        if (previousHistory.length > 0) {
          console.log(`🔄 Continuing conversation from ${currentDir}`);
          console.log(`📜 Loaded ${previousHistory.length} previous messages\n`);
        } else {
          console.log(`💬 Starting new conversation in ${currentDir}\n`);
        }
      }

      console.log(provider.branding.welcomeMessage + "\n");

      // Support variadic positional arguments
      const initialMessage = Array.isArray(message) ? message.join(" ") : message;

      // Bracketed paste mode
      const pasteSettings = manager.getPasteSettings();
      const enableBracketedPaste = pasteSettings.enableBracketedPaste ?? true;

      if (enableBracketedPaste) {
        process.stdout.write('\x1b[?2004h');
      }

      const { waitUntilExit } = render(
        React.createElement(ChatInterface, {
          agent,
          initialMessage,
          loadPreviousHistory: cliOptions.continue || false,
          agentFirstDisabled: cliOptions.agent === false,
          forcedAgent: typeof cliOptions.agent === 'string' ? cliOptions.agent : undefined,
          cliName: provider.branding.cliName,
          branding: {
            cliName: provider.branding.cliName,
            primaryColor: provider.branding.primaryColor,
            secondaryColor: provider.branding.secondaryColor,
            asciiLogo: provider.branding.asciiLogo,
            tagline: provider.branding.tagline,
          },
        })
      );

      await waitUntilExit();

      if (enableBracketedPaste) {
        process.stdout.write('\x1b[?2004l');
      }

      if (activeAgent) {
        activeAgent.dispose();
        activeAgent = null;
      }
    } catch (error: unknown) {
      console.error(`❌ Error initializing ${cliName}:`, extractErrorMessage(error));
      process.exit(1);
    }
  });

  // Add all subcommands
  const mcpCommand = createMCPCommand();
  mcpCommand.addCommand(createMCPMigrateCommand());
  cli.addCommand(mcpCommand);
  cli.addCommand(createFrontendCommand());
  cli.addCommand(createInitCommand());
  cli.addCommand(createTemplatesCommand());
  cli.addCommand(createMemoryCommand());
  cli.addCommand(createUpdateCommand(provider)); // Provider-specific update command
  cli.addCommand(createProviderSetupCommand(provider)); // Provider-specific setup wizard
  cli.addCommand(createUsageCommand());
  cli.addCommand(createCacheCommand());
  cli.addCommand(createModelsCommand());
  cli.addCommand(createDoctorCommand());
  cli.addCommand(createStatusCommand());
  cli.addCommand(createVSCodeCommand());
  cli.addCommand(createDesignCommand());

  // Run migrations
  migrateCommandHistory();

  // Connect to VSCode IPC
  const ipcClient = getVSCodeIPCClient();
  ipcClient.connect().catch(() => {
    // Silently ignore connection failures
  });

  // Cleanup IPC on exit
  process.on('exit', () => {
    disposeVSCodeIPCClient();
  });

  return cli;
}

/**
 * Headless mode processing
 */
async function processPromptHeadless(
  prompt: string,
  apiKey: string,
  baseURL: string,
  model: string,
  maxToolRounds: number,
  provider: ProviderDefinition,
  options: {
    json?: boolean;
    file?: string;
    selection?: string;
    lineRange?: string;
    gitDiff?: boolean;
    vscode?: boolean;
    think?: boolean;
  }
): Promise<void> {
  let agent: LLMAgent | null = null;
  try {
    agent = new LLMAgent(apiKey, baseURL, model, maxToolRounds);

    // Configure thinking mode
    if (provider.features.supportsThinking) {
      if (options.think === true) {
        agent.setThinkingConfig({ type: "enabled" });
      } else if (options.think === false) {
        agent.setThinkingConfig({ type: "disabled" });
      } else {
        const manager = getSettingsManager();
        const thinkingSettings = manager.getThinkingSettings();
        if (thinkingSettings?.enabled === true) {
          agent.setThinkingConfig({ type: "enabled" });
        } else if (thinkingSettings?.enabled === false) {
          agent.setThinkingConfig({ type: "disabled" });
        }
      }
    }

    // Configure confirmation service for headless mode
    const confirmationService = ConfirmationService.getInstance();
    confirmationService.setSessionFlag("allOperations", true);

    // Build context from flags
    let fullPrompt = prompt;
    if (options.file || options.selection || options.gitDiff) {
      const context = await buildContextFromFlags(options);
      if (context) {
        fullPrompt = `${context}\n\n${prompt}`;
      }
    }

    // Process the message
    const chatEntries = await agent.processUserMessage(fullPrompt);

    // Convert to output format
    const messages: Array<{ role: string; content: string; tool_calls?: unknown[] }> = [];

    for (const entry of chatEntries) {
      switch (entry.type) {
        case "user":
          messages.push({ role: "user", content: entry.content });
          break;
        case "assistant":
          const assistantMessage: { role: string; content: string; tool_calls?: unknown[] } = {
            role: "assistant",
            content: entry.content,
          };
          if (entry.toolCalls && entry.toolCalls.length > 0) {
            assistantMessage.tool_calls = entry.toolCalls.map((toolCall) => ({
              id: toolCall.id,
              type: "function",
              function: {
                name: toolCall.function.name,
                arguments: toolCall.function.arguments,
              },
            }));
          }
          messages.push(assistantMessage);
          break;
        case "tool_result":
          if (entry.toolCall) {
            messages.push({
              role: "tool",
              content: entry.content,
            });
          }
          break;
      }
    }

    // Output based on format flag
    if (options.json) {
      const response = {
        messages: messages,
        model: agent.getCurrentModel(),
        timestamp: new Date().toISOString(),
      };
      console.log(JSON.stringify(response, null, options.vscode ? 2 : 0));
    } else {
      for (const message of messages) {
        console.log(JSON.stringify(message));
      }
    }
  } catch (error: unknown) {
    const errorMessage = extractErrorMessage(error);
    const errorType = error instanceof Error ? error.constructor.name : 'Error';
    if (options.json) {
      console.log(JSON.stringify({
        error: { message: errorMessage, type: errorType },
        timestamp: new Date().toISOString(),
      }, null, options.vscode ? 2 : 0));
    } else {
      console.log(JSON.stringify({ role: "assistant", content: `Error: ${errorMessage}` }));
    }
    process.exit(1);
  } finally {
    if (agent) {
      agent.dispose();
    }
  }
}

/**
 * Build context from CLI flags
 */
async function buildContextFromFlags(options: {
  file?: string;
  selection?: string;
  lineRange?: string;
  gitDiff?: boolean;
}): Promise<string> {
  const contextParts: string[] = [];

  if (options.file) {
    try {
      const fs = await import("fs/promises");
      const path = await import("path");
      const filePath = path.resolve(options.file);
      const cwd = process.cwd();

      if (!filePath.startsWith(cwd)) {
        contextParts.push(`Error: Access denied. File must be within current working directory.`);
      } else {
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
          contextParts.push(`Error: ${options.file} is a directory, not a file.`);
        } else {
          let fileContent = await fs.readFile(filePath, "utf-8");

          if (options.lineRange) {
            const match = options.lineRange.match(/^(\d+)-(\d+)$/);
            if (match) {
              const startLine = parseInt(match[1], 10);
              const endLine = parseInt(match[2], 10);
              const lines = fileContent.split("\n");
              const validEndLine = Math.min(endLine, lines.length);
              fileContent = lines.slice(startLine - 1, validEndLine).join("\n");
              contextParts.push(`File: ${filePath} (lines ${startLine}-${validEndLine}):\n\`\`\`\n${fileContent}\n\`\`\``);
            } else {
              contextParts.push(`File: ${filePath}:\n\`\`\`\n${fileContent}\n\`\`\``);
            }
          } else {
            contextParts.push(`File: ${filePath}:\n\`\`\`\n${fileContent}\n\`\`\``);
          }
        }
      }
    } catch (error: unknown) {
      contextParts.push(`Error reading file ${options.file}: ${extractErrorMessage(error)}`);
    }
  }

  if (options.selection) {
    contextParts.push(`Selected code:\n\`\`\`\n${options.selection}\n\`\`\``);
  }

  if (options.gitDiff) {
    try {
      const { execSync } = await import("child_process");
      const gitDiff = execSync("git diff", { encoding: "utf-8", timeout: 10000, maxBuffer: 10 * 1024 * 1024 });
      if (gitDiff.trim()) {
        contextParts.push(`Git diff:\n\`\`\`diff\n${gitDiff}\n\`\`\``);
      }
    } catch (error: unknown) {
      contextParts.push(`Error getting git diff: ${extractErrorMessage(error)}`);
    }
  }

  return contextParts.join("\n\n");
}

/**
 * Run the CLI
 */
export function runCLI(options: CLIFactoryOptions): void {
  const cli = createCLI(options);
  cli.parse();
}
