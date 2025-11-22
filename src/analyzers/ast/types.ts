/**
 * AST Parser Types
 *
 * Type definitions for AST-based analysis
 */

import type { SourceFile, FunctionDeclaration, ClassDeclaration, MethodDeclaration, ImportDeclaration, ExportDeclaration } from 'ts-morph';

/**
 * Function information extracted from AST
 */
export interface FunctionInfo {
  readonly name: string;
  readonly parameters: ReadonlyArray<ParameterInfo>;
  readonly returnType?: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly complexity: number;
  readonly length: number; // Lines of code
  readonly isAsync: boolean;
  readonly isExported: boolean;
}

/**
 * Parameter information
 */
export interface ParameterInfo {
  readonly name: string;
  readonly type?: string;
  readonly isOptional: boolean;
  readonly hasDefault: boolean;
}

/**
 * Class information extracted from AST
 */
export interface ClassInfo {
  readonly name: string;
  readonly methods: ReadonlyArray<MethodInfo>;
  readonly properties: ReadonlyArray<PropertyInfo>;
  readonly startLine: number;
  readonly endLine: number;
  readonly length: number; // Lines of code
  readonly isExported: boolean;
  readonly extendsClass?: string;
  readonly implementsInterfaces: ReadonlyArray<string>;
}

/**
 * Method information
 */
export interface MethodInfo {
  readonly name: string;
  readonly parameters: ReadonlyArray<ParameterInfo>;
  readonly returnType?: string;
  readonly visibility: 'public' | 'private' | 'protected';
  readonly isStatic: boolean;
  readonly isAsync: boolean;
  readonly complexity: number;
  readonly length: number;
  readonly startLine: number;
  readonly endLine: number;
}

/**
 * Property information
 */
export interface PropertyInfo {
  readonly name: string;
  readonly type?: string;
  readonly visibility: 'public' | 'private' | 'protected';
  readonly isReadonly: boolean;
  readonly isStatic: boolean;
  readonly hasInitializer: boolean;
}

/**
 * Import information
 */
export interface ImportInfo {
  readonly moduleSpecifier: string;
  readonly namedImports: ReadonlyArray<string>;
  readonly defaultImport?: string;
  readonly namespaceImport?: string;
  readonly isExternal: boolean;
  readonly isTypeOnly: boolean;
}

/**
 * Export information
 */
export interface ExportInfo {
  readonly name: string;
  readonly isDefault: boolean;
  readonly type: 'function' | 'class' | 'variable' | 'type';
}

/**
 * File AST information
 */
export interface FileASTInfo {
  readonly filePath: string;
  readonly functions: ReadonlyArray<FunctionInfo>;
  readonly classes: ReadonlyArray<ClassInfo>;
  readonly imports: ReadonlyArray<ImportInfo>;
  readonly exports: ReadonlyArray<ExportInfo>;
  readonly totalLines: number;
}

/**
 * AST node visitor callback
 */
export type NodeVisitor<T> = (node: T) => void | boolean;

/**
 * Re-export ts-morph types for convenience
 */
export type { SourceFile, FunctionDeclaration, ClassDeclaration, MethodDeclaration, ImportDeclaration, ExportDeclaration };
