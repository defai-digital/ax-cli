import { useState, useCallback, useEffect } from "react";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface InputHistoryHook {
  addToHistory: (input: string) => void;
  navigateHistory: (direction: "up" | "down") => string | null;
  getCurrentHistoryIndex: () => number;
  resetHistory: () => void;
  isNavigatingHistory: () => boolean;
  setOriginalInput: (input: string) => void;
}

const MAX_HISTORY_SIZE = 1000;
const HISTORY_FILE = path.join(
  os.homedir(),
  ".ax-cli",
  "command-history.json"
);

// Load command history from disk
function loadCommandHistory(): string[] {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const content = fs.readFileSync(HISTORY_FILE, "utf-8");
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
function saveCommandHistory(history: string[]): void {
  try {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save command history:", error);
  }
}

export function useInputHistory(): InputHistoryHook {
  const [history, setHistory] = useState<string[]>(() => loadCommandHistory());
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [originalInput, setOriginalInput] = useState("");

  // Save history to disk whenever it changes
  useEffect(() => {
    saveCommandHistory(history);
  }, [history]);

  const addToHistory = useCallback((input: string) => {
    if (input.trim() && !history.includes(input.trim())) {
      setHistory(prev => {
        const newHistory = [...prev, input.trim()];
        // Keep only the last MAX_HISTORY_SIZE entries to prevent unbounded growth
        if (newHistory.length > MAX_HISTORY_SIZE) {
          return newHistory.slice(-MAX_HISTORY_SIZE);
        }
        return newHistory;
      });
    }
    setCurrentIndex(-1);
    setOriginalInput("");
  }, [history]);

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
        newIndex = -1;
        return originalInput;
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
      if (fs.existsSync(HISTORY_FILE)) {
        fs.unlinkSync(HISTORY_FILE);
      }
    } catch (error) {
      console.error("Failed to clear command history file:", error);
    }
  }, []);

  const isNavigatingHistory = useCallback(() => currentIndex !== -1, [currentIndex]);

  const setOriginalInputCallback = useCallback((input: string) => {
    if (currentIndex === -1) {
      setOriginalInput(input);
    }
  }, [currentIndex]);

  return {
    addToHistory,
    navigateHistory,
    getCurrentHistoryIndex,
    resetHistory,
    isNavigatingHistory,
    setOriginalInput: setOriginalInputCallback,
  };
}