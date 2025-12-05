import * as vscode from 'vscode';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private configChangeListener: vscode.Disposable;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'ax-cli.selectModel';

    // Listen for configuration changes to keep status bar in sync
    this.configChangeListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('ax-cli.model')) {
        this.updateDisplay();
      }
    });

    this.updateDisplay();
  }

  private updateDisplay(): void {
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

  updateStatus(status: string): void {
    this.statusBarItem.text = `$(robot) AX: ${status}`;
  }

  setProcessing(isProcessing: boolean): void {
    if (isProcessing) {
      this.statusBarItem.text = `$(sync~spin) AX: Processing...`;
    } else {
      this.updateDisplay();
    }
  }

  show(): void {
    this.statusBarItem.show();
  }

  hide(): void {
    this.statusBarItem.hide();
  }

  dispose(): void {
    this.configChangeListener.dispose();
    this.statusBarItem.dispose();
  }
}
