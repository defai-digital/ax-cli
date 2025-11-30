/**
 * AST Parser
 *
 * Provides TypeScript/JavaScript AST parsing using ts-morph
 */

import { Project, SourceFile, ScriptTarget, ModuleKind, SyntaxKind } from 'ts-morph';
import type { FileASTInfo, FunctionInfo, ClassInfo, ImportInfo, ExportInfo, ParameterInfo, MethodInfo, PropertyInfo } from './types.js';

export class ASTParser {
  private project: Project;

  constructor() {
    this.project = new Project({
      compilerOptions: {
        target: ScriptTarget.Latest,
        module: ModuleKind.CommonJS,
        allowJs: true,
        skipLibCheck: true,
      },
      skipAddingFilesFromTsConfig: true,
    });
  }

  /**
   * Parse a TypeScript/JavaScript file
   */
  parseFile(filePath: string): FileASTInfo {
    // Check if file was already added (by getSourceFile for semantic analysis)
    const existingFile = this.project.getSourceFile(filePath);
    const sourceFile = existingFile || this.project.addSourceFileAtPath(filePath);
    const shouldRemove = !existingFile; // Only remove if we just added it

    try {
      const functions = this.extractFunctions(sourceFile);
      const classes = this.extractClasses(sourceFile);
      const imports = this.extractImports(sourceFile);
      const exports = this.extractExports(sourceFile);

      return Object.freeze({
        filePath,
        functions: Object.freeze(functions),
        classes: Object.freeze(classes),
        imports: Object.freeze(imports),
        exports: Object.freeze(exports),
        totalLines: sourceFile.getEndLineNumber(),
      });
    } finally {
      // Clean up to prevent memory leaks, but preserve files needed for semantic analysis
      if (shouldRemove) {
        this.project.removeSourceFile(sourceFile);
      }
    }
  }

  /**
   * Parse file content directly
   */
  parseContent(content: string, filePath: string = 'temp.ts'): FileASTInfo {
    const sourceFile = this.project.createSourceFile(filePath, content, { overwrite: true });

    try {
      const functions = this.extractFunctions(sourceFile);
      const classes = this.extractClasses(sourceFile);
      const imports = this.extractImports(sourceFile);
      const exports = this.extractExports(sourceFile);

      return Object.freeze({
        filePath,
        functions: Object.freeze(functions),
        classes: Object.freeze(classes),
        imports: Object.freeze(imports),
        exports: Object.freeze(exports),
        totalLines: sourceFile.getEndLineNumber(),
      });
    } finally {
      this.project.removeSourceFile(sourceFile);
    }
  }

  /**
   * Extract all functions from source file
   */
  private extractFunctions(sourceFile: SourceFile): FunctionInfo[] {
    const functions: FunctionInfo[] = [];

    sourceFile.getFunctions().forEach(func => {
      const name = func.getName() || '<anonymous>';
      const parameters = this.extractParameters(func);
      const startLine = func.getStartLineNumber();
      const endLine = func.getEndLineNumber();

      functions.push(
        Object.freeze({
          name,
          parameters: Object.freeze(parameters),
          returnType: func.getReturnType().getText(),
          startLine,
          endLine,
          complexity: this.calculateCyclomaticComplexity(func.getBody()?.getText() || ''),
          length: endLine - startLine + 1,
          isAsync: func.isAsync(),
          isExported: func.isExported(),
        })
      );
    });

    return functions;
  }

  /**
   * Extract all classes from source file
   */
  private extractClasses(sourceFile: SourceFile): ClassInfo[] {
    const classes: ClassInfo[] = [];

    sourceFile.getClasses().forEach(cls => {
      const name = cls.getName() || '<anonymous>';
      const methods = this.extractMethods(cls);
      const properties = this.extractProperties(cls);
      const startLine = cls.getStartLineNumber();
      const endLine = cls.getEndLineNumber();

      classes.push(
        Object.freeze({
          name,
          methods: Object.freeze(methods),
          properties: Object.freeze(properties),
          startLine,
          endLine,
          length: endLine - startLine + 1,
          isExported: cls.isExported(),
          extendsClass: cls.getExtends()?.getText(),
          implementsInterfaces: Object.freeze(cls.getImplements().map(i => i.getText())),
        })
      );
    });

    return classes;
  }

