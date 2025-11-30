/**
 * Base Security Detector
 *
 * Abstract base class for security vulnerability detectors
 */

import type { SecurityDetector, SecurityVulnerability, SecuritySeverity, OWASPCategory } from './types.js';
import path from 'path';

export abstract class BaseSecurityDetector implements SecurityDetector {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;
  public readonly severity: SecuritySeverity;
  public readonly owaspCategory?: OWASPCategory;
  public readonly cweId?: string;
  public readonly enabled: boolean;

  protected readonly fileExtensions: readonly string[];

  constructor(config: {
    id: string;
    name: string;
    description: string;
    severity: SecuritySeverity;
    owaspCategory?: OWASPCategory;
    cweId?: string;
    fileExtensions?: readonly string[];
    enabled?: boolean;
  }) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.severity = config.severity;
    this.owaspCategory = config.owaspCategory;
    this.cweId = config.cweId;
    this.fileExtensions = config.fileExtensions || ['.ts', '.tsx', '.js', '.jsx'];
    this.enabled = config.enabled !== false;
  }

  /**
   * Check if detector applies to this file type
   */
  appliesTo(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.fileExtensions.includes(ext);
  }

  /**
   * Scan file content for vulnerabilities
   */
  abstract scan(content: string, filePath: string): Promise<SecurityVulnerability[]>;

  /**
   * Create a vulnerability finding
   */
  protected createVulnerability(
    file: string,
    line: number,
    code: string,
    description: string,
    recommendation: string,
    references: string[] = []
  ): SecurityVulnerability {
    return Object.freeze({
      id: this.id,
      name: this.name,
      description,
      severity: this.severity,
      owaspCategory: this.owaspCategory,
      cweId: this.cweId,
      file,
      line,
      code: code.trim(),
      recommendation,
      references: Object.freeze(references),
    });
  }

  /**
   * Find line number for a match in content
   */
  protected findLineNumber(content: string, matchIndex: number): number {
    const beforeMatch = content.substring(0, matchIndex);
    return beforeMatch.split('\n').length;
  }

  /**
   * Extract code snippet around a match
   */
  protected extractCodeSnippet(content: string, matchIndex: number, contextLines: number = 0): string {
    const lines = content.split('\n');
    const lineNumber = this.findLineNumber(content, matchIndex);
    const startLine = Math.max(0, lineNumber - contextLines - 1);
    const endLine = Math.min(lines.length, lineNumber + contextLines);

    return lines.slice(startLine, endLine).join('\n');
  }

  /**
   * Check if line is in a comment
   */
  protected isInComment(content: string, matchIndex: number): boolean {
    const beforeMatch = content.substring(0, matchIndex);
    const lastLineBreak = beforeMatch.lastIndexOf('\n');
    const currentLine = content.substring(lastLineBreak + 1, matchIndex + 50);

    // Check for single-line comment
    if (currentLine.includes('//')) {
      return true;
    }

    // Check for multi-line comment
    const openComments = (beforeMatch.match(/\/\*/g) || []).length;
    const closeComments = (beforeMatch.match(/\*\//g) || []).length;

    return openComments > closeComments;
  }

  /**
   * Check if match is in a string literal
   */
  protected isInString(content: string, matchIndex: number): boolean {
    const beforeMatch = content.substring(0, matchIndex);
    const lastLineBreak = beforeMatch.lastIndexOf('\n');
    const lineContent = beforeMatch.substring(lastLineBreak + 1);

    // Count unescaped quotes
    const singleQuotes = (lineContent.match(/(?<!\\)'/g) || []).length;
    const doubleQuotes = (lineContent.match(/(?<!\\)"/g) || []).length;
    const backticks = (lineContent.match(/(?<!\\)`/g) || []).length;

    return (singleQuotes % 2 === 1) || (doubleQuotes % 2 === 1) || (backticks % 2 === 1);
  }

  /**
   * Check if match should be ignored
   */
  protected shouldIgnore(content: string, matchIndex: number): boolean {
    return this.isInComment(content, matchIndex) || this.isInString(content, matchIndex);
  }
}
