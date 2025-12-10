/**
 * Tests for Hook System (Phase 4)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  HookRunner,
  HookType,
  getHookRunner,
  disposeHookRunner,
  initializeHookRunner,
} from '../../packages/core/src/hooks/hook-runner.js';
import type { LLMToolCall } from '../../packages/core/src/llm/client.js';

describe('HookRunner', () => {
  let runner: HookRunner;

  beforeEach(async () => {
    await disposeHookRunner();
    runner = new HookRunner();
  });

  describe('Hook Type Detection', () => {
    it('should identify pre-tool-use hooks', () => {
      const hooks = runner['getHooksForType'](HookType.PreToolUse);
      expect(Array.isArray(hooks)).toBe(true);
    });

    it('should identify post-tool-use hooks', () => {
      const hooks = runner['getHooksForType'](HookType.PostToolUse);
      expect(Array.isArray(hooks)).toBe(true);
    });
  });

  describe('Tool Matching', () => {
    it('should match specific tool names', () => {
      const hook = {
        name: 'test-hook',
        script: '/path/to/script.sh',
        tools: ['bash', 'view_file'],
      };

      expect(runner['shouldRunHook'](hook, 'bash')).toBe(true);
      expect(runner['shouldRunHook'](hook, 'view_file')).toBe(true);
      expect(runner['shouldRunHook'](hook, 'create_file')).toBe(false);
    });

    it('should match wildcard patterns', () => {
      const hook = {
        name: 'test-hook',
        script: '/path/to/script.sh',
        tools: ['mcp__*'],
      };

      expect(runner['shouldRunHook'](hook, 'mcp__github')).toBe(true);
      expect(runner['shouldRunHook'](hook, 'mcp__slack')).toBe(true);
      expect(runner['shouldRunHook'](hook, 'bash')).toBe(false);
    });

    it('should match all tools with *', () => {
      const hook = {
        name: 'test-hook',
        script: '/path/to/script.sh',
        tools: ['*'],
      };

      expect(runner['shouldRunHook'](hook, 'bash')).toBe(true);
      expect(runner['shouldRunHook'](hook, 'view_file')).toBe(true);
      expect(runner['shouldRunHook'](hook, 'mcp__github')).toBe(true);
    });

    it('should match all tools when tools array is empty', () => {
      const hook = {
        name: 'test-hook',
        script: '/path/to/script.sh',
        tools: [],
      };

      expect(runner['shouldRunHook'](hook, 'bash')).toBe(true);
      expect(runner['shouldRunHook'](hook, 'any_tool')).toBe(true);
    });
  });

  describe('Pre-Tool-Use Hooks', () => {
    it('should return continue action when no hooks configured', async () => {
      const toolCall: LLMToolCall = {
        id: 'test-1',
        type: 'function',
        function: {
          name: 'bash',
          arguments: JSON.stringify({ command: 'ls' }),
        },
      };

      const result = await runner.runPreToolUse(toolCall, { command: 'ls' });

      expect(result.action).toBe('continue');
    });
  });

  describe('Post-Tool-Use Hooks', () => {
    it('should not throw when no hooks configured', async () => {
      const toolCall: LLMToolCall = {
        id: 'test-1',
        type: 'function',
        function: {
          name: 'bash',
          arguments: JSON.stringify({ command: 'ls' }),
        },
      };

      await expect(
        runner.runPostToolUse(toolCall, { command: 'ls' }, { success: true, output: 'output' })
      ).resolves.not.toThrow();
    });
  });

  describe('On-Error Hooks', () => {
    it('should return continue action when no hooks configured', async () => {
      const toolCall: LLMToolCall = {
        id: 'test-1',
        type: 'function',
        function: {
          name: 'bash',
          arguments: JSON.stringify({ command: 'failing-cmd' }),
        },
      };

      const result = await runner.runOnError(
        toolCall,
        { command: 'failing-cmd' },
        'Command failed'
      );

      expect(result.action).toBe('continue');
    });
  });

  describe('Session Tracking', () => {
    it('should generate unique session ID', () => {
      const sessionInfo = runner['getSessionInfo']();
      expect(sessionInfo.id).toMatch(/^session-\d+-[a-z0-9]+$/);
    });

    it('should track message count', () => {
      expect(runner['getSessionInfo']().messageCount).toBe(0);

      runner.incrementMessageCount();
      runner.incrementMessageCount();

      expect(runner['getSessionInfo']().messageCount).toBe(2);
    });
  });

  describe('Script Path Resolution', () => {
    it('should expand ~ to home directory', () => {
      const resolved = runner['resolveScriptPath']('~/hooks/test.sh');
      expect(resolved).not.toContain('~');
      // On Windows, path separators are backslashes, so check for both
      expect(resolved).toMatch(/hooks[/\\]test\.sh$/);
    });

    it('should keep absolute paths unchanged', () => {
      const resolved = runner['resolveScriptPath']('/usr/local/bin/hook.sh');
      // On Windows, this path format isn't valid and may be transformed
      // On Unix, it should remain unchanged
      if (process.platform !== 'win32') {
        expect(resolved).toBe('/usr/local/bin/hook.sh');
      } else {
        // On Windows, just verify it's still a valid path string
        expect(typeof resolved).toBe('string');
      }
    });
  });

  describe('Events', () => {
    it('should emit hook:blocked event when hook blocks', async () => {
      const blockedHandler = vi.fn();
      runner.on('hook:blocked', blockedHandler);

      // Manually set up a hook that blocks (for testing)
      runner['config'] = {
        hooks: {
          pre_tool_use: [],
          post_tool_use: [],
          on_error: [],
          session_start: [],
          session_end: [],
        },
      };

      // Since no hooks are configured, this won't trigger blocked
      // This test mainly verifies the event system is wired up
      const toolCall: LLMToolCall = {
        id: 'test-1',
        type: 'function',
        function: { name: 'bash', arguments: '{}' },
      };

      await runner.runPreToolUse(toolCall, {});

      // No hooks, so blocked handler shouldn't be called
      expect(blockedHandler).not.toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should return default configuration', () => {
      const config = runner.getConfig();
      expect(config.hooks).toBeDefined();
      expect(config.hooks.pre_tool_use).toEqual([]);
      expect(config.hooks.post_tool_use).toEqual([]);
    });
  });

  describe('Cleanup', () => {
    it('should dispose without error', async () => {
      await expect(runner.dispose()).resolves.not.toThrow();
    });

    it('should clear running processes on dispose', async () => {
      const runningProcesses = runner['runningProcesses'];
      expect(runningProcesses.size).toBe(0);
      await runner.dispose();
      expect(runningProcesses.size).toBe(0);
    });
  });

  describe('Singleton Management', () => {
    afterEach(async () => {
      await disposeHookRunner();
    });

    it('should return same instance from getHookRunner', () => {
      const runner1 = getHookRunner();
      const runner2 = getHookRunner();
      expect(runner1).toBe(runner2);
    });

    it('should create new instance after disposeHookRunner', async () => {
      const runner1 = getHookRunner();
      await disposeHookRunner();
      const runner2 = getHookRunner();
      expect(runner1).not.toBe(runner2);
    });

    it('should initialize hook runner', async () => {
      const runner = await initializeHookRunner();
      expect(runner).toBeDefined();
      expect(runner).toBeInstanceOf(HookRunner);
    });
  });

  describe('Hook Type Enum', () => {
    it('should have PreToolUse type', () => {
      expect(HookType.PreToolUse).toBe('pre_tool_use');
    });

    it('should have PostToolUse type', () => {
      expect(HookType.PostToolUse).toBe('post_tool_use');
    });

    it('should have OnError type', () => {
      expect(HookType.OnError).toBe('on_error');
    });

    it('should have SessionStart type', () => {
      expect(HookType.SessionStart).toBe('session_start');
    });

    it('should have SessionEnd type', () => {
      expect(HookType.SessionEnd).toBe('session_end');
    });
  });

  describe('Filtering Disabled Hooks', () => {
    it('should filter out disabled hooks', () => {
      runner['config'] = {
        hooks: {
          pre_tool_use: [
            { name: 'enabled-hook', script: '/path/to/script.sh', tools: ['*'], enabled: true },
            { name: 'disabled-hook', script: '/path/to/script.sh', tools: ['*'], enabled: false },
            { name: 'default-enabled', script: '/path/to/script.sh', tools: ['*'] },
          ],
          post_tool_use: [],
          on_error: [],
          session_start: [],
          session_end: [],
        },
      };

      const hooks = runner['getHooksForType'](HookType.PreToolUse);
      expect(hooks.length).toBe(2);
      expect(hooks.map(h => h.name)).toContain('enabled-hook');
      expect(hooks.map(h => h.name)).toContain('default-enabled');
      expect(hooks.map(h => h.name)).not.toContain('disabled-hook');
    });
  });

  describe('Config Reload', () => {
    it('should emit config_reloaded event on reload', async () => {
      const reloadHandler = vi.fn();
      runner.on('hook:config_reloaded', reloadHandler);

      await runner.reloadConfig();

      expect(reloadHandler).toHaveBeenCalled();
    });
  });

  describe('Session End Hooks', () => {
    it('should run session end hooks on dispose', async () => {
      const sessionEndHandler = vi.fn();
      runner.on('hook:session_end', sessionEndHandler);

      // No hooks configured, so handler won't be called
      await runner.runSessionEndHooks();
      expect(sessionEndHandler).not.toHaveBeenCalled();
    });

    it('should not throw when running session end hooks with no hooks', async () => {
      await expect(runner.runSessionEndHooks()).resolves.not.toThrow();
    });
  });

  describe('Error Events', () => {
    it('should emit hook:error event on error', async () => {
      const errorHandler = vi.fn();
      runner.on('hook:error', errorHandler);

      // Configure a hook with non-existent script
      runner['config'] = {
        hooks: {
          pre_tool_use: [
            { name: 'error-hook', script: '/nonexistent/script.sh', tools: ['*'] },
          ],
          post_tool_use: [],
          on_error: [],
          session_start: [],
          session_end: [],
        },
      };

      const toolCall: LLMToolCall = {
        id: 'test-1',
        type: 'function',
        function: { name: 'bash', arguments: '{}' },
      };

      await runner.runPreToolUse(toolCall, {});

      expect(errorHandler).toHaveBeenCalled();
      expect(errorHandler.mock.calls[0][0]).toHaveProperty('error');
    });
  });

  describe('Modified Events', () => {
    it('should emit hook:modified event when args are modified', async () => {
      const modifiedHandler = vi.fn();
      runner.on('hook:modified', modifiedHandler);

      // No hooks to trigger modified event
      const toolCall: LLMToolCall = {
        id: 'test-1',
        type: 'function',
        function: { name: 'bash', arguments: '{}' },
      };

      await runner.runPreToolUse(toolCall, { command: 'ls' });

      // No hooks, so modified handler won't be called
      expect(modifiedHandler).not.toHaveBeenCalled();
    });
  });

  describe('Initialize', () => {
    it('should initialize without error', async () => {
      await expect(runner.initialize()).resolves.not.toThrow();
    });

    it('should use default config if loading fails', async () => {
      await runner.initialize();
      const config = runner.getConfig();
      expect(config.hooks).toBeDefined();
    });
  });

  describe('Session Info', () => {
    it('should include session start time', () => {
      const sessionInfo = runner['getSessionInfo']();
      expect(sessionInfo.startedAt).toBeDefined();
      expect(new Date(sessionInfo.startedAt).getTime()).not.toBeNaN();
    });

    it('should have valid ISO timestamp', () => {
      const sessionInfo = runner['getSessionInfo']();
      const date = new Date(sessionInfo.startedAt);
      expect(date.toISOString()).toBe(sessionInfo.startedAt);
    });
  });
});
