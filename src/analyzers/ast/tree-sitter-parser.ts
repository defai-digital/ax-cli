/**
 * Tree-sitter Parser
 *
 * Base class for tree-sitter based language parsers.
 * Uses WebAssembly (WASM) for cross-platform compatibility.
 *
 * Supports: Python, Rust, Go, TypeScript, JavaScript, HTML, CSS, and 30+ more languages
 */

import { Parser, Language, Tree, Node } from 'web-tree-sitter';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BaseLanguageParser, type SupportedLanguage } from './language-parser.js';
import type { FileASTInfo, FunctionInfo, ClassInfo, ImportInfo, ExportInfo, ParameterInfo, MethodInfo, PropertyInfo } from './types.js';

// Type alias for clarity
type SyntaxNode = Node;

// Singleton parser instance (shared across all language parsers)
let parserInitialized = false;
let parserInstance: InstanceType<typeof Parser> | null = null;

// Language cache to avoid reloading WASM files
const languageCache = new Map<string, Language>();

/**
 * Get non-null children from a node
 */
function getChildren(node: SyntaxNode): SyntaxNode[] {
  return node.children.filter((c): c is SyntaxNode => c !== null);
}

/**
 * Find a child node matching a predicate
 */
function findChild(node: SyntaxNode, predicate: (child: SyntaxNode) => boolean): SyntaxNode | undefined {
  return getChildren(node).find(predicate);
}

/**
 * Check if any child matches a predicate
 */
function someChild(node: SyntaxNode, predicate: (child: SyntaxNode) => boolean): boolean {
  return getChildren(node).some(predicate);
}

/**
 * Initialize the tree-sitter parser (called once)
 */
async function initParser(): Promise<InstanceType<typeof Parser>> {
  if (parserInstance && parserInitialized) {
    return parserInstance;
  }

  await Parser.init();
  parserInstance = new Parser();
  parserInitialized = true;
  return parserInstance;
}

/**
 * Get the path to the WASM file for a language
 */
function getWasmPath(languageName: string): string {
  // Try to find in node_modules/tree-sitter-wasms/out/
  const possiblePaths = [
    join(process.cwd(), 'node_modules', 'tree-sitter-wasms', 'out', `tree-sitter-${languageName}.wasm`),
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'node_modules', 'tree-sitter-wasms', 'out', `tree-sitter-${languageName}.wasm`),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  throw new Error(`WASM file not found for language: ${languageName}. Tried: ${possiblePaths.join(', ')}`);
}

/**
 * Load a language grammar
 */
async function loadLanguage(languageName: string): Promise<Language> {
  // Check cache first
  const cached = languageCache.get(languageName);
  if (cached) {
    return cached;
  }

  const wasmPath = getWasmPath(languageName);
  const language = await Language.load(wasmPath);
  languageCache.set(languageName, language);
  return language;
}

/**
 * Tree-sitter based language parser
 */
export class TreeSitterParser extends BaseLanguageParser {
  readonly language: SupportedLanguage;
  private treeSitterLanguage: string;
  private parser: InstanceType<typeof Parser> | null = null;
  private loadedLanguage: Language | null = null;

  constructor(language: SupportedLanguage, treeSitterLanguage?: string) {
    super();
    this.language = language;
    // Map our language names to tree-sitter grammar names
    this.treeSitterLanguage = treeSitterLanguage || this.mapLanguageToTreeSitter(language);
  }

  private mapLanguageToTreeSitter(language: SupportedLanguage): string {
    const mapping: Record<SupportedLanguage, string> = {
      'typescript': 'typescript',
      'javascript': 'javascript',
      'python': 'python',
      'rust': 'rust',
      'go': 'go',
      'c': 'c',
      'cpp': 'cpp',
      'swift': 'swift',
      'html': 'html',
      'css': 'css',
      'unknown': 'javascript', // fallback
    };
    return mapping[language];
  }

