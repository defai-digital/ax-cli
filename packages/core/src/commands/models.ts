/**
 * Models command - List available AI models
 */

import { Command } from "commander";
import chalk from "chalk";
import { getSettingsManager } from "../utils/settings-manager.js";
import { formatTokenCount } from "../utils/token-counter.js";
import { extractErrorMessage } from "../utils/error-handler.js";
import {
  getActiveProvider,
  MODEL_ALIASES,
  resolveModelAlias,
  getAvailableModelsWithAliases,
} from "../provider/config.js";

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
        const activeProvider = getActiveProvider();

        // Predefined models from the active provider's configuration with alias info
        const modelsWithAliases = getAvailableModelsWithAliases(activeProvider);
        const predefinedModels = modelsWithAliases.map(m => ({
          id: m.model,
          alias: m.alias,
          name: activeProvider.models[m.model].name,
          provider: activeProvider.displayName,
          contextWindow: activeProvider.models[m.model].contextWindow,
          maxOutputTokens: activeProvider.models[m.model].maxOutputTokens,
          supportsThinking: activeProvider.models[m.model].supportsThinking,
          supportsVision: activeProvider.models[m.model].supportsVision,
          current: m.model === currentModel || m.alias === currentModel,
          isDefault: m.isDefault,
        }));

        // Add Ollama models if configured
        const customModels: any[] = [];
        // Parse URL hostname for proper domain matching to prevent URL spoofing
        let hostname = '';
        try {
          if (baseURL) {
            hostname = new URL(baseURL).hostname.toLowerCase();
          }
        } catch {
          // Invalid URL, hostname remains empty
        }
        const isOllama = hostname === 'localhost' && baseURL?.includes(':11434') || hostname.includes('ollama');
        if (isOllama) {
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

        // Add OpenAI models if configured (use proper hostname matching)
        const isOpenAI = hostname === 'api.openai.com' || hostname.endsWith('.openai.com');
        if (isOpenAI) {
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

            // Show alias if available
            const aliasDisplay = model.alias
              ? chalk.gray(` (alias: ${chalk.cyan(model.alias)})`)
              : model.isDefault
                ? chalk.gray(" (default)")
                : "";

            console.log(`${marker}${nameDisplay}${aliasDisplay}`);
            console.log(chalk.dim(`    Context: ${formatTokenCount(model.contextWindow, { suffix: true, uppercase: true })} | Max Output: ${formatTokenCount(model.maxOutputTokens, { suffix: true, uppercase: true })}`));

            // Show features
            const features: string[] = [];
            if (model.supportsThinking) features.push(chalk.yellow("✨ Thinking"));
            if (model.supportsVision) features.push(chalk.blue("👁 Vision"));
            if (features.length > 0) {
              console.log(chalk.dim("    Features: ") + features.join(" | "));
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
        const cliName = getActiveProvider().branding.cliName;
        const providerName = activeProvider.name.toLowerCase();
        const exampleAlias = providerName === 'grok' ? 'grok-latest' : 'glm-latest';
        console.log(chalk.dim(`  • Switch models with: ${cliName} -m <model-name>`));
        console.log(chalk.dim(`  • Use aliases for convenience: ${cliName} -m ${exampleAlias}`));
        console.log(chalk.dim(`  • Configure default with: ${cliName} setup`));
        console.log();

      } catch (error: unknown) {
        console.error(chalk.red("Error listing models:"), extractErrorMessage(error));
        process.exit(1);
      }
    });

  modelsCmd
    .command("info <model-id>")
    .description("Show detailed information about a specific model (supports aliases)")
    .action(async (modelId: string) => {
      try {
        const activeProvider = getActiveProvider();

        // Resolve alias to actual model ID
        const resolvedModelId = resolveModelAlias(modelId);
        const wasAlias = resolvedModelId !== modelId;
        const model = activeProvider.models[resolvedModelId];

        if (!model) {
          console.log(chalk.yellow(`\nModel "${modelId}" is not a predefined model for ${activeProvider.displayName}.`));
          if (wasAlias) {
            console.log(chalk.dim(`(Resolved from alias to "${resolvedModelId}")`));
          }
          console.log(chalk.dim("This may be a custom model (e.g., from Ollama or another provider)."));
          console.log(chalk.dim("\nFor custom models, refer to your provider's documentation."));
          console.log(chalk.dim(`\nAvailable models for ${activeProvider.displayName}:`));
          for (const [id, m] of Object.entries(activeProvider.models)) {
            // Find alias for this model
            const alias = Object.entries(MODEL_ALIASES).find(([, v]) => v === id)?.[0];
            const aliasInfo = alias ? chalk.cyan(` (alias: ${alias})`) : "";
            console.log(chalk.dim(`  - ${id}${aliasInfo}: ${m.name}`));
          }
          process.exit(0);
        }

        // Find alias for this model
        const alias = Object.entries(MODEL_ALIASES).find(([, v]) => v === resolvedModelId)?.[0];

        console.log(chalk.bold(`\n📄 Model Information: ${resolvedModelId}\n`));
        if (wasAlias) {
          console.log(chalk.dim(`(Resolved from alias: ${modelId})\n`));
        }
        console.log(chalk.cyan("Provider:"), activeProvider.displayName);
        console.log(chalk.cyan("Name:"), model.name);
        if (alias) {
          console.log(chalk.cyan("Alias:"), chalk.green(alias));
        }
        console.log(chalk.cyan("Description:"), model.description);
        console.log(chalk.cyan("Context Window:"), formatTokenCount(model.contextWindow, { suffix: true, uppercase: true }));
        console.log(chalk.cyan("Max Output Tokens:"), formatTokenCount(model.maxOutputTokens, { suffix: true, uppercase: true }));
        console.log(chalk.cyan("Default Temperature:"), model.defaultTemperature);
        console.log(chalk.cyan("Thinking Mode:"), model.supportsThinking ? chalk.green("✓ Supported") : chalk.dim("Not supported"));
        console.log(chalk.cyan("Vision Support:"), model.supportsVision ? chalk.green("✓ Supported") : chalk.dim("Not supported"));
        console.log(chalk.cyan("Search Support:"), model.supportsSearch ? chalk.green("✓ Supported") : chalk.dim("Not supported"));
        console.log(chalk.cyan("Seed Support:"), model.supportsSeed ? chalk.green("✓ Supported") : chalk.dim("Not supported"));
        console.log();

      } catch (error: unknown) {
        console.error(chalk.red("Error fetching model info:"), extractErrorMessage(error));
        process.exit(1);
      }
    });

  return modelsCmd;
}
