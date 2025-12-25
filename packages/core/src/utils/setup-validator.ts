/**
 * Setup validation utilities
 * Validates provider connectivity, API keys, and model accessibility
 */

import { TIMEOUT_CONFIG } from '../constants.js';
import { extractAndTranslateError } from './error-translator.js';

/**
 * Configuration to validate
 */
export interface ValidationConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  providerName: string;
}

/**
 * Validation step result
 */
export interface ValidationStepResult {
  success: boolean;
  message: string;
  error?: string;
  details?: string[];
}

/**
 * Validation result - structured for caller to display
 * IMPORTANT: This validator does NOT do console output - caller handles all UI
 */
export interface ValidationResult {
  success: boolean;
  endpoint?: ValidationStepResult;
  authentication?: ValidationStepResult;
  model?: ValidationStepResult;
  error?: string;
  errorDetails?: string[];
  availableModels?: string[];
  helpUrl?: string;
}

/**
 * Validate provider setup (endpoint, API key, model)
 *
 * IMPORTANT: This function does NOT produce console output.
 * All UI/display is handled by the caller to avoid conflicts with spinners/prompts.
 *
 * @param config - Configuration to validate
 * @param skipValidation - If true, skips validation
 * @returns Validation result with structured data for caller to display
 */
export async function validateProviderSetup(
  config: ValidationConfig,
  skipValidation = false
): Promise<ValidationResult> {
  if (skipValidation) {
    return { success: true };
  }

  const result: ValidationResult = {
    success: false,
    helpUrl: getProviderWebsite(config.providerName),
  };

  try {
    // Step 1: Test endpoint reachability
    const endpointTest = await testEndpoint(config.baseURL);

    result.endpoint = {
      success: endpointTest.success,
      message: endpointTest.success ? 'Endpoint reachable' : 'Endpoint unreachable',
      error: endpointTest.error,
    };

    if (!endpointTest.success) {
      result.error = endpointTest.error;
      return result;
    }

    // Step 2: Test API key (if provided)
    if (config.apiKey) {
      const authTest = await testAuthentication(config.baseURL, config.apiKey, config.providerName);

      result.authentication = {
        success: authTest.success,
        message: authTest.success ? 'API key valid' : 'Authentication failed',
        error: authTest.error,
        details: authTest.success ? undefined : [
          'Verify your API key is correct',
          'Check if the key has expired',
          `Get a new key from: ${result.helpUrl}`,
        ],
      };

      if (!authTest.success) {
        result.error = authTest.error;
        result.errorDetails = result.authentication.details;
        return result;
      }
    } else {
      // No API key required (Ollama)
      result.authentication = {
        success: true,
        message: 'No API key required',
      };
    }

    // Step 3: Test model accessibility
    const modelTest = await testModel(config.baseURL, config.apiKey, config.model, config.providerName);

    result.model = {
      success: modelTest.success,
      message: modelTest.success ? 'Model accessible' : `Model "${config.model}" not accessible`,
      error: modelTest.error,
    };

    if (!modelTest.success) {
      result.error = modelTest.error;
      result.availableModels = modelTest.availableModels;
      return result;
    }

    result.success = true;
    return result;

  } catch (error: unknown) {
    result.error = error instanceof Error ? error.message : 'Unknown validation error';
    return result;
  }
}

/**
 * Test if endpoint is reachable
 */
