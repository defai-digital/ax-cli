import { exec } from "child_process";
import { promisify } from "util";
import { EventEmitter } from "events";

const execAsync = promisify(exec);

export interface ConfirmationOptions {
  operation: string;
  filename: string;
  showVSCodeOpen?: boolean;
  content?: string; // Content to show in confirmation dialog
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
    allOperations: false,
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
    // Check session flags
    if (
      this.sessionFlags.allOperations ||
      (operationType === "file" && this.sessionFlags.fileOperations) ||
      (operationType === "bash" && this.sessionFlags.bashCommands)
    ) {
      return { confirmed: true };
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

    // Create a promise that will be resolved by the UI component
    // Add a timeout to prevent hanging indefinitely
    this.pendingConfirmation = new Promise<ConfirmationResult>((resolve) => {
      this.resolveConfirmation = resolve;

      // Set a timeout of 60 seconds for confirmation
      const timeoutId = setTimeout(() => {
        if (this.resolveConfirmation) {
          this.resolveConfirmation({
            confirmed: false,
            feedback: 'Confirmation timeout - auto-rejected after 60 seconds'
          });
          this.resolveConfirmation = null;
          this.pendingConfirmation = null;
        }
      }, 60000); // 60 second timeout

      // Store timeout ID to clear it if confirmation comes early
      this.confirmationTimeoutId = timeoutId;
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

    for (const cmd of commands) {
      try {
        await execAsync(`which ${cmd}`);
        await execAsync(`${cmd} "${filename}"`);
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
