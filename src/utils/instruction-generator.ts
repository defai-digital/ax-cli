/**
 * Generate custom instructions from project analysis
 */

import type { ProjectInfo } from '../types/project-analysis.js';

export class InstructionGenerator {
  /**
   * Generate comprehensive custom instructions for a project
   */
  generateInstructions(projectInfo: ProjectInfo): string {
    const sections: string[] = [];

    // Header
    sections.push(this.generateHeader(projectInfo));

    // Project Context
    sections.push(this.generateProjectContext(projectInfo));

    // Code Conventions
    sections.push(this.generateCodeConventions(projectInfo));

    // File Structure
    sections.push(this.generateFileStructure(projectInfo));

    // Development Workflow
    sections.push(this.generateDevelopmentWorkflow(projectInfo));

    // Testing
    if (projectInfo.conventions.testFramework || projectInfo.scripts.test) {
      sections.push(this.generateTestingGuidelines(projectInfo));
    }

    // Build and Scripts
    if (Object.keys(projectInfo.scripts).length > 0) {
      sections.push(this.generateScriptsSection(projectInfo));
    }

    return sections.join('\n\n');
  }

  private generateHeader(projectInfo: ProjectInfo): string {
    return `# Custom Instructions for AX CLI

**Project**: ${projectInfo.name}${projectInfo.version ? ` v${projectInfo.version}` : ''}
**Type**: ${projectInfo.projectType}
**Language**: ${projectInfo.primaryLanguage}
${projectInfo.techStack.length > 0 ? `**Stack**: ${projectInfo.techStack.join(', ')}` : ''}

Generated: ${new Date(projectInfo.lastAnalyzed).toLocaleString()}`;
  }

  private generateProjectContext(projectInfo: ProjectInfo): string {
    let context = '## Project Context\n\n';

    if (projectInfo.entryPoint) {
      context += `- **Entry Point**: \`${projectInfo.entryPoint}\`\n`;
    }

    if (projectInfo.packageManager) {
      context += `- **Package Manager**: ${projectInfo.packageManager}\n`;
    }

    if (projectInfo.conventions.moduleSystem) {
      context += `- **Module System**: ${projectInfo.conventions.moduleSystem.toUpperCase()}\n`;
    }

    // Add project type specific context
    switch (projectInfo.projectType) {
      case 'cli':
        context += '- **CLI Tool**: This is a command-line interface application\n';
        break;
      case 'library':
        context += '- **Library**: This is a reusable library/package\n';
        break;
      case 'api':
        context += '- **API**: This is a backend API service\n';
        break;
      case 'web-app':
      case 'web-app-ssr':
        context += '- **Web Application**: This is a frontend web application\n';
        break;
    }

    return context.trim();
  }

  private generateCodeConventions(projectInfo: ProjectInfo): string {
    let conventions = '## Code Conventions\n\n';

    // Language-specific conventions
    if (projectInfo.primaryLanguage === 'TypeScript') {
      conventions += '### TypeScript\n';
      conventions += '- Use explicit type annotations for function parameters and returns\n';
      conventions += '- Prefer `const` and `let` over `var`\n';
      conventions += '- Use strict mode (strict type checking enabled)\n';

      if (projectInfo.conventions.importExtension === '.js') {
        conventions += `- **CRITICAL**: Always use \`.js\` extension in import statements (ESM requirement)\n`;
        conventions += '  - Example: `import { foo } from "./bar.js"` (NOT "./bar" or "./bar.ts")\n';
      }

      conventions += '\n';
    }

    // Module system
    if (projectInfo.conventions.moduleSystem === 'esm') {
      conventions += '### ES Modules\n';
      conventions += '- Use `import/export` syntax (not `require/module.exports`)\n';
      conventions += '- Top-level await is supported\n';
      conventions += '\n';
    }

    // Validation
    if (projectInfo.conventions.validation) {
      conventions += '### Validation\n';
      conventions += `- Use **${projectInfo.conventions.validation}** for runtime validation\n`;
      conventions += '- Validate all external inputs (API requests, file reads, user input)\n';
      conventions += '- Use `.safeParse()` for error handling\n';
      conventions += '\n';
    }

    return conventions.trim();
  }

