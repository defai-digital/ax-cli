/**
 * Quick Actions Menu Component (Ctrl+K style command palette)
 * Provides fast access to common commands
 */

import React, { useState, useEffect, useMemo } from "react";
import { Box, Text, useInput } from "ink";

interface QuickAction {
  command: string;
  label: string;
  description: string;
  category: "navigation" | "settings" | "tools" | "help";
  shortcut?: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  // Navigation
  { command: "/clear", label: "Clear", description: "Clear conversation history", category: "navigation" },
  { command: "/continue", label: "Continue", description: "Resume incomplete response", category: "navigation" },
  { command: "/exit", label: "Exit", description: "Exit ax-cli", category: "navigation" },
  { command: "jump:latest", label: "Jump to Latest", description: "Scroll to most recent messages", category: "navigation" },

  // Settings
  { command: "/init", label: "Init", description: "Initialize project context (CUSTOM.md)", category: "settings" },
  { command: "/models", label: "Models", description: "List available models", category: "settings" },
  { command: "/setup", label: "Setup", description: "Configure API keys and settings", category: "settings" },
  { command: "toggle:verbosity", label: "Toggle Verbosity", description: "Cycle Quiet → Concise → Verbose", category: "settings", shortcut: "^O" },
  { command: "toggle:autoedit", label: "Toggle Auto-edit", description: "Enable/disable auto-approve edits", category: "settings", shortcut: "⇧⇥" },
  { command: "toggle:thinking", label: "Toggle Thinking Mode", description: "Enable/disable reasoning mode (empty input)", category: "settings", shortcut: "Tab" },
  { command: "toggle:background", label: "Toggle Background Mode", description: "Move next bash to background / toggle", category: "settings", shortcut: "^B" },

  // Tools
  { command: "/context", label: "Context", description: "Show context window breakdown", category: "tools" },
  { command: "/tasks", label: "Tasks", description: "List background tasks", category: "tools" },
  { command: "/usage", label: "Usage", description: "Show API usage statistics", category: "tools" },
  { command: "/mcp list", label: "MCP List", description: "List connected MCP servers", category: "tools" },
  { command: "/commit-and-push", label: "Commit", description: "AI commit & push to remote", category: "tools" },
  { command: "/rewind", label: "Rewind", description: "Rewind to previous checkpoint", category: "tools" },
  { command: "/checkpoints", label: "Checkpoints", description: "Show checkpoint statistics", category: "tools" },
  { command: "/memory", label: "Memory", description: "Show project memory status", category: "tools" },
  { command: "/memory warmup", label: "Memory Warmup", description: "Generate project memory", category: "tools" },

  // Help
  { command: "/help", label: "Help", description: "Show all available commands", category: "help" },
  { command: "/shortcuts", label: "Shortcuts", description: "Show keyboard shortcuts", category: "help" },
  { command: "show:keyboard-shortcuts", label: "Keyboard Help", description: "Open keyboard shortcuts overlay", category: "help", shortcut: "^H" },
];

interface QuickActionsProps {
  isVisible: boolean;
  onSelect: (command: string) => void;
  onClose: () => void;
}

