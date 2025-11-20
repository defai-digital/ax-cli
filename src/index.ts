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
import { createInitCommand } from "./commands/init.js";
import { createUpdateCommand } from "./commands/update.js";
import { createSetupCommand } from "./commands/setup.js";
import { createUsageCommand } from "./commands/usage.js";
import { createTemplatesCommand } from "./commands/templates.js";
import { createMemoryCommand } from "./commands/memory.js";
import { createCacheCommand } from "./commands/cache.js";
import { getVersion } from "./utils/version.js";
import type { ChatCompletionMessageParam } from "openai/resources/chat.js";

// Load environment variables
dotenv.config();

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
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
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
      const firstLine = commitResult.output?.split("\n").filter(line => line.trim())[0];
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
        const firstLine = pushResult.output?.split("\n").filter(line => line.trim())[0];
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
  } catch (error: any) {
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
      const filePath = path.resolve(options.file);
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
    } catch (error: any) {
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
      const gitDiff = execSync("git diff", { encoding: "utf-8" });
      if (gitDiff.trim()) {
        contextParts.push(`Git diff:\n\`\`\`diff\n${gitDiff}\n\`\`\``);
      }
    } catch (error: any) {
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
  }
): Promise<void> {
  let agent: LLMAgent | null = null;
  try {
    agent = new LLMAgent(apiKey, baseURL, model, maxToolRounds);

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
  } catch (error: any) {
    if (options?.json) {
      // JSON error output for IDE integration
      console.log(
        JSON.stringify({
          error: {
            message: error.message,
            type: error.constructor.name,
          },
          timestamp: new Date().toISOString(),
        }, null, options.vscode ? 2 : 0)
      );
    } else {
      // Standard error output
      console.log(
        JSON.stringify({
          role: "assistant",
          content: `Error: ${error.message}`,
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
  .version(getVersion(), "-v, --version", "output the current version")
  .argument("[message...]", "Initial message to send to AI")
  .option("-d, --directory <dir>", "set working directory", process.cwd())
  .option("-k, --api-key <key>", "AI API key (or set YOUR_API_KEY env var)")
  .option(
    "-u, --base-url <url>",
    "AI API base URL (or set AI_BASE_URL env var)"
  )
  .option(
    "-m, --model <model>",
    "AI model to use (e.g., grok-code-fast-1, grok-4-latest) (or set AI_MODEL env var)"
  )
  .option(
    "-p, --prompt <prompt>",
    "process a single prompt and exit (headless mode)"
  )
  .option(
    "--max-tool-rounds <rounds>",
    "maximum number of tool execution rounds (default: 400)",
    "400"
  )
  // VSCode Integration Flags (Phase 1)
  .option("--json", "output responses in JSON format (for IDE integration)")
  .option("--file <path>", "include file context from specified path")
  .option("--selection <text>", "include selected text as context")
  .option("--line-range <range>", "include specific line range (e.g., 10-20)")
  .option("--git-diff", "include git diff as context")
  .option("--vscode", "optimize output for VSCode integration")
  .action(async (message, options) => {
    if (options.directory) {
      try {
        process.chdir(options.directory);
      } catch (error: any) {
        console.error(
          `Error changing directory to ${options.directory}:`,
          error.message
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
      const parsedMaxToolRounds = options.maxToolRounds ? parseInt(options.maxToolRounds.toString(), 10) : 400;
      const maxToolRounds = Number.isFinite(parsedMaxToolRounds) && parsedMaxToolRounds > 0 ? parsedMaxToolRounds : 400;

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
          }
        );
        return;
      }

      // Interactive mode: launch UI
      const agent = new LLMAgent(apiKey, baseURL, model, maxToolRounds);
      activeAgent = agent; // Track for cleanup on exit
      console.log("🤖 Starting AX CLI AI Assistant...\n");

      ensureUserSettingsDirectory();

      // Support variadic positional arguments for multi-word initial message
      const initialMessage = Array.isArray(message)
        ? message.join(" ")
        : message;

      const { waitUntilExit } = render(React.createElement(ChatInterface, { agent, initialMessage }));

      // Wait for app to exit and clean up
      await waitUntilExit();
      if (activeAgent) {
        activeAgent.dispose();
        activeAgent = null;
      }
    } catch (error: any) {
      console.error("❌ Error initializing AX CLI:", error.message);
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
    "AI model to use (e.g., grok-code-fast-1, grok-4-latest) (or set AI_MODEL env var)"
  )
  .option(
    "--max-tool-rounds <rounds>",
    "maximum number of tool execution rounds (default: 400)",
    "400"
  )
  .action(async (options) => {
    if (options.directory) {
      try {
        process.chdir(options.directory);
      } catch (error: any) {
        console.error(
          `Error changing directory to ${options.directory}:`,
          error.message
        );
        process.exit(1);
      }
    }

    try {
      // Get API key from options, environment, or user settings
      const apiKey = options.apiKey || loadApiKey();
      const baseURL = options.baseUrl || loadBaseURL();
      const model = options.model || loadModel();
      const parsedMaxToolRounds = options.maxToolRounds ? parseInt(options.maxToolRounds.toString(), 10) : 400;
      const maxToolRounds = Number.isFinite(parsedMaxToolRounds) && parsedMaxToolRounds > 0 ? parsedMaxToolRounds : 400;

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
    } catch (error: any) {
      console.error("❌ Error during git commit-and-push:", error.message);
      process.exit(1);
    }
  });

// MCP command
program.addCommand(createMCPCommand());

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

program.parse();
