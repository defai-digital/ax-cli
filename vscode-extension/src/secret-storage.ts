/**
 * Secret Storage Service
 *
 * Provides secure storage for API keys using VS Code's SecretStorage API.
 * This uses the OS-level credential storage (macOS Keychain, Windows Credential Manager,
 * Linux Secret Service) instead of storing keys in plaintext settings.
 *
 * Security benefits:
 * - Keys are encrypted at rest by the OS
 * - Keys are not visible in settings.json
 * - Keys are not exposed in process arguments
 * - Keys are tied to the VS Code installation
 */

import * as vscode from 'vscode';

const API_KEY_SECRET_KEY = 'ax-cli.apiKey';
const MIGRATION_FLAG_KEY = 'ax-cli.apiKeyMigrated';

export class SecretStorageService {
  private secretStorage: vscode.SecretStorage;
  private context: vscode.ExtensionContext;
  private onDidChangeEmitter = new vscode.EventEmitter<void>();
  private secretChangeListener: vscode.Disposable;

  /**
   * Event fired when the API key changes
   */
  public readonly onDidChange = this.onDidChangeEmitter.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.secretStorage = context.secrets;

    // Listen for secret changes - store disposable for cleanup
    this.secretChangeListener = this.secretStorage.onDidChange((e) => {
      if (e.key === API_KEY_SECRET_KEY) {
        this.onDidChangeEmitter.fire();
      }
    });
  }

  /**
   * Get the stored API key
   * @returns The API key or undefined if not set
   */
  async getApiKey(): Promise<string | undefined> {
    return await this.secretStorage.get(API_KEY_SECRET_KEY);
  }

  /**
   * Store an API key securely
   * @param apiKey The API key to store
   */
  async setApiKey(apiKey: string): Promise<void> {
    if (!apiKey || apiKey.trim() === '') {
      await this.clearApiKey();
      return;
    }

    await this.secretStorage.store(API_KEY_SECRET_KEY, apiKey.trim());
    this.onDidChangeEmitter.fire();

    // Clear any legacy plaintext key from settings
    await this.clearLegacyPlaintextKey();
  }

  /**
   * Remove the stored API key
   */
  async clearApiKey(): Promise<void> {
    await this.secretStorage.delete(API_KEY_SECRET_KEY);
    this.onDidChangeEmitter.fire();
  }

  /**
   * Check if an API key is stored
   */
  async hasApiKey(): Promise<boolean> {
    const key = await this.getApiKey();
    return key !== undefined && key.length > 0;
  }

  /**
   * Migrate API key from plaintext settings to SecretStorage
   * This is a one-time migration for existing users
   */
  async migrateFromPlaintextSettings(): Promise<boolean> {
    // Check if migration already done
    const migrated = this.context.globalState.get<boolean>(MIGRATION_FLAG_KEY);
    if (migrated) {
      return false;
    }

    // Check for plaintext API key in settings
    const config = vscode.workspace.getConfiguration('ax-cli');
    const plaintextKey = config.get<string>('apiKey');

    if (plaintextKey && plaintextKey.trim() !== '') {
      // Store in SecretStorage
      await this.setApiKey(plaintextKey);

      // Clear from plaintext settings
      await this.clearLegacyPlaintextKey();

      // Mark migration as complete
      await this.context.globalState.update(MIGRATION_FLAG_KEY, true);

      console.log('[AX] Migrated API key from plaintext settings to SecretStorage');
      return true;
    }

    // Mark migration as complete even if no key was found
    await this.context.globalState.update(MIGRATION_FLAG_KEY, true);
    return false;
  }

  /**
   * Clear legacy plaintext API key from settings
   */
  private async clearLegacyPlaintextKey(): Promise<void> {
    const config = vscode.workspace.getConfiguration('ax-cli');
    const currentKey = config.get<string>('apiKey');

    if (currentKey && currentKey.trim() !== '') {
      try {
        // Clear from all configuration targets
        await config.update('apiKey', undefined, vscode.ConfigurationTarget.Global);
        await config.update('apiKey', undefined, vscode.ConfigurationTarget.Workspace);
        await config.update('apiKey', undefined, vscode.ConfigurationTarget.WorkspaceFolder);
        console.log('[AX] Cleared legacy plaintext API key from settings');
      } catch (error) {
        console.warn('[AX] Failed to clear legacy plaintext API key:', error);
      }
    }
  }

  /**
   * Prompt user to enter API key
   * @returns true if key was set, false if cancelled
   */
  async promptForApiKey(): Promise<boolean> {
    const currentKey = await this.getApiKey();
    const hasExisting = currentKey && currentKey.length > 0;

    const input = await vscode.window.showInputBox({
      prompt: hasExisting
        ? 'Enter new API key (leave empty to keep current)'
        : 'Enter your API key for the AI provider',
      placeHolder: 'sk-...',
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!hasExisting && (!value || value.trim() === '')) {
          return 'API key is required';
        }
        return null;
      },
    });

    if (input === undefined) {
      // User cancelled
      return false;
    }

    if (input.trim() === '' && hasExisting) {
      // Keep existing key
      return true;
    }

    await this.setApiKey(input);
    vscode.window.showInformationMessage('API key saved securely');
    return true;
  }

  /**
   * Get masked version of API key for display
   */
  async getMaskedApiKey(): Promise<string> {
    const key = await this.getApiKey();
    if (!key) {
      return '(not set)';
    }

    if (key.length <= 8) {
      return '****';
    }

    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.secretChangeListener.dispose();
    this.onDidChangeEmitter.dispose();
  }
}

/**
 * Singleton instance - initialized by extension activation
 */
let secretStorageInstance: SecretStorageService | undefined;

/**
 * Initialize the secret storage service
 * Call this during extension activation
 */
export function initializeSecretStorage(context: vscode.ExtensionContext): SecretStorageService {
  secretStorageInstance = new SecretStorageService(context);
  return secretStorageInstance;
}

/**
 * Get the secret storage service instance
 * @throws Error if not initialized
 */
export function getSecretStorage(): SecretStorageService {
  if (!secretStorageInstance) {
    throw new Error('SecretStorageService not initialized. Call initializeSecretStorage() first.');
  }
  return secretStorageInstance;
}
