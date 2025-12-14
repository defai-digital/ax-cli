import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';

// Mock theme colors to avoid config/FS access
vi.mock('../../../packages/core/src/ui/utils/colors.js', () => ({
  getThemeColors: () => ({
    primary: 'cyan',
    secondary: 'magenta',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    muted: 'gray',
    border: 'gray',
    accent: 'magenta',
    info: 'blue',
    textOnHighlight: 'white',
  }),
  Colors: {},
}));

import StatusBar from '../../../packages/core/src/ui/components/status-bar.js';

// Simple ANSI stripper for Ink output
const stripAnsi = (input: string | undefined): string => (input || '').replace(
  // eslint-disable-next-line no-control-regex
  /\u001B\[.*?m/g,
  ''
);

const baseProps = {
  projectName: 'proj',
  version: '1.0.0',
  model: 'glm-4.6',
  contextPercentage: 10,
  showAutoPrune: false,
  autoEditEnabled: false,
};

describe('StatusBar', () => {
  it('renders full layout with mode pills, tokens, MCP, and thinking indicator', () => {
    const { lastFrame } = render(
      <StatusBar
        {...baseProps}
        terminalWidth={200}
        mcpStatus={{ connected: 1, failed: 0, connecting: 0, total: 1 }}
        backgroundTaskCount={2}
        isProcessing
        tokenCount={1500}
        currentTokens={1200}
        maxTokens={4000}
        axEnabled
        activeAgent="bob"
        thinkingModeEnabled
        isThinking
        flashThinkingMode
      />
    );

    const frame = stripAnsi(lastFrame()).replace(/\s+/g, ' ');
    expect(frame).toContain('ctx avail'); // context bar rendered
    expect(frame).toContain('✕ 10'); // low context indicator
    expect(frame).toContain('bg:');
    expect(frame).toContain('mcp: ✓');
    expect(frame).toContain('Auto-Edit:');
    expect(frame).toContain('Verbosity:');
    expect(frame).toContain('Thinking:');
    expect(frame).toContain('THINKING...');
    expect(frame).toContain('(1k/4k)'); // token count display rounded
    expect(frame).toContain('Backend'); // active agent role mapping
  });

  it('falls back to compact layout and shows auto-prune state', () => {
    const { lastFrame } = render(
      <StatusBar
        {...baseProps}
        terminalWidth={80}
        showAutoPrune
        backgroundTaskCount={0}
        mcpStatus={{ connected: 0, failed: 0, connecting: 0, total: 0 }}
      />
    );

    const frame = stripAnsi(lastFrame());
    expect(frame).toContain('ctx:');
    expect(frame).toContain('auto-pruned');
    expect(frame).toContain('mcp: -');
    expect(frame).toContain('bg: 0');
  });
});
