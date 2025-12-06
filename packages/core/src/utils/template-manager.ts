/**
 * Template Manager for AX CLI
 * Manages project templates including built-in and user-created templates
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { safeValidateProjectTemplate, type ProjectTemplate, ProjectTemplateSchema } from '../schemas/index.js';
import type { TemplateListItem, TemplateCreateOptions } from '../types/template.js';
import { parseJsonFile } from './json-utils.js';
import { CONFIG_PATHS, CONFIG_DIR_NAME, FILE_NAMES } from '../constants.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TemplateManager {
  private static readonly BUILTIN_TEMPLATES_DIR = path.join(__dirname, '../../templates');
  private static readonly USER_TEMPLATES_DIR = CONFIG_PATHS.USER_TEMPLATES_DIR;

  /**
   * Ensure user templates directory exists
   */
  private static ensureUserTemplatesDir(): void {
    if (!fs.existsSync(this.USER_TEMPLATES_DIR)) {
      fs.mkdirSync(this.USER_TEMPLATES_DIR, { recursive: true });
    }
  }

  /**
   * Atomic file write - writes to temp file then renames
   */
  private static atomicWrite(filePath: string, content: string): void {
    const tmpPath = `${filePath}.tmp`;
    try {
      fs.writeFileSync(tmpPath, content, 'utf-8');
      fs.renameSync(tmpPath, filePath);
    } catch (error) {
      // Cleanup temp file on error
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      }
      throw error;
    }
  }

  /**
   * Load templates from a directory
   */
  private static loadTemplatesFromDir(dir: string, isBuiltIn: boolean): TemplateListItem[] {
    if (!fs.existsSync(dir)) return [];

    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(file => {
        try {
          const template = this.loadTemplate(path.join(dir, file));
          if (!template) return null;
          return {
            id: template.id,
            name: template.name,
            description: template.description,
            projectType: template.projectType,
            tags: template.tags,
            isBuiltIn,
          };
        } catch (error) {
          console.warn(`Failed to load template ${file}:`, error);
          return null;
        }
      })
      .filter((t): t is TemplateListItem => t !== null);
  }

  /**
   * List all available templates (built-in + user)
   */
  static listTemplates(): TemplateListItem[] {
    this.ensureUserTemplatesDir();
    return [
      ...this.loadTemplatesFromDir(this.BUILTIN_TEMPLATES_DIR, true),
      ...this.loadTemplatesFromDir(this.USER_TEMPLATES_DIR, false),
    ];
  }

  /**
   * Get a specific template by ID
   */
  static getTemplate(templateId: string): ProjectTemplate | null {
    // Check built-in templates first
    const builtinPath = path.join(this.BUILTIN_TEMPLATES_DIR, `${templateId}.json`);
    if (fs.existsSync(builtinPath)) {
      return this.loadTemplate(builtinPath);
    }

    // Check user templates
    this.ensureUserTemplatesDir();
    const userPath = path.join(this.USER_TEMPLATES_DIR, `${templateId}.json`);
    if (fs.existsSync(userPath)) {
      return this.loadTemplate(userPath);
    }

    return null;
  }

  /**
   * Load and validate a template from file
   */
  private static loadTemplate(filePath: string): ProjectTemplate | null {
    try {
      const result = parseJsonFile<ProjectTemplate>(filePath, ProjectTemplateSchema);

      if (result.success) {
        return result.data;
      }

      console.warn(`Invalid template at ${filePath}:`, result.error);
      return null;
    } catch (error) {
      console.warn(`Failed to load template at ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Save a user template
   */
  static saveTemplate(template: ProjectTemplate): boolean {
    try {
      if (template.isBuiltIn) {
        console.error('Cannot modify built-in templates');
        return false;
      }

      const result = safeValidateProjectTemplate(template);
      if (!result.success) {
        console.error('Invalid template data:', result.error);
        return false;
      }

      this.ensureUserTemplatesDir();
      const templatePath = path.join(this.USER_TEMPLATES_DIR, `${template.id}.json`);
      this.atomicWrite(templatePath, JSON.stringify(template, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to save template:', error);
      return false;
    }
  }

  /**
   * Generate a unique template ID
   */
  private static generateUniqueId(name: string): string {
    const MAX_ATTEMPTS = 1000;
    let baseId = name.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 50); // Limit base ID length

    if (!baseId) {
      baseId = 'template'; // Fallback for empty names
    }

    let id = baseId;
    let counter = 1;

    while (this.getTemplate(id)) {
      if (counter >= MAX_ATTEMPTS) {
        // Use timestamp + random string to ensure uniqueness
        const randomSuffix = Math.random().toString(36).substring(2, 9);
        id = `${baseId}-${Date.now()}-${randomSuffix}`;
        break;
      }
      id = `${baseId}-${counter++}`;
    }

    // Final verification
    if (this.getTemplate(id)) {
      throw new Error('Failed to generate unique template ID after maximum attempts');
    }

    return id;
  }

  /**
   * Create a new template from current project
   */
  static createFromProject(
    projectRoot: string,
    options: TemplateCreateOptions
  ): ProjectTemplate {
    const customMdPath = path.join(projectRoot, CONFIG_DIR_NAME, FILE_NAMES.CUSTOM_MD);
    const indexPath = path.join(projectRoot, CONFIG_DIR_NAME, FILE_NAMES.INDEX_JSON);

    // Load existing instructions if available
    let instructions = '';
    if (fs.existsSync(customMdPath)) {
      instructions = fs.readFileSync(customMdPath, 'utf-8');
    }

    // Validate instructions are non-empty
    if (!instructions || instructions.trim().length === 0) {
      throw new Error(
        'Cannot create template: CUSTOM.md is empty. ' +
        'Run "ax-cli init" first to generate custom instructions.'
      );
    }

    // Validate minimum length
    if (instructions.trim().length < 100) {
      throw new Error(
        'Cannot create template: CUSTOM.md is too short (< 100 characters). ' +
        'Ensure the file contains meaningful instructions.'
      );
    }

    // Load existing metadata if available
    let metadata = {};
    if (fs.existsSync(indexPath)) {
      const result = parseJsonFile(indexPath);
      if (result.success) {
        const indexData = result.data as any;
        metadata = {
          conventions: indexData.conventions,
          scripts: indexData.scripts,
          directories: indexData.directories,
          keyFiles: indexData.keyFiles,
        };
      }
      // Use empty metadata if index.json is invalid
    }

    const template: ProjectTemplate = {
      id: this.generateUniqueId(options.name),
      name: options.name,
      description: options.description,
      version: '1.0.0',
      projectType: options.projectType,
      tags: options.tags || [],
      instructions,
      metadata,
      createdAt: new Date().toISOString(),
      isBuiltIn: false,
      author: options.author,
    };

    return template;
  }

  /**
   * Delete a user template
   */
  static deleteTemplate(templateId: string): boolean {
    try {
      const template = this.getTemplate(templateId);

      if (!template) {
        console.error(`Template '${templateId}' not found`);
        return false;
      }

      if (template.isBuiltIn) {
        console.error('Cannot delete built-in templates');
        return false;
      }

      const userPath = path.join(this.USER_TEMPLATES_DIR, `${templateId}.json`);
      fs.unlinkSync(userPath);
      return true;
    } catch (error) {
      console.error('Failed to delete template:', error);
      return false;
    }
  }

  /**
   * Export a template to a file (with atomic write)
   */
  static exportTemplate(templateId: string, outputPath: string): boolean {
    try {
      const template = this.getTemplate(templateId);
      if (!template) {
        console.error(`Template '${templateId}' not found`);
        return false;
      }

      this.atomicWrite(outputPath, JSON.stringify(template, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to export template:', error);
      return false;
    }
  }

  /**
   * Import a template from a file
   */
  static importTemplate(filePath: string): boolean {
    try {
      // Validate path to prevent directory traversal attacks
      const resolvedPath = path.resolve(filePath);

      // Check if path is absolute
      if (!path.isAbsolute(resolvedPath)) {
        console.error('Invalid file path - must be absolute');
        return false;
      }

      // Ensure path is within safe directories (home or cwd)
      const userHome = homedir();
      const cwd = process.cwd();
      const isInHome = resolvedPath.startsWith(userHome);
      const isInCwd = resolvedPath.startsWith(cwd);

      if (!isInHome && !isInCwd) {
        console.error('Template must be in home directory or current directory');
        return false;
      }

      // Prevent access to sensitive files
      const sensitivePatterns = [
        /\.ssh/i,
        /\.gnupg/i,
        /password/i,
        /secret/i,
        /\.env/i,
        /id_rsa/i,
        /\.pem$/i,
        /\.key$/i,
      ];

      const basename = path.basename(resolvedPath);
      if (sensitivePatterns.some(pattern => pattern.test(basename))) {
        console.error('Cannot import sensitive files');
        return false;
      }

      // Ensure file has .json extension
      if (path.extname(resolvedPath) !== '.json') {
        console.error('Template file must have .json extension');
        return false;
      }

      // Ensure file exists and is readable
      if (!fs.existsSync(resolvedPath)) {
        console.error(`File not found: ${resolvedPath}`);
        return false;
      }

      // Ensure it's a file, not a directory
      const stats = fs.statSync(resolvedPath);
      if (!stats.isFile()) {
        console.error('Path must be a file, not a directory');
        return false;
      }

      // Check file size to prevent DOS
      const MAX_TEMPLATE_SIZE = 10 * 1024 * 1024; // 10MB
      if (stats.size > MAX_TEMPLATE_SIZE) {
        console.error(`Template file too large: ${(stats.size / 1024 / 1024).toFixed(2)}MB (max: 10MB)`);
        return false;
      }

      const template = this.loadTemplate(resolvedPath);

      if (!template) {
        console.error('Invalid template file');
        return false;
      }

      // Force as user template (not built-in)
      template.isBuiltIn = false;

      return this.saveTemplate(template);
    } catch (error) {
      console.error('Failed to import template:', error);
      return false;
    }
  }

  /**
   * Apply a template to a project directory
   */
  static applyTemplate(template: ProjectTemplate, projectRoot: string): boolean {
    try {
      const axCliDir = path.join(projectRoot, CONFIG_DIR_NAME);
      if (!fs.existsSync(axCliDir)) {
        fs.mkdirSync(axCliDir, { recursive: true });
      }

      const customMdPath = path.join(axCliDir, FILE_NAMES.CUSTOM_MD);
      const indexPath = path.join(axCliDir, FILE_NAMES.INDEX_JSON);

      const indexData = {
        projectName: template.name,
        version: template.version,
        projectType: template.projectType,
        ...template.metadata,
        templateId: template.id,
        templateAppliedAt: new Date().toISOString(),
      };

      this.atomicWrite(customMdPath, template.instructions);
      this.atomicWrite(indexPath, JSON.stringify(indexData, null, 2));

      return true;
    } catch (error) {
      console.error('Failed to apply template:', error);
      return false;
    }
  }
}
