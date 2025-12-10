/**
 * LLM-Optimized Instruction Generator
 * Generates token-efficient, comprehension-optimized project instructions
 */

import type { ProjectInfo } from '../types/project-analysis.js';

interface OptimizationConfig {
  compressionLevel: 'none' | 'moderate' | 'aggressive';
  hierarchyEnabled: boolean;
  criticalRulesCount: number;
  includeDODONT: boolean;
  includeTroubleshooting: boolean;
}

export class LLMOptimizedInstructionGenerator {
  private config: OptimizationConfig;

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = {
      compressionLevel: config.compressionLevel || 'moderate',
      hierarchyEnabled: config.hierarchyEnabled ?? true,
      criticalRulesCount: config.criticalRulesCount || 5,
      includeDODONT: config.includeDODONT ?? true,
      includeTroubleshooting: config.includeTroubleshooting ?? true,
    };
  }

  /**
   * Generate LLM-optimized custom instructions
   */
  generateInstructions(projectInfo: ProjectInfo): string {
    const sections: string[] = [];

    // Header (compressed)
    sections.push(this.generateHeader(projectInfo));

    // Critical Rules (front-loaded)
    if (this.config.hierarchyEnabled) {
      sections.push(this.generateCriticalRules(projectInfo));
    }

    // File Organization (standardized output paths)
    sections.push(this.generateFileOrganization());

    // Project Overview (compressed)
    sections.push(this.generateProjectOverview(projectInfo));

    // Code Patterns with DO/DON'T
    sections.push(this.generateCodePatterns(projectInfo));

    // Development Workflow (compressed, tool-agnostic)
    sections.push(this.generateWorkflow(projectInfo));

    // Troubleshooting
    if (this.config.includeTroubleshooting) {
      sections.push(this.generateTroubleshooting(projectInfo));
    }

    // Gotchas/Tips section
    const gotchasSection = this.generateGotchas(projectInfo);
    if (gotchasSection) {
      sections.push(gotchasSection);
    }

    return sections.join('\n\n---\n\n');
  }

  private generateGotchas(projectInfo: ProjectInfo): string | null {
    const { gotchas } = projectInfo;
    if (!gotchas || gotchas.length === 0) return null;

    const lines = ['## 💡 Development Tips'];
    for (const tip of gotchas) {
      lines.push(`- ${tip}`);
    }
    return lines.join('\n');
  }

  private generateHeader(projectInfo: ProjectInfo): string {
    // Compressed header with description
    const version = projectInfo.version ? ` v${projectInfo.version}` : '';
    const stack = projectInfo.techStack.length > 0
      ? `\n**Stack:** ${projectInfo.techStack.join(', ')}`
      : '';
    const description = projectInfo.description
      ? `\n\n${projectInfo.description}`
      : '';
    const cicd = projectInfo.cicdPlatform
      ? ` | **CI:** ${projectInfo.cicdPlatform}`
      : '';

    return `# ${projectInfo.name} - Quick Reference

**Type:** ${projectInfo.projectType} | **Lang:** ${projectInfo.primaryLanguage}${version ? ` | **Ver:** ${version}` : ''}${cicd}${stack}${description}`;
  }

  private generateCriticalRules(projectInfo: ProjectInfo): string {
    const { conventions, primaryLanguage, scripts } = projectInfo;
    const rules: string[] = [];

    // Build rules based on project configuration
    if (conventions.importExtension === '.js') {
      rules.push('**ESM Imports:** Always use `.js` extension: `import { x } from \'./y.js\'`');
    }
    if (conventions.validation) {
      rules.push(`**Validation:** Use ${conventions.validation} for all external inputs`);
    }
    if (primaryLanguage === 'TypeScript') {
      rules.push('**Types:** Explicit return types required on all functions');
    }
    if (scripts.test) {
      rules.push('**Testing:** 80%+ coverage, test error paths');
    }
    if (conventions.moduleSystem === 'esm') {
      rules.push('**Modules:** Use `import/export` (not `require/module.exports`)');
    }
    rules.push('**File Organization:** Follow standardized output paths (see below)');

    const topRules = rules.slice(0, Math.max(this.config.criticalRulesCount, 6));
    if (topRules.length === 0) return '';

    return `## 🎯 Critical Rules\n\n${topRules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}`;
  }

  private generateProjectOverview(projectInfo: ProjectInfo): string {
    const parts: string[] = [`## 📋 Project Overview`];

    // Tech details (compressed)
    const details: string[] = [];
    if (projectInfo.entryPoint) {
      details.push(`**Entry:** \`${projectInfo.entryPoint}\``);
    }
    if (projectInfo.packageManager) {
      details.push(`**PM:** ${projectInfo.packageManager}`);
    }
    if (projectInfo.conventions.moduleSystem) {
      details.push(`**Module:** ${projectInfo.conventions.moduleSystem.toUpperCase()}`);
    }

    if (details.length > 0) {
      parts.push(details.join(' | '));
    }

    // Directories (compressed)
    const dirs: string[] = [];
    if (projectInfo.directories.source) {
      dirs.push(`- \`${projectInfo.directories.source}/\` - Source code`);
    }
    if (projectInfo.directories.tests) {
      dirs.push(`- \`${projectInfo.directories.tests}/\` - Tests`);
    }
    if (projectInfo.directories.tools) {
      dirs.push(`- \`${projectInfo.directories.tools}/\` - Tools`);
    }

    // Add typical subdirectories for CLI/API
    if (projectInfo.projectType === 'cli' || projectInfo.projectType === 'api') {
      if (projectInfo.directories.source) {
        dirs.push(`- \`${projectInfo.directories.source}/commands/\` - Commands`);
        dirs.push(`- \`${projectInfo.directories.source}/utils/\` - Utilities`);
      }
    }

    if (dirs.length > 0) {
      parts.push('\n**Directories:**\n' + dirs.join('\n'));
    }

    return parts.join('\n\n');
  }

  private generateCodePatterns(projectInfo: ProjectInfo): string {
    const { primaryLanguage, conventions, projectType } = projectInfo;
    const sections: string[] = ['## 🔧 Code Patterns'];

    // TypeScript patterns with DO/DON'T
    if (primaryLanguage === 'TypeScript' && this.config.includeDODONT) {
      const doCode = [
        '// Explicit types',
        'function process(x: string): Promise<Result> { }',
        ...(conventions.importExtension === '.js' ? ['\n// ESM imports with .js extension', "import { foo } from './bar.js';"] : []),
      ];
      const dontCode = [
        '// No any types',
        'function process(x: any) { }  // ❌',
        ...(conventions.importExtension === '.js' ? ['\n// Missing .js extension', "import { foo } from './bar';  // ❌"] : []),
      ];
      sections.push(
        '### TypeScript\n',
        '✅ **DO:**',
        '```typescript',
        doCode.join('\n'),
        '```\n',
        '❌ **DON\'T:**',
        '```typescript',
        dontCode.join('\n'),
        '```'
      );
    }

    // Validation patterns
    if (conventions.validation && this.config.includeDODONT) {
      sections.push(
        `### Validation (${conventions.validation})\n`,
        '✅ **DO:**',
        '```typescript',
        'const result = schema.safeParse(data);',
        'if (!result.success) {',
        '  return { success: false, error: result.error };',
        '}',
        '```'
      );
    }

    // Project-specific patterns
    const typePatterns: Record<string, { title: string; items: string[] }> = {
      cli: {
        title: '### CLI Commands\nCommands should:',
        items: ['Accept options via flags (`-f, --flag <value>`)', 'Validate input before execution', 'Provide clear error messages', 'Return exit codes (0 = success, 1+ = error)'],
      },
      api: {
        title: '### API Endpoints\nEndpoints should:',
        items: ['Validate request body/params', 'Use proper HTTP status codes', 'Handle errors with consistent format', 'Document with OpenAPI/Swagger'],
      },
      library: {
        title: '### Library API\nPublic API should:',
        items: ['Have clear, typed interfaces', 'Validate all inputs', 'Avoid breaking changes', 'Document all exports'],
      },
    };

    const pattern = typePatterns[projectType];
    if (pattern) {
      sections.push(`${pattern.title}\n${pattern.items.map(i => `- ${i}`).join('\n')}`);
    }

    return sections.join('\n');
  }

  private generateWorkflow(projectInfo: ProjectInfo): string {
    const { scripts, packageManager } = projectInfo;
    const sections: string[] = [
      '## 🔄 Workflow',
      '**Before:**',
      '- Read files to understand implementation',
      '- Search for related patterns',
      '- Review tests for expected behavior',
      '',
      '**Changes:**',
      '- Edit existing files (never recreate)',
      '- Keep changes focused and atomic',
      '- Preserve code style',
      '- Update tests when changing functionality',
    ];

    // After steps
    const afterSteps = [
      scripts.lint && `Lint: \`${scripts.lint}\``,
      scripts.test && `Test: \`${scripts.test}\``,
      scripts.build && `Build: \`${scripts.build}\``,
    ].filter(Boolean) as string[];

    if (afterSteps.length > 0) {
      sections.push('', '**After:**', ...afterSteps.map((step, i) => `${i + 1}. ${step}`));
    }

    // Quick commands
    if (packageManager && Object.keys(scripts).length > 0) {
      const run = packageManager === 'npm' ? 'npm run' : packageManager;
      const test = packageManager === 'npm' ? 'npm' : packageManager;
      const cmds = [
        scripts.dev && `${run} dev     # Development`,
        scripts.test && `${test} test    # Run tests`,
        scripts.build && `${run} build   # Production build`,
      ].filter((cmd): cmd is string => Boolean(cmd));

      if (cmds.length > 0) {
        sections.push('', '**Quick Commands:**', '```bash', ...cmds, '```');
      }
    }

    return sections.join('\n');
  }

  private generateTroubleshooting(projectInfo: ProjectInfo): string {
    const { conventions, primaryLanguage } = projectInfo;
    type Issue = { problem: string; solution: string; code?: string };
    const issues: Issue[] = [];

    // Conditionally add issues based on project config
    if (conventions.importExtension === '.js') {
      issues.push({
        problem: '"Module not found" errors',
        solution: 'Add `.js` extension to imports (ESM requirement)',
        code: "// ✅ Correct\nimport { x } from './y.js';\n\n// ❌ Wrong\nimport { x } from './y';  // Missing .js",
      });
    }
    if (conventions.validation) {
      issues.push({
        problem: `${conventions.validation} validation errors`,
        solution: 'Use `.safeParse()` for detailed error messages. Check schema matches data structure.',
      });
    }
    if (conventions.testFramework) {
      issues.push({
        problem: 'Tests fail locally but pass in CI',
        solution: 'Check Node version, clear node_modules, check environment-specific code',
      });
    }
    if (primaryLanguage === 'TypeScript') {
      issues.push({
        problem: 'TypeScript compilation errors',
        solution: 'Check `tsconfig.json` settings, ensure all types are imported, verify `moduleResolution`',
      });
    }

    if (issues.length === 0) return '';

    const sections = ['## 🐛 Troubleshooting'];
    for (const { problem, solution, code } of issues) {
      sections.push(`### ${problem}`, `**Solution:** ${solution}`);
      if (code) sections.push(`\`\`\`typescript\n${code}\n\`\`\``);
    }
    return sections.join('\n\n');
  }

  /**
   * Generate project index JSON (v2.0 schema with deep analysis)
   */
  generateIndex(projectInfo: ProjectInfo): string {
    // Build the index with all available tiers of analysis
    const index: Record<string, unknown> = {
      // Schema version for compatibility
      schemaVersion: '2.0',

      // Tier 1: Basic project info
      name: projectInfo.name,
      version: projectInfo.version,
      description: projectInfo.description,
      primaryLanguage: projectInfo.primaryLanguage,
      techStack: projectInfo.techStack,
      projectType: projectInfo.projectType,
      entryPoint: projectInfo.entryPoint,
      directories: projectInfo.directories,
      keyFiles: projectInfo.keyFiles, // Now includes descriptions
      conventions: projectInfo.conventions,
      scripts: projectInfo.scripts,
      packageManager: projectInfo.packageManager,
      cicdPlatform: projectInfo.cicdPlatform,
      gotchas: projectInfo.gotchas,
      runtimeTargets: projectInfo.runtimeTargets,
      lastAnalyzed: projectInfo.lastAnalyzed,
    };

    // Tier 2: Quality metrics (if available)
    if (projectInfo.codeStats) {
      index.codeStats = projectInfo.codeStats;
    }
    if (projectInfo.testing) {
      index.testing = projectInfo.testing;
    }
    if (projectInfo.documentation) {
      index.documentation = projectInfo.documentation;
    }
    if (projectInfo.technicalDebt) {
      index.technicalDebt = projectInfo.technicalDebt;
    }

    // Tier 3: Architecture analysis (if available)
    if (projectInfo.architecture) {
      index.architecture = projectInfo.architecture;
    }

    // Tier 4: Security analysis (if available)
    if (projectInfo.security) {
      index.security = projectInfo.security;
    }

    return JSON.stringify(index, null, 2);
  }

  /**
   * Generate file organization section
   */
  private generateFileOrganization(): string {
    return `## 📁 Project File Organization

### Standard Output Paths

All AI-generated and project artifacts must follow this structure:

\`\`\`
automatosx/
├── PRD/              # Product Requirement Documents
│   ├── features/     # Feature specifications
│   ├── api/          # API documentation
│   └── archive/      # Old/deprecated PRDs
├── REPORT/           # Project reports and analysis
│   ├── status/       # Status reports
│   ├── plans/        # Implementation plans
│   ├── analysis/     # Code analysis reports
│   └── metrics/      # Performance and quality metrics
└── tmp/              # Temporary files and drafts
    ├── logs/         # Debug and execution logs
    ├── cache/        # Cached data
    └── scratch/      # Temporary work files
\`\`\`

### Path Usage Guidelines

**PRD (Product Requirement Documents):**
- **Path:** \`./automatosx/PRD/\`
- **Purpose:** Feature specs, requirements, architecture decisions
- **Naming:** \`YYYY-MM-DD-feature-name.md\` or \`feature-name-v1.md\`
- **Example:**
  \`\`\`bash
  automatosx/PRD/features/2025-11-20-mcp-integration.md
  automatosx/PRD/api/rest-api-spec.md
  \`\`\`

**REPORT (Plans & Status):**
- **Path:** \`./automatosx/REPORT/\`
- **Purpose:** Implementation plans, status reports, analysis
- **Naming:** \`YYYY-MM-DD-report-type.md\`
- **Example:**
  \`\`\`bash
  automatosx/REPORT/status/2025-11-20-weekly-status.md
  automatosx/REPORT/plans/authentication-implementation-plan.md
  automatosx/REPORT/analysis/code-quality-report.md
  \`\`\`

**tmp (Temporary Files):**
- **Path:** \`./automatosx/tmp/\`
- **Purpose:** Logs, cache, scratch work, debug output
- **Auto-cleanup:** Files older than 7 days can be deleted
- **Example:**
  \`\`\`bash
  automatosx/tmp/logs/ai-session-2025-11-20.log
  automatosx/tmp/cache/api-response-cache.json
  automatosx/tmp/scratch/debugging-notes.md
  \`\`\`

### File Naming Conventions

1. **Use kebab-case:** \`feature-name.md\` (not \`Feature_Name.md\`)
2. **Include dates:** \`YYYY-MM-DD-\` prefix for time-sensitive docs
3. **Be descriptive:** \`user-auth-flow.md\` (not \`flow.md\`)
4. **Version when needed:** \`api-spec-v2.md\`

### .gitignore Rules

\`\`\`gitignore
# Temporary files (not tracked)
automatosx/tmp/

# Keep structure but ignore content
automatosx/PRD/.gitkeep
automatosx/REPORT/.gitkeep

# Track important PRDs and reports
!automatosx/PRD/**/*.md
!automatosx/REPORT/**/*.md
\`\`\``;
  }

}
