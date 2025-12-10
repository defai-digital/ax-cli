import { describe, it, expect } from 'vitest';
import {
  equalsIgnoreCase,
  containsIgnoreCase,
  startsWithIgnoreCase,
  endsWithIgnoreCase,
} from '../../packages/core/src/utils/string-utils.js';

describe('string-utils', () => {
  describe('equalsIgnoreCase', () => {
    it('should return true for identical strings', () => {
      expect(equalsIgnoreCase('hello', 'hello')).toBe(true);
    });

    it('should return true for case-insensitive matches', () => {
      expect(equalsIgnoreCase('Hello', 'hello')).toBe(true);
      expect(equalsIgnoreCase('HELLO', 'hello')).toBe(true);
      expect(equalsIgnoreCase('HeLLo', 'hElLO')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(equalsIgnoreCase('hello', 'world')).toBe(false);
      expect(equalsIgnoreCase('hello', 'hell')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(equalsIgnoreCase('', '')).toBe(true);
      expect(equalsIgnoreCase('hello', '')).toBe(false);
      expect(equalsIgnoreCase('', 'hello')).toBe(false);
    });
  });

  describe('containsIgnoreCase', () => {
    it('should return true when text contains search string', () => {
      expect(containsIgnoreCase('hello world', 'world')).toBe(true);
      expect(containsIgnoreCase('hello world', 'hello')).toBe(true);
    });

    it('should return true for case-insensitive matches', () => {
      expect(containsIgnoreCase('Hello World', 'world')).toBe(true);
      expect(containsIgnoreCase('HELLO WORLD', 'hello')).toBe(true);
      expect(containsIgnoreCase('HeLLo WoRLd', 'LO wo')).toBe(true);
    });

    it('should return false when text does not contain search string', () => {
      expect(containsIgnoreCase('hello', 'world')).toBe(false);
      expect(containsIgnoreCase('hello', 'goodbye')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(containsIgnoreCase('hello', '')).toBe(true);
      expect(containsIgnoreCase('', 'hello')).toBe(false);
      expect(containsIgnoreCase('', '')).toBe(true);
    });
  });

  describe('startsWithIgnoreCase', () => {
    it('should return true when text starts with prefix', () => {
      expect(startsWithIgnoreCase('hello world', 'hello')).toBe(true);
      expect(startsWithIgnoreCase('hello', 'h')).toBe(true);
    });

    it('should return true for case-insensitive matches', () => {
      expect(startsWithIgnoreCase('Hello World', 'hello')).toBe(true);
      expect(startsWithIgnoreCase('HELLO', 'hello')).toBe(true);
      expect(startsWithIgnoreCase('HeLLo', 'hel')).toBe(true);
    });

    it('should return false when text does not start with prefix', () => {
      expect(startsWithIgnoreCase('hello', 'world')).toBe(false);
      expect(startsWithIgnoreCase('hello', 'ello')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(startsWithIgnoreCase('hello', '')).toBe(true);
      expect(startsWithIgnoreCase('', 'hello')).toBe(false);
      expect(startsWithIgnoreCase('', '')).toBe(true);
    });

    it('should handle prefix longer than text', () => {
      expect(startsWithIgnoreCase('hi', 'hello')).toBe(false);
    });
  });

  describe('endsWithIgnoreCase', () => {
    it('should return true when text ends with suffix', () => {
      expect(endsWithIgnoreCase('hello world', 'world')).toBe(true);
      expect(endsWithIgnoreCase('hello', 'o')).toBe(true);
    });

    it('should return true for case-insensitive matches', () => {
      expect(endsWithIgnoreCase('Hello World', 'world')).toBe(true);
      expect(endsWithIgnoreCase('HELLO', 'llo')).toBe(true);
      expect(endsWithIgnoreCase('HeLLo', 'LO')).toBe(true);
    });

    it('should return false when text does not end with suffix', () => {
      expect(endsWithIgnoreCase('hello', 'world')).toBe(false);
      expect(endsWithIgnoreCase('hello', 'hell')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(endsWithIgnoreCase('hello', '')).toBe(true);
      expect(endsWithIgnoreCase('', 'hello')).toBe(false);
      expect(endsWithIgnoreCase('', '')).toBe(true);
    });

    it('should handle suffix longer than text', () => {
      expect(endsWithIgnoreCase('hi', 'hello')).toBe(false);
    });
  });
});
