/**
 * AST Node Helper Utilities
 *
 * Type guards and utility functions for working with AST nodes
 */

import type { FunctionInfo, ClassInfo, MethodInfo, ImportInfo } from './types.js';

/**
 * Check if function is a high-complexity function
 */
export function isHighComplexity(func: FunctionInfo, threshold: number = 10): boolean {
  return func.complexity > threshold;
}

/**
 * Check if function is a long function
 */
export function isLongFunction(func: FunctionInfo, threshold: number = 50): boolean {
  return func.length > threshold;
}

/**
 * Check if class is a large class (God Object indicator)
 */
export function isLargeClass(cls: ClassInfo, methodThreshold: number = 20, lineThreshold: number = 300): boolean {
  return cls.methods.length > methodThreshold || cls.length > lineThreshold;
}

/**
 * Check if method has too many parameters
 */
export function hasTooManyParameters(method: MethodInfo | FunctionInfo, threshold: number = 5): boolean {
  return method.parameters.length > threshold;
}

/**
 * Get all external imports (from node_modules)
 */
export function getExternalImports(imports: readonly ImportInfo[]): ImportInfo[] {
  return imports.filter(imp => imp.isExternal);
}

/**
 * Get all internal imports (relative paths)
 */
export function getInternalImports(imports: readonly ImportInfo[]): ImportInfo[] {
  return imports.filter(imp => !imp.isExternal);
}

/**
 * Calculate class coupling (number of external dependencies)
 */
export function calculateClassCoupling(imports: readonly ImportInfo[]): number {
  const external = getExternalImports(imports);
  return external.length;
}

/**
 * Find all async functions in a list
 */
export function getAsyncFunctions(functions: readonly FunctionInfo[]): FunctionInfo[] {
  return functions.filter(f => f.isAsync);
}

/**
 * Find all exported functions
 */
export function getExportedFunctions(functions: readonly FunctionInfo[]): FunctionInfo[] {
  return functions.filter(f => f.isExported);
}

/**
 * Get average complexity of functions
 */
export function getAverageComplexity(functions: readonly FunctionInfo[]): number {
  if (functions.length === 0) return 0;
  const total = functions.reduce((sum, f) => sum + f.complexity, 0);
  return total / functions.length;
}

/**
 * Get average function length
 */
export function getAverageFunctionLength(functions: readonly FunctionInfo[]): number {
  if (functions.length === 0) return 0;
  const total = functions.reduce((sum, f) => sum + f.length, 0);
  return total / functions.length;
}

/**
 * Find all private methods in a class
 */
export function getPrivateMethods(cls: ClassInfo): MethodInfo[] {
  return cls.methods.filter(m => m.visibility === 'private');
}

/**
 * Find all public methods in a class
 */
export function getPublicMethods(cls: ClassInfo): MethodInfo[] {
  return cls.methods.filter(m => m.visibility === 'public');
}

/**
 * Find all static methods in a class
 */
export function getStaticMethods(cls: ClassInfo): MethodInfo[] {
  return cls.methods.filter(m => m.isStatic);
}

/**
 * Calculate method density (methods per line)
 */
export function calculateMethodDensity(cls: ClassInfo): number {
  if (cls.length === 0) return 0;
  return cls.methods.length / cls.length;
}

/**
 * Check if import is a type-only import
 */
export function isTypeOnlyImport(imp: ImportInfo): boolean {
  return imp.namedImports.every(name => name.startsWith('type ') || name.includes('Type'));
}

/**
 * Group imports by external/internal
 */
export function groupImportsByType(imports: readonly ImportInfo[]): {
  external: ImportInfo[];
  internal: ImportInfo[];
} {
  return {
    external: getExternalImports(imports),
    internal: getInternalImports(imports),
  };
}

/**
 * Calculate cognitive complexity score for a file
 */
export function calculateFileCognitiveComplexity(
  functions: readonly FunctionInfo[],
  classes: readonly ClassInfo[]
): number {
  const funcComplexity = functions.reduce((sum, f) => sum + f.complexity, 0);
  const methodComplexity = classes.reduce(
    (sum, c) => sum + c.methods.reduce((mSum, m) => mSum + m.complexity, 0),
    0
  );
  return funcComplexity + methodComplexity;
}
