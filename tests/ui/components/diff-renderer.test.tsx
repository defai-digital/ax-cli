import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';

// Mock theme colors to avoid config reads
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

import { DiffRenderer } from '../../../packages/core/src/ui/components/diff-renderer.js';

// Simple ANSI stripper for Ink output
const stripAnsi = (input: string | undefined): string => (input || '').replace(
  // eslint-disable-next-line no-control-regex
  /\u001B\[.*?m/g,
  ''
);

describe('DiffRenderer', () => {
  it('renders placeholder when diff content is empty', () => {
    const { lastFrame } = render(<DiffRenderer diffContent="" />);
    expect(stripAnsi(lastFrame())).toContain('No diff content.');
  });

  it('parses hunks, normalizes tabs, and renders changes', () => {
    const diff = [
      'Updated example.ts with changes',
      '@@ -1,2 +1,3 @@',
      '-\told line',
      '+\tnew line',
      ' context line',
      '\\ No newline at end of file',
    ].join('\n');

    const { lastFrame } = render(<DiffRenderer diffContent={diff} filename="example.ts" tabWidth={2} />);
    const frame = stripAnsi(lastFrame());

    expect(frame).toContain('1   +   new line'); // Tab normalized to spaces with line numbers
    expect(frame).toContain('1   -   old line');
    expect(frame).toContain('context line');
    // Gap separators should not appear for close line numbers
    expect(frame).not.toContain('══');
  });
});
