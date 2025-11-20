/**
 * Init command for project setup and analysis
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectAnalyzer } from '../utils/project-analyzer.js';
import { LLMOptimizedInstructionGenerator } from '../utils/llm-optimized-instruction-generator.js';
import { TemplateManager } from '../utils/template-manager.js';
import { InitWizard } from './init/wizard.js';
import type { InitOptions } from '../types/project-analysis.js';

export function createInitCommand(): Command {
  const initCommand = new Command('init')
    .description('Initialize AX CLI for your project with intelligent analysis')
    .option('-f, --force', 'Force regeneration even if files exist', false)
    .option('-v, --verbose', 'Verbose output showing analysis details', false)
    .option('-d, --directory <dir>', 'Project directory to analyze')
    .option('-y, --yes', 'Skip interactive prompts and use defaults', false)
    .option('--no-interaction', 'Run in non-interactive mode', false)
    .option('-t, --template <template-id>', 'Use a specific template')
    .action(async (options: InitOptions & { directory?: string; yes?: boolean; noInteraction?: boolean; template?: string }) => {
      try {
        if (options.verbose) {
          console.log(`options.directory: ${options.directory}`);
        }

        // Determine project root
        const projectRoot = options.directory ? path.resolve(options.directory) : process.cwd();

        if (options.verbose) {
          console.log(`Working directory: ${projectRoot}`);
        }

        // Run interactive wizard for first-time users (unless --yes or --no-interaction)
        const wizard = new InitWizard({
          nonInteractive: options.noInteraction,
          yes: options.yes,
          template: options.template,
        });

        const wizardResult = await wizard.run();

        // Check if already initialized
        const axCliDir = path.join(projectRoot, '.ax-cli');
        const customMdPath = path.join(axCliDir, 'CUSTOM.md');
        const indexPath = path.join(axCliDir, 'index.json');

        if (!options.force && fs.existsSync(customMdPath)) {
          console.log('✅ Project already initialized!');
          console.log(`📝 Custom instructions: ${customMdPath}`);
          console.log(`📊 Project index: ${indexPath}`);
          console.log('\n💡 Use --force to regenerate\n');
          return;
        }

        // Analyze project
        const analyzer = new ProjectAnalyzer(projectRoot);
        const result = await analyzer.analyze();

        if (!result.success || !result.projectInfo) {
          console.error('❌ Failed to analyze project:', result.error);
          if (result.warnings && result.warnings.length > 0) {
            console.error('\n⚠️  Warnings:');
            result.warnings.forEach(w => console.error(`   - ${w}`));
          }
          process.exit(1);
        }

        const projectInfo = result.projectInfo;

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

        // Create .ax-cli directory
        if (!fs.existsSync(axCliDir)) {
          fs.mkdirSync(axCliDir, { recursive: true });
          console.log('📁 Created .ax-cli directory');
        }

        // Check if using a template
        if (wizardResult.selectedTemplate) {
          // Apply template
          const success = TemplateManager.applyTemplate(wizardResult.selectedTemplate, projectRoot);
          if (success) {
            console.log(`✅ Applied template: ${wizardResult.selectedTemplate.name}`);
            console.log(`✅ Generated custom instructions: ${customMdPath}`);
            console.log(`✅ Generated project index: ${indexPath}`);
          } else {
            console.error('❌ Failed to apply template');
            process.exit(1);
          }
        } else {
          // Generate LLM-optimized instructions
          const generator = new LLMOptimizedInstructionGenerator({
            compressionLevel: 'moderate',
            hierarchyEnabled: true,
            criticalRulesCount: 5,
            includeDODONT: true,
            includeTroubleshooting: true,
          });
          const instructions = generator.generateInstructions(projectInfo);
          const index = generator.generateIndex(projectInfo);

          // Write custom instructions
          fs.writeFileSync(customMdPath, instructions, 'utf-8');
          console.log(`✅ Generated custom instructions: ${customMdPath}`);

          // Write project index
          fs.writeFileSync(indexPath, index, 'utf-8');
          console.log(`✅ Generated project index: ${indexPath}`);
        }

        // Display warnings if any
        if (result.warnings && result.warnings.length > 0) {
          console.log('\n⚠️  Warnings:');
          result.warnings.forEach(w => console.log(`   - ${w}`));
        }

        // Show completion summary using wizard
        await wizard.showCompletion(wizardResult, projectInfo);

        // Check for legacy .grok directory
        const legacyGrokDir = path.join(projectRoot, '.grok');
        if (fs.existsSync(legacyGrokDir)) {
          console.log('\nℹ️  Legacy .grok directory detected');
          console.log('   Consider migrating to .ax-cli by copying custom settings\n');
        }

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