export function QuickActions({ isVisible, onSelect, onClose }: QuickActionsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Fuzzy match scoring function
  const fuzzyScore = (text: string, query: string): number => {
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();

    // Exact match gets highest score
    if (textLower === queryLower) return 1000;

    // Starts with gets high score
    if (textLower.startsWith(queryLower)) return 500;

    // Contains as substring gets medium score
    if (textLower.includes(queryLower)) return 200;

    // Fuzzy match: check if all query chars appear in order
    let textIdx = 0;
    let matchCount = 0;
    for (const char of queryLower) {
      const foundIdx = textLower.indexOf(char, textIdx);
      if (foundIdx === -1) return 0; // No match
      matchCount++;
      textIdx = foundIdx + 1;
    }

    // Score based on how many chars matched
    return matchCount * 10;
  };

  // Filter and sort actions based on fuzzy search query
  const filteredActions = useMemo(() => {
    if (!searchQuery) return QUICK_ACTIONS;

    const query = searchQuery.toLowerCase();

    // Score each action and filter out non-matches
    const scored = QUICK_ACTIONS.map((action) => {
      const commandScore = fuzzyScore(action.command, query);
      const labelScore = fuzzyScore(action.label, query);
      const descScore = fuzzyScore(action.description, query);
      const maxScore = Math.max(commandScore, labelScore, descScore);

      return { action, score: maxScore };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

    return scored.map(({ action }) => action);
  }, [searchQuery]);

  // Reset selection when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredActions]);

  // Reset state when menu opens
  useEffect(() => {
    if (isVisible) {
      setSearchQuery("");
      setSelectedIndex(0);
    }
  }, [isVisible]);

  useInput(
    (input, key) => {
      if (!isVisible) return;

      if (key.escape) {
        onClose();
        return;
      }

      if (key.return) {
        // Bounds check to prevent crash if selectedIndex is stale
        const safeIndex = Math.min(selectedIndex, filteredActions.length - 1);
        if (filteredActions.length > 0 && safeIndex >= 0) {
          onSelect(filteredActions[safeIndex].command);
        }
        return;
      }

      // Navigation: Arrow keys or vim-style j/k
      if (key.upArrow || (input === 'k' && !searchQuery)) {
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredActions.length - 1
        );
        return;
      }

      if (key.downArrow || (input === 'j' && !searchQuery)) {
        setSelectedIndex((prev) =>
          prev < filteredActions.length - 1 ? prev + 1 : 0
        );
        return;
      }

      if (key.backspace || key.delete) {
        setSearchQuery((prev) => prev.slice(0, -1));
        return;
      }

      // Add character to search
      if (input && !key.ctrl && !key.meta) {
        setSearchQuery((prev) => prev + input);
      }
    },
    { isActive: isVisible }
  );

  // BUG FIX: Move useMemo before early return to comply with React's Rules of Hooks.
  // Hooks must be called in the same order on every render.
  const { groupedActions, actionIndices } = useMemo(() => {
    const groups: Record<string, QuickAction[]> = {};
    const indices = new Map<string, number>();
    let idx = 0;

    filteredActions.forEach((action) => {
      if (!groups[action.category]) {
        groups[action.category] = [];
      }
      groups[action.category].push(action);
      indices.set(action.command, idx++);
    });

    return { groupedActions: groups, actionIndices: indices };
  }, [filteredActions]);

  if (!isVisible) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      paddingY={0}
      marginTop={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          ⌘ Quick Actions
        </Text>
        <Text color="gray"> (type to search)</Text>
      </Box>

      {/* Search input */}
      <Box
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        marginBottom={1}
      >
        <Text color="cyan">❯ </Text>
        <Text>
          {searchQuery}
          <Text backgroundColor="white" color="black">
            {" "}
          </Text>
        </Text>
        {!searchQuery && (
          <Text color="gray" dimColor>
            Search commands...
          </Text>
        )}
      </Box>

      {/* Actions list */}
      {filteredActions.length === 0 ? (
        <Box>
          <Text color="gray">No matching commands found</Text>
        </Box>
      ) : (
        Object.entries(groupedActions).map(([category, actions]) => (
          <Box key={category} flexDirection="column" marginBottom={1}>
            {/* Category header */}
            <Box>
              <Text color="gray" dimColor bold>
                {category.toUpperCase()}
              </Text>
            </Box>

            {/* Actions in category */}
            {actions.map((action) => {
              const currentIndex = actionIndices.get(action.command) ?? -1;
              const isSelected = currentIndex === selectedIndex;

              return (
                <Box key={action.command} paddingLeft={1}>
                  <Text
                    color={isSelected ? "black" : "cyan"}
                    backgroundColor={isSelected ? "cyan" : undefined}
                  >
                    {/* BUG FIX: Increased padding from 15 to 24 to fit longest command (show:keyboard-shortcuts) */}
                    {action.command.padEnd(24)}
                  </Text>
                  <Text
                    color={isSelected ? "black" : "gray"}
                    backgroundColor={isSelected ? "cyan" : undefined}
                  >
                    {" "}{action.description}
                    {action.shortcut && ` (${action.shortcut})`}
                  </Text>
                </Box>
              );
            })}
          </Box>
        ))
      )}

      {/* Footer hints */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓ or j/k navigate • Enter select • Esc close
        </Text>
      </Box>
    </Box>
  );
}

export default QuickActions;