  private generateFileStructure(projectInfo: ProjectInfo): string {
    let structure = '## File Structure\n\n';

    if (projectInfo.directories.source) {
      structure += `- **Source Code**: \`${projectInfo.directories.source}/\`\n`;
    }

    if (projectInfo.directories.tests) {
      structure += `- **Tests**: \`${projectInfo.directories.tests}/\`\n`;
    }

    if (projectInfo.directories.tools) {
      structure += `- **Tools**: \`${projectInfo.directories.tools}/\`\n`;
    }

    if (projectInfo.directories.config) {
      structure += `- **Config**: \`${projectInfo.directories.config}/\`\n`;
    }

    // Add specific subdirectories based on project type
    if (projectInfo.projectType === 'cli' || projectInfo.projectType === 'api') {
      structure += '\n### Typical Structure\n';
      if (projectInfo.directories.source) {
        structure += `- Commands: \`${projectInfo.directories.source}/commands/\`\n`;
        structure += `- Utilities: \`${projectInfo.directories.source}/utils/\`\n`;
        structure += `- Types: \`${projectInfo.directories.source}/types/\`\n`;
      }
    }

    // Key files
    if (Object.keys(projectInfo.keyFiles).length > 0) {
      structure += '\n### Key Files\n';
      for (const [file, description] of Object.entries(projectInfo.keyFiles)) {
        structure += `- \`${file}\`: ${description}\n`;
      }
    }

    return structure.trim();
  }

  private generateDevelopmentWorkflow(projectInfo: ProjectInfo): string {
    let workflow = '## Development Workflow\n\n';

    workflow += '### Before Making Changes\n';
    workflow += '1. Read relevant files with `view_file` to understand current implementation\n';
    workflow += '2. Use `search` to find related code or patterns\n';
    workflow += '3. Check existing tests to understand expected behavior\n';
    workflow += '\n';

    workflow += '### Making Changes\n';
    workflow += '1. **NEVER** use `create_file` on existing files - use `str_replace_editor` instead\n';
    workflow += '2. Make focused, atomic changes\n';
    workflow += '3. Preserve existing code style and patterns\n';
    workflow += '4. Update related tests when modifying functionality\n';
    workflow += '\n';

    workflow += '### After Changes\n';
    if (projectInfo.scripts.lint) {
      workflow += `1. Run linter: \`${projectInfo.scripts.lint}\`\n`;
    }
    if (projectInfo.scripts.test) {
      workflow += `${projectInfo.scripts.lint ? '2' : '1'}. Run tests: \`${projectInfo.scripts.test}\`\n`;
    }
    if (projectInfo.scripts.build) {
      const step = projectInfo.scripts.lint && projectInfo.scripts.test ? '3' : projectInfo.scripts.lint || projectInfo.scripts.test ? '2' : '1';
      workflow += `${step}. Build: \`${projectInfo.scripts.build}\`\n`;
    }

    return workflow.trim();
  }

  private generateTestingGuidelines(projectInfo: ProjectInfo): string {
    let testing = '## Testing Guidelines\n\n';

    if (projectInfo.conventions.testFramework === 'vitest') {
      testing += '### Vitest\n';
      testing += '- Use `describe`, `it`, `expect` for test structure\n';
      testing += '- Place tests in `tests/` directory or `*.test.ts` files\n';
      testing += '- Test edge cases: empty inputs, null/undefined, boundary conditions\n';
      testing += '- Include Unicode and special character tests where relevant\n';
    } else if (projectInfo.conventions.testFramework === 'jest') {
      testing += '### Jest\n';
      testing += '- Use `describe`, `it`, `expect` for test structure\n';
      testing += '- Place tests in `__tests__/` or `*.test.ts` files\n';
      testing += '- Mock external dependencies appropriately\n';
    }

    testing += '\n### Coverage Requirements\n';
    testing += '- Aim for high test coverage (80%+ for new code)\n';
    testing += '- Always test error paths and edge cases\n';
    testing += '- Test both success and failure scenarios\n';

    return testing.trim();
  }

  private generateScriptsSection(projectInfo: ProjectInfo): string {
    let scripts = '## Available Scripts\n\n';

    if (projectInfo.scripts.dev) {
      scripts += `- **Development**: \`${projectInfo.scripts.dev}\`\n`;
    }
    if (projectInfo.scripts.build) {
      scripts += `- **Build**: \`${projectInfo.scripts.build}\`\n`;
    }
    if (projectInfo.scripts.test) {
      scripts += `- **Test**: \`${projectInfo.scripts.test}\`\n`;
    }
    if (projectInfo.scripts.lint) {
      scripts += `- **Lint**: \`${projectInfo.scripts.lint}\`\n`;
    }

    scripts += '\n### Quick Commands\n';
    scripts += '```bash\n';
    if (projectInfo.packageManager) {
      const pm = projectInfo.packageManager;
      if (projectInfo.scripts.dev) scripts += `${pm === 'npm' ? 'npm run' : pm} dev    # Start development\n`;
      if (projectInfo.scripts.test) scripts += `${pm === 'npm' ? 'npm' : pm} test   # Run tests\n`;
      if (projectInfo.scripts.build) scripts += `${pm === 'npm' ? 'npm run' : pm} build  # Build for production\n`;
    }
    scripts += '```';

    return scripts.trim();
  }

  /**
   * Generate project index JSON for fast lookups
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
}
