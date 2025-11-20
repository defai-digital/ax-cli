import * as fs from "fs";
import * as path from "path";
import { ChatEntry } from "../agent/llm-agent.js";

/**
 * HistoryManager - Manages conversation history persistence
 * Saves chat history to disk and restores it on app restart
 */
export class HistoryManager {
  private historyDir: string;
  private historyFile: string;
  private maxHistoryEntries: number;

  constructor(
    baseDir: string = path.join(process.env.HOME || "~", ".ax-cli"),
    maxEntries: number = 50
  ) {
    this.historyDir = baseDir;
    this.historyFile = path.join(baseDir, "history.json");
    this.maxHistoryEntries = maxEntries;
    this.ensureHistoryDir();
  }

  /**
   * Ensure history directory exists
   */
  private ensureHistoryDir(): void {
    if (!fs.existsSync(this.historyDir)) {
      fs.mkdirSync(this.historyDir, { recursive: true });
    }
  }

  /**
   * Save chat history to disk
   * Only keeps the most recent entries up to maxHistoryEntries
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

      fs.writeFileSync(
        this.historyFile,
        JSON.stringify(serialized, null, 2),
        "utf-8"
      );
    } catch (error) {
      console.error("Failed to save chat history:", error);
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

      // Deserialize (convert ISO strings back to Date objects)
      const history: ChatEntry[] = parsed.map((entry: any) => ({
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
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
}

// Singleton instance
let historyManagerInstance: HistoryManager | null = null;

/**
 * Get the singleton HistoryManager instance
 */
export function getHistoryManager(): HistoryManager {
  if (!historyManagerInstance) {
    historyManagerInstance = new HistoryManager();
  }
  return historyManagerInstance;
}
