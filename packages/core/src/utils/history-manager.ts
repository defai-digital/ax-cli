import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { ChatEntry } from "../agent/llm-agent.js";
import { FILE_NAMES } from "../constants.js";
import { getActiveConfigPaths } from "../provider/config.js";

/**
 * HistoryManager - Manages conversation history persistence
 * Supports both global history and directory-specific sessions
 */
export class HistoryManager {
  private historyDir: string;
  private historyFile: string;
  private maxHistoryEntries: number;
  private currentProjectDir?: string;

  /** Expose projectDir for singleton management */
  get projectDir(): string | undefined {
    return this.currentProjectDir;
  }

  constructor(
    baseDir?: string,
    maxEntries: number = 50,
    projectDir?: string
  ) {
    // Use provider-specific user directory if not specified
    const resolvedBaseDir = baseDir ?? getActiveConfigPaths().USER_DIR;
    this.historyDir = resolvedBaseDir;
    this.currentProjectDir = projectDir;

    // Use project-specific history file if projectDir is provided
    if (projectDir) {
      const sessionId = this.getSessionIdForDirectory(projectDir);
      this.historyFile = path.join(resolvedBaseDir, FILE_NAMES.SESSIONS_DIR, `${sessionId}.json`);
    } else {
      this.historyFile = path.join(resolvedBaseDir, FILE_NAMES.HISTORY_JSON);
    }

    this.maxHistoryEntries = maxEntries;
    this.ensureHistoryDir();
  }

  /**
   * Generate a session ID based on project directory path
   * Uses a hash of the absolute path for consistent session identification
   */
  private getSessionIdForDirectory(dir: string): string {
    const absolutePath = path.resolve(dir);
    const hash = crypto.createHash('sha256').update(absolutePath).digest('hex');
    return hash.substring(0, 16); // Use first 16 chars for shorter filenames
  }

  /**
   * Ensure history directory exists
   */
  private ensureHistoryDir(): void {
    if (!fs.existsSync(this.historyDir)) {
      fs.mkdirSync(this.historyDir, { recursive: true });
    }

    // Ensure sessions directory exists if using project-specific history
    if (this.currentProjectDir) {
      const sessionsDir = path.join(this.historyDir, FILE_NAMES.SESSIONS_DIR);
      if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
      }
    }
  }

  /**
   * Save chat history to disk
   * Only keeps the most recent entries up to maxHistoryEntries
   * Uses atomic write pattern (temp file + rename) to prevent corruption
   */
  saveHistory(chatHistory: ChatEntry[]): void {
    try {
      // Only save the most recent entries
      const entriesToSave = chatHistory.slice(-this.maxHistoryEntries);

      // Serialize chat entries (convert Date objects to ISO strings)
      const serialized = entriesToSave.map(entry => ({
        ...entry,
        timestamp: entry.timestamp.toISOString(),
      }));

      // Add session metadata if using project-specific history
      const data = this.currentProjectDir ? {
        metadata: {
          projectDir: this.currentProjectDir,
          lastUpdated: new Date().toISOString(),
          version: 1,
        },
        history: serialized,
      } : serialized;

      // Atomic write pattern: write to temp file, then rename
      // This prevents corruption if process crashes mid-write
      const tempFile = `${this.historyFile}.tmp`;
      fs.writeFileSync(
        tempFile,
        JSON.stringify(data, null, 2),
        "utf-8"
      );

      // Atomic rename - if this succeeds, we know the write was complete
      fs.renameSync(tempFile, this.historyFile);
    } catch (error) {
      console.error("Failed to save chat history:", error);
      // Clean up temp file if it exists
      try {
        const tempFile = `${this.historyFile}.tmp`;
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Load chat history from disk
   * Returns empty array if no history exists or on error
   */
  loadHistory(): ChatEntry[] {
    try {
      if (!fs.existsSync(this.historyFile)) {
        return [];
      }

      const content = fs.readFileSync(this.historyFile, "utf-8");
      const parsed = JSON.parse(content);

      // Handle both old format (array) and new format (object with metadata)
      const historyData = Array.isArray(parsed) ? parsed : parsed.history || [];

      // Validate that historyData is actually an array
      if (!Array.isArray(historyData)) {
        console.warn("Invalid history file format: history data is not an array");
        return [];
      }

      // Deserialize (convert ISO strings back to Date objects)
      // Filter out any invalid entries instead of crashing
      const history: ChatEntry[] = historyData
        .filter((entry: any) => {
          // Basic validation: must be object with required fields
          return entry && typeof entry === 'object' && entry.type && entry.timestamp;
        })
        .map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }))
        // Filter out entries with invalid Date objects (NaN from invalid timestamp strings)
        .filter((entry: ChatEntry) => {
          const timestamp = entry.timestamp;
          return timestamp instanceof Date && !isNaN(timestamp.getTime());
        });

      return history;
    } catch (error) {
      console.error("Failed to load chat history:", error);
      return [];
    }
  }

  /**
   * Clear all saved history
   */
  clearHistory(): void {
    try {
      if (fs.existsSync(this.historyFile)) {
        fs.unlinkSync(this.historyFile);
      }
    } catch (error) {
      console.error("Failed to clear chat history:", error);
    }
  }

  /**
   * Get the number of entries in saved history
   */
  getHistorySize(): number {
    try {
      if (!fs.existsSync(this.historyFile)) {
        return 0;
      }

      const content = fs.readFileSync(this.historyFile, "utf-8");
      const parsed = JSON.parse(content);

      // Handle both old format (array) and new format (object with metadata)
      if (Array.isArray(parsed)) {
        return parsed.length;
      } else if (parsed.history && Array.isArray(parsed.history)) {
        return parsed.history.length;
      }

      return 0;
    } catch {
      return 0;
    }
  }
}

// Singleton instance
let historyManagerInstance: HistoryManager | null = null;

/**
 * Get the singleton HistoryManager instance
 * @param projectDir Optional project directory for session-specific history
 * @param force Force create new instance (useful for --continue flag)
 */
export function getHistoryManager(projectDir?: string, force = false): HistoryManager {
  // Check if projectDir changed - need to create new instance for different project
  const needsNewInstance = force || !historyManagerInstance ||
    (projectDir && historyManagerInstance.projectDir !== projectDir);

  if (needsNewInstance) {
    // Use provider-specific user directory (e.g., ~/.ax-glm or ~/.ax-grok)
    const instance = new HistoryManager(
      getActiveConfigPaths().USER_DIR,
      50,
      projectDir
    );
    historyManagerInstance = instance;
    return instance;
  }
  // historyManagerInstance is guaranteed non-null here because:
  // needsNewInstance = force || !historyManagerInstance || (...)
  // If needsNewInstance is false, then !historyManagerInstance must be false
  // Therefore historyManagerInstance is not null
  if (!historyManagerInstance) {
    throw new Error('HistoryManager instance should exist but is null');
  }
  return historyManagerInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetHistoryManager(): void {
  historyManagerInstance = null;
}