  /**
   * Extract methods from a class
   */
  private extractMethods(cls: any): MethodInfo[] {
    const methods: MethodInfo[] = [];

    cls.getMethods().forEach((method: any) => {
      const name = method.getName();
      const parameters = this.extractParameters(method);
      const startLine = method.getStartLineNumber();
      const endLine = method.getEndLineNumber();

      // Determine visibility
      let visibility: 'public' | 'private' | 'protected' = 'public';
      if (method.hasModifier(SyntaxKind.PrivateKeyword)) {
        visibility = 'private';
      } else if (method.hasModifier(SyntaxKind.ProtectedKeyword)) {
        visibility = 'protected';
      }

      methods.push(
        Object.freeze({
          name,
          parameters: Object.freeze(parameters),
          returnType: method.getReturnType().getText(),
          visibility,
          isStatic: method.isStatic(),
          isAsync: method.isAsync(),
          complexity: this.calculateCyclomaticComplexity(method.getBody()?.getText() || ''),
          length: endLine - startLine + 1,
          startLine,
          endLine,
        })
      );
    });

    return methods;
  }

  /**
   * Extract properties from a class
   */
  private extractProperties(cls: any): PropertyInfo[] {
    const properties: PropertyInfo[] = [];

    cls.getProperties().forEach((prop: any) => {
      const name = prop.getName();

      // Determine visibility
      let visibility: 'public' | 'private' | 'protected' = 'public';
      if (prop.hasModifier(SyntaxKind.PrivateKeyword)) {
        visibility = 'private';
      } else if (prop.hasModifier(SyntaxKind.ProtectedKeyword)) {
        visibility = 'protected';
      }

      properties.push(
        Object.freeze({
          name,
          type: prop.getType().getText(),
          visibility,
          isReadonly: prop.isReadonly(),
          isStatic: prop.isStatic(),
          hasInitializer: prop.hasInitializer(),
        })
      );
    });

    return properties;
  }

  /**
   * Extract parameters from a function or method
   */
  private extractParameters(func: any): ParameterInfo[] {
    const parameters: ParameterInfo[] = [];

    func.getParameters().forEach((param: any) => {
      parameters.push(
        Object.freeze({
          name: param.getName(),
          type: param.getType().getText(),
          isOptional: param.isOptional(),
          hasDefault: param.hasInitializer(),
        })
      );
    });

    return parameters;
  }

  /**
   * Extract imports from source file
   */
  private extractImports(sourceFile: SourceFile): ImportInfo[] {
    const imports: ImportInfo[] = [];

    sourceFile.getImportDeclarations().forEach(imp => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      const namedImports = imp.getNamedImports().map(n => n.getName());
      const defaultImport = imp.getDefaultImport()?.getText();
      const namespaceImport = imp.getNamespaceImport()?.getText();

      // Determine if external (starts with letter, not './' or '../')
      const isExternal = !moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/');

      // Check if type-only import
      const isTypeOnly = imp.isTypeOnly();

      imports.push(
        Object.freeze({
          moduleSpecifier,
          namedImports: Object.freeze(namedImports),
          defaultImport,
          namespaceImport,
          isExternal,
          isTypeOnly,
        })
      );
    });

    return imports;
  }

  /**
   * Extract exports from source file
   */
  private extractExports(sourceFile: SourceFile): ExportInfo[] {
    const exports: ExportInfo[] = [];

    // Named exports
    sourceFile.getExportDeclarations().forEach(exp => {
      exp.getNamedExports().forEach(named => {
        exports.push(
          Object.freeze({
            name: named.getName(),
            isDefault: false,
            type: 'variable' as const,
          })
        );
      });
    });

    // Exported functions
    sourceFile.getFunctions().forEach(func => {
      if (func.isExported()) {
        exports.push(
          Object.freeze({
            name: func.getName() || '<anonymous>',
            isDefault: func.isDefaultExport(),
            type: 'function' as const,
          })
        );
      }
    });

    // Exported classes
    sourceFile.getClasses().forEach(cls => {
      if (cls.isExported()) {
        exports.push(
          Object.freeze({
            name: cls.getName() || '<anonymous>',
            isDefault: cls.isDefaultExport(),
            type: 'class' as const,
          })
        );
      }
    });

    return exports;
  }

  /**
   * Calculate cyclomatic complexity (simplified)
   */
  private calculateCyclomaticComplexity(code: string): number {
    let complexity = 1;

    // Count decision points
    const patterns = [
      /\bif\b/g,
      /\belse\s+if\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /&&/g,
      /\|\|/g,
      /\?/g,
    ];

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Get raw source file for advanced operations
   * Note: This keeps the file in the project for semantic analysis (findReferences, etc.)
   */
  getSourceFile(filePath: string): SourceFile {
    // Check if file is already in project
    const existing = this.project.getSourceFile(filePath);
    if (existing) {
      return existing;
    }
    // Add new file and keep it in project for semantic operations
    return this.project.addSourceFileAtPath(filePath);
  }

  /**
   * Clear project cache
   */
  clear(): void {
    const sourceFiles = this.project.getSourceFiles();
    for (const sourceFile of sourceFiles) {
      this.project.removeSourceFile(sourceFile);
    }
  }
}
