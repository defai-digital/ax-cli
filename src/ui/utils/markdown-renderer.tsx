import React from 'react';
import { Text } from 'ink';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

// Configure marked to use the terminal renderer with default settings
marked.setOptions({
  renderer: new (TerminalRenderer as any)()
});

export function MarkdownRenderer({ content }: { content: string }) {
  try {
    // BUG FIX: Handle empty/whitespace-only content early to avoid unnecessary parsing
    if (!content || !content.trim()) {
      return <Text>{content || ''}</Text>;
    }

    // Use marked.parse for synchronous parsing
    const result = marked.parse(content);
    // Handle both sync and async results - Promise check for marked v5+
    // BUG FIX: Check for Promise explicitly since typeof Promise is 'object'
    const rendered = typeof result === 'string' ? result
      : (result && typeof result === 'object' && 'then' in result) ? content
      : content;
    return <Text>{rendered}</Text>;
  } catch {
    // BUG FIX: Silent fallback to plain text - don't clutter CLI with errors
    return <Text>{content}</Text>;
  }
}