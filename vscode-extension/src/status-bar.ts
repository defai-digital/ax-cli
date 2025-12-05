import * as vscode from 'vscode';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private configChangeListener: vscode.Disposable;
  private statusResetTimeoutId: ReturnType<typeof setTimeout> | undefined;
  private isDisposed = false;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'ax-cli.selectModel';

    // Listen for configuration changes to keep status bar in sync
    this.configChangeListener = vscode.workspace.onDidChangeConfiguration((e) => {
      // Guard against config changes after disposal
      if (this.isDisposed) {
        return;
      }
      if (e.affectsConfiguration('ax-cli.model')) {
        this.updateDisplay();
      }
    });

    this.updateDisplay();
  }

  private updateDisplay(): void {
    // Guard against updates after disposal
    if (this.isDisposed) {
      return;
    }

    const config = vscode.workspace.getConfiguration('ax-cli');
    const model = config.get<string>('model', 'grok-code-fast-1');

    this.statusBarItem.text = `$(robot) AX: ${this.formatModelName(model)}`;
    this.statusBarItem.tooltip = `AX CLI - Click to change model\nCurrent: ${model}`;
  }

  private formatModelName(model: string): string {
    // Shorten model names for display
    const shortNames: Record<string, string> = {
      'grok-code-fast-1': 'Grok Fast',
      'grok-4-latest': 'Grok 4',
      'glm-4.6': 'GLM 4.6',
      'claude-3-5-sonnet-20241022': 'Claude 3.5',
      'gpt-4o': 'GPT-4o',
      'deepseek-chat': 'DeepSeek',
    };

    return shortNames[model] || model;
  }

  updateModel(_model: string): void {
    this.updateDisplay();
  }

  /**
   * Temporarily show a status message, then revert to model display
   * @param status - The status message to show
   * @param autoResetMs - Time in ms before reverting to model display (default: 5000, 0 = no auto-reset)
   */
  updateStatus(status: string, autoResetMs = 5000): void {
    // Guard against updates after disposal
    if (this.isDisposed) {
      return;
    }

    // Clear any existing reset timeout
    if (this.statusResetTimeoutId !== undefined) {
      clearTimeout(this.statusResetTimeoutId);
      this.statusResetTimeoutId = undefined;
    }

    this.statusBarItem.text = `$(robot) AX: ${status}`;

    // Auto-reset to model display after specified time
    if (autoResetMs > 0) {
      this.statusResetTimeoutId = setTimeout(() => {
        this.statusResetTimeoutId = undefined;
        this.updateDisplay();
      }, autoResetMs);
    }
  }

  setProcessing(isProcessing: boolean): void {
    // Guard against updates after disposal
    if (this.isDisposed) {
      return;
    }

    // Clear any existing reset timeout when changing processing state
    if (this.statusResetTimeoutId !== undefined) {
      clearTimeout(this.statusResetTimeoutId);
      this.statusResetTimeoutId = undefined;
    }

    if (isProcessing) {
      this.statusBarItem.text = `$(sync~spin) AX: Processing...`;
    } else {
      this.updateDisplay();
    }
  }

  show(): void {
    if (!this.isDisposed) {
      this.statusBarItem.show();
    }
  }

  hide(): void {
    if (!this.isDisposed) {
      this.statusBarItem.hide();
    }
  }

  dispose(): void {
    this.isDisposed = true;

    // Clear any pending timeout
    if (this.statusResetTimeoutId !== undefined) {
      clearTimeout(this.statusResetTimeoutId);
      this.statusResetTimeoutId = undefined;
    }

    this.configChangeListener.dispose();
    this.statusBarItem.dispose();
  }
}
