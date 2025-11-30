import { exec } from "child_process";
import { promisify } from "util";
import { EventEmitter } from "events";
import { TIMEOUT_CONFIG } from "../constants.js";
import { getVSCodeIPCClient, type DiffPayload } from "../ipc/index.js";

const execAsync = promisify(exec);

export interface ConfirmationOptions {
  operation: string;
  filename: string;
  showVSCodeOpen?: boolean;
  content?: string; // Content to show in confirmation dialog
  alwaysConfirm?: boolean; // Phase 2: Force confirmation even in auto-accept mode
  // VS Code IPC diff preview fields
  oldContent?: string;
  newContent?: string;
  diffOperation?: 'create' | 'edit' | 'delete';
  lineStart?: number;
  lineEnd?: number;
}

export interface ConfirmationResult {
  confirmed: boolean;
  dontAskAgain?: boolean;
  feedback?: string;
}

export class ConfirmationService extends EventEmitter {
  private static instance: ConfirmationService;
  private pendingConfirmation: Promise<ConfirmationResult> | null = null;
  private resolveConfirmation: ((result: ConfirmationResult) => void) | null =
    null;
  private confirmationTimeoutId: NodeJS.Timeout | null = null;

  // Session flags for different operation types
  private sessionFlags = {
    fileOperations: false,
    bashCommands: false,
    allOperations: true, // Default to true (auto-edit enabled by default)
  };

  static getInstance(): ConfirmationService {
    if (!ConfirmationService.instance) {
      ConfirmationService.instance = new ConfirmationService();
    }
    return ConfirmationService.instance;
  }

  constructor() {
    super();
  }

  /**
   * Check if an operation should proceed based on session flags and user confirmation
   * Simplifies the common pattern of checking flags and requesting confirmation
   * @param operationType Type of operation (file or bash)
   * @param options Confirmation options
   * @returns True if operation should proceed, false if cancelled
   */
  async shouldProceed(
    operationType: "file" | "bash",
    options: ConfirmationOptions
  ): Promise<boolean> {
    // Phase 2: Check if we should always confirm despite auto-accept
    if (options.alwaysConfirm) {
      const result = await this.requestConfirmation(options, operationType);
      return result.confirmed;
    }

    // Check session flags first
    if (
      this.sessionFlags.allOperations ||
      (operationType === "file" && this.sessionFlags.fileOperations) ||
      (operationType === "bash" && this.sessionFlags.bashCommands)
    ) {
      return true;
    }

    // Request confirmation if not auto-approved
    const result = await this.requestConfirmation(options, operationType);
    return result.confirmed;
  }

