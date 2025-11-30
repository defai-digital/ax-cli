/**
 * Models command - List available AI models
 */

import { Command } from "commander";
import chalk from "chalk";
import { GLM_MODELS } from "../constants.js";
import { getSettingsManager } from "../utils/settings-manager.js";
import { formatTokenCount } from "../utils/token-counter.js";
import { extractErrorMessage } from "../utils/error-handler.js";

export function createModelsCommand(): Command {
  const modelsCmd = new Command("models")
    .alias("model")
    .description("List available AI models and provider information");

  modelsCmd
    .command("list")
    .description("List all available models")
    .option("--provider <name>", "Filter by provider (glm, ollama, openai, anthropic)")
    .option("--json", "Output in JSON format")
    .action(async (options) => {
      try {
        const manager = getSettingsManager();
        const currentModel = manager.getCurrentModel();
        const baseURL = manager.getBaseURL();

        // Predefined models from configuration
        const predefinedModels = Object.entries(GLM_MODELS).map(([id, config]) => ({
          id,
          name: config.name,
          provider: "Z.AI (GLM)",
          contextWindow: config.contextWindow,
          maxOutputTokens: config.maxOutputTokens,
          supportsThinking: config.supportsThinking,
          current: id === currentModel,
        }));

        // Add Ollama models if configured
        const customModels: any[] = [];
        if (baseURL?.includes("localhost:11434") || baseURL?.includes("ollama")) {
          customModels.push({
            id: "llama3.1:8b",
            name: "Llama 3.1 8B",
            provider: "Ollama (Local)",
            contextWindow: 128000,
            maxOutputTokens: 128000,
            supportsThinking: false,
            current: currentModel === "llama3.1:8b",
            note: "Example - run 'ollama list' to see your installed models",
          });
          customModels.push({
            id: "codellama",
            name: "Code Llama",
            provider: "Ollama (Local)",
            contextWindow: 16000,
            maxOutputTokens: 16000,
            supportsThinking: false,
            current: currentModel === "codellama",
            note: "Example - run 'ollama list' to see your installed models",
          });
        }

        // Add OpenAI models if configured
        if (baseURL?.includes("api.openai.com")) {
          customModels.push({
            id: "gpt-4-turbo",
            name: "GPT-4 Turbo",
            provider: "OpenAI",
            contextWindow: 128000,
            maxOutputTokens: 4096,
            supportsThinking: false,
            current: currentModel === "gpt-4-turbo",
          });
          customModels.push({
            id: "gpt-4o",
            name: "GPT-4o",
            provider: "OpenAI",
            contextWindow: 128000,
            maxOutputTokens: 4096,
            supportsThinking: false,
            current: currentModel === "gpt-4o",
          });
        }

        const allModels = [...predefinedModels, ...customModels];

        // Filter by provider if specified
        let filteredModels = allModels;
        if (options.provider) {
          const providerLower = options.provider.toLowerCase();
          filteredModels = allModels.filter(m =>
            m.provider.toLowerCase().includes(providerLower)
          );
        }

        if (options.json) {
          console.log(JSON.stringify(filteredModels, null, 2));
          return;
        }

        // Display models in a formatted table
        console.log(chalk.bold("\n📋 Available AI Models\n"));

        console.log(chalk.dim("Current configuration:"));
        console.log(chalk.dim(`  Base URL: ${baseURL || "not configured"}`));
        console.log(chalk.dim(`  Model: ${currentModel || "not configured"}`));
        console.log();

        if (filteredModels.length === 0) {
          console.log(chalk.yellow("No models found matching the criteria."));
          return;
        }

        // Group by provider
        const grouped = filteredModels.reduce((acc, model) => {
          if (!acc[model.provider]) {
            acc[model.provider] = [];
          }
          acc[model.provider].push(model);
          return acc;
        }, {} as Record<string, typeof filteredModels>);

        for (const [provider, models] of Object.entries(grouped)) {
          console.log(chalk.bold.cyan(`\n${provider}:`));

          for (const model of (models as typeof filteredModels)) {
            const marker = model.current ? chalk.green("➤ ") : "  ";
            const nameDisplay = model.current
              ? chalk.green.bold(model.id)
              : chalk.white(model.id);

            console.log(`${marker}${nameDisplay}`);
            console.log(chalk.dim(`    Context: ${formatTokenCount(model.contextWindow, { suffix: true, uppercase: true })} | Max Output: ${formatTokenCount(model.maxOutputTokens, { suffix: true, uppercase: true })}`));

            if (model.supportsThinking) {
              console.log(chalk.dim("    Features: ") + chalk.yellow("✨ Thinking Mode"));
            }

            if (model.note) {
              console.log(chalk.dim(`    Note: ${model.note}`));
            }
          }
        }

        console.log();
        console.log(chalk.dim("\nTips:"));
        console.log(chalk.dim("  • Use --provider to filter by provider (e.g., --provider glm)"));
        console.log(chalk.dim("  • For Ollama models, run 'ollama list' to see installed models"));
        console.log(chalk.dim("  • Switch models with: ax-cli -m <model-name>"));
        console.log(chalk.dim("  • Configure default with: ax-cli setup"));
        console.log();

      } catch (error: any) {
        console.error(chalk.red("Error listing models:"), extractErrorMessage(error));
        process.exit(1);
      }
    });

  modelsCmd
    .command("info <model-id>")
    .description("Show detailed information about a specific model")
    .action(async (modelId: string) => {
      try {
        const model = GLM_MODELS[modelId as keyof typeof GLM_MODELS];

        if (!model) {
          console.log(chalk.yellow(`\nModel "${modelId}" is not a predefined model.`));
          console.log(chalk.dim("This may be a custom model (e.g., from Ollama or another provider)."));
          console.log(chalk.dim("\nFor custom models, refer to your provider's documentation."));
          process.exit(0);
        }

        console.log(chalk.bold(`\n📄 Model Information: ${modelId}\n`));
        console.log(chalk.cyan("Name:"), model.name);
        console.log(chalk.cyan("Context Window:"), formatTokenCount(model.contextWindow, { suffix: true, uppercase: true }));
        console.log(chalk.cyan("Max Output Tokens:"), formatTokenCount(model.maxOutputTokens, { suffix: true, uppercase: true }));
        console.log(chalk.cyan("Default Max Tokens:"), formatTokenCount(model.defaultMaxTokens, { suffix: true, uppercase: true }));
        console.log(chalk.cyan("Default Temperature:"), model.defaultTemperature);
        console.log(chalk.cyan("Temperature Range:"), `${model.temperatureRange.min} - ${model.temperatureRange.max}`);
        console.log(chalk.cyan("Thinking Mode:"), model.supportsThinking ? chalk.green("✓ Supported") : chalk.dim("Not supported"));
        console.log(chalk.cyan("Token Efficiency:"), `${model.tokenEfficiency}x`);
        console.log();

      } catch (error: any) {
        console.error(chalk.red("Error fetching model info:"), extractErrorMessage(error));
        process.exit(1);
      }
    });

  return modelsCmd;
}
