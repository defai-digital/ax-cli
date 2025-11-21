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
}

const QUICK_ACTIONS: QuickAction[] = [
  // Navigation
  { command: "/clear", label: "Clear", description: "Clear conversation history", category: "navigation" },
  { command: "/continue", label: "Continue", description: "Resume incomplete response", category: "navigation" },
  { command: "/exit", label: "Exit", description: "Exit ax-cli", category: "navigation" },

  // Settings
  { command: "/init", label: "Init", description: "Initialize project context (CUSTOM.md)", category: "settings" },
  { command: "/models", label: "Models", description: "List available models", category: "settings" },
  { command: "/setup", label: "Setup", description: "Configure API keys and settings", category: "settings" },

  // Tools
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
];

interface QuickActionsProps {
  isVisible: boolean;
  onSelect: (command: string) => void;
  onClose: () => void;
}

export function QuickActions({ isVisible, onSelect, onClose }: QuickActionsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter actions based on search query
  const filteredActions = useMemo(() => {
    if (!searchQuery) return QUICK_ACTIONS;

    const query = searchQuery.toLowerCase();
    return QUICK_ACTIONS.filter(
      (action) =>
        action.command.toLowerCase().includes(query) ||
        action.label.toLowerCase().includes(query) ||
        action.description.toLowerCase().includes(query)
    );
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

      if (key.upArrow) {
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredActions.length - 1
        );
        return;
      }

      if (key.downArrow) {
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

  if (!isVisible) return null;

  // Group actions by category with pre-calculated indices
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
                    {action.command.padEnd(15)}
                  </Text>
                  <Text
                    color={isSelected ? "black" : "gray"}
                    backgroundColor={isSelected ? "cyan" : undefined}
                  >
                    {" "}{action.description}
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
          ↑↓ navigate • Enter select • Esc close
        </Text>
      </Box>
    </Box>
  );
}

export default QuickActions;
