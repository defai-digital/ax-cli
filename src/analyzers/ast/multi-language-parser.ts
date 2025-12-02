/**
 * Multi-Language Parser Facade
 *
 * Unified interface for parsing TypeScript/JavaScript files.
 * Uses ts-morph for accurate type-aware parsing.
 *
 * Note: Previously supported 30+ languages via tree-sitter.
 * Simplified to focus on TypeScript/JavaScript (the primary use case).
 * For other languages, use language-specific tools.
 */

import { ASTParser } from './parser.js';
import { getLanguageFromPath, type SupportedLanguage } from './language-parser.js';
import type { FileASTInfo } from './types.js';
import type { SourceFile } from 'ts-morph';

/**
 * Singleton ts-morph parser
 */
let tsMorphParser: ASTParser | null = null;

/**
 * Get or create the ts-morph parser (singleton)
 */
function getTsMorphParser(): ASTParser {
  if (!tsMorphParser) {
    tsMorphParser = new ASTParser();
  }
  return tsMorphParser;
}

/**
 * Multi-language parser facade
 *
 * Currently supports TypeScript/JavaScript via ts-morph.
 * Returns empty AST info for unsupported languages.
 */
export class MultiLanguageParser {
  /**
   * Parse a file, automatically selecting the appropriate parser
   */
  async parseFile(filePath: string): Promise<FileASTInfo> {
    const language = getLanguageFromPath(filePath);

    if (language === 'typescript' || language === 'javascript') {
      return this.parseTypeScriptFile(filePath);
    }

    // Unsupported language - return empty AST
    return this.createEmptyASTInfo(filePath);
  }

  /**
   * Parse content directly with specified language
   */
  async parseContent(content: string, language: SupportedLanguage, filePath: string = 'temp'): Promise<FileASTInfo> {
    if (language === 'typescript' || language === 'javascript') {
      return this.parseTypeScriptContent(content, filePath);
    }

    // Unsupported language - return empty AST
    return this.createEmptyASTInfo(filePath);
  }

  /**
   * Parse TypeScript/JavaScript file using ts-morph
   */
  private parseTypeScriptFile(filePath: string): FileASTInfo {
    const parser = getTsMorphParser();
    return parser.parseFile(filePath);
  }

  /**
   * Parse TypeScript/JavaScript content using ts-morph
   */
  private parseTypeScriptContent(content: string, filePath: string): FileASTInfo {
    const parser = getTsMorphParser();
    return parser.parseContent(content, filePath);
  }

  /**
   * Check if a language is supported
   */
  supports(filePath: string): boolean {
    const language = getLanguageFromPath(filePath);
    return language === 'typescript' || language === 'javascript';
  }

  /**
   * Get the language for a file path
   */
  getLanguage(filePath: string): SupportedLanguage {
    return getLanguageFromPath(filePath);
  }

  /**
   * Get ts-morph SourceFile for TypeScript/JavaScript files
   * Returns null for other languages
   */
  getSourceFile(filePath: string): SourceFile | null {
    const language = getLanguageFromPath(filePath);
    if (language === 'typescript' || language === 'javascript') {
      return getTsMorphParser().getSourceFile(filePath);
    }
    return null;
  }

  /**
   * Check if file supports advanced semantic analysis (ts-morph only)
   */
  supportsSemanticAnalysis(filePath: string): boolean {
    const language = getLanguageFromPath(filePath);
    return language === 'typescript' || language === 'javascript';
  }

  /**
   * Get list of supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return ['typescript', 'javascript'];
  }

  /**
   * Get list of all parseable languages
   * (Same as getSupportedLanguages after tree-sitter removal)
   */
  getAllParseableLanguages(): string[] {
    return ['typescript', 'javascript'];
  }

  /**
   * Create empty AST info
   */
  private createEmptyASTInfo(filePath: string): FileASTInfo {
    return Object.freeze({
      filePath,
      functions: Object.freeze([]),
      classes: Object.freeze([]),
      imports: Object.freeze([]),
      exports: Object.freeze([]),
      totalLines: 0,
    });
  }

  /**
   * Clear cached parser and free memory
   */
  dispose(): void {
    if (tsMorphParser) {
      tsMorphParser.clear();
      tsMorphParser = null;
    }
  }
}

/**
 * Singleton instance for convenience
 */
let multiLanguageParserInstance: MultiLanguageParser | null = null;

/**
 * Get the singleton multi-language parser instance
 */
export function getMultiLanguageParser(): MultiLanguageParser {
  if (!multiLanguageParserInstance) {
    multiLanguageParserInstance = new MultiLanguageParser();
  }
  return multiLanguageParserInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetMultiLanguageParser(): void {
  if (multiLanguageParserInstance) {
    multiLanguageParserInstance.dispose();
    multiLanguageParserInstance = null;
  }
}
