/**
 * Init command for project setup and analysis
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectAnalyzer } from '../utils/project-analyzer.js';
import { LLMOptimizedInstructionGenerator } from '../utils/llm-optimized-instruction-generator.js';
import type { InitOptions } from '../types/project-analysis.js';

export function createInitCommand(): Command {
  const initCommand = new Command('init')
    .description('Initialize AX CLI for your project with intelligent analysis')
    .option('-f, --force', 'Force regeneration even if files exist', false)
    .option('-v, --verbose', 'Verbose output showing analysis details', false)
    .option('-d, --directory <dir>', 'Project directory to analyze', process.cwd())
    .action(async (options: InitOptions & { directory?: string }) => {
      try {
        const projectRoot = options.directory || process.cwd();

        console.log('🔍 Analyzing project...\n');

        // Change to project directory if specified
        if (options.directory) {
          process.chdir(options.directory);
        }

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

        // Create .ax-cli directory
        if (!fs.existsSync(axCliDir)) {
          fs.mkdirSync(axCliDir, { recursive: true });
          console.log('📁 Created .ax-cli directory');
        }

        // Write custom instructions
        fs.writeFileSync(customMdPath, instructions, 'utf-8');
        console.log(`✅ Generated custom instructions: ${customMdPath}`);

        // Write project index
        fs.writeFileSync(indexPath, index, 'utf-8');
        console.log(`✅ Generated project index: ${indexPath}`);

        // Display warnings if any
        if (result.warnings && result.warnings.length > 0) {
          console.log('\n⚠️  Warnings:');
          result.warnings.forEach(w => console.log(`   - ${w}`));
        }

        // Display next steps
        console.log('\n🎉 Project initialized successfully!\n');
        console.log('📝 Custom instructions have been generated at:');
        console.log(`   ${customMdPath}\n`);
        console.log('💡 Next steps:');
        console.log('   1. Review and customize the instructions if needed');
        console.log('   2. Run AX CLI - it will automatically use these instructions');
        console.log('   3. Use `ax-cli init --force` to regenerate after project changes\n');

        // Check for legacy .grok directory
        const legacyGrokDir = path.join(projectRoot, '.grok');
        if (fs.existsSync(legacyGrokDir)) {
          console.log('ℹ️  Legacy .grok directory detected');
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
