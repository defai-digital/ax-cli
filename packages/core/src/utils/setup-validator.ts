/**
 * Setup validation utilities
 * Validates provider connectivity, API keys, and model accessibility
 */

import chalk from 'chalk';

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
 * Validation result
 */
export interface ValidationResult {
  success: boolean;
  endpoint?: boolean;
  authentication?: boolean;
  model?: boolean;
  error?: string;
  availableModels?: string[];
}

/**
 * Validate provider setup (endpoint, API key, model)
 *
 * @param config - Configuration to validate
 * @param skipValidation - If true, skips validation
 * @returns Validation result
 */
export async function validateProviderSetup(
  config: ValidationConfig,
  skipValidation = false
): Promise<ValidationResult> {
  if (skipValidation) {
    return { success: true };
  }

  console.log(chalk.cyan('\n🔍 Validating configuration...\n'));

  const result: ValidationResult = {
    success: false,
    endpoint: false,
    authentication: false,
    model: false,
  };

  try {
    // Step 1: Test endpoint reachability
    console.log(chalk.dim('   Testing endpoint connectivity...'));
    const endpointTest = await testEndpoint(config.baseURL);

    if (!endpointTest.success) {
      result.error = endpointTest.error;
      console.log(chalk.red('   ✗ Endpoint unreachable'));
      console.log(chalk.yellow(`     ${endpointTest.error}`));
      return result;
    }

    result.endpoint = true;
    console.log(chalk.green('   ✓ Endpoint reachable'));

    // Step 2: Test API key (if provided)
    if (config.apiKey) {
      console.log(chalk.dim('   Validating API key...'));
      const authTest = await testAuthentication(config.baseURL, config.apiKey, config.providerName);

      if (!authTest.success) {
        result.error = authTest.error;
        console.log(chalk.red('   ✗ Authentication failed'));
        console.log(chalk.yellow(`     ${authTest.error}`));

        // Provide helpful guidance
        console.log(chalk.dim('\n   💡 Troubleshooting:'));
        console.log(chalk.dim('      • Verify your API key is correct'));
        console.log(chalk.dim('      • Check if the key has expired'));
        console.log(chalk.dim(`      • Get a new key from: ${getProviderWebsite(config.providerName)}`));

        return result;
      }

      result.authentication = true;
      console.log(chalk.green('   ✓ API key valid'));
    } else {
      // No API key required (Ollama)
      console.log(chalk.green('   ✓ No API key required'));
      result.authentication = true;
    }

    // Step 3: Test model accessibility
    console.log(chalk.dim('   Checking model accessibility...'));
    const modelTest = await testModel(config.baseURL, config.apiKey, config.model, config.providerName);

    if (!modelTest.success) {
      result.error = modelTest.error;
      console.log(chalk.red(`   ✗ Model "${config.model}" not accessible`));
      console.log(chalk.yellow(`     ${modelTest.error}`));

      if (modelTest.availableModels && modelTest.availableModels.length > 0) {
        console.log(chalk.dim('\n   Available models:'));
        modelTest.availableModels.forEach(model => {
          console.log(chalk.dim(`      • ${model}`));
        });
      }

      return result;
    }

    result.model = true;
    result.success = true;
    console.log(chalk.green('   ✓ Model accessible'));

    // Success message
    console.log(chalk.green('\n✅ Configuration validated successfully!\n'));

    return result;

  } catch (error: any) {
    result.error = error instanceof Error ? error.message : 'Unknown validation error';
    console.log(chalk.red('\n✗ Validation failed'));
    console.log(chalk.yellow(`  ${result.error}\n`));
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
      const response = await fetch(baseURL.replace('/v1', '') + '/api/version', {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
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
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    // Any response (even 401) means endpoint is reachable
    if (response.status === 401 || response.status === 403 || response.ok) {
      return { success: true };
    }

    return {
      success: false,
      error: `Server returned ${response.status} ${response.statusText}`,
    };

  } catch (error: any) {
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      return {
        success: false,
        error: 'Connection timeout - check your internet connection or firewall settings',
      };
    }

    if (error?.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: 'Connection refused - server may be down or URL incorrect',
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
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
    const response = await fetch(baseURL + '/models', {
      method: 'GET',
      headers: getAuthHeaders(providerName, apiKey),
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 401) {
      return { success: false, error: 'Invalid or expired API key' };
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

  } catch (error: any) {
    // Extract error message
    let errorMessage = error instanceof Error ? error.message : 'Authentication failed';

    // Translate Chinese errors if present
    if (/[\u4e00-\u9fa5]/.test(errorMessage)) {
      if (errorMessage.includes('令牌已过期') || errorMessage.includes('验证不正确')) {
        errorMessage = 'Token expired or verification incorrect (API key invalid)';
      }
    }

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
        const response = await fetch(baseURL.replace('/v1', '') + '/api/tags');
        if (response.ok) {
          const data = await response.json() as any;
          availableModels = data.models?.map((m: any) => m.name) || [];
        }
      } catch {
        // Ignore
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
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 401 || response.status === 403) {
      return { success: false, error: 'Authentication failed while checking models' };
    }

    if (response.ok) {
      let availableModels: string[] = [];
      try {
        const data = await response.json() as any;
        if (Array.isArray(data?.data)) {
          availableModels = data.data
            .map((m: any) => m.id || m.model)
            .filter((m: any) => typeof m === 'string');
        } else if (Array.isArray(data?.models)) {
          availableModels = data.models
            .map((m: any) => m.id || m.model || m.name)
            .filter((m: any) => typeof m === 'string');
        }
      } catch {
        // Ignore parse errors; treat as unknown list
      }

      if (availableModels.includes(model)) {
        return { success: true, availableModels };
      }

      return {
        success: false,
        error: `Model "${model}" not found`,
        availableModels,
      };
    }

    // If /models is not available, fall back to ping
    if (response.status === 404) {
      return { success: false, error: 'Models endpoint not available for this provider' };
    }

    return {
      success: false,
      error: `Model check failed with ${response.status} ${response.statusText}`,
    };

  } catch (error: any) {
    let errorMessage = error instanceof Error ? error.message : 'Model not accessible';
    let availableModels: string[] | undefined;

    // Translate Chinese errors
    if (/[\u4e00-\u9fa5]/.test(errorMessage)) {
      if (errorMessage.includes('模型不存在')) {
        errorMessage = 'Model does not exist';
      }
    }

    return {
      success: false,
      error: errorMessage,
      availableModels,
    };
  }
}

/**
 * Get provider website for help
 */
function getProviderWebsite(providerName: string): string {
  const websites: Record<string, string> = {
    'z.ai': 'https://z.ai',
    'z.ai-free': 'https://z.ai',
    'xai': 'https://x.ai',
    'openai': 'https://platform.openai.com',
    'anthropic': 'https://console.anthropic.com',
    'ollama': 'https://ollama.ai',
  };

  return websites[providerName.toLowerCase()] || 'provider website';
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
