import { describe, it, expect } from 'vitest';
import { isShiftEnterKey, isOptionEnterKey, isNewlineModifierKey, type Key } from '../../../packages/core/src/ui/hooks/use-enhanced-input.js';

describe('isShiftEnterKey', () => {
  // Method 1: Ink's built-in shift+return detection
  it('detects Shift+Enter when Ink reports modifiers', () => {
    const key: Key = { shift: true, return: true };
    expect(isShiftEnterKey('', key)).toBe(true);
  });

  it('does not detect plain Enter as Shift+Enter', () => {
    const key: Key = { return: true };
    expect(isShiftEnterKey('', key)).toBe(false);
  });

  // Method 2: CSI-u format (Kitty, WezTerm)
  it('detects CSI-u Shift+Enter sequences (kitty/WezTerm)', () => {
    const key: Key = { sequence: '\u001b[13;2u' };
    expect(isShiftEnterKey('', key)).toBe(true);
  });

  it('detects CSI-u Shift+Enter with alternative ESC notation', () => {
    const key: Key = { sequence: '\x1b[13;2u' };
    expect(isShiftEnterKey('', key)).toBe(true);
  });

  it('detects stripped CSI-u sequence (ESC removed by Ink)', () => {
    const key: Key = { sequence: '[13;2u' };
    expect(isShiftEnterKey('', key)).toBe(true);
  });

  // Method 2: xterm modifyOtherKeys format
  it('detects xterm modifyOtherKeys Shift+Enter sequences', () => {
    const key: Key = { sequence: '\u001b[13;2~' };
    expect(isShiftEnterKey('', key)).toBe(true);
  });

  it('detects stripped xterm sequence (ESC removed)', () => {
    const key: Key = { sequence: '[13;2~' };
    expect(isShiftEnterKey('', key)).toBe(true);
  });

  it('detects xterm extended format', () => {
    const key: Key = { sequence: '\u001b[27;2;13~' };
    expect(isShiftEnterKey('', key)).toBe(true);
  });

  // Method 2: SS3 format - CRITICAL FIX TESTS
  it('detects SS3 Shift+Enter (O2M)', () => {
    const key: Key = { sequence: 'O2M' };
    expect(isShiftEnterKey('', key)).toBe(true);
  });

  it('detects full SS3 Shift+Enter with ESC', () => {
    const key: Key = { sequence: '\u001bO2M' };
    expect(isShiftEnterKey('', key)).toBe(true);
  });

  // BUG FIX: Plain Enter in SS3 mode should NOT be detected as Shift+Enter
  it('does NOT detect plain SS3 Enter (OM) as Shift+Enter', () => {
    const key: Key = { sequence: 'OM' };
    expect(isShiftEnterKey('', key)).toBe(false);
  });

  it('does NOT detect plain SS3 Enter (OM) in inputChar as Shift+Enter', () => {
    const key: Key = {};
    expect(isShiftEnterKey('OM', key)).toBe(false);
  });

  it('does NOT detect full SS3 Enter (ESC O M) as Shift+Enter', () => {
    const key: Key = { sequence: '\u001bOM' };
    expect(isShiftEnterKey('', key)).toBe(false);
  });

  // Method 3: Check inputChar for escape sequences
  it('detects CSI-u sequence in inputChar', () => {
    const key: Key = {};
    expect(isShiftEnterKey('\u001b[13;2u', key)).toBe(true);
  });

  it('detects stripped CSI-u sequence in inputChar', () => {
    const key: Key = {};
    expect(isShiftEnterKey('[13;2u', key)).toBe(true);
  });

  it('detects SS3 Shift+Enter (O2M) in inputChar', () => {
    const key: Key = {};
    expect(isShiftEnterKey('O2M', key)).toBe(true);
  });

  // Other modifiers in SS3 format should also be detected
  it('detects SS3 Alt+Enter (O3M)', () => {
    const key: Key = { sequence: 'O3M' };
    expect(isShiftEnterKey('', key)).toBe(true);
  });

  it('detects SS3 Ctrl+Enter (O5M)', () => {
    const key: Key = { sequence: 'O5M' };
    expect(isShiftEnterKey('', key)).toBe(true);
  });

  // Negative tests - should NOT be detected as Shift+Enter
  it('does not treat literal pipe input as Shift+Enter', () => {
    const key: Key = { shift: true, sequence: '|', return: false };
    expect(isShiftEnterKey('|', key)).toBe(false);
  });

  it('does not treat regular text as Shift+Enter', () => {
    const key: Key = {};
    expect(isShiftEnterKey('hello', key)).toBe(false);
  });

  it('does not treat carriage return as Shift+Enter', () => {
    const key: Key = {};
    expect(isShiftEnterKey('\r', key)).toBe(false);
  });

  it('does not treat newline as Shift+Enter', () => {
    const key: Key = {};
    expect(isShiftEnterKey('\n', key)).toBe(false);
  });

  it('does not treat empty input as Shift+Enter', () => {
    const key: Key = {};
    expect(isShiftEnterKey('', key)).toBe(false);
  });

  // Edge case: O1M should NOT be Shift+Enter (modifier 1 = no modifier)
  it('does NOT detect O1M as Shift+Enter (modifier 1 = none)', () => {
    const key: Key = { sequence: 'O1M' };
    expect(isShiftEnterKey('', key)).toBe(false);
  });

  // Edge case: O0M should NOT be Shift+Enter
  it('does NOT detect O0M as Shift+Enter', () => {
    const key: Key = { sequence: 'O0M' };
    expect(isShiftEnterKey('', key)).toBe(false);
  });
});

describe('isOptionEnterKey', () => {
  // Method 1: Ink's built-in meta+return detection
  it('detects Option+Enter when Ink reports meta modifier', () => {
    const key: Key = { meta: true, return: true };
    expect(isOptionEnterKey('', key)).toBe(true);
  });

  it('does not detect plain Enter as Option+Enter', () => {
    const key: Key = { return: true };
    expect(isOptionEnterKey('', key)).toBe(false);
  });

  // Method 2: ESC followed by Enter (iTerm2 with "Esc+" option)
  it('detects ESC+CR as Option+Enter', () => {
    const key: Key = {};
    expect(isOptionEnterKey('\x1b\r', key)).toBe(true);
  });

  it('detects ESC+LF as Option+Enter', () => {
    const key: Key = {};
    expect(isOptionEnterKey('\x1b\n', key)).toBe(true);
  });

  // Method 3: CSI-u format with Alt modifier (modifier 3)
  it('detects CSI-u Alt+Enter sequences', () => {
    const key: Key = { sequence: '\u001b[13;3u' };
    expect(isOptionEnterKey('', key)).toBe(true);
  });

  it('detects stripped CSI-u Alt sequence', () => {
    const key: Key = { sequence: '[13;3u' };
    expect(isOptionEnterKey('', key)).toBe(true);
  });

  it('detects SS3 Alt+Enter (O3M)', () => {
    const key: Key = { sequence: 'O3M' };
    expect(isOptionEnterKey('', key)).toBe(true);
  });

  it('detects SS3 Alt+Enter (O3M) in inputChar', () => {
    const key: Key = {};
    expect(isOptionEnterKey('O3M', key)).toBe(true);
  });

  // Negative tests
  it('does not treat plain Enter as Option+Enter', () => {
    const key: Key = {};
    expect(isOptionEnterKey('\r', key)).toBe(false);
  });

  it('does not treat newline as Option+Enter', () => {
    const key: Key = {};
    expect(isOptionEnterKey('\n', key)).toBe(false);
  });

  it('does not treat Shift+Enter sequence as Option+Enter', () => {
    const key: Key = { sequence: '\u001b[13;2u' };
    expect(isOptionEnterKey('', key)).toBe(false);
  });
});

describe('isNewlineModifierKey', () => {
  // Should detect both Shift+Enter and Option+Enter
  it('detects Shift+Enter', () => {
    const key: Key = { shift: true, return: true };
    expect(isNewlineModifierKey('', key)).toBe(true);
  });

  it('detects Option+Enter', () => {
    const key: Key = { meta: true, return: true };
    expect(isNewlineModifierKey('', key)).toBe(true);
  });

  it('detects CSI-u Shift+Enter', () => {
    const key: Key = { sequence: '\u001b[13;2u' };
    expect(isNewlineModifierKey('', key)).toBe(true);
  });

  it('detects CSI-u Alt+Enter', () => {
    const key: Key = { sequence: '\u001b[13;3u' };
    expect(isNewlineModifierKey('', key)).toBe(true);
  });

  it('detects ESC+Enter (Option with Esc+ setting)', () => {
    const key: Key = {};
    expect(isNewlineModifierKey('\x1b\r', key)).toBe(true);
  });

  // Negative tests
  it('does not detect plain Enter', () => {
    const key: Key = { return: true };
    expect(isNewlineModifierKey('', key)).toBe(false);
  });

  it('does not detect plain carriage return', () => {
    const key: Key = {};
    expect(isNewlineModifierKey('\r', key)).toBe(false);
  });

  it('does not detect plain newline', () => {
    const key: Key = {};
    expect(isNewlineModifierKey('\n', key)).toBe(false);
  });

  it('does not detect regular text', () => {
    const key: Key = {};
    expect(isNewlineModifierKey('hello', key)).toBe(false);
  });
});
