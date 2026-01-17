/**
 * LLM-Optimized Instruction Generator
 * Generates token-efficient, comprehension-optimized project instructions
 *
 * Refactored to:
 * - Generate AX.md output (single file at project root)
 * - Remove hardcoded automatosx/ paths
 * - Support depth levels (basic, standard, full, security)
 * - Adaptive output based on project complexity
 * - Focus on project-specific rules derived from analysis
 */

import type { ProjectInfo, ComplexityLevel } from '../types/project-analysis.js';

/** Depth levels for generated output */
export type DepthLevel = 'basic' | 'standard' | 'full' | 'security';

/** Configuration for instruction generation */
export interface GeneratorConfig {
  /** Output depth level */
  depth: DepthLevel;
  /** Include troubleshooting section */
  includeTroubleshooting: boolean;
  /** Include code patterns with examples */
  includeCodePatterns: boolean;
  /** External rules parsed from .cursorrules, .editorconfig, etc. */
  externalRules?: string[];
  /** Use adaptive output based on project complexity (default: true) */
  adaptiveOutput?: boolean;
}

/** Default configuration */
const DEFAULT_CONFIG: GeneratorConfig = {
  depth: 'standard',
  includeTroubleshooting: true,
  includeCodePatterns: true,
  adaptiveOutput: true,
};

export class LLMOptimizedInstructionGenerator {
  private config: GeneratorConfig;

