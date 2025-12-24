/**
 * Model Command Handler
 *
 * Handler for /model - AI model selection and configuration
 *
 * This wraps the existing handleModelCommand from slash-commands.ts
 * to work with the new command registry pattern.
 *
 * @packageDocumentation
 */

import type { CommandDefinition, CommandContext, CommandResult } from "../types.js";
import {
  handleModelCommand as legacyHandleModelCommand,
  resolveModelAlias,
} from "../../ui/handlers/slash-commands.js";

/**
 * /model command handler
 *
 * Usage:
 *   /model              - Show current model and list available models
 *   /model <name>       - Switch to a model (session only)
 *   /model save         - Save current model to config (persistent)
 *   /model save <name>  - Switch and save model to config
 *   /model reset        - Reset to provider default model
 */
export function handleModel(args: string, ctx: CommandContext): CommandResult {
  // Delegate to the existing handler with adapted interface
  const result = legacyHandleModelCommand(
    args,
    {
      getCurrentModel: () => ctx.settings.getCurrentModel() || null,
      setCurrentModel: (model: string) => ctx.settings.setCurrentModel(model),
      saveModelToConfig: (model: string) => ctx.settings.saveModelToUserConfig(model),
      getAvailableModels: () => ctx.settings.getAvailableModels(),
    },
    ctx.provider,
    ctx.configPaths.DIR_NAME
  );

  return result;
}

// Re-export for convenience
export { resolveModelAlias };

/**
 * Model command definition for registration
 */
export const modelCommands: CommandDefinition[] = [
  {
    name: "model",
    aliases: ["m"],
    description: "View/switch AI models (session or persistent)",
    category: "settings",
    handler: handleModel,
    examples: ["/model", "/model glm-4.7", "/model save", "/model reset"],
  },
];
