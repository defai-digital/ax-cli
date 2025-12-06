import React from 'react';
import { Text } from 'ink';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

// Debug logging helper - only logs when DEBUG=1 is set
const debugLog = (message: string, ...args: unknown[]) => {
  if (process.env.DEBUG === '1') {
    console.error(`[MarkdownRenderer] ${message}`, ...args);
  }
};

// Configure marked to use the terminal renderer with default settings
marked.setOptions({
  renderer: new (TerminalRenderer as any)()
});

export function MarkdownRenderer({ content }: { content: string }) {
  try {
    // Handle empty/whitespace-only content early to avoid unnecessary parsing
    if (!content || !content.trim()) {
      return <Text>{content || ''}</Text>;
    }

    // Use marked.parse for synchronous parsing
    const result = marked.parse(content);
    // Handle both sync and async results - Promise check for marked v5+
    const rendered = typeof result === 'string' ? result
      : (result && typeof result === 'object' && 'then' in result) ? content
      : content;

    // Debug: Log if async result was detected (fallback to raw content)
    if (result && typeof result === 'object' && 'then' in result) {
      debugLog('Async parse result detected, falling back to raw content');
    }

    return <Text>{rendered}</Text>;
  } catch (error) {
    // Fallback to plain text on parse errors
    // Debug logging helps troubleshoot markdown issues when DEBUG=1
    debugLog('Parse error, falling back to plain text:', error);
    return <Text>{content}</Text>;
  }
}