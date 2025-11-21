/**
 * Checkpoint System Types
 */

import type { ChatEntry } from '../agent/llm-agent.js';

/**
 * File snapshot with content and hash
 */
export interface FileSnapshot {
  path: string;
  content: string;
  hash: string;
  size: number;
}

/**
 * Checkpoint metadata
 */
export interface CheckpointMetadata {
  model: string;
  triggeredBy: string;
  [key: string]: any;
}

/**
 * Complete checkpoint
 */
export interface Checkpoint {
  id: string;
  timestamp: Date;
  description: string;
  files: FileSnapshot[];
  conversationState: ChatEntry[];
  metadata: CheckpointMetadata;
}

/**
 * Checkpoint info for listing
 */
export interface CheckpointInfo {
  id: string;
  timestamp: Date;
  description: string;
  filesChanged: string[];
  size: number;
  compressed: boolean;
}

/**
 * Checkpoint statistics
 */
export interface CheckpointStats {
  totalCount: number;
  totalSize: number;
  compressedCount: number;
  oldestDate: Date | null;
  newestDate: Date | null;
}

/**
 * Checkpoint configuration
 */
export interface CheckpointConfig {
  enabled: boolean;
  maxCheckpoints: number;
  compressAfterDays: number;
  pruneAfterDays: number;
  createBeforeOperations: string[];
  storageLimit: number;
  storageDir: string;
  conversationDepth: number;
}

/**
 * Checkpoint filter options
 */
export interface CheckpointFilter {
  limit?: number;
  beforeDate?: Date;
  afterDate?: Date;
  until?: Date; // Alias for beforeDate
  since?: Date; // Alias for afterDate
  filesChanged?: string[];
}

/**
 * Checkpoint creation options
 */
export interface CheckpointOptions {
  files: Array<{ path: string; content: string }>;
  conversationState: ChatEntry[];
  description?: string;
  metadata?: Partial<CheckpointMetadata>;
}

/**
 * Checkpoint restore result
 */
export interface CheckpointRestoreResult {
  success: boolean;
  filesRestored: string[];
  filesFailed: string[];
  conversationIndex?: number;
  error?: string;
}

/**
 * Checkpoint index
 */
export interface CheckpointIndex {
  checkpoints: CheckpointInfo[];
  stats: CheckpointStats;
  lastUpdated: Date;
}

/**
 * Default configuration
 */
export const DEFAULT_CHECKPOINT_CONFIG: CheckpointConfig = {
  enabled: true,
  maxCheckpoints: 100,
  compressAfterDays: 7,
  pruneAfterDays: 30,
  createBeforeOperations: ['write', 'edit', 'delete'],
  storageLimit: 100,
  storageDir: 'checkpoints',
  conversationDepth: 50,
};
