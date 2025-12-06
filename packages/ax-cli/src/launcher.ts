/**
 * Provider Launcher - Detect and launch installed providers
 *
 * Uses the saved provider preference from config to determine which CLI to launch.
 */

import { spawn } from 'child_process';
import which from 'which';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export type Provider = 'glm' | 'grok';

// Config paths
const CONFIG_DIR = join(homedir(), '.ax-cli');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

interface AxCliConfig {
  selectedProvider?: Provider;
}

/**
 * Load the selected provider from config
 */
function loadSelectedProvider(): Provider | null {
  try {
    if (existsSync(CONFIG_FILE)) {
      const config: AxCliConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
      return config.selectedProvider || null;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Get the configured provider (from config file)
 */
export function getConfiguredProvider(): Provider | null {
  return loadSelectedProvider();
}

/**
 * Detect which provider is installed (checks config first, then falls back to detection)
 */
export async function detectInstalledProvider(): Promise<Provider | null> {
  // First, check if there's a configured provider preference
  const configured = loadSelectedProvider();
  if (configured) {
    // Verify it's actually installed
    const installed = await isProviderInstalled(configured);
    if (installed) {
      return configured;
    }
  }

  // Fall back to detecting any installed provider
  // Check for ax-glm
  try {
    await which('ax-glm');
    return 'glm';
  } catch {
    // Not found
  }

  // Check for ax-grok
  try {
    await which('ax-grok');
    return 'grok';
  } catch {
    // Not found
  }

  return null;
}

/**
 * Check if a specific provider is installed
 */
export async function isProviderInstalled(provider: Provider): Promise<boolean> {
  const binary = provider === 'glm' ? 'ax-glm' : 'ax-grok';

  try {
    await which(binary);
    return true;
  } catch {
    return false;
  }
}

/**
 * Launch a provider with the given arguments
 */
export async function launchProvider(provider: Provider, args: string[]): Promise<void> {
  const binary = provider === 'glm' ? 'ax-glm' : 'ax-grok';

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      stdio: 'inherit',
      shell: true,
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        process.exit(code ?? 1);
      }
    });
  });
}

/**
 * Get the path to a provider binary
 */
export async function getProviderPath(provider: Provider): Promise<string | null> {
  const binary = provider === 'glm' ? 'ax-glm' : 'ax-grok';

  try {
    return await which(binary);
  } catch {
    return null;
  }
}