  constructor(config: Partial<GeneratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate AX.md instructions
   * Single-file output for ax-cli and ax-grok
   *
   * Uses adaptive output based on project complexity when enabled:
   * - small: ~300 tokens (minimal sections)
   * - medium: ~600 tokens (standard sections)
   * - large: ~1000 tokens (detailed sections)
   * - enterprise: ~1500 tokens (comprehensive)
   */
  generateAxMd(projectInfo: ProjectInfo): string {
    const sections: string[] = [];

    // Get effective depth - may be adjusted based on complexity
    const effectiveDepth = this.getEffectiveDepth(projectInfo);
    const complexity = projectInfo.complexity?.level || 'medium';

    // Metadata header (HTML comment)
    sections.push(this.generateMetadataHeader(projectInfo));

    // Project header
    sections.push(this.generateProjectHeader(projectInfo));

    // Build & Development commands (always included)
    sections.push(this.generateBuildCommands(projectInfo));

    // Architecture overview (standard+ or medium+ complexity)
    if (effectiveDepth !== 'basic' || complexity !== 'small') {
      sections.push(this.generateArchitectureOverview(projectInfo));
    }

    // Project-specific rules (always included)
    sections.push(this.generateProjectRules(projectInfo));

    // Code patterns (full+ depth or large+ complexity)
    const includeCodePatterns = this.config.includeCodePatterns &&
      (effectiveDepth === 'full' || effectiveDepth === 'security' ||
       complexity === 'large' || complexity === 'enterprise');
    if (includeCodePatterns) {
      sections.push(this.generateCodePatterns(projectInfo));
    }

    // Development tips (include more for complex projects)
    const tipsSection = this.generateDevelopmentTips(projectInfo, complexity);
    if (tipsSection) {
      sections.push(tipsSection);
    }

    // Troubleshooting (standard+ or medium+ complexity)
    if (this.config.includeTroubleshooting && (effectiveDepth !== 'basic' || complexity !== 'small')) {
      const troubleshootingSection = this.generateTroubleshooting(projectInfo);
      if (troubleshootingSection) {
        sections.push(troubleshootingSection);
      }
    }

    return sections.filter(Boolean).join('\n\n');
  }

  /**
   * Get effective depth level, potentially adjusted by complexity
   */
  private getEffectiveDepth(projectInfo: ProjectInfo): DepthLevel {
    if (!this.config.adaptiveOutput) {
      return this.config.depth;
    }

    const complexity = projectInfo.complexity?.level;
    if (!complexity) {
      return this.config.depth;
    }

    // For adaptive mode, upgrade depth for complex projects
    const depthOrder: DepthLevel[] = ['basic', 'standard', 'full', 'security'];
    const complexityUpgrade: Record<ComplexityLevel, number> = {
      small: 0,
      medium: 0,
      large: 1,
      enterprise: 2,
    };

    const currentIndex = depthOrder.indexOf(this.config.depth);
    const upgrade = complexityUpgrade[complexity];
    const newIndex = Math.min(currentIndex + upgrade, depthOrder.length - 1);

    return depthOrder[newIndex];
  }

  /**
   * Generate instructions (backward compatible alias for generateAxMd)
   */
  generateInstructions(projectInfo: ProjectInfo): string {
    return this.generateAxMd(projectInfo);
  }

  /**
   * Generate metadata header as HTML comment
   */
  private generateMetadataHeader(projectInfo: ProjectInfo): string {
    const now = new Date().toISOString().split('T')[0];
    const complexity = projectInfo.complexity;
    const complexityInfo = complexity
      ? `\nComplexity: ${complexity.level} (${complexity.fileCount} files, ~${complexity.linesOfCode} LOC)`
      : '';
    return `<!--
Generated by: ax-cli / ax-grok
Last updated: ${now}${complexityInfo}
Refresh: Run \`/init\` or \`ax init --refresh\` to update
-->`;
  }

  /**
   * Generate project header with essential info
   */
  private generateProjectHeader(projectInfo: ProjectInfo): string {
    const parts: string[] = [`# ${projectInfo.name}`];

    // Metadata line
    const meta: string[] = [];
    meta.push(`**Type:** ${projectInfo.projectType}`);
    meta.push(`**Language:** ${projectInfo.primaryLanguage}`);
    if (projectInfo.packageManager) {
      meta.push(`**PM:** ${projectInfo.packageManager}`);
    }
    if (projectInfo.version) {
      meta.push(`**Version:** ${projectInfo.version}`);
    }
    parts.push(meta.join(' | '));

    // Tech stack (if not empty)
    if (projectInfo.techStack.length > 0) {
      parts.push(`\n**Stack:** ${projectInfo.techStack.slice(0, 8).join(', ')}`);
    }

    // Description (if available)
    if (projectInfo.description) {
      parts.push(`\n${projectInfo.description}`);
    }

    return parts.join('\n');
  }

  /**
   * Generate build & development commands section
   */
  private generateBuildCommands(projectInfo: ProjectInfo): string {
    const { scripts, packageManager } = projectInfo;
    const lines: string[] = ['## Build & Development'];

    // Determine command prefix
    const run = packageManager === 'npm' ? 'npm run' : (packageManager || 'npm run');
    const install = packageManager === 'npm' ? 'npm install' : `${packageManager} install`;

    const commands: string[] = [];
    commands.push(`${install}    # Install dependencies`);

    if (scripts.build) {
      commands.push(`${run} build   # Build project`);
    }
    if (scripts.test) {
      const testCmd = packageManager === 'npm' ? 'npm test' : `${run} test`;
      commands.push(`${testCmd}    # Run tests`);
    }
    if (scripts.lint) {
      commands.push(`${run} lint    # Lint code`);
    }
    if (scripts.dev) {
      commands.push(`${run} dev     # Development mode`);
    }
    if (scripts.typecheck) {
      commands.push(`${run} typecheck  # Type check`);
    }

    if (commands.length > 0) {
      lines.push('```bash');
      lines.push(...commands);
      lines.push('```');
    }

    // Add custom scripts if available (limit to 5)
    if (scripts.custom && Object.keys(scripts.custom).length > 0) {
      const customEntries = Object.entries(scripts.custom).slice(0, 5);
      if (customEntries.length > 0) {
        lines.push('\n**Additional scripts:**');
        for (const [name, cmd] of customEntries) {
          lines.push(`- \`${run} ${name}\` - ${cmd}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate architecture overview section
   */
  private generateArchitectureOverview(projectInfo: ProjectInfo): string {
    const lines: string[] = ['## Architecture'];

    // Key directories
    const dirs: string[] = [];
    if (projectInfo.directories.source) {
      dirs.push(`- \`${projectInfo.directories.source}/\` - Source code`);
    }
    if (projectInfo.directories.tests) {
      dirs.push(`- \`${projectInfo.directories.tests}/\` - Tests`);
    }
    if (projectInfo.directories.docs) {
      dirs.push(`- \`${projectInfo.directories.docs}/\` - Documentation`);
    }
    if (projectInfo.directories.config) {
      dirs.push(`- \`${projectInfo.directories.config}/\` - Configuration`);
    }
    if (projectInfo.directories.dist) {
      dirs.push(`- \`${projectInfo.directories.dist}/\` - Build output`);
    }

    if (dirs.length > 0) {
      lines.push('### Key Directories');
      lines.push(...dirs);
    }

    // Entry point
    if (projectInfo.entryPoint) {
      lines.push(`\n**Entry point:** \`${projectInfo.entryPoint}\``);
    }

    // Key files (limit to 5 most important)
    const keyFiles = Object.entries(projectInfo.keyFiles || {}).slice(0, 5);
    if (keyFiles.length > 0) {
      lines.push('\n### Key Files');
      for (const [file, description] of keyFiles) {
        lines.push(`- \`${file}\` - ${description}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate project-specific rules section
   * These are derived from analysis, not generic templates
   */
  private generateProjectRules(projectInfo: ProjectInfo): string {
    const { conventions, primaryLanguage } = projectInfo;
    const lines: string[] = ['## Project-Specific Rules'];
    const rules: string[] = [];

    // ESM import extension requirement
    if (conventions.importExtension === '.js') {
      rules.push('ESM imports require `.js` extension: `import { x } from \'./y.js\'`');
    }

    // Module system
    if (conventions.moduleSystem === 'esm') {
      rules.push('Use ES modules (`import/export`), not CommonJS (`require`)');
    }

    // Validation library
    if (conventions.validation) {
      rules.push(`Use ${conventions.validation} for input validation`);
    }

    // Test framework
    if (conventions.testFramework) {
      const testDir = projectInfo.directories.tests || 'tests';
      rules.push(`Tests use ${conventions.testFramework} - files in \`${testDir}/\``);
    }

    // Linter
    if (conventions.linter) {
      rules.push(`Code style enforced by ${conventions.linter}`);
    }

    // TypeScript-specific
    if (primaryLanguage === 'TypeScript') {
      rules.push('TypeScript strict mode - explicit types required');
    }

    // Package manager specific
    if (projectInfo.packageManager === 'pnpm') {
      rules.push('Use pnpm for package management (not npm/yarn)');
    }

    // Monorepo hint
    const hasWorkspaces = projectInfo.keyFiles?.['pnpm-workspace.yaml'] ||
                          projectInfo.keyFiles?.['lerna.json'];
    if (hasWorkspaces) {
      rules.push('Monorepo: use workspace commands to target specific packages');
    }

    // Add external rules if provided
    if (this.config.externalRules && this.config.externalRules.length > 0) {
      rules.push(...this.config.externalRules);
    }

    if (rules.length > 0) {
      lines.push(...rules.map((rule, i) => `${i + 1}. ${rule}`));
    } else {
      lines.push('No specific rules detected. Follow standard practices for the language/framework.');
    }

    return lines.join('\n');
  }

  /**
   * Generate code patterns section (for full/security depth)
   */
  private generateCodePatterns(projectInfo: ProjectInfo): string {
    const { primaryLanguage, conventions } = projectInfo;
    const lines: string[] = ['## Code Patterns'];

    // TypeScript patterns
    if (primaryLanguage === 'TypeScript') {
      lines.push('### TypeScript');
      lines.push('```typescript');
      lines.push('// Explicit return types');
      lines.push('function processData(input: string): Promise<Result> {');
      lines.push('  // ...');
      lines.push('}');
      if (conventions.importExtension === '.js') {
        lines.push('');
        lines.push('// ESM imports with .js extension');
        lines.push("import { helper } from './utils/helper.js';");
      }
      lines.push('```');
    }

    // Validation patterns
    if (conventions.validation === 'zod') {
      lines.push('\n### Validation (Zod)');
      lines.push('```typescript');
      lines.push('const schema = z.object({ name: z.string() });');
      lines.push('const result = schema.safeParse(input);');
      lines.push('if (!result.success) {');
      lines.push('  return { error: result.error.format() };');
      lines.push('}');
      lines.push('```');
    }

    return lines.join('\n');
  }

  /**
   * Generate development tips section
   * Shows more tips for complex projects
   */
  private generateDevelopmentTips(projectInfo: ProjectInfo, complexity: ComplexityLevel = 'medium'): string | null {
    const tips = projectInfo.gotchas || [];
    if (tips.length === 0) return null;

    // Adjust number of tips based on complexity
    const tipLimits: Record<ComplexityLevel, number> = {
      small: 3,
      medium: 5,
      large: 7,
      enterprise: 10,
    };
    const tipLimit = tipLimits[complexity];

    const lines: string[] = ['## Development Tips'];
    for (const tip of tips.slice(0, tipLimit)) {
      lines.push(`- ${tip}`);
    }
    return lines.join('\n');
  }

  /**
   * Generate troubleshooting section
   */
  private generateTroubleshooting(projectInfo: ProjectInfo): string | null {
    const { conventions, primaryLanguage } = projectInfo;
    interface Issue { problem: string; solution: string }
    const issues: Issue[] = [];

    // ESM module issues
    if (conventions.importExtension === '.js') {
      issues.push({
        problem: 'Module not found errors',
        solution: 'Add `.js` extension to imports (required for ESM)',
      });
    }

    // TypeScript issues
    if (primaryLanguage === 'TypeScript') {
      issues.push({
        problem: 'TypeScript compilation errors',
        solution: 'Check `tsconfig.json` settings, verify `moduleResolution`',
      });
    }

    // Test framework issues
    if (conventions.testFramework) {
      issues.push({
        problem: 'Tests pass locally but fail in CI',
        solution: 'Check Node version, clear caches, verify environment variables',
      });
    }

    if (issues.length === 0) return null;

    const lines: string[] = ['## Troubleshooting'];
    for (const { problem, solution } of issues) {
      lines.push(`\n**${problem}**`);
      lines.push(`- ${solution}`);
    }
    return lines.join('\n');
  }

  /**
   * Generate deep analysis JSON for .ax/analysis.json
   * Contains Tier 3/4 analysis data for tool-accessible retrieval
   */
  generateDeepAnalysis(projectInfo: ProjectInfo): string {
    // Spread projectInfo first, then override schemaVersion and add generatedAt
    const analysis: Record<string, unknown> = {
      ...projectInfo,
      schemaVersion: '2.0', // Override any existing schemaVersion
      generatedAt: new Date().toISOString(),
    };

    return JSON.stringify(analysis, null, 2);
  }

  /**
   * Generate project index JSON (backward compatible)
   * @deprecated Use generateDeepAnalysis() instead
   */
  generateIndex(projectInfo: ProjectInfo): string {
    return this.generateDeepAnalysis(projectInfo);
  }

  /**
   * Generate summary JSON (backward compatible)
   * @deprecated Summary is now embedded in CLAUDE.md header
   */
  generateSummary(projectInfo: ProjectInfo): string {
    const summary = {
      schemaVersion: '1.0',
      generatedAt: new Date().toISOString(),
      project: {
        name: projectInfo.name,
        type: projectInfo.projectType,
        language: projectInfo.primaryLanguage,
        version: projectInfo.version,
        techStack: projectInfo.techStack.slice(0, 8),
        entryPoint: projectInfo.entryPoint,
        packageManager: projectInfo.packageManager,
      },
      directories: this.extractTopDirectories(projectInfo.directories, 5),
      commands: this.extractEssentialCommands(projectInfo.scripts),
      gotchas: (projectInfo.gotchas || []).slice(0, 3),
      note: 'This file is deprecated. Context is now in CLAUDE.md at project root.',
    };

    return JSON.stringify(summary, null, 2);
  }

  /**
   * Extract top N directories
   */
  private extractTopDirectories(
    directories: ProjectInfo['directories'],
    limit: number
  ): Record<string, string> {
    const priorityKeys = ['source', 'tests', 'config', 'docs', 'tools'];
    const result: Record<string, string> = {};
    let count = 0;

    for (const key of priorityKeys) {
      if (count >= limit) break;
      const value = directories[key as keyof typeof directories];
      if (value) {
        result[key] = value;
        count++;
      }
    }

    return result;
  }

  /**
   * Extract essential commands
   */
  private extractEssentialCommands(
    scripts: ProjectInfo['scripts']
  ): Record<string, string> {
    const result: Record<string, string> = {};
    if (scripts.build) result.build = scripts.build;
    if (scripts.test) result.test = scripts.test;
    if (scripts.lint) result.lint = scripts.lint;
    if (scripts.dev) result.dev = scripts.dev;
    if (scripts.typecheck) result.typecheck = scripts.typecheck;
    return result;
  }
}
