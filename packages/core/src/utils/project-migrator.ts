/**
 * Project-Level Migration Service
 *
 * Handles migration from legacy .ax-cli/ project directories to
 * provider-specific directories (.ax-glm/, .ax-grok/).
 *
 * Key principles:
 * - Interactive migration (user confirms)
 * - Copies all project files (CUSTOM.md, index.json, memory.json, settings.json)
 * - Option to keep legacy directory as backup
 * - Full isolation between providers
 *
 * @module project-migrator
 */

import {
  existsSync,
  readdirSync,
  copyFileSync,
  mkdirSync,
  renameSync,
  statSync,
  readFileSync,
} from 'fs';
import { join, basename } from 'path';
import * as prompts from '@clack/prompts';
import chalk from 'chalk';
import type { ProviderDefinition } from '../provider/config.js';

// Legacy project config directory name
const LEGACY_PROJECT_DIR = '.ax-cli';

/**
 * Files to migrate from legacy project config
 */
const PROJECT_FILES = [
  'CUSTOM.md',
  'index.json',
  'memory.json',
  'settings.json',
] as const;

/**
 * Human-readable descriptions for project files
 */
const FILE_DESCRIPTIONS: Record<string, string> = {
  'CUSTOM.md': 'Custom AI instructions',
  'index.json': 'Project metadata and analysis',
  'memory.json': 'Cached project context',
  'settings.json': 'Project-specific settings',
};

/**
 * Information about a file to migrate
 */
export interface FileInfo {
  /** File name */
  name: string;
  /** Human-readable description */
  description: string;
  /** File size in bytes */
  size: number;
  /** Whether file exists */
  exists: boolean;
}

/**
 * Summary of what will be migrated
 */
export interface ProjectMigrationSummary {
  /** Legacy directory path */
  legacyDir: string;
  /** Target directory path */
  targetDir: string;
  /** Files that can be migrated */
  filesToMigrate: FileInfo[];
  /** Whether target directory already exists */
  targetExists: boolean;
  /** Total size of files to migrate */
  totalSize: number;
}

/**
 * Result of project migration
 */
export interface ProjectMigrationResult {
  /** Whether migration succeeded */
  success: boolean;
  /** Files that were migrated */
  filesMigrated: string[];
  /** Files that were skipped (already exist in target) */
  filesSkipped: string[];
  /** Any errors encountered */
  errors: string[];
  /** Whether legacy directory was backed up */
  legacyBackedUp: boolean;
}

/**
 * User's choice from migration prompt
 */
export type ProjectMigrationChoice = 'migrate' | 'fresh' | 'keep-both';

/**
 * Options for migration
 */
export interface ProjectMigrationOptions {
  /** Project root directory (defaults to cwd) */
  projectRoot?: string;
  /** Keep legacy directory after migration (don't rename to .backup) */
  keepLegacy?: boolean;
  /** Overwrite existing files in target */
  overwrite?: boolean;
}

/**
 * Project Migration Service
 *
 * Handles detection and migration of legacy .ax-cli/ project
 * configurations to provider-specific directories.
 */
export class ProjectMigrator {
  /**
   * Check if legacy project config exists
   */
  static hasLegacyProjectConfig(projectRoot: string = process.cwd()): boolean {
    const legacyDir = join(projectRoot, LEGACY_PROJECT_DIR);
    return existsSync(legacyDir);
  }

  /**
   * Get legacy project directory path
   */
  static getLegacyDir(projectRoot: string = process.cwd()): string {
    return join(projectRoot, LEGACY_PROJECT_DIR);
  }

  /**
   * Get target provider directory name
   */
  static getTargetDirName(provider: ProviderDefinition): string {
    return provider.configDirName; // e.g., '.ax-glm' or '.ax-grok'
  }

  /**
   * Get target provider directory path
   */
  static getTargetDir(
    provider: ProviderDefinition,
    projectRoot: string = process.cwd()
  ): string {
    return join(projectRoot, this.getTargetDirName(provider));
  }

  /**
   * Check if target project config already exists
   */
  static hasTargetProjectConfig(
    provider: ProviderDefinition,
    projectRoot: string = process.cwd()
  ): boolean {
    const targetDir = this.getTargetDir(provider, projectRoot);
    return existsSync(targetDir);
  }

