/**
 * Init command for project setup and analysis
 *
 * Refactored to generate:
 * - Single AX.md at project root
 * - Optional .ax/analysis.json for deep analysis (gitignored)
 *
 * Supports:
 * - --depth flag (basic, standard, full, security)
 * - --migrate flag to convert from old 3-file format
 * - --refresh flag to update existing AX.md
 * - --legacy flag for backward compatibility
 */

import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync, renameSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import * as prompts from '@clack/prompts';
import chalk from 'chalk';
import { ProjectAnalyzer } from '../utils/project-analyzer.js';
import { LLMOptimizedInstructionGenerator, type DepthLevel } from '../utils/llm-optimized-instruction-generator.js';
import { InitValidator } from '../utils/init-validator.js';
import { InitWizard } from './init/wizard.js';
import { extractErrorMessage } from '../utils/error-handler.js';
import { FILE_NAMES } from '../constants.js';
import { getActiveConfigPaths } from '../provider/config.js';
import { parseProjectRules, getRulesSummary } from '../utils/rules-parser.js';
import { migrateFromLegacyFormat, detectLegacyFormat, type MigrationResult } from './init/migrator.js';
import type { ProjectInfo } from '../types/project-analysis.js';

export function createInitCommand(): Command {
  const initCommand = new Command('init')
    .description('Initialize project with AX.md for AI context')
    .option('-f, --force', 'Force regeneration even if AX.md exists', false)
    .option('-v, --verbose', 'Verbose output showing analysis details', false)
    .option('-d, --directory <dir>', 'Project directory to analyze')
    .option('-y, --yes', 'Skip interactive prompts and use defaults', false)
    .option('--no-interaction', 'Run in non-interactive mode', false)
    .option('-t, --template <template-id>', 'Use a specific template')
    .option('--depth <level>', 'Analysis depth: basic, standard, full, security', 'standard')
    .option('--output <file>', 'Custom output filename (default: AX.md)')
    .option('--refresh', 'Update existing AX.md with fresh analysis', false)
    .option('--migrate', 'Migrate from old 3-file format to single AX.md', false)
    .option('--legacy', 'Generate old 3-file format (deprecated)', false)
    .option('--preview', 'Preview changes before applying', false)
    .option('--dry-run', 'Show what would be done without making changes', false)
    .option('--validate', 'Run validation checks only', false)
    .option('--skip-analysis', 'Skip project analysis step', false)
    .action(async (options: {
      force?: boolean;
      verbose?: boolean;
      directory?: string;
      yes?: boolean;
      noInteraction?: boolean;
      template?: string;
      depth?: string;
      output?: string;
      refresh?: boolean;
      migrate?: boolean;
      legacy?: boolean;
      preview?: boolean;
      dryRun?: boolean;
      validate?: boolean;
      skipAnalysis?: boolean;
    }) => {
      try {
        prompts.intro(chalk.cyan('AX CLI Project Initialization'));

        const projectRoot = options.directory ? resolve(options.directory) : process.cwd();
        const depthLevel = validateDepthLevel(options.depth);
        const outputFile = options.output || FILE_NAMES.AX_MD;

        if (options.verbose) {
          prompts.log.info(`Working directory: ${projectRoot}`);
          prompts.log.info(`Depth level: ${depthLevel}`);
          prompts.log.info(`Output file: ${outputFile}`);
        }

        // Handle migration from legacy format
        if (options.migrate) {
          await handleMigration(projectRoot, options);
          return;
        }

        // Handle legacy mode (deprecated)
        if (options.legacy) {
          prompts.log.warn('⚠️  DEPRECATION WARNING: --legacy flag is deprecated');
          prompts.log.info('The 3-file format (.ax-*/CUSTOM.md, ax.index.json, ax.summary.json)');
          prompts.log.info('will be removed in a future version.');
          prompts.log.info('');
          prompts.log.info('Please migrate to the new single-file format (AX.md):');
          prompts.log.info('  ax init           # Generate new format');
          prompts.log.info('  ax init --migrate # Convert existing files');
          prompts.log.info('');
          await handleLegacyInit(projectRoot, options);
          return;
        }

        // Check if in a git repo or has package.json
        const hasGit = existsSync(join(projectRoot, '.git'));
        const hasPackageJson = existsSync(join(projectRoot, 'package.json'));
        const isProject = hasGit || hasPackageJson;

        if (!isProject && !options.validate) {
          prompts.log.warn('No project detected (no .git or package.json)');
          prompts.log.info('Run from a project directory to initialize.');
          prompts.outro(chalk.yellow('Initialization skipped'));
          return;
        }

        // Run validation
        const validator = new InitValidator(projectRoot);
        const validationResult = validator.validate();

        if (options.validate) {
          console.log('\n' + InitValidator.formatValidationResult(validationResult));
          process.exit(validationResult.valid ? 0 : 1);
        }

        if (!validationResult.valid) {
          prompts.log.error('Project validation failed:');
          console.log(InitValidator.formatValidationResult(validationResult));
          process.exit(1);
        }

        // Check for existing AX.md
        const axMdPath = join(projectRoot, outputFile);
        const axMdExists = existsSync(axMdPath);

        if (axMdExists && !options.force && !options.refresh) {
          prompts.log.info(`${outputFile} already exists.`);
          prompts.log.info('Use --refresh to update or --force to regenerate.');
          prompts.outro(chalk.yellow('Use --refresh or --force to update'));
          return;
        }

        // Check for legacy format and suggest migration
        const legacyFormat = detectLegacyFormat(projectRoot);
        if (legacyFormat.hasLegacyFiles && !options.force) {
          prompts.log.warn('⚠️  DEPRECATION WARNING: Legacy 3-file format detected');
          prompts.log.info('The following legacy files will be deprecated:');
          for (const file of legacyFormat.files) {
            prompts.log.info(`  - ${file}`);
          }
          prompts.log.info('');
          prompts.log.info('📦 The new single-file format (AX.md) offers:');
          prompts.log.info('   - Simpler project setup');
          prompts.log.info('   - Better token efficiency');
          prompts.log.info('   - Unified configuration');
          prompts.log.info('');
          prompts.log.info('🔄 Run `ax init --migrate` to convert to the new format.');
          prompts.log.info('   Your customizations will be preserved.');
          prompts.log.info('');
        }

        // Run interactive wizard (unless --yes or --no-interaction)
        let selectedTemplate = undefined;
        if (!options.noInteraction && !options.yes) {
          const wizard = new InitWizard({
            nonInteractive: options.noInteraction,
            yes: options.yes,
            template: options.template,
          });
          const wizardResult = await wizard.run();
          selectedTemplate = wizardResult.selectedTemplate;
        }

        // Parse existing rules
        const rulesResult = parseProjectRules(projectRoot);
        if (options.verbose && rulesResult.parsedFiles.length > 0) {
          prompts.log.info(getRulesSummary(rulesResult));
        }

        // Analyze project
        let projectInfo: ProjectInfo | null = null;

        if (options.skipAnalysis) {
          prompts.log.warn('Skipping project analysis (--skip-analysis)');
        } else {
          const spinner = prompts.spinner();
          spinner.start(`Analyzing project (depth: ${depthLevel})...`);

          const analyzerTier = depthToTier(depthLevel);
          const analyzer = new ProjectAnalyzer(projectRoot, { tier: analyzerTier });
          const result = await analyzer.analyze();

          if (!result.success || !result.projectInfo) {
            spinner.stop('Analysis failed');
            prompts.log.error(`Analysis failed: ${result.error || 'Unknown error'}`);
            process.exit(1);
          }

          projectInfo = result.projectInfo;
          spinner.stop('Analysis complete');

          if (options.verbose) {
            prompts.log.info(`Project: ${projectInfo.name} (${projectInfo.projectType})`);
            prompts.log.info(`Language: ${projectInfo.primaryLanguage}`);
            if (projectInfo.techStack.length > 0) {
              prompts.log.info(`Stack: ${projectInfo.techStack.join(', ')}`);
            }
          }
        }

        // Generate content
        const generator = new LLMOptimizedInstructionGenerator({
          depth: depthLevel,
          includeTroubleshooting: depthLevel !== 'basic',
          includeCodePatterns: depthLevel === 'full' || depthLevel === 'security',
          externalRules: rulesResult.allRules,
        });

        let axMdContent: string;
        let analysisContent: string | null = null;

        if (selectedTemplate) {
          // Use template content
          axMdContent = selectedTemplate.instructions;
        } else if (projectInfo) {
          // Generate from analysis
          axMdContent = generator.generateAxMd(projectInfo);

          // Generate deep analysis for full/security depth
          if (depthLevel === 'full' || depthLevel === 'security') {
            analysisContent = generator.generateDeepAnalysis(projectInfo);
          }
        } else {
          // Minimal fallback
          axMdContent = generateMinimalAxMd(projectRoot);
        }

        // Dry-run mode
        if (options.dryRun) {
          prompts.log.info('Dry-run mode - no changes made');
          prompts.log.info(`Would create: ${axMdPath}`);
          if (analysisContent) {
            prompts.log.info(`Would create: ${join(projectRoot, FILE_NAMES.UNIFIED_CONFIG_DIR, FILE_NAMES.ANALYSIS_JSON)}`);
          }
          prompts.outro(chalk.green('Dry-run complete'));
          return;
        }

        // Write files atomically
        const tmpAxMdPath = `${axMdPath}.tmp`;

        try {
          // Write AX.md
          writeFileSync(tmpAxMdPath, axMdContent, 'utf-8');
          renameSync(tmpAxMdPath, axMdPath);
          prompts.log.success(`Generated: ${axMdPath}`);

          // Write deep analysis if available
          if (analysisContent) {
            const axDir = join(projectRoot, FILE_NAMES.UNIFIED_CONFIG_DIR);
            if (!existsSync(axDir)) {
              mkdirSync(axDir, { recursive: true });
            }

            const analysisPath = join(axDir, FILE_NAMES.ANALYSIS_JSON);
            const tmpAnalysisPath = `${analysisPath}.tmp`;
            writeFileSync(tmpAnalysisPath, analysisContent, 'utf-8');
            renameSync(tmpAnalysisPath, analysisPath);
            prompts.log.success(`Generated: ${analysisPath} (deep analysis)`);

            // Add to .gitignore if not already there
            await addToGitignore(projectRoot, `${FILE_NAMES.UNIFIED_CONFIG_DIR}/${FILE_NAMES.ANALYSIS_JSON}`);
          }
        } catch (writeError) {
          // Cleanup temp files
          try {
            if (existsSync(tmpAxMdPath)) unlinkSync(tmpAxMdPath);
          } catch {
            // Ignore cleanup errors
          }
          throw writeError;
        }

        // Show completion summary
        const action = options.refresh ? 'refreshed' : 'created';
        const summaryContent = projectInfo
          ? `Project: ${projectInfo.name}\nType: ${projectInfo.projectType}\nLanguage: ${projectInfo.primaryLanguage}\nDepth: ${depthLevel}`
          : `Output: ${outputFile}`;

        await prompts.note(summaryContent, `AX.md ${action}`);

        await prompts.note(
          `1. Review ${outputFile} and customize if needed\n` +
          '2. Commit to version control\n' +
          '3. Start coding with AI assistance',
          'Next Steps'
        );

        prompts.outro(chalk.green(`Project initialized with ${outputFile}!`));

      } catch (error) {
        prompts.log.error(`Error: ${extractErrorMessage(error)}`);
        if (options.verbose && error instanceof Error && error.stack) {
          console.error('\nStack trace:');
          console.error(error.stack);
        }
        process.exit(1);
      }
    });

  return initCommand;
}

/**
 * Validate and normalize depth level
 */
function validateDepthLevel(depth?: string): DepthLevel {
  const validLevels: DepthLevel[] = ['basic', 'standard', 'full', 'security'];
  if (depth && validLevels.includes(depth as DepthLevel)) {
    return depth as DepthLevel;
  }
  return 'standard';
}

/**
 * Convert depth level to analyzer tier
 */
function depthToTier(depth: DepthLevel): 1 | 2 | 3 | 4 {
  switch (depth) {
    case 'basic': return 1;
    case 'standard': return 2;
    case 'full': return 3;
    case 'security': return 4;
  }
}

/**
 * Generate minimal AX.md when no analysis available
 */
function generateMinimalAxMd(projectRoot: string): string {
  const projectName = require('path').basename(projectRoot);
  const now = new Date().toISOString().split('T')[0];

  return `<!--
Generated by: ax-cli / ax-grok
Last updated: ${now}
Refresh: Run \`/init\` or \`ax init --refresh\` to update
-->

# ${projectName}

## Build & Development

Add your build and development commands here.

## Project-Specific Rules

Add project-specific rules and conventions here.
`;
}

/**
 * Handle migration from legacy 3-file format
 */
async function handleMigration(projectRoot: string, options: { verbose?: boolean; dryRun?: boolean; force?: boolean }): Promise<void> {
  const spinner = prompts.spinner();
  spinner.start('Migrating from legacy format...');

  try {
    const result: MigrationResult = await migrateFromLegacyFormat(projectRoot, {
      dryRun: options.dryRun,
      force: options.force,
      verbose: options.verbose,
    });

    spinner.stop(result.success ? 'Migration complete' : 'Migration failed');

    if (result.success) {
      prompts.log.success(`Migrated to: ${result.newFile}`);
      if (result.movedFiles && result.movedFiles.length > 0) {
        prompts.log.info('Legacy files moved to .ax/legacy/:');
        for (const file of result.movedFiles) {
          prompts.log.info(`  - ${file}`);
        }
      }
    } else {
      prompts.log.error(`Migration failed: ${result.error}`);
    }
  } catch (error) {
    spinner.stop('Migration failed');
    prompts.log.error(`Migration error: ${extractErrorMessage(error)}`);
  }
}

/**
 * Handle legacy init (deprecated, for backward compatibility)
 */
async function handleLegacyInit(projectRoot: string, options: { verbose?: boolean; force?: boolean; skipAnalysis?: boolean }): Promise<void> {
  const activeConfigPaths = getActiveConfigPaths();
  const configDirName = activeConfigPaths.DIR_NAME;
  const axCliDir = join(projectRoot, configDirName);
  const customMdPath = join(axCliDir, FILE_NAMES.CUSTOM_MD);
  const sharedIndexPath = join(projectRoot, FILE_NAMES.AX_INDEX_JSON);
  const sharedSummaryPath = join(projectRoot, FILE_NAMES.AX_SUMMARY_JSON);

  // Create config directory
  if (!existsSync(axCliDir)) {
    mkdirSync(axCliDir, { recursive: true });
  }

  // Analyze project
  let projectInfo: ProjectInfo | null = null;

  if (!options.skipAnalysis) {
    const spinner = prompts.spinner();
    spinner.start('Analyzing project (legacy mode)...');

    const analyzer = new ProjectAnalyzer(projectRoot);
    const result = await analyzer.analyze();

    if (result.success && result.projectInfo) {
      projectInfo = result.projectInfo;
      spinner.stop('Analysis complete');
    } else {
      spinner.stop('Analysis failed');
      prompts.log.warn('Continuing with minimal output');
    }
  }

  // Generate legacy output using old generator behavior
  const generator = new LLMOptimizedInstructionGenerator({ depth: 'standard' });

  if (projectInfo) {
    const instructions = generator.generateInstructions(projectInfo);
    const index = generator.generateIndex(projectInfo);
    const summary = generator.generateSummary(projectInfo);

    writeFileSync(customMdPath, instructions, 'utf-8');
    writeFileSync(sharedIndexPath, index, 'utf-8');
    writeFileSync(sharedSummaryPath, summary, 'utf-8');

    prompts.log.success(`Generated: ${customMdPath}`);
    prompts.log.success(`Generated: ${sharedIndexPath}`);
    prompts.log.success(`Generated: ${sharedSummaryPath}`);
  }

  prompts.log.warn('Legacy format is deprecated. Run `ax init --migrate` to upgrade.');
}

/**
 * Add entry to .gitignore if not already present
 */
async function addToGitignore(projectRoot: string, entry: string): Promise<void> {
  const gitignorePath = join(projectRoot, '.gitignore');

  try {
    let content = '';
    if (existsSync(gitignorePath)) {
      const { readFileSync } = await import('fs');
      content = readFileSync(gitignorePath, 'utf-8');
    }

    // Check if entry already exists
    if (content.includes(entry)) {
      return;
    }

    // Add entry
    const newContent = content.endsWith('\n')
      ? `${content}# AX CLI deep analysis (regeneratable)\n${entry}\n`
      : `${content}\n# AX CLI deep analysis (regeneratable)\n${entry}\n`;

    writeFileSync(gitignorePath, newContent, 'utf-8');
  } catch {
    // Silently ignore gitignore errors
  }
}
