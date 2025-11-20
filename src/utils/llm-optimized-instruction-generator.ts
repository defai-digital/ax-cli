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

    return sections.join('\n\n---\n\n');
  }

  private generateHeader(projectInfo: ProjectInfo): string {
    // Compressed header - remove "Custom Instructions for AX CLI"
    const version = projectInfo.version ? ` v${projectInfo.version}` : '';
    const stack = projectInfo.techStack.length > 0
      ? `\n**Stack:** ${projectInfo.techStack.join(', ')}`
      : '';

    return `# ${projectInfo.name} - Quick Reference

**Type:** ${projectInfo.projectType} | **Lang:** ${projectInfo.primaryLanguage}${version ? ` | **Ver:** ${version}` : ''}${stack}`;
  }

  private generateCriticalRules(projectInfo: ProjectInfo): string {
    const rules: string[] = [];

    // Rule 1: ESM imports (if applicable)
    if (projectInfo.conventions.importExtension === '.js') {
      rules.push('**ESM Imports:** Always use `.js` extension: `import { x } from \'./y.js\'`');
    }

    // Rule 2: Validation (if applicable)
    if (projectInfo.conventions.validation) {
      rules.push(`**Validation:** Use ${projectInfo.conventions.validation} for all external inputs`);
    }

    // Rule 3: TypeScript types (if applicable)
    if (projectInfo.primaryLanguage === 'TypeScript') {
      rules.push('**Types:** Explicit return types required on all functions');
    }

    // Rule 4: Testing coverage
    if (projectInfo.scripts.test) {
      rules.push('**Testing:** 80%+ coverage, test error paths');
    }

    // Rule 5: Module system
    if (projectInfo.conventions.moduleSystem === 'esm') {
      rules.push('**Modules:** Use `import/export` (not `require/module.exports`)');
    }

    // Rule 6: File Organization
    rules.push('**File Organization:** Follow standardized output paths (see below)');

    // Take only top N rules (increased to accommodate file organization)
    const topRules = rules.slice(0, Math.max(this.config.criticalRulesCount, 6));

    if (topRules.length === 0) {
      return '';
    }

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
    let content = '## 🔧 Code Patterns';

    // TypeScript patterns with DO/DON'T
    if (projectInfo.primaryLanguage === 'TypeScript' && this.config.includeDODONT) {
      content += '\n\n### TypeScript\n';
      content += '\n✅ **DO:**\n';
      content += '```typescript\n';
      content += '// Explicit types\n';
      content += 'function process(x: string): Promise<Result> { }\n';

      if (projectInfo.conventions.importExtension === '.js') {
        content += '\n// ESM imports with .js extension\n';
        content += 'import { foo } from \'./bar.js\';\n';
      }

      content += '```\n';

      content += '\n❌ **DON\'T:**\n';
      content += '```typescript\n';
      content += '// No any types\n';
      content += 'function process(x: any) { }  // ❌\n';

      if (projectInfo.conventions.importExtension === '.js') {
        content += '\n// Missing .js extension\n';
        content += 'import { foo } from \'./bar\';  // ❌\n';
      }

      content += '```';
    }

    // Validation patterns (if applicable)
    if (projectInfo.conventions.validation && this.config.includeDODONT) {
      content += `\n\n### Validation (${projectInfo.conventions.validation})\n`;
      content += '\n✅ **DO:**\n';
      content += '```typescript\n';
      content += `const result = schema.safeParse(data);\n`;
      content += 'if (!result.success) {\n';
      content += '  return { success: false, error: result.error };\n';
      content += '}\n';
      content += '```';
    }

    // Project-specific patterns based on type
    if (projectInfo.projectType === 'cli') {
      content += '\n\n### CLI Commands\n';
      content += 'Commands should:\n';
      content += '- Accept options via flags (`-f, --flag <value>`)\n';
      content += '- Validate input before execution\n';
      content += '- Provide clear error messages\n';
      content += '- Return exit codes (0 = success, 1+ = error)';
    } else if (projectInfo.projectType === 'api') {
      content += '\n\n### API Endpoints\n';
      content += 'Endpoints should:\n';
      content += '- Validate request body/params\n';
      content += '- Use proper HTTP status codes\n';
      content += '- Handle errors with consistent format\n';
      content += '- Document with OpenAPI/Swagger';
    } else if (projectInfo.projectType === 'library') {
      content += '\n\n### Library API\n';
      content += 'Public API should:\n';
      content += '- Have clear, typed interfaces\n';
      content += '- Validate all inputs\n';
      content += '- Avoid breaking changes\n';
      content += '- Document all exports';
    }

    return content;
  }

  private generateWorkflow(projectInfo: ProjectInfo): string {
    let workflow = '## 🔄 Workflow';

    // Before (compressed, tool-agnostic)
    workflow += '\n\n**Before:**\n';
    workflow += '- Read files to understand implementation\n';
    workflow += '- Search for related patterns\n';
    workflow += '- Review tests for expected behavior';

    // Changes (compressed)
    workflow += '\n\n**Changes:**\n';
    workflow += '- Edit existing files (never recreate)\n';
    workflow += '- Keep changes focused and atomic\n';
    workflow += '- Preserve code style\n';
    workflow += '- Update tests when changing functionality';

    // After (compressed with actual commands)
    const afterSteps: string[] = [];
    if (projectInfo.scripts.lint) {
      afterSteps.push(`Lint: \`${projectInfo.scripts.lint}\``);
    }
    if (projectInfo.scripts.test) {
      afterSteps.push(`Test: \`${projectInfo.scripts.test}\``);
    }
    if (projectInfo.scripts.build) {
      afterSteps.push(`Build: \`${projectInfo.scripts.build}\``);
    }

    if (afterSteps.length > 0) {
      workflow += '\n\n**After:**\n';
      workflow += afterSteps.map((step, i) => `${i + 1}. ${step}`).join('\n');
    }

    // Quick commands (compressed)
    if (projectInfo.packageManager && Object.keys(projectInfo.scripts).length > 0) {
      workflow += '\n\n**Quick Commands:**\n```bash\n';
      const pm = projectInfo.packageManager;
      const run = pm === 'npm' ? 'npm run' : pm;
      const test = pm === 'npm' ? 'npm' : pm;

      if (projectInfo.scripts.dev) {
        workflow += `${run} dev     # Development\n`;
      }
      if (projectInfo.scripts.test) {
        workflow += `${test} test    # Run tests\n`;
      }
      if (projectInfo.scripts.build) {
        workflow += `${run} build   # Production build\n`;
      }
      workflow += '```';
    }

    return workflow;
  }

  private generateTroubleshooting(projectInfo: ProjectInfo): string {
    let content = '## 🐛 Troubleshooting';

    const issues: Array<{problem: string; solution: string; code?: string}> = [];

    // ESM import issues
    if (projectInfo.conventions.importExtension === '.js') {
      issues.push({
        problem: '"Module not found" errors',
        solution: 'Add `.js` extension to imports (ESM requirement)',
        code: `// ✅ Correct\nimport { x } from './y.js';\n\n// ❌ Wrong\nimport { x } from './y';  // Missing .js`,
      });
    }

    // Validation errors
    if (projectInfo.conventions.validation) {
      issues.push({
        problem: `${projectInfo.conventions.validation} validation errors`,
        solution: 'Use `.safeParse()` for detailed error messages. Check schema matches data structure.',
      });
    }

    // Test failures
    if (projectInfo.conventions.testFramework) {
      issues.push({
        problem: 'Tests fail locally but pass in CI',
        solution: `Check Node version, clear node_modules, check environment-specific code`,
      });
    }

    // TypeScript errors
    if (projectInfo.primaryLanguage === 'TypeScript') {
      issues.push({
        problem: 'TypeScript compilation errors',
        solution: 'Check `tsconfig.json` settings, ensure all types are imported, verify `moduleResolution`',
      });
    }

    if (issues.length === 0) {
      return '';
    }

    for (const issue of issues) {
      content += `\n\n### ${issue.problem}\n`;
      content += `**Solution:** ${issue.solution}`;
      if (issue.code) {
        content += `\n\`\`\`typescript\n${issue.code}\n\`\`\``;
      }
    }

    return content;
  }

  /**
   * Generate project index JSON
   */
  generateIndex(projectInfo: ProjectInfo): string {
    const index = {
      projectName: projectInfo.name,
      version: projectInfo.version,
      primaryLanguage: projectInfo.primaryLanguage,
      techStack: projectInfo.techStack,
      projectType: projectInfo.projectType,
      entryPoint: projectInfo.entryPoint,
      directories: projectInfo.directories,
      keyFiles: Object.keys(projectInfo.keyFiles),
      conventions: {
        moduleSystem: projectInfo.conventions.moduleSystem,
        importExtension: projectInfo.conventions.importExtension,
        testFramework: projectInfo.conventions.testFramework,
        validation: projectInfo.conventions.validation,
      },
      scripts: projectInfo.scripts,
      packageManager: projectInfo.packageManager,
      lastAnalyzed: projectInfo.lastAnalyzed,
    };

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
