/**
 * Memory command for managing custom instructions (CUSTOM.md)
 * and project memory (memory.json) for z.ai GLM-4.6 caching
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as prompts from '@clack/prompts';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseJsonFile } from '../utils/json-utils.js';
import { TOKEN_CONFIG, CONFIG_DIR_NAME, FILE_NAMES, CONFIG_PATHS } from '../constants.js';
import {
  ContextGenerator,
  ContextStore,
  StatsCollector,
  resetDefaultInjector,
  type WarmupOptions,
  type RefreshOptions,
  type StatusOptions,
} from '../memory/index.js';

const execFileAsync = promisify(execFile);

// Whitelist of safe editors to prevent command injection
const SAFE_EDITORS = ['code', 'vim', 'nano', 'vi', 'emacs', 'subl', 'nvim', 'gedit', 'kate', 'notepad'];
// Pattern for valid editor names (alphanumeric, dots, hyphens, underscores only)
const VALID_EDITOR_PATTERN = /^[a-zA-Z0-9._-]+$/;

export function createMemoryCommand(): Command {
  const memoryCommand = new Command('memory')
    .description('Manage project memory and custom instructions')
    .alias('mem');

  // ============================================
  // PROJECT MEMORY COMMANDS (NEW)
  // ============================================

  // Warmup - Create project memory
  memoryCommand
    .command('warmup')
    .description('Scan project and create reusable context for GLM caching')
    .option('-d, --depth <n>', 'Directory scan depth (1-10)', '3')
    .option('-m, --max-tokens <n>', 'Maximum context tokens', '8000')
    .option('-v, --verbose', 'Show detailed scan progress', false)
    .option('--dry-run', 'Preview without saving', false)
    .action(async (options: {
      depth?: string;
      maxTokens?: string;
      verbose?: boolean;
      dryRun?: boolean;
    }) => {
      try {
        // BUG FIX: Validate parseInt results to prevent NaN in config
        const parsedDepth = parseInt(options.depth || '3', 10);
        const parsedMaxTokens = parseInt(options.maxTokens || '8000', 10);
        const warmupOptions: WarmupOptions = {
          depth: Math.min(10, Math.max(1, isNaN(parsedDepth) ? 3 : parsedDepth)),
          maxTokens: isNaN(parsedMaxTokens) ? 8000 : parsedMaxTokens,
          verbose: options.verbose,
          dryRun: options.dryRun,
        };

        console.log('🔄 Scanning project...\n');

        const generator = new ContextGenerator(process.cwd());
        const result = await generator.generate(warmupOptions);

        if (!result.success || !result.memory) {
          console.error(`❌ Failed to generate context: ${result.error}`);
          if (result.warnings && result.warnings.length > 0) {
            console.error('\n⚠️  Warnings:');
            result.warnings.forEach(w => console.error(`   - ${w}`));
          }
          process.exit(1);
        }

        const memory = result.memory;

        // Display results
        console.log(`✓ Project memory generated (${memory.context.token_estimate.toLocaleString()} tokens)\n`);

        console.log('📊 Context breakdown:');
        const sections = memory.context.sections;
        const total = memory.context.token_estimate;

        // BUG FIX: Guard against division by zero when total is 0
        const calcPct = (value: number) => total > 0 ? Math.round((value / total) * 100) : 0;

        if (sections.structure) {
          const pct = calcPct(sections.structure);
          console.log(`   Structure:  ${sections.structure.toLocaleString().padStart(5)} tokens (${pct}%)`);
        }
        if (sections.readme) {
          const pct = calcPct(sections.readme);
          console.log(`   README:     ${sections.readme.toLocaleString().padStart(5)} tokens (${pct}%)`);
        }
        if (sections.config) {
          const pct = calcPct(sections.config);
          console.log(`   Config:     ${sections.config.toLocaleString().padStart(5)} tokens (${pct}%)`);
        }
        if (sections.patterns) {
          const pct = calcPct(sections.patterns);
          console.log(`   Patterns:   ${sections.patterns.toLocaleString().padStart(5)} tokens (${pct}%)`);
        }

        // Show warnings
        if (result.warnings && result.warnings.length > 0) {
          console.log('\n⚠️  Warnings:');
          result.warnings.forEach(w => console.log(`   - ${w}`));
        }

        if (options.dryRun) {
          console.log('\n📝 Dry-run mode - no files written');
          if (options.verbose) {
            console.log('\n--- Generated Context ---');
            console.log(memory.context.formatted);
            console.log('--- End Context ---');
          }
          return;
        }

        // Save to disk
        const store = new ContextStore(process.cwd());
        const saveResult = store.save(memory);

        if (!saveResult.success) {
          console.error(`\n❌ Failed to save: ${saveResult.error}`);
          process.exit(1);
        }

        // Clear cached memory in any active sessions
        resetDefaultInjector();

        console.log(`\n✅ Saved to ${CONFIG_DIR_NAME}/${FILE_NAMES.MEMORY_JSON}`);
        console.log('\n💡 This context will be automatically included in ax plan/think/spec');
        console.log('   z.ai will cache identical content for faster responses\n');
      } catch (error) {
        console.error('❌ Error during warmup:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Refresh - Update project memory
  memoryCommand
    .command('refresh')
    .description('Update project memory with latest changes')
    .option('-v, --verbose', 'Show change details', false)
    .option('-f, --force', 'Force refresh even if unchanged', false)
    .action(async (options: RefreshOptions) => {
      try {
        const store = new ContextStore(process.cwd());

        if (!store.exists()) {
          console.error('❌ No project memory found');
          console.error('   Run: ax memory warmup');
          process.exit(1);
        }

        const previousResult = store.load();
        if (!previousResult.success) {
          console.error(`❌ Failed to load existing memory: ${previousResult.error}`);
          process.exit(1);
        }

        const previousMemory = previousResult.data;
        const previousTokens = previousMemory.context.token_estimate;

        console.log('🔄 Refreshing project memory...\n');

        const generator = new ContextGenerator(process.cwd());
        const result = await generator.generate({ verbose: options.verbose });

        if (!result.success || !result.memory) {
          console.error(`❌ Failed to regenerate: ${result.error}`);
          process.exit(1);
        }

        const newMemory = result.memory;

        // Check if changed
        if (newMemory.content_hash === previousMemory.content_hash && !options.force) {
          console.log('✓ No changes detected');
          console.log(`   Current: ${previousTokens.toLocaleString()} tokens`);
          console.log('\n💡 Use --force to regenerate anyway\n');
          return;
        }

        // Preserve stats from previous memory
        newMemory.stats = previousMemory.stats;

        const saveResult = store.save(newMemory);
        if (!saveResult.success) {
          console.error(`❌ Failed to save: ${saveResult.error}`);
          process.exit(1);
        }

        // Clear cached memory in any active sessions
        resetDefaultInjector();

        const diff = newMemory.context.token_estimate - previousTokens;
        const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;

        console.log('✓ Project memory updated');
        console.log(`   Previous: ${previousTokens.toLocaleString()} tokens`);
        console.log(`   Current:  ${newMemory.context.token_estimate.toLocaleString()} tokens (${diffStr})\n`);
      } catch (error) {
        console.error('❌ Error during refresh:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Status - Show project memory status
  memoryCommand
    .command('status')
    .description('Show project memory status and statistics')
    .option('-v, --verbose', 'Show full context content', false)
    .option('--json', 'Output as JSON', false)
    .action(async (options: StatusOptions) => {
      try {
        const store = new ContextStore(process.cwd());

        if (!store.exists()) {
          console.log('📦 Project Memory: Not initialized\n');
          console.log('💡 Run: ax memory warmup\n');
          return;
        }

        const result = store.load();
        if (!result.success) {
          console.error(`❌ Failed to load: ${result.error}`);
          process.exit(1);
        }

        const memory = result.data;

        if (options.json) {
          console.log(JSON.stringify(memory, null, 2));
          return;
        }

        console.log('📦 Project Memory Status\n');
        console.log(`   Created:  ${new Date(memory.created_at).toLocaleString()}`);
        console.log(`   Updated:  ${new Date(memory.updated_at).toLocaleString()}`);
        console.log(`   Context:  ${memory.context.token_estimate.toLocaleString()} tokens`);
        console.log(`   Hash:     ${memory.content_hash.slice(0, 20)}...`);

        // Show section breakdown
        console.log('\n📊 Token Distribution:');
        const sections = memory.context.sections;
        const total = memory.context.token_estimate;

        const formatBar = (tokens: number | undefined, label: string) => {
          if (!tokens || !total || total === 0) return;
          const pct = Math.round((tokens / total) * 100);
          const barLen = Math.round(pct / 5);
          const bar = '█'.repeat(barLen) + '░'.repeat(20 - barLen);
          console.log(`   ${bar}  ${label.padEnd(10)} (${pct}%)`);
        };

        formatBar(sections.structure, 'Structure');
        formatBar(sections.readme, 'README');
        formatBar(sections.config, 'Config');
        formatBar(sections.patterns, 'Patterns');

        // Show stats if available
        if (memory.stats) {
          const statsCollector = new StatsCollector(process.cwd());
          const formatted = statsCollector.getFormattedStats();
          if (formatted) {
            console.log('\n' + formatted.text);
          }
        }

        if (options.verbose) {
          console.log('\n--- Full Context ---');
          console.log(memory.context.formatted);
          console.log('--- End Context ---');
        }

        console.log('');
      } catch (error) {
        console.error('❌ Error getting status:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Clear - Remove project memory
  memoryCommand
    .command('clear')
    .description('Remove project memory')
    .option('-y, --yes', 'Skip confirmation', false)
    .action(async (options: { yes?: boolean }) => {
      try {
        const store = new ContextStore(process.cwd());

        if (!store.exists()) {
          console.log('✓ No project memory to clear\n');
          return;
        }

        if (!options.yes) {
          const confirmed = await prompts.confirm({
            message: 'Remove project memory? (This does not affect custom instructions)',
            initialValue: false,
          });

          if (prompts.isCancel(confirmed) || !confirmed) {
            console.log('Operation cancelled.');
            return;
          }
        }

        const result = store.clear();
        if (!result.success) {
          console.error(`❌ Failed to clear: ${result.error}`);
          process.exit(1);
        }

        console.log('✓ Project memory cleared\n');
      } catch (error) {
        console.error('❌ Error clearing memory:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Cache stats - Show cache efficiency
  memoryCommand
    .command('cache-stats')
    .description('Show GLM cache efficiency statistics')
    .option('--reset', 'Reset statistics', false)
    .action(async (options: { reset?: boolean }) => {
      try {
        const store = new ContextStore(process.cwd());

        if (!store.exists()) {
          console.log('📦 No project memory found\n');
          console.log('💡 Run: ax memory warmup\n');
          return;
        }

        const statsCollector = new StatsCollector(process.cwd());

        if (options.reset) {
          const success = statsCollector.resetStats();
          if (success) {
            console.log('✓ Cache statistics reset\n');
          } else {
            console.error('❌ Failed to reset statistics');
            process.exit(1);
          }
          return;
        }

        const formatted = statsCollector.getFormattedStats();
        if (!formatted) {
          console.log('📊 No cache statistics available yet\n');
          console.log('💡 Statistics are collected when using ax plan/think/spec\n');
          return;
        }

        console.log(formatted.text);

        // Check cache health
        const healthWarning = statsCollector.checkCacheHealth();
        if (healthWarning) {
          console.log(`\n⚠️  ${healthWarning}`);
        }

        console.log('');
      } catch (error) {
        console.error('❌ Error getting cache stats:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // ============================================
  // CUSTOM INSTRUCTIONS COMMANDS (EXISTING)
  // ============================================

  // Show current custom instructions
  memoryCommand
    .command('show')
    .description('Display current custom instructions')
    .option('-p, --path', 'Show file path only', false)
    .action(async (options: { path?: boolean }) => {
      try {
        const customMdPath = CONFIG_PATHS.CUSTOM_MD;

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
        prompts.note(content, customMdPath);

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
        const customMdPath = CONFIG_PATHS.CUSTOM_MD;

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
        const customMdPath = CONFIG_PATHS.CUSTOM_MD;

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
        const customMdPath = CONFIG_PATHS.CUSTOM_MD;

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
        const customMdPath = CONFIG_PATHS.CUSTOM_MD;
        const indexPath = CONFIG_PATHS.INDEX_JSON;

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

        prompts.note(
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
            prompts.note(
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
