/**
 * CLI Bridge - SDK Implementation
 *
 * This bridges the VS Code extension with the AX CLI tools (ax-grok, ax-glm).
 * API keys are handled by the CLI tools via environment variables or config files.
 *
 * Communication modes:
 * 1. IPC Mode (preferred): When CLI is running in terminal, communicate via WebSocket
 * 2. Terminal Mode (fallback): Open terminal with CLI command
 *
 * Supports:
 * - ax-grok (xAI Grok models) - uses XAI_API_KEY env var
 * - ax-glm (Z.AI GLM models) - uses Z_API_KEY env var
 * - Other providers via appropriate CLI commands
 */

import * as vscode from 'vscode';
import type { IPCServer, ChatRequestPayload, StreamChunkPayload } from './ipc-server.js';
import type { CLIRequest, CLIResponse, CLIError, PendingChange, StreamingChunk } from './types.js';
import { DEFAULT_MODEL, CONFIG_NAMESPACE } from './constants.js';

// Re-export types for consumers
export type { CLIRequest, CLIResponse, CLIError, PendingChange, StreamingChunk };

/**
 * Supported AI providers
 */
export type Provider = 'grok' | 'glm' | 'openai' | 'anthropic' | 'deepseek';

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
export function getProviderFromModel(model: string): Provider {
  if (model.startsWith('grok-')) return 'grok';
  if (model.startsWith('glm-')) return 'glm';
  if (model.startsWith('gpt-') || model.startsWith('o1')) return 'openai';
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('deepseek-')) return 'deepseek';
  // Default to configured provider
  const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
  return config.get<Provider>('provider', 'grok');
}

/**
 * Validate configuration settings
 * Returns array of validation errors (empty if valid)
 */
export function validateConfiguration(): string[] {
  const errors: string[] = [];
  const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);

  // Validate provider
  const provider = config.get<string>('provider');
  const validProviders = ['grok', 'glm', 'openai', 'anthropic', 'deepseek'];
  if (provider && !validProviders.includes(provider)) {
    errors.push(`Invalid provider "${provider}". Valid options: ${validProviders.join(', ')}`);
  }

  // Validate maxToolRounds
  const maxToolRounds = config.get<number>('maxToolRounds');
  if (maxToolRounds !== undefined) {
    if (!Number.isInteger(maxToolRounds) || maxToolRounds < 1 || maxToolRounds > 1000) {
      errors.push(`Invalid maxToolRounds "${maxToolRounds}". Must be an integer between 1 and 1000.`);
    }
  }

  // Validate model matches provider
  const model = config.get<string>('model');
  if (model && provider) {
    const modelProvider = getProviderFromModel(model);
    if (modelProvider !== provider) {
      errors.push(`Model "${model}" doesn't match provider "${provider}". Model suggests "${modelProvider}" provider.`);
    }
  }

  return errors;
}

// Types are imported from './types.js' and re-exported above

/**
 * CLI Bridge SDK
 *
 * Bridges VS Code with the AX CLI tools (ax-grok, ax-glm).
 * API keys are managed externally via environment variables or CLI config.
 *
 * Communication modes:
 * 1. IPC Mode: When CLI is running in terminal and connected via WebSocket
 * 2. Terminal Mode: Opens terminal with CLI command (fallback)
 *
 * The IPC-based diff preview (Accept/Reject changes in VS Code) works
 * when running CLI tools in the integrated terminal.
 */
export class CLIBridgeSDK {
  private pendingChanges: Map<string, PendingChange> = new Map();
  private activeTerminal: vscode.Terminal | undefined;
  private ipcServer: IPCServer | null = null;
  private streamHandler: ((chunk: StreamingChunk) => void) | null = null;
  private chatHistory: Array<{ role: string; content: string; timestamp: string }> = [];

  constructor() {
    // Validate configuration on startup
    const errors = validateConfiguration();
    if (errors.length > 0) {
      vscode.window.showWarningMessage(
        `AX CLI configuration issues:\n${errors.join('\n')}`,
        'Open Settings'
      ).then((selection: string | undefined) => {
        if (selection === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', CONFIG_NAMESPACE);
        }
      });
    }
  }

