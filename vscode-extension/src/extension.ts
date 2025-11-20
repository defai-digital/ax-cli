import * as vscode from 'vscode';
import { CLIBridge } from './cli-bridge';
import { ChatViewProvider } from './chat-view-provider';
import { ContextProvider } from './context-provider';
import { StatusBarManager } from './status-bar';

let cliBridge: CLIBridge | undefined;
let chatProvider: ChatViewProvider | undefined;
let contextProvider: ContextProvider | undefined;
let statusBar: StatusBarManager | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('AX CLI extension is now active');

  // Initialize components
  cliBridge = new CLIBridge();
  contextProvider = new ContextProvider();
  statusBar = new StatusBarManager();
  chatProvider = new ChatViewProvider(context.extensionUri, cliBridge);

  // Register webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider)
  );

  // Register commands
  registerCommands(context);

  // Show status bar
  statusBar.show();
}

function registerCommands(context: vscode.ExtensionContext) {
  // Open chat command
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.openChat', () => {
      vscode.commands.executeCommand('ax-cli.chatView.focus');
    })
  );

  // Analyze current file
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.analyzeFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const context = await contextProvider!.getCurrentFileContext(editor);
      chatProvider?.sendMessage('Analyze this file and suggest improvements', context);
      vscode.commands.executeCommand('ax-cli.chatView.focus');
    })
  );

  // Explain selection
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.explainSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('No text selected');
        return;
      }

      const context = await contextProvider!.getSelectionContext(editor);
      chatProvider?.sendMessage('Explain this code in detail', context);
      vscode.commands.executeCommand('ax-cli.chatView.focus');
    })
  );

  // Generate tests
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.generateTests', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const context = await contextProvider!.getCurrentFileContext(editor);
      chatProvider?.sendMessage('Generate comprehensive unit tests for this file', context);
      vscode.commands.executeCommand('ax-cli.chatView.focus');
    })
  );

  // Refactor selection
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.refactorSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('No text selected');
        return;
      }

      const context = await contextProvider!.getSelectionContext(editor);
      chatProvider?.sendMessage('Suggest refactorings to improve code quality', context);
      vscode.commands.executeCommand('ax-cli.chatView.focus');
    })
  );

  // Document code
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.documentCode', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('No text selected');
        return;
      }

      const context = await contextProvider!.getSelectionContext(editor);
      chatProvider?.sendMessage('Generate documentation for this code', context);
      vscode.commands.executeCommand('ax-cli.chatView.focus');
    })
  );

  // Find bugs
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.findBugs', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const context = await contextProvider!.getCurrentFileContext(editor);
      chatProvider?.sendMessage('Analyze for potential bugs and security issues', context);
      vscode.commands.executeCommand('ax-cli.chatView.focus');
    })
  );

  // Review git changes
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.reviewChanges', async () => {
      const context = await contextProvider!.getGitDiffContext();
      if (!context.gitDiff) {
        vscode.window.showInformationMessage('No uncommitted changes found');
        return;
      }

      chatProvider?.sendMessage('Review these changes and suggest improvements', context);
      vscode.commands.executeCommand('ax-cli.chatView.focus');
    })
  );

  // Select model
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.selectModel', async () => {
      const models = [
        'grok-code-fast-1',
        'grok-4-latest',
        'glm-4.6',
        'claude-3-5-sonnet-20241022',
        'gpt-4o',
        'deepseek-chat',
      ];

      const selected = await vscode.window.showQuickPick(models, {
        placeHolder: 'Select AI model',
      });

      if (selected) {
        const config = vscode.workspace.getConfiguration('ax-cli');
        await config.update('model', selected, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Model changed to: ${selected}`);
        statusBar?.updateModel(selected);
      }
    })
  );

  // Configure settings
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.configure', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'ax-cli');
    })
  );
}

export function deactivate() {
  cliBridge?.dispose();
  statusBar?.dispose();
}
