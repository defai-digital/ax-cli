import { useState, useCallback, useEffect, useRef } from "react";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { getAxBaseDir } from "../../utils/path-helpers.js";
import { HISTORY_CONFIG } from "../../constants.js";

export interface InputHistoryHook {
  addToHistory: (input: string) => void;
  navigateHistory: (direction: "up" | "down") => string | null;
  getCurrentHistoryIndex: () => number;
  resetHistory: () => void;
  isNavigatingHistory: () => boolean;
  setOriginalInput: (input: string) => void;
}

/**
 * Generate project-specific history file path
 * Uses SHA-256 hash of absolute path for consistent session identification
 * This prevents command history leakage between different projects
 */
function getHistoryFilePath(projectDir?: string): string {
  const baseDir = getAxBaseDir();

  if (projectDir) {
    // Use same hashing approach as chat history for consistency
    const absolutePath = path.resolve(projectDir);
    const hash = crypto.createHash('sha256').update(absolutePath).digest('hex');
    const sessionId = hash.substring(0, 16);

    // Store in separate directory for clarity
    const commandHistoryDir = path.join(baseDir, "command-history");
    if (!fs.existsSync(commandHistoryDir)) {
      fs.mkdirSync(commandHistoryDir, { recursive: true });
    }

    return path.join(commandHistoryDir, `${sessionId}.json`);
  }

  // Fallback to global history if no project directory provided
  return path.join(baseDir, "command-history.json");
}

// Load command history from disk
function loadCommandHistory(historyFile: string): string[] {
  try {
    if (fs.existsSync(historyFile)) {
      const content = fs.readFileSync(historyFile, "utf-8");
      // Handle empty file or whitespace-only content
      if (!content || !content.trim()) {
        return [];
      }
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    console.error("Failed to load command history:", error);
  }
  return [];
}

// Save command history to disk
function saveCommandHistory(historyFile: string, history: string[]): void {
  try {
    const dir = path.dirname(historyFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Atomic write pattern (same as chat history)
    const tempFile = `${historyFile}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(history, null, 2), "utf-8");
    fs.renameSync(tempFile, historyFile);
  } catch (error) {
    console.error("Failed to save command history:", error);
    // Clean up temp file if it exists
    try {
      const tempFile = `${historyFile}.tmp`;
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

export function useInputHistory(projectDir?: string): InputHistoryHook {
  const [historyFile] = useState(() => getHistoryFilePath(projectDir));
  const [history, setHistory] = useState<string[]>(() => loadCommandHistory(historyFile));
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [originalInput, setOriginalInput] = useState("");

  // Save history to disk whenever it changes
  useEffect(() => {
    saveCommandHistory(historyFile, history);
  }, [history, historyFile]);

  const addToHistory = useCallback((input: string) => {
    const trimmed = input.trim();
    if (!trimmed) {
      setCurrentIndex(-1);
      setOriginalInput("");
      return;
    }

    setHistory(prev => {
      // Deduplicate against latest state to avoid race conditions between calls
      if (prev.includes(trimmed)) {
        return prev;
      }

      const newHistory = [...prev, trimmed];
      // Keep only the last entries to prevent unbounded growth
      if (newHistory.length > HISTORY_CONFIG.MAX_HISTORY_SIZE) {
        return newHistory.slice(-HISTORY_CONFIG.MAX_HISTORY_SIZE);
      }
      return newHistory;
    });
    setCurrentIndex(-1);
    setOriginalInput("");
  }, []);

  const navigateHistory = useCallback((direction: "up" | "down"): string | null => {
    if (history.length === 0) return null;

    let newIndex: number;
    
    if (direction === "up") {
      if (currentIndex === -1) {
        newIndex = history.length - 1;
      } else {
        newIndex = Math.max(0, currentIndex - 1);
      }
    } else {
      if (currentIndex === -1) {
        return null;
      } else if (currentIndex === history.length - 1) {
        // At the most recent history item, pressing down returns to original input
        newIndex = -1;
      } else {
        newIndex = Math.min(history.length - 1, currentIndex + 1);
      }
    }

    setCurrentIndex(newIndex);
    return newIndex === -1 ? originalInput : history[newIndex];
  }, [history, currentIndex, originalInput]);

  const getCurrentHistoryIndex = useCallback(() => currentIndex, [currentIndex]);
  
  const resetHistory = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
    setOriginalInput("");
    // Clear the saved command history file
    try {
      if (fs.existsSync(historyFile)) {
        fs.unlinkSync(historyFile);
      }
    } catch (error) {
      console.error("Failed to clear command history file:", error);
    }
  }, [historyFile]);

  const isNavigatingHistory = useCallback(() => currentIndex !== -1, [currentIndex]);

  // BUG FIX: Use ref to avoid stale closure when rapidly navigating history
  // The callback was capturing stale currentIndex during rapid key presses
  const currentIndexRef = useRef(currentIndex);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const setOriginalInputCallback = useCallback((input: string) => {
    // Use ref to get current value without stale closure
    if (currentIndexRef.current === -1) {
      setOriginalInput(input);
    }
  }, []);

  return {
    addToHistory,
    navigateHistory,
    getCurrentHistoryIndex,
    resetHistory,
    isNavigatingHistory,
    setOriginalInput: setOriginalInputCallback,
  };
}
