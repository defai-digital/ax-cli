/**
 * Init command for project setup and analysis
 *
 * This command initializes project-level configuration (.ax-cli/CUSTOM.md).
 * For API configuration, use 'ax-cli setup'.
 */

import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync, renameSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import * as prompts from '@clack/prompts';
import chalk from 'chalk';
import { ProjectAnalyzer } from '../utils/project-analyzer.js';
import { LLMOptimizedInstructionGenerator } from '../utils/llm-optimized-instruction-generator.js';
import { InitValidator } from '../utils/init-validator.js';
import { InitWizard } from './init/wizard.js';
import { extractErrorMessage } from '../utils/error-handler.js';
import { CONFIG_DIR_NAME, FILE_NAMES } from '../constants.js';

export function createInitCommand(): Command {
  const initCommand = new Command('init')
    .description('Initialize AX CLI for your project with intelligent analysis')
    .option('-f, --force', 'Force regeneration even if files exist', false)
    .option('-v, --verbose', 'Verbose output showing analysis details', false)
    .option('-d, --directory <dir>', 'Project directory to analyze')
    .option('-y, --yes', 'Skip interactive prompts and use defaults', false)
    .option('--no-interaction', 'Run in non-interactive mode', false)
    .option('-t, --template <template-id>', 'Use a specific template')
    .option('--preview', 'Preview changes before applying', false)
    .option('--dry-run', 'Show what would be done without making changes', false)
    .option('--validate', 'Run validation checks only', false)
    .action(async (options: {
      force?: boolean;
      verbose?: boolean;
      directory?: string;
      yes?: boolean;
      noInteraction?: boolean;
      template?: string;
      preview?: boolean;
      dryRun?: boolean;
      validate?: boolean;
    }) => {
      try {
        prompts.intro(chalk.cyan('AX CLI Project Initialization'));

        const projectRoot = options.directory ? resolve(options.directory) : process.cwd();

        if (options.verbose) {
          prompts.log.info(`Working directory: ${projectRoot}`);
        }

        // Run validation if requested
        if (options.validate) {
          const validator = new InitValidator(projectRoot);
          const validationResult = validator.validate();

          console.log('\n' + InitValidator.formatValidationResult(validationResult));
          process.exit(validationResult.valid ? 0 : 1);
        }

        // Check if in a git repo or has package.json (reasonable project indicator)
        const hasGit = existsSync(join(projectRoot, '.git'));
        const hasPackageJson = existsSync(join(projectRoot, 'package.json'));

        if (!hasGit && !hasPackageJson) {
          prompts.log.warn('No project detected in current directory (no .git or package.json)');
          prompts.log.info('Run from a project directory to initialize it.');
          prompts.outro(chalk.yellow('Initialization skipped'));
          return;
        }

        // Run validation
        const validator = new InitValidator(projectRoot);
        const validationResult = validator.validate();

        if (!validationResult.valid) {
          prompts.log.error('Project validation failed:');
          console.log(InitValidator.formatValidationResult(validationResult));
          process.exit(1);
        }

        if (options.verbose && (validationResult.warnings.length > 0 || validationResult.suggestions.length > 0)) {
          console.log(InitValidator.formatValidationResult(validationResult));
        }

        // Check if already initialized
        const axCliDir = join(projectRoot, CONFIG_DIR_NAME);
        const customMdPath = join(axCliDir, FILE_NAMES.CUSTOM_MD);
        const indexPath = join(axCliDir, FILE_NAMES.INDEX_JSON);

        if (!options.force && existsSync(customMdPath)) {
          prompts.log.success('Project already initialized!');
          prompts.log.info(`Custom instructions: ${customMdPath}`);
          prompts.log.info(`Project index: ${indexPath}`);
          prompts.log.info('Use --force to regenerate');
          prompts.outro(chalk.green('Already configured'));
          return;
        }

        // Run interactive wizard for template selection (unless --yes or --no-interaction)
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

        // Create config directory
        if (!existsSync(axCliDir)) {
          mkdirSync(axCliDir, { recursive: true });
          if (options.verbose) {
            prompts.log.info(`Created ${CONFIG_DIR_NAME} directory`);
          }
        }

        // Analyze project
        const spinner = prompts.spinner();
        spinner.start('Analyzing project...');

        const analyzer = new ProjectAnalyzer(projectRoot);
        const result = await analyzer.analyze();

        if (!result.success || !result.projectInfo) {
          spinner.stop('Analysis failed');
          prompts.log.error(`Project analysis failed: ${result.error || 'Unknown error'}`);
          process.exit(1);
        }

        const projectInfo = result.projectInfo;
        spinner.stop('Analysis complete');

        // Display analysis results
        if (options.verbose) {
          prompts.log.info(`Project: ${projectInfo.name} (${projectInfo.projectType})`);
          prompts.log.info(`Language: ${projectInfo.primaryLanguage}`);
          if (projectInfo.techStack.length > 0) {
            prompts.log.info(`Stack: ${projectInfo.techStack.join(', ')}`);
          }
        }

        // Generate content (either from template or project analysis)
        let instructions: string;
        let index: string;

        if (selectedTemplate) {
          instructions = selectedTemplate.instructions;
          const indexData = {
            projectName: selectedTemplate.name,
            version: selectedTemplate.version,
            projectType: selectedTemplate.projectType,
            ...selectedTemplate.metadata,
            templateId: selectedTemplate.id,
            templateAppliedAt: new Date().toISOString(),
          };
          index = JSON.stringify(indexData, null, 2);
        } else {
          // Generate LLM-optimized instructions
          const generator = new LLMOptimizedInstructionGenerator({
            compressionLevel: 'moderate',
            hierarchyEnabled: true,
            criticalRulesCount: 5,
            includeDODONT: true,
            includeTroubleshooting: true,
          });
          instructions = generator.generateInstructions(projectInfo);
          index = generator.generateIndex(projectInfo);
        }

        // Preview or dry-run mode
        if (options.dryRun) {
          prompts.log.info('Dry-run mode - no changes made');
          prompts.log.info(`Would create: ${customMdPath}`);
          prompts.log.info(`Would create: ${indexPath}`);
          prompts.outro(chalk.green('Dry-run complete'));
          return;
        }

        // Write files using atomic operations
        const tmpCustomPath = `${customMdPath}.tmp`;
        const tmpIndexPath = `${indexPath}.tmp`;

        try {
          writeFileSync(tmpCustomPath, instructions, 'utf-8');
          writeFileSync(tmpIndexPath, index, 'utf-8');

          // Atomic rename
          renameSync(tmpCustomPath, customMdPath);
          renameSync(tmpIndexPath, indexPath);

          prompts.log.success(`Generated custom instructions: ${customMdPath}`);
          prompts.log.success(`Generated project index: ${indexPath}`);
        } catch (writeError) {
          // Cleanup temp files on error
          try {
            if (existsSync(tmpCustomPath)) unlinkSync(tmpCustomPath);
            if (existsSync(tmpIndexPath)) unlinkSync(tmpIndexPath);
          } catch {
            // Ignore cleanup errors
          }
          throw writeError;
        }

        // Show completion summary
        await prompts.note(
          `Project: ${projectInfo.name} (${projectInfo.projectType})\n` +
          `Language: ${projectInfo.primaryLanguage}\n` +
          (projectInfo.techStack.length > 0 ? `Stack: ${projectInfo.techStack.join(', ')}\n` : '') +
          `\nFiles created:\n` +
          `  ${customMdPath}\n` +
          `  ${indexPath}`,
          'Project Summary'
        );

        await prompts.note(
          '1. Review .ax-cli/CUSTOM.md and customize if needed\n' +
          '2. Start chatting: ax-cli\n' +
          '3. Use --force to regenerate after project changes',
          'Next Steps'
        );

        prompts.outro(chalk.green('Project initialized successfully!'));

      } catch (error) {
        prompts.log.error(`Error during initialization: ${extractErrorMessage(error)}`);
        if (options.verbose && error instanceof Error && error.stack) {
          console.error('\nStack trace:');
          console.error(error.stack);
        }
        process.exit(1);
      }
    });

  return initCommand;
}
