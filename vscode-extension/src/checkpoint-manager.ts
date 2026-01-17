/**
 * Checkpoint Manager - Saves and restores file states
 *
 * Similar to Claude Code's checkpoint system that automatically saves
 * your code state before each change and supports /rewind to restore.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { generateId, getAppConfigDir } from './utils.js';
import { MAX_CHECKPOINTS, CHECKPOINT_RETENTION_DAYS } from './constants.js';

export interface Checkpoint {
  id: string;
  timestamp: string;
  description: string;
  files: CheckpointFile[];
}

export interface CheckpointFile {
  path: string;
  content: string;
  exists: boolean;
}

const CHECKPOINT_DIR = path.join(getAppConfigDir(), 'checkpoints');

export class CheckpointManager implements vscode.Disposable {
  private checkpoints: Map<string, Checkpoint> = new Map();
  private workspaceRoot: string | undefined;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    this.ensureCheckpointDir();
    // Load checkpoints asynchronously to avoid blocking extension activation
    this.loadCheckpointsAsync().then(() => {
      this.cleanupOldCheckpoints();
    }).catch(err => {
      console.error('[AX Checkpoint] Failed to load checkpoints:', err);
    });
  }

  /**
   * Ensure checkpoint directory exists
   */
  private ensureCheckpointDir(): void {
    try {
      if (!fs.existsSync(CHECKPOINT_DIR)) {
        fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
      }
    } catch (error) {
      console.error('[AX Checkpoint] Failed to create checkpoint directory:', error);
    }
  }

  /**
   * Load existing checkpoints from disk asynchronously
   * Uses async file operations to avoid blocking the extension host
   */
  private async loadCheckpointsAsync(): Promise<void> {
    try {
      const indexPath = this.getIndexPath();

      // Check if index file exists
      try {
        await fs.promises.access(indexPath);
      } catch {
        // Index file doesn't exist yet - nothing to load
        return;
      }

      const data = await fs.promises.readFile(indexPath, 'utf-8');
      const checkpointList: Checkpoint[] = JSON.parse(data);

      for (const cp of checkpointList) {
        // Validate required checkpoint fields
        if (!cp.id || !cp.timestamp || !cp.description || !Array.isArray(cp.files)) {
          console.warn(`[AX Checkpoint] Skipping invalid checkpoint: missing required fields`);
          continue;
        }
        this.checkpoints.set(cp.id, cp);
      }

      console.log(`[AX Checkpoint] Loaded ${this.checkpoints.size} checkpoints`);
    } catch (error) {
      console.error('[AX Checkpoint] Failed to load checkpoints:', error);
    }
  }

  /**
   * Save checkpoints index to disk
   * Note: Index stores only metadata (id, timestamp, description, file count) not full content
   */
  private saveIndex(): void {
    try {
      const indexPath = this.getIndexPath();
      // Store only metadata in index to keep it lightweight
      const checkpointList = Array.from(this.checkpoints.values()).map(cp => ({
        id: cp.id,
        timestamp: cp.timestamp,
        description: cp.description,
        files: cp.files.map(f => ({ path: f.path, exists: f.exists, content: '' })) // Don't store content in index
      }));
      fs.writeFileSync(indexPath, JSON.stringify(checkpointList, null, 2));
    } catch (error) {
      console.error('[AX Checkpoint] Failed to save checkpoint index:', error);
    }
  }

  /**
   * Get the index file path for current workspace
   */
  private getIndexPath(): string {
    const workspaceId = this.getWorkspaceId();
    return path.join(CHECKPOINT_DIR, `${workspaceId}-index.json`);
  }

  /**
   * Get a unique ID for the current workspace
   */
  private getWorkspaceId(): string {
    if (!this.workspaceRoot) {
      return 'default';
    }
    // Create a simple hash of the workspace path
    let hash = 0;
    for (let i = 0; i < this.workspaceRoot.length; i++) {
      const char = this.workspaceRoot.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Create a checkpoint before making changes
   */
  async createCheckpoint(files: string[], description: string): Promise<string> {
    // Use shared generateId utility for consistent, collision-resistant IDs
    const checkpointId = generateId('cp');

    // Read all files in parallel using async operations to avoid blocking extension host
    const filePromises = files.map(async (filePath): Promise<CheckpointFile> => {
      try {
        const stat = await fs.promises.stat(filePath).catch(() => null);
        const exists = stat !== null;
        let content = '';

        if (exists) {
          content = await fs.promises.readFile(filePath, 'utf-8');
        }

        return { path: filePath, content, exists };
      } catch (error) {
        console.error(`[AX Checkpoint] Failed to read file ${filePath}:`, error);
        return { path: filePath, content: '', exists: false };
      }
    });

    const checkpointFiles = await Promise.all(filePromises);

    const checkpoint: Checkpoint = {
      id: checkpointId,
      timestamp: new Date().toISOString(),
      description,
      files: checkpointFiles
    };

    // Save checkpoint data with rollback on failure
    const checkpointPath = path.join(CHECKPOINT_DIR, `${checkpointId}.json`);
    try {
      // Step 1: Write checkpoint file
      fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));

      // Step 2: Update in-memory state
      this.checkpoints.set(checkpointId, checkpoint);

      // Step 3: Save index - if this fails, rollback
      try {
        this.saveIndex();
      } catch (indexError) {
        // Rollback: remove from memory and delete file
        this.checkpoints.delete(checkpointId);
        try {
          fs.unlinkSync(checkpointPath);
        } catch {
          // Best effort cleanup
        }
        throw indexError;
      }

      // Step 4: Enforce max checkpoints (non-critical, log but don't fail)
      try {
        this.enforceMaxCheckpoints();
      } catch (enforceError) {
        console.warn('[AX Checkpoint] Failed to enforce max checkpoints:', enforceError);
      }

      console.log(`[AX Checkpoint] Created checkpoint ${checkpointId} with ${files.length} files`);
      return checkpointId;
    } catch (error) {
      console.error('[AX Checkpoint] Failed to save checkpoint:', error);
      // Return empty string to indicate failure - caller should check for this
      return '';
    }
  }

  /**
   * Restore files to a previous checkpoint
   */
  async rewindToCheckpoint(checkpointId: string): Promise<boolean> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      vscode.window.showErrorMessage(`Checkpoint ${checkpointId} not found`);
      return false;
    }

    // Load full checkpoint data from file
    const checkpointPath = path.join(CHECKPOINT_DIR, `${checkpointId}.json`);
    let fullCheckpoint: Checkpoint;

    try {
      const data = fs.readFileSync(checkpointPath, 'utf-8');
      fullCheckpoint = JSON.parse(data);
    } catch (error) {
      console.error('[AX Checkpoint] Failed to load checkpoint data:', error);
      vscode.window.showErrorMessage('Failed to load checkpoint data');
      return false;
    }

    // Create a backup checkpoint before rewinding
    // IMPORTANT: Verify backup succeeded before proceeding with destructive restore
    const affectedFiles = fullCheckpoint.files.map(f => f.path);
    const backupId = await this.createCheckpoint(affectedFiles, `Backup before rewind to ${checkpointId}`);

    if (!backupId) {
      vscode.window.showErrorMessage('Failed to create backup checkpoint. Aborting rewind to prevent data loss.');
      return false;
    }

    // Phase 1: Validate all operations can succeed (dry run)
    // Check that we can read/write all target files before making any changes
    const validationErrors: string[] = [];
    for (const file of fullCheckpoint.files) {
      try {
        if (file.exists) {
          const dir = path.dirname(file.path);
          // Check if we can create the directory
          if (!fs.existsSync(dir)) {
            // Test if parent exists and is writable
            const parentDir = path.dirname(dir);
            if (!fs.existsSync(parentDir)) {
              validationErrors.push(`Parent directory does not exist: ${parentDir}`);
              continue;
            }
          }
        }
      } catch (error) {
        validationErrors.push(`Cannot access ${file.path}: ${error}`);
      }
    }

    if (validationErrors.length > 0) {
      console.error('[AX Checkpoint] Validation errors:', validationErrors);
      vscode.window.showErrorMessage(
        `Cannot restore checkpoint: ${validationErrors.length} file(s) inaccessible. Backup saved as ${backupId}.`
      );
      return false;
    }

    // Phase 2: Apply changes with tracking for potential rollback
    let restored = 0;
    let failed = 0;
    const appliedChanges: Array<{ path: string; originalContent: string | null; originalExists: boolean }> = [];

    for (const file of fullCheckpoint.files) {
      try {
        // Track original state for potential rollback
        const originalExists = fs.existsSync(file.path);
        const originalContent = originalExists ? fs.readFileSync(file.path, 'utf-8') : null;

        if (file.exists) {
          // Ensure directory exists
          const dir = path.dirname(file.path);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(file.path, file.content);
          restored++;
        } else {
          // File didn't exist at checkpoint time - delete it if it exists now
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            restored++;
          }
        }

        appliedChanges.push({ path: file.path, originalContent, originalExists });
      } catch (error) {
        console.error(`[AX Checkpoint] Failed to restore ${file.path}:`, error);
        failed++;

        // If we fail partway through, attempt rollback of already-applied changes
        if (appliedChanges.length > 0) {
          console.log(`[AX Checkpoint] Attempting rollback of ${appliedChanges.length} changes...`);
          for (const change of appliedChanges) {
            try {
              if (change.originalExists && change.originalContent !== null) {
                fs.writeFileSync(change.path, change.originalContent);
              } else if (!change.originalExists && fs.existsSync(change.path)) {
                fs.unlinkSync(change.path);
              }
            } catch (rollbackError) {
              console.error(`[AX Checkpoint] Rollback failed for ${change.path}:`, rollbackError);
            }
          }
          vscode.window.showErrorMessage(
            `Restore failed at ${file.path}. Attempted rollback. Backup checkpoint: ${backupId}`
          );
          return false;
        }
      }
    }

    if (failed === 0) {
      vscode.window.showInformationMessage(
        `Restored ${restored} file(s) to checkpoint: ${checkpoint.description}`
      );
    } else {
      vscode.window.showWarningMessage(
        `Restored ${restored} file(s), ${failed} failed. Backup: ${backupId}`
      );
    }

    // Refresh any open editors
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');

    return failed === 0;
  }

  /**
   * Get list of available checkpoints
   */
  getCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Get the most recent checkpoint
   */
  getLatestCheckpoint(): Checkpoint | undefined {
    const checkpoints = this.getCheckpoints();
    return checkpoints[0];
  }

  /**
   * Enforce maximum number of checkpoints
   */
  private enforceMaxCheckpoints(): void {
    const checkpoints = this.getCheckpoints();

    if (checkpoints.length > MAX_CHECKPOINTS) {
      const toDelete = checkpoints.slice(MAX_CHECKPOINTS);

      for (const cp of toDelete) {
        this.deleteCheckpoint(cp.id);
      }

      console.log(`[AX Checkpoint] Deleted ${toDelete.length} old checkpoints`);
    }
  }

  /**
   * Clean up checkpoints older than retention period
   */
  private cleanupOldCheckpoints(): void {
    const cutoff = Date.now() - (CHECKPOINT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    // Collect IDs to delete first to avoid modifying Map during iteration
    const toDelete: string[] = [];
    for (const [id, cp] of this.checkpoints) {
      if (new Date(cp.timestamp).getTime() < cutoff) {
        toDelete.push(id);
      }
    }

    // Now delete collected checkpoints
    for (const id of toDelete) {
      this.deleteCheckpoint(id);
    }

    if (toDelete.length > 0) {
      console.log(`[AX Checkpoint] Cleaned up ${toDelete.length} expired checkpoint(s)`);
    }
  }

  /**
   * Delete a checkpoint
   */
  private deleteCheckpoint(checkpointId: string): void {
    try {
      const checkpointPath = path.join(CHECKPOINT_DIR, `${checkpointId}.json`);
      if (fs.existsSync(checkpointPath)) {
        fs.unlinkSync(checkpointPath);
      }
      this.checkpoints.delete(checkpointId);
      this.saveIndex();
    } catch (error) {
      console.error(`[AX Checkpoint] Failed to delete checkpoint ${checkpointId}:`, error);
    }
  }

  /**
   * Show checkpoint picker and rewind
   */
  async showRewindPicker(): Promise<void> {
    const checkpoints = this.getCheckpoints();

    if (checkpoints.length === 0) {
      vscode.window.showInformationMessage('No checkpoints available');
      return;
    }

    const items = checkpoints.map(cp => ({
      label: cp.description,
      description: new Date(cp.timestamp).toLocaleString(),
      detail: `${cp.files.length} file(s)`,
      checkpointId: cp.id
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a checkpoint to restore',
      title: 'Rewind to Checkpoint'
    });

    if (selected) {
      const confirmed = await vscode.window.showWarningMessage(
        `Rewind to "${selected.label}"? This will restore ${selected.detail} to their previous state.`,
        { modal: true },
        'Rewind'
      );

      if (confirmed === 'Rewind') {
        await this.rewindToCheckpoint(selected.checkpointId);
      }
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.saveIndex();
  }
}
