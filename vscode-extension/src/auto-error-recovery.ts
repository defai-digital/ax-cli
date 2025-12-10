/**
 * Auto Error Recovery - Monitors for errors and attempts auto-fix
 *
 * Similar to GitHub Copilot's agent mode that automatically fixes
 * compile and lint errors until the task is complete.
 */

import * as vscode from 'vscode';

export interface RecoveryResult {
  success: boolean;
  attempts: number;
  errors: string[];
  fixed: string[];
}

export interface RecoveryOptions {
  maxAttempts?: number;
  delayBetweenAttempts?: number;
  onAttempt?: (attempt: number, errors: vscode.Diagnostic[]) => void;
  onFixed?: (fixed: string[]) => void;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_DELAY_MS = 1000;

export class AutoErrorRecovery implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private isRecovering: boolean = false;
  private recoveryCallback: ((errors: vscode.Diagnostic[], filePath: string) => Promise<boolean>) | null = null;
  private pendingTimeoutId: NodeJS.Timeout | null = null;

  constructor() {
    // Listen for diagnostic changes
    this.disposables.push(
      vscode.languages.onDidChangeDiagnostics(this.handleDiagnosticsChange.bind(this))
    );
  }

  /**
   * Set the callback that will be invoked to fix errors
   * The callback should return true if it attempted a fix
   */
  setRecoveryCallback(callback: (errors: vscode.Diagnostic[], filePath: string) => Promise<boolean>): void {
    this.recoveryCallback = callback;
  }

  /**
   * Handle diagnostic changes
   */
  private async handleDiagnosticsChange(event: vscode.DiagnosticChangeEvent): Promise<void> {
    // Only process if we have a recovery callback and not already recovering
    if (!this.recoveryCallback || this.isRecovering) {
      return;
    }

    // Check each changed URI for errors
    for (const uri of event.uris) {
      const diagnostics = vscode.languages.getDiagnostics(uri);
      const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);

      if (errors.length > 0) {
        console.log(`[AX Recovery] Detected ${errors.length} errors in ${uri.fsPath}`);
      }
    }
  }

  /**
   * Attempt to automatically fix errors in the workspace
   */
  async attemptAutoFix(options: RecoveryOptions = {}): Promise<RecoveryResult> {
    const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const delay = options.delayBetweenAttempts ?? DEFAULT_DELAY_MS;

    const result: RecoveryResult = {
      success: false,
      attempts: 0,
      errors: [],
      fixed: []
    };

    if (this.isRecovering) {
      console.log('[AX Recovery] Already recovering, skipping');
      return result;
    }

    this.isRecovering = true;

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        result.attempts = attempt;

        // Get all current errors
        const allErrors = this.getAllErrors();

        if (allErrors.length === 0) {
          result.success = true;
          console.log('[AX Recovery] No errors found, success!');
          break;
        }

        console.log(`[AX Recovery] Attempt ${attempt}/${maxAttempts}: ${allErrors.length} errors`);

        // Notify callback
        if (options.onAttempt) {
          options.onAttempt(attempt, allErrors.map(e => e.diagnostic));
        }

        // Group errors by file
        const errorsByFile = new Map<string, vscode.Diagnostic[]>();
        for (const { uri, diagnostic } of allErrors) {
          const filePath = uri.fsPath;
          if (!errorsByFile.has(filePath)) {
            errorsByFile.set(filePath, []);
          }
          errorsByFile.get(filePath)!.push(diagnostic);
        }

        // Try to fix errors in each file
        let anyFixed = false;
        for (const [filePath, diagnostics] of errorsByFile) {
          result.errors.push(...diagnostics.map(d => `${filePath}: ${d.message}`));

          if (this.recoveryCallback) {
            try {
              const fixed = await this.recoveryCallback(diagnostics, filePath);
              if (fixed) {
                anyFixed = true;
                result.fixed.push(filePath);
              }
            } catch (error) {
              console.error(`[AX Recovery] Error fixing ${filePath}:`, error);
            }
          }
        }

        if (!anyFixed) {
          console.log('[AX Recovery] No fixes applied, stopping');
          break;
        }

        // Wait for diagnostics to update
        await this.waitForDiagnostics(delay);
      }

      // Final check
      const remainingErrors = this.getAllErrors();
      result.success = remainingErrors.length === 0;

      if (options.onFixed && result.fixed.length > 0) {
        options.onFixed(result.fixed);
      }

    } finally {
      this.isRecovering = false;
    }

    return result;
  }

  /**
   * Get all errors from all open documents
   */
  getAllErrors(): Array<{ uri: vscode.Uri; diagnostic: vscode.Diagnostic }> {
    const errors: Array<{ uri: vscode.Uri; diagnostic: vscode.Diagnostic }> = [];

    // Get diagnostics for all documents
    const allDiagnostics = vscode.languages.getDiagnostics();

    for (const [uri, diagnostics] of allDiagnostics) {
      for (const diagnostic of diagnostics) {
        if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
          errors.push({ uri, diagnostic });
        }
      }
    }

    return errors;
  }

  /**
   * Get errors for a specific file
   */
  getFileErrors(filePath: string): vscode.Diagnostic[] {
    const uri = vscode.Uri.file(filePath);
    const diagnostics = vscode.languages.getDiagnostics(uri);
    return diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
  }

  /**
   * Format errors for display or sending to LLM
   */
  formatErrors(errors: Array<{ uri: vscode.Uri; diagnostic: vscode.Diagnostic }>): string {
    if (errors.length === 0) {
      return 'No errors found.';
    }

    const lines: string[] = [`Found ${errors.length} error(s):\n`];

    // Group by file
    const byFile = new Map<string, vscode.Diagnostic[]>();
    for (const { uri, diagnostic } of errors) {
      const path = uri.fsPath;
      if (!byFile.has(path)) {
        byFile.set(path, []);
      }
      byFile.get(path)!.push(diagnostic);
    }

    for (const [filePath, diagnostics] of byFile) {
      lines.push(`\n${filePath}:`);
      for (const d of diagnostics) {
        const line = d.range.start.line + 1;
        const col = d.range.start.character + 1;
        const source = d.source ? `[${d.source}] ` : '';
        lines.push(`  Line ${line}:${col}: ${source}${d.message}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Wait for diagnostics to update
   * Timeout is tracked and cleared on dispose to prevent memory leaks
   */
  private waitForDiagnostics(ms: number): Promise<void> {
    return new Promise(resolve => {
      // Clear any existing timeout to prevent leaks
      if (this.pendingTimeoutId) {
        clearTimeout(this.pendingTimeoutId);
      }
      this.pendingTimeoutId = setTimeout(() => {
        this.pendingTimeoutId = null;
        resolve();
      }, ms);
    });
  }

  /**
   * Check if there are any errors in the workspace
   */
  hasErrors(): boolean {
    return this.getAllErrors().length > 0;
  }

  /**
   * Get error count
   */
  getErrorCount(): number {
    return this.getAllErrors().length;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    // Clear any pending timeout to prevent memory leaks
    if (this.pendingTimeoutId) {
      clearTimeout(this.pendingTimeoutId);
      this.pendingTimeoutId = null;
    }
    this.disposables.forEach(d => d.dispose());
  }
}
