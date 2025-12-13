#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { program } from "commander";
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
import { createSetupCommand } from "./commands/setup.js";
import { createUsageCommand } from "./commands/usage.js";
import { createTemplatesCommand } from "./commands/templates.js";
import { createMemoryCommand } from "./commands/memory.js";
import { createCacheCommand } from "./commands/cache.js";
import { createModelsCommand } from "./commands/models.js";
import { createDoctorCommand } from "./commands/doctor.js";
import { createStatusCommand } from "./commands/status.js";
import { createVSCodeCommand } from "./commands/vscode.js";
import { getVersionString } from "./utils/version.js";
import { migrateCommandHistory } from "./utils/history-migration.js";
import { AGENT_CONFIG } from "./constants.js";
import { getVSCodeIPCClient, disposeVSCodeIPCClient } from "./ipc/index.js";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";

// Load environment variables (quiet mode to suppress dotenv v17+ output)
dotenv.config({ quiet: true });

// Set process title for terminal display (shows "ax-cli" instead of "node")
process.title = 'ax-cli';

// Global agent tracker for cleanup on exit
let activeAgent: LLMAgent | null = null;

// Disable default SIGINT handling to let Ink handle Ctrl+C
// We'll handle exit through the input system instead

process.on("SIGTERM", () => {
  // Clean up active agent if exists
  if (activeAgent) {
    activeAgent.dispose();
    activeAgent = null;
  }

  // Restore terminal to normal mode before exit
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    try {
      process.stdin.setRawMode(false);
    } catch {
      // Ignore errors when setting raw mode
    }
  }
  console.log("\nGracefully shutting down...");
  process.exit(0);
});

// Handle uncaught exceptions to prevent hanging
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  // Clean up active agent before exit
  if (activeAgent) {
    try {
      activeAgent.dispose();
    } catch {
      // Ignore cleanup errors during emergency shutdown
    }
    activeAgent = null;
  }
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
  // Clean up active agent before exit
  if (activeAgent) {
    try {
      activeAgent.dispose();
    } catch {
      // Ignore cleanup errors during emergency shutdown
    }
    activeAgent = null;
  }
  process.exit(1);
});

// Ensure user settings are initialized
function ensureUserSettingsDirectory(): void {
  try {
    const manager = getSettingsManager();
    // This will create default settings if they don't exist
    manager.loadUserSettings();
  } catch {
    // Silently ignore errors during setup
  }
}

// Check if configuration is valid and complete
function isConfigValid(): boolean {
  try {
    const manager = getSettingsManager();
    const apiKey = manager.getApiKey();
    const baseURL = manager.getBaseURL();
    const model = manager.getCurrentModel();

    // All required fields must be present and non-empty
    return !!(apiKey && apiKey.trim() && baseURL && baseURL.trim() && model && model.trim());
  } catch {
    return false;
  }
}

// Load API key from user settings if not in environment
function loadApiKey(): string | undefined {
  const manager = getSettingsManager();
  return manager.getApiKey();
}

// Load base URL from user settings if not in environment
function loadBaseURL(): string | undefined {
  const manager = getSettingsManager();
  return manager.getBaseURL();
}

