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

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class CheckpointStorage {
  private storageDir: string;
  private indexPath: string;
  private index: CheckpointIndex | null = null;

  constructor(baseDir: string = '.ax-cli') {
    // If baseDir is absolute, use it directly. Otherwise, resolve relative to cwd
    const resolvedBase = path.isAbsolute(baseDir) ? baseDir : path.join(process.cwd(), baseDir);
    this.storageDir = path.join(resolvedBase, 'checkpoints');
    this.indexPath = path.join(this.storageDir, 'metadata.json');
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
      throw new Error(`Failed to initialize checkpoint storage: ${error instanceof Error ? error.message : String(error)}`);
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
      throw new Error(`Failed to save checkpoint: ${error instanceof Error ? error.message : String(error)}`);
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
        checkpoint.conversationState = checkpoint.conversationState.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }));
      }

      return checkpoint;
    } catch (error) {
      throw new Error(`Failed to load checkpoint: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async delete(checkpointId: string): Promise<void> {
    const filepath = await this.findCheckpointFile(checkpointId);
    if (filepath) {
      await fs.unlink(filepath);
    }
    await this.removeFromIndex(checkpointId);
  }

  async compress(checkpointId: string): Promise<void> {
    const filepath = await this.findCheckpointFile(checkpointId);
    if (!filepath || filepath.endsWith('.gz')) return;

    const content = await fs.readFile(filepath, 'utf-8');
    const compressed = await gzip(content);

    const compressedPath = `${filepath}.gz`;
    await fs.writeFile(compressedPath, compressed);
    await fs.unlink(filepath);

    await this.updateCompressionStatus(checkpointId, true);
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
    try {
      const content = await fs.readFile(this.indexPath, 'utf-8');
      const data = JSON.parse(content);

      this.index = {
        checkpoints: data.checkpoints.map((c: any) => ({
          ...c,
          timestamp: new Date(c.timestamp),
        })),
        stats: {
          ...data.stats,
          oldestDate: data.stats.oldestDate ? new Date(data.stats.oldestDate) : null,
          newestDate: data.stats.newestDate ? new Date(data.stats.newestDate) : null,
        },
        lastUpdated: new Date(data.lastUpdated),
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
    }
  }

  private async saveIndex(): Promise<void> {
    if (!this.index) return;

    const content = JSON.stringify(this.index, null, 2);
    const tempPath = `${this.indexPath}.tmp`;
    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, this.indexPath);
  }

  private async addToIndex(checkpoint: Checkpoint, filepath: string): Promise<void> {
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

    this.index.checkpoints.push(info);
    this.index.checkpoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    this.updateStats();
    await this.saveIndex();
  }

  private async removeFromIndex(checkpointId: string): Promise<void> {
    await this.loadIndex();
    if (!this.index) return;

    this.index.checkpoints = this.index.checkpoints.filter(c => c.id !== checkpointId);
    this.updateStats();
    await this.saveIndex();
  }

  private async updateCompressionStatus(checkpointId: string, compressed: boolean): Promise<void> {
    await this.loadIndex();
    if (!this.index) return;

    const info = this.index.checkpoints.find(c => c.id === checkpointId);
    if (info) {
      info.compressed = compressed;
      this.updateStats();
      await this.saveIndex();
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

    for (const checkpoint of toDelete) {
      await this.delete(checkpoint.id);
    }

    return toDelete.length;
  }
}

export function calculateHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function verifyFileSnapshot(snapshot: FileSnapshot): boolean {
  const actualHash = calculateHash(snapshot.content);
  return actualHash === snapshot.hash;
}
