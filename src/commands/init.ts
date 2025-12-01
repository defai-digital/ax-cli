/**
 * Init command for project setup and analysis
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectAnalyzer } from '../utils/project-analyzer.js';
import { LLMOptimizedInstructionGenerator } from '../utils/llm-optimized-instruction-generator.js';
import { InitWizard } from './init/wizard.js';
import { InitValidator } from '../utils/init-validator.js';
import { InitPreviewer } from '../utils/init-previewer.js';
import { ProgressTracker } from '../utils/progress-tracker.js';
import type { InitOptions } from '../types/project-analysis.js';
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
    .action(async (options: InitOptions & {
      directory?: string;
      yes?: boolean;
      noInteraction?: boolean;
      template?: string;
      preview?: boolean;
      dryRun?: boolean;
      validate?: boolean;
    }) => {
      try {
        if (options.verbose) {
          console.log(`options.directory: ${options.directory}`);
        }

        // Determine project root
        const projectRoot = options.directory ? path.resolve(options.directory) : process.cwd();

        if (options.verbose) {
          console.log(`Working directory: ${projectRoot}`);
        }

        // Run validation if requested
        if (options.validate) {
          const validator = new InitValidator(projectRoot);
          const validationResult = validator.validate();

          console.log('\n' + InitValidator.formatValidationResult(validationResult));
          process.exit(validationResult.valid ? 0 : 1);
        }

        // Run interactive wizard for first-time users (unless --yes or --no-interaction)
        const wizard = new InitWizard({
          nonInteractive: options.noInteraction,
          yes: options.yes,
          template: options.template,
        });

        const wizardResult = await wizard.run();

        // Initialize progress tracker
        const progress = new ProgressTracker();
        progress.addStep('validate', 'Validating project');
        progress.addStep('analyze', 'Analyzing project');
        progress.addStep('generate', 'Generating instructions');
        progress.addStep('write', 'Writing files');

        // Run validation before proceeding
        await progress.startStep('validate');
        const validator = new InitValidator(projectRoot);
        const validationResult = validator.validate();

        if (options.verbose && (validationResult.warnings.length > 0 || validationResult.suggestions.length > 0)) {
          console.log('\n' + InitValidator.formatValidationResult(validationResult));
        }

        if (!validationResult.valid) {
          await progress.failStep('validate', 'Validation failed');
          console.error('\n❌ Validation failed:');
          console.error(InitValidator.formatValidationResult(validationResult));
          process.exit(1);
        }

        await progress.completeStep('validate');

        // Check if already initialized
        const axCliDir = path.join(projectRoot, CONFIG_DIR_NAME);
        const customMdPath = path.join(axCliDir, FILE_NAMES.CUSTOM_MD);
        const indexPath = path.join(axCliDir, FILE_NAMES.INDEX_JSON);

        if (!options.force && fs.existsSync(customMdPath)) {
          progress.stop();
          console.log('✅ Project already initialized!');
          console.log(`📝 Custom instructions: ${customMdPath}`);
          console.log(`📊 Project index: ${indexPath}`);
          console.log('\n💡 Use --force to regenerate\n');
          return;
        }

        // Analyze project
        await progress.startStep('analyze');
        const analyzer = new ProjectAnalyzer(projectRoot);
        const result = await analyzer.analyze();

        if (!result.success || !result.projectInfo) {
          await progress.failStep('analyze', result.error || 'Unknown error');
          console.error('❌ Failed to analyze project:', result.error);
          if (result.warnings && result.warnings.length > 0) {
            console.error('\n⚠️  Warnings:');
            result.warnings.forEach(w => console.error(`   - ${w}`));
          }
          process.exit(1);
        }

        const projectInfo = result.projectInfo;
        await progress.completeStep('analyze');

        // Display analysis results
        if (options.verbose) {
          console.log('📋 Project Analysis Results:\n');
          console.log(`   Name: ${projectInfo.name}`);
          console.log(`   Type: ${projectInfo.projectType}`);
          console.log(`   Language: ${projectInfo.primaryLanguage}`);
          if (projectInfo.techStack.length > 0) {
            console.log(`   Stack: ${projectInfo.techStack.join(', ')}`);
          }
          if (projectInfo.entryPoint) {
            console.log(`   Entry: ${projectInfo.entryPoint}`);
          }
          console.log('');
        }

        // Create config directory
        if (!fs.existsSync(axCliDir)) {
          fs.mkdirSync(axCliDir, { recursive: true });
          console.log(`📁 Created ${CONFIG_DIR_NAME} directory`);
        }

        // Generate content (either from template or project analysis)
        await progress.startStep('generate');
        let instructions: string;
        let index: string;

        if (wizardResult.selectedTemplate) {
          progress.updateMessage(`Applying template: ${wizardResult.selectedTemplate.name}`);
          instructions = wizardResult.selectedTemplate.instructions;
          const indexData = {
            projectName: wizardResult.selectedTemplate.name,
            version: wizardResult.selectedTemplate.version,
            projectType: wizardResult.selectedTemplate.projectType,
            ...wizardResult.selectedTemplate.metadata,
            templateId: wizardResult.selectedTemplate.id,
            templateAppliedAt: new Date().toISOString(),
          };
          index = JSON.stringify(indexData, null, 2);
        } else {
          progress.updateMessage('Generating LLM-optimized instructions');
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

        await progress.completeStep('generate');

        // Preview or dry-run mode
        if (options.preview || options.dryRun) {
          progress.stop();
          const previewer = new InitPreviewer(projectRoot);
          await previewer.preview(instructions, index, {
            showDiff: options.preview,
            showFull: false,
            maxLines: 30,
          });

          if (options.dryRun) {
            console.log('\n✅ Dry-run complete (no changes made)\n');
            console.log(progress.getSummary());
            return;
          }

          // Ask for confirmation if preview mode
          if (options.preview) {
            const confirmed = await previewer.confirmChanges();
            if (!confirmed) {
              console.log('\n❌ Operation cancelled\n');
              return;
            }
          }
        }

        // Write files using atomic operations
        await progress.startStep('write');

        // Atomic write for CUSTOM.md
        const tmpCustomPath = `${customMdPath}.tmp`;
        const tmpIndexPath = `${indexPath}.tmp`;

        try {
          fs.writeFileSync(tmpCustomPath, instructions, 'utf-8');
          fs.writeFileSync(tmpIndexPath, index, 'utf-8');

          // Atomic rename
          fs.renameSync(tmpCustomPath, customMdPath);
          fs.renameSync(tmpIndexPath, indexPath);

          console.log(`✅ Generated custom instructions: ${customMdPath}`);
          console.log(`✅ Generated project index: ${indexPath}`);
        } catch (writeError) {
          // Cleanup temp files on error
          try {
            if (fs.existsSync(tmpCustomPath)) fs.unlinkSync(tmpCustomPath);
            if (fs.existsSync(tmpIndexPath)) fs.unlinkSync(tmpIndexPath);
          } catch {
            // Ignore cleanup errors
          }
          throw writeError;
        }

        await progress.completeStep('write');

        // Display warnings if any
        if (result.warnings && result.warnings.length > 0) {
          console.log('\n⚠️  Warnings:');
          result.warnings.forEach(w => console.log(`   - ${w}`));
        }

        // Show completion summary using wizard
        await wizard.showCompletion(wizardResult, projectInfo);

        // Show progress summary if verbose
        if (options.verbose) {
          console.log('\n📊 ' + progress.getSummary() + '\n');
        }

        progress.stop();

      } catch (error) {
        console.error('❌ Error during initialization:', error instanceof Error ? error.message : 'Unknown error');
        if (options.verbose && error instanceof Error && error.stack) {
          console.error('\nStack trace:');
          console.error(error.stack);
        }
        process.exit(1);
      }
    });

  return initCommand;
}