  /**
   * Get information about files that can be migrated
   */
  static getFilesToMigrate(projectRoot: string = process.cwd()): FileInfo[] {
    const legacyDir = this.getLegacyDir(projectRoot);
    if (!existsSync(legacyDir)) {
      return [];
    }

    const files: FileInfo[] = [];

    for (const fileName of PROJECT_FILES) {
      const filePath = join(legacyDir, fileName);
      const exists = existsSync(filePath);

      let size = 0;
      if (exists) {
        try {
          const stats = statSync(filePath);
          size = stats.size;
        } catch {
          // Ignore stat errors
        }
      }

      files.push({
        name: fileName,
        description: FILE_DESCRIPTIONS[fileName] || fileName,
        size,
        exists,
      });
    }

    return files.filter(f => f.exists);
  }

  /**
   * Get complete migration summary
   */
  static getMigrationSummary(
    provider: ProviderDefinition,
    projectRoot: string = process.cwd()
  ): ProjectMigrationSummary {
    const legacyDir = this.getLegacyDir(projectRoot);
    const targetDir = this.getTargetDir(provider, projectRoot);
    const filesToMigrate = this.getFilesToMigrate(projectRoot);
    const targetExists = existsSync(targetDir);

    const totalSize = filesToMigrate.reduce((sum, f) => sum + f.size, 0);

    return {
      legacyDir,
      targetDir,
      filesToMigrate,
      targetExists,
      totalSize,
    };
  }

