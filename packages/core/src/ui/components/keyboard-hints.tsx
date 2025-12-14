/**
 * Keyboard Hints Component
 * Shows contextual keyboard shortcuts based on current state
 */

import React from "react";
import { Box, Text } from "ink";

interface KeyboardHintsProps {
  mode: "idle" | "typing" | "processing" | "confirmation" | "menu";
  showExtended?: boolean;
}

interface Shortcut {
  keys: string;
  description: string;
  category?: string;
}

const SHORTCUTS_BY_MODE: Record<string, Shortcut[]> = {
  idle: [
    { keys: "Enter", description: "send message" },
    { keys: "Ctrl+K", description: "quick actions" },
    { keys: "↑/↓", description: "history" },
    { keys: "Ctrl+C", description: "clear input" },
  ],
  typing: [
    { keys: "Enter", description: "send" },
    { keys: "Shift+Enter", description: "new line" },
    { keys: "Ctrl+P", description: "toggle paste" },
    { keys: "Tab", description: "complete" },
    { keys: "Esc×2", description: "clear input" },
  ],
  processing: [
    { keys: "Esc", description: "interrupt" },
  ],
  confirmation: [
    { keys: "1-4", description: "quick select" },
    { keys: "↑/↓", description: "navigate" },
    { keys: "Enter", description: "select" },
    { keys: "Esc", description: "cancel" },
  ],
  menu: [
    { keys: "↑/↓", description: "navigate" },
    { keys: "Enter", description: "select" },
    { keys: "Esc", description: "close" },
    { keys: "Type", description: "search" },
  ],
};

const EXTENDED_SHORTCUTS: Shortcut[] = [
  { keys: "Shift+Tab", description: "toggle auto-edit" },
  { keys: "Ctrl+O", description: "toggle verbose" },
  { keys: "Ctrl+B", description: "background mode" },
  { keys: "?", description: "all shortcuts" },
];

/**
 * Complete keyboard shortcut reference
 * Organized by category for the full shortcut guide
 */
export const ALL_SHORTCUTS: Record<string, Shortcut[]> = {
  "Navigation": [
    { keys: "↑/↓", description: "Navigate command history" },
    { keys: "Ctrl+←/→", description: "Move cursor by word" },
    { keys: "Ctrl+A", description: "Move to line start" },
    { keys: "Ctrl+E", description: "Move to line end" },
  ],
  "Editing": [
    { keys: "Ctrl+C", description: "Clear current input" },
    { keys: "Ctrl+X", description: "Clear entire input line" },
    { keys: "Ctrl+W", description: "Delete word before cursor" },
    { keys: "Ctrl+U", description: "Delete to start of line" },
    { keys: "Backspace", description: "Delete character before" },
    { keys: "Delete", description: "Delete character after" },
  ],
  "Modes": [
    { keys: "Shift+Tab", description: "Toggle auto-edit mode" },
    { keys: "Ctrl+O", description: "Toggle verbose mode" },
    { keys: "Ctrl+B", description: "Toggle background mode" },
    { keys: "Tab", description: "Toggle thinking mode (empty input)" },
  ],
  "Actions": [
    { keys: "Enter", description: "Send message / confirm" },
    { keys: "Shift+Enter", description: "Insert newline (run /terminal-setup first)" },
    { keys: "\\+Enter", description: "Insert newline (works everywhere)" },
    { keys: "Ctrl+K", description: "Open quick actions menu" },
    { keys: "Ctrl+P", description: "Expand/collapse pasted text" },
    { keys: "Ctrl+Y", description: "Copy last response" },
    { keys: "Tab", description: "Complete command suggestion" },
    { keys: "Esc", description: "Cancel / close menu / interrupt" },
    { keys: "Esc×2", description: "Clear input (press twice quickly)" },
    { keys: "?", description: "Show keyboard shortcuts" },
  ],
  "Confirmation Dialog": [
    { keys: "1-4", description: "Quick select option" },
    { keys: "↑/↓", description: "Navigate options" },
    { keys: "Enter", description: "Select highlighted" },
    { keys: "Esc", description: "Cancel operation" },
  ],
};

export function KeyboardHints({
  mode,
  showExtended = false,
}: KeyboardHintsProps) {
  // BUG FIX: Use bracket notation with explicit fallback to avoid potential undefined
  // Also ensure 'idle' fallback exists in case of unknown mode values
  const shortcuts = SHORTCUTS_BY_MODE[mode] ?? SHORTCUTS_BY_MODE['idle'] ?? [];

  return (
    <Box flexDirection="row" flexWrap="wrap">
      {shortcuts.map((shortcut, index) => (
        <Box key={shortcut.keys} marginRight={2}>
          <Text color="yellow" dimColor>
            {shortcut.keys}
          </Text>
          <Text color="gray" dimColor>
            {" "}
            {shortcut.description}
          </Text>
          {index < shortcuts.length - 1 && (
            <Text color="gray" dimColor>
              {" "}•
            </Text>
          )}
        </Box>
      ))}

      {showExtended && (
        <>
          <Text color="gray" dimColor>
            {" "}|{" "}
          </Text>
          {EXTENDED_SHORTCUTS.slice(0, 2).map((shortcut) => (
            <Box key={shortcut.keys} marginRight={2}>
              <Text color="yellow" dimColor>
                {shortcut.keys}
              </Text>
              <Text color="gray" dimColor>
                {" "}
                {shortcut.description}
              </Text>
            </Box>
          ))}
        </>
      )}
    </Box>
  );
}

/**
 * Full Keyboard Shortcut Guide Component
 * Shows all available shortcuts organized by category
 * Can be displayed via /shortcuts command or ? key
 */
export interface KeyboardShortcutGuideProps {
  onClose?: () => void;
}

export function KeyboardShortcutGuide({ onClose }: KeyboardShortcutGuideProps) {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text color="cyan" bold>⌨️  Keyboard Shortcuts</Text>
        {onClose && (
          <Text color="gray" dimColor> (Esc to close)</Text>
        )}
      </Box>

      {Object.entries(ALL_SHORTCUTS).map(([category, shortcuts]) => (
        <Box key={category} flexDirection="column" marginBottom={1}>
          <Text color="yellow" bold>{category}</Text>
          <Box flexDirection="column" paddingLeft={2}>
            {shortcuts.map((shortcut) => (
              <Box key={shortcut.keys} flexDirection="row">
                <Box width={16}>
                  <Text color="white">{shortcut.keys}</Text>
                </Box>
                <Text color="gray">{shortcut.description}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      ))}

      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor>
          💡 Tip: Use /help for all commands • Ctrl+K for quick actions
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Generates keyboard shortcut guide as a string
 * Useful for displaying in chat history via /shortcuts command
 */
export function getKeyboardShortcutGuideText(): string {
  let guide = "⌨️  **Keyboard Shortcuts**\n\n";

  for (const [category, shortcuts] of Object.entries(ALL_SHORTCUTS)) {
    guide += `**${category}**\n`;
    for (const shortcut of shortcuts) {
      guide += `  ${shortcut.keys.padEnd(14)} ${shortcut.description}\n`;
    }
    guide += "\n";
  }

  guide += "💡 Tip: Use /help for all commands • Ctrl+K for quick actions";
  return guide;
}

export default KeyboardHints;
