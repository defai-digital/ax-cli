import { describe, it, expect } from 'vitest';
import { isShiftEnterKey, type Key } from '../../../src/ui/hooks/use-enhanced-input.js';

describe('isShiftEnterKey', () => {
  it('detects Shift+Enter when Ink reports modifiers', () => {
    const key: Key = { shift: true, return: true };
    expect(isShiftEnterKey('', key)).toBe(true);
  });

  it('detects CSI-u Shift+Enter sequences (kitty/WezTerm)', () => {
    const key: Key = { sequence: '\u001b[13;2u' };
    expect(isShiftEnterKey('', key)).toBe(true);
  });

  it('detects xterm modifyOtherKeys Shift+Enter sequences', () => {
    const key: Key = { sequence: '\u001b[13;2~' };
    expect(isShiftEnterKey('', key)).toBe(true);
  });

  it('does not treat literal pipe input as Shift+Enter', () => {
    const key: Key = { shift: true, sequence: '|', return: false };
    expect(isShiftEnterKey('|', key)).toBe(false);
  });
});
