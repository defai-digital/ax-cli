/**
 * Preview utilities for init command
 */

import * as fs from 'fs';
import * as path from 'path';
import * as prompts from '@clack/prompts';
import type { ProjectInfo } from '../types/project-analysis.js';
import { TOKEN_CONFIG } from '../constants.js';

export interface PreviewOptions {
  showDiff?: boolean;
  showFull?: boolean;
  maxLines?: number;
}

export interface FilePreview {
  path: string;
  exists: boolean;
  currentContent?: string;
  newContent: string;
  changes?: {
    added: number;
    removed: number;
    modified: boolean;
  };
}

export class InitPreviewer {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Preview what will be created/modified
   */
  async preview(
    customMdContent: string,
    indexContent: string,
    options: PreviewOptions = {}
  ): Promise<void> {
    const customMdPath = path.join(this.projectRoot, '.ax-cli', 'CUSTOM.md');
    const indexPath = path.join(this.projectRoot, '.ax-cli', 'index.json');

    prompts.intro('Preview: Init Changes');

    // Preview CUSTOM.md
    let customMdCurrentContent: string | undefined;
    const customMdExists = fs.existsSync(customMdPath);
    if (customMdExists) {
      try {
        customMdCurrentContent = fs.readFileSync(customMdPath, 'utf-8');
      } catch {
        // File was deleted between existsSync and readFileSync - treat as non-existent
        customMdCurrentContent = undefined;
      }
    }

    const customMdPreview: FilePreview = {
      path: customMdPath,
      exists: customMdExists && customMdCurrentContent !== undefined,
      currentContent: customMdCurrentContent,
      newContent: customMdContent,
    };

    if (customMdPreview.exists && customMdPreview.currentContent) {
      customMdPreview.changes = this.calculateChanges(
        customMdPreview.currentContent,
        customMdPreview.newContent
      );
    }

    // Preview index.json
    let indexCurrentContent: string | undefined;
    const indexExists = fs.existsSync(indexPath);
    if (indexExists) {
      try {
        indexCurrentContent = fs.readFileSync(indexPath, 'utf-8');
      } catch {
        // File was deleted between existsSync and readFileSync - treat as non-existent
        indexCurrentContent = undefined;
      }
    }

    const indexPreview: FilePreview = {
      path: indexPath,
      exists: indexExists && indexCurrentContent !== undefined,
      currentContent: indexCurrentContent,
      newContent: indexContent,
    };

    if (indexPreview.exists && indexPreview.currentContent) {
      indexPreview.changes = this.calculateChanges(
        indexPreview.currentContent,
        indexPreview.newContent
      );
    }

    // Display CUSTOM.md preview
    await this.displayFilePreview(customMdPreview, options);

    // Display index.json preview
    await this.displayFilePreview(indexPreview, { ...options, maxLines: 20 });

    // Summary
    const summary = this.generateSummary([customMdPreview, indexPreview]);
    await prompts.note(summary, 'Summary');

    prompts.outro('Preview complete');
  }

  /**
   * Display preview for a single file
   */
  private async displayFilePreview(
    preview: FilePreview,
    options: PreviewOptions
  ): Promise<void> {
    const status = preview.exists ? '📝 Modified' : '✨ New';
    const title = `${status}: ${path.basename(preview.path)}`;

    if (options.showDiff && preview.exists && preview.currentContent) {
      // Show diff
      const diff = this.generateDiff(preview.currentContent, preview.newContent, options.maxLines);
      await prompts.note(diff, title);
    } else if (options.showFull) {
      // Show full content
      const content = this.truncateContent(preview.newContent, options.maxLines);
      await prompts.note(content, title);
    } else {
      // Show summary
      const lines = preview.newContent.split('\n').length;
      const chars = preview.newContent.length;
      // Rough approximation: actual tokens vary by content (English ~4 chars/token, code ~3)
      const tokens = Math.ceil(chars / TOKEN_CONFIG.CHARS_PER_TOKEN_ESTIMATE);

      let summary = `Lines: ${lines}\nCharacters: ${chars}\nEstimated Tokens: ~${tokens}`;

      if (preview.changes) {
        summary += `\n\nChanges:\n`;
        summary += `  + ${preview.changes.added} lines added\n`;
        summary += `  - ${preview.changes.removed} lines removed`;
      }

      await prompts.note(summary, title);
    }
  }

  /**
   * Calculate changes between old and new content
   */
  private calculateChanges(oldContent: string, newContent: string): {
    added: number;
    removed: number;
    modified: boolean;
  } {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    // Simple line-based diff (optimized)
    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);

