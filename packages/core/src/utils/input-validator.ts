/**
 * Input validation middleware for AX CLI commands
 *
 * Provides centralized validation for:
 * - API keys
 * - Base URLs
 * - Model IDs
 * - File paths
 * - Command arguments
 */

import { existsSync } from 'fs';
import { resolve, isAbsolute } from 'path';
import { z } from 'zod';

/**
 * Validation result type
 */
export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  suggestion?: string;
}

/**
 * API key validation schema
 * Accepts various API key formats from different providers
 */
const ApiKeySchema = z
  .string()
  .min(1, 'API key cannot be empty')
  .refine(
    (key) => {
      // Trim and check length
      const trimmed = key.trim();
      if (trimmed.length < 8) {
        return false;
      }
      // Basic format check - most API keys are alphanumeric with dashes/underscores
      return /^[a-zA-Z0-9_-]+$/.test(trimmed);
    },
    { message: 'Invalid API key format' }
  );

/**
 * Base URL validation schema
 */
const BaseURLSchema = z
  .string()
  .min(1, 'Base URL cannot be empty')
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    { message: 'Invalid URL format. Must be a valid HTTP/HTTPS URL.' }
  );

/**
 * Model ID validation schema
 * Accepts various model ID formats from different providers
 */
const ModelIdSchema = z
  .string()
  .min(1, 'Model ID cannot be empty')
  .max(128, 'Model ID is too long')
  .refine(
    (model) => {
      // Common model ID patterns:
      // - OpenAI: gpt-4, gpt-4-turbo, gpt-3.5-turbo
      // - Anthropic: claude-3-opus-20240229, claude-3-5-sonnet-20241022
      // - GLM: glm-4.6, glm-4-plus
      // - Ollama: llama3.1, llama3.1:8b
      // - Custom: anything alphanumeric with dashes, dots, underscores, colons
      return /^[a-zA-Z0-9._:-]+$/.test(model.trim());
    },
    { message: 'Invalid model ID format' }
  );

/**
 * Validate an API key
 */
export function validateApiKey(apiKey: string): ValidationResult<string> {
  const result = ApiKeySchema.safeParse(apiKey);

  if (result.success) {
    return { success: true, data: result.data.trim() };
  }

  return {
    success: false,
    error: result.error.issues[0]?.message || 'Invalid API key',
    suggestion: 'Check that your API key is correct and properly formatted',
  };
}

/**
 * Validate a base URL
 */
export function validateBaseURL(baseURL: string): ValidationResult<string> {
  const result = BaseURLSchema.safeParse(baseURL);

  if (result.success) {
    // Normalize URL (remove trailing slash)
    let normalized = result.data.trim();
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return { success: true, data: normalized };
  }

  return {
    success: false,
    error: result.error.issues[0]?.message || 'Invalid base URL',
    suggestion: 'Ensure the URL starts with http:// or https://',
  };
}

/**
 * Validate a model ID
 */
export function validateModelId(modelId: string): ValidationResult<string> {
  const result = ModelIdSchema.safeParse(modelId);

  if (result.success) {
    return { success: true, data: result.data.trim() };
  }

  return {
    success: false,
    error: result.error.issues[0]?.message || 'Invalid model ID',
    suggestion: 'Model IDs should contain only letters, numbers, dashes, dots, underscores, and colons',
  };
}

/**
 * Validate a file path exists
 */
export function validateFilePath(
  filePath: string,
  options: { mustExist?: boolean; mustBeFile?: boolean; mustBeDirectory?: boolean } = {}
): ValidationResult<string> {
  const { mustExist = true, mustBeFile = false, mustBeDirectory = false } = options;

  if (!filePath || filePath.trim().length === 0) {
    return {
      success: false,
      error: 'File path cannot be empty',
    };
  }

  // Resolve to absolute path
  const resolved = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);

  if (mustExist && !existsSync(resolved)) {
    return {
      success: false,
      error: `Path does not exist: ${filePath}`,
      suggestion: 'Check that the file path is correct',
    };
  }

  if (mustExist && (mustBeFile || mustBeDirectory)) {
    try {
      const fs = require('fs');
      const stats = fs.statSync(resolved);

      if (mustBeFile && !stats.isFile()) {
        return {
          success: false,
          error: `Path is not a file: ${filePath}`,
        };
      }

      if (mustBeDirectory && !stats.isDirectory()) {
        return {
          success: false,
          error: `Path is not a directory: ${filePath}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Cannot access path: ${filePath}`,
      };
    }
  }

  return { success: true, data: resolved };
}

/**
 * Validate a positive integer
 */
export function validatePositiveInteger(
  value: string | number,
  fieldName = 'Value'
): ValidationResult<number> {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;

  if (Number.isNaN(num)) {
    return {
      success: false,
      error: `${fieldName} must be a valid number`,
    };
  }

  if (!Number.isFinite(num)) {
    return {
      success: false,
      error: `${fieldName} must be a finite number`,
    };
  }

  if (num < 1) {
    return {
      success: false,
      error: `${fieldName} must be a positive integer`,
    };
  }

  if (!Number.isInteger(num)) {
    return {
      success: false,
      error: `${fieldName} must be an integer`,
    };
  }

  return { success: true, data: num };
}

/**
 * Validate a number within a range
 */
export function validateNumberInRange(
  value: string | number,
  min: number,
  max: number,
  fieldName = 'Value'
): ValidationResult<number> {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (Number.isNaN(num)) {
    return {
      success: false,
      error: `${fieldName} must be a valid number`,
    };
  }

  if (!Number.isFinite(num)) {
    return {
      success: false,
      error: `${fieldName} must be a finite number`,
    };
  }

  if (num < min || num > max) {
    return {
      success: false,
      error: `${fieldName} must be between ${min} and ${max}`,
    };
  }

  return { success: true, data: num };
}

/**
 * Validate command options object
 * Returns all validation errors at once
 */
export function validateCommandOptions<T extends Record<string, unknown>>(
  options: T,
  validators: Partial<Record<keyof T, (value: unknown) => ValidationResult>>
): ValidationResult<T> {
  const errors: string[] = [];
  const validated: Record<string, unknown> = {};

  for (const [key, validator] of Object.entries(validators)) {
    if (validator && key in options) {
      const result = validator(options[key]);
      if (!result.success) {
        errors.push(`${key}: ${result.error}${result.suggestion ? ` (${result.suggestion})` : ''}`);
      } else {
        validated[key] = result.data;
      }
    } else if (key in options) {
      validated[key] = options[key];
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: errors.join('\n'),
    };
  }

  return { success: true, data: { ...options, ...validated } as T };
}
