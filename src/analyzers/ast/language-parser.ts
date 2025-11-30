/**
 * Language Parser Interface
 *
 * Defines the common interface for all language parsers (ts-morph, tree-sitter)
 * This allows seamless switching between parser implementations.
 */

import type { FileASTInfo } from './types.js';

/**
 * Supported programming languages
 */
export type SupportedLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'rust'
  | 'go'
  | 'c'
  | 'cpp'
  | 'swift'
  | 'html'
  | 'css'
  | 'unknown';

/**
 * Map file extensions to languages
 */
export const EXTENSION_TO_LANGUAGE: Record<string, SupportedLanguage> = {
  // TypeScript
  '.ts': 'typescript',
  '.tsx': 'typescript',
  // JavaScript
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  // Python
  '.py': 'python',
  '.pyw': 'python',
  // Rust
  '.rs': 'rust',
  // Go
  '.go': 'go',
  // C
  '.c': 'c',
  '.h': 'c',
  // C++
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.hh': 'cpp',
  '.hxx': 'cpp',
  '.c++': 'cpp',
  '.h++': 'cpp',
  // Swift
  '.swift': 'swift',
  // HTML
  '.html': 'html',
  '.htm': 'html',
  // CSS
  '.css': 'css',
  '.scss': 'css',
  '.sass': 'css',
  '.less': 'css',
};

/**
 * Get language from file path
 */
export function getLanguageFromPath(filePath: string): SupportedLanguage {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] || 'unknown';
}

/**
 * Interface for language-specific parsers
 */
export interface LanguageParser {
  /**
   * The language this parser handles
   */
  readonly language: SupportedLanguage;

  /**
   * Parse a file from disk
   */
  parseFile(filePath: string): Promise<FileASTInfo>;

  /**
   * Parse code content directly
   */
  parseContent(content: string, filePath?: string): Promise<FileASTInfo>;

  /**
   * Check if this parser supports a given file
   */
  supports(filePath: string): boolean;

  /**
   * Clean up resources
   */
  dispose(): void;
}

/**
 * Abstract base class for language parsers
 */
export abstract class BaseLanguageParser implements LanguageParser {
  abstract readonly language: SupportedLanguage;

  abstract parseFile(filePath: string): Promise<FileASTInfo>;
  abstract parseContent(content: string, filePath?: string): Promise<FileASTInfo>;

  supports(filePath: string): boolean {
    return getLanguageFromPath(filePath) === this.language;
  }

  dispose(): void {
    // Override in subclasses if cleanup is needed
  }

  /**
   * Create empty AST info (for error cases)
   */
  protected createEmptyASTInfo(filePath: string): FileASTInfo {
    return Object.freeze({
      filePath,
      functions: Object.freeze([]),
      classes: Object.freeze([]),
      imports: Object.freeze([]),
      exports: Object.freeze([]),
      totalLines: 0,
    });
  }
}
