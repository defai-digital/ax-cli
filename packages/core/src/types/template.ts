/**
 * Template system types for AX CLI
 */

export interface ProjectTemplate {
  /** Template identifier (unique name) */
  id: string;

  /** Display name */
  name: string;

  /** Template description */
  description: string;

  /** Template version */
  version: string;

  /** Project type this template is for */
  projectType: string;

  /** Technology stack tags */
  tags: string[];

  /** Custom instructions content */
  instructions: string;

  /** Project metadata template */
  metadata: {
    conventions?: Record<string, string>;
    scripts?: Record<string, string>;
    directories?: Record<string, string>;
    keyFiles?: string[];
  };

  /** Creation timestamp */
  createdAt: string;

  /** Whether this is a built-in template */
  isBuiltIn: boolean;

  /** Optional author information */
  author?: string;
}

export interface TemplateListItem {
  id: string;
  name: string;
  description: string;
  projectType: string;
  tags: string[];
  isBuiltIn: boolean;
}

export type TemplateSource = 'builtin' | 'user' | 'custom';

export interface TemplateCreateOptions {
  name: string;
  description: string;
  projectType: string;
  tags?: string[];
  baseTemplate?: string;
  author?: string;
}

export interface TemplateExportOptions {
  outputPath: string;
  includeMetadata?: boolean;
}
