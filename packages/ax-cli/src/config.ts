import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export type Provider = 'local' | 'deepseek';
export type ServerType = 'local';

export interface AxCliConfig {
  selectedProvider?: Provider;
  serverType?: ServerType;
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
  currentModel?: string;
  maxTokens?: number;
  temperature?: number;
  models?: string[];
  _provider?: string;
  _website?: string;
  _isLocalServer?: boolean;
}

export const AX_CLI_CONFIG_DIR = join(homedir(), '.ax-cli');
export const AX_CLI_CONFIG_FILE = join(AX_CLI_CONFIG_DIR, 'config.json');

/**
 * Load ax-cli config. Returns an empty object on failure to keep callers simple.
 */
export function loadConfig(): AxCliConfig {
  try {
    if (existsSync(AX_CLI_CONFIG_FILE)) {
      return JSON.parse(readFileSync(AX_CLI_CONFIG_FILE, 'utf-8'));
    }
  } catch {
    // Ignore errors
  }
  return {};
}

/**
 * Persist the ax-cli config, creating the directory if needed.
 */
export function saveConfig(config: AxCliConfig): void {
  if (!existsSync(AX_CLI_CONFIG_DIR)) {
    mkdirSync(AX_CLI_CONFIG_DIR, { recursive: true });
  }
  writeFileSync(AX_CLI_CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

/**
 * Delete the config file (used for --force).
 */
export function deleteConfig(): boolean {
  try {
    if (existsSync(AX_CLI_CONFIG_FILE)) {
      unlinkSync(AX_CLI_CONFIG_FILE);
    }
    return true;
  } catch {
    return false;
  }
}
