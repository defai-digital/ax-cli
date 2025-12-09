/**
 * Checkpoint Storage Layer
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';
import type {
  Checkpoint,
  CheckpointInfo,
  CheckpointIndex,
  CheckpointStats,
  FileSnapshot,
} from './types.js';
import { extractErrorMessage } from '../utils/error-handler.js';
import { CONFIG_DIR_NAME } from '../constants.js';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class CheckpointStorage {
  private storageDir: string;
  private indexPath: string;
  private index: CheckpointIndex | null = null;
  /** Lock to prevent concurrent index operations */
  private indexLock: Promise<void> | null = null;
  /** Serialize mutations to index to avoid lost updates */
  private mutationLock: Promise<void> = Promise.resolve();

  constructor(baseDir: string = CONFIG_DIR_NAME) {
    // If baseDir is absolute, use it directly. Otherwise, resolve relative to cwd
    const resolvedBase = path.isAbsolute(baseDir) ? baseDir : path.join(process.cwd(), baseDir);
    this.storageDir = path.join(resolvedBase, 'checkpoints');
    this.indexPath = path.join(this.storageDir, 'metadata.json');
  }

  /**
   * Ensure only one mutation updates the index at a time
   */
  private async withMutationLock<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.mutationLock;
    let release!: () => void;

    this.mutationLock = new Promise<void>(resolve => { release = resolve; });
    await previous;

    try {
      return await fn();
    } finally {
      release();
    }
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      const indexExisted = await this.loadIndex();

      // If index was created in-memory (file didn't exist), persist it
      if (!indexExisted) {
        await this.saveIndex();
      }
    } catch (error) {
      throw new Error(`Failed to initialize checkpoint storage: ${extractErrorMessage(error)}`);
    }
  }

  async save(checkpoint: Checkpoint): Promise<void> {
    try {
      const dateDir = this.getDateDir(checkpoint.timestamp);
      await fs.mkdir(dateDir, { recursive: true });

      const filepath = path.join(dateDir, `checkpoint-${checkpoint.id}.json`);
      const content = JSON.stringify(checkpoint, null, 2);

      // Atomic write
      const tempPath = `${filepath}.tmp`;
      await fs.writeFile(tempPath, content, 'utf-8');
      await fs.rename(tempPath, filepath);

      // Update index
      await this.addToIndex(checkpoint, filepath);
    } catch (error) {
      throw new Error(`Failed to save checkpoint: ${extractErrorMessage(error)}`);
    }
  }

  async load(checkpointId: string): Promise<Checkpoint | null> {
    try {
      const info = await this.getCheckpointInfo(checkpointId);
      if (!info) return null;

      const filepath = await this.findCheckpointFile(checkpointId);
      if (!filepath) return null;

      let content: string;
      if (info.compressed) {
        const compressed = await fs.readFile(filepath);
        const decompressed = await gunzip(compressed);
        content = decompressed.toString('utf-8');
      } else {
        content = await fs.readFile(filepath, 'utf-8');
      }

      const checkpoint = JSON.parse(content);
      checkpoint.timestamp = new Date(checkpoint.timestamp);

      // Convert conversation state timestamps
      if (checkpoint.conversationState) {
        checkpoint.conversationState = checkpoint.conversationState.map((entry: { timestamp: string | Date; [key: string]: unknown }) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }));
      }

      return checkpoint;
    } catch (error) {
      throw new Error(`Failed to load checkpoint: ${extractErrorMessage(error)}`);
    }
  }

  async delete(checkpointId: string): Promise<void> {
    await this.withMutationLock(async () => {
      const filepath = await this.findCheckpointFile(checkpointId);
      if (filepath) {
        await fs.unlink(filepath);
      }
      await this.removeFromIndex(checkpointId, true);
    });
  }

  async compress(checkpointId: string): Promise<void> {
    await this.withMutationLock(async () => {
      const filepath = await this.findCheckpointFile(checkpointId);
      if (!filepath || filepath.endsWith('.gz')) return;

      const content = await fs.readFile(filepath, 'utf-8');
      const compressed = await gzip(content);

      const compressedPath = `${filepath}.gz`;
      await fs.writeFile(compressedPath, compressed);
      await fs.unlink(filepath);

      // Get the actual compressed file size and update the index
      const stat = await fs.stat(compressedPath);
      await this.updateCompressionStatus(checkpointId, true, stat.size, true);
    });
  }

  async getStats(): Promise<CheckpointStats> {
    await this.loadIndex();
    return this.index?.stats || {
      totalCount: 0,
      totalSize: 0,
      compressedCount: 0,
      oldestDate: null,
      newestDate: null,
    };
  }

  async listInfo(): Promise<CheckpointInfo[]> {
    await this.loadIndex();
    return this.index?.checkpoints || [];
  }

  async list(): Promise<string[]> {
    await this.loadIndex();
    return this.index?.checkpoints.map(c => c.id) || [];
  }

  async getCheckpointInfo(checkpointId: string): Promise<CheckpointInfo | null> {
    await this.loadIndex();
    return this.index?.checkpoints.find(c => c.id === checkpointId) || null;
  }

  async getTotalSize(): Promise<number> {
    const stats = await this.getStats();
    return stats.totalSize;
  }

  private async loadIndex(): Promise<boolean> {
    // Wait for any pending index operation to complete
    if (this.indexLock) {
      await this.indexLock;
    }

    // If index is already loaded, return true
    if (this.index) {
      return true;
    }

    // Create lock for this load operation
    let unlock: () => void = () => {};
    this.indexLock = new Promise<void>(resolve => { unlock = resolve; });

    try {
      const content = await fs.readFile(this.indexPath, 'utf-8');
      const data = JSON.parse(content);

      // BUG FIX: Validate data structure before accessing nested properties
      const checkpoints = Array.isArray(data.checkpoints) ? data.checkpoints : [];
      const stats = data.stats || { totalCount: 0, totalSize: 0, compressedCount: 0, oldestDate: null, newestDate: null };

      this.index = {
        checkpoints: checkpoints.map((c: { timestamp: string | Date; id: string; description: string; filesChanged: string[]; size: number; compressed: boolean }) => ({
          ...c,
          timestamp: new Date(c.timestamp),
        })),
        stats: {
          ...stats,
          oldestDate: stats.oldestDate ? new Date(stats.oldestDate) : null,
          newestDate: stats.newestDate ? new Date(stats.newestDate) : null,
        },
        lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : new Date(),
      };
      return true; // File existed
    } catch {
      this.index = {
        checkpoints: [],
        stats: {
          totalCount: 0,
          totalSize: 0,
          compressedCount: 0,
          oldestDate: null,
          newestDate: null,
        },
        lastUpdated: new Date(),
      };
      return false; // File didn't exist, created new index
    } finally {
      unlock();
      this.indexLock = null;
    }
  }

  private async saveIndex(): Promise<void> {
    if (!this.index) return;

    const content = JSON.stringify(this.index, null, 2);
    const tempPath = `${this.indexPath}.tmp`;
    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, this.indexPath);
  }

  private async addToIndex(checkpoint: Checkpoint, filepath: string, locked = false): Promise<void> {
    const action = async () => {
      await this.loadIndex();
      if (!this.index) return;

      const stat = await fs.stat(filepath);
      const info: CheckpointInfo = {
        id: checkpoint.id,
        timestamp: checkpoint.timestamp,
        description: checkpoint.description,
        filesChanged: checkpoint.files.map(f => f.path),
        size: stat.size,
        compressed: false,
      };

      // RACE CONDITION FIX: Create new sorted array instead of mutating to prevent concurrent modification
      this.index.checkpoints = [...this.index.checkpoints, info].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );

      this.updateStats();
      await this.saveIndex();
    };

    if (locked) {
      await action();
    } else {
      await this.withMutationLock(action);
    }
  }

  private async removeFromIndex(checkpointId: string, locked = false): Promise<void> {
    const action = async () => {
      await this.loadIndex();
      if (!this.index) return;

      this.index.checkpoints = this.index.checkpoints.filter(c => c.id !== checkpointId);
      this.updateStats();
      await this.saveIndex();
    };

    if (locked) {
      await action();
    } else {
      await this.withMutationLock(action);
    }
  }

  private async updateCompressionStatus(checkpointId: string, compressed: boolean, newSize?: number, locked = false): Promise<void> {
    const action = async () => {
      await this.loadIndex();
      if (!this.index) return;

      const info = this.index.checkpoints.find(c => c.id === checkpointId);
      if (info) {
        info.compressed = compressed;
        // Update size if provided (for compressed file size)
        if (newSize !== undefined) {
          info.size = newSize;
        }
        this.updateStats();
        await this.saveIndex();
      }
    };

    if (locked) {
      await action();
    } else {
      await this.withMutationLock(action);
    }
  }

  private updateStats(): void {
    if (!this.index) return;

    const checkpoints = this.index.checkpoints;
    this.index.stats = {
      totalCount: checkpoints.length,
      totalSize: checkpoints.reduce((sum, c) => sum + c.size, 0),
      compressedCount: checkpoints.filter(c => c.compressed).length,
      oldestDate: checkpoints.length > 0 ? checkpoints[checkpoints.length - 1].timestamp : null,
      newestDate: checkpoints.length > 0 ? checkpoints[0].timestamp : null,
    };
    this.index.lastUpdated = new Date();
  }

  private getDateDir(date: Date): string {
    // Use UTC to match toISOString() format used in tests
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return path.join(this.storageDir, `${year}-${month}-${day}`);
  }

  private async findCheckpointFile(checkpointId: string): Promise<string | null> {
    const info = await this.getCheckpointInfo(checkpointId);
    if (!info) return null;

    const dateDir = this.getDateDir(info.timestamp);
    const baseName = `checkpoint-${checkpointId}.json`;

    const uncompressed = path.join(dateDir, baseName);
    const compressed = path.join(dateDir, `${baseName}.gz`);

    try {
      await fs.access(compressed);
      return compressed;
    } catch {
      try {
        await fs.access(uncompressed);
        return uncompressed;
      } catch {
        return null;
      }
    }
  }

  async pruneOlderThan(date: Date): Promise<number> {
    await this.loadIndex();
    if (!this.index) return 0;

    const toDelete = this.index.checkpoints.filter(c => c.timestamp < date);
    let deletedCount = 0;
    const failures: string[] = [];

    for (const checkpoint of toDelete) {
      try {
        await this.delete(checkpoint.id);
        deletedCount++;
      } catch (error) {
        failures.push(checkpoint.id);
        console.error(`Failed to prune checkpoint ${checkpoint.id}: ${extractErrorMessage(error)}`);
      }
    }

    if (failures.length > 0) {
      console.warn(`Pruning completed with ${failures.length} failure(s). Successfully deleted ${deletedCount} of ${toDelete.length} checkpoints.`);
    }

    return deletedCount;
  }
}

export function calculateHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function verifyFileSnapshot(snapshot: FileSnapshot): boolean {
  const actualHash = calculateHash(snapshot.content);
  return actualHash === snapshot.hash;
}
