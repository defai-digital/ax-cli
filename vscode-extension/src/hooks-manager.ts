/**
 * Hooks Manager - Event hooks for extending CLI behavior
 *
 * Similar to Claude Code's hooks system that automatically triggers
 * actions at specific points, such as running test suites after
 * code changes or linting before commits.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type HookEvent =
  | 'pre-edit'      // Before file is edited
  | 'post-edit'     // After file is edited
  | 'pre-create'    // Before file is created
  | 'post-create'   // After file is created
  | 'pre-delete'    // Before file is deleted
  | 'post-delete'   // After file is deleted
  | 'pre-commit'    // Before git commit
  | 'post-commit'   // After git commit
  | 'task-start'    // When a task starts
  | 'task-complete' // When a task completes
  | 'error'         // When an error occurs
  | 'chat-message'; // When user sends a message

export interface Hook {
  id: string;
  name: string;
  event: HookEvent;
  command: string;
  enabled: boolean;
  workingDir?: string;
  timeout?: number;
  continueOnError?: boolean;
}

export interface HookResult {
  hook: Hook;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
}

export interface HookContext {
  event: HookEvent;
  file?: string;
  files?: string[];
  message?: string;
  taskId?: string;
  error?: string;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const HOOKS_CONFIG_FILE = '.ax-cli/hooks.json';

export class HooksManager implements vscode.Disposable {
  private hooks: Map<string, Hook> = new Map();
  private disposables: vscode.Disposable[] = [];
  private workspaceRoot: string | undefined;
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    this.outputChannel = vscode.window.createOutputChannel('AX CLI Hooks');
    this.loadHooks();

    // Watch for hooks config changes
    if (this.workspaceRoot) {
      const configPath = path.join(this.workspaceRoot, HOOKS_CONFIG_FILE);
      const watcher = vscode.workspace.createFileSystemWatcher(configPath);

      watcher.onDidChange(() => this.loadHooks());
      watcher.onDidCreate(() => this.loadHooks());
      watcher.onDidDelete(() => this.hooks.clear());

      this.disposables.push(watcher);
    }
  }

  /**
   * Load hooks from workspace config
   */
  private loadHooks(): void {
    if (!this.workspaceRoot) return;

    const configPath = path.join(this.workspaceRoot, HOOKS_CONFIG_FILE);

    try {
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(data);

        this.hooks.clear();

        if (Array.isArray(config.hooks)) {
          for (const hook of config.hooks) {
            if (hook.id && hook.event && hook.command) {
              this.hooks.set(hook.id, {
                id: hook.id,
                name: hook.name || hook.id,
                event: hook.event,
                command: hook.command,
                enabled: hook.enabled !== false,
                workingDir: hook.workingDir,
                timeout: hook.timeout || DEFAULT_TIMEOUT,
                continueOnError: hook.continueOnError ?? true
              });
            }
          }
        }

        console.log(`[AX Hooks] Loaded ${this.hooks.size} hooks`);
      }
    } catch (error) {
      console.error('[AX Hooks] Failed to load hooks:', error);
    }
  }

  /**
   * Save hooks to workspace config
   */
  private saveHooks(): void {
    if (!this.workspaceRoot) return;

    const configPath = path.join(this.workspaceRoot, HOOKS_CONFIG_FILE);
    const configDir = path.dirname(configPath);

    try {
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const config = {
        hooks: Array.from(this.hooks.values())
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('[AX Hooks] Failed to save hooks:', error);
    }
  }

  /**
   * Trigger hooks for an event
   */
  async triggerHooks(context: HookContext): Promise<HookResult[]> {
    const results: HookResult[] = [];
    const matchingHooks = Array.from(this.hooks.values())
      .filter(h => h.enabled && h.event === context.event);

    if (matchingHooks.length === 0) {
      return results;
    }

    this.outputChannel.appendLine(`\n[${new Date().toISOString()}] Triggering ${context.event} hooks...`);

    for (const hook of matchingHooks) {
      const result = await this.executeHook(hook, context);
      results.push(result);

      if (!result.success && !hook.continueOnError) {
        this.outputChannel.appendLine(`[${hook.name}] Hook failed and continueOnError is false, stopping`);
        break;
      }
    }

    return results;
  }

  /**
   * Escape a string for safe use in shell commands
   * Wraps the value in single quotes and escapes any single quotes within
   */
  private escapeShellArg(arg: string): string {
    // Replace single quotes with escaped version and wrap in single quotes
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Execute a single hook
   */
  private async executeHook(hook: Hook, context: HookContext): Promise<HookResult> {
    const startTime = Date.now();

    this.outputChannel.appendLine(`[${hook.name}] Running: ${hook.command}`);

    try {
      // Replace placeholders in command with escaped values to prevent command injection
      let command = hook.command;
      command = command.replace(/\$\{file\}/g, context.file ? this.escapeShellArg(context.file) : '');
      command = command.replace(/\$\{files\}/g, (context.files || []).map(f => this.escapeShellArg(f)).join(' '));
      command = command.replace(/\$\{message\}/g, context.message ? this.escapeShellArg(context.message) : '');
      command = command.replace(/\$\{taskId\}/g, context.taskId ? this.escapeShellArg(context.taskId) : '');
      command = command.replace(/\$\{error\}/g, context.error ? this.escapeShellArg(context.error) : '');

      const workingDir = hook.workingDir
        ? path.resolve(this.workspaceRoot || '', hook.workingDir)
        : this.workspaceRoot;

      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        timeout: hook.timeout || DEFAULT_TIMEOUT,
        env: {
          ...process.env,
          AX_HOOK_EVENT: context.event,
          AX_HOOK_FILE: context.file || '',
          AX_HOOK_TASK_ID: context.taskId || ''
        }
      });

      const output = stdout + (stderr ? `\nstderr: ${stderr}` : '');
      const duration = Date.now() - startTime;

      this.outputChannel.appendLine(`[${hook.name}] Completed in ${duration}ms`);
      if (output.trim()) {
        this.outputChannel.appendLine(output);
      }

      return {
        hook,
        success: true,
        output,
        duration
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error.message || String(error);

      this.outputChannel.appendLine(`[${hook.name}] Failed: ${errorMessage}`);

      return {
        hook,
        success: false,
        error: errorMessage,
        duration
      };
    }
  }

  /**
   * Add a new hook
   */
  addHook(hook: Omit<Hook, 'id'>): Hook {
    const id = `hook-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newHook: Hook = {
      ...hook,
      id,
      enabled: hook.enabled !== false,
      timeout: hook.timeout || DEFAULT_TIMEOUT,
      continueOnError: hook.continueOnError ?? true
    };

    this.hooks.set(id, newHook);
    this.saveHooks();

    return newHook;
  }

  /**
   * Update an existing hook
   */
  updateHook(id: string, updates: Partial<Hook>): boolean {
    const hook = this.hooks.get(id);
    if (!hook) return false;

    Object.assign(hook, updates);
    this.saveHooks();

    return true;
  }

  /**
   * Remove a hook
   */
  removeHook(id: string): boolean {
    const deleted = this.hooks.delete(id);
    if (deleted) {
      this.saveHooks();
    }
    return deleted;
  }

  /**
   * Get all hooks
   */
  getAllHooks(): Hook[] {
    return Array.from(this.hooks.values());
  }

  /**
   * Get hooks for a specific event
   */
  getHooksForEvent(event: HookEvent): Hook[] {
    return Array.from(this.hooks.values())
      .filter(h => h.event === event);
  }

  /**
   * Enable/disable a hook
   */
  setHookEnabled(id: string, enabled: boolean): boolean {
    return this.updateHook(id, { enabled });
  }

  /**
   * Show hooks management UI
   */
  async showHooksMenu(): Promise<void> {
    const hooks = this.getAllHooks();

    const items: Array<vscode.QuickPickItem & { action: string; hookId?: string }> = [
      { label: '$(add) Add Hook', description: 'Create a new hook', action: 'add' },
      { label: '$(output) Show Output', description: 'View hook execution logs', action: 'output' },
      { label: '', kind: vscode.QuickPickItemKind.Separator, action: '' },
    ];

    for (const hook of hooks) {
      items.push({
        label: `${hook.enabled ? '$(check)' : '$(circle-slash)'} ${hook.name}`,
        description: `${hook.event} → ${hook.command}`,
        detail: hook.enabled ? 'Enabled' : 'Disabled',
        action: 'edit',
        hookId: hook.id
      });
    }

    if (hooks.length === 0) {
      items.push({
        label: '$(info) No hooks configured',
        description: 'Add hooks to automate tasks',
        action: 'none'
      });
    }

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Manage Hooks',
      title: 'AX CLI Hooks'
    });

    if (!selected) return;

    switch (selected.action) {
      case 'add':
        await this.showAddHookDialog();
        break;
      case 'output':
        this.outputChannel.show();
        break;
      case 'edit':
        if (selected.hookId) {
          await this.showEditHookDialog(selected.hookId);
        }
        break;
    }
  }

  /**
   * Show add hook dialog
   */
  private async showAddHookDialog(): Promise<void> {
    const events: HookEvent[] = [
      'pre-edit', 'post-edit', 'pre-create', 'post-create',
      'pre-delete', 'post-delete', 'pre-commit', 'post-commit',
      'task-start', 'task-complete', 'error', 'chat-message'
    ];

    const event = await vscode.window.showQuickPick(
      events.map(e => ({ label: e, description: this.getEventDescription(e) })),
      { placeHolder: 'Select event to trigger hook' }
    );

    if (!event) return;

    const name = await vscode.window.showInputBox({
      prompt: 'Hook name',
      placeHolder: 'e.g., Run Tests'
    });

    if (!name) return;

    const command = await vscode.window.showInputBox({
      prompt: 'Command to run',
      placeHolder: 'e.g., npm test ${file}'
    });

    if (!command) return;

    const hook = this.addHook({
      name,
      event: event.label as HookEvent,
      command,
      enabled: true
    });

    vscode.window.showInformationMessage(`Hook "${hook.name}" created`);
  }

  /**
   * Show edit hook dialog
   */
  private async showEditHookDialog(hookId: string): Promise<void> {
    const hook = this.hooks.get(hookId);
    if (!hook) return;

    const actions = [
      { label: hook.enabled ? '$(circle-slash) Disable' : '$(check) Enable', action: 'toggle' },
      { label: '$(edit) Edit Command', action: 'edit' },
      { label: '$(trash) Delete', action: 'delete' },
      { label: '$(play) Test Run', action: 'test' }
    ];

    const selected = await vscode.window.showQuickPick(actions, {
      placeHolder: `Hook: ${hook.name}`
    });

    if (!selected) return;

    switch (selected.action) {
      case 'toggle':
        const newEnabledState = !hook.enabled;
        this.setHookEnabled(hookId, newEnabledState);
        vscode.window.showInformationMessage(
          `Hook "${hook.name}" ${newEnabledState ? 'enabled' : 'disabled'}`
        );
        break;

      case 'edit':
        const newCommand = await vscode.window.showInputBox({
          prompt: 'Edit command',
          value: hook.command
        });
        if (newCommand) {
          this.updateHook(hookId, { command: newCommand });
          vscode.window.showInformationMessage(`Hook "${hook.name}" updated`);
        }
        break;

      case 'delete':
        const confirmed = await vscode.window.showWarningMessage(
          `Delete hook "${hook.name}"?`,
          { modal: true },
          'Delete'
        );
        if (confirmed === 'Delete') {
          this.removeHook(hookId);
          vscode.window.showInformationMessage(`Hook "${hook.name}" deleted`);
        }
        break;

      case 'test':
        this.outputChannel.show();
        const result = await this.executeHook(hook, {
          event: hook.event,
          file: vscode.window.activeTextEditor?.document.uri.fsPath
        });
        if (result.success) {
          vscode.window.showInformationMessage(`Hook "${hook.name}" executed successfully`);
        } else {
          vscode.window.showErrorMessage(`Hook "${hook.name}" failed: ${result.error}`);
        }
        break;
    }
  }

  /**
   * Get description for hook event
   */
  private getEventDescription(event: HookEvent): string {
    const descriptions: Record<HookEvent, string> = {
      'pre-edit': 'Before a file is edited',
      'post-edit': 'After a file is edited',
      'pre-create': 'Before a file is created',
      'post-create': 'After a file is created',
      'pre-delete': 'Before a file is deleted',
      'post-delete': 'After a file is deleted',
      'pre-commit': 'Before git commit',
      'post-commit': 'After git commit',
      'task-start': 'When a task starts',
      'task-complete': 'When a task completes',
      'error': 'When an error occurs',
      'chat-message': 'When user sends a message'
    };
    return descriptions[event];
  }

  /**
   * Create default hooks config
   */
  async createDefaultConfig(): Promise<void> {
    if (!this.workspaceRoot) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const configPath = path.join(this.workspaceRoot, HOOKS_CONFIG_FILE);

    if (fs.existsSync(configPath)) {
      const overwrite = await vscode.window.showWarningMessage(
        'Hooks config already exists. Overwrite?',
        'Yes', 'No'
      );
      if (overwrite !== 'Yes') return;
    }

    const defaultConfig = {
      hooks: [
        {
          id: 'lint-on-edit',
          name: 'Lint on Edit',
          event: 'post-edit',
          command: 'npm run lint -- ${file}',
          enabled: false,
          continueOnError: true
        },
        {
          id: 'test-on-edit',
          name: 'Run Tests',
          event: 'post-edit',
          command: 'npm test -- --findRelatedTests ${file}',
          enabled: false,
          continueOnError: true
        },
        {
          id: 'format-on-create',
          name: 'Format New Files',
          event: 'post-create',
          command: 'npx prettier --write ${file}',
          enabled: false,
          continueOnError: true
        }
      ]
    };

    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    this.loadHooks();

    vscode.window.showInformationMessage('Default hooks config created');

    // Open the config file
    const doc = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(doc);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.outputChannel.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
