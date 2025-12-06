/**
 * Checkpoint Manager - Saves and restores file states
 *
 * Similar to Claude Code's checkpoint system that automatically saves
 * your code state before each change and supports /rewind to restore.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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

const CHECKPOINT_DIR = path.join(os.homedir(), '.ax-cli', 'checkpoints');
const MAX_CHECKPOINTS = 50;
const CHECKPOINT_RETENTION_DAYS = 7;

export class CheckpointManager implements vscode.Disposable {
  private checkpoints: Map<string, Checkpoint> = new Map();
  private workspaceRoot: string | undefined;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    this.ensureCheckpointDir();
    this.loadCheckpoints();
    this.cleanupOldCheckpoints();
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
   * Load existing checkpoints from disk
   */
  private loadCheckpoints(): void {
    try {
      const indexPath = this.getIndexPath();
      if (fs.existsSync(indexPath)) {
        const data = fs.readFileSync(indexPath, 'utf-8');
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
      }
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
    const checkpointId = `cp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const checkpointFiles: CheckpointFile[] = [];

    for (const filePath of files) {
      try {
        const exists = fs.existsSync(filePath);
        let content = '';

        if (exists) {
          content = fs.readFileSync(filePath, 'utf-8');
        }

        checkpointFiles.push({
          path: filePath,
          content,
          exists
        });
      } catch (error) {
        console.error(`[AX Checkpoint] Failed to read file ${filePath}:`, error);
      }
    }

    const checkpoint: Checkpoint = {
      id: checkpointId,
      timestamp: new Date().toISOString(),
      description,
      files: checkpointFiles
    };

    // Save checkpoint data
    const checkpointPath = path.join(CHECKPOINT_DIR, `${checkpointId}.json`);
    try {
      fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
      this.checkpoints.set(checkpointId, checkpoint);
      this.saveIndex();

      // Enforce max checkpoints limit
      this.enforceMaxCheckpoints();

      console.log(`[AX Checkpoint] Created checkpoint ${checkpointId} with ${files.length} files`);
    } catch (error) {
      console.error('[AX Checkpoint] Failed to save checkpoint:', error);
    }

    return checkpointId;
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
    const affectedFiles = fullCheckpoint.files.map(f => f.path);
    await this.createCheckpoint(affectedFiles, `Backup before rewind to ${checkpointId}`);

    // Restore each file
    let restored = 0;
    let failed = 0;

    for (const file of fullCheckpoint.files) {
      try {
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
      } catch (error) {
        console.error(`[AX Checkpoint] Failed to restore ${file.path}:`, error);
        failed++;
      }
    }

    if (failed === 0) {
      vscode.window.showInformationMessage(
        `Restored ${restored} file(s) to checkpoint: ${checkpoint.description}`
      );
    } else {
      vscode.window.showWarningMessage(
        `Restored ${restored} file(s), ${failed} failed`
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

    for (const [id, cp] of this.checkpoints) {
      if (new Date(cp.timestamp).getTime() < cutoff) {
        this.deleteCheckpoint(id);
      }
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