  /**
   * Set IPC server reference for communication with CLI
   */
  public setIPCServer(server: IPCServer): void {
    this.ipcServer = server;

    // Set up stream chunk handler to forward to our stream handler
    server.setStreamChunkHandler((payload: StreamChunkPayload) => {
      if (this.streamHandler) {
        this.streamHandler({
          type: payload.type,
          content: payload.content,
          toolCall: payload.toolCall,
          toolResult: payload.toolResult,
          error: payload.error
        });
      }
    });
  }

  /**
   * Set diff preview handler (called by ChatViewProvider)
   * Note: Diff previews are now handled via IPC in ipc-server.ts
   * This method is kept for API compatibility but is a no-op
   */
  public setDiffPreviewHandler(_handler: (change: PendingChange) => void): void {
    // No-op - diff previews are handled by IPC server
    // The handler is passed but not stored since IPC handles all diff previews
  }

  /**
   * Approve or reject a pending change
   * Note: The actual approval is handled via IPC in ipc-server.ts
   */
  public approveChange(changeId: string, approved: boolean): void {
    const change = this.pendingChanges.get(changeId);
    if (change) {
      console.log(`[AX SDK] Change ${changeId} ${approved ? 'approved' : 'rejected'}`);
      this.pendingChanges.delete(changeId);
    }
  }

  /**
   * Get pending change details
   */
  public getPendingChange(changeId: string): PendingChange | undefined {
    return this.pendingChanges.get(changeId);
  }

  /**
   * Get all pending changes
   */
  public getAllPendingChanges(): PendingChange[] {
    return Array.from(this.pendingChanges.values());
  }

  /**
   * Get the CLI command and provider info for the current model
   */
  public getProviderInfo(): { provider: Provider; info: ProviderInfo } {
    const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
    const model = config.get<string>('model', DEFAULT_MODEL);
    const provider = getProviderFromModel(model);
    return { provider, info: PROVIDER_INFO[provider] };
  }

  /**
   * Check if CLI is connected via IPC
   */
  public isConnected(): boolean {
    return this.ipcServer !== null && this.ipcServer.getClientCount() > 0;
  }