  /**
   * Ensure parser is initialized
   */
  private async ensureInitialized(): Promise<{ parser: InstanceType<typeof Parser>; language: Language }> {
    if (!this.parser) {
      this.parser = await initParser();
    }
    if (!this.loadedLanguage) {
      this.loadedLanguage = await loadLanguage(this.treeSitterLanguage);
      this.parser.setLanguage(this.loadedLanguage);
    }
    return { parser: this.parser, language: this.loadedLanguage };
  }

  async parseFile(filePath: string): Promise<FileASTInfo> {
    try {
      const content = await readFile(filePath, 'utf-8');
      return this.parseContent(content, filePath);
    } catch (error) {
      console.warn(`Failed to parse file ${filePath}:`, error);
      return this.createEmptyASTInfo(filePath);
    }
  }

  async parseContent(content: string, filePath: string = 'temp'): Promise<FileASTInfo> {
    try {
      const { parser } = await this.ensureInitialized();
      const tree = parser.parse(content);

      if (!tree) {
        return this.createEmptyASTInfo(filePath);
      }

      const functions = this.extractFunctions(tree.rootNode);
      const classes = this.extractClasses(tree.rootNode);
      const imports = this.extractImports(tree.rootNode);
      const exports = this.extractExports(tree.rootNode);

      return Object.freeze({
        filePath,
        functions: Object.freeze(functions),
        classes: Object.freeze(classes),
        imports: Object.freeze(imports),
        exports: Object.freeze(exports),
        totalLines: content.split('\n').length,
      });
    } catch (error) {
      console.warn(`Failed to parse content:`, error);
      return this.createEmptyASTInfo(filePath);
    }
  }

  /**
   * Extract functions from AST
   */
  private extractFunctions(rootNode: SyntaxNode): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    const functionTypes = this.getFunctionNodeTypes();

    const visit = (node: SyntaxNode): void => {
      if (functionTypes.includes(node.type)) {
        const funcInfo = this.extractFunctionInfo(node);
        if (funcInfo) {
          functions.push(funcInfo);
        }
      }
      for (const child of getChildren(node)) {
        visit(child);
      }
    };

