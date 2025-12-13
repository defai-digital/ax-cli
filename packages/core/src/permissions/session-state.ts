/**
 * Session State - Single source of truth for session-level approvals
 *
 * Consolidates session approval logic that was previously scattered across
 * PermissionManager and ConfirmationService.
 */

import { EventEmitter } from 'events';

/**
 * Session approval categories
 */
export interface SessionFlags {
  /** Auto-approve all file operations */
  fileOperations: boolean;
  /** Auto-approve all bash commands */
  bashCommands: boolean;
  /** Auto-approve all operations (master switch) */
  allOperations: boolean;
}

/**
 * Session state events
 */
export interface SessionStateEvents {
  'session:flag-changed': (flag: keyof SessionFlags, value: boolean) => void;
  'session:approval-granted': (signature: string) => void;
  'session:approval-revoked': (signature: string) => void;
  'session:cleared': () => void;
}

/**
 * Default session flags - conservative by default
 * Users can enable allOperations for convenience mode
 */
const INITIAL_SESSION_FLAGS: SessionFlags = {
  fileOperations: false,
  bashCommands: false,
  allOperations: false, // Default: require confirmations (safer)
};

/**
 * Clean/safe session flags (no auto-approvals)
 * Used by reset() to provide a security-conscious fresh start
 */
const CLEAN_SESSION_FLAGS: SessionFlags = {
  fileOperations: false,
  bashCommands: false,
  allOperations: false, // Require confirmations after reset
};

/**
 * Centralized session state manager
 *
 * Manages:
 * - Session flags (allOperations, fileOperations, bashCommands)
 * - Fine-grained approvals (tool:pattern signatures)
 */
class SessionStateManager extends EventEmitter {
  private flags: SessionFlags = { ...INITIAL_SESSION_FLAGS };

  /** Fine-grained approvals by signature (e.g., "bash:rm", "str_replace_editor:/path") */
  private approvals = new Set<string>();

  // ============================================================================
  // Flag Management
  // ============================================================================

  getFlags(): Readonly<SessionFlags> {
    return { ...this.flags };
  }

  getFlag(flag: keyof SessionFlags): boolean {
    return this.flags[flag];
  }

  setFlag(flag: keyof SessionFlags, value: boolean): void {
    if (this.flags[flag] !== value) {
      this.flags[flag] = value;
      this.emit('session:flag-changed', flag, value);
    }
  }

  /**
   * Check if an operation type is auto-approved via flags
   */
  isAutoApproved(operationType: 'file' | 'bash' | 'all'): boolean {
    if (this.flags.allOperations) return true;

    switch (operationType) {
      case 'file':
        return this.flags.fileOperations;
      case 'bash':
        return this.flags.bashCommands;
      case 'all':
        return this.flags.allOperations;
      default:
        // Safety: return false for unexpected values (e.g., from untyped JS)
        return false;
    }
  }

  // ============================================================================
  // Fine-grained Approvals
  // ============================================================================

  /**
   * Grant session approval for a specific signature
   * @param signature Format: "tool:pattern" (e.g., "bash:rm", "str_replace_editor:/path")
   */
  grantApproval(signature: string): void {
    if (!this.approvals.has(signature)) {
      this.approvals.add(signature);
      this.emit('session:approval-granted', signature);
    }
  }

  /**
   * Revoke session approval for a specific signature
   */
  revokeApproval(signature: string): void {
    if (this.approvals.delete(signature)) {
      this.emit('session:approval-revoked', signature);
    }
  }

  /**
   * Check if a specific signature has been approved
   */
  hasApproval(signature: string): boolean {
    return this.approvals.has(signature);
  }

  /**
   * Get all current approvals
   * Returns a copy to prevent external mutation
   */
  getApprovals(): ReadonlySet<string> {
    // BUG FIX: Return a copy, not the actual Set, to prevent external mutation via casting
    return new Set(this.approvals);
  }

  // ============================================================================
  // Signature Generation Helpers
  // ============================================================================

  /**
   * Generate approval signature for a bash command
   * Uses the first word (command name) as the pattern
   */
  static bashSignature(command: string): string {
    const cmdPrefix = command.trim().split(/\s+/)[0] || command;
    return `bash:${cmdPrefix}`;
  }

  /**
   * Generate approval signature for a file operation
   */
  static fileSignature(tool: string, filePath: string): string {
    return `${tool}:${filePath}`;
  }

  /**
   * Generate approval signature for a generic tool
   */
  static toolSignature(tool: string, args: Record<string, unknown>): string {
    return `${tool}:${JSON.stringify(args)}`;
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Reset all session state to clean/safe state
   * Uses CLEAN_SESSION_FLAGS (allOperations: false) for security
   * This is intentionally different from the constructor default
   */
  reset(): void {
    this.flags = { ...CLEAN_SESSION_FLAGS };
    this.approvals.clear();
    this.emit('session:cleared');
  }

  /**
   * Clear only approvals, keep flags
   */
  clearApprovals(): void {
    this.approvals.clear();
    this.emit('session:cleared');
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.approvals.clear();
    this.removeAllListeners();
  }
}

// Singleton instance
let instance: SessionStateManager | null = null;

/**
 * Get the shared session state manager
 */
export function getSessionState(): SessionStateManager {
  if (!instance) {
    instance = new SessionStateManager();
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetSessionState(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}

export { SessionStateManager };
