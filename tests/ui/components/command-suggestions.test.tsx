import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import {
  CommandSuggestions,
  filterCommandSuggestions,
  trackCommandUsage,
  getCommandUsageCount,
  resetCommandUsageTracking,
} from '../../../packages/core/src/ui/components/command-suggestions.js';

// Simple ANSI stripper for Ink output
const stripAnsi = (input: string | undefined): string => (input || '').replace(
  // eslint-disable-next-line no-control-regex
  /\u001B\[.*?m/g,
  ''
);

describe('CommandSuggestions component', () => {
  beforeEach(() => {
    resetCommandUsageTracking();
  });

  it('ranks suggestions by fuzzy match and usage frequency', () => {
    const suggestions = [
      { command: '/help', description: 'Show help' },
      { command: '/hello', description: 'Say hello' },
      { command: '/halt', description: 'Stop' },
    ];

    // Boost /help usage
    trackCommandUsage('/help');
    trackCommandUsage('/help');
    expect(getCommandUsageCount('/help')).toBe(2);

    const filtered = filterCommandSuggestions(suggestions, '/he');
    expect(filtered[0].command).toBe('/help'); // Usage boost wins tie
    expect(filtered).toHaveLength(2);
  });

  it('renders visible suggestions and hides when not visible', () => {
    const baseProps = {
      suggestions: [
        { command: '/help', description: 'Show help' },
        { command: '/retry', description: 'Retry last message' },
      ],
      input: '/',
      selectedIndex: 1,
      isVisible: true,
    };

    const { lastFrame, rerender } = render(<CommandSuggestions {...baseProps} />);
    const frame = stripAnsi(lastFrame());

    expect(frame).toContain('/help');
    expect(frame).toContain('/retry');
    // Navigation hint footer
    expect(frame).toContain('navigate');

    rerender(<CommandSuggestions {...baseProps} isVisible={false} />);
    expect(stripAnsi(lastFrame())).toBe('');
  });
});