    visit(rootNode);
    return functions;
  }

  /**
   * Get node types that represent functions for this language
   */
  private getFunctionNodeTypes(): string[] {
    switch (this.language) {
      case 'python':
        return ['function_definition', 'async_function_definition'];
      case 'rust':
        return ['function_item', 'impl_item'];
      case 'go':
        return ['function_declaration', 'method_declaration'];
      case 'typescript':
      case 'javascript':
        return ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'];
      case 'c':
        return ['function_definition'];
      case 'cpp':
        return ['function_definition', 'template_declaration'];
      case 'swift':
        return ['function_declaration', 'init_declaration', 'deinit_declaration'];
      case 'html':
      case 'css':
        return []; // No functions in HTML/CSS
      default:
        return ['function_declaration', 'function_definition'];
    }
  }

  /**
   * Extract function info from a function node
   */
  private extractFunctionInfo(node: SyntaxNode): FunctionInfo | null {
    try {
      const name = this.extractFunctionName(node);
      const parameters = this.extractParameters(node);
      const returnType = this.extractReturnType(node);
      const startLine = node.startPosition.row + 1;
      const endLine = node.endPosition.row + 1;
      const isAsync = this.isAsyncFunction(node);
      const isExported = this.isExportedFunction(node);

      return Object.freeze({
        name,
        parameters: Object.freeze(parameters),
        returnType,
        startLine,
        endLine,
        complexity: this.calculateComplexity(node),
        length: endLine - startLine + 1,
        isAsync,
        isExported,
      });
    } catch {
      return null;
    }
  }

  /**
   * Extract function name
   */
  private extractFunctionName(node: SyntaxNode): string {
    // Find the name/identifier child
    const nameNode = node.childForFieldName('name') ||
                     findChild(node, c => c.type === 'identifier' || c.type === 'property_identifier');
    return nameNode?.text || '<anonymous>';
  }

  /**
   * Extract parameters from function
   */
  private extractParameters(node: SyntaxNode): ParameterInfo[] {
    const params: ParameterInfo[] = [];
    const paramsNode = node.childForFieldName('parameters') ||
                       findChild(node, c => c.type === 'parameters' || c.type === 'parameter_list' || c.type === 'formal_parameters');

    if (!paramsNode) return params;

    for (const child of getChildren(paramsNode)) {
      if (this.isParameterNode(child)) {
        const paramInfo = this.extractParameterInfo(child);
        if (paramInfo) {
          params.push(paramInfo);
        }
      }
    }

    return params;
  }

  /**
   * Check if node is a parameter
   */
  private isParameterNode(node: SyntaxNode): boolean {
    const paramTypes = [
      'parameter', 'required_parameter', 'optional_parameter',
      'identifier', 'typed_parameter', 'default_parameter',
      'formal_parameter',
    ];
    return paramTypes.includes(node.type);
  }

  /**
   * Extract parameter info
   */
  private extractParameterInfo(node: SyntaxNode): ParameterInfo | null {
    try {
      const nameNode = node.childForFieldName('name') ||
                       findChild(node, c => c.type === 'identifier') ||
                       node;
      const typeNode = node.childForFieldName('type') ||
                       findChild(node, c => c.type === 'type_annotation' || c.type === 'type');
      const defaultNode = node.childForFieldName('value') ||
                          findChild(node, c => c.type === 'default_value');

      return Object.freeze({
        name: nameNode.text,
        type: typeNode?.text,
        isOptional: node.type === 'optional_parameter' || !!defaultNode,
        hasDefault: !!defaultNode,
      });
    } catch {
      return null;
    }
  }

  /**
   * Extract return type
   */
  private extractReturnType(node: SyntaxNode): string | undefined {
    const returnTypeNode = node.childForFieldName('return_type') ||
                           findChild(node, c => c.type === 'type_annotation' || c.type === 'return_type');
    return returnTypeNode?.text;
  }

  /**
   * Check if function is async
   */
  private isAsyncFunction(node: SyntaxNode): boolean {
    if (node.type.includes('async')) return true;
    return someChild(node, c => c.type === 'async');
  }

  /**
   * Check if function is exported
   */
  private isExportedFunction(node: SyntaxNode): boolean {
    // Check parent for export statement
    const parent = node.parent;
    if (!parent) return false;

    if (parent.type === 'export_statement' || parent.type === 'export_declaration') {
      return true;
    }

    // Python/Go: check for public naming convention
    if (this.language === 'python' || this.language === 'go') {
      const name = this.extractFunctionName(node);
      // Python: no underscore prefix, Go: uppercase first letter
      if (this.language === 'go') {
        return name.length > 0 && name[0] === name[0].toUpperCase();
      }
      return !name.startsWith('_');
    }

    // Rust: check for pub keyword
    if (this.language === 'rust') {
      return someChild(node, c => c.type === 'visibility_modifier' && c.text === 'pub');
    }

    return false;
  }

  /**
   * Calculate cyclomatic complexity
   */
  private calculateComplexity(node: SyntaxNode): number {
    let complexity = 1;
    const decisionPoints = [
      'if_statement', 'if_expression', 'elif_clause', 'else_clause',
      'for_statement', 'for_expression', 'while_statement', 'while_expression',
      'match_expression', 'match_arm', 'case_clause',
      'try_statement', 'catch_clause', 'except_clause',
      'conditional_expression', 'ternary_expression',
      'binary_expression', // for && and ||
    ];

    const visit = (n: SyntaxNode): void => {
      if (decisionPoints.includes(n.type)) {
        complexity++;
      }
      // Count && and || operators
      if (n.type === 'binary_expression') {
        const operator = findChild(n, c => c.type === '&&' || c.type === '||' || c.text === '&&' || c.text === '||' || c.text === 'and' || c.text === 'or');
        if (operator) {
          complexity++;
        }
      }
      for (const child of getChildren(n)) {
        visit(child);
      }
    };

    visit(node);
    return complexity;
  }

  /**
   * Extract classes from AST
   */
  private extractClasses(rootNode: SyntaxNode): ClassInfo[] {
    const classes: ClassInfo[] = [];
    const classTypes = this.getClassNodeTypes();

    const visit = (node: SyntaxNode): void => {
      if (classTypes.includes(node.type)) {
        const classInfo = this.extractClassInfo(node);
        if (classInfo) {
          classes.push(classInfo);
        }
      }
      for (const child of getChildren(node)) {
        visit(child);
      }
    };

    visit(rootNode);
    return classes;
  }

  /**
   * Get node types that represent classes
   */
  private getClassNodeTypes(): string[] {
    switch (this.language) {
      case 'python':
        return ['class_definition'];
      case 'rust':
        return ['struct_item', 'enum_item', 'trait_item'];
      case 'go':
        return ['type_declaration']; // Go uses structs
      case 'typescript':
      case 'javascript':
        return ['class_declaration', 'class'];
      case 'c':
        return ['struct_specifier', 'enum_specifier', 'union_specifier'];
      case 'cpp':
        return ['class_specifier', 'struct_specifier', 'enum_specifier', 'union_specifier'];
      case 'swift':
        return ['class_declaration', 'struct_declaration', 'enum_declaration', 'protocol_declaration'];
      case 'html':
      case 'css':
        return []; // No classes in HTML/CSS (CSS has selectors, not class definitions)
      default:
        return ['class_declaration', 'class_definition'];
    }
  }

  /**
   * Extract class info
   */
  private extractClassInfo(node: SyntaxNode): ClassInfo | null {
    try {
      const nameNode = node.childForFieldName('name') ||
                       findChild(node, c => c.type === 'identifier' || c.type === 'type_identifier');
      const name = nameNode?.text || '<anonymous>';

      const methods = this.extractMethods(node);
      const properties = this.extractProperties(node);

      const startLine = node.startPosition.row + 1;
      const endLine = node.endPosition.row + 1;

      // Extract extends/implements
      let extendsClass: string | undefined;
      const implementsInterfaces: string[] = [];

      const superclassNode = node.childForFieldName('superclass') ||
                             findChild(node, c => c.type === 'argument_list' || c.type === 'superclass');
      if (superclassNode) {
        extendsClass = superclassNode.text;
      }

      return Object.freeze({
        name,
        methods: Object.freeze(methods),
        properties: Object.freeze(properties),
        startLine,
        endLine,
        length: endLine - startLine + 1,
        isExported: this.isExportedClass(node, name),
        extendsClass,
        implementsInterfaces: Object.freeze(implementsInterfaces),
      });
    } catch {
      return null;
    }
  }

  /**
   * Check if class is exported
   */
  private isExportedClass(node: SyntaxNode, name: string): boolean {
    const parent = node.parent;
    if (parent?.type === 'export_statement') return true;

    if (this.language === 'go') {
      return name.length > 0 && name[0] === name[0].toUpperCase();
    }
    if (this.language === 'python') {
      return !name.startsWith('_');
    }
    if (this.language === 'rust') {
      return someChild(node, c => c.type === 'visibility_modifier' && c.text === 'pub');
    }
    return false;
  }

  /**
   * Extract methods from class
   */
  private extractMethods(classNode: SyntaxNode): MethodInfo[] {
    const methods: MethodInfo[] = [];
    const bodyNode = classNode.childForFieldName('body') ||
                     findChild(classNode, c => c.type === 'class_body' || c.type === 'block' || c.type === 'declaration_list');

    if (!bodyNode) return methods;

    for (const child of getChildren(bodyNode)) {
      if (this.getFunctionNodeTypes().includes(child.type) || child.type === 'method_definition') {
        const funcInfo = this.extractFunctionInfo(child);
        if (funcInfo) {
          methods.push(Object.freeze({
            ...funcInfo,
            visibility: this.getVisibility(child),
            isStatic: this.isStatic(child),
          }));
        }
      }
    }

    return methods;
  }

  /**
   * Get method visibility
   */
  private getVisibility(node: SyntaxNode): 'public' | 'private' | 'protected' {
    const name = this.extractFunctionName(node);

    // Python naming convention
    if (this.language === 'python') {
      if (name.startsWith('__') && !name.endsWith('__')) return 'private';
      if (name.startsWith('_')) return 'protected';
      return 'public';
    }

    // TypeScript/JavaScript modifiers
    if (someChild(node, c => c.text === 'private' || c.type === 'private')) return 'private';
    if (someChild(node, c => c.text === 'protected' || c.type === 'protected')) return 'protected';

    // Rust visibility
    if (this.language === 'rust') {
      const hasPublic = someChild(node, c => c.type === 'visibility_modifier' && c.text === 'pub');
      return hasPublic ? 'public' : 'private';
    }

    return 'public';
  }

  /**
   * Check if method is static
   */
  private isStatic(node: SyntaxNode): boolean {
    return someChild(node, c => c.text === 'static' || c.type === 'static');
  }

  /**
   * Extract properties from class
   */
  private extractProperties(classNode: SyntaxNode): PropertyInfo[] {
    const properties: PropertyInfo[] = [];
    const bodyNode = classNode.childForFieldName('body') ||
                     findChild(classNode, c => c.type === 'class_body' || c.type === 'block' || c.type === 'field_declaration_list');

    if (!bodyNode) return properties;

    const propertyTypes = ['property_definition', 'public_field_definition', 'field_declaration', 'assignment'];

    for (const child of getChildren(bodyNode)) {
      if (propertyTypes.includes(child.type)) {
        const nameNode = child.childForFieldName('name') ||
                         findChild(child, c => c.type === 'identifier' || c.type === 'property_identifier');
        if (nameNode) {
          const typeNode = child.childForFieldName('type') ||
                           findChild(child, c => c.type === 'type_annotation');
          properties.push(Object.freeze({
            name: nameNode.text,
            type: typeNode?.text,
            visibility: 'public' as const,
            isReadonly: someChild(child, c => c.text === 'readonly'),
            isStatic: someChild(child, c => c.text === 'static'),
            hasInitializer: someChild(child, c => c.type === 'initializer' || c.type === '='),
          }));
        }
      }
    }

    return properties;
  }

  /**
   * Extract imports from AST
   */
  private extractImports(rootNode: SyntaxNode): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const importTypes = this.getImportNodeTypes();

    const visit = (node: SyntaxNode): void => {
      if (importTypes.includes(node.type)) {
        const importInfo = this.extractImportInfo(node);
        if (importInfo) {
          imports.push(importInfo);
        }
      }
      for (const child of getChildren(node)) {
        visit(child);
      }
    };

    visit(rootNode);
    return imports;
  }

  /**
   * Get import node types for this language
   */
  private getImportNodeTypes(): string[] {
    switch (this.language) {
      case 'python':
        return ['import_statement', 'import_from_statement'];
      case 'rust':
        return ['use_declaration'];
      case 'go':
        return ['import_declaration', 'import_spec'];
      case 'typescript':
      case 'javascript':
        return ['import_statement', 'import_declaration'];
      case 'c':
      case 'cpp':
        return ['preproc_include']; // #include directives
      case 'swift':
        return ['import_declaration'];
      case 'html':
        return ['script_element', 'style_element']; // <script src="..."> and <style>
      case 'css':
        return ['import_statement', 'at_rule']; // @import rules
      default:
        return ['import_statement', 'import_declaration'];
    }
  }

  /**
   * Extract import info
   */
  private extractImportInfo(node: SyntaxNode): ImportInfo | null {
    try {
      let moduleSpecifier = '';
      const namedImports: string[] = [];
      let defaultImport: string | undefined;
      let namespaceImport: string | undefined;

      // Python: import x or from x import y
      if (this.language === 'python') {
        const moduleNode = node.childForFieldName('module_name') ||
                           findChild(node, c => c.type === 'dotted_name');
        moduleSpecifier = moduleNode?.text || '';

        const nameNode = findChild(node, c => c.type === 'aliased_import' || c.type === 'dotted_name');
        if (nameNode) {
          namedImports.push(nameNode.text);
        }
      }
      // TypeScript/JavaScript
      else if (this.language === 'typescript' || this.language === 'javascript') {
        const sourceNode = node.childForFieldName('source') ||
                           findChild(node, c => c.type === 'string');
        moduleSpecifier = sourceNode?.text?.replace(/['"]/g, '') || '';

        for (const child of getChildren(node)) {
          if (child.type === 'import_clause') {
            for (const clauseChild of getChildren(child)) {
              if (clauseChild.type === 'identifier') {
                defaultImport = clauseChild.text;
              } else if (clauseChild.type === 'named_imports') {
                for (const spec of getChildren(clauseChild)) {
                  if (spec.type === 'import_specifier') {
                    namedImports.push(spec.text);
                  }
                }
              } else if (clauseChild.type === 'namespace_import') {
                namespaceImport = clauseChild.text;
              }
            }
          }
        }
      }
      // Rust: use x::y
      else if (this.language === 'rust') {
        const pathNode = findChild(node, c => c.type === 'use_tree' || c.type === 'scoped_identifier');
        moduleSpecifier = pathNode?.text || '';
      }
      // Go: import "x"
      else if (this.language === 'go') {
        const pathNode = findChild(node, c => c.type === 'interpreted_string_literal');
        moduleSpecifier = pathNode?.text?.replace(/"/g, '') || '';
      }

      const isExternal = !moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/');

      return Object.freeze({
        moduleSpecifier,
        namedImports: Object.freeze(namedImports),
        defaultImport,
        namespaceImport,
        isExternal,
        isTypeOnly: node.text?.includes('type ') || false,
      });
    } catch {
      return null;
    }
  }

  /**
   * Extract exports from AST
   */
  private extractExports(rootNode: SyntaxNode): ExportInfo[] {
    const exports: ExportInfo[] = [];

    // For Python/Rust/Go, exports are determined by naming conventions or visibility modifiers
    // which are handled in isExported* methods

    // For TypeScript/JavaScript, look for export statements
    if (this.language === 'typescript' || this.language === 'javascript') {
      const visit = (node: SyntaxNode): void => {
        if (node.type === 'export_statement' || node.type === 'export_declaration') {
          const declaration = findChild(node, c =>
            c.type === 'function_declaration' ||
            c.type === 'class_declaration' ||
            c.type === 'variable_declaration'
          );
          if (declaration) {
            const nameNode = declaration.childForFieldName('name') ||
                             findChild(declaration, c => c.type === 'identifier');
            if (nameNode) {
              exports.push(Object.freeze({
                name: nameNode.text,
                isDefault: node.text?.includes('export default') || false,
                type: declaration.type.includes('function') ? 'function' as const :
                      declaration.type.includes('class') ? 'class' as const : 'variable' as const,
              }));
            }
          }
        }
        for (const child of getChildren(node)) {
          visit(child);
        }
      };
      visit(rootNode);
    }

    return exports;
  }

  /**
   * Get the raw syntax tree (for advanced usage)
   */
  async getTree(content: string): Promise<Tree | null> {
    const { parser } = await this.ensureInitialized();
    return parser.parse(content);
  }

  dispose(): void {
    // Parser is shared, don't dispose it here
    this.loadedLanguage = null;
  }
}

/**
 * Create a parser for a specific language
 */
export function createTreeSitterParser(language: SupportedLanguage): TreeSitterParser {
  return new TreeSitterParser(language);
}

/**
 * Supported tree-sitter languages (beyond our core 5)
 */
export const TREE_SITTER_LANGUAGES = [
  'bash', 'c', 'cpp', 'c_sharp', 'css', 'dart', 'elixir', 'elm',
  'go', 'html', 'java', 'javascript', 'json', 'kotlin', 'lua',
  'objc', 'ocaml', 'php', 'python', 'ruby', 'rust', 'scala',
  'solidity', 'swift', 'toml', 'tsx', 'typescript', 'vue', 'yaml', 'zig',
] as const;

export type TreeSitterLanguage = typeof TREE_SITTER_LANGUAGES[number];
