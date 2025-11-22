/**
 * Tests for Input Sanitizer (REQ-SEC-007)
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeInput,
  sanitizeFilePath,
  sanitizeCommand,
  sanitizeSearchQuery,
  sanitizeEnvValue,
  escapeShellArg,
  normalizeUnicode,
  detectDangerousPatterns,
  validateRegexPattern,
  SAFE_PATTERNS,
  MAX_INPUT_LENGTHS,
} from '../../src/utils/input-sanitizer.js';

describe('normalizeUnicode', () => {
  it('should normalize Unicode to NFC form', () => {
    // Combining characters
    const input = 'e\u0301'; // é as e + combining acute
    const normalized = normalizeUnicode(input);
    expect(normalized).toBe('\u00e9'); // é as single character
  });

  it('should handle already normalized strings', () => {
    const input = 'Hello World';
    const normalized = normalizeUnicode(input);
    expect(normalized).toBe(input);
  });

  it('should normalize emoji', () => {
    const input = '👍🏽'; // Thumbs up with skin tone
    const normalized = normalizeUnicode(input);
    expect(normalized).toBeTruthy();
    expect(normalized.length).toBeGreaterThan(0);
  });
});

describe('detectDangerousPatterns', () => {
  it('should detect null bytes', () => {
    const dangerous = detectDangerousPatterns('test\0file');
    expect(dangerous).toContain('Null byte detected');
  });

  it('should detect excessive repetition', () => {
    const input = 'a'.repeat(101);
    const dangerous = detectDangerousPatterns(input);
    expect(dangerous).toContain('Excessive character repetition detected');
  });

  it('should detect control characters', () => {
    const dangerous = detectDangerousPatterns('test\x00\x01\x02');
    expect(dangerous.length).toBeGreaterThan(0);
  });

  it('should detect Unicode direction override', () => {
    const dangerous = detectDangerousPatterns('test\u202E');
    expect(dangerous).toContain('Unicode direction override detected');
  });

  it('should return empty array for safe input', () => {
    const dangerous = detectDangerousPatterns('Hello World!');
    expect(dangerous).toHaveLength(0);
  });
});

describe('sanitizeInput', () => {
  it('should sanitize valid input', () => {
    const result = sanitizeInput('Hello World');
    expect(result.valid).toBe(true);
    expect(result.value).toBe('Hello World');
  });

  it('should trim whitespace by default', () => {
    const result = sanitizeInput('  Hello World  ');
    expect(result.valid).toBe(true);
    expect(result.value).toBe('Hello World');
  });

  it('should reject empty input by default', () => {
    const result = sanitizeInput('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('should allow empty input when configured', () => {
    const result = sanitizeInput('', { allowEmpty: true });
    expect(result.valid).toBe(true);
    expect(result.value).toBe('');
  });

  it('should reject input exceeding max length', () => {
    const longInput = 'a'.repeat(1001);
    const result = sanitizeInput(longInput, { maxLength: 1000 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum length');
  });

  it('should normalize Unicode when configured', () => {
    const result = sanitizeInput('e\u0301', { normalizeUnicode: true });
    expect(result.valid).toBe(true);
    expect(result.value).toBe('\u00e9');
    expect(result.warnings).toContain('Input was normalized (Unicode)');
  });

  it('should reject null bytes', () => {
    const result = sanitizeInput('test\0file');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Null byte');
  });

  it('should reject excessive repetition', () => {
    const result = sanitizeInput('a'.repeat(101));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Excessive character repetition');
  });

  it('should apply character whitelist', () => {
    const result = sanitizeInput('Hello123', {
      allowedPattern: SAFE_PATTERNS.BASIC,
    });
    expect(result.valid).toBe(true);

    const result2 = sanitizeInput('Hello<script>', {
      allowedPattern: SAFE_PATTERNS.BASIC,
    });
    expect(result2.valid).toBe(false);
    expect(result2.error).toContain('disallowed characters');
  });

  it('should reject control characters', () => {
    const result = sanitizeInput('test\x00\x01');
    expect(result.valid).toBe(false);
  });

  it('should reject Unicode direction override', () => {
    const result = sanitizeInput('test\u202E');
    expect(result.valid).toBe(false);
  });
});

describe('sanitizeFilePath', () => {
  it('should sanitize valid file paths', () => {
    const result = sanitizeFilePath('src/utils/test.ts');
    expect(result.valid).toBe(true);
    expect(result.value).toBe('src/utils/test.ts');
  });

  it('should warn about parent directory references', () => {
    const result = sanitizeFilePath('../../../etc/passwd');
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('Path contains parent directory references (..)');
  });

  it('should warn about absolute paths', () => {
    const result = sanitizeFilePath('/etc/passwd');
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('Absolute path detected');
  });

  it('should warn about Windows absolute paths', () => {
    const result = sanitizeFilePath('C:/Windows/System32');
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('Absolute path detected');
  });

  it('should warn about hidden files', () => {
    const result = sanitizeFilePath('.hidden/file.txt');
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('Path contains hidden file/directory');
  });

  it('should reject null bytes in paths', () => {
    const result = sanitizeFilePath('test\0.txt');
    expect(result.valid).toBe(false);
  });

  it('should reject excessively long paths', () => {
    const longPath = 'a/'.repeat(3000);
    const result = sanitizeFilePath(longPath);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum length');
  });
});

describe('sanitizeCommand', () => {
  it('should sanitize safe commands', () => {
    const result = sanitizeCommand('ls -la');
    expect(result.valid).toBe(true);
    expect(result.value).toBe('ls -la');
  });

  it('should reject commands with shell metacharacters', () => {
    const dangerous = [
      'ls; rm -rf /',
      'cat file | grep secret',
      'echo `whoami`',
      'test$(whoami)',
      'test&background',
      'redirect>file',
      'redirect<file',
      'test\\escaped',
    ];

    for (const cmd of dangerous) {
      const result = sanitizeCommand(cmd);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('shell metacharacters');
    }
  });

  it('should allow safe command arguments', () => {
    const result = sanitizeCommand('npm install --save-dev typescript');
    expect(result.valid).toBe(true);
  });

  it('should reject excessively long commands', () => {
    const longCmd = 'a'.repeat(10001);
    const result = sanitizeCommand(longCmd);
    expect(result.valid).toBe(false);
  });
});

describe('sanitizeSearchQuery', () => {
  it('should sanitize valid search queries', () => {
    const result = sanitizeSearchQuery('function getUserData');
    expect(result.valid).toBe(true);
    expect(result.value).toBe('function getUserData');
  });

  it('should reject excessively long queries', () => {
    const longQuery = 'a'.repeat(1001);
    const result = sanitizeSearchQuery(longQuery);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum length');
  });

  it('should trim whitespace', () => {
    const result = sanitizeSearchQuery('  search term  ');
    expect(result.valid).toBe(true);
    expect(result.value).toBe('search term');
  });
});

describe('sanitizeEnvValue', () => {
  it('should sanitize valid environment values', () => {
    const result = sanitizeEnvValue('https://api.example.com:3000');
    expect(result.valid).toBe(true);
  });

  it('should allow empty env values', () => {
    const result = sanitizeEnvValue('');
    expect(result.valid).toBe(true);
    expect(result.value).toBe('');
  });

  it('should reject null bytes', () => {
    const result = sanitizeEnvValue('value\0');
    expect(result.valid).toBe(false);
  });
});

describe('escapeShellArg', () => {
  it('should escape Unix shell arguments with single quotes', () => {
    if (process.platform !== 'win32') {
      const escaped = escapeShellArg("test'arg");
      expect(escaped).toBe("'test'\\''arg'");
    }
  });

  it('should escape Windows shell arguments with double quotes', () => {
    if (process.platform === 'win32') {
      const escaped = escapeShellArg('test"arg');
      expect(escaped).toBe('"test\\"arg"');
    }
  });

  it('should handle empty strings', () => {
    const escaped = escapeShellArg('');
    if (process.platform === 'win32') {
      expect(escaped).toBe('""');
    } else {
      expect(escaped).toBe("''");
    }
  });

  it('should handle special characters', () => {
    const escaped = escapeShellArg('test $var `whoami`');
    expect(escaped).toBeTruthy();
    // Should contain quotes
    expect(escaped.includes("'") || escaped.includes('"')).toBe(true);
  });
});

describe('validateRegexPattern', () => {
  it('should validate safe regex patterns', () => {
    const result = validateRegexPattern('^[a-z]+$');
    expect(result.valid).toBe(true);
    expect(result.value).toBe('^[a-z]+$');
  });

  it('should reject nested quantifiers (ReDoS risk)', () => {
    const dangerous = [
      '(a+)+b',
      '(a*)*b',
      '(a+)*b',
      '(a{1,5})+b',
    ];

    for (const pattern of dangerous) {
      const result = validateRegexPattern(pattern);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('nested quantifiers');
    }
  });

  it('should warn about excessive alternations', () => {
    const pattern = Array(25).fill('a').join('|');
    const result = validateRegexPattern(pattern);
    expect(result.valid).toBe(true);
    expect(result.warnings?.some(w => w.includes('alternations'))).toBe(true);
  });

  it('should warn about backreferences', () => {
    const result = validateRegexPattern('(.)\\1');
    expect(result.valid).toBe(true);
    expect(result.warnings?.some(w => w.includes('backreferences'))).toBe(true);
  });

  it('should reject invalid regex syntax', () => {
    const result = validateRegexPattern('[a-z');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid regex');
  });

  it('should reject excessively long patterns', () => {
    const longPattern = 'a'.repeat(1001);
    const result = validateRegexPattern(longPattern);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too long');
  });

  it('should allow safe complex patterns', () => {
    // Use a clearly safe pattern without any quantifier nesting
    const result = validateRegexPattern('^[a-z][a-z0-9-]*[a-z0-9]$');
    expect(result.valid).toBe(true);
  });
});

describe('MAX_INPUT_LENGTHS', () => {
  it('should have reasonable length limits', () => {
    expect(MAX_INPUT_LENGTHS.COMMAND).toBe(10_000);
    expect(MAX_INPUT_LENGTHS.FILE_PATH).toBe(4_096);
    expect(MAX_INPUT_LENGTHS.USER_INPUT).toBe(50_000);
    expect(MAX_INPUT_LENGTHS.SEARCH_QUERY).toBe(1_000);
  });
});

describe('SAFE_PATTERNS', () => {
  it('should have basic alphanumeric pattern', () => {
    expect(SAFE_PATTERNS.BASIC.test('Hello World 123!')).toBe(true);
    expect(SAFE_PATTERNS.BASIC.test('Hello<script>')).toBe(false);
  });

  it('should have file path pattern', () => {
    expect(SAFE_PATTERNS.FILE_PATH.test('src/utils/test.ts')).toBe(true);
    expect(SAFE_PATTERNS.FILE_PATH.test('src; rm -rf /')).toBe(false);
  });

  it('should have ASCII printable pattern', () => {
    expect(SAFE_PATTERNS.ASCII_PRINTABLE.test('Hello 123')).toBe(true);
    expect(SAFE_PATTERNS.ASCII_PRINTABLE.test('Hello\x00')).toBe(false);
  });
});
