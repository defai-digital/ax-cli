/**
 * Project Structure Scanner
 *
 * Scans project directory structure and gathers file/directory information.
 * Implements ignore patterns for common non-source directories.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import type {
  FileInfo,
  DirectoryInfo,
  ProjectStructure,
} from '../../types/analysis.js';
import { ProjectStructureError } from '../errors.js';

export class ProjectStructureScanner {
  private readonly ignorePatterns = [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/coverage/**',
    '**/.cache/**',
    '**/.vscode/**',
    '**/.idea/**',
    '**/.DS_Store',
    '**/package-lock.json',
    '**/yarn.lock',
    '**/pnpm-lock.yaml',
  ];

  /**
   * Scan project structure
   */
  async scan(projectPath: string): Promise<ProjectStructure> {
    // Validate path
    await this.validatePath(projectPath);

    // Find all files
    const filePaths = await glob('**/*', {
      cwd: projectPath,
      ignore: this.ignorePatterns,
      nodir: true,
      absolute: false,
      dot: false, // Don't include hidden files
    });

    // Gather file info in parallel (with concurrency limit)
    const files = await this.gatherFileInfo(projectPath, filePaths);

    // Find all directories
    const dirPaths = await glob('**/', {
      cwd: projectPath,
      ignore: this.ignorePatterns,
      absolute: false,
      dot: false,
    });

    const directories = await this.gatherDirectoryInfo(projectPath, dirPaths);

    // Group files by extension
    const filesByExtension = this.groupFilesByExtension(files);

    const totalLines = files.reduce((sum, f) => sum + f.lines, 0);

    return Object.freeze({
      rootPath: projectPath,
      files: Object.freeze(files),
      directories: Object.freeze(directories),
      filesByExtension,
      totalLines,
      totalFiles: files.length,
    });
  }

  /**
   * Validate project path exists and is a directory
   */
  private async validatePath(projectPath: string): Promise<void> {
    // Check for path traversal attempts
    if (projectPath.includes('..')) {
      throw new ProjectStructureError('Path traversal detected', {
        path: projectPath,
      });
    }

    try {
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        throw new ProjectStructureError('Path is not a directory', {
          path: projectPath,
        });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ProjectStructureError('Path does not exist', {
          path: projectPath,
        });
      }
      throw new ProjectStructureError(
        `Failed to access path: ${(error as Error).message}`,
        { path: projectPath }
      );
    }
  }

  /**
   * Gather file information with concurrency control
   */
  private async gatherFileInfo(
    rootPath: string,
    relativePaths: string[]
  ): Promise<FileInfo[]> {
    const CONCURRENCY = 10; // Process 10 files at a time
    const results: FileInfo[] = [];

    for (let i = 0; i < relativePaths.length; i += CONCURRENCY) {
      const batch = relativePaths.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((relativePath) =>
          this.getFileInfo(rootPath, relativePath).catch((error) => {
            console.warn(
              `Failed to read file ${relativePath}:`,
              (error as Error).message
            );
            return null;
          })
        )
      );
      results.push(...batchResults.filter((r): r is FileInfo => r !== null));
    }

    return results;
  }

  /**
   * Get information for a single file
   */
  private async getFileInfo(
    rootPath: string,
    relativePath: string
  ): Promise<FileInfo> {
    const fullPath = path.join(rootPath, relativePath);
    const stats = await fs.stat(fullPath);

    // Count lines
    let lines = 0;
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      lines = content.split('\n').length;
    } catch {
      // If file can't be read as text, lines remain 0
      lines = 0;
    }

    return Object.freeze({
      path: fullPath,
      relativePath,
      lines,
      size: stats.size,
      extension: path.extname(relativePath),
    });
  }

  /**
   * Gather directory information with concurrency control
   */
  private async gatherDirectoryInfo(
    rootPath: string,
    relativePaths: string[]
  ): Promise<DirectoryInfo[]> {
    const CONCURRENCY = 10;
    const results: DirectoryInfo[] = [];

    for (let i = 0; i < relativePaths.length; i += CONCURRENCY) {
      const batch = relativePaths.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((relativePath) =>
          this.getDirectoryInfo(rootPath, relativePath).catch((error) => {
            console.warn(
              `Failed to read directory ${relativePath}:`,
              (error as Error).message
            );
            return null;
          })
        )
      );
      results.push(
        ...batchResults.filter((r): r is DirectoryInfo => r !== null)
      );
    }

    return results;
  }

  /**
   * Get information for a single directory
   */
  private async getDirectoryInfo(
    rootPath: string,
    relativePath: string
  ): Promise<DirectoryInfo> {
    const fullPath = path.join(rootPath, relativePath);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    const fileCount = entries.filter((e) => e.isFile()).length;
    const subdirCount = entries.filter((e) => e.isDirectory()).length;

    return Object.freeze({
      path: fullPath,
      relativePath,
      fileCount,
      subdirCount,
    });
  }

  /**
   * Group files by extension
   */
  private groupFilesByExtension(
    files: FileInfo[]
  ): ReadonlyMap<string, ReadonlyArray<FileInfo>> {
    const groups = new Map<string, FileInfo[]>();

    for (const file of files) {
      const ext = file.extension || '.no-extension';
      let bucket = groups.get(ext);
      if (!bucket) {
        bucket = [];
        groups.set(ext, bucket);
      }
      bucket.push(file);
    }

    // Freeze all arrays
    return new Map(
      Array.from(groups.entries()).map(([k, v]) => [k, Object.freeze(v)])
    );
  }

  /**
   * Check if structure has a directory matching name (case-insensitive)
   */
  hasDirectory(structure: ProjectStructure, dirName: string): boolean {
    return structure.directories.some((d) =>
      d.relativePath.toLowerCase().includes(dirName.toLowerCase())
    );
  }

  /**
   * Check if structure has a file matching name (case-insensitive)
   */
  hasFile(structure: ProjectStructure, fileName: string): boolean {
    return structure.files.some((f) =>
      f.relativePath.toLowerCase().includes(fileName.toLowerCase())
    );
  }

  /**
   * Get files matching a regex pattern
   */
  getFilesByPattern(structure: ProjectStructure, pattern: RegExp): FileInfo[] {
    return structure.files.filter((f) => pattern.test(f.relativePath));
  }

  /**
   * Get files by extension
   */
  getFilesByExtension(
    structure: ProjectStructure,
    extension: string
  ): FileInfo[] {
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    return Array.from(structure.filesByExtension.get(ext) || []);
  }
}
