/**
 * Multi-Language Parser Facade
 *
 * Unified interface for parsing multiple programming languages.
 * Uses ts-morph for TypeScript/JavaScript (proven, mature)
 * Uses tree-sitter for Python, Rust, Go (fast, universal)
 */

import { ASTParser } from './parser.js';
import { TreeSitterParser, createTreeSitterParser, TREE_SITTER_LANGUAGES } from './tree-sitter-parser.js';
import { getLanguageFromPath, type SupportedLanguage, type LanguageParser } from './language-parser.js';
import type { FileASTInfo } from './types.js';
import type { SourceFile } from 'ts-morph';

// Re-export for convenience
export { TreeSitterParser };

/**
 * Parser cache for reuse
 */
const parserCache = new Map<string, LanguageParser>();
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
 * Get or create a tree-sitter parser for a language
 */
function getTreeSitterParser(language: SupportedLanguage): TreeSitterParser {
  const cached = parserCache.get(language);
  if (cached && cached instanceof TreeSitterParser) {
    return cached;
  }
  const parser = createTreeSitterParser(language);
  parserCache.set(language, parser);
  return parser;
}

/**
 * Multi-language parser facade
 *
 * Automatically selects the best parser based on file extension:
 * - TypeScript/JavaScript: ts-morph (mature, accurate type info)
 * - Python/Rust/Go: tree-sitter (fast, universal)
 */
export class MultiLanguageParser {
  /**
   * Parse a file, automatically selecting the appropriate parser
   */
  async parseFile(filePath: string): Promise<FileASTInfo> {
    const language = getLanguageFromPath(filePath);

    switch (language) {
      case 'typescript':
      case 'javascript':
        return this.parseTypeScriptFile(filePath);

      case 'python':
      case 'rust':
      case 'go':
      case 'c':
      case 'cpp':
      case 'swift':
      case 'html':
      case 'css':
        return this.parseTreeSitterFile(filePath, language);

      default:
        // Try tree-sitter as fallback for unknown languages
        return this.tryTreeSitterFallback(filePath);
    }
  }

  /**
   * Parse content directly with specified language
   */
  async parseContent(content: string, language: SupportedLanguage, filePath: string = 'temp'): Promise<FileASTInfo> {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return this.parseTypeScriptContent(content, filePath);

      case 'python':
      case 'rust':
      case 'go':
      case 'c':
      case 'cpp':
      case 'swift':
      case 'html':
      case 'css':
        return this.parseTreeSitterContent(content, language, filePath);

      default:
        return this.createEmptyASTInfo(filePath);
    }
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
   * Parse file using tree-sitter
   */
  private async parseTreeSitterFile(filePath: string, language: SupportedLanguage): Promise<FileASTInfo> {
    const parser = getTreeSitterParser(language);
    return parser.parseFile(filePath);
  }

  /**
   * Parse content using tree-sitter
   */
  private async parseTreeSitterContent(content: string, language: SupportedLanguage, filePath: string): Promise<FileASTInfo> {
    const parser = getTreeSitterParser(language);
    return parser.parseContent(content, filePath);
  }

  /**
   * Try to use tree-sitter as fallback for unknown file types
   */
  private async tryTreeSitterFallback(filePath: string): Promise<FileASTInfo> {
    // Extract extension and check if tree-sitter supports it
    const ext = filePath.slice(filePath.lastIndexOf('.') + 1).toLowerCase();

    // Map common extensions to tree-sitter language names
    const extToTreeSitter: Record<string, string> = {
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'toml': 'toml',
      'md': 'markdown',
      'c': 'c',
      'h': 'c',
      'cpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'hpp': 'cpp',
      'java': 'java',
      'kt': 'kotlin',
      'kts': 'kotlin',
      'swift': 'swift',
      'rb': 'ruby',
      'php': 'php',
      'lua': 'lua',
      'sh': 'bash',
      'bash': 'bash',
      'zsh': 'bash',
      'sql': 'sql',
      'vue': 'vue',
      'svelte': 'svelte',
    };

    const treeSitterLang = extToTreeSitter[ext];
    if (treeSitterLang && TREE_SITTER_LANGUAGES.includes(treeSitterLang as any)) {
      try {
        // Create a specialized tree-sitter parser
        const parser = new TreeSitterParser('unknown', treeSitterLang);
        return parser.parseFile(filePath);
      } catch {
        // Fallback to empty AST
      }
    }

    return this.createEmptyASTInfo(filePath);
  }

  /**
   * Check if a language is supported
   */
  supports(filePath: string): boolean {
    const language = getLanguageFromPath(filePath);
    return language !== 'unknown' || this.hasTreeSitterFallback(filePath);
  }

  /**
   * Check if tree-sitter has a grammar for this file type
   */
  private hasTreeSitterFallback(filePath: string): boolean {
    const ext = filePath.slice(filePath.lastIndexOf('.') + 1).toLowerCase();
    const fallbackExts = ['html', 'css', 'json', 'yaml', 'yml', 'toml', 'c', 'cpp', 'java', 'kt', 'swift', 'rb', 'php', 'lua', 'sh', 'bash', 'sql', 'vue'];
    return fallbackExts.includes(ext);
  }

  /**
   * Get the language for a file path
   */
  getLanguage(filePath: string): SupportedLanguage {
    return getLanguageFromPath(filePath);
  }

  /**
   * Get ts-morph SourceFile for TypeScript/JavaScript files
   * Returns null for other languages (use parseFile instead for those)
   *
   * Note: This is useful for advanced analysis that requires semantic information
   * like finding references, type checking, etc. For basic AST info, use parseFile.
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
   * Get list of fully supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return ['typescript', 'javascript', 'python', 'rust', 'go', 'c', 'cpp', 'swift', 'html', 'css'];
  }

  /**
   * Get list of all parseable languages (including tree-sitter fallbacks)
   */
  getAllParseableLanguages(): string[] {
    return [
      ...this.getSupportedLanguages(),
      'json', 'yaml', 'toml', 'java', 'kotlin', 'ruby', 'php', 'lua', 'bash', 'sql', 'vue',
    ];
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
   * Clear all cached parsers and free memory
   */
  dispose(): void {
    for (const parser of parserCache.values()) {
      parser.dispose();
    }
    parserCache.clear();

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
