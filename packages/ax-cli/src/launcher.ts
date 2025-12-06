/**
 * Provider Launcher - Detect and launch installed providers
 */

import { spawn } from 'child_process';
import which from 'which';

export type Provider = 'glm' | 'grok';

/**
 * Detect which provider is installed
 */
export async function detectInstalledProvider(): Promise<Provider | null> {
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
