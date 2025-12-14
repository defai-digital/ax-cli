import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import {
  KeyboardHints,
  KeyboardShortcutGuide,
  getKeyboardShortcutGuideText,
} from '../../../packages/core/src/ui/components/keyboard-hints.js';

const stripAnsi = (input: string | undefined) =>
  (input ?? '').replace(
    // eslint-disable-next-line no-control-regex
    /\u001B\[.*?m/g,
    ''
  );

describe('KeyboardHints', () => {
  it('falls back to idle shortcuts and can show extended entries', () => {
    const { lastFrame } = render(
      <KeyboardHints mode={'unknown' as any} showExtended />
    );

    const frame = stripAnsi(lastFrame());
    expect(frame).toContain('Enter');
    expect(frame).toContain('quick actions');
    expect(frame).toContain('Shift+Tab');
    expect(frame).toContain('Ctrl+O');
  });

  it('renders full shortcut guide with close hint when provided', () => {
    const { lastFrame } = render(<KeyboardShortcutGuide onClose={() => {}} />);
    const frame = stripAnsi(lastFrame());

    expect(frame).toContain('Keyboard Shortcuts');
    expect(frame).toContain('Navigation');
    expect(frame).toContain('(Esc to close)');
    expect(frame).toContain('Enter');
  });

  it('builds a plain-text shortcut guide for chat responses', () => {
    const guide = getKeyboardShortcutGuideText();
    expect(guide).toContain('⌨️');
    expect(guide).toContain('Navigation');
    expect(guide).toContain('Ctrl+K');
    expect(guide.trim().endsWith('Ctrl+K for quick actions')).toBe(true);
  });
});