async function testEndpoint(baseURL: string): Promise<{ success: boolean; error?: string }> {
  try {
    // For Ollama, check if service is running
    if (baseURL.includes('localhost') || baseURL.includes('127.0.0.1')) {
      // Strip /v1 suffix (with or without trailing slash) to get Ollama's native API base
      const ollamaBase = baseURL.replace(/\/v1\/?$/, '');
      const response = await fetch(ollamaBase + '/api/version', {
        method: 'GET',
        signal: AbortSignal.timeout(TIMEOUT_CONFIG.VALIDATOR_SHORT),
      });

      if (response.ok) {
        return { success: true };
      }

      return {
        success: false,
        error: 'Local service not responding. Make sure Ollama is running: ollama serve',
      };
    }

    // For remote endpoints, try a simple request
    const response = await fetch(baseURL + '/models', {
      method: 'GET',
      signal: AbortSignal.timeout(TIMEOUT_CONFIG.VALIDATOR_LONG),
    });

    // Any response (even 401) means endpoint is reachable
    if (response.status === 401 || response.status === 403 || response.ok) {
      return { success: true };
    }

    return {
      success: false,
      error: `Server returned ${response.status} ${response.statusText}`,
    };

  } catch (error: unknown) {
    // Check for specific error types
    if (error instanceof Error) {
      const name = error.name;
      if (name === 'AbortError' || name === 'TimeoutError') {
        return {
          success: false,
          error: 'Connection timeout - check your internet connection or firewall settings',
        };
      }
    }

    // Check for Node.js system error codes
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: 'Connection refused - server may be down or URL incorrect',
      };
    }

    // Use the enhanced error translator for other errors
    return {
      success: false,
      error: extractAndTranslateError(error),
    };
  }
}

/**
 * Test API key authentication
 */