  async requestConfirmation(
    options: ConfirmationOptions,
    operationType: "file" | "bash" = "file"
  ): Promise<ConfirmationResult> {
    // BUG FIX: Check session flags ONLY if alwaysConfirm is not set
    // When alwaysConfirm is true (e.g., destructive operations), we must prompt the user
    if (!options.alwaysConfirm) {
      if (
        this.sessionFlags.allOperations ||
        (operationType === "file" && this.sessionFlags.fileOperations) ||
        (operationType === "bash" && this.sessionFlags.bashCommands)
      ) {
        return { confirmed: true };
      }
    }

    // Check if there's already a pending confirmation to prevent race conditions
    if (this.pendingConfirmation !== null) {
      return {
        confirmed: false,
        feedback: 'Another confirmation is already pending. Please wait or cancel the current operation.'
      };
    }

    // Try VS Code IPC for diff preview if connected and we have diff content
    const ipcClient = getVSCodeIPCClient();
    if (ipcClient.isConnected() && operationType === 'file' && options.oldContent !== undefined && options.newContent !== undefined) {
      try {
        const diffPayload: DiffPayload = {
          id: `diff-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file: options.filename,
          oldContent: options.oldContent,
          newContent: options.newContent,
          diff: options.content || '',
          operation: options.diffOperation || 'edit',
          lineStart: options.lineStart,
          lineEnd: options.lineEnd,
          toolCall: {
            name: 'text_editor',
            command: options.operation
          }
        };

        const approved = await ipcClient.requestDiffApproval(diffPayload);
        return { confirmed: approved, feedback: approved ? undefined : 'Rejected in VS Code' };
      } catch {
        // Fall through to terminal confirmation if IPC fails
      }
    }

    // If VS Code should be opened, try to open it
    if (options.showVSCodeOpen) {
      try {
        await this.openInVSCode(options.filename);
      } catch {
        // If VS Code opening fails, continue without it
        options.showVSCodeOpen = false;
      }
    }

    // Clear any existing timeout first to prevent memory leaks
    if (this.confirmationTimeoutId) {
      clearTimeout(this.confirmationTimeoutId);
      this.confirmationTimeoutId = null;
    }

    // Create a promise that will be resolved by the UI component
    // Add a timeout to prevent hanging indefinitely
    // Use resolved flag to prevent race condition between timeout and user action
    const resolvedState = { resolved: false };
    this.pendingConfirmation = new Promise<ConfirmationResult>((resolve) => {
      const safeResolve = (result: ConfirmationResult) => {
        if (resolvedState.resolved) return; // Already resolved, ignore
        resolvedState.resolved = true;
        resolve(result);
      };

      this.resolveConfirmation = safeResolve;

      // Set a configurable timeout for confirmation
      const timeoutMs = TIMEOUT_CONFIG.CONFIRMATION_TIMEOUT;
      const timeoutSec = Math.round(timeoutMs / TIMEOUT_CONFIG.MS_PER_SECOND);
      this.confirmationTimeoutId = setTimeout(() => {
        safeResolve({
          confirmed: false,
          feedback: `Confirmation timeout - auto-rejected after ${timeoutSec} seconds`
        });
        this.resolveConfirmation = null;
        this.pendingConfirmation = null;
        this.confirmationTimeoutId = null;
      }, timeoutMs);
    });

    // Emit custom event that the UI can listen to (using setImmediate to ensure the UI updates)
    setImmediate(() => {
      this.emit("confirmation-requested", options);
    });

    const result = await this.pendingConfirmation;

    if (result.dontAskAgain) {
      // Set the appropriate session flag based on operation type
      if (operationType === "file") {
        this.sessionFlags.fileOperations = true;
      } else if (operationType === "bash") {
        this.sessionFlags.bashCommands = true;
      }
      // Could also set allOperations for global skip
    }

    return result;
  }

  confirmOperation(confirmed: boolean, dontAskAgain?: boolean): void {
    if (this.resolveConfirmation) {
      // Clear the timeout if it exists
      if (this.confirmationTimeoutId) {
        clearTimeout(this.confirmationTimeoutId);
        this.confirmationTimeoutId = null;
      }

      this.resolveConfirmation({ confirmed, dontAskAgain });
      this.resolveConfirmation = null;
      this.pendingConfirmation = null;
    }
  }

  rejectOperation(feedback?: string): void {
    if (this.resolveConfirmation) {
      // Clear the timeout if it exists
      if (this.confirmationTimeoutId) {
        clearTimeout(this.confirmationTimeoutId);
        this.confirmationTimeoutId = null;
      }

      this.resolveConfirmation({ confirmed: false, feedback });
      this.resolveConfirmation = null;
      this.pendingConfirmation = null;
    }
  }

  private async openInVSCode(filename: string): Promise<void> {
    // Try different VS Code commands
    const commands = ["code", "code-insiders", "codium"];
    const isWindows = process.platform === "win32";
    const whichCmd = isWindows ? "where" : "which";

    for (const cmd of commands) {
      try {
        await execAsync(`${whichCmd} ${cmd}`);
        // Properly escape filename to prevent command injection
        // Replace single quotes with '\'' and wrap in single quotes (Unix)
        // On Windows, use double quotes
        const escapedFilename = isWindows
          ? `"${filename.replace(/"/g, '\\"')}"`
          : `'${filename.replace(/'/g, "'\\''")}'`;
        await execAsync(`${cmd} ${escapedFilename}`);
        return;
      } catch {
        // Continue to next command
        continue;
      }
    }

    throw new Error("VS Code not found");
  }

  isPending(): boolean {
    return this.pendingConfirmation !== null;
  }

  resetSession(): void {
    this.sessionFlags = {
      fileOperations: false,
      bashCommands: false,
      allOperations: false,
    };
  }

  getSessionFlags() {
    return { ...this.sessionFlags };
  }

  setSessionFlag(
    flagType: "fileOperations" | "bashCommands" | "allOperations",
    value: boolean
  ) {
    this.sessionFlags[flagType] = value;
  }
}
