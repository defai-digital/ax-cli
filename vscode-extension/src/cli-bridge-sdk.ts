/**
 * CLI Bridge - Stub Implementation
 *
 * This is a placeholder that allows the extension to compile without
 * requiring the @defai.digital/ax-cli package.
 *
 * The IPC-based diff preview works independently via WebSocket communication
 * between the CLI and extension (see ipc-server.ts).
 *
 * To enable full SDK integration:
 * 1. Install: npm install @defai.digital/ax-cli
 * 2. Replace this file with the SDK implementation
 */

import * as vscode from 'vscode';
import type { SecretStorageService } from './secret-storage.js';

export interface CLIRequest {
  id: string;
  prompt: string;
  context?: {
    file?: string;
    selection?: string;
    lineRange?: string;
    gitDiff?: boolean;
  };
}

export interface CLIResponse {
  id: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  model: string;
  timestamp: string;
}

export interface CLIError {
  id: string;
  error: {
    message: string;
    type: string;
  };
  timestamp: string;
}

export interface PendingChange {
  id: string;
  file: string;
  oldContent: string;
  newContent: string;
  command: string;
  lineStart?: number;
  lineEnd?: number;
  toolCall: unknown;
}

// Stub types for SDK compatibility
interface StreamingChunk {
  type: string;
  content?: string;
}

/**
 * Stub CLI Bridge
 *
 * This stub provides the interface for the chat functionality.
 * For now, it shows a message directing users to use the terminal CLI.
 *
 * The IPC-based diff preview (Accept/Reject changes in VS Code) works
 * independently when running `ax` in the integrated terminal.
 */
export class CLIBridgeSDK {
  private pendingChanges: Map<string, PendingChange> = new Map();
  private secretStorage: SecretStorageService | undefined;

  constructor(secretStorage?: SecretStorageService) {
    this.secretStorage = secretStorage;
  }

  /**
   * Set diff preview handler (called by ChatViewProvider)
   * Note: In the stub, this is a no-op. The real SDK would use this handler.
   */
  public setDiffPreviewHandler(_handler: (change: PendingChange) => void): void {
    // Stub - IPC-based diff preview works independently via ipc-server.ts
  }

  /**
   * Approve or reject a pending change
   */
  public approveChange(changeId: string, _approved: boolean): void {
    this.pendingChanges.delete(changeId);
  }

  /**
   * Get pending change details
   */
  public getPendingChange(changeId: string): PendingChange | undefined {
    return this.pendingChanges.get(changeId);
  }

  /**
   * Send a request - shows info message directing to terminal
   */
  async sendRequest(
    request: CLIRequest,
    _onStream?: (chunk: StreamingChunk) => void
  ): Promise<CLIResponse | CLIError> {
    // Check if API key is configured
    const hasApiKey = this.secretStorage ? await this.secretStorage.hasApiKey() : false;

    if (!hasApiKey) {
      const selection = await vscode.window.showWarningMessage(
        'No API key configured. Please set your API key first.',
        'Set API Key',
        'Learn More'
      );

      if (selection === 'Set API Key') {
        await this.secretStorage?.promptForApiKey();
      } else if (selection === 'Learn More') {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/defai-digital/ax-cli#configuration'));
      }

      return {
        id: request.id,
        error: {
          message: 'No API key configured',
          type: 'ConfigurationError',
        },
        timestamp: new Date().toISOString()
      };
    }

    // Show info message directing to terminal
    const selection = await vscode.window.showInformationMessage(
      'For the best experience, run "ax" in the integrated terminal. ' +
      'File changes will show as diffs in VS Code for approval.',
      'Open Terminal',
      'Learn More'
    );

    if (selection === 'Open Terminal') {
      // Get API key from secure storage and pass via environment variable
      const apiKey = await this.secretStorage?.getApiKey();
      const terminal = vscode.window.createTerminal({
        name: 'AX CLI',
        env: apiKey ? { AX_API_KEY: apiKey } : undefined
      });
      terminal.show();
      terminal.sendText('ax');
    } else if (selection === 'Learn More') {
      vscode.env.openExternal(vscode.Uri.parse('https://github.com/defai-digital/ax-cli#vscode-integration'));
    }

    // Return stub response
    return {
      id: request.id,
      messages: [{
        role: 'assistant',
        content: 'Please use the `ax` command in the integrated terminal for full functionality. ' +
                 'File changes will appear as diffs in VS Code for you to accept or reject.'
      }],
      model: 'stub',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Interrupt current processing
   */
  interrupt(): void {
    // Stub
  }

  /**
   * Get chat history
   */
  getChatHistory(): unknown[] {
    return [];
  }

  /**
   * Clear chat history
   */
  clearHistory(): void {
    // Stub
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.pendingChanges.clear();
  }

  /**
   * Check if agent is ready
   */
  isReady(): boolean {
    return false; // Stub is never "ready" for full SDK operations
  }

  /**
   * Get agent instance
   */
  getAgent(): null {
    return null;
  }
}
