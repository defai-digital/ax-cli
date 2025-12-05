/**
 * Validation utilities for init command
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ProjectInfo } from '../types/project-analysis.js';
import { parseJson, parseJsonFile } from './json-utils.js';

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  suggestions: string[];
}

export interface ValidationChecks {
  hasPackageJson?: boolean;
  hasGitRepo?: boolean;
  hasExistingConfig?: boolean;
  hasValidStructure?: boolean;
  hasMinimumFiles?: boolean;
}

export class InitValidator {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /** Helper to resolve path relative to project root */
  private resolvePath(...segments: string[]): string {
    return path.join(this.projectRoot, ...segments);
  }

  /** Helper to check if path exists */
  private pathExists(...segments: string[]): boolean {
    return fs.existsSync(this.resolvePath(...segments));
  }

  /**
   * Run all validation checks
   */
  validate(projectInfo?: ProjectInfo): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      warnings: [],
      errors: [],
      suggestions: [],
    };

    // Check for package.json
    this.checkPackageJson(result);

    // Check for git repository
    this.checkGitRepo(result);

    // Check for existing AX CLI config
    this.checkExistingConfig(result);

    // Check project structure
    this.checkProjectStructure(result);

    // Check if project has minimum files
    this.checkMinimumFiles(result);

    // Validate project info if provided
    if (projectInfo) {
      this.validateProjectInfo(projectInfo, result);
    }

    // Set overall validity
    result.valid = result.errors.length === 0;

    return result;
  }

  /**
   * Check for package.json
   */
  private checkPackageJson(result: ValidationResult): void {
    const packageJsonPath = this.resolvePath('package.json');

    if (!this.pathExists('package.json')) {
      result.warnings.push('No package.json found - may not be a Node.js project');
      result.suggestions.push('Run: npm init (if this is a Node.js project)');
    } else {
      try {
        const content = fs.readFileSync(packageJsonPath, 'utf-8');

        // Check for empty file
        if (!content || content.trim() === '') {
          result.errors.push('package.json is empty');
          return;
        }

        const parseResult = parseJson(content);
        if (!parseResult.success) {
          result.errors.push(`Invalid package.json - ${parseResult.error}`);
          return;
        }

        const packageJson = parseResult.data as any;

        // Check if package.json is actually an object
        if (typeof packageJson !== 'object' || packageJson === null) {
          result.errors.push('package.json is not a valid JSON object');
          return;
        }

        // Check for common issues
        if (!packageJson.name) {
          result.warnings.push('package.json missing "name" field');
        }

        if (!packageJson.version) {
          result.warnings.push('package.json missing "version" field');
        }

        // Check for type: module (ESM)
        if (packageJson.type !== 'module') {
          result.suggestions.push('Consider adding "type": "module" for ESM support');
        }
      } catch (error) {
        result.errors.push(`Invalid package.json - ${error instanceof Error ? error.message : 'File read error'}`);
      }
    }
  }

  /**
   * Check for git repository
   */
  private checkGitRepo(result: ValidationResult): void {
    if (!this.pathExists('.git')) {
      result.warnings.push('Not a git repository');
      result.suggestions.push('Run: git init (for version control)');
    }
  }

  /**
   * Check for existing AX CLI configuration
   */
  private checkExistingConfig(result: ValidationResult): void {
    if (this.pathExists('.ax-cli', 'CUSTOM.md')) {
      result.warnings.push('Existing CUSTOM.md found - will be overwritten unless --force is used');
    }

    if (this.pathExists('.ax-cli', 'index.json')) {
      const indexPath = this.resolvePath('.ax-cli', 'index.json');
      const parseResult = parseJsonFile(indexPath);
      if (parseResult.success) {
        const indexData = parseResult.data as any;
        const lastUpdated = indexData.lastAnalyzed || indexData.templateAppliedAt;

        if (lastUpdated) {
          const date = new Date(lastUpdated);
          const daysSince = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));

          if (daysSince > 30) {
            result.suggestions.push(`CUSTOM.md is ${daysSince} days old - consider refreshing`);
          }
        }
      } else {
        result.warnings.push('Existing index.json is invalid');
      }
    }
  }

  /**
   * Check project structure
   */
  private checkProjectStructure(result: ValidationResult): void {
    const commonDirs = ['src', 'lib', 'dist', 'build', 'test', 'tests', '__tests__'];
    const hasStandardDir = commonDirs.some(dir => this.pathExists(dir));

    if (!hasStandardDir) {
      result.warnings.push('No standard project directories found (src/, lib/, etc.)');
      result.suggestions.push('Project may be empty or have non-standard structure');
    }
  }

  /**
   * Check for minimum files
   */
  private checkMinimumFiles(result: ValidationResult): void {
    try {
      const files = fs.readdirSync(this.projectRoot);
      const nonHiddenFiles = files.filter(f => !f.startsWith('.'));

      if (nonHiddenFiles.length === 0) {
        result.errors.push('Project directory is empty');
        return;
      }

      if (nonHiddenFiles.length === 1 && nonHiddenFiles[0] === 'package.json') {
        result.warnings.push('Project only contains package.json - no source files found');
        result.suggestions.push('Add source files before initializing AX CLI');
      }
    } catch (error) {
      result.errors.push(`Cannot read project directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate project info
   */
  private validateProjectInfo(projectInfo: ProjectInfo, result: ValidationResult): void {
    // Check if project type was detected
    if (projectInfo.projectType === 'unknown' || projectInfo.projectType === 'application') {
      result.warnings.push('Could not determine specific project type');
      result.suggestions.push('Consider using a template: ax-cli init --template <type>');
    }

    // Check if primary language was detected
    if (projectInfo.primaryLanguage === 'Unknown') {
      result.warnings.push('Could not determine primary programming language');
    }

    // Check if tech stack was detected
    if (projectInfo.techStack.length === 0) {
      result.warnings.push('No tech stack detected');
      result.suggestions.push('Ensure package.json has dependencies listed');
    }

    // Check entry point
    if (!projectInfo.entryPoint) {
      result.warnings.push('No entry point detected');
    }
  }

  /**
   * Validate custom instructions content
   */
  static validateCustomInstructions(content: string): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      warnings: [],
      errors: [],
      suggestions: [],
    };

    // Check minimum length
    if (content.length < 100) {
      result.errors.push('CUSTOM.md is too short (< 100 characters)');
    }

    // Check for required sections
    const requiredSections = [
      '## 🎯 Critical Rules',
      '## 📋 Project Overview',
      '## 🔧 Code Patterns',
    ];

    for (const section of requiredSections) {
      if (!content.includes(section)) {
        result.warnings.push(`Missing recommended section: ${section}`);
      }
    }

    // Check token count (rough estimate)
    const estimatedTokens = Math.ceil(content.length / 4);
    if (estimatedTokens > 2000) {
      result.warnings.push(`CUSTOM.md is large (~${estimatedTokens} tokens)`);
      result.suggestions.push('Consider using template imports or reducing content');
    }

    // Check for common issues
    if (content.includes('TODO') || content.includes('FIXME')) {
      result.warnings.push('CUSTOM.md contains TODO/FIXME markers');
    }

    if (content.includes('__placeholder__') || content.includes('<insert')) {
      result.errors.push('CUSTOM.md contains placeholder text');
    }

    result.valid = result.errors.length === 0;

    return result;
  }

  /**
   * Check if force flag is needed
   */
  needsForceFlag(): boolean {
    return this.pathExists('.ax-cli', 'CUSTOM.md');
  }

  /**
   * Get validation summary string
   */
  static formatValidationResult(result: ValidationResult): string {
    const parts: string[] = [];

    if (result.errors.length > 0) {
      parts.push('❌ Errors:');
      result.errors.forEach(e => parts.push(`   - ${e}`));
    }

    if (result.warnings.length > 0) {
      parts.push('⚠️  Warnings:');
      result.warnings.forEach(w => parts.push(`   - ${w}`));
    }

    if (result.suggestions.length > 0) {
      parts.push('💡 Suggestions:');
      result.suggestions.forEach(s => parts.push(`   - ${s}`));
    }

    if (result.valid && result.warnings.length === 0 && result.suggestions.length === 0) {
      parts.push('✅ All validation checks passed');
    }

    return parts.join('\n');
  }
}
