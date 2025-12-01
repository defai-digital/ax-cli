/**
 * Base Smell Detector
 *
 * Abstract base class for all smell detectors
 */

import { getMultiLanguageParser, type MultiLanguageParser } from '../ast/multi-language-parser.js';
import type { SmellDetector, CodeSmell, SmellType, DetectorConfig } from './types.js';
import { SmellSeverity } from './types.js';

export abstract class BaseSmellDetector implements SmellDetector {
  protected astParser: MultiLanguageParser;

  constructor(
    public readonly type: SmellType,
    public readonly config: DetectorConfig
  ) {
    this.astParser = getMultiLanguageParser();
  }

  /**
   * Detect smells in a file
   */
  abstract detect(filePath: string): Promise<CodeSmell[]>;

  /**
   * Check if detector is enabled
   */
  protected isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get threshold value
   */
  protected getThreshold(key: string, defaultValue: number): number {
    return this.config.thresholds?.[key] ?? defaultValue;
  }

  /**
   * Create a code smell object
   */
  protected createSmell(
    filePath: string,
    startLine: number,
    endLine: number,
    message: string,
    suggestion: string,
    severity: SmellSeverity,
    metadata: Record<string, unknown> = {}
  ): CodeSmell {
    return Object.freeze({
      type: this.type,
      severity,
      filePath,
      startLine,
      endLine,
      message,
      suggestion,
      metadata: Object.freeze(metadata),
    });
  }
}