  /**
   * Format file size for display
   */
  static formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  }

  /**
   * Perform project migration
   *
   * @param provider - Target provider
   * @param options - Migration options
   * @returns Migration result
   */
  static migrate(
    provider: ProviderDefinition,
    options: ProjectMigrationOptions = {}
  ): ProjectMigrationResult {
    const projectRoot = options.projectRoot || process.cwd();
    const legacyDir = this.getLegacyDir(projectRoot);
    const targetDir = this.getTargetDir(provider, projectRoot);

    const filesMigrated: string[] = [];
    const filesSkipped: string[] = [];
    const errors: string[] = [];
    let legacyBackedUp = false;

    try {
      // Check legacy directory exists
      if (!existsSync(legacyDir)) {
        errors.push('Legacy directory does not exist');
        return { success: false, filesMigrated, filesSkipped, errors, legacyBackedUp };
      }

      // Ensure target directory exists
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }

      // Copy each project file
      for (const fileName of PROJECT_FILES) {
        const sourcePath = join(legacyDir, fileName);
        const targetPath = join(targetDir, fileName);

        if (!existsSync(sourcePath)) {
          continue; // Skip non-existent files
        }

        // Check if target already exists
        if (existsSync(targetPath) && !options.overwrite) {
          filesSkipped.push(fileName);
          continue;
        }

        try {
          copyFileSync(sourcePath, targetPath);
          filesMigrated.push(fileName);
        } catch (copyError) {
          errors.push(`Failed to copy ${fileName}: ${copyError instanceof Error ? copyError.message : 'Unknown error'}`);
        }
      }

      // Handle legacy directory
      if (!options.keepLegacy && filesMigrated.length > 0) {
        const backupDir = join(projectRoot, '.ax-cli.backup');

        // Only backup if backup doesn't already exist
        if (!existsSync(backupDir)) {
          try {
            renameSync(legacyDir, backupDir);
            legacyBackedUp = true;
          } catch (renameError) {
            // Non-fatal - just warn
            errors.push(`Could not backup legacy directory: ${renameError instanceof Error ? renameError.message : 'Unknown error'}`);
          }
        }
      }

      return {
        success: errors.length === 0 || filesMigrated.length > 0,
        filesMigrated,
        filesSkipped,
        errors,
        legacyBackedUp,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error during migration');
      return { success: false, filesMigrated, filesSkipped, errors, legacyBackedUp };
    }
  }

  /**
   * Interactive migration prompt
   *
   * @param provider - Target provider
   * @param summary - Migration summary to display
   * @returns User's choice
   */
  static async promptForMigration(
    provider: ProviderDefinition,
    summary: ProjectMigrationSummary
  ): Promise<ProjectMigrationChoice> {
    console.log(''); // Blank line

    // Show header
    await prompts.note(
      `Found: ${summary.legacyDir}/\n\n` +
      `This project was configured for legacy ax-cli.\n` +
      `You can migrate to ${basename(summary.targetDir)}/.`,
      'Legacy Project Config Found'
    );

    // Show files to migrate
    if (summary.filesToMigrate.length > 0) {
      console.log(chalk.cyan('\n  Files to migrate:'));
      for (const file of summary.filesToMigrate) {
        const sizeStr = this.formatSize(file.size);
        console.log(chalk.gray(`    - ${file.name} (${sizeStr}) - ${file.description}`));
      }
      console.log(chalk.dim(`\n  Total: ${this.formatSize(summary.totalSize)}`));
    } else {
      console.log(chalk.dim('\n  No files to migrate'));
    }

    // Warn if target exists
    if (summary.targetExists) {
      console.log(chalk.yellow(`\n  Note: ${basename(summary.targetDir)}/ already exists`));
      console.log(chalk.yellow('  Existing files will NOT be overwritten'));
    }

    console.log(''); // Blank line before prompt

    // Ask user what to do
    const choice = await prompts.select({
      message: 'How would you like to proceed?',
      options: [
        {
          value: 'migrate',
          label: `Migrate to ${basename(summary.targetDir)}/`,
          hint: 'Moves files, renames legacy to .ax-cli.backup',
        },
        {
          value: 'fresh',
          label: 'Start fresh',
          hint: 'Create new config, ignore legacy',
        },
        {
          value: 'keep-both',
          label: 'Keep both directories',
          hint: 'Copies files without removing legacy',
        },
      ],
    });

    // Handle cancellation
    if (prompts.isCancel(choice)) {
      return 'fresh';
    }

    return choice as ProjectMigrationChoice;
  }

  /**
   * Perform full migration flow (detection + prompt + migration)
   * Convenience method that combines all steps
   *
   * @param provider - Target provider
   * @param projectRoot - Project root directory
   * @returns Whether init should continue and migration details
   */
  static async runMigrationFlow(
    provider: ProviderDefinition,
    projectRoot: string = process.cwd()
  ): Promise<{
    shouldContinue: boolean;
    migrationPerformed: boolean;
    result?: ProjectMigrationResult;
  }> {
    // Check if legacy config exists
    if (!this.hasLegacyProjectConfig(projectRoot)) {
      return { shouldContinue: true, migrationPerformed: false };
    }

    // Get summary
    const summary = this.getMigrationSummary(provider, projectRoot);

    // Skip if no files to migrate
    if (summary.filesToMigrate.length === 0) {
      return { shouldContinue: true, migrationPerformed: false };
    }

    // Prompt user
    const choice = await this.promptForMigration(provider, summary);

    switch (choice) {
      case 'migrate': {
        const result = this.migrate(provider, {
          projectRoot,
          keepLegacy: false,
        });

        if (result.success) {
          if (result.filesMigrated.length > 0) {
            console.log(chalk.green(`\n  Migrated ${result.filesMigrated.length} files`));
          }
          if (result.filesSkipped.length > 0) {
            console.log(chalk.dim(`  Skipped ${result.filesSkipped.length} files (already exist)`));
          }
          if (result.legacyBackedUp) {
            console.log(chalk.dim('  Legacy directory backed up to .ax-cli.backup/'));
          }
        } else {
          console.log(chalk.red(`\n  Migration errors: ${result.errors.join(', ')}`));
        }

        console.log(''); // Blank line
        return { shouldContinue: true, migrationPerformed: true, result };
      }

      case 'keep-both': {
        const result = this.migrate(provider, {
          projectRoot,
          keepLegacy: true,
        });

        if (result.success) {
          if (result.filesMigrated.length > 0) {
            console.log(chalk.green(`\n  Copied ${result.filesMigrated.length} files`));
          }
          if (result.filesSkipped.length > 0) {
            console.log(chalk.dim(`  Skipped ${result.filesSkipped.length} files (already exist)`));
          }
          console.log(chalk.dim('  Legacy directory kept at .ax-cli/'));
        } else {
          console.log(chalk.red(`\n  Copy errors: ${result.errors.join(', ')}`));
        }

        console.log('');
        return { shouldContinue: true, migrationPerformed: true, result };
      }

      case 'fresh':
      default:
        // Continue without migration
        return { shouldContinue: true, migrationPerformed: false };
    }
  }

  /**
   * Check if a project has been migrated (by checking for backup)
   */
  static wasProjectMigrated(projectRoot: string = process.cwd()): boolean {
    const backupDir = join(projectRoot, '.ax-cli.backup');
    return existsSync(backupDir);
  }
}
