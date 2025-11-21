/**
 * Memory command for managing custom instructions (CUSTOM.md)
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as prompts from '@clack/prompts';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseJsonFile } from '../utils/json-utils.js';
import { TOKEN_CONFIG } from '../constants.js';

const execFileAsync = promisify(execFile);

// Whitelist of safe editors to prevent command injection
const SAFE_EDITORS = ['code', 'vim', 'nano', 'vi', 'emacs', 'subl', 'nvim', 'gedit', 'kate', 'notepad'];
// Pattern for valid editor names (alphanumeric, dots, hyphens, underscores only)
const VALID_EDITOR_PATTERN = /^[a-zA-Z0-9._-]+$/;

export function createMemoryCommand(): Command {
  const memoryCommand = new Command('memory')
    .description('Manage custom instructions (CUSTOM.md)')
    .alias('mem');

  // Show current custom instructions
  memoryCommand
    .command('show')
    .description('Display current custom instructions')
    .option('-p, --path', 'Show file path only', false)
    .action(async (options: { path?: boolean }) => {
      try {
        const customMdPath = path.join(process.cwd(), '.ax-cli', 'CUSTOM.md');

        if (!fs.existsSync(customMdPath)) {
          console.error('❌ Custom instructions not found');
          console.error('   Run: ax-cli init');
          process.exit(1);
        }

        if (options.path) {
          console.log(customMdPath);
          return;
        }

        const content = fs.readFileSync(customMdPath, 'utf-8');

        prompts.intro('Custom Instructions');
        await prompts.note(content, customMdPath);

        console.log(`\n📝 ${content.length} characters\n`);
      } catch (error) {
        console.error('❌ Error reading custom instructions:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Edit custom instructions
  memoryCommand
    .command('edit')
    .description('Edit custom instructions in your default editor')
    .option('-e, --editor <editor>', 'Specify editor (code, vim, nano)')
    .action(async (options: { editor?: string }) => {
      try {
        const customMdPath = path.join(process.cwd(), '.ax-cli', 'CUSTOM.md');

        if (!fs.existsSync(customMdPath)) {
          console.error('❌ Custom instructions not found');
          console.error('   Run: ax-cli init');
          process.exit(1);
        }

        // Determine editor
        let editor = options.editor || process.env.EDITOR || 'code';

        // Validate editor
        const validEditors = ['code', 'vim', 'nano', 'vi', 'emacs', 'subl'];
        if (!validEditors.includes(editor)) {
          const useCustomEditor = await prompts.confirm({
            message: `Use custom editor '${editor}'?`,
            initialValue: false,
          });

          if (prompts.isCancel(useCustomEditor) || !useCustomEditor) {
            console.log('Operation cancelled.');
            process.exit(0);
          }
        }

        console.log(`📝 Opening ${customMdPath} in ${editor}...`);

        // Validate editor to prevent command injection
        if (!SAFE_EDITORS.includes(editor) && !VALID_EDITOR_PATTERN.test(editor)) {
          console.error(`❌ Invalid editor name: ${editor}`);
          console.error(`   Allowed editors: ${SAFE_EDITORS.join(', ')}`);
          console.error(`   Or any name matching: alphanumeric, dots, hyphens, underscores`);
          process.exit(1);
        }

        // Open editor with comprehensive error handling
        // Use execFile for safe execution without shell interpolation
        try {
          let editorArgs: string[];

          if (editor === 'code' || editor === 'subl') {
            editorArgs = ['--wait', customMdPath];
          } else {
            editorArgs = [customMdPath];
          }

          await execFileAsync(editor, editorArgs).catch(err => {
            throw new Error(`Editor '${editor}' failed: ${err.message}`);
          });

          console.log('✅ Custom instructions updated\n');
        } catch (error) {
          console.error(`❌ Failed to open editor '${editor}'`);
          console.error(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.error(`   Try: EDITOR=vim ax-cli memory edit`);
          process.exit(1);
        }
      } catch (error) {
        console.error('❌ Error editing custom instructions:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Add content to custom instructions
  memoryCommand
    .command('add <content>')
    .description('Add content to custom instructions')
    .option('-s, --section <section>', 'Add to specific section (rules, patterns, workflow, troubleshooting)')
    .action(async (content: string, options: { section?: string }) => {
      try {
        const customMdPath = path.join(process.cwd(), '.ax-cli', 'CUSTOM.md');

        if (!fs.existsSync(customMdPath)) {
          console.error('❌ Custom instructions not found');
          console.error('   Run: ax-cli init');
          process.exit(1);
        }

        let currentContent = fs.readFileSync(customMdPath, 'utf-8');

        if (options.section) {
          // Add to specific section
          const sectionMap: Record<string, string> = {
            rules: '## 🎯 Critical Rules',
            patterns: '## 🔧 Code Patterns',
            workflow: '## 🔄 Workflow',
            troubleshooting: '## 🐛 Troubleshooting',
          };

          const sectionHeader = sectionMap[options.section];
          if (!sectionHeader) {
            console.error(`❌ Unknown section: ${options.section}`);
            console.error(`   Valid sections: ${Object.keys(sectionMap).join(', ')}`);
            process.exit(1);
          }

          // Find section and add content
          const sectionIndex = currentContent.indexOf(sectionHeader);
          if (sectionIndex === -1) {
            console.error(`❌ Section '${sectionHeader}' not found in CUSTOM.md`);
            process.exit(1);
          }

          // Find next section or end of file
          const nextSectionIndex = currentContent.indexOf('\n##', sectionIndex + sectionHeader.length);
          const insertIndex = nextSectionIndex === -1 ? currentContent.length : nextSectionIndex;

          // Insert content before next section
          currentContent = currentContent.slice(0, insertIndex) +
                          `\n${content}\n` +
                          currentContent.slice(insertIndex);
        } else {
          // Append to end
          currentContent += `\n\n${content}\n`;
        }

        fs.writeFileSync(customMdPath, currentContent, 'utf-8');
        console.log('✅ Content added to custom instructions\n');
      } catch (error) {
        console.error('❌ Error adding content:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Reset custom instructions
  memoryCommand
    .command('reset')
    .description('Reset custom instructions to project analysis defaults')
    .option('-y, --yes', 'Skip confirmation', false)
    .action(async (options: { yes?: boolean }) => {
      try {
        const customMdPath = path.join(process.cwd(), '.ax-cli', 'CUSTOM.md');

        if (!fs.existsSync(customMdPath)) {
          console.error('❌ Custom instructions not found');
          console.error('   Run: ax-cli init');
          process.exit(1);
        }

        // Confirm reset
        if (!options.yes) {
          const confirmed = await prompts.confirm({
            message: 'Reset custom instructions? This will delete your customizations.',
            initialValue: false,
          });

          if (prompts.isCancel(confirmed) || !confirmed) {
            console.log('Operation cancelled.');
            process.exit(0);
          }
        }

        // Run init with force to regenerate
        console.log('🔄 Regenerating custom instructions...\n');

        const { ProjectAnalyzer } = await import('../utils/project-analyzer.js');
        const { LLMOptimizedInstructionGenerator } = await import('../utils/llm-optimized-instruction-generator.js');

        const analyzer = new ProjectAnalyzer(process.cwd());
        const result = await analyzer.analyze();

        if (!result.success || !result.projectInfo) {
          console.error('❌ Failed to analyze project:', result.error);
          process.exit(1);
        }

        const generator = new LLMOptimizedInstructionGenerator({
          compressionLevel: 'moderate',
          hierarchyEnabled: true,
          criticalRulesCount: 5,
          includeDODONT: true,
          includeTroubleshooting: true,
        });

        const instructions = generator.generateInstructions(result.projectInfo);
        fs.writeFileSync(customMdPath, instructions, 'utf-8');

        console.log('✅ Custom instructions reset to defaults\n');
      } catch (error) {
        console.error('❌ Error resetting custom instructions:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Show stats about custom instructions
  memoryCommand
    .command('stats')
    .description('Show statistics about custom instructions')
    .action(async () => {
      try {
        const customMdPath = path.join(process.cwd(), '.ax-cli', 'CUSTOM.md');
        const indexPath = path.join(process.cwd(), '.ax-cli', 'index.json');

        if (!fs.existsSync(customMdPath)) {
          console.error('❌ Custom instructions not found');
          console.error('   Run: ax-cli init');
          process.exit(1);
        }

        const content = fs.readFileSync(customMdPath, 'utf-8');
        const lines = content.split('\n').length;
        const words = content.split(/\s+/).length;
        const chars = content.length;

        // Count sections
        const sections = (content.match(/^## /gm) || []).length;

        // Estimate tokens (rough approximation: ~4 chars per token)
        const estimatedTokens = Math.ceil(chars / TOKEN_CONFIG.CHARS_PER_TOKEN_ESTIMATE);

        prompts.intro('Custom Instructions Statistics');

        await prompts.note(
          `Characters: ${chars}\n` +
          `Words: ${words}\n` +
          `Lines: ${lines}\n` +
          `Sections: ${sections}\n` +
          `Estimated Tokens: ~${estimatedTokens}`,
          'Content'
        );

        // Show project info if available
        if (fs.existsSync(indexPath)) {
          const result = parseJsonFile<ProjectIndex>(indexPath);
          interface ProjectIndex {
            projectName?: string;
            projectType?: string;
            primaryLanguage?: string;
            templateId?: string;
            lastAnalyzed?: string;
            templateAppliedAt?: string;
          }

          if (result.success) {
            const indexData = result.data;
            await prompts.note(
              `Name: ${indexData.projectName || 'Unknown'}\n` +
              `Type: ${indexData.projectType || 'Unknown'}\n` +
              `Language: ${indexData.primaryLanguage || 'Unknown'}\n` +
              (indexData.templateId ? `Template: ${indexData.templateId}\n` : '') +
              `Last Updated: ${indexData.lastAnalyzed || indexData.templateAppliedAt || 'Unknown'}`,
              'Project Info'
            );
          }
        }

        console.log('');
      } catch (error) {
        console.error('❌ Error calculating stats:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  return memoryCommand;
}