  /**
   * Send a request to the CLI
   *
   * If CLI is connected via IPC, sends via WebSocket.
   * Otherwise, prompts user to open terminal.
   */
  async sendRequest(
    request: CLIRequest,
    onStream?: (chunk: StreamingChunk) => void
  ): Promise<CLIResponse | CLIError> {
    // Store stream handler for IPC callbacks
    this.streamHandler = onStream || null;

    // Store user message in history
    this.chatHistory.push({
      role: 'user',
      content: request.prompt,
      timestamp: new Date().toISOString()
    });

    try {
      const { provider, info } = this.getProviderInfo();

      // Check if CLI is connected via IPC
      if (this.isConnected() && this.ipcServer) {
        console.log('[AX SDK] Sending request via IPC');

        // Build file list from context
        const files: string[] = [];
        if (request.context?.file) files.push(request.context.file);
        if (request.context?.files) {
          files.push(...request.context.files.map(f => f.path));
        }

        // Build IPC payload with full context including images
        const payload: ChatRequestPayload = {
          sessionId: request.id,
          prompt: request.prompt,
          context: {
            files: files.length > 0 ? files : undefined,
            selection: request.context?.selection,
            extendedThinking: request.context?.extendedThinking ?? false,
            // Include images with base64 data for vision models
            images: request.context?.images?.map(img => ({
              path: img.path,
              name: img.name,
              dataUri: img.dataUri,
              mimeType: img.mimeType
            }))
          }
        };

        // Log image attachments
        if (payload.context?.images && payload.context.images.length > 0) {
          console.log(`[AX SDK] Sending ${payload.context.images.length} image(s) to CLI`);
        }

        // Send via IPC
        const sessionId = await this.ipcServer.sendChatRequest(payload);

        if (sessionId) {
          // Request sent successfully - responses will come via stream chunks
          return {
            id: request.id,
            messages: [{
              role: 'assistant',
              content: '' // Content will be streamed
            }],
            model: provider,
            timestamp: new Date().toISOString()
          };
        }

        // IPC send failed, fall through to terminal mode
        console.warn('[AX SDK] IPC send failed, falling back to terminal mode');
      }

      // Terminal mode - no IPC connection
      return await this.sendViaTerminal(request, info, provider);

    } catch (error) {
      console.error('[AX SDK] Unexpected error in sendRequest:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`AX CLI Error: ${errorMessage}`);
      return {
        id: request.id,
        error: {
          message: errorMessage,
          type: 'UnexpectedError',
        },
        timestamp: new Date().toISOString()
      };
    } finally {
      this.streamHandler = null;
    }
  }

  /**
   * Send request by opening terminal (fallback mode)
   */
  private async sendViaTerminal(
    request: CLIRequest,
    info: ProviderInfo,
    provider: Provider
  ): Promise<CLIResponse | CLIError> {
    // Show info message directing to terminal
    const selection = await vscode.window.showInformationMessage(
      `No CLI connected. Run "${info.command}" in the integrated terminal for full AI functionality.`,
      'Open Terminal',
      'Learn More'
    );

    if (selection === 'Open Terminal') {
      try {
        // Reuse existing terminal or create new one
        const terminalIsActive = this.activeTerminal && this.activeTerminal.exitStatus === undefined;
        if (!terminalIsActive) {
          this.activeTerminal = vscode.window.createTerminal({
            name: `AX CLI (${info.displayName})`,
          });
        }
        this.activeTerminal!.show();
        this.activeTerminal!.sendText(info.command);
      } catch (error) {
        console.error('[AX SDK] Failed to create terminal:', error);
        vscode.window.showErrorMessage('Failed to open terminal. Please open manually.');
      }
    } else if (selection === 'Learn More') {
      await vscode.env.openExternal(vscode.Uri.parse(info.docsUrl));
    }

    // Return helpful response
    return {
      id: request.id,
      messages: [{
        role: 'assistant',
        content: `**Getting Started with AX CLI**\n\n` +
                 `To use the AI assistant, run the CLI in your terminal:\n\n` +
                 `\`\`\`bash\n` +
                 `# Set your API key\n` +
                 `export ${info.envVar}=your-api-key\n\n` +
                 `# Start the CLI\n` +
                 `${info.command}\n` +
                 `\`\`\`\n\n` +
                 `**Features:**\n` +
                 `- Type naturally to ask questions or describe tasks\n` +
                 `- File changes appear as diffs for you to accept or reject\n` +
                 `- Use \`/help\` to see available commands\n\n` +
                 `Once the CLI is running, your messages here will be sent to the AI.`
      }],
      model: provider,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Interrupt current processing
   * Sends interrupt signal to connected CLI
   */
  interrupt(): void {
    // Check if terminal exists AND is still active (not closed/disposed)
    const terminalIsActive = this.activeTerminal && this.activeTerminal.exitStatus === undefined;
    if (terminalIsActive) {
      try {
        // Send Ctrl+C to terminal
        this.activeTerminal!.sendText('\x03', false);
      } catch (error) {
        console.warn('[AX SDK] Failed to send interrupt to terminal:', error);
      }
    }
    console.log('[AX SDK] Interrupt requested');
  }

  /**
   * Get chat history
   */
  getChatHistory(): Array<{ role: string; content: string; timestamp: string }> {
    return [...this.chatHistory];
  }

  /**
   * Clear chat history
   */
  clearHistory(): void {
    this.chatHistory = [];
    this.pendingChanges.clear();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.pendingChanges.clear();
    this.chatHistory = [];
    this.streamHandler = null;
    // Dispose active terminal if it exists
    if (this.activeTerminal) {
      this.activeTerminal.dispose();
      this.activeTerminal = undefined;
    }
  }

  /**
   * Check if agent is ready (CLI connected via IPC)
   */
  isReady(): boolean {
    return this.isConnected();
  }

  /**
   * Get connection status string
   */
  getStatus(): string {
    if (this.isConnected()) {
      const { info } = this.getProviderInfo();
      return `Connected to ${info.displayName}`;
    }
    return 'Not connected';
  }
}
