/**
 * Language Parser Interface
 *
 * Defines the common interface for language parsers.
 * Currently only TypeScript/JavaScript are fully supported via ts-morph.
 * Other languages are detected but return empty AST info.
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
  // Tier 1: High value, low risk
  | 'java'
  | 'ruby'
  | 'php'
  // Tier 2: High value, medium risk
  | 'kotlin'
  | 'dart'
  | 'csharp'
  // Tier 3: Config files
  | 'json'
  | 'yaml'
  | 'toml'
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
  // Java
  '.java': 'java',
  // Ruby
  '.rb': 'ruby',
  '.rake': 'ruby',
  '.gemspec': 'ruby',
  // PHP
  '.php': 'php',
  '.phtml': 'php',
  '.php3': 'php',
  '.php4': 'php',
  '.php5': 'php',
  '.phps': 'php',
  // Kotlin
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  // Dart
  '.dart': 'dart',
  // C#
  '.cs': 'csharp',
  // Config files
  '.json': 'json',
  '.jsonc': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
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
