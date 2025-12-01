import { ToolResult } from '../types/index.js';
import { ConfirmationService, ConfirmationOptions } from '../utils/confirmation-service.js';
import { extractErrorMessage } from '../utils/error-handler.js';

export interface ConfirmationRequest {
  operation: string;
  filename: string;
  description?: string;
  showVSCodeOpen?: boolean;
  autoAccept?: boolean;
}

export class ConfirmationTool {
  private confirmationService: ConfirmationService;

  constructor() {
    this.confirmationService = ConfirmationService.getInstance();
  }

  async requestConfirmation(request: ConfirmationRequest): Promise<ToolResult> {
    try {
      // If autoAccept is true, skip the confirmation dialog
      if (request.autoAccept) {
        return {
          success: true,
          output: `Auto-accepted: ${request.operation}(${request.filename})${request.description ? ` - ${request.description}` : ''}`
        };
      }

      const options: ConfirmationOptions = {
        operation: request.operation,
        filename: request.filename,
        showVSCodeOpen: request.showVSCodeOpen || false
      };

      // Determine operation type based on operation name
      // BUG FIX: Use exact match or prefix instead of includes() to avoid false positives
      // (e.g., "rebase" or "dashboard" incorrectly matching "bash")
      const opLower = request.operation.toLowerCase();
      const operationType = (opLower === 'bash' || opLower.startsWith('bash:') || opLower.startsWith('bash_')) ? 'bash' : 'file';
      const result = await this.confirmationService.requestConfirmation(options, operationType);

      if (result.confirmed) {
        return {
          success: true,
          output: `User confirmed: ${request.operation}(${request.filename})${request.description ? ` - ${request.description}` : ''}${result.dontAskAgain ? ' (Don\'t ask again enabled)' : ''}`
        };
      } else {
        return {
          success: false,
          error: result.feedback || `User rejected: ${request.operation}(${request.filename})`
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Confirmation error: ${extractErrorMessage(error)}`
      };
    }
  }

  async checkSessionAcceptance(): Promise<ToolResult> {
    try {
      const sessionFlags = this.confirmationService.getSessionFlags();
      // Return structured data without JSON output to avoid displaying raw JSON
      return {
        success: true,
        data: {
          fileOperationsAccepted: sessionFlags.fileOperations,
          bashCommandsAccepted: sessionFlags.bashCommands,
          allOperationsAccepted: sessionFlags.allOperations,
          hasAnyAcceptance: sessionFlags.fileOperations || sessionFlags.bashCommands || sessionFlags.allOperations
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Error checking session acceptance: ${extractErrorMessage(error)}`
      };
    }
  }

  resetSession(): void {
    this.confirmationService.resetSession();
  }

  isPending(): boolean {
    return this.confirmationService.isPending();
  }
}