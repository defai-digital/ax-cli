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
}

export function KeyboardHelp({
  onClose,
  verbosityLevel = 0,
  backgroundMode = false,
  autoEditEnabled = true,
}: KeyboardHelpProps) {
  // Handle Escape and ? keys to close the help
  useInput((input, key) => {
    if (key.escape || input === "?") {
      onClose();
    }
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Header */}
      <Box borderStyle="double" borderColor="cyan" paddingX={2} marginBottom={1}>
        <Text bold color="cyan">
          ⌨️  AX CLI Keyboard Shortcuts
        </Text>
        <Text color="gray"> (Press Esc or ? to close)</Text>
      </Box>

      {/* Navigation Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">
          Navigation:
        </Text>
        <Box paddingLeft={2} flexDirection="column">
          <Text>
            <Text color="cyan" bold>↑ ↓</Text>
            <Text color="gray">         Navigate command history</Text>
          </Text>
          <Text>
            <Text color="cyan" bold>Ctrl+C</Text>
            <Text color="gray">       Clear current input</Text>
          </Text>
          <Text>
            {/* BUG FIX: Ctrl+D is delete char after cursor, not exit */}
            <Text color="cyan" bold>Ctrl+D</Text>
            <Text color="gray">       Delete character after cursor</Text>
          </Text>
        </Box>
      </Box>

      {/* Input Editing Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">
          Input Editing:
        </Text>
        <Box paddingLeft={2} flexDirection="column">
          <Text>
            <Text color="cyan" bold>Ctrl+J</Text>
            <Text color="gray">       Insert newline </Text>
            <Text color="green">(recommended)</Text>
          </Text>
          <Text>
            <Text color="cyan" bold>\+Enter</Text>
            <Text color="gray">      Insert newline (backslash escape)</Text>
          </Text>
          <Text>
            <Text color="cyan" bold>Enter</Text>
            <Text color="gray">         Submit prompt</Text>
          </Text>
          <Text>
            <Text color="cyan" bold>Ctrl+A</Text>
            <Text color="gray">       Move to start of line</Text>
          </Text>
          <Text>
            <Text color="cyan" bold>Ctrl+E</Text>
            <Text color="gray">       Move to end of line</Text>
          </Text>
          <Text>
            <Text color="cyan" bold>Ctrl+W</Text>
            <Text color="gray">       Delete word before cursor</Text>
          </Text>
          <Text>
            <Text color="cyan" bold>Ctrl+K</Text>
            <Text color="gray">       Open quick actions menu</Text>
          </Text>
        </Box>
        <Box paddingLeft={2} marginTop={0}>
          <Text color="gray" dimColor>
            Note: Shift+Enter may not work in all terminals. Use Ctrl+J instead.
          </Text>
        </Box>
      </Box>

      {/* Mode Toggles Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">
          Mode Toggles:
        </Text>
        <Box paddingLeft={2} flexDirection="column">
          <Text>
            <Text color="cyan" bold>Shift+Tab</Text>
            <Text color="gray">   Toggle auto-edit mode </Text>
            <Text color={autoEditEnabled ? "yellow" : "gray"}>
              ({autoEditEnabled ? "ON" : "OFF"})
            </Text>
          </Text>
          <Text>
            <Text color="cyan" bold>Ctrl+O</Text>
            <Text color="gray">       Cycle verbosity levels </Text>
            <Text color={verbosityLevel > 0 ? "yellow" : "gray"}>
              ({verbosityLevel === 0 ? "Quiet" : verbosityLevel === 1 ? "Concise" : "Verbose"})
            </Text>
          </Text>
          <Text>
            <Text color="cyan" bold>Ctrl+B</Text>
            <Text color="gray">       Toggle background mode </Text>
            <Text color={backgroundMode ? "magenta" : "gray"}>
              ({backgroundMode ? "ON" : "OFF"})
            </Text>
          </Text>
          <Text>
            <Text color="cyan" bold>Tab</Text>
            <Text color="gray">          Toggle thinking mode (GLM-4.6)</Text>
          </Text>
        </Box>
      </Box>

      {/* Content Actions Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">
          Content Actions:
        </Text>
        <Box paddingLeft={2} flexDirection="column">
          <Text>
            <Text color="cyan" bold>Ctrl+P</Text>
            <Text color="gray">       Toggle paste block collapse/expand</Text>
          </Text>
          <Text>
            <Text color="cyan" bold>Ctrl+Y</Text>
            <Text color="gray">       Copy last assistant response</Text>
          </Text>
          <Text>
            <Text color="cyan" bold>Ctrl+G</Text>
            <Text color="gray">       Open external editor ($EDITOR)</Text>
          </Text>
        </Box>
      </Box>

      {/* Slash Commands Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">
          Quick Commands:
        </Text>
        <Box paddingLeft={2} flexDirection="column">
          <Text>
            <Text color="cyan" bold>/help</Text>
            <Text color="gray">         Show all available commands</Text>
          </Text>
          <Text>
            <Text color="cyan" bold>/clear</Text>
            <Text color="gray">        Clear chat history</Text>
          </Text>
          <Text>
            <Text color="cyan" bold>/model</Text>
            <Text color="gray">        Switch AI model</Text>
          </Text>
          <Text>
            <Text color="cyan" bold>/status</Text>
            <Text color="gray">       Show system status</Text>
          </Text>
          <Text>
            <Text color="cyan" bold>/context</Text>
            <Text color="gray">      Show context window usage</Text>
          </Text>
        </Box>
      </Box>

      {/* Footer */}
      <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
        <Text color="gray" dimColor>
          💡 Tip: Type / to see all slash commands • Press ? anytime to show this help
        </Text>
      </Box>
    </Box>
  );
}

export default KeyboardHelp;
