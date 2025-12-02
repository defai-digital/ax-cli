/**
 * AST Analysis Module
 *
 * Provides AST parsing and traversal utilities.
 * Supports TypeScript and JavaScript via ts-morph.
 */

// Core parsers
export { ASTParser } from './parser.js';
export { MultiLanguageParser, getMultiLanguageParser, resetMultiLanguageParser } from './multi-language-parser.js';

// Language detection
export { getLanguageFromPath, EXTENSION_TO_LANGUAGE, BaseLanguageParser } from './language-parser.js';
export type { SupportedLanguage, LanguageParser } from './language-parser.js';

// Types and utilities
export * from './types.js';
export * from './node-helpers.js';
export * from './traverser.js';
