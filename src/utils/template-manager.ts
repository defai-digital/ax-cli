/**
 * Template Manager for AX CLI
 * Manages project templates including built-in and user-created templates
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { safeValidateProjectTemplate, type ProjectTemplate } from '../schemas/index.js';
import type { TemplateListItem, TemplateCreateOptions } from '../types/template.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TemplateManager {
  private static readonly BUILTIN_TEMPLATES_DIR = path.join(__dirname, '../../templates');
  private static readonly USER_TEMPLATES_DIR = path.join(os.homedir(), '.ax-cli', 'templates');

  /**
   * Ensure user templates directory exists
   */
  private static ensureUserTemplatesDir(): void {
    if (!fs.existsSync(this.USER_TEMPLATES_DIR)) {
      fs.mkdirSync(this.USER_TEMPLATES_DIR, { recursive: true });
    }
  }

  /**
   * List all available templates (built-in + user)
   */
  static listTemplates(): TemplateListItem[] {
    const templates: TemplateListItem[] = [];

    // Load built-in templates
    if (fs.existsSync(this.BUILTIN_TEMPLATES_DIR)) {
      const builtinFiles = fs.readdirSync(this.BUILTIN_TEMPLATES_DIR)
        .filter(f => f.endsWith('.json'));

      for (const file of builtinFiles) {
        try {
          const templatePath = path.join(this.BUILTIN_TEMPLATES_DIR, file);
          const template = this.loadTemplate(templatePath);
          if (template) {
            templates.push({
              id: template.id,
              name: template.name,
              description: template.description,
              projectType: template.projectType,
              tags: template.tags,
              isBuiltIn: true,
            });
          }
        } catch (error) {
          // Skip invalid templates
          console.warn(`Failed to load built-in template ${file}:`, error);
        }
      }
    }

    // Load user templates
    this.ensureUserTemplatesDir();
    const userFiles = fs.readdirSync(this.USER_TEMPLATES_DIR)
      .filter(f => f.endsWith('.json'));

    for (const file of userFiles) {
      try {
        const templatePath = path.join(this.USER_TEMPLATES_DIR, file);
        const template = this.loadTemplate(templatePath);
        if (template) {
          templates.push({
            id: template.id,
            name: template.name,
            description: template.description,
            projectType: template.projectType,
            tags: template.tags,
            isBuiltIn: false,
          });
        }
      } catch (error) {
        // Skip invalid templates
        console.warn(`Failed to load user template ${file}:`, error);
      }
    }

    return templates;
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
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const result = safeValidateProjectTemplate(data);

      if (result.success && result.data) {
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
      // Only save user templates (not built-in)
      if (template.isBuiltIn) {
        console.error('Cannot modify built-in templates');
        return false;
      }

      this.ensureUserTemplatesDir();
      const templatePath = path.join(this.USER_TEMPLATES_DIR, `${template.id}.json`);

      // Validate template before saving
      const result = safeValidateProjectTemplate(template);
      if (!result.success) {
        console.error('Invalid template data:', result.error);
        return false;
      }

      fs.writeFileSync(templatePath, JSON.stringify(template, null, 2), 'utf-8');
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
    let baseId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    let id = baseId;
    let counter = 1;

    // Check for collisions and append counter if needed
    while (this.getTemplate(id)) {
      id = `${baseId}-${counter++}`;
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
    const customMdPath = path.join(projectRoot, '.ax-cli', 'CUSTOM.md');
    const indexPath = path.join(projectRoot, '.ax-cli', 'index.json');

    // Load existing instructions if available
    let instructions = '';
    if (fs.existsSync(customMdPath)) {
      instructions = fs.readFileSync(customMdPath, 'utf-8');
    }

    // Load existing metadata if available
    let metadata = {};
    if (fs.existsSync(indexPath)) {
      try {
        const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        metadata = {
          conventions: indexData.conventions,
          scripts: indexData.scripts,
          directories: indexData.directories,
          keyFiles: indexData.keyFiles,
        };
      } catch (error) {
        // Use empty metadata if index.json is invalid
      }
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
   * Export a template to a file
   */
  static exportTemplate(templateId: string, outputPath: string): boolean {
    try {
      const template = this.getTemplate(templateId);

      if (!template) {
        console.error(`Template '${templateId}' not found`);
        return false;
      }

      fs.writeFileSync(outputPath, JSON.stringify(template, null, 2), 'utf-8');
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

      // Check if path is absolute and within allowed directories
      if (!path.isAbsolute(resolvedPath)) {
        console.error('Invalid file path - must be absolute');
        return false;
      }

      // Ensure file exists and is readable
      if (!fs.existsSync(resolvedPath)) {
        console.error(`File not found: ${resolvedPath}`);
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
      const axCliDir = path.join(projectRoot, '.ax-cli');

      if (!fs.existsSync(axCliDir)) {
        fs.mkdirSync(axCliDir, { recursive: true });
      }

      // Write CUSTOM.md
      const customMdPath = path.join(axCliDir, 'CUSTOM.md');
      fs.writeFileSync(customMdPath, template.instructions, 'utf-8');

      // Write index.json with template metadata
      const indexPath = path.join(axCliDir, 'index.json');
      const indexData = {
        projectName: template.name,
        version: template.version,
        projectType: template.projectType,
        ...template.metadata,
        templateId: template.id,
        templateAppliedAt: new Date().toISOString(),
      };
      fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2), 'utf-8');

      return true;
    } catch (error) {
      console.error('Failed to apply template:', error);
      return false;
    }
  }
}
