/**
 * CLI Bridge - SDK Implementation
 *
 * This bridges the VS Code extension with the AX CLI tools (ax-grok, ax-glm).
 * API keys are handled by the CLI tools via environment variables or config files.
 *
 * Supports:
 * - ax-grok (xAI Grok models) - uses XAI_API_KEY env var
 * - ax-glm (Z.AI GLM models) - uses Z_API_KEY env var
 * - Other providers via appropriate CLI commands
 */

import * as vscode from 'vscode';

/**
 * Supported AI providers
 */
type Provider = 'grok' | 'glm' | 'openai' | 'anthropic' | 'deepseek';

interface ProviderInfo {
  command: string;
  displayName: string;
  envVar: string;
  docsUrl: string;
}

const PROVIDER_INFO: Record<Provider, ProviderInfo> = {
  grok: {
    command: 'ax-grok',
    displayName: 'xAI (Grok)',
    envVar: 'XAI_API_KEY',
    docsUrl: 'https://github.com/defai-digital/ax-cli/tree/main/packages/ax-grok#readme',
  },
  glm: {
    command: 'ax-glm',
    displayName: 'Z.AI (GLM)',
    envVar: 'Z_API_KEY',
    docsUrl: 'https://github.com/defai-digital/ax-cli/tree/main/packages/ax-glm#readme',
  },
  openai: {
    command: 'ax-cli',
    displayName: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    docsUrl: 'https://github.com/defai-digital/ax-cli#configuration',
  },
  anthropic: {
    command: 'ax-cli',
    displayName: 'Anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    docsUrl: 'https://github.com/defai-digital/ax-cli#configuration',
  },
  deepseek: {
    command: 'ax-cli',
    displayName: 'DeepSeek',
    envVar: 'DEEPSEEK_API_KEY',
    docsUrl: 'https://github.com/defai-digital/ax-cli#configuration',
  },
};

/**
 * Get provider from model name
 */
function getProviderFromModel(model: string): Provider {
  if (model.startsWith('grok-')) return 'grok';
  if (model.startsWith('glm-')) return 'glm';
  if (model.startsWith('gpt-') || model.startsWith('o1')) return 'openai';
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('deepseek-')) return 'deepseek';
  // Default to configured provider
  const config = vscode.workspace.getConfiguration('ax-cli');
  return config.get<Provider>('provider', 'grok');
}

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
 * CLI Bridge SDK
 *
 * Bridges VS Code with the AX CLI tools (ax-grok, ax-glm).
 * API keys are managed externally via environment variables or CLI config.
 *
 * The IPC-based diff preview (Accept/Reject changes in VS Code) works
 * independently when running CLI tools in the integrated terminal.
 */
export class CLIBridgeSDK {
  private pendingChanges: Map<string, PendingChange> = new Map();
  private activeTerminal: vscode.Terminal | undefined;

  constructor() {
    // No dependencies - API keys are handled by the CLI tools themselves
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
   * Get the CLI command and provider info for the current model
   */
  private getProviderInfo(): { provider: Provider; info: ProviderInfo } {
    const config = vscode.workspace.getConfiguration('ax-cli');
    const model = config.get<string>('model', 'grok-4-0709');
    const provider = getProviderFromModel(model);
    return { provider, info: PROVIDER_INFO[provider] };
  }

  /**
   * Send a request - opens terminal with the appropriate CLI command
   * API keys are handled by the CLI tools via environment variables
   */
  async sendRequest(
    request: CLIRequest,
    _onStream?: (chunk: StreamingChunk) => void
  ): Promise<CLIResponse | CLIError> {
    try {
      const { provider, info } = this.getProviderInfo();

      // Show info message directing to terminal
      const selection = await vscode.window.showInformationMessage(
        `Run "${info.command}" in the integrated terminal. ` +
        `Make sure ${info.envVar} is set. File changes will show as diffs for approval.`,
        'Open Terminal',
        'Learn More'
      );

      if (selection === 'Open Terminal') {
        try {
          // Reuse existing terminal or create new one
          // Note: exitStatus is undefined while terminal is active, defined when exited
          const terminalIsActive = this.activeTerminal && this.activeTerminal.exitStatus === undefined;
          if (!terminalIsActive) {
            this.activeTerminal = vscode.window.createTerminal({
              name: `AX CLI (${info.displayName})`,
            });
          }
          this.activeTerminal!.show();
          this.activeTerminal!.sendText(info.command);
        } catch (error) {
          console.error('[AX] Failed to create terminal:', error);
          vscode.window.showErrorMessage('Failed to open terminal');
        }
      } else if (selection === 'Learn More') {
        await vscode.env.openExternal(vscode.Uri.parse(info.docsUrl));
      }

      // Return response
      return {
        id: request.id,
        messages: [{
          role: 'assistant',
          content: `Please use the \`${info.command}\` command in the integrated terminal for full functionality.\n\n` +
                   `**Setup:**\n` +
                   `\`\`\`bash\n` +
                   `export ${info.envVar}=your-api-key\n` +
                   `${info.command}\n` +
                   `\`\`\`\n\n` +
                   'File changes will appear as diffs in VS Code for you to accept or reject.'
        }],
        model: provider,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('[AX] Unexpected error in sendRequest:', error);
      return {
        id: request.id,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'UnexpectedError',
        },
        timestamp: new Date().toISOString()
      };
    }
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
    // Dispose active terminal if it exists
    if (this.activeTerminal) {
      this.activeTerminal.dispose();
      this.activeTerminal = undefined;
    }
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
