/**
 * Tool Argument Extraction Utilities
 *
 * Centralized helpers for extracting and validating tool call arguments.
 * Reduces duplication of type checking patterns across tool implementations.
 *
 * @packageDocumentation
 */

import { isString, isNumber, isBoolean, isArray, isObject } from './type-guards.js';

/**
 * Result of argument extraction with validation
 */
export type ArgResult<T> =
  | { success: true; value: T }
  | { success: false; error: string };

/**
 * Options for argument extraction
 */
export interface ArgOptions {
  /** Whether the argument is required (default: true) */
  required?: boolean;
  /** Default value if not provided (makes required=false) */
  defaultValue?: unknown;
}

/**
 * Tool argument extractor for consistent argument handling
 */
export class ToolArgExtractor {
  constructor(
    private readonly args: Record<string, unknown>,
    private readonly toolName: string = 'Tool'
  ) {}

  /**
   * Get a string argument
   */
  getString(key: string, options: ArgOptions = {}): ArgResult<string> {
    const { required = true, defaultValue } = options;
    const value = this.args[key];

    if (value === undefined || value === null) {
      if (defaultValue !== undefined) {
        return { success: true, value: String(defaultValue) };
      }
      if (required) {
        return { success: false, error: `${this.toolName} requires '${key}' argument` };
      }
      return { success: true, value: '' };
    }

    if (!isString(value)) {
      return {
        success: false,
        error: `${this.toolName} argument '${key}' must be a string, got ${typeof value}`,
      };
    }

    return { success: true, value };
  }

  /**
   * Get a number argument
   */
  getNumber(key: string, options: ArgOptions = {}): ArgResult<number | undefined> {
    const { required = false, defaultValue } = options;
    const value = this.args[key];

    if (value === undefined || value === null) {
      if (defaultValue !== undefined) {
        return { success: true, value: Number(defaultValue) };
      }
      if (required) {
        return { success: false, error: `${this.toolName} requires '${key}' argument` };
      }
      return { success: true, value: undefined };
    }

    if (!isNumber(value)) {
      return {
        success: false,
        error: `${this.toolName} argument '${key}' must be a number, got ${typeof value}`,
      };
    }

    return { success: true, value };
  }

  /**
   * Get a boolean argument
   */
  getBoolean(key: string, options: ArgOptions = {}): ArgResult<boolean | undefined> {
    const { required = false, defaultValue } = options;
    const value = this.args[key];

    if (value === undefined || value === null) {
      if (defaultValue !== undefined) {
        return { success: true, value: Boolean(defaultValue) };
      }
      if (required) {
        return { success: false, error: `${this.toolName} requires '${key}' argument` };
      }
      return { success: true, value: undefined };
    }

    if (!isBoolean(value)) {
      return {
        success: false,
        error: `${this.toolName} argument '${key}' must be a boolean, got ${typeof value}`,
      };
    }

    return { success: true, value };
  }

  /**
   * Get an array argument with optional element type filter
   */
  getArray<T>(
    key: string,
    elementFilter?: (item: unknown) => item is T,
    options: ArgOptions = {}
  ): ArgResult<T[] | undefined> {
    const { required = false, defaultValue } = options;
    const value = this.args[key];

    if (value === undefined || value === null) {
      if (defaultValue !== undefined && isArray(defaultValue)) {
        return { success: true, value: defaultValue as T[] };
      }
      if (required) {
        return { success: false, error: `${this.toolName} requires '${key}' argument` };
      }
      return { success: true, value: undefined };
    }

    if (!isArray(value)) {
      return {
        success: false,
        error: `${this.toolName} argument '${key}' must be an array, got ${typeof value}`,
      };
    }

    // Filter elements if filter provided
    if (elementFilter) {
      return { success: true, value: value.filter(elementFilter) };
    }

    return { success: true, value: value as T[] };
  }

  /**
   * Get an object argument
   */
  getObject(key: string, options: ArgOptions = {}): ArgResult<Record<string, unknown> | undefined> {
    const { required = false, defaultValue } = options;
    const value = this.args[key];

    if (value === undefined || value === null) {
      if (defaultValue !== undefined && isObject(defaultValue)) {
        return { success: true, value: defaultValue };
      }
      if (required) {
        return { success: false, error: `${this.toolName} requires '${key}' argument` };
      }
      return { success: true, value: undefined };
    }

    if (!isObject(value)) {
      return {
        success: false,
        error: `${this.toolName} argument '${key}' must be an object, got ${typeof value}`,
      };
    }

    return { success: true, value };
  }

  /**
   * Get an enum argument (string that must be one of allowed values)
   */
  getEnum<T extends string>(
    key: string,
    allowedValues: readonly T[],
    options: ArgOptions = {}
  ): ArgResult<T | undefined> {
    const { required = false, defaultValue } = options;
    const value = this.args[key];

    if (value === undefined || value === null) {
      if (defaultValue !== undefined && allowedValues.includes(defaultValue as T)) {
        return { success: true, value: defaultValue as T };
      }
      if (required) {
        return { success: false, error: `${this.toolName} requires '${key}' argument` };
      }
      return { success: true, value: undefined };
    }

    if (!isString(value)) {
      return {
        success: false,
        error: `${this.toolName} argument '${key}' must be a string, got ${typeof value}`,
      };
    }

    if (!allowedValues.includes(value as T)) {
      return {
        success: false,
        error: `${this.toolName} argument '${key}' must be one of: ${allowedValues.join(', ')}`,
      };
    }

    return { success: true, value: value as T };
  }

  /**
   * Get raw argument value without type validation
   */
  getRaw(key: string): unknown {
    return this.args[key];
  }

  /**
   * Check if argument exists
   */
  has(key: string): boolean {
    return key in this.args && this.args[key] !== undefined && this.args[key] !== null;
  }
}

/**
 * Create a tool argument extractor
 * Convenience function for inline usage
 */
export function createArgExtractor(
  args: Record<string, unknown>,
  toolName?: string
): ToolArgExtractor {
  return new ToolArgExtractor(args, toolName);
}

/**
 * Simple string extraction with default
 * For cases where full extractor is overkill
 */
export function getStringArg(
  args: Record<string, unknown>,
  key: string,
  defaultValue = ''
): string {
  const value = args[key];
  return isString(value) ? value : defaultValue;
}

/**
 * Simple number extraction with default
 */
export function getNumberArg(
  args: Record<string, unknown>,
  key: string,
  defaultValue?: number
): number | undefined {
  const value = args[key];
  return isNumber(value) ? value : defaultValue;
}

/**
 * Simple boolean extraction with default
 */
export function getBooleanArg(
  args: Record<string, unknown>,
  key: string,
  defaultValue?: boolean
): boolean | undefined {
  const value = args[key];
  return isBoolean(value) ? value : defaultValue;
}

/**
 * Simple array extraction with type filter
 */
export function getArrayArg<T>(
  args: Record<string, unknown>,
  key: string,
  filter?: (item: unknown) => item is T
): T[] | undefined {
  const value = args[key];
  if (!isArray(value)) return undefined;
  return filter ? value.filter(filter) : (value as T[]);
}
