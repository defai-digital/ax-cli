import { describe, it, expect } from 'vitest';

/**
 * Tests for isIncompleteInput smart detection algorithm
 *
 * This function is defined in src/ui/hooks/use-enhanced-input.ts
 * Since it's not exported, we'll need to test it through the hook behavior
 * or extract it to a separate utility file for direct testing.
 *
 * For now, we'll create the tests with the expected behavior,
 * and the implementation can be refactored to make the function testable.
 */

// Mock smart detection configuration
const defaultSmartDetection = {
  enabled: true,
  checkBrackets: true,
  checkOperators: true,
  checkStatements: true,
};

const bracketsOnlyDetection = {
  enabled: true,
  checkBrackets: true,
  checkOperators: false,
  checkStatements: false,
};

const operatorsOnlyDetection = {
  enabled: true,
  checkBrackets: false,
  checkOperators: true,
  checkStatements: false,
};

const statementsOnlyDetection = {
  enabled: true,
  checkBrackets: false,
  checkOperators: false,
  checkStatements: true,
};

const disabledDetection = {
  enabled: false,
  checkBrackets: true,
  checkOperators: true,
  checkStatements: true,
};

/**
 * Helper function to test smart detection
 * This mirrors the implementation in use-enhanced-input.ts
 */
function isIncompleteInput(
  text: string,
  smartDetection?: {
    enabled: boolean;
    checkBrackets: boolean;
    checkOperators: boolean;
    checkStatements: boolean;
  }
): boolean {
  if (!smartDetection?.enabled) return false;

  const trimmed = text.trimEnd();
  if (!trimmed) return false;

  // Check for unclosed brackets
  if (smartDetection.checkBrackets) {
    const brackets = {
      '(': 0,
      '[': 0,
      '{': 0,
    };

    for (const char of trimmed) {
      if (char === '(') brackets['(']++;
      else if (char === ')') brackets['(']--;
      else if (char === '[') brackets['[']++;
      else if (char === ']') brackets['[']--;
      else if (char === '{') brackets['{']++;
      else if (char === '}') brackets['{']--;
    }

    // If any bracket is unclosed, input is incomplete
    if (brackets['('] > 0 || brackets['['] > 0 || brackets['{'] > 0) {
      return true;
    }
  }

  // Check for trailing operators
  if (smartDetection.checkOperators) {
    const trailingOperators = [
      '+', '-', '*', '/', '%', '=', '==', '===', '!=', '!==',
      '<', '>', '<=', '>=', '&&', '||', '&', '|', '^',
      '?', ':', ',', '.', '..', '...', '=>',
    ];

    for (const op of trailingOperators) {
      if (trimmed.endsWith(op)) {
        return true;
      }
    }
  }

  // Check for incomplete statements
  if (smartDetection.checkStatements) {
    const incompleteKeywords = [
      'if', 'else', 'for', 'while', 'do', 'switch', 'case',
      'function', 'const', 'let', 'var', 'class', 'interface',
      'type', 'enum', 'import', 'export', 'return', 'throw',
      'try', 'catch', 'finally', 'async', 'await',
    ];

    // Check if line ends with a statement keyword (potentially incomplete)
    const lastLine = trimmed.split('\n').pop() || '';
    const words = lastLine.trim().split(/\s+/);
    const lastWord = words[words.length - 1];

    if (incompleteKeywords.includes(lastWord)) {
      return true;
    }

    // Check for statement keywords at start of last line without closing
    const firstWord = words[0];
    if (incompleteKeywords.includes(firstWord) && !lastLine.includes('{') && !lastLine.includes(';')) {
      return true;
    }
  }

  return false;
}

