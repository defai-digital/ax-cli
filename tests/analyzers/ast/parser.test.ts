/**
 * Tests for ASTParser
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ASTParser } from '../../../src/analyzers/ast/parser.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('ASTParser', () => {
  let parser: ASTParser;
  let tempDir: string;

  beforeAll(async () => {
    parser = new ASTParser();
    tempDir = path.join(process.cwd(), 'automatosx', 'tmp', 'test-ast-parser');

    // Create temp directory
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch {
      // Directory might already exist
    }
  });

  afterAll(async () => {
    // Clean up temp files
    try {
      const files = await fs.readdir(tempDir);
      for (const file of files) {
        await fs.unlink(path.join(tempDir, file));
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should create instance', () => {
      expect(parser).toBeDefined();
      expect(parser).toBeInstanceOf(ASTParser);
    });
  });

  describe('parseContent', () => {
    it('should parse simple function', () => {
      const code = `
        function greet(name: string): string {
          return \`Hello, \${name}\`;
        }
      `;

      const result = parser.parseContent(code, 'test.ts');

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('greet');
      expect(result.functions[0].parameters).toHaveLength(1);
      expect(result.functions[0].parameters[0].name).toBe('name');
      expect(result.functions[0].isAsync).toBe(false);
      expect(result.functions[0].isExported).toBe(false);
    });

    it('should parse async function', () => {
      const code = `
        async function fetchData(): Promise<void> {
          await fetch('/api');
        }
      `;

      const result = parser.parseContent(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].isAsync).toBe(true);
    });

    it('should parse exported function', () => {
      const code = `
        export function calculate(a: number, b: number): number {
          return a + b;
        }
      `;

      const result = parser.parseContent(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].isExported).toBe(true);
      expect(result.functions[0].parameters).toHaveLength(2);
    });

    it('should parse class with methods', () => {
      const code = `
        class Calculator {
          private value: number = 0;

          public add(n: number): void {
            this.value += n;
          }

          private reset(): void {
            this.value = 0;
          }
        }
      `;

      const result = parser.parseContent(code);

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe('Calculator');
      expect(result.classes[0].methods).toHaveLength(2);
      expect(result.classes[0].properties).toHaveLength(1);
      expect(result.classes[0].properties[0].name).toBe('value');
    });

    it('should detect method visibility', () => {
      const code = `
        class Example {
          public publicMethod(): void {}
          private privateMethod(): void {}
          protected protectedMethod(): void {}
        }
      `;

      const result = parser.parseContent(code);

      expect(result.classes[0].methods).toHaveLength(3);

      const publicMethod = result.classes[0].methods.find(m => m.name === 'publicMethod');
      const privateMethod = result.classes[0].methods.find(m => m.name === 'privateMethod');
      const protectedMethod = result.classes[0].methods.find(m => m.name === 'protectedMethod');

      expect(publicMethod?.visibility).toBe('public');
      expect(privateMethod?.visibility).toBe('private');
      expect(protectedMethod?.visibility).toBe('protected');
    });

    it('should detect static methods', () => {
      const code = `
        class Utils {
          static format(text: string): string {
            return text.toUpperCase();
          }
        }
      `;

      const result = parser.parseContent(code);

      expect(result.classes[0].methods[0].isStatic).toBe(true);
    });

    it('should parse imports', () => {
      const code = `
        import { readFile } from 'fs';
        import path from 'path';
        import type { SomeType } from './types';
        import * as utils from './utils';
      `;

      const result = parser.parseContent(code);

      expect(result.imports).toHaveLength(4);

      const fsImport = result.imports.find(i => i.moduleSpecifier === 'fs');
      const pathImport = result.imports.find(i => i.moduleSpecifier === 'path');
      const typeImport = result.imports.find(i => i.moduleSpecifier === './types');
      const namespaceImport = result.imports.find(i => i.moduleSpecifier === './utils');

      expect(fsImport?.namedImports).toContain('readFile');
      expect(fsImport?.isExternal).toBe(true);
      expect(pathImport?.defaultImport).toBe('path');
      expect(pathImport?.isExternal).toBe(true);
      expect(typeImport?.isExternal).toBe(false);
      expect(namespaceImport?.namespaceImport).toBe('utils');
    });

    it('should parse exports', () => {
      const code = `
        export function helper(): void {}
        export class MyClass {}
        export { something };
      `;

      const result = parser.parseContent(code);

      expect(result.exports.length).toBeGreaterThanOrEqual(2);

      const funcExport = result.exports.find(e => e.name === 'helper');
      const classExport = result.exports.find(e => e.name === 'MyClass');

      expect(funcExport?.type).toBe('function');
      expect(classExport?.type).toBe('class');
    });

    it('should calculate cyclomatic complexity', () => {
      const code = `
        function complex(n: number): string {
          if (n < 0) {
            return 'negative';
          } else if (n === 0) {
            return 'zero';
          } else if (n > 100) {
            return 'large';
          }

          for (let i = 0; i < n; i++) {
            if (i % 2 === 0) {
              console.log(i);
            }
          }

          return 'positive';
        }
      `;

      const result = parser.parseContent(code);

      expect(result.functions[0].complexity).toBeGreaterThan(1);
    });

    it('should track line numbers', () => {
      const code = `function start() {
  console.log('line 1');
  console.log('line 2');
  console.log('line 3');
}`;

      const result = parser.parseContent(code);

      expect(result.functions[0].startLine).toBe(1);
      expect(result.functions[0].endLine).toBeGreaterThan(1);
      expect(result.functions[0].length).toBeGreaterThan(1);
    });

    it('should handle optional parameters', () => {
      const code = `
        function test(required: string, optional?: number): void {}
      `;

      const result = parser.parseContent(code);

      expect(result.functions[0].parameters).toHaveLength(2);
      expect(result.functions[0].parameters[0].isOptional).toBe(false);
      expect(result.functions[0].parameters[1].isOptional).toBe(true);
    });

    it('should handle default parameters', () => {
      const code = `
        function test(name: string = 'default'): void {}
      `;

      const result = parser.parseContent(code);

      expect(result.functions[0].parameters[0].hasDefault).toBe(true);
    });

    it('should detect class inheritance', () => {
      const code = `
        class Parent {}
        class Child extends Parent {}
      `;

      const result = parser.parseContent(code);

      const child = result.classes.find(c => c.name === 'Child');
      expect(child?.extendsClass).toBe('Parent');
    });

    it('should detect interface implementation', () => {
      const code = `
        interface IService {}
        class Service implements IService {}
      `;

      const result = parser.parseContent(code);

      const service = result.classes.find(c => c.name === 'Service');
      expect(service?.implementsInterfaces).toContain('IService');
    });

    it('should handle readonly properties', () => {
      const code = `
        class Example {
          readonly id: string = 'test';
        }
      `;

      const result = parser.parseContent(code);

      expect(result.classes[0].properties[0].isReadonly).toBe(true);
    });

    it('should handle static properties', () => {
      const code = `
        class Example {
          static instance: Example;
        }
      `;

      const result = parser.parseContent(code);

      expect(result.classes[0].properties[0].isStatic).toBe(true);
    });
  });

  describe('parseFile', () => {
    it('should parse file from disk', async () => {
      const testFile = path.join(tempDir, 'parse-test.ts');
      const code = `
        export function calculate(a: number, b: number): number {
          return a + b;
        }
      `;
      await fs.writeFile(testFile, code);

      const result = parser.parseFile(testFile);

      expect(result.filePath).toBe(testFile);
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('calculate');
    });

    it('should handle empty file', async () => {
      const testFile = path.join(tempDir, 'empty.ts');
      await fs.writeFile(testFile, '');

      const result = parser.parseFile(testFile);

      expect(result.functions).toHaveLength(0);
      expect(result.classes).toHaveLength(0);
      expect(result.imports).toHaveLength(0);
      expect(result.exports).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should clear project cache', () => {
      parser.parseContent('function test() {}');
      parser.parseContent('function test2() {}');

      expect(() => parser.clear()).not.toThrow();
    });
  });
});
