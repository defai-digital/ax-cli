/**
 * Init Command Handler
 *
 * Handler for /init - project initialization with smart analysis
 *
 * @packageDocumentation
 */

import type { CommandDefinition, CommandContext, CommandResult } from "../types.js";
import { FILE_NAMES } from "../../constants.js";
import { extractErrorMessage } from "../../utils/error-handler.js";
import * as fs from "fs";
import * as path from "path";

/**
 * /init command handler
 *
 * Analyzes the project and generates:
 * - ax.index.json: Full project index at root
 * - ax.summary.json: LLM-optimized summary for prompts
 * - CUSTOM.md: Provider-specific custom instructions (only if doesn't exist)
 */
export function handleInit(_args: string, ctx: CommandContext): CommandResult {
  // Add user entry first
  const userEntry = {
    type: "user" as const,
    content: "/init",
    timestamp: new Date(),
  };

  // Add initial analyzing message
  const analyzingEntry = {
    type: "assistant" as const,
    content: "🔍 Analyzing project with deep analysis (Tier 3)...\n",
    timestamp: new Date(),
  };

  return {
    handled: true,
    entries: [userEntry, analyzingEntry],
    clearInput: true,
    setProcessing: true,
    asyncAction: async () => {
      try {
        const projectRoot = process.cwd();

        // Get provider-specific config paths
        const configDirName = ctx.configPaths.DIR_NAME;
        const axCliDir = path.join(projectRoot, configDirName);
        const customMdPath = path.join(axCliDir, FILE_NAMES.CUSTOM_MD);
        const sharedIndexPath = path.join(projectRoot, FILE_NAMES.AX_INDEX_JSON);
        const sharedSummaryPath = path.join(projectRoot, FILE_NAMES.AX_SUMMARY_JSON);

        // Check if CUSTOM.md exists
        const customMdExists = fs.existsSync(customMdPath);
        const willSkipCustomMd = customMdExists;

        // Analyze project with deep analysis
        const { ProjectAnalyzer } = await import("../../utils/project-analyzer.js");
        const analyzer = new ProjectAnalyzer(projectRoot);
        const result = await analyzer.analyze();

        if (!result.success || !result.projectInfo) {
          ctx.setChatHistory((prev) => [
            ...prev,
            {
              type: "assistant",
              content: `❌ Failed to analyze project: ${result.error || "Unknown error"}`,
              timestamp: new Date(),
            },
          ]);
          ctx.setIsProcessing(false);
          return;
        }

        const projectInfo = result.projectInfo;

        // Generate LLM-optimized instructions
        const { LLMOptimizedInstructionGenerator } = await import(
          "../../utils/llm-optimized-instruction-generator.js"
        );
        const generator = new LLMOptimizedInstructionGenerator({
          compressionLevel: "moderate",
          hierarchyEnabled: true,
          criticalRulesCount: 5,
          includeDODONT: true,
          includeTroubleshooting: true,
        });

        const instructions = generator.generateInstructions(projectInfo);
        const index = generator.generateIndex(projectInfo);
        const summary = generator.generateSummary(projectInfo);

        // Create provider-specific directory
        if (!fs.existsSync(axCliDir)) {
          fs.mkdirSync(axCliDir, { recursive: true });
        }

        // Write custom instructions (provider-specific) - only if doesn't exist
        if (!willSkipCustomMd) {
          fs.writeFileSync(customMdPath, instructions, "utf-8");
        }

        // Always write shared project index and summary at root
        fs.writeFileSync(sharedIndexPath, index, "utf-8");
        fs.writeFileSync(sharedSummaryPath, summary, "utf-8");

        // Display success
        const cliName = ctx.provider.branding.cliName;
        let successMessage = willSkipCustomMd
          ? `🔄 Project index rebuilt!\n\n`
          : `🎉 Project initialized successfully!\n\n`;

        successMessage += `📋 Analysis Results:\n`;
        successMessage += `   Name: ${projectInfo.name}\n`;
        successMessage += `   Type: ${projectInfo.projectType}\n`;
        successMessage += `   Language: ${projectInfo.primaryLanguage}\n`;

        if (projectInfo.techStack.length > 0) {
          successMessage += `   Stack: ${projectInfo.techStack.join(", ")}\n`;
        }
        if (result.duration) {
          successMessage += `   Analysis time: ${result.duration}ms\n`;
        }

        successMessage += `\n✅ Rebuilt project index: ${sharedIndexPath}\n`;
        successMessage += `✅ Rebuilt prompt summary: ${sharedSummaryPath}\n`;

        if (willSkipCustomMd) {
          successMessage += `⏭️  Skipped CUSTOM.md (already exists): ${customMdPath}\n`;
          successMessage += `   Use '${cliName} init --force' from terminal to regenerate CUSTOM.md\n`;
        } else {
          successMessage += `✅ Generated custom instructions: ${customMdPath}\n`;
        }

        successMessage += `\n💡 ax.summary.json is loaded into prompts, ax.index.json has full details`;

        ctx.setChatHistory((prev) => [
          ...prev,
          {
            type: "assistant",
            content: successMessage,
            timestamp: new Date(),
          },
        ]);
      } catch (error) {
        ctx.setChatHistory((prev) => [
          ...prev,
          {
            type: "assistant",
            content: `❌ Error during initialization: ${extractErrorMessage(error)}`,
            timestamp: new Date(),
          },
        ]);
      } finally {
        ctx.setIsProcessing(false);
      }
    },
  };
}

/**
 * Init command definition for registration
 */
export const initCommands: CommandDefinition[] = [
  {
    name: "init",
    description: "Initialize project with smart analysis",
    category: "project",
    handler: handleInit,
  },
];
