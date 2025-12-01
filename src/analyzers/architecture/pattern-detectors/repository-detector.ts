/**
 * Repository Pattern Detector
 *
 * Detects Repository pattern for data access abstraction.
 * Looks for files/directories with "repository" in the name.
 */

import type { DetectedPattern, ProjectStructure } from '../../../types/analysis.js';
import { BasePatternDetector } from './base-detector.js';

export class RepositoryDetector extends BasePatternDetector {
  detect(structure: ProjectStructure): DetectedPattern | null {
    // Look for repository directories
    const hasRepositoryDir = this.scanner.hasDirectory(structure, 'repositories') ||
                              this.scanner.hasDirectory(structure, 'repository');

    // Look for files with "repository" in the name
    const repositoryFiles = this.scanner.getFilesByPattern(
      structure,
      /repository\.(ts|js|tsx|jsx)$/i
    );

    if (!hasRepositoryDir && repositoryFiles.length === 0) {
      return null;
    }

    const locations: string[] = [];
    let confidence = 0.6; // Base confidence

    // Add directory locations
    if (hasRepositoryDir) {
      const repoDirs = structure.directories.filter(
        (d) =>
          d.relativePath.toLowerCase().includes('repositories') ||
          d.relativePath.toLowerCase().includes('repository')
      );
      locations.push(...repoDirs.map((d) => d.relativePath));
      confidence += 0.2;
    }

    // Add file locations
    if (repositoryFiles.length > 0) {
      locations.push(...repositoryFiles.map((f) => f.relativePath));

      // Check for interfaces/abstractions (higher confidence)
      const hasInterfaces = repositoryFiles.some(
        (f) =>
          f.relativePath.toLowerCase().includes('interface') ||
          f.relativePath.toLowerCase().includes('abstract') ||
          f.relativePath.toLowerCase().includes('i-repository')
      );

      if (hasInterfaces) {
        confidence += 0.2;
      } else {
        confidence += 0.1;
      }
    }

    return this.createPattern(
      'Repository Pattern',
      'structural',
      Math.min(confidence, 1.0),
      locations,
      'Encapsulates data access logic and provides a collection-like interface for domain entities',
      {
        repositoryCount: repositoryFiles.length,
        hasRepositoryDirectory: hasRepositoryDir,
        hasInterfaces: repositoryFiles.some(
          (f) =>
            f.relativePath.toLowerCase().includes('interface') ||
            f.relativePath.toLowerCase().includes('abstract')
        ),
      }
    );
  }
}
