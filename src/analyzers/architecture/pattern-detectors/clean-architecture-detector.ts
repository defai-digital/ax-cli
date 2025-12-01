/**
 * Clean Architecture Pattern Detector
 *
 * Detects Clean Architecture (Uncle Bob's architecture pattern).
 * Looks for domain/, application/, infrastructure/, and presentation/ layers.
 */

import type { DetectedPattern, ProjectStructure } from '../../../types/analysis.js';
import { BasePatternDetector } from './base-detector.js';

export class CleanArchitectureDetector extends BasePatternDetector {
  detect(structure: ProjectStructure): DetectedPattern | null {
    // Check for core layers
    const hasDomain = this.scanner.hasDirectory(structure, 'domain');
    const hasApplication = this.scanner.hasDirectory(structure, 'application');
    const hasInfrastructure = this.scanner.hasDirectory(structure, 'infrastructure');

    // Check for presentation layer (multiple possible names)
    const hasPresentation =
      this.scanner.hasDirectory(structure, 'presentation') ||
      this.scanner.hasDirectory(structure, 'api') ||
      this.scanner.hasDirectory(structure, 'ui') ||
      this.scanner.hasDirectory(structure, 'web');

    // Need at least domain + infrastructure to suggest Clean Architecture
    if (!hasDomain || !hasInfrastructure) {
      return null;
    }

    const locations: string[] = [];
    let confidence = 0.5; // Base confidence for domain + infrastructure

    if (hasDomain) {
      const domainDirs = structure.directories.filter((d) =>
        d.relativePath.toLowerCase().includes('domain')
      );
      locations.push(...domainDirs.map((d) => d.relativePath));
      confidence += 0.15;
    }

    if (hasApplication) {
      const appDirs = structure.directories.filter((d) =>
        d.relativePath.toLowerCase().includes('application')
      );
      locations.push(...appDirs.map((d) => d.relativePath));
      confidence += 0.15;
    }

    if (hasInfrastructure) {
      const infraDirs = structure.directories.filter((d) =>
        d.relativePath.toLowerCase().includes('infrastructure')
      );
      locations.push(...infraDirs.map((d) => d.relativePath));
      confidence += 0.1;
    }

    if (hasPresentation) {
      const presentationDirs = structure.directories.filter(
        (d) =>
          d.relativePath.toLowerCase().includes('presentation') ||
          d.relativePath.toLowerCase().includes('api') ||
          d.relativePath.toLowerCase().includes('ui') ||
          d.relativePath.toLowerCase().includes('web')
      );
      locations.push(...presentationDirs.map((d) => d.relativePath));
      confidence += 0.1;
    }

    return this.createPattern(
      'Clean Architecture',
      'architectural',
      Math.min(confidence, 1.0),
      locations,
      'Separates concerns into layers: Domain (entities), Application (use cases), Infrastructure (external dependencies), and Presentation (UI/API)',
      {
        hasDomain,
        hasApplication,
        hasInfrastructure,
        hasPresentation,
        layerCount: [hasDomain, hasApplication, hasInfrastructure, hasPresentation].filter(Boolean).length,
      }
    );
  }
}
