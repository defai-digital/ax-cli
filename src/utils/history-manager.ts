import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as os from "os";
import { ChatEntry } from "../agent/llm-agent.js";

/**
 * HistoryManager - Manages conversation history persistence
 * Supports both global history and directory-specific sessions
 */
export class HistoryManager {
  private historyDir: string;
  private historyFile: string;
  private maxHistoryEntries: number;
  private currentProjectDir?: string;

  constructor(
    baseDir: string = path.join(os.homedir(), ".ax-cli"),
    maxEntries: number = 50,
    projectDir?: string
  ) {
    this.historyDir = baseDir;
    this.currentProjectDir = projectDir;

    // Use project-specific history file if projectDir is provided
    if (projectDir) {
      const sessionId = this.getSessionIdForDirectory(projectDir);
      this.historyFile = path.join(baseDir, "sessions", `${sessionId}.json`);
    } else {
      this.historyFile = path.join(baseDir, "history.json");
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
      const sessionsDir = path.join(this.historyDir, "sessions");
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

      // Deserialize (convert ISO strings back to Date objects)
      const history: ChatEntry[] = historyData.map((entry: any) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }));

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
  if (force || !historyManagerInstance) {
    historyManagerInstance = new HistoryManager(
      path.join(os.homedir(), ".ax-cli"),
      50,
      projectDir
    );
  }
  return historyManagerInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetHistoryManager(): void {
  historyManagerInstance = null;
}
