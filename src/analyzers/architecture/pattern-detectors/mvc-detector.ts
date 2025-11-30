/**
 * MVC Pattern Detector
 *
 * Detects Model-View-Controller architectural pattern.
 * Looks for models/, views/, and controllers/ directories.
 */

import type { DetectedPattern, ProjectStructure } from '../../../types/analysis.js';
import { BasePatternDetector } from './base-detector.js';

export class MVCDetector extends BasePatternDetector {
  detect(structure: ProjectStructure): DetectedPattern | null {
    const hasModels = this.scanner.hasDirectory(structure, 'models');
    const hasViews = this.scanner.hasDirectory(structure, 'views');
    const hasControllers = this.scanner.hasDirectory(structure, 'controllers');

    // Need at least 2 out of 3 components to suggest MVC
    const matchCount = [hasModels, hasViews, hasControllers].filter(Boolean)
      .length;

    if (matchCount < 2) {
      return null;
    }

    const locations: string[] = [];
    let confidence = 0;

    if (hasModels) {
      const modelDirs = structure.directories.filter((d) =>
        d.relativePath.toLowerCase().includes('models')
      );
      locations.push(...modelDirs.map((d) => d.relativePath));
      confidence += 0.33;
    }

    if (hasViews) {
      const viewDirs = structure.directories.filter((d) =>
        d.relativePath.toLowerCase().includes('views')
      );
      locations.push(...viewDirs.map((d) => d.relativePath));
      confidence += 0.33;
    }

    if (hasControllers) {
      const controllerDirs = structure.directories.filter((d) =>
        d.relativePath.toLowerCase().includes('controllers')
      );
      locations.push(...controllerDirs.map((d) => d.relativePath));
      confidence += 0.34;
    }

    return this.createPattern(
      'MVC (Model-View-Controller)',
      'architectural',
      confidence,
      locations,
      'Separates application into Models (data), Views (presentation), and Controllers (logic)',
      {
        hasModels,
        hasViews,
        hasControllers,
      }
    );
  }
}
