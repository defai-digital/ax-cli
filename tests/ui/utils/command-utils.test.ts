/**
 * Tests for command utility functions
 *
 * Pure functions for command parsing and validation.
 * No mocking required - these are all pure function tests.
 */

import { describe, it, expect } from 'vitest';
import {
  isSlashCommand,
  isDirectShellCommand,
  parseSlashCommand,
  parseDirectCommand,
  isBackgroundCommand,
  stripBackgroundOperator,
  hasMCPResourceReference,
  extractMCPQuery,
  formatTimeoutError,
  filterCommands,
  isValidInput,
  isExitCommand,
  parseTaskId,
  formatUsageStats,
  cycleVerbosity,
  getVerbosityDescription,
  BUILT_IN_COMMANDS,
  DIRECT_SHELL_COMMANDS,
  type CommandSuggestion,
  type VerbosityLevel,
} from '../../../packages/core/src/ui/utils/command-utils.js';

describe('command-utils', () => {
  describe('isSlashCommand', () => {
    it('should return true for slash commands', () => {
      expect(isSlashCommand('/help')).toBe(true);
      expect(isSlashCommand('/clear')).toBe(true);
      expect(isSlashCommand('/task 123')).toBe(true);
    });

    it('should return true for slash commands with leading whitespace', () => {
      expect(isSlashCommand('  /help')).toBe(true);
      expect(isSlashCommand('\t/clear')).toBe(true);
    });

    it('should return false for non-slash commands', () => {
      expect(isSlashCommand('help')).toBe(false);
      expect(isSlashCommand('ls -la')).toBe(false);
      expect(isSlashCommand('')).toBe(false);
    });

    it('should return false for mid-text slashes', () => {
      expect(isSlashCommand('path/to/file')).toBe(false);
    });
  });

  describe('isDirectShellCommand', () => {
    it('should return true for direct shell commands', () => {
      expect(isDirectShellCommand('ls')).toBe(true);
      expect(isDirectShellCommand('pwd')).toBe(true);
      expect(isDirectShellCommand('cd /path')).toBe(true);
      expect(isDirectShellCommand('cat file.txt')).toBe(true);
      expect(isDirectShellCommand('mkdir dir')).toBe(true);
      expect(isDirectShellCommand('touch file')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isDirectShellCommand('LS')).toBe(true);
      expect(isDirectShellCommand('Pwd')).toBe(true);
    });

    it('should return false for non-direct commands', () => {
      expect(isDirectShellCommand('npm install')).toBe(false);
      expect(isDirectShellCommand('git status')).toBe(false);
      expect(isDirectShellCommand('/help')).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(isDirectShellCommand('  ls  ')).toBe(true);
      expect(isDirectShellCommand('\tpwd')).toBe(true);
    });
  });

  describe('parseSlashCommand', () => {
    it('should parse command without arguments', () => {
      expect(parseSlashCommand('/help')).toEqual({
        command: '/help',
        args: [],
      });
    });

    it('should parse command with single argument', () => {
      expect(parseSlashCommand('/task abc123')).toEqual({
        command: '/task',
        args: ['abc123'],
      });
    });

    it('should parse command with multiple arguments', () => {
      expect(parseSlashCommand('/theme dark --force')).toEqual({
        command: '/theme',
        args: ['dark', '--force'],
      });
    });

    it('should handle extra whitespace', () => {
      expect(parseSlashCommand('  /task   123  456  ')).toEqual({
        command: '/task',
        args: ['123', '456'],
      });
    });

    it('should lowercase command name', () => {
      expect(parseSlashCommand('/HELP')).toEqual({
        command: '/help',
        args: [],
      });
    });

    it('should handle empty input', () => {
      expect(parseSlashCommand('')).toEqual({
        command: '',
        args: [],
      });
    });
  });

  describe('parseDirectCommand', () => {
    it('should parse command without arguments', () => {
      expect(parseDirectCommand('pwd')).toEqual({
        command: 'pwd',
        args: '',
      });
    });

    it('should parse command with arguments', () => {
      expect(parseDirectCommand('cd /path/to/dir')).toEqual({
        command: 'cd',
        args: '/path/to/dir',
      });
    });

    it('should preserve argument spacing', () => {
      expect(parseDirectCommand('ls -la --color=auto')).toEqual({
        command: 'ls',
        args: '-la --color=auto',
      });
    });

    it('should lowercase command name', () => {
      expect(parseDirectCommand('LS -la')).toEqual({
        command: 'ls',
        args: '-la',
      });
    });

    it('should handle whitespace', () => {
      expect(parseDirectCommand('  cat   file.txt  ')).toEqual({
        command: 'cat',
        args: 'file.txt',
      });
    });
  });

  describe('isBackgroundCommand', () => {
    it('should return true for commands ending with &', () => {
      expect(isBackgroundCommand('npm run dev &')).toBe(true);
      expect(isBackgroundCommand('sleep 10 &')).toBe(true);
    });

    it('should return false for && operators', () => {
      expect(isBackgroundCommand('cmd1 && cmd2')).toBe(false);
      expect(isBackgroundCommand('npm install && npm start')).toBe(false);
    });

    it('should return false for regular commands', () => {
      expect(isBackgroundCommand('npm run dev')).toBe(false);
      expect(isBackgroundCommand('ls -la')).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(isBackgroundCommand('cmd &  ')).toBe(true);
    });
  });

  describe('stripBackgroundOperator', () => {
    it('should remove trailing &', () => {
      expect(stripBackgroundOperator('npm run dev &')).toBe('npm run dev');
    });

    it('should preserve && operators', () => {
      expect(stripBackgroundOperator('cmd1 && cmd2')).toBe('cmd1 && cmd2');
    });

    it('should handle no operator', () => {
      expect(stripBackgroundOperator('npm run dev')).toBe('npm run dev');
    });

    it('should handle whitespace', () => {
      expect(stripBackgroundOperator('  cmd &  ')).toBe('cmd');
    });
  });

  describe('hasMCPResourceReference', () => {
    it('should return true for MCP references', () => {
      expect(hasMCPResourceReference('@mcp:server')).toBe(true);
      expect(hasMCPResourceReference('check @mcp:resource')).toBe(true);
    });

    it('should return true for empty query', () => {
      expect(hasMCPResourceReference('@mcp:')).toBe(true);
    });

    it('should return false without MCP reference', () => {
      expect(hasMCPResourceReference('hello world')).toBe(false);
      expect(hasMCPResourceReference('@other')).toBe(false);
    });
  });

  describe('extractMCPQuery', () => {
    it('should extract MCP query at end of input', () => {
      expect(extractMCPQuery('@mcp:server_name')).toBe('server_name');
      expect(extractMCPQuery('search @mcp:res')).toBe('res');
    });

    it('should return empty string for empty query', () => {
      expect(extractMCPQuery('@mcp:')).toBe('');
    });

    it('should return null for no MCP reference', () => {
      expect(extractMCPQuery('hello world')).toBeNull();
    });

    it('should only match at end', () => {
      expect(extractMCPQuery('@mcp:first @mcp:second')).toBe('second');
    });
  });

  describe('formatTimeoutError', () => {
    it('should format timeout error with tips', () => {
      const result = formatTimeoutError('Request timeout');
      expect(result).toContain('Request timeout');
      expect(result).toContain('/clear');
      expect(result).toContain('smaller parts');
    });

    it('should not add tips for non-timeout errors', () => {
      const result = formatTimeoutError('Connection refused');
      expect(result).toBe('Error: Connection refused');
      expect(result).not.toContain('/clear');
    });

    it('should detect timeout in message', () => {
      const result = formatTimeoutError('Request timeout after 30s');
      expect(result).toContain('timeout');
      expect(result).toContain('💡 Tip');
    });
  });

  describe('filterCommands', () => {
    const suggestions: CommandSuggestion[] = [
      { command: '/help', description: 'Show help' },
      { command: '/clear', description: 'Clear chat' },
      { command: '/history', description: 'Show history' },
    ];

    it('should filter by command name', () => {
      const result = filterCommands('hel', suggestions);
      expect(result).toHaveLength(1);
      expect(result[0].command).toBe('/help');
    });

    it('should filter by description', () => {
      const result = filterCommands('chat', suggestions);
      expect(result).toHaveLength(1);
      expect(result[0].command).toBe('/clear');
    });

    it('should be case insensitive', () => {
      const result = filterCommands('HELP', suggestions);
      expect(result).toHaveLength(1);
    });

    it('should return all for empty filter', () => {
      const result = filterCommands('', suggestions);
      expect(result).toHaveLength(3);
    });

    it('should return empty for no matches', () => {
      const result = filterCommands('xyz', suggestions);
      expect(result).toHaveLength(0);
    });
  });

  describe('isValidInput', () => {
    it('should return true for non-empty input', () => {
      expect(isValidInput('hello')).toBe(true);
      expect(isValidInput('/help')).toBe(true);
    });

    it('should return false for empty input', () => {
      expect(isValidInput('')).toBe(false);
      expect(isValidInput('   ')).toBe(false);
      expect(isValidInput('\t\n')).toBe(false);
    });
  });

  describe('isExitCommand', () => {
    it('should return true for exit commands', () => {
      expect(isExitCommand('/exit')).toBe(true);
      expect(isExitCommand('exit')).toBe(true);
      expect(isExitCommand('quit')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isExitCommand('EXIT')).toBe(true);
      expect(isExitCommand('Quit')).toBe(true);
      expect(isExitCommand('/EXIT')).toBe(true);
    });

    it('should handle whitespace', () => {
      expect(isExitCommand('  exit  ')).toBe(true);
    });

    it('should return false for non-exit commands', () => {
      expect(isExitCommand('/help')).toBe(false);
      expect(isExitCommand('exiting')).toBe(false);
    });
  });

  describe('parseTaskId', () => {
    it('should extract task ID from /task command', () => {
      expect(parseTaskId('/task abc123')).toBe('abc123');
    });

    it('should extract task ID from /kill command', () => {
      expect(parseTaskId('/kill xyz789')).toBe('xyz789');
    });

    it('should return null for no ID', () => {
      expect(parseTaskId('/tasks')).toBeNull();
      expect(parseTaskId('/task')).toBeNull();
    });

    it('should return first argument only', () => {
      expect(parseTaskId('/task id1 id2')).toBe('id1');
    });
  });

  describe('formatUsageStats', () => {
    it('should format usage statistics', () => {
      const stats = {
        totalPromptTokens: 1000,
        totalCompletionTokens: 500,
        sessionCount: 5,
      };
      const result = formatUsageStats(stats, 'GLM', 'glm-4.6');

      expect(result).toContain('GLM');
      expect(result).toContain('glm-4.6');
      expect(result).toContain('1,000');
      expect(result).toContain('500');
      expect(result).toContain('1,500');
      expect(result).toContain('5');
    });

    it('should format large numbers with commas', () => {
      const stats = {
        totalPromptTokens: 1000000,
        totalCompletionTokens: 500000,
        sessionCount: 100,
      };
      const result = formatUsageStats(stats, 'Provider', 'model');

      expect(result).toContain('1,000,000');
      expect(result).toContain('500,000');
    });
  });

  describe('cycleVerbosity', () => {
    it('should cycle through verbosity levels', () => {
      expect(cycleVerbosity(0)).toBe(1);
      expect(cycleVerbosity(1)).toBe(2);
      expect(cycleVerbosity(2)).toBe(0);
    });
  });

  describe('getVerbosityDescription', () => {
    it('should return description for each level', () => {
      expect(getVerbosityDescription(0)).toBe('concise');
      expect(getVerbosityDescription(1)).toBe('normal');
      expect(getVerbosityDescription(2)).toBe('verbose');
    });
  });

  describe('constants', () => {
    it('should have built-in commands', () => {
      expect(BUILT_IN_COMMANDS).toContain('/help');
      expect(BUILT_IN_COMMANDS).toContain('/clear');
      expect(BUILT_IN_COMMANDS).toContain('/exit');
    });

    it('should have direct shell commands', () => {
      expect(DIRECT_SHELL_COMMANDS).toContain('ls');
      expect(DIRECT_SHELL_COMMANDS).toContain('cd');
      expect(DIRECT_SHELL_COMMANDS).toContain('pwd');
    });
  });
});
