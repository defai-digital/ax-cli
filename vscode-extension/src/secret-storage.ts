/**
 * Secret Storage Service - DEPRECATED
 *
 * API keys are now managed externally via environment variables:
 * - XAI_API_KEY for Grok models (ax-grok)
 * - Z_API_KEY for GLM models (ax-glm)
 * - OPENAI_API_KEY for OpenAI models
 * - ANTHROPIC_API_KEY for Claude models
 * - DEEPSEEK_API_KEY for DeepSeek models
 *
 * This file is kept for backwards compatibility but is no longer used.
 */

import * as vscode from 'vscode';

/**
 * Supported AI providers
 */
export type Provider = 'grok' | 'glm' | 'openai' | 'anthropic' | 'deepseek';

/**
 * Get provider from model name
 */
export function getProviderFromModel(model: string): Provider {
  if (model.startsWith('grok-')) return 'grok';
  if (model.startsWith('glm-')) return 'glm';
  if (model.startsWith('gpt-') || model.startsWith('o1')) return 'openai';
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('deepseek-')) return 'deepseek';
  // Default to grok
  return 'grok';
}

/**
 * Provider configuration info
 */
interface ProviderConfig {
  envVar: string;
  displayName: string;
  cliCommand: string;
}

const PROVIDER_CONFIGS: Record<Provider, ProviderConfig> = {
  grok: { envVar: 'XAI_API_KEY', displayName: 'xAI (Grok)', cliCommand: 'ax-grok' },
  glm: { envVar: 'Z_API_KEY', displayName: 'Z.AI (GLM)', cliCommand: 'ax-glm' },
  openai: { envVar: 'OPENAI_API_KEY', displayName: 'OpenAI', cliCommand: 'ax-cli' },
  anthropic: { envVar: 'ANTHROPIC_API_KEY', displayName: 'Anthropic', cliCommand: 'ax-cli' },
  deepseek: { envVar: 'DEEPSEEK_API_KEY', displayName: 'DeepSeek', cliCommand: 'ax-cli' },
};

/**
 * Get provider configuration
 */
export function getProviderConfig(provider: Provider): ProviderConfig {
  return PROVIDER_CONFIGS[provider];
}

/**
 * @deprecated - No longer used, kept for backwards compatibility
 */
export class SecretStorageService {
  constructor(_context: vscode.ExtensionContext) {
    // No-op - API keys handled externally
  }

  async getApiKey(_provider?: Provider): Promise<string | undefined> {
    return undefined;
  }

  async setApiKey(_apiKey: string, _provider?: Provider): Promise<void> {
    // No-op
  }

  async clearApiKey(_provider?: Provider): Promise<void> {
    // No-op
  }

  async hasApiKey(_provider?: Provider): Promise<boolean> {
    return false;
  }

  async migrateFromPlaintextSettings(): Promise<boolean> {
    return false;
  }

  async promptForApiKey(_provider?: Provider): Promise<boolean> {
    vscode.window.showInformationMessage(
      'API keys are now configured via environment variables. ' +
      'Set XAI_API_KEY, Z_API_KEY, etc. in your shell.'
    );
    return false;
  }

  async getMaskedApiKey(_provider?: Provider): Promise<string> {
    return '(managed via env vars)';
  }

  dispose(): void {
    // No-op
  }
}

/**
 * @deprecated - No longer used
 */
export function initializeSecretStorage(context: vscode.ExtensionContext): SecretStorageService {
  return new SecretStorageService(context);
}

/**
 * @deprecated - No longer used
 */
export function getSecretStorage(): SecretStorageService {
  throw new Error('SecretStorageService is deprecated. API keys are managed via environment variables.');
}