    // Count added lines (in new but not in old)
    const added = newLines.filter(line => !oldSet.has(line)).length;

    // Count removed lines (in old but not in new)
    const removed = oldLines.filter(line => !newSet.has(line)).length;

    return {
      added,
      removed,
      modified: added > 0 || removed > 0,
    };
  }

  /**
   * Generate diff view (simplified)
   */
  private generateDiff(oldContent: string, newContent: string, maxLines?: number): string {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    const diff: string[] = [];
    let lineCount = 0;
    let i = 0;

    // Simple line-by-line comparison
    const maxLength = Math.max(oldLines.length, newLines.length);

    for (i = 0; i < maxLength && (!maxLines || lineCount < maxLines); i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === newLine) {
        diff.push(`  ${newLine}`);
      } else if (oldLine && !newLine) {
        diff.push(`- ${oldLine}`);
        lineCount++;
      } else if (!oldLine && newLine) {
        diff.push(`+ ${newLine}`);
        lineCount++;
      } else {
        diff.push(`- ${oldLine}`);
        diff.push(`+ ${newLine}`);
        lineCount += 2;
      }
    }

    // Calculate remaining lines correctly
    if (maxLines && i < maxLength) {
      const remaining = maxLength - i;
      diff.push(`\n... (${remaining} more lines)`);
    }

    return diff.join('\n');
  }

  /**
   * Truncate content to max lines
   */
  private truncateContent(content: string, maxLines?: number): string {
    if (!maxLines) {
      return content;
    }

    const lines = content.split('\n');
    if (lines.length <= maxLines) {
      return content;
    }

    return lines.slice(0, maxLines).join('\n') + `\n\n... (${lines.length - maxLines} more lines)`;
  }

  /**
   * Generate summary of all changes
   */
  private generateSummary(previews: FilePreview[]): string {
    const newFiles = previews.filter(p => !p.exists);
    const modifiedFiles = previews.filter(p => p.exists && p.changes?.modified);
    const unchangedFiles = previews.filter(p => p.exists && !p.changes?.modified);

    const parts: string[] = [];

    if (newFiles.length > 0) {
      parts.push(`✨ ${newFiles.length} new file(s)`);
    }

    if (modifiedFiles.length > 0) {
      parts.push(`📝 ${modifiedFiles.length} modified file(s)`);
    }

    if (unchangedFiles.length > 0) {
      parts.push(`✓ ${unchangedFiles.length} unchanged file(s)`);
    }

    // Calculate total changes
    const totalAdded = previews.reduce((sum, p) => sum + (p.changes?.added || 0), 0);
    const totalRemoved = previews.reduce((sum, p) => sum + (p.changes?.removed || 0), 0);

    if (totalAdded > 0 || totalRemoved > 0) {
      parts.push('');
      parts.push(`Lines: +${totalAdded} -${totalRemoved}`);
    }

    return parts.join('\n');
  }

  /**
   * Interactive confirmation after preview
   */
  async confirmChanges(): Promise<boolean> {
    const confirmed = await prompts.confirm({
      message: 'Apply these changes?',
      initialValue: true,
    });

    if (prompts.isCancel(confirmed)) {
      return false;
    }

    return confirmed as boolean;
  }

  /**
   * Preview project analysis results
   */
  static async previewProjectInfo(projectInfo: ProjectInfo): Promise<void> {
    prompts.intro('Project Analysis');

    const info = [
      `Name: ${projectInfo.name}`,
      `Type: ${projectInfo.projectType}`,
      `Language: ${projectInfo.primaryLanguage}`,
      projectInfo.techStack.length > 0 ? `Stack: ${projectInfo.techStack.join(', ')}` : '',
      projectInfo.entryPoint ? `Entry: ${projectInfo.entryPoint}` : '',
      projectInfo.packageManager ? `Package Manager: ${projectInfo.packageManager}` : '',
    ].filter(Boolean).join('\n');

    await prompts.note(info, 'Detected');

    if (projectInfo.directories && Object.keys(projectInfo.directories).length > 0) {
      const dirs = Object.entries(projectInfo.directories)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');

      await prompts.note(dirs, 'Directories');
    }

    if (projectInfo.conventions && Object.keys(projectInfo.conventions).length > 0) {
      const conventions = Object.entries(projectInfo.conventions)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');

      await prompts.note(conventions, 'Conventions');
    }
  }
}
