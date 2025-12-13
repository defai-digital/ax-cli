/**
 * Tests for hooks/manager module
 * Tests hook registration, filtering, and basic lifecycle
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs module before import
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
}));

// Mock child_process for execution tests
const mockStdin = {
  write: vi.fn(),
  end: vi.fn(),
};

const mockStdout = {
  on: vi.fn(),
};

const mockStderr = {
  on: vi.fn(),
};

const mockChild = {
  stdin: mockStdin,
  stdout: mockStdout,
  stderr: mockStderr,
  on: vi.fn(),
  kill: vi.fn(),
};

vi.mock('child_process', () => ({
  spawn: vi.fn().mockReturnValue({
    stdin: { write: vi.fn(), end: vi.fn() },
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
  }),
}));

import { spawn } from 'child_process';

// Mock error-handler
vi.mock('../../packages/core/src/utils/error-handler.js', () => ({
  extractErrorMessage: vi.fn((error: unknown) => error instanceof Error ? error.message : String(error)),
}));

import * as fs from 'fs';
import { HooksManager, getHooksManager } from '../../packages/core/src/hooks/manager.js';
import type { AnyHookConfig } from '../../packages/core/src/hooks/types.js';

describe('HooksManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HooksManager.reset();
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    HooksManager.reset();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = HooksManager.getInstance();
      const instance2 = HooksManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = HooksManager.getInstance();
      HooksManager.reset();
      const instance2 = HooksManager.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('reset', () => {
    it('should allow creating new singleton', () => {
      const first = HooksManager.getInstance();
      HooksManager.reset();
      const second = HooksManager.getInstance();
      expect(first).not.toBe(second);
    });
  });

  describe('registerHook', () => {
    it('should register a hook', () => {
      const manager = HooksManager.getInstance();
      // Trigger initialization first by calling getHooks
      manager.getHooks();

      const hook: AnyHookConfig = {
        event: 'PreToolUse',
        type: 'command',
        command: 'echo test',
      };

      manager.registerHook(hook);
      const hooks = manager.getHooks();

      expect(hooks).toContainEqual(hook);
    });

    it('should allow multiple hooks', () => {
      const manager = HooksManager.getInstance();
      // Trigger initialization first
      manager.getHooks();

      manager.registerHook({
        event: 'PreToolUse',
        type: 'command',
        command: 'echo 1',
      });
      manager.registerHook({
        event: 'PostToolUse',
        type: 'command',
        command: 'echo 2',
      });

      const hooks = manager.getHooks();
      expect(hooks).toHaveLength(2);
    });

    it('should register hooks in order', () => {
      const manager = HooksManager.getInstance();
      // Trigger initialization first
      manager.getHooks();

      manager.registerHook({ event: 'PreToolUse', type: 'command', command: 'first' });
      manager.registerHook({ event: 'PreToolUse', type: 'command', command: 'second' });
      manager.registerHook({ event: 'PreToolUse', type: 'command', command: 'third' });

      const hooks = manager.getHooks();
      expect(hooks[0].command).toBe('first');
      expect(hooks[1].command).toBe('second');
      expect(hooks[2].command).toBe('third');
    });
  });

  describe('getHooks', () => {
    it('should return copy of hooks array', () => {
      const manager = HooksManager.getInstance();
      manager.getHooks(); // Initialize first
      manager.registerHook({ event: 'PreToolUse', type: 'command', command: 'test' });

      const hooks1 = manager.getHooks();
      const hooks2 = manager.getHooks();

      expect(hooks1).not.toBe(hooks2);
      expect(hooks1).toEqual(hooks2);
    });

    it('should return empty array when no hooks registered', () => {
      const manager = HooksManager.getInstance();
      expect(manager.getHooks()).toEqual([]);
    });
  });

  describe('getHooksForEvent', () => {
    it('should filter hooks by event type', () => {
      const manager = HooksManager.getInstance();
      manager.getHooks(); // Initialize first

      manager.registerHook({ event: 'PreToolUse', type: 'command', command: 'pre-hook' });
      manager.registerHook({ event: 'PostToolUse', type: 'command', command: 'post-hook' });
      manager.registerHook({ event: 'UserPromptSubmit', type: 'command', command: 'submit-hook' });

      const preHooks = manager.getHooksForEvent('PreToolUse');
      expect(preHooks).toHaveLength(1);
      expect(preHooks[0].command).toBe('pre-hook');

      const postHooks = manager.getHooksForEvent('PostToolUse');
      expect(postHooks).toHaveLength(1);
      expect(postHooks[0].command).toBe('post-hook');
    });

    it('should exclude disabled hooks', () => {
      const manager = HooksManager.getInstance();
      manager.getHooks(); // Initialize first

      manager.registerHook({ event: 'PreToolUse', type: 'command', command: 'enabled', enabled: true });
      manager.registerHook({ event: 'PreToolUse', type: 'command', command: 'disabled', enabled: false });
      manager.registerHook({ event: 'PreToolUse', type: 'command', command: 'default-enabled' }); // enabled by default

      const hooks = manager.getHooksForEvent('PreToolUse');
      expect(hooks).toHaveLength(2);
      expect(hooks.map(h => h.command)).toContain('enabled');
      expect(hooks.map(h => h.command)).toContain('default-enabled');
      expect(hooks.map(h => h.command)).not.toContain('disabled');
    });

    it('should filter by tool pattern for PreToolUse', () => {
      const manager = HooksManager.getInstance();
      manager.getHooks(); // Initialize first

      manager.registerHook({ event: 'PreToolUse', type: 'command', command: 'bash-only', toolPattern: 'bash' });
      manager.registerHook({ event: 'PreToolUse', type: 'command', command: 'all-tools', toolPattern: '*' });
      manager.registerHook({ event: 'PreToolUse', type: 'command', command: 'no-pattern' });

      const bashHooks = manager.getHooksForEvent('PreToolUse', 'bash');
      expect(bashHooks).toHaveLength(3);

      const textHooks = manager.getHooksForEvent('PreToolUse', 'text_editor');
      expect(textHooks).toHaveLength(2);
      expect(textHooks.map(h => h.command)).not.toContain('bash-only');
    });

    it('should filter by tool pattern for PostToolUse', () => {
      const manager = HooksManager.getInstance();
      manager.getHooks(); // Initialize first

      manager.registerHook({ event: 'PostToolUse', type: 'command', command: 'bash-post', toolPattern: 'bash' });
      manager.registerHook({ event: 'PostToolUse', type: 'command', command: 'search-post', toolPattern: 'search' });

      const bashHooks = manager.getHooksForEvent('PostToolUse', 'bash');
      expect(bashHooks).toHaveLength(1);
      expect(bashHooks[0].command).toBe('bash-post');

      const searchHooks = manager.getHooksForEvent('PostToolUse', 'search');
      expect(searchHooks).toHaveLength(1);
      expect(searchHooks[0].command).toBe('search-post');
    });

    it('should handle glob patterns with asterisk', () => {
      const manager = HooksManager.getInstance();
      manager.getHooks(); // Initialize first

      manager.registerHook({ event: 'PreToolUse', type: 'command', command: 'text-star', toolPattern: 'text_*' });
      manager.registerHook({ event: 'PreToolUse', type: 'command', command: 'star-editor', toolPattern: '*_editor' });
      manager.registerHook({ event: 'PreToolUse', type: 'command', command: 'all-star', toolPattern: '*' });

      expect(manager.getHooksForEvent('PreToolUse', 'text_editor')).toHaveLength(3);
      expect(manager.getHooksForEvent('PreToolUse', 'text_viewer')).toHaveLength(2); // text_* and *
      expect(manager.getHooksForEvent('PreToolUse', 'code_editor')).toHaveLength(2); // *_editor and *
    });

    it('should handle exact pattern matching', () => {
      const manager = HooksManager.getInstance();
      manager.getHooks(); // Initialize first

      manager.registerHook({ event: 'PreToolUse', type: 'command', command: 'exact', toolPattern: 'bash' });

      expect(manager.getHooksForEvent('PreToolUse', 'bash')).toHaveLength(1);
      expect(manager.getHooksForEvent('PreToolUse', 'bash_extended')).toHaveLength(0);
      expect(manager.getHooksForEvent('PreToolUse', 'my_bash')).toHaveLength(0);
    });

    it('should return all hooks without tool filter for non-tool events', () => {
      const manager = HooksManager.getInstance();
      manager.getHooks(); // Initialize first

      manager.registerHook({ event: 'UserPromptSubmit', type: 'command', command: 'submit' });
      manager.registerHook({ event: 'UserPromptSubmit', type: 'command', command: 'submit2', toolPattern: 'ignored' });

      // For UserPromptSubmit, tool pattern is not relevant
      const hooks = manager.getHooksForEvent('UserPromptSubmit');
      expect(hooks).toHaveLength(2);
    });
  });

  describe('clearHooks', () => {
    it('should remove all registered hooks and reset initialized state', () => {
      const manager = HooksManager.getInstance();
      manager.getHooks(); // Initialize first

      manager.registerHook({ event: 'PreToolUse', type: 'command', command: 'hook1' });
      manager.registerHook({ event: 'PostToolUse', type: 'command', command: 'hook2' });

      // Before clear, hooks should be present
      expect(manager.getHooks()).toHaveLength(2);

      manager.clearHooks();

      // After clear, hooks are empty (but getHooks triggers re-initialization from disk)
      // Since fs.existsSync returns false in beforeEach, no hooks will be loaded
      expect(manager.getHooks()).toHaveLength(0);
    });
  });

  describe('config file loading', () => {
    it('should load hooks from project directory hooks.json', () => {
      const hooksConfig = {
        hooks: [
          { event: 'PreToolUse', type: 'command', command: 'project-hook' },
        ],
      };

      vi.mocked(fs.existsSync).mockImplementation((path: unknown) => {
        return String(path).includes('.ax-cli/hooks.json');
      });
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(hooksConfig));

      HooksManager.reset();
      const manager = HooksManager.getInstance();
      const hooks = manager.getHooks();

      expect(hooks.some(h => h.command === 'project-hook')).toBe(true);
    });

    it('should stop searching file types after first config found in a directory', () => {
      // Mock: hooks.json exists but hooks.yaml does not
      vi.mocked(fs.existsSync).mockImplementation((path: unknown) => {
        const p = String(path);
        // Only hooks.json files exist, not yaml
        return p.endsWith('hooks.json');
      });

      let readCount = 0;
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        readCount++;
        return JSON.stringify({ hooks: [{ event: 'PreToolUse', type: 'command', command: 'found' }] });
      });

      HooksManager.reset();
      const manager = HooksManager.getInstance();
      manager.getHooks();

      // Should have read from 2 locations max (project + user), not checking yaml/yml files
      // Each directory breaks after finding hooks.json
      expect(readCount).toBeLessThanOrEqual(2);
    });

    it('should handle invalid JSON in config file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json{');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      HooksManager.reset();
      const manager = HooksManager.getInstance();
      manager.getHooks(); // Trigger initialization

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should handle config file with no hooks array', () => {
      const hooksConfig = { version: '1.0' }; // No hooks property

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(hooksConfig));

      HooksManager.reset();
      const manager = HooksManager.getInstance();
      const hooks = manager.getHooks();

      // Should not throw, just return empty
      expect(hooks).toHaveLength(0);
    });

    it('should merge hooks from project and user directories', () => {
      let callCount = 0;

      vi.mocked(fs.existsSync).mockImplementation((path: unknown) => {
        return String(path).endsWith('hooks.json');
      });
      vi.mocked(fs.readFileSync).mockImplementation((path: unknown) => {
        callCount++;
        if (String(path).includes('.ax-cli/hooks.json') && !String(path).includes('home')) {
          return JSON.stringify({ hooks: [{ event: 'PreToolUse', type: 'command', command: 'project' }] });
        }
        return JSON.stringify({ hooks: [{ event: 'PreToolUse', type: 'command', command: 'user' }] });
      });

      HooksManager.reset();
      const manager = HooksManager.getInstance();
      const hooks = manager.getHooks();

      // Should have loaded from at least one file
      expect(hooks.length).toBeGreaterThan(0);
    });
  });

  describe('executeHooks', () => {
    it('should return empty array when no hooks match', async () => {
      const manager = HooksManager.getInstance();

      const results = await manager.executeHooks('PreToolUse', {
        event: 'PreToolUse',
        projectDir: '/test',
        timestamp: new Date().toISOString(),
      });

      expect(results).toEqual([]);
    });
  });

  describe('shouldBlockTool', () => {
    it('should return blocked=false when no hooks exist', async () => {
      const manager = HooksManager.getInstance();

      const result = await manager.shouldBlockTool('bash', { command: 'ls' }, 'tool-1');

      expect(result.blocked).toBe(false);
    });
  });

  describe('processUserInput', () => {
    it('should return original input when no hooks exist', async () => {
      const manager = HooksManager.getInstance();

      const result = await manager.processUserInput('Hello world');

      expect(result).toBe('Hello world');
    });
  });
});

describe('getHooksManager', () => {
  beforeEach(() => {
    HooksManager.reset();
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  it('should return singleton HooksManager instance', () => {
    const manager1 = getHooksManager();
    const manager2 = getHooksManager();
    expect(manager1).toBe(manager2);
  });

  it('should return same instance as getInstance', () => {
    const manager1 = getHooksManager();
    const manager2 = HooksManager.getInstance();
    expect(manager1).toBe(manager2);
  });
});

describe('HooksManager executeHook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HooksManager.reset();
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    HooksManager.reset();
  });

  it('should execute command hook with spawn', async () => {
    const manager = HooksManager.getInstance();
    manager.getHooks(); // Initialize

    // Setup spawn mock with callbacks
    let closeCallback: ((code: number | null) => void) | undefined;
    let stdoutCallback: ((data: Buffer) => void) | undefined;
    let stderrCallback: ((data: Buffer) => void) | undefined;

    const mockSpawnChild = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: {
        on: vi.fn().mockImplementation((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data') stdoutCallback = cb;
        }),
      },
      stderr: {
        on: vi.fn().mockImplementation((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data') stderrCallback = cb;
        }),
      },
      on: vi.fn().mockImplementation((event: string, cb: (code: number | null) => void) => {
        if (event === 'close') closeCallback = cb;
      }),
      kill: vi.fn(),
    };

    vi.mocked(spawn).mockReturnValue(mockSpawnChild as unknown as ReturnType<typeof spawn>);

    manager.registerHook({
      event: 'PreToolUse',
      type: 'command',
      command: 'echo test',
    });

    const resultPromise = manager.executeHooks('PreToolUse', {
      event: 'PreToolUse',
      projectDir: '/test',
      timestamp: new Date().toISOString(),
      toolCall: { name: 'bash', arguments: {}, id: 'tool-1' },
    });

    // Simulate command output
    if (stdoutCallback) stdoutCallback(Buffer.from('success output'));
    if (stderrCallback) stderrCallback(Buffer.from(''));
    if (closeCallback) closeCallback(0);

    const results = await resultPromise;

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(spawn).toHaveBeenCalled();
  });

  it('should handle hook execution error', async () => {
    const manager = HooksManager.getInstance();
    manager.getHooks();

    let errorCallback: ((error: Error) => void) | undefined;

    const mockSpawnChild = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn().mockImplementation((event: string, cb: unknown) => {
        if (event === 'error') errorCallback = cb as (error: Error) => void;
      }),
      kill: vi.fn(),
    };

    vi.mocked(spawn).mockReturnValue(mockSpawnChild as unknown as ReturnType<typeof spawn>);

    manager.registerHook({
      event: 'PreToolUse',
      type: 'command',
      command: 'nonexistent-command',
    });

    const resultPromise = manager.executeHooks('PreToolUse', {
      event: 'PreToolUse',
      projectDir: '/test',
      timestamp: new Date().toISOString(),
      toolCall: { name: 'bash', arguments: {}, id: 'tool-1' },
    });

    // Simulate spawn error
    if (errorCallback) errorCallback(new Error('Command not found'));

    const results = await resultPromise;

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('Command not found');
  });

  it('should handle hook timeout', async () => {
    vi.useFakeTimers();
    const manager = HooksManager.getInstance();
    manager.getHooks();

    const mockSpawnChild = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
    };

    vi.mocked(spawn).mockReturnValue(mockSpawnChild as unknown as ReturnType<typeof spawn>);

    manager.registerHook({
      event: 'PreToolUse',
      type: 'command',
      command: 'slow-command',
      timeout: 1000, // 1 second timeout
    });

    const resultPromise = manager.executeHooks('PreToolUse', {
      event: 'PreToolUse',
      projectDir: '/test',
      timestamp: new Date().toISOString(),
      toolCall: { name: 'bash', arguments: {}, id: 'tool-1' },
    });

    // Get the close callback
    const closeCall = mockSpawnChild.on.mock.calls.find((c: unknown[]) => c[0] === 'close');
    const closeCallback = closeCall?.[1] as ((code: number | null) => void) | undefined;

    // Advance time to trigger timeout
    vi.advanceTimersByTime(2000);

    // Simulate the close event (triggered by kill)
    if (closeCallback) closeCallback(null);

    const results = await resultPromise;

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('timed out');
    expect(mockSpawnChild.kill).toHaveBeenCalledWith('SIGTERM');

    vi.useRealTimers();
  });

  it('should parse JSON output from hook', async () => {
    const manager = HooksManager.getInstance();
    manager.getHooks();

    let closeCallback: ((code: number | null) => void) | undefined;
    let stdoutCallback: ((data: Buffer) => void) | undefined;

    const mockSpawnChild = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: {
        on: vi.fn().mockImplementation((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data') stdoutCallback = cb;
        }),
      },
      stderr: { on: vi.fn() },
      on: vi.fn().mockImplementation((event: string, cb: (code: number | null) => void) => {
        if (event === 'close') closeCallback = cb;
      }),
      kill: vi.fn(),
    };

    vi.mocked(spawn).mockReturnValue(mockSpawnChild as unknown as ReturnType<typeof spawn>);

    manager.registerHook({
      event: 'PreToolUse',
      type: 'command',
      command: 'permission-hook',
    });

    const resultPromise = manager.executeHooks('PreToolUse', {
      event: 'PreToolUse',
      projectDir: '/test',
      timestamp: new Date().toISOString(),
      toolCall: { name: 'bash', arguments: {}, id: 'tool-1' },
    });

    // Simulate JSON output with permission decision
    if (stdoutCallback) {
      stdoutCallback(Buffer.from(JSON.stringify({ permissionDecision: 'allow' })));
    }
    if (closeCallback) closeCallback(0);

    const results = await resultPromise;

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].output?.permissionDecision).toBe('allow');
  });

  it('should return error for prompt hook type (not implemented)', async () => {
    const manager = HooksManager.getInstance();
    manager.getHooks();

    manager.registerHook({
      event: 'PreToolUse',
      type: 'prompt' as 'command', // Cast to avoid type error
      // No command since it's a prompt type
    } as AnyHookConfig);

    const results = await manager.executeHooks('PreToolUse', {
      event: 'PreToolUse',
      projectDir: '/test',
      timestamp: new Date().toISOString(),
    });

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('not yet implemented');
  });
});

describe('HooksManager shouldBlockTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HooksManager.reset();
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    HooksManager.reset();
  });

  it('should return blocked=true when hook returns deny permission', async () => {
    const manager = HooksManager.getInstance();
    manager.getHooks();

    let closeCallback: ((code: number | null) => void) | undefined;
    let stdoutCallback: ((data: Buffer) => void) | undefined;
    let stderrCallback: ((data: Buffer) => void) | undefined;

    const mockSpawnChild = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: {
        on: vi.fn().mockImplementation((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data') stdoutCallback = cb;
        }),
      },
      stderr: {
        on: vi.fn().mockImplementation((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data') stderrCallback = cb;
        }),
      },
      on: vi.fn().mockImplementation((event: string, cb: (code: number | null) => void) => {
        if (event === 'close') closeCallback = cb;
      }),
      kill: vi.fn(),
    };

    vi.mocked(spawn).mockReturnValue(mockSpawnChild as unknown as ReturnType<typeof spawn>);

    manager.registerHook({
      event: 'PreToolUse',
      type: 'command',
      command: 'deny-hook',
      toolPattern: 'bash',
    });

    const resultPromise = manager.shouldBlockTool('bash', { command: 'rm -rf /' }, 'tool-1');

    // Simulate deny response
    if (stdoutCallback) {
      stdoutCallback(Buffer.from(JSON.stringify({ permissionDecision: 'deny' })));
    }
    if (stderrCallback) {
      stderrCallback(Buffer.from('Operation not allowed'));
    }
    if (closeCallback) closeCallback(0);

    const result = await resultPromise;

    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('Operation not allowed');
  });

  it('should not block when hook exits with non-zero code (treated as failure)', async () => {
    // Note: Non-zero exit codes are treated as hook failures, not blocking decisions
    // The blocking logic only applies when success=true with exitCode=2 in output
    const manager = HooksManager.getInstance();
    manager.getHooks();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    let closeCallback: ((code: number | null) => void) | undefined;
    let stderrCallback: ((data: Buffer) => void) | undefined;

    const mockSpawnChild = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn() },
      stderr: {
        on: vi.fn().mockImplementation((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data') stderrCallback = cb;
        }),
      },
      on: vi.fn().mockImplementation((event: string, cb: (code: number | null) => void) => {
        if (event === 'close') closeCallback = cb;
      }),
      kill: vi.fn(),
    };

    vi.mocked(spawn).mockReturnValue(mockSpawnChild as unknown as ReturnType<typeof spawn>);

    manager.registerHook({
      event: 'PreToolUse',
      type: 'command',
      command: 'blocking-hook',
    });

    const resultPromise = manager.shouldBlockTool('bash', { command: 'test' }, 'tool-1');

    if (stderrCallback) stderrCallback(Buffer.from('Hook error'));
    if (closeCallback) closeCallback(1); // Exit code 1 = hook failure (not blocking)

    const result = await resultPromise;

    // Exit code 1 means hook failed, not that we should block
    // Note: Exit code 2 is special and DOES block (see types.ts)
    expect(result.blocked).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('PreToolUse hook failed'));

    warnSpy.mockRestore();
  });

  it('should log warning and continue when hook fails', async () => {
    const manager = HooksManager.getInstance();
    manager.getHooks();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    let errorCallback: ((error: Error) => void) | undefined;

    const mockSpawnChild = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn().mockImplementation((event: string, cb: unknown) => {
        if (event === 'error') errorCallback = cb as (error: Error) => void;
      }),
      kill: vi.fn(),
    };

    vi.mocked(spawn).mockReturnValue(mockSpawnChild as unknown as ReturnType<typeof spawn>);

    manager.registerHook({
      event: 'PreToolUse',
      type: 'command',
      command: 'failing-hook',
    });

    const resultPromise = manager.shouldBlockTool('bash', { command: 'test' }, 'tool-1');

    if (errorCallback) errorCallback(new Error('Hook crashed'));

    const result = await resultPromise;

    expect(result.blocked).toBe(false); // Should not block on error
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('PreToolUse hook failed'));

    warnSpy.mockRestore();
  });
});

describe('HooksManager processUserInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HooksManager.reset();
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    HooksManager.reset();
  });

  it('should return modified input from hook', async () => {
    const manager = HooksManager.getInstance();
    manager.getHooks();

    let closeCallback: ((code: number | null) => void) | undefined;
    let stdoutCallback: ((data: Buffer) => void) | undefined;

    const mockSpawnChild = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: {
        on: vi.fn().mockImplementation((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data') stdoutCallback = cb;
        }),
      },
      stderr: { on: vi.fn() },
      on: vi.fn().mockImplementation((event: string, cb: (code: number | null) => void) => {
        if (event === 'close') closeCallback = cb;
      }),
      kill: vi.fn(),
    };

    vi.mocked(spawn).mockReturnValue(mockSpawnChild as unknown as ReturnType<typeof spawn>);

    manager.registerHook({
      event: 'UserPromptSubmit',
      type: 'command',
      command: 'transform-input',
    });

    const resultPromise = manager.processUserInput('original input');

    if (stdoutCallback) {
      stdoutCallback(Buffer.from(JSON.stringify({ updatedInput: 'transformed input' })));
    }
    if (closeCallback) closeCallback(0);

    const result = await resultPromise;

    expect(result).toBe('transformed input');
  });

  it('should return original input when hook does not modify it', async () => {
    const manager = HooksManager.getInstance();
    manager.getHooks();

    let closeCallback: ((code: number | null) => void) | undefined;
    let stdoutCallback: ((data: Buffer) => void) | undefined;

    const mockSpawnChild = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: {
        on: vi.fn().mockImplementation((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data') stdoutCallback = cb;
        }),
      },
      stderr: { on: vi.fn() },
      on: vi.fn().mockImplementation((event: string, cb: (code: number | null) => void) => {
        if (event === 'close') closeCallback = cb;
      }),
      kill: vi.fn(),
    };

    vi.mocked(spawn).mockReturnValue(mockSpawnChild as unknown as ReturnType<typeof spawn>);

    manager.registerHook({
      event: 'UserPromptSubmit',
      type: 'command',
      command: 'logging-hook',
    });

    const resultPromise = manager.processUserInput('keep this');

    if (stdoutCallback) {
      stdoutCallback(Buffer.from('logged')); // No JSON, no updatedInput
    }
    if (closeCallback) closeCallback(0);

    const result = await resultPromise;

    expect(result).toBe('keep this');
  });
});

describe('HooksManager executePostToolHooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HooksManager.reset();
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    HooksManager.reset();
  });

  it('should execute post tool hooks without blocking', () => {
    const manager = HooksManager.getInstance();
    manager.getHooks();

    const mockSpawnChild = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
    };

    vi.mocked(spawn).mockReturnValue(mockSpawnChild as unknown as ReturnType<typeof spawn>);

    manager.registerHook({
      event: 'PostToolUse',
      type: 'command',
      command: 'post-hook',
    });

    // Should not throw and should return immediately
    expect(() => {
      manager.executePostToolHooks(
        'bash',
        { command: 'echo test' },
        'tool-1',
        { success: true, output: 'test' }
      );
    }).not.toThrow();

    expect(spawn).toHaveBeenCalled();
  });

  it('should log warning on error in post hook', async () => {
    const manager = HooksManager.getInstance();
    manager.getHooks();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Make executeHooks throw
    const executeHooksSpy = vi.spyOn(manager, 'executeHooks').mockRejectedValue(new Error('Hook error'));

    manager.registerHook({
      event: 'PostToolUse',
      type: 'command',
      command: 'failing-post-hook',
    });

    manager.executePostToolHooks(
      'bash',
      { command: 'test' },
      'tool-1',
      { success: true, output: 'done' }
    );

    // Wait for the async rejection to be caught
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(warnSpy).toHaveBeenCalledWith('PostToolUse hook error:', 'Hook error');

    warnSpy.mockRestore();
    executeHooksSpy.mockRestore();
  });
});

describe('HooksManager hook environment and cwd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HooksManager.reset();
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    HooksManager.reset();
  });

  it('should pass custom environment variables to hook', async () => {
    const manager = HooksManager.getInstance();
    manager.getHooks();

    let closeCallback: ((code: number | null) => void) | undefined;

    const mockSpawnChild = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn().mockImplementation((event: string, cb: (code: number | null) => void) => {
        if (event === 'close') closeCallback = cb;
      }),
      kill: vi.fn(),
    };

    vi.mocked(spawn).mockReturnValue(mockSpawnChild as unknown as ReturnType<typeof spawn>);

    manager.registerHook({
      event: 'PreToolUse',
      type: 'command',
      command: 'env-hook',
      env: { CUSTOM_VAR: 'custom_value' },
      cwd: '/custom/dir',
    });

    const resultPromise = manager.executeHooks('PreToolUse', {
      event: 'PreToolUse',
      projectDir: '/test',
      timestamp: new Date().toISOString(),
    });

    if (closeCallback) closeCallback(0);

    await resultPromise;

    expect(spawn).toHaveBeenCalledWith(
      'env-hook',
      [],
      expect.objectContaining({
        cwd: '/custom/dir',
        env: expect.objectContaining({
          CUSTOM_VAR: 'custom_value',
          AXCLI_PROJECT_DIR: '/test',
          AXCLI_EVENT: 'PreToolUse',
        }),
      })
    );
  });
});