async function testAuthentication(
  baseURL: string,
  apiKey: string,
  providerName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Determine if this is xAI/Grok provider
    const isXAI = providerName.toLowerCase() === 'grok' ||
                  providerName.toLowerCase() === 'xai' ||
                  baseURL.includes('api.x.ai');

    const response = await fetch(baseURL + '/models', {
      method: 'GET',
      headers: getAuthHeaders(providerName, apiKey),
      signal: AbortSignal.timeout(TIMEOUT_CONFIG.VALIDATOR_LONG),
    });

    // xAI/Grok uses different error codes:
    // - 401: No auth header provided (not an API key error)
    // - 400: Invalid API key format/value
    // For other providers, 401 typically means invalid key
    if (isXAI) {
      if (response.status === 400) {
        // xAI returns 400 for invalid API key with error message in body
        try {
          const errorData = await response.json() as { error?: string; message?: string };
          const errorMsg = errorData.error || errorData.message || 'Invalid API key';
          return { success: false, error: errorMsg };
        } catch {
          return { success: false, error: 'Invalid API key' };
        }
      }
      // For xAI, 401 without auth header is handled in endpoint test
      // If we get here with 401 after providing auth, treat it as auth issue
      if (response.status === 401) {
        return { success: false, error: 'Authentication failed - check your API key' };
      }
    } else {
      // Standard OpenAI-compatible behavior
      if (response.status === 401) {
        return { success: false, error: 'Invalid or expired API key' };
      }
    }

    if (response.status === 403) {
      return { success: false, error: 'API key does not have required permissions' };
    }
    if (response.ok || response.status === 404) {
      return { success: true };
    }

    return {
      success: false,
      error: `Unexpected response ${response.status} ${response.statusText}`,
    };

  } catch (error: unknown) {
    // Use the enhanced error translator for Chinese error messages
    const errorMessage = extractAndTranslateError(error);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Test model accessibility
 */
async function testModel(
  baseURL: string,
  apiKey: string,
  model: string,
  providerName: string
): Promise<{ success: boolean; error?: string; availableModels?: string[] }> {
  try {
    // Ollama: check installed models list
    if (baseURL.includes('localhost') || baseURL.includes('127.0.0.1')) {
      let availableModels: string[] = [];
      try {
        // Strip /v1 suffix (with or without trailing slash) to get Ollama's native API base
        const ollamaBase = baseURL.replace(/\/v1\/?$/, '');
        const response = await fetch(ollamaBase + '/api/tags', {
          method: 'GET',
          signal: AbortSignal.timeout(TIMEOUT_CONFIG.VALIDATOR_SHORT),
        });
        if (response.ok) {
          const data = await response.json() as { models?: Array<{ name?: string }> };
          availableModels = data.models?.map((m) => m.name).filter((n): n is string => typeof n === 'string') || [];
        }
      } catch {
        // Ignore - timeout or connection error
      }

      if (availableModels.includes(model)) {
        return { success: true, availableModels };
      }

      const errorMessage = availableModels.length === 0
        ? `Model "${model}" not found. No models installed. Run: ollama pull ${model || 'llama3.1'}`
        : `Model "${model}" not found`;

      return { success: false, error: errorMessage, availableModels };
    }

    // Remote: fetch models list
    const response = await fetch(baseURL + '/models', {
      method: 'GET',
      headers: getAuthHeaders(providerName, apiKey),
      signal: AbortSignal.timeout(TIMEOUT_CONFIG.VALIDATOR_LONG),
    });

    if (response.status === 401 || response.status === 403) {
      return { success: false, error: 'Authentication failed while checking models' };
    }

    if (response.ok) {
      let availableModels: string[] = [];
      try {
        const data = await response.json() as unknown;
        const dataObj = data as { data?: unknown[]; models?: unknown[] };
        if (Array.isArray(dataObj?.data)) {
          availableModels = dataObj.data
            .map((m) => {
              const model = m as { id?: string; model?: string };
              return model.id || model.model;
            })
            .filter((m): m is string => typeof m === 'string');
        } else if (Array.isArray(dataObj?.models)) {
          availableModels = dataObj.models
            .map((m) => {
              const model = m as { id?: string; model?: string; name?: string };
              return model.id || model.model || model.name;
            })
            .filter((m): m is string => typeof m === 'string');
        }
      } catch {
        // Ignore parse errors; treat as unknown list
      }

      if (availableModels.includes(model)) {
        return { success: true, availableModels };
      }

      // xAI/Grok uses model aliases (e.g., "grok-4" -> "grok-4-0709") that aren't listed
      // in the /models endpoint. Accept aliased models if the base version exists.
      const isXAI = providerName.toLowerCase() === 'grok' ||
                    providerName.toLowerCase() === 'xai' ||
                    baseURL.includes('api.x.ai');

      if (isXAI) {
        // Known xAI model aliases that map to versioned models
        const xaiAliases: Record<string, string> = {
          'grok-4': 'grok-4-',           // matches grok-4-0709, grok-4-fast-*, etc.
          'grok-4-latest': 'grok-4-',
          'grok-4.1': 'grok-4-1-',        // matches grok-4-1-fast-*, etc.
          'grok-4.1-latest': 'grok-4-1-',
          'grok-3-latest': 'grok-3',
          'grok-3-mini-latest': 'grok-3-mini',
        };

        const aliasPrefix = xaiAliases[model];
        if (aliasPrefix) {
          const hasMatchingModel = availableModels.some(m => m.startsWith(aliasPrefix));
          if (hasMatchingModel) {
            return { success: true, availableModels };
          }
        }
      }

      return {
        success: false,
        error: `Model "${model}" not found`,
        availableModels,
      };
    }

    // If /models is not available (404), assume model is valid
    // Some providers (xAI/Grok) don't have a /models endpoint
    if (response.status === 404) {
      return {
        success: true,
        availableModels: undefined,
      };
    }

    return {
      success: false,
      error: `Model check failed with ${response.status} ${response.statusText}`,
    };

  } catch (error: unknown) {
    // Use the enhanced error translator for Chinese error messages
    const errorMessage = extractAndTranslateError(error);

    return {
      success: false,
      error: errorMessage,
      availableModels: undefined,
    };
  }
}

/**
 * Get provider website for help
 */
function getProviderWebsite(providerName: string): string {
  const normalized = providerName.toLowerCase();

  const websites: Record<string, string> = {
    // GLM / Z.AI
    'glm': 'https://z.ai',
    'z.ai': 'https://z.ai',
    'z.ai-free': 'https://z.ai',
    // Grok / xAI
    'grok': 'https://console.x.ai',
    'xai': 'https://console.x.ai',
    // Other providers
    'openai': 'https://platform.openai.com',
    'anthropic': 'https://console.anthropic.com',
    'ollama': 'https://ollama.ai',
  };

  return websites[normalized] || 'https://example.com';
}

/**
 * Build auth headers for common providers
 */
function getAuthHeaders(providerName: string, apiKey: string): Record<string, string> {
  if (!apiKey) return {};

  const normalized = providerName.toLowerCase();
  if (normalized === 'anthropic') {
    return {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  // Default to OpenAI-compatible
  return {
    Authorization: `Bearer ${apiKey}`,
  };
}
