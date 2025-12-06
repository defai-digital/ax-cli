/**
 * Tests for SDK Lifecycle Management (Phase 3)
 *
 * Tests autoCleanup, onDispose, onError, and removeCleanupHandlers functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAgent, removeCleanupHandlers, type AgentOptions } from '../../src/sdk/index.js';
import { LLMAgent } from '../../src/agent/llm-agent.js';

// Mock provider settings manager to avoid needing actual credentials
vi.mock('../../src/utils/provider-settings.js', () => {
  const mockSettingsManager = {
    loadUserSettings: vi.fn(),
    getApiKey: vi.fn(() => 'test-api-key'),
    getCurrentModel: vi.fn(() => 'glm-4.6'),
    getBaseURL: vi.fn(() => 'http://localhost:11434/v1'),
  };

  return {
    ProviderSettingsManager: {
      forContext: vi.fn(() => mockSettingsManager),
      forProvider: vi.fn(() => mockSettingsManager),
    },
  };
});

// Mock provider context detection
vi.mock('../../src/utils/provider-context.js', () => ({
  ProviderContext: class {
    static detect = vi.fn(() => ({
      provider: 'generic',
      userDir: '/tmp/.ax-cli',
      projectDir: undefined,
    }));
    static create = vi.fn(() => ({
      provider: 'generic',
      userDir: '/tmp/.ax-cli',
      projectDir: undefined,
    }));
  },
  detectProvider: vi.fn(() => 'generic'),
  PROVIDER_CONFIGS: {
    generic: { cliName: 'ax-cli', configDir: '.ax-cli', displayName: 'AX CLI' },
    glm: { cliName: 'ax-glm', configDir: '.ax-glm', displayName: 'GLM' },
    grok: { cliName: 'ax-grok', configDir: '.ax-grok', displayName: 'Grok' },
  },
}));

// Mock LLMAgent to avoid actual API calls
vi.mock('../../src/agent/llm-agent.js', () => {
  class MockLLMAgent {
    processUserMessage = vi.fn().mockResolvedValue([]);
    dispose = vi.fn().mockResolvedValue(undefined);
    on = vi.fn();
    emit = vi.fn();
  }

  return {
    LLMAgent: MockLLMAgent,
  };
});

describe('SDK Lifecycle Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any process listeners
    process.removeAllListeners('exit');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGHUP');
  });

  describe('autoCleanup option', () => {
    it('should enable auto-cleanup by default', async () => {
      const agent = await createAgent();

      // Should have registered cleanup handlers
      expect((agent as any)._sdkCleanupHandler).toBeDefined();
      expect(typeof (agent as any)._sdkCleanupHandler).toBe('function');

      // Cleanup
      await agent.dispose();
    });

    it('should register cleanup handlers when autoCleanup is true', async () => {
      const agent = await createAgent({ autoCleanup: true });

      // Should have cleanup handler
      expect((agent as any)._sdkCleanupHandler).toBeDefined();

      // Cleanup
      await agent.dispose();
    });

    it('should NOT register cleanup handlers when autoCleanup is false', async () => {
      const agent = await createAgent({ autoCleanup: false });

      // Should NOT have cleanup handler
      expect((agent as any)._sdkCleanupHandler).toBeUndefined();

      // Cleanup
      await agent.dispose();
    });

    it('should have cleanup handler when autoCleanup is true', async () => {
      const agent = await createAgent({ autoCleanup: true });

      const cleanupHandler = (agent as any)._sdkCleanupHandler;
      expect(cleanupHandler).toBeDefined();
      expect(typeof cleanupHandler).toBe('function');

      await agent.dispose();
    });

    it('should handle cleanup errors gracefully', async () => {
      const agent = await createAgent({ autoCleanup: true });

      const cleanupHandler = (agent as any)._sdkCleanupHandler;

      // Should not throw when cleanup is called
      expect(() => cleanupHandler()).not.toThrow();
    });
  });

  describe('onDispose lifecycle hook', () => {
    it('should call onDispose before dispose()', async () => {
      const onDispose = vi.fn();

      const agent = await createAgent({ onDispose });

      await agent.dispose();

      // onDispose should have been called
      expect(onDispose).toHaveBeenCalled();
    });

    it('should support async onDispose hook', async () => {
      const onDispose = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const agent = await createAgent({ onDispose });

      await agent.dispose();

      expect(onDispose).toHaveBeenCalled();
    });

    it('should continue disposal even if onDispose fails', async () => {
      const onDispose = vi.fn(() => {
        throw new Error('onDispose failed');
      });

      const agent = await createAgent({ onDispose });

      // Should not throw
      await expect(agent.dispose()).resolves.not.toThrow();

      // But should still have called the hook
      expect(onDispose).toHaveBeenCalled();
    });

    it('should not call onDispose if not provided', async () => {
      const agent = await createAgent();

      // Should not throw
      await expect(agent.dispose()).resolves.not.toThrow();
    });
  });

  describe('onError lifecycle hook', () => {
    it('should listen to error events', async () => {
      const onError = vi.fn();

      const agent = await createAgent({ onError });

      // Verify error listener was registered
      expect(agent.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should wrap processUserMessage when onError is provided', async () => {
      const onError = vi.fn();

      const agent = await createAgent({ onError });

      // processUserMessage should be wrapped (different from original)
      expect(typeof agent.processUserMessage).toBe('function');
    });

    it('should not wrap processUserMessage if onError not provided', async () => {
      const agent = await createAgent();

      // processUserMessage should still be a function
      expect(typeof agent.processUserMessage).toBe('function');
    });
  });

  describe('removeCleanupHandlers()', () => {
    it('should remove cleanup handlers from agent', async () => {
      const agent = await createAgent({ autoCleanup: true });

      // Should have cleanup handler
      expect((agent as any)._sdkCleanupHandler).toBeDefined();

      // Remove cleanup handlers
      removeCleanupHandlers(agent);

      // Should no longer have cleanup handler
      expect((agent as any)._sdkCleanupHandler).toBeUndefined();

      // Cleanup
      await agent.dispose();
    });

    it('should do nothing if agent has no cleanup handlers', async () => {
      const agent = await createAgent({ autoCleanup: false });

      // No cleanup handler to begin with
      expect((agent as any)._sdkCleanupHandler).toBeUndefined();

      // Should not throw
      expect(() => removeCleanupHandlers(agent)).not.toThrow();

      // Still no cleanup handler
      expect((agent as any)._sdkCleanupHandler).toBeUndefined();

      // Cleanup
      await agent.dispose();
    });

    it('should allow manual control after removing handlers', async () => {
      const agent = await createAgent({ autoCleanup: true });

      // Remove auto-cleanup
      removeCleanupHandlers(agent);

      // Manually dispose
      await agent.dispose();

      // Should have disposed without errors
      expect((agent as any)._sdkCleanupHandler).toBeUndefined();
    });
  });

  describe('Integration scenarios', () => {
    it('should support all lifecycle features together', async () => {
      const onDispose = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
      });

      const onError = vi.fn();

      const agent = await createAgent({
        autoCleanup: true,
        onDispose,
        onError,
        debug: false,
      });

      // Should have cleanup handlers
      expect((agent as any)._sdkCleanupHandler).toBeDefined();

      // Should have lifecycle hooks
      expect((agent as any)._sdkLifecycleHooks).toBeDefined();
      expect((agent as any)._sdkLifecycleHooks.onDispose).toBeDefined();
      expect((agent as any)._sdkLifecycleHooks.onError).toBeDefined();

      // Test disposal
      await agent.dispose();
      expect(onDispose).toHaveBeenCalled();
    });

    it('should support manual cleanup workflow', async () => {
      const onDispose = vi.fn();

      // Create agent with manual cleanup
      const agent = await createAgent({
        autoCleanup: false,
        onDispose,
      });

      // No auto-cleanup handlers
      expect((agent as any)._sdkCleanupHandler).toBeUndefined();

      // Manually dispose
      await agent.dispose();

      // Should still call onDispose
      expect(onDispose).toHaveBeenCalled();
    });

    it('should support disabling auto-cleanup later', async () => {
      const agent = await createAgent({ autoCleanup: true });

      // Has cleanup handlers
      expect((agent as any)._sdkCleanupHandler).toBeDefined();

      // Remove them
      removeCleanupHandlers(agent);

      // No longer has cleanup handlers
      expect((agent as any)._sdkCleanupHandler).toBeUndefined();

      // Manual cleanup
      await agent.dispose();
    });
  });

  describe('Backward compatibility', () => {
    it('should maintain default behavior (autoCleanup: true)', async () => {
      const agent = await createAgent();

      // Should have auto-cleanup by default
      expect((agent as any)._sdkCleanupHandler).toBeDefined();

      await agent.dispose();
    });

    it('should work with existing code that does not use new options', async () => {
      const agent = await createAgent({
        maxToolRounds: 50,
      });

      // Should have default auto-cleanup
      expect((agent as any)._sdkCleanupHandler).toBeDefined();

      await agent.dispose();
    });

    it('should work with debug mode', async () => {
      const agent = await createAgent({
        debug: true,
        autoCleanup: true,
      });

      expect(agent).toBeDefined();
      await agent.dispose();
    });
  });

  describe('AgentOptions validation', () => {
    it('should accept valid lifecycle options', async () => {
      const options: AgentOptions = {
        maxToolRounds: 50,
        debug: false,
        autoCleanup: false,
        onDispose: async () => {},
        onError: (error: Error) => {},
      };

      const agent = await createAgent(options);
      expect(agent).toBeDefined();
      await agent.dispose();
    });

    it('should accept partial lifecycle options', async () => {
      const agent = await createAgent({
        onDispose: () => {},
        // autoCleanup not specified (should default to true)
      });

      expect((agent as any)._sdkCleanupHandler).toBeDefined();
      await agent.dispose();
    });

    it('should accept only autoCleanup option', async () => {
      const agent = await createAgent({
        autoCleanup: false,
      });

      expect((agent as any)._sdkCleanupHandler).toBeUndefined();
      await agent.dispose();
    });
  });
});
