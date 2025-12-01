/**
 * AST Analysis Module
 *
 * Provides multi-language AST parsing and traversal utilities.
 * Supports: TypeScript, JavaScript, Python, Rust, Go, and 30+ more via tree-sitter.
 */

// Core parsers
export { ASTParser } from './parser.js';
export { MultiLanguageParser, getMultiLanguageParser, resetMultiLanguageParser } from './multi-language-parser.js';

// Tree-sitter support
export { TreeSitterParser, createTreeSitterParser, TREE_SITTER_LANGUAGES } from './tree-sitter-parser.js';
export type { TreeSitterLanguage } from './tree-sitter-parser.js';

// Language detection
export { getLanguageFromPath, EXTENSION_TO_LANGUAGE, BaseLanguageParser } from './language-parser.js';
export type { SupportedLanguage, LanguageParser } from './language-parser.js';

// Types and utilities
export * from './types.js';
export * from './node-helpers.js';
export * from './traverser.js';
