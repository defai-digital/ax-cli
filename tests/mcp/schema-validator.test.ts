/**
 * Tests for MCP Tool Output Schema Validator
 *
 * These tests verify the schema validation logic using the real AjvJsonSchemaValidator.
 *
 * @module tests/mcp/schema-validator.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ToolOutputValidator,
  getToolOutputValidator,
  resetToolOutputValidator,
} from '../../src/mcp/schema-validator.js';

describe('ToolOutputValidator', () => {
  let validator: ToolOutputValidator;

  beforeEach(() => {
    resetToolOutputValidator();
    validator = new ToolOutputValidator();
  });

  describe('validate', () => {
    describe('no schema cases', () => {
      it('should return no-schema when schema is undefined', () => {
        const result = validator.validate(undefined, { foo: 'bar' });
        expect(result.status).toBe('no-schema');
        expect(result.errors).toBeUndefined();
      });

      it('should return no-schema when schema is null', () => {
        const result = validator.validate(null, { foo: 'bar' });
        expect(result.status).toBe('no-schema');
      });
    });

    describe('empty schema cases', () => {
      it('should return valid for empty object schema (matches anything)', () => {
        const result = validator.validate({}, { any: 'value' });
        expect(result.status).toBe('valid');
        expect(result.schema).toEqual({});
      });

      it('should return valid for empty schema with string output', () => {
        const result = validator.validate({}, 'any string');
        expect(result.status).toBe('valid');
      });

      it('should return valid for empty schema with null output', () => {
        const result = validator.validate({}, null);
        expect(result.status).toBe('valid');
      });
    });

    describe('object schema validation', () => {
      const objectSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      };

      it('should validate valid object against schema', () => {
        const result = validator.validate(objectSchema, { name: 'John', age: 30 });
        expect(result.status).toBe('valid');
        expect(result.schema).toEqual(objectSchema);
      });

      it('should validate object with only required fields', () => {
        const result = validator.validate(objectSchema, { name: 'John' });
        expect(result.status).toBe('valid');
      });

      it('should return invalid when required field is missing', () => {
        const result = validator.validate(objectSchema, { age: 30 });
        expect(result.status).toBe('invalid');
        expect(result.errors).toBeDefined();
        expect(result.errors!.length).toBeGreaterThan(0);
      });

      it('should return invalid when field type is wrong', () => {
        const result = validator.validate(objectSchema, { name: 123 });
        expect(result.status).toBe('invalid');
        expect(result.errors).toBeDefined();
      });
    });

    describe('array schema validation', () => {
      const arraySchema = {
        type: 'array',
        items: { type: 'string' },
      };

      it('should validate valid array against schema', () => {
        const result = validator.validate(arraySchema, ['a', 'b', 'c']);
        expect(result.status).toBe('valid');
      });

      it('should validate empty array', () => {
        const result = validator.validate(arraySchema, []);
        expect(result.status).toBe('valid');
      });

      it('should return invalid for wrong item types', () => {
        const result = validator.validate(arraySchema, [1, 2, 3]);
        expect(result.status).toBe('invalid');
      });

      it('should return invalid for non-array', () => {
        const result = validator.validate(arraySchema, 'not an array');
        expect(result.status).toBe('invalid');
      });
    });

    describe('primitive schema validation', () => {
      it('should validate string against string schema', () => {
        const result = validator.validate({ type: 'string' }, 'hello');
        expect(result.status).toBe('valid');
      });

      it('should validate number against number schema', () => {
        const result = validator.validate({ type: 'number' }, 42);
        expect(result.status).toBe('valid');
      });

      it('should validate boolean against boolean schema', () => {
        const result = validator.validate({ type: 'boolean' }, true);
        expect(result.status).toBe('valid');
      });

      it('should return invalid for type mismatch', () => {
        const result = validator.validate({ type: 'string' }, 123);
        expect(result.status).toBe('invalid');
      });
    });
  });

  describe('validateContent', () => {
    describe('no schema cases', () => {
      it('should return no-schema when schema is undefined', () => {
        const content = [{ type: 'text', text: '{"foo": "bar"}' }];
        const result = validator.validateContent(undefined, content);
        expect(result.status).toBe('no-schema');
      });

      it('should return no-schema when schema is null', () => {
        const content = [{ type: 'text', text: '{"foo": "bar"}' }];
        const result = validator.validateContent(null, content);
        expect(result.status).toBe('no-schema');
      });
    });

    describe('empty content', () => {
      it('should return valid for empty content array', () => {
        const schema = { type: 'object' };
        const result = validator.validateContent(schema, []);
        expect(result.status).toBe('valid');
      });

      it('should return valid when no text content items', () => {
        const schema = { type: 'object' };
        const content = [{ type: 'image', data: 'base64...' }];
        const result = validator.validateContent(schema, content);
        expect(result.status).toBe('valid');
      });

      it('should skip items without text property', () => {
        const schema = { type: 'string' };
        const content = [{ type: 'text' }]; // No text property
        const result = validator.validateContent(schema, content);
        expect(result.status).toBe('valid');
      });
    });

    describe('single text content item', () => {
      it('should parse and validate JSON content', () => {
        const schema = {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        };
        const content = [{ type: 'text', text: '{"name": "John"}' }];
        const result = validator.validateContent(schema, content);
        expect(result.status).toBe('valid');
      });

      it('should return invalid for JSON that does not match schema', () => {
        const schema = {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        };
        const content = [{ type: 'text', text: '{"age": 30}' }];
        const result = validator.validateContent(schema, content);
        expect(result.status).toBe('invalid');
      });

      it('should validate non-JSON text as string', () => {
        const schema = { type: 'string' };
        const content = [{ type: 'text', text: 'Hello World' }];
        const result = validator.validateContent(schema, content);
        expect(result.status).toBe('valid');
      });

      it('should return invalid when non-JSON text does not match schema', () => {
        const schema = { type: 'number' };
        const content = [{ type: 'text', text: 'Hello World' }];
        const result = validator.validateContent(schema, content);
        expect(result.status).toBe('invalid');
      });
    });

    describe('multiple text content items - concatenation', () => {
      it('should concatenate chunked JSON from streaming', () => {
        const schema = {
          type: 'object',
          properties: { complete: { type: 'boolean' } },
        };
        // Simulates streaming chunks: {"complete":true}
        const content = [
          { type: 'text', text: '{"com' },
          { type: 'text', text: 'plete":' },
          { type: 'text', text: 'true}' },
        ];
        const result = validator.validateContent(schema, content);
        expect(result.status).toBe('valid');
      });

      it('should handle chunked array JSON', () => {
        const schema = {
          type: 'array',
          items: { type: 'number' },
        };
        const content = [
          { type: 'text', text: '[1,' },
          { type: 'text', text: '2,' },
          { type: 'text', text: '3]' },
        ];
        const result = validator.validateContent(schema, content);
        expect(result.status).toBe('valid');
      });
    });

    describe('multiple text content items - non-JSON', () => {
      it('should concatenate non-JSON text and validate as string', () => {
        const schema = { type: 'string' };
        const content = [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'World!' },
        ];
        const result = validator.validateContent(schema, content);
        expect(result.status).toBe('valid');
      });

      it('should handle mixed content that cannot be parsed as JSON', () => {
        const schema = { type: 'string' };
        const content = [
          { type: 'text', text: 'Line 1\n' },
          { type: 'text', text: 'Line 2\n' },
        ];
        const result = validator.validateContent(schema, content);
        expect(result.status).toBe('valid');
      });
    });

    describe('mixed content types', () => {
      it('should only process text type items', () => {
        const schema = { type: 'string' };
        const content = [
          { type: 'image', data: 'base64...' },
          { type: 'text', text: 'Hello' },
          { type: 'resource', uri: 'file://...' },
        ];
        const result = validator.validateContent(schema, content);
        expect(result.status).toBe('valid');
      });
    });
  });

  describe('singleton management', () => {
    it('should return the same instance from getToolOutputValidator', () => {
      const instance1 = getToolOutputValidator();
      const instance2 = getToolOutputValidator();
      expect(instance1).toBe(instance2);
    });

    it('should return new instance after resetToolOutputValidator', () => {
      const instance1 = getToolOutputValidator();
      resetToolOutputValidator();
      const instance2 = getToolOutputValidator();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('complex schema scenarios', () => {
    it('should validate nested objects', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              address: {
                type: 'object',
                properties: {
                  city: { type: 'string' },
                  zip: { type: 'string' },
                },
              },
            },
          },
        },
      };
      const output = {
        user: {
          name: 'John',
          address: {
            city: 'New York',
            zip: '10001',
          },
        },
      };
      const result = validator.validate(schema, output);
      expect(result.status).toBe('valid');
    });
  });
});
