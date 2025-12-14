import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { ReasoningDisplay } from '../../../packages/core/src/ui/components/reasoning-display.js';

// Simple ANSI stripper for Ink output
const stripAnsi = (input: string | undefined): string => (input || '').replace(
  // eslint-disable-next-line no-control-regex
  /\u001B\[.*?m/g,
  ''
);

describe('ReasoningDisplay', () => {
  it('renders nothing when invisible or empty', () => {
    const { lastFrame } = render(<ReasoningDisplay content="" visible={false} />);
    expect(stripAnsi(lastFrame())).toBe('');
  });

  it('auto-collapses long reasoning and shows preview', () => {
    const longContent = Array.from({ length: 220 }, (_, i) => `word${i}`).join(' ');
    const { lastFrame } = render(<ReasoningDisplay content={longContent} />);
    const frame = stripAnsi(lastFrame());

    expect(frame).toContain('Thinking ▸');
    expect(frame).toContain('...');
    // Should not render the tail of the long content when collapsed
    expect(frame.includes('word219')).toBe(false);
  });

  it('shows full content while streaming even when long', () => {
    const longContent = Array.from({ length: 210 }, (_, i) => `word${i}`).join(' ');
    const { lastFrame } = render(
      <ReasoningDisplay content={longContent} isStreaming defaultCollapsed={false} />
    );
    const frame = stripAnsi(lastFrame());

    expect(frame).toContain('Thinking ▾...');
    expect(frame).toContain('word209'); // Full content rendered when streaming
  });
});