// Save command line settings to user settings file
async function saveCommandLineSettings(
  apiKey?: string,
  baseURL?: string
): Promise<void> {
  try {
    const manager = getSettingsManager();

    // Update with command line values
    if (apiKey) {
      manager.updateUserSetting("apiKey", apiKey);
      console.log(`✅ API key saved to ${manager.getUserSettingsPath()}`);
    }
    if (baseURL) {
      manager.updateUserSetting("baseURL", baseURL);
      console.log(`✅ Base URL saved to ${manager.getUserSettingsPath()}`);
    }
  } catch (error) {
    console.warn(
      "⚠️ Could not save settings to file:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// Load model from user settings if not in environment
function loadModel(): string | undefined {
  // First check environment variables
  let model = process.env.AI_MODEL;

  if (!model) {
    // Use the unified model loading from settings manager
    try {
      const manager = getSettingsManager();
      model = manager.getCurrentModel();
    } catch {
      // Ignore errors, model will remain undefined
    }
  }

  return model;
}

// Handle commit-and-push command in headless mode
async function handleCommitAndPushHeadless(
  apiKey: string,
  baseURL?: string,
  model?: string,
  maxToolRounds?: number
): Promise<void> {
  let agent: LLMAgent | null = null;
  try {
    agent = new LLMAgent(apiKey, baseURL, model, maxToolRounds);

    // Configure confirmation service for headless mode (auto-approve all operations)
    const confirmationService = ConfirmationService.getInstance();
    confirmationService.setSessionFlag("allOperations", true);

    console.log("🤖 Processing commit and push...\n");
    console.log("> /commit-and-push\n");

    // First check if there are any changes at all
    const initialStatusResult = await agent.executeBashCommand(
      "git status --porcelain"
    );

    if (!initialStatusResult.success || !initialStatusResult.output?.trim()) {
      console.log("❌ No changes to commit. Working directory is clean.");
      process.exit(1);
    }

    console.log("✅ git status: Changes detected");

    // Add all changes
    const addResult = await agent.executeBashCommand("git add .");

    if (!addResult.success) {
      console.log(
        `❌ git add: ${addResult.error || "Failed to stage changes"}`
      );
      process.exit(1);
    }

    console.log("✅ git add: Changes staged");

    // Get staged changes for commit message generation
    const diffResult = await agent.executeBashCommand("git diff --cached");

    // Generate commit message using AI
    const commitPrompt = `Generate a concise, professional git commit message for these changes:

Git Status:
${initialStatusResult.output}

Git Diff (staged changes):
${diffResult.output || "No staged changes shown"}

Follow conventional commit format (feat:, fix:, docs:, etc.) and keep it under 72 characters.
Respond with ONLY the commit message, no additional text.`;

    console.log("🤖 Generating commit message...");

    const commitMessageEntries = await agent.processUserMessage(commitPrompt);
    let commitMessage = "";

    // Extract the commit message from the AI response
    for (const entry of commitMessageEntries) {
      if (entry.type === "assistant" && entry.content.trim()) {
        commitMessage = entry.content.trim();
        break;
      }
    }

    if (!commitMessage) {
      console.log("❌ Failed to generate commit message");
      process.exit(1);
    }

    // Clean the commit message (remove leading/trailing quotes)
    const cleanCommitMessage = commitMessage.replace(/^["']|["']$/g, "");

    // Remove newlines to ensure single-line commit message
    const singleLineMessage = cleanCommitMessage.replace(/\n/g, " ").trim();

    console.log(`✅ Generated commit message: "${singleLineMessage}"`);

    // Execute the commit with proper shell escaping to prevent injection
    // Use single quotes and escape any single quotes in the message
    const escapedMessage = `'${singleLineMessage.replace(/'/g, "'\\''")}'`;
    const commitCommand = `git commit -m ${escapedMessage}`;
    const commitResult = await agent.executeBashCommand(commitCommand);

    if (commitResult.success) {
      // Safely extract first line with proper fallback
      const firstLine = commitResult.output?.split("\n").filter(line => line.trim())?.[0];
      console.log(
        `✅ git commit: ${firstLine || "Commit successful"}`
      );

      // If commit was successful, push to remote
      // First try regular push, if it fails try with upstream setup
      let pushResult = await agent.executeBashCommand("git push");

      if (
        !pushResult.success &&
        pushResult.error?.includes("no upstream branch")
      ) {
        console.log("🔄 Setting upstream and pushing...");
        pushResult = await agent.executeBashCommand("git push -u origin HEAD");
      }

      if (pushResult.success) {
        // Safely extract first line with proper fallback
        const firstLine = pushResult.output?.split("\n").filter(line => line.trim())?.[0];
        console.log(
          `✅ git push: ${firstLine || "Push successful"}`
        );
      } else {
        console.log(`❌ git push: ${pushResult.error || "Push failed"}`);
        process.exit(1);
      }
    } else {
      console.log(`❌ git commit: ${commitResult.error || "Commit failed"}`);
      process.exit(1);
    }
  } catch (error: unknown) {
    console.error("❌ Error during commit and push:", extractErrorMessage(error));
    process.exit(1);
  } finally {
    // Clean up agent resources
    if (agent) {
      agent.dispose();
    }
  }
}

// Build context from VSCode integration flags
async function buildContextFromFlags(options: {
  file?: string;
  selection?: string;
  lineRange?: string;
  gitDiff?: boolean;
}): Promise<string> {
  const contextParts: string[] = [];

  // Add file context
  if (options.file) {
    try {
      const fs = await import("fs/promises");
      const path = await import("path");

      // SECURITY FIX: Prevent path traversal attacks
      // Resolve to absolute path and ensure it's within current working directory or explicitly allowed paths
      const filePath = path.resolve(options.file);
      const cwd = process.cwd();

      // Check if resolved path is within current working directory
      if (!filePath.startsWith(cwd)) {
        contextParts.push(`Error: Access denied. File must be within current working directory.`);
        // Skip to next iteration
      } else {
        // Validate file exists and is not a directory
        try {
          const stats = await fs.stat(filePath);
          if (stats.isDirectory()) {
            contextParts.push(`Error: ${options.file} is a directory, not a file.`);
            // Skip reading
          } else {
            let fileContent = await fs.readFile(filePath, "utf-8");

            // Apply line range if specified
            if (options.lineRange) {
              const match = options.lineRange.match(/^(\d+)-(\d+)$/);
              if (match) {
                const startLine = parseInt(match[1], 10);
                const endLine = parseInt(match[2], 10);

                // Validate parsed integers are valid numbers
                if (Number.isNaN(startLine) || Number.isNaN(endLine)) {
                  contextParts.push(`Error: Invalid line range format. Expected format: START-END (e.g., 10-20).`);
                } else {
                  const lines = fileContent.split("\n");

                  // Validate line range
                  if (startLine < 1 || startLine > lines.length) {
                    contextParts.push(`Error: Invalid start line ${startLine}. File has ${lines.length} lines.`);
                  } else if (endLine < startLine) {
                    contextParts.push(`Error: Invalid line range ${startLine}-${endLine}. End line must be >= start line.`);
                  } else {
                    // Clamp endLine to file length
                    const validEndLine = Math.min(endLine, lines.length);
                    fileContent = lines.slice(startLine - 1, validEndLine).join("\n");
                    contextParts.push(`File: ${filePath} (lines ${startLine}-${validEndLine}):\n\`\`\`\n${fileContent}\n\`\`\``);
                  }
                }
              } else {
                contextParts.push(`File: ${filePath}:\n\`\`\`\n${fileContent}\n\`\`\``);
              }
            } else {
              contextParts.push(`File: ${filePath}:\n\`\`\`\n${fileContent}\n\`\`\``);
            }
          }
        } catch (statError: unknown) {
          contextParts.push(`Error accessing file ${options.file}: ${extractErrorMessage(statError)}`);
        }
      }
    } catch (error: unknown) {
      contextParts.push(`Error reading file ${options.file}: ${extractErrorMessage(error)}`);
    }
  }

  // Add selection context
  if (options.selection) {
    contextParts.push(`Selected code:\n\`\`\`\n${options.selection}\n\`\`\``);
  }

  // Add git diff context
  if (options.gitDiff) {
    try {
      const { execSync } = await import("child_process");
      const gitDiff = execSync("git diff", {
        encoding: "utf-8",
        timeout: 10000, // 10 second timeout to prevent hanging
        maxBuffer: 10 * 1024 * 1024 // 10MB max buffer for large diffs
      });
      if (gitDiff.trim()) {
        contextParts.push(`Git diff:\n\`\`\`diff\n${gitDiff}\n\`\`\``);
      }
    } catch (error: unknown) {
      contextParts.push(`Error getting git diff: ${extractErrorMessage(error)}`);
    }
  }

  return contextParts.join("\n\n");
}

// Headless mode processing function
async function processPromptHeadless(
  prompt: string,
  apiKey: string,
  baseURL?: string,
  model?: string,
  maxToolRounds?: number,
  options?: {
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

    // Configure thinking mode: CLI flag takes priority, then settings
    if (options?.think === true) {
      agent.setThinkingConfig({ type: "enabled" });
    } else if (options?.think === false) {
      agent.setThinkingConfig({ type: "disabled" });
    } else {
      // No CLI flag - check settings (env > project > user)
      const manager = getSettingsManager();
      const thinkingSettings = manager.getThinkingSettings();
      if (thinkingSettings?.enabled === true) {
        agent.setThinkingConfig({ type: "enabled" });
      } else if (thinkingSettings?.enabled === false) {
        agent.setThinkingConfig({ type: "disabled" });
      }
    }

    // Configure confirmation service for headless mode (auto-approve all operations)
    const confirmationService = ConfirmationService.getInstance();
    confirmationService.setSessionFlag("allOperations", true);

    // Build context from VSCode flags
    let fullPrompt = prompt;
    if (options && (options.file || options.selection || options.gitDiff)) {
      const context = await buildContextFromFlags(options);
      if (context) {
        fullPrompt = `${context}\n\n${prompt}`;
      }
    }

    // Process the user message
    const chatEntries = await agent.processUserMessage(fullPrompt);

    // Convert chat entries to OpenAI compatible message objects
    const messages: ChatCompletionMessageParam[] = [];

    for (const entry of chatEntries) {
      switch (entry.type) {
        case "user":
          messages.push({
            role: "user",
            content: entry.content,
          });
          break;

        case "assistant":
          const assistantMessage: ChatCompletionMessageParam = {
            role: "assistant",
            content: entry.content,
          };

          // Add tool calls if present
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
              tool_call_id: entry.toolCall.id,
              content: entry.content,
            });
          }
          break;
      }
    }

    // Output based on format flag
    if (options?.json) {
      // JSON output mode for IDE integration
      const response = {
        messages: messages,
        model: agent.getCurrentModel(),
        timestamp: new Date().toISOString(),
      };
      console.log(JSON.stringify(response, null, options.vscode ? 2 : 0));
    } else {
      // Standard output (existing behavior)
      for (const message of messages) {
        console.log(JSON.stringify(message));
      }
    }
  } catch (error: unknown) {
    const errorMessage = extractErrorMessage(error);
    const errorType = error instanceof Error ? error.constructor.name : 'Error';
    if (options?.json) {
      // JSON error output for IDE integration
      console.log(
        JSON.stringify({
          error: {
            message: errorMessage,
            type: errorType,
          },
          timestamp: new Date().toISOString(),
        }, null, options.vscode ? 2 : 0)
      );
    } else {
      // Standard error output
      console.log(
        JSON.stringify({
          role: "assistant",
          content: `Error: ${errorMessage}`,
        })
      );
    }
    process.exit(1);
  } finally {
    // Clean up agent resources
    if (agent) {
      agent.dispose();
    }
  }
}

program
  .name("ax-cli")
  .description(
    "Enterprise-Class AI Command Line Interface - Primary support for GLM (General Language Model) with multi-provider AI orchestration"
  )
  .version(getVersionString(), "-v, --version", "output the current version")
  // Enable positional options parsing - options after a subcommand are parsed by that subcommand
  // This fixes conflicts between global --json and subcommand --json options
  .enablePositionalOptions()
  .argument("[message...]", "Initial message to send to AI")
  .option("-d, --directory <dir>", "set working directory", process.cwd())
  .option("-k, --api-key <key>", "AI API key (or set YOUR_API_KEY env var)")
  .option(
    "-u, --base-url <url>",
    "AI API base URL (or set AI_BASE_URL env var)"
  )
  .option(
    "-m, --model <model>",
    "AI model to use (e.g., glm-4.6, llama3.1:8b, gpt-4) (or set AI_MODEL env var)"
  )
  .option(
    "-p, --prompt <prompt>",
    "process a single prompt and exit (headless mode)"
  )
  .option(
    "--max-tool-rounds <rounds>",
    `maximum number of tool execution rounds (default: ${AGENT_CONFIG.MAX_TOOL_ROUNDS})`,
    String(AGENT_CONFIG.MAX_TOOL_ROUNDS)
  )
  .option(
    "-c, --continue",
    "continue the most recent conversation from the current directory"
  )
  // Thinking/Reasoning Options
  .option(
    "--think",
    "enable thinking/reasoning mode for complex tasks (GLM-4.6)"
  )
  .option(
    "--no-think",
    "disable thinking mode (use standard responses)"
  )
  // Sampling/Reproducibility Options
  .option(
    "--deterministic",
    "enable deterministic mode (do_sample=false) for reproducible outputs"
  )
  .option(
    "--seed <number>",
    "random seed for reproducible sampling (implies --deterministic)"
  )
  .option(
    "--top-p <number>",
    "nucleus sampling parameter (0.0-1.0, alternative to temperature)"
  )
  // VSCode Integration Flags (Phase 1)
  .option("--json", "output responses in JSON format (for IDE integration)")
  .option("--file <path>", "include file context from specified path")
  .option("--selection <text>", "include selected text as context")
  .option("--line-range <range>", "include specific line range (e.g., 10-20)")
  .option("--git-diff", "include git diff as context")
  .option("--vscode", "optimize output for VSCode integration")
  // Agent-First Mode Flags
  .option("--no-agent", "bypass agent-first mode, use direct LLM")
  .option("--agent <name>", "force use of specific AutomatosX agent (e.g., backend, frontend, security)")
  .action(async (message, options) => {
    if (options.directory) {
      try {
        process.chdir(options.directory);
      } catch (error: unknown) {
        console.error(
          `Error changing directory to ${options.directory}:`,
          extractErrorMessage(error)
        );
        process.exit(1);
      }
    }

    try {
      // Check if running in interactive mode (no prompt, api-key, or base-url flags)
      const isInteractiveMode = !options.prompt && !options.apiKey && !options.baseUrl;

      // If interactive mode and config is invalid, automatically run setup
      if (isInteractiveMode && !isConfigValid()) {
        console.log("⚠️  Configuration file not found or incomplete.\n");
        console.log("Let's set up AX CLI first...\n");

        // Import and run setup command
        const { createSetupCommand } = await import("./commands/setup.js");
        const setupCommand = createSetupCommand();

        // Run setup command with empty args (will prompt user)
        await setupCommand.parseAsync(["node", "ax-cli", "setup"], { from: "user" });

        // After setup completes, re-check config
        if (!isConfigValid()) {
          console.error("\n❌ Setup did not complete successfully. Please try again.");
          process.exit(1);
        }

        console.log("\n");
      }

      // Get API key from options, environment, or user settings
      const apiKey = options.apiKey || loadApiKey();
      const baseURL = options.baseUrl || loadBaseURL();

      const model = options.model || loadModel();

      const parsedMaxToolRounds = options.maxToolRounds ? parseInt(options.maxToolRounds.toString(), 10) : AGENT_CONFIG.MAX_TOOL_ROUNDS;
      const maxToolRounds = Number.isFinite(parsedMaxToolRounds) && parsedMaxToolRounds > 0 ? parsedMaxToolRounds : AGENT_CONFIG.MAX_TOOL_ROUNDS;

      if (!apiKey) {
        console.error(
          "❌ Error: API key required. Set YOUR_API_KEY environment variable, use --api-key flag, or save to ~/.ax-cli/config.json"
        );
        process.exit(1);
      }

      // Save API key and base URL to user settings if provided via command line
      if (options.apiKey || options.baseUrl) {
        await saveCommandLineSettings(options.apiKey, options.baseUrl);
      }

      // Headless mode: process prompt and exit
      if (options.prompt) {
        await processPromptHeadless(
          options.prompt,
          apiKey,
          baseURL,
          model,
          maxToolRounds,
          {
            json: options.json,
            file: options.file,
            selection: options.selection,
            lineRange: options.lineRange,
            gitDiff: options.gitDiff,
            vscode: options.vscode,
            think: options.think,
          }
        );
        return;
      }

      // Interactive mode: launch UI
      // Check if stdin supports raw mode (required for Ink)
      if (!process.stdin.isTTY || !process.stdin.setRawMode) {
        console.error("❌ Interactive mode not supported: Terminal does not support raw mode");
        console.error("💡 Use --prompt flag for headless mode instead");
        console.error("   Example: ax-cli --prompt 'your message here'");
        process.exit(1);
      }

      // Check for updates on startup (respects user settings)
      const updateResult = await checkForUpdatesOnStartup();
      if (updateResult.hasUpdate) {
        const updated = await promptAndInstallUpdate(
          updateResult.currentVersion,
          updateResult.latestVersion
        );
        if (updated) {
          // Exit after update so user restarts with new version
          process.exit(0);
        }
      }

      const agent = new LLMAgent(apiKey, baseURL, model, maxToolRounds);
      activeAgent = agent; // Track for cleanup on exit

      // Configure thinking mode: CLI flag takes priority, then settings
      if (options.think === true) {
        agent.setThinkingConfig({ type: "enabled" });
      } else if (options.think === false) {
        agent.setThinkingConfig({ type: "disabled" });
      } else {
        // No CLI flag - check settings (env > project > user)
        const manager = getSettingsManager();
        const thinkingSettings = manager.getThinkingSettings();
        if (thinkingSettings?.enabled === true) {
          agent.setThinkingConfig({ type: "enabled" });
        } else if (thinkingSettings?.enabled === false) {
          agent.setThinkingConfig({ type: "disabled" });
        }
      }

      // Initialize history manager with project directory
      // This ensures history is ALWAYS stored per-project so --continue can find it
      const currentDir = process.cwd();
      const { getHistoryManager } = await import("./utils/history-manager.js");
      // Always create with projectDir so ChatInterface gets the correct singleton
      getHistoryManager(currentDir, true);

      // Handle --continue flag: show status about loaded history
      if (options.continue) {
        const historyManager = getHistoryManager(currentDir);
        const previousHistory = historyManager.loadHistory();

        if (previousHistory.length > 0) {
          console.log(`🔄 Continuing conversation from ${currentDir}`);
          console.log(`📜 Loaded ${previousHistory.length} previous messages\n`);
        } else {
          console.log(`💬 Starting new conversation in ${currentDir}\n`);
        }
      }

      console.log("🤖 Starting AX CLI AI Assistant...\n");

      ensureUserSettingsDirectory();

      // Support variadic positional arguments for multi-word initial message
      const initialMessage = Array.isArray(message)
        ? message.join(" ")
        : message;

      // v3.8.0: Enable bracketed paste mode for reliable paste detection
      // Check if user has enabled it in settings (default: true)
      const manager = getSettingsManager();
      const pasteSettings = manager.getPasteSettings();
      const enableBracketedPaste = pasteSettings.enableBracketedPaste ?? true;

      if (enableBracketedPaste) {
        // Enable bracketed paste mode
        // Terminal will send \x1b[200~ before paste and \x1b[201~ after
        process.stdout.write('\x1b[?2004h');
      }

      const { waitUntilExit } = render(
        React.createElement(ChatInterface, {
          agent,
          initialMessage,
          loadPreviousHistory: options.continue || false,
          agentFirstDisabled: options.agent === false, // --no-agent flag
          forcedAgent: typeof options.agent === 'string' ? options.agent : undefined, // --agent <name>
        })
      );

      // Wait for app to exit and clean up
      await waitUntilExit();

      // Disable bracketed paste mode on exit
      if (enableBracketedPaste) {
        process.stdout.write('\x1b[?2004l');
      }

      if (activeAgent) {
        activeAgent.dispose();
        activeAgent = null;
      }
    } catch (error: unknown) {
      console.error("❌ Error initializing AX CLI:", extractErrorMessage(error));
      process.exit(1);
    }
  });

// Git subcommand
const gitCommand = program
  .command("git")
  .description("Git operations with AI assistance");

gitCommand
  .command("commit-and-push")
  .description("Generate AI commit message and push to remote")
  .option("-d, --directory <dir>", "set working directory", process.cwd())
  .option("-k, --api-key <key>", "AI API key (or set YOUR_API_KEY env var)")
  .option(
    "-u, --base-url <url>",
    "AI API base URL (or set AI_BASE_URL env var)"
  )
  .option(
    "-m, --model <model>",
    "AI model to use (e.g., glm-4.6, llama3.1:8b, gpt-4) (or set AI_MODEL env var)"
  )
  .option(
    "--max-tool-rounds <rounds>",
    `maximum number of tool execution rounds (default: ${AGENT_CONFIG.MAX_TOOL_ROUNDS})`,
    String(AGENT_CONFIG.MAX_TOOL_ROUNDS)
  )
  .action(async (options) => {
    if (options.directory) {
      try {
        process.chdir(options.directory);
      } catch (error: unknown) {
        console.error(
          `Error changing directory to ${options.directory}:`,
          extractErrorMessage(error)
        );
        process.exit(1);
      }
    }

    try {
      // Get API key from options, environment, or user settings
      const apiKey = options.apiKey || loadApiKey();
      const baseURL = options.baseUrl || loadBaseURL();
      const model = options.model || loadModel();
      const parsedMaxToolRounds = options.maxToolRounds ? parseInt(options.maxToolRounds.toString(), 10) : AGENT_CONFIG.MAX_TOOL_ROUNDS;
      const maxToolRounds = Number.isFinite(parsedMaxToolRounds) && parsedMaxToolRounds > 0 ? parsedMaxToolRounds : AGENT_CONFIG.MAX_TOOL_ROUNDS;

      if (!apiKey) {
        console.error(
          "❌ Error: API key required. Set YOUR_API_KEY environment variable, use --api-key flag, or save to ~/.ax-cli/config.json"
        );
        process.exit(1);
      }

      // Save API key and base URL to user settings if provided via command line
      if (options.apiKey || options.baseUrl) {
        await saveCommandLineSettings(options.apiKey, options.baseUrl);
      }

      await handleCommitAndPushHeadless(apiKey, baseURL, model, maxToolRounds);
    } catch (error: unknown) {
      console.error("❌ Error during git commit-and-push:", extractErrorMessage(error));
      process.exit(1);
    }
  });

// MCP command (with migration subcommand)
const mcpCommand = createMCPCommand();
mcpCommand.addCommand(createMCPMigrateCommand());
program.addCommand(mcpCommand);

// Frontend command (workflows for front-end development)
program.addCommand(createFrontendCommand());

// Init command
program.addCommand(createInitCommand());

// Templates command
program.addCommand(createTemplatesCommand());

// Memory command
program.addCommand(createMemoryCommand());

// Update command
program.addCommand(createUpdateCommand());

// Setup command
program.addCommand(createSetupCommand());

// Usage command
program.addCommand(createUsageCommand());

// Cache command
program.addCommand(createCacheCommand());

// Models command
program.addCommand(createModelsCommand());

// Doctor command
program.addCommand(createDoctorCommand());

// Status command
program.addCommand(createStatusCommand());

// VSCode command
program.addCommand(createVSCodeCommand());


// Run migration for command history security fix (only runs once)
migrateCommandHistory();

// Try to connect to VS Code extension IPC (async, non-blocking)
// This enables diff preview in VS Code when the extension is running
const ipcClient = getVSCodeIPCClient();
ipcClient.connect().catch(() => {
  // Silently ignore connection failures - CLI works standalone
});

// Cleanup IPC on exit
process.on('exit', () => {
  disposeVSCodeIPCClient();
});

program.parse();
