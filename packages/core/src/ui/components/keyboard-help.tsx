/**
 * Keyboard Shortcuts Help Component
 *
 * Displays a comprehensive, context-aware keyboard shortcut reference.
 * Triggered by pressing `?` key in the input field.
 *
 * P1.4: Priority 1 Feature - High Value / Low Risk
 */

import React from "react";
import { Box, Text, useInput } from "ink";

interface KeyboardHelpProps {
  onClose: () => void;
  verbosityLevel?: number;
  backgroundMode?: boolean;
  autoEditEnabled?: boolean;
  thinkingModeEnabled?: boolean;
}

// Consistent column width for shortcut keys
const SHORTCUT_WIDTH = 12;

// Reusable row component for consistent alignment
// Type-safe color values for Ink's Text component
type InkColor = "gray" | "yellow" | "magenta" | "green" | "cyan" | "red" | "blue" | "white";

function ShortcutRow({
  shortcut,
  description,
  recommended,
  status,
  statusColor,
}: {
  shortcut: string;
  description: string;
  recommended?: boolean;
  status?: string;
  statusColor?: InkColor;
}) {
  return (
    <Box>
      <Box width={SHORTCUT_WIDTH}>
        <Text color="cyan" bold>{shortcut}</Text>
      </Box>
      <Text color="gray">{description}</Text>
      {recommended && <Text color="green"> (recommended)</Text>}
      {status && (
        <Text color={statusColor || "gray"}> ({status})</Text>
      )}
    </Box>
  );
}

export function KeyboardHelp({
  onClose,
  verbosityLevel = 0,
  backgroundMode = false,
  autoEditEnabled = true,
  thinkingModeEnabled = false,
}: KeyboardHelpProps) {
  // Handle Escape and ? keys to close the help
  // BUG FIX: Add explicit isActive option to prevent input capture during transitions
  useInput(
    (input, key) => {
      if (key.escape || input === "?") {
        onClose();
      }
    },
    { isActive: true }
  );

  const verbosityLabel =
    verbosityLevel === 0 ? "Quiet" :
    verbosityLevel === 1 ? "Concise" : "Verbose";

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Header */}
      <Box borderStyle="double" borderColor="cyan" paddingX={2} marginBottom={1}>
        <Text bold color="cyan">
          AX CLI Keyboard Shortcuts
        </Text>
        <Text color="white"> (Press Esc or ? to close)</Text>
      </Box>

      {/* Navigation Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">Navigation:</Text>
        <Box paddingLeft={2} flexDirection="column">
          <ShortcutRow key="nav-updown" shortcut="Up/Down" description="Navigate command history" />
          <ShortcutRow key="nav-home" shortcut="Home" description="Move to start of input" />
          <ShortcutRow key="nav-end" shortcut="End" description="Move to end of input" />
          <ShortcutRow key="nav-ctrl-left" shortcut="Ctrl+Left" description="Move to previous word" />
          <ShortcutRow key="nav-ctrl-right" shortcut="Ctrl+Right" description="Move to next word" />
        </Box>
      </Box>

      {/* Input Editing Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">Input Editing:</Text>
        <Box paddingLeft={2} flexDirection="column">
          <ShortcutRow key="edit-ctrl-j" shortcut="Ctrl+J" description="Insert newline" recommended />
          <ShortcutRow key="edit-backslash" shortcut="\+Enter" description="Insert newline (backslash)" />
          <ShortcutRow key="edit-enter" shortcut="Enter" description="Submit prompt" />
          <ShortcutRow key="edit-ctrl-a" shortcut="Ctrl+A" description="Move to start of line" />
          <ShortcutRow key="edit-ctrl-e" shortcut="Ctrl+E" description="Move to end of line" />
          <ShortcutRow key="edit-ctrl-d" shortcut="Ctrl+D" description="Delete character after cursor" />
          <ShortcutRow key="edit-ctrl-w" shortcut="Ctrl+W" description="Delete word before cursor" />
          <ShortcutRow key="edit-ctrl-u" shortcut="Ctrl+U" description="Delete to start of line" />
          <ShortcutRow key="edit-ctrl-c" shortcut="Ctrl+C" description="Clear current input" />
          <ShortcutRow key="edit-ctrl-x" shortcut="Ctrl+X" description="Clear entire input" />
          <ShortcutRow key="edit-esc-esc" shortcut="Esc Esc" description="Clear input (double-tap)" />
          <ShortcutRow key="edit-ctrl-k" shortcut="Ctrl+K" description="Open quick actions menu" />
        </Box>
        <Box paddingLeft={2} marginTop={0} flexDirection="column">
          <Text color="gray" dimColor>
            Note: Shift+Enter may not work in all terminals. Use Ctrl+J instead.
          </Text>
        </Box>
      </Box>

      {/* Mode Toggles Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">Mode Toggles:</Text>
        <Box paddingLeft={2} flexDirection="column">
          <ShortcutRow
            key="mode-auto-edit"
            shortcut="Shift+Tab"
            description="Toggle auto-edit mode"
            status={autoEditEnabled ? "ON" : "OFF"}
            statusColor={autoEditEnabled ? "yellow" : "gray"}
          />
          <ShortcutRow
            key="mode-verbosity"
            shortcut="Ctrl+O"
            description="Cycle verbosity levels"
            status={verbosityLabel}
            statusColor={verbosityLevel > 0 ? "yellow" : "gray"}
          />
          <ShortcutRow
            key="mode-background"
            shortcut="Ctrl+B"
            description="Toggle background mode"
            status={backgroundMode ? "ON" : "OFF"}
            statusColor={backgroundMode ? "magenta" : "gray"}
          />
          <ShortcutRow
            key="mode-thinking"
            shortcut="Tab"
            description="Toggle thinking mode"
            status={thinkingModeEnabled ? "ON" : "OFF"}
            statusColor={thinkingModeEnabled ? "yellow" : "gray"}
          />
        </Box>
      </Box>

      {/* Content Actions Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">Content Actions:</Text>
        <Box paddingLeft={2} flexDirection="column">
          <ShortcutRow key="action-ctrl-p" shortcut="Ctrl+P" description="Toggle paste block collapse" />
          <ShortcutRow key="action-ctrl-y" shortcut="Ctrl+Y" description="Copy last assistant response" />
          <ShortcutRow key="action-ctrl-g" shortcut="Ctrl+G" description="Open external editor ($EDITOR)" />
        </Box>
      </Box>

      {/* Slash Commands Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">Quick Commands:</Text>
        <Box paddingLeft={2} flexDirection="column">
          <ShortcutRow key="cmd-help" shortcut="/help" description="Show all available commands" />
          <ShortcutRow key="cmd-clear" shortcut="/clear" description="Clear chat history" />
          <ShortcutRow key="cmd-model" shortcut="/model" description="Switch AI model" />
          <ShortcutRow key="cmd-status" shortcut="/status" description="Show system status" />
          <ShortcutRow key="cmd-context" shortcut="/context" description="Show context window usage" />
        </Box>
      </Box>

      {/* Footer */}
      <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
        <Text color="white">
          Tip: Type / to see all slash commands
        </Text>
      </Box>
    </Box>
  );
}

export default KeyboardHelp;