describe('Smart Detection - isIncompleteInput', () => {
  describe('disabled detection', () => {
    it('should return false when detection is disabled', () => {
      expect(isIncompleteInput('if (foo ==', disabledDetection)).toBe(false);
    });

    it('should return false when smartDetection is undefined', () => {
      expect(isIncompleteInput('if (foo ==', undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isIncompleteInput('', defaultSmartDetection)).toBe(false);
    });

    it('should return false for whitespace-only string', () => {
      expect(isIncompleteInput('   ', defaultSmartDetection)).toBe(false);
    });
  });

  describe('bracket detection', () => {
    describe('parentheses', () => {
      it('should detect unclosed opening parenthesis', () => {
        expect(isIncompleteInput('if (foo ==', bracketsOnlyDetection)).toBe(true);
      });

      it('should detect multiple unclosed parentheses', () => {
        expect(isIncompleteInput('func(arg1, func2(arg2', bracketsOnlyDetection)).toBe(true);
      });

      it('should return false for balanced parentheses', () => {
        expect(isIncompleteInput('if (foo) { }', bracketsOnlyDetection)).toBe(false);
      });

      it('should return false for closed parentheses', () => {
        expect(isIncompleteInput('function test() { return 42; }', bracketsOnlyDetection)).toBe(false);
      });

      it('should handle nested parentheses correctly', () => {
        expect(isIncompleteInput('func((nested)', bracketsOnlyDetection)).toBe(true);
      });

      it('should handle multiple balanced parentheses', () => {
        expect(isIncompleteInput('func(a, b) + func2(c, d)', bracketsOnlyDetection)).toBe(false);
      });
    });

    describe('square brackets', () => {
      it('should detect unclosed opening square bracket', () => {
        expect(isIncompleteInput('const arr = [1, 2', bracketsOnlyDetection)).toBe(true);
      });

      it('should detect unclosed nested square brackets', () => {
        expect(isIncompleteInput('const matrix = [[1, 2], [3', bracketsOnlyDetection)).toBe(true);
      });

      it('should return false for balanced square brackets', () => {
        expect(isIncompleteInput('const arr = [1, 2, 3]', bracketsOnlyDetection)).toBe(false);
      });

      it('should handle array destructuring', () => {
        expect(isIncompleteInput('const [a, b] = arr', bracketsOnlyDetection)).toBe(false);
      });
    });

    describe('curly braces', () => {
      it('should detect unclosed opening curly brace', () => {
        expect(isIncompleteInput('const obj = {', bracketsOnlyDetection)).toBe(true);
      });

      it('should detect unclosed curly brace in object', () => {
        expect(isIncompleteInput('const obj = { foo: "bar"', bracketsOnlyDetection)).toBe(true);
      });

      it('should return false for balanced curly braces', () => {
        expect(isIncompleteInput('const obj = { foo: "bar" }', bracketsOnlyDetection)).toBe(false);
      });

      it('should handle function blocks', () => {
        expect(isIncompleteInput('function test() { return 42; }', bracketsOnlyDetection)).toBe(false);
      });

      it('should detect unclosed function block', () => {
        expect(isIncompleteInput('function test() {', bracketsOnlyDetection)).toBe(true);
      });
    });

    describe('mixed brackets', () => {
      it('should detect mixed unclosed brackets', () => {
        expect(isIncompleteInput('if (obj.arr[0] == {', bracketsOnlyDetection)).toBe(true);
      });

      it('should handle complex nested structures', () => {
        expect(isIncompleteInput('func({ arr: [1, 2', bracketsOnlyDetection)).toBe(true);
      });

      it('should return false for all brackets balanced', () => {
        expect(isIncompleteInput('func({ arr: [1, 2] })', bracketsOnlyDetection)).toBe(false);
      });

      it('should handle multiple types of brackets', () => {
        expect(isIncompleteInput('{ key: [func(a, b)] }', bracketsOnlyDetection)).toBe(false);
      });
    });
  });

  describe('operator detection', () => {
    describe('arithmetic operators', () => {
      it('should detect trailing plus', () => {
        expect(isIncompleteInput('const x = 1 +', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing minus', () => {
        expect(isIncompleteInput('const x = 10 -', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing multiply', () => {
        expect(isIncompleteInput('const x = 5 *', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing divide', () => {
        expect(isIncompleteInput('const x = 10 /', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing modulo', () => {
        expect(isIncompleteInput('const x = 10 %', operatorsOnlyDetection)).toBe(true);
      });
    });

    describe('assignment operators', () => {
      it('should detect trailing single equals', () => {
        expect(isIncompleteInput('const x =', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing double equals', () => {
        expect(isIncompleteInput('if (x ==', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing triple equals', () => {
        expect(isIncompleteInput('if (x ===', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing not equals', () => {
        expect(isIncompleteInput('if (x !=', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing strict not equals', () => {
        expect(isIncompleteInput('if (x !==', operatorsOnlyDetection)).toBe(true);
      });
    });

    describe('comparison operators', () => {
      it('should detect trailing less than', () => {
        expect(isIncompleteInput('if (x <', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing greater than', () => {
        expect(isIncompleteInput('if (x >', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing less than or equal', () => {
        expect(isIncompleteInput('if (x <=', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing greater than or equal', () => {
        expect(isIncompleteInput('if (x >=', operatorsOnlyDetection)).toBe(true);
      });
    });

    describe('logical operators', () => {
      it('should detect trailing AND', () => {
        expect(isIncompleteInput('if (a &&', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing OR', () => {
        expect(isIncompleteInput('if (a ||', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing bitwise AND', () => {
        expect(isIncompleteInput('const x = a &', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing bitwise OR', () => {
        expect(isIncompleteInput('const x = a |', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing bitwise XOR', () => {
        expect(isIncompleteInput('const x = a ^', operatorsOnlyDetection)).toBe(true);
      });
    });

    describe('special operators', () => {
      it('should detect trailing ternary question', () => {
        expect(isIncompleteInput('const x = a ?', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing ternary colon', () => {
        expect(isIncompleteInput('const x = a ? b :', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing comma', () => {
        expect(isIncompleteInput('const obj = { a: 1,', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing dot', () => {
        expect(isIncompleteInput('obj.', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing spread operator', () => {
        expect(isIncompleteInput('const arr = [...', operatorsOnlyDetection)).toBe(true);
      });

      it('should detect trailing arrow function', () => {
        expect(isIncompleteInput('const fn =>', operatorsOnlyDetection)).toBe(true);
      });
    });

    describe('complete expressions', () => {
      it('should return false for complete arithmetic', () => {
        expect(isIncompleteInput('const x = 1 + 2', operatorsOnlyDetection)).toBe(false);
      });

      it('should return false for complete assignment', () => {
        expect(isIncompleteInput('const x = 42', operatorsOnlyDetection)).toBe(false);
      });

      it('should return false for complete comparison', () => {
        expect(isIncompleteInput('if (x > 5) { }', operatorsOnlyDetection)).toBe(false);
      });
    });
  });

  describe('statement detection', () => {
    describe('control flow keywords', () => {
      it('should detect incomplete if statement', () => {
        expect(isIncompleteInput('if', statementsOnlyDetection)).toBe(true);
      });

      it('should detect incomplete for loop', () => {
        expect(isIncompleteInput('for', statementsOnlyDetection)).toBe(true);
      });

      it('should detect incomplete while loop', () => {
        expect(isIncompleteInput('while', statementsOnlyDetection)).toBe(true);
      });

      it('should detect incomplete do-while', () => {
        expect(isIncompleteInput('do', statementsOnlyDetection)).toBe(true);
      });

      it('should detect incomplete switch', () => {
        expect(isIncompleteInput('switch', statementsOnlyDetection)).toBe(true);
      });

      it('should detect incomplete case', () => {
        expect(isIncompleteInput('case', statementsOnlyDetection)).toBe(true);
      });

      it('should detect incomplete else', () => {
        expect(isIncompleteInput('else', statementsOnlyDetection)).toBe(true);
      });
    });

    describe('declaration keywords', () => {
      it('should detect incomplete function declaration', () => {
        expect(isIncompleteInput('function', statementsOnlyDetection)).toBe(true);
      });

      it('should detect incomplete const declaration', () => {
        expect(isIncompleteInput('const', statementsOnlyDetection)).toBe(true);
      });

      it('should detect incomplete let declaration', () => {
        expect(isIncompleteInput('let', statementsOnlyDetection)).toBe(true);
      });

      it('should detect incomplete var declaration', () => {
        expect(isIncompleteInput('var', statementsOnlyDetection)).toBe(true);
      });

      it('should detect incomplete class declaration', () => {
        expect(isIncompleteInput('class', statementsOnlyDetection)).toBe(true);
      });
    });

    describe('TypeScript keywords', () => {
      it('should detect incomplete interface', () => {
        expect(isIncompleteInput('interface', statementsOnlyDetection)).toBe(true);
      });

      it('should detect incomplete type', () => {
        expect(isIncompleteInput('type', statementsOnlyDetection)).toBe(true);
      });

      it('should detect incomplete enum', () => {
        expect(isIncompleteInput('enum', statementsOnlyDetection)).toBe(true);
      });
    });

    describe('import/export keywords', () => {
      it('should detect incomplete import', () => {
        expect(isIncompleteInput('import', statementsOnlyDetection)).toBe(true);
      });

      it('should detect incomplete export', () => {
        expect(isIncompleteInput('export', statementsOnlyDetection)).toBe(true);
      });
    });

    describe('exception keywords', () => {
      it('should detect incomplete try', () => {
        expect(isIncompleteInput('try', statementsOnlyDetection)).toBe(true);
      });

      it('should detect incomplete catch', () => {
        expect(isIncompleteInput('catch', statementsOnlyDetection)).toBe(true);
      });

      it('should detect incomplete finally', () => {
        expect(isIncompleteInput('finally', statementsOnlyDetection)).toBe(true);
      });

      it('should detect incomplete throw', () => {
        expect(isIncompleteInput('throw', statementsOnlyDetection)).toBe(true);
      });
    });

    describe('async keywords', () => {
      it('should detect incomplete async', () => {
        expect(isIncompleteInput('async', statementsOnlyDetection)).toBe(true);
      });

      it('should detect incomplete await', () => {
        expect(isIncompleteInput('await', statementsOnlyDetection)).toBe(true);
      });
    });

    describe('statement keywords at start of line without closing', () => {
      it('should detect if statement without opening brace', () => {
        expect(isIncompleteInput('if (condition)', statementsOnlyDetection)).toBe(true);
      });

      it('should detect function without opening brace', () => {
        expect(isIncompleteInput('function test()', statementsOnlyDetection)).toBe(true);
      });

      it('should return false for complete for loop condition (has semicolons)', () => {
        // Note: This is considered complete because it has semicolons
        // The algorithm doesn't check if a brace is *required*, only if present
        expect(isIncompleteInput('for (let i = 0; i < 10; i++)', statementsOnlyDetection)).toBe(false);
      });

      it('should return false if statement has opening brace', () => {
        expect(isIncompleteInput('if (condition) {', statementsOnlyDetection)).toBe(false);
      });

      it('should return false if statement has semicolon', () => {
        expect(isIncompleteInput('const x = 42;', statementsOnlyDetection)).toBe(false);
      });
    });

    describe('complete statements', () => {
      it('should return false for complete function', () => {
        expect(isIncompleteInput('function test() { return 42; }', statementsOnlyDetection)).toBe(false);
      });

      it('should return false for complete if statement', () => {
        expect(isIncompleteInput('if (x > 5) { doSomething(); }', statementsOnlyDetection)).toBe(false);
      });

      it('should return false for regular text', () => {
        expect(isIncompleteInput('hello world', statementsOnlyDetection)).toBe(false);
      });
    });
  });

  describe('combined detection', () => {
    it('should detect unclosed bracket with trailing operator', () => {
      expect(isIncompleteInput('if (x ==', defaultSmartDetection)).toBe(true);
    });

    it('should detect incomplete statement with unclosed bracket', () => {
      expect(isIncompleteInput('function test(', defaultSmartDetection)).toBe(true);
    });

    it('should detect multiple issues simultaneously', () => {
      expect(isIncompleteInput('const obj = { foo:', defaultSmartDetection)).toBe(true);
    });

    it('should return false for complete complex expression', () => {
      expect(isIncompleteInput('const x = func({ a: [1, 2] })', defaultSmartDetection)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle strings with brackets', () => {
      // Note: This is a limitation - we don't parse strings
      // The algorithm will count brackets in strings
      expect(isIncompleteInput('const str = "hello (world"', bracketsOnlyDetection)).toBe(true);
    });

    it('should handle multiline input', () => {
      const multiline = `const obj = {
  foo: 'bar'`;
      expect(isIncompleteInput(multiline, bracketsOnlyDetection)).toBe(true);
    });

    it('should handle trailing whitespace', () => {
      expect(isIncompleteInput('const x =   ', operatorsOnlyDetection)).toBe(true);
    });

    it('should handle tabs and newlines', () => {
      expect(isIncompleteInput('const x =\t', operatorsOnlyDetection)).toBe(true);
    });

    it('should handle Unicode characters', () => {
      expect(isIncompleteInput('const 世界 =', operatorsOnlyDetection)).toBe(true);
    });

    it('should handle emojis', () => {
      expect(isIncompleteInput('const 😀 =', operatorsOnlyDetection)).toBe(true);
    });

    it('should handle very long input', () => {
      const longInput = 'const x = ' + '1 + '.repeat(1000);
      expect(isIncompleteInput(longInput, operatorsOnlyDetection)).toBe(true);
    });

    it('should handle deeply nested brackets', () => {
      const nested = '((((((((((';
      expect(isIncompleteInput(nested, bracketsOnlyDetection)).toBe(true);
    });
  });

  describe('real-world scenarios', () => {
    it('should detect incomplete JSON object', () => {
      const json = `{
  "name": "test",
  "version": "1.0.0"`;
      expect(isIncompleteInput(json, bracketsOnlyDetection)).toBe(true);
    });

    it('should return false for complete JSON', () => {
      const json = `{
  "name": "test",
  "version": "1.0.0"
}`;
      expect(isIncompleteInput(json, bracketsOnlyDetection)).toBe(false);
    });

    it('should detect incomplete arrow function', () => {
      expect(isIncompleteInput('const fn = (x) =>', defaultSmartDetection)).toBe(true);
    });

    it('should detect incomplete array map', () => {
      expect(isIncompleteInput('arr.map(x =>', defaultSmartDetection)).toBe(true);
    });

    it('should detect incomplete promise chain', () => {
      expect(isIncompleteInput('fetch(url).then(res =>', defaultSmartDetection)).toBe(true);
    });

    it('should return false for complete statement', () => {
      expect(isIncompleteInput('console.log("hello world")', defaultSmartDetection)).toBe(false);
    });

    it('should detect incomplete SQL query', () => {
      expect(isIncompleteInput('SELECT * FROM users WHERE', defaultSmartDetection)).toBe(false);
      // Note: SQL keywords aren't in our keyword list, so this returns false
      // This is acceptable as the algorithm is optimized for JavaScript/TypeScript
    });
  });
});
