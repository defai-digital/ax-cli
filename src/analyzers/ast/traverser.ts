/**
 * AST Traverser
 *
 * Utilities for traversing and visiting AST nodes
 */

import type { FileASTInfo, FunctionInfo, ClassInfo, MethodInfo, NodeVisitor } from './types.js';

/**
 * Visit all functions in a file AST
 */
export function visitFunctions(ast: FileASTInfo, visitor: NodeVisitor<FunctionInfo>): void {
  for (const func of ast.functions) {
    const result = visitor(func);
    if (result === false) break; // Early exit if visitor returns false
  }
}

/**
 * Visit all classes in a file AST
 */
export function visitClasses(ast: FileASTInfo, visitor: NodeVisitor<ClassInfo>): void {
  for (const cls of ast.classes) {
    const result = visitor(cls);
    if (result === false) break;
  }
}

/**
 * Visit all methods in all classes
 */
export function visitMethods(ast: FileASTInfo, visitor: NodeVisitor<MethodInfo>): void {
  for (const cls of ast.classes) {
    for (const method of cls.methods) {
      const result = visitor(method);
      if (result === false) return; // Early exit
    }
  }
}

/**
 * Find first function matching predicate
 */
export function findFunction(
  ast: FileASTInfo,
  predicate: (func: FunctionInfo) => boolean
): FunctionInfo | undefined {
  return ast.functions.find(predicate);
}

/**
 * Find all functions matching predicate
 */
export function findFunctions(
  ast: FileASTInfo,
  predicate: (func: FunctionInfo) => boolean
): FunctionInfo[] {
  return ast.functions.filter(predicate);
}

/**
 * Find first class matching predicate
 */
export function findClass(
  ast: FileASTInfo,
  predicate: (cls: ClassInfo) => boolean
): ClassInfo | undefined {
  return ast.classes.find(predicate);
}

/**
 * Find all classes matching predicate
 */
export function findClasses(
  ast: FileASTInfo,
  predicate: (cls: ClassInfo) => boolean
): ClassInfo[] {
  return ast.classes.filter(predicate);
}

/**
 * Find method by name in a specific class
 */
export function findMethodInClass(cls: ClassInfo, methodName: string): MethodInfo | undefined {
  return cls.methods.find(m => m.name === methodName);
}

/**
 * Collect all items matching a condition
 */
export function collect<T>(
  items: readonly T[],
  predicate: (item: T) => boolean
): T[] {
  return items.filter(predicate);
}

/**
 * Map over all functions and classes
 */
export function mapAllCallables<T>(
  ast: FileASTInfo,
  funcMapper: (func: FunctionInfo) => T,
  methodMapper: (method: MethodInfo, className: string) => T
): T[] {
  const results: T[] = [];

  // Map functions
  for (const func of ast.functions) {
    results.push(funcMapper(func));
  }

  // Map methods
  for (const cls of ast.classes) {
    for (const method of cls.methods) {
      results.push(methodMapper(method, cls.name));
    }
  }

  return results;
}

/**
 * Count total callables (functions + methods)
 */
export function countCallables(ast: FileASTInfo): number {
  const functionCount = ast.functions.length;
  const methodCount = ast.classes.reduce((sum, cls) => sum + cls.methods.length, 0);
  return functionCount + methodCount;
}

/**
 * Get all callable names (functions and methods)
 */
export function getAllCallableNames(ast: FileASTInfo): string[] {
  const names: string[] = [];

  for (const func of ast.functions) {
    names.push(func.name);
  }

  for (const cls of ast.classes) {
    for (const method of cls.methods) {
      names.push(`${cls.name}.${method.name}`);
    }
  }

  return names;
}

/**
 * Check if file has any high-complexity functions/methods
 */
export function hasHighComplexity(ast: FileASTInfo, threshold: number = 10): boolean {
  // Check functions
  for (const func of ast.functions) {
    if (func.complexity > threshold) return true;
  }

  // Check methods
  for (const cls of ast.classes) {
    for (const method of cls.methods) {
      if (method.complexity > threshold) return true;
    }
  }

  return false;
}

/**
 * Get complexity statistics
 */
export function getComplexityStats(ast: FileASTInfo): {
  min: number;
  max: number;
  average: number;
  total: number;
} {
  const complexities: number[] = [];

  // Collect function complexities
  for (const func of ast.functions) {
    complexities.push(func.complexity);
  }

  // Collect method complexities
  for (const cls of ast.classes) {
    for (const method of cls.methods) {
      complexities.push(method.complexity);
    }
  }

  if (complexities.length === 0) {
    return { min: 0, max: 0, average: 0, total: 0 };
  }

  const total = complexities.reduce((sum, c) => sum + c, 0);
  const min = Math.min(...complexities);
  const max = Math.max(...complexities);
  const average = total / complexities.length;

  return { min, max, average, total };
}
