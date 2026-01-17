/**
 * Init Command Handler
 *
 * Handler for /init - project initialization with AX.md output
 *
 * Refactored to:
 * - Generate single AX.md at project root
 * - Support depth levels (basic, standard, full, security)
 * - Parse existing rules from .cursorrules, .editorconfig, etc.
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
 * Generates:
 * - AX.md: Primary context file at project root (always)
 * - .ax/analysis.json: Deep analysis for full/security depth (optional)
 */
export function handleInit(_args: string, ctx: CommandContext): CommandResult {
  // Parse arguments for depth level
  const args = _args.trim().toLowerCase();
  let depthLevel: 'basic' | 'standard' | 'full' | 'security' = 'standard';

  if (args.includes('--depth=basic') || args.includes('-d basic')) {
    depthLevel = 'basic';
  } else if (args.includes('--depth=full') || args.includes('-d full')) {
    depthLevel = 'full';
  } else if (args.includes('--depth=security') || args.includes('-d security')) {
    depthLevel = 'security';
  }

  const isForce = args.includes('--force') || args.includes('-f');

  // Add user entry
  const userEntry = {
    type: "user" as const,
    content: `/init${args ? ' ' + args : ''}`,
    timestamp: new Date(),
  };

  // Add initial analyzing message
  const analyzingEntry = {
    type: "assistant" as const,
    content: `🔍 Analyzing project (depth: ${depthLevel})...\n`,
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
        const axMdPath = path.join(projectRoot, FILE_NAMES.AX_MD);

        // Check if AX.md exists - auto-refresh by default
        const axMdExists = fs.existsSync(axMdPath);
        const effectiveRefresh = axMdExists && !isForce; // Auto-refresh when file exists

        // Check for legacy format and warn about deprecation
        const { detectLegacyFormat } = await import("../init/migrator.js");
        const legacyFormat = detectLegacyFormat(projectRoot);
        if (legacyFormat.hasLegacyFiles) {
          ctx.setChatHistory((prev) => [
            ...prev,
            {
              type: "assistant",
              content: `⚠️ **Deprecation Warning**: Legacy format detected\n\nFound: ${legacyFormat.files.join(', ')}\n\nThe 3-file format is deprecated. Run \`/init --migrate\` to convert to the new single-file format (AX.md).`,
              timestamp: new Date(),
            },
          ]);
        }

        // Parse existing rules
        const { parseProjectRules, getRulesSummary } = await import("../../utils/rules-parser.js");
        const rulesResult = parseProjectRules(projectRoot);

        // Analyze project
        const { ProjectAnalyzer } = await import("../../utils/project-analyzer.js");
        const tier = depthLevel === 'basic' ? 1 : depthLevel === 'standard' ? 2 : depthLevel === 'full' ? 3 : 4;
        const analyzer = new ProjectAnalyzer(projectRoot, { tier: tier as 1 | 2 | 3 | 4 });
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

        // Generate AX.md content
        const { LLMOptimizedInstructionGenerator } = await import(
          "../../utils/llm-optimized-instruction-generator.js"
        );
        const generator = new LLMOptimizedInstructionGenerator({
          depth: depthLevel,
          includeTroubleshooting: depthLevel !== 'basic',
          includeCodePatterns: depthLevel === 'full' || depthLevel === 'security',
          externalRules: rulesResult.allRules,
        });

        const axMdContent = generator.generateAxMd(projectInfo);

        // Write AX.md
        fs.writeFileSync(axMdPath, axMdContent, "utf-8");

        // Generate deep analysis for full/security depth
        let analysisGenerated = false;
        if (depthLevel === 'full' || depthLevel === 'security') {
          const axDir = path.join(projectRoot, FILE_NAMES.UNIFIED_CONFIG_DIR);
          if (!fs.existsSync(axDir)) {
            fs.mkdirSync(axDir, { recursive: true });
          }

          const analysisPath = path.join(axDir, FILE_NAMES.ANALYSIS_JSON);
          const analysisContent = generator.generateDeepAnalysis(projectInfo);
          fs.writeFileSync(analysisPath, analysisContent, "utf-8");
          analysisGenerated = true;
        }

        // Build success message
        const action = effectiveRefresh ? 'refreshed' : 'generated';
        let successMessage = `🎉 Project ${action} successfully!\n\n`;

        successMessage += `📋 Analysis Results:\n`;
        successMessage += `   Name: ${projectInfo.name}\n`;
        successMessage += `   Type: ${projectInfo.projectType}\n`;
        successMessage += `   Language: ${projectInfo.primaryLanguage}\n`;
        successMessage += `   Depth: ${depthLevel}\n`;

        if (projectInfo.techStack.length > 0) {
          successMessage += `   Stack: ${projectInfo.techStack.slice(0, 5).join(", ")}\n`;
        }

        if (rulesResult.parsedFiles.length > 0) {
          successMessage += `   Rules: ${getRulesSummary(rulesResult)}\n`;
        }

        if (result.duration) {
          successMessage += `   Analysis time: ${result.duration}ms\n`;
        }

        successMessage += `\n✅ Generated: ${FILE_NAMES.AX_MD}\n`;

        if (analysisGenerated) {
          successMessage += `✅ Generated: ${FILE_NAMES.UNIFIED_CONFIG_DIR}/${FILE_NAMES.ANALYSIS_JSON} (deep analysis)\n`;
        }

        successMessage += `\n💡 Review AX.md and customize as needed. Commit to version control.`;

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
    description: "Initialize project with AX.md (use --depth=basic|standard|full|security)",
    category: "project",
    handler: handleInit,
  },
];
