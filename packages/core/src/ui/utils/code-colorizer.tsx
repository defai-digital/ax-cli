import React from 'react';
import { Text, Box } from 'ink';

/**
 * Render code content. Parameters reserved for future syntax highlighting.
 * @param content - The code content to render
 * @param _language - Reserved: language for syntax highlighting (not yet implemented)
 * @param _availableTerminalHeight - Reserved: height constraint (not yet implemented)
 * @param _terminalWidth - Reserved: width constraint (not yet implemented)
 */
export const colorizeCode = (
  content: string,
  _language: string | null,
  _availableTerminalHeight?: number,
  _terminalWidth?: number
): React.ReactNode => {
  return (
    <Box flexDirection="column">
      {content.split('\n').map((line, index) => (
        <Text key={index} wrap="wrap">
          {line}
        </Text>
      ))}
    </Box>
  );
};