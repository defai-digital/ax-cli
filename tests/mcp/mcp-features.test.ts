/**
 * Tests for MCP Features (MCP 2025-06-18)
 *
 * Tests:
 * - Progress Notifications
 * - Cancellation Support
 * - Resource Subscriptions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ProgressTracker,
  getProgressTracker,
  resetProgressTracker,
  formatProgress,
  formatElapsedTime,
  type ProgressUpdate,
} from '../../src/mcp/progress.js';
import {
  CancellationManager,
  getCancellationManager,
  resetCancellationManager,
  isRequestCancelled,
  createCancellationError,
  CANCELLED_ERROR_CODE,
} from '../../src/mcp/cancellation.js';
import {
  SubscriptionManager,
  getSubscriptionManager,
  resetSubscriptionManager,
} from '../../src/mcp/subscriptions.js';
import {
  ToolOutputValidator,
  getToolOutputValidator,
  resetToolOutputValidator,
} from '../../src/mcp/schema-validator.js';
import { createServerName, createToolName } from '../../src/mcp/type-safety.js';

// ============================================================================
// Progress Notifications Tests
// ============================================================================

describe('Progress Notifications', () => {
  let tracker: ProgressTracker;

  beforeEach(() => {
    resetProgressTracker();
    tracker = getProgressTracker();
  });

  afterEach(() => {
    resetProgressTracker();
  });

  describe('ProgressTracker', () => {
    it('should create unique progress tokens', () => {
      const token1 = tracker.createToken();
      const token2 = tracker.createToken();

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
    });

    it('should register and call progress callback', () => {
      const updates: ProgressUpdate[] = [];
      const token = 'test-token';

      tracker.onProgress(token, (update) => updates.push(update));

      tracker.handleNotification({
        progressToken: token,
        progress: 0.5,
        message: 'Halfway there',
      });

      expect(updates).toHaveLength(1);
      expect(updates[0].progress).toBe(0.5);
      expect(updates[0].message).toBe('Halfway there');
      expect(updates[0].token).toBe(token);
    });

    it('should clamp progress to 0-1 range', () => {
      const updates: ProgressUpdate[] = [];
      const token = 'test-token';

      tracker.onProgress(token, (update) => updates.push(update));

      // Over 1
      tracker.handleNotification({
        progressToken: token,
        progress: 1.5,
      });
      expect(updates[0].progress).toBe(1);

      // Under 0
      tracker.handleNotification({
        progressToken: token,
        progress: -0.5,
      });
      expect(updates[1].progress).toBe(0);
    });

    it('should calculate current from total', () => {
      const updates: ProgressUpdate[] = [];
      const token = 'test-token';

      tracker.onProgress(token, (update) => updates.push(update));

      tracker.handleNotification({
        progressToken: token,
        progress: 0.5,
        total: 100,
      });

      expect(updates[0].current).toBe(50);
      expect(updates[0].total).toBe(100);
    });

    it('should track elapsed time', async () => {
      const token = 'test-token';
      tracker.onProgress(token, () => {});

      await new Promise((resolve) => setTimeout(resolve, 60));

      const elapsed = tracker.getElapsedTime(token);
      // Allow small tolerance for timer precision (setTimeout can fire slightly early)
      expect(elapsed).toBeGreaterThanOrEqual(50);
    });

    it('should estimate remaining time', async () => {
      const token = 'test-token';
      tracker.onProgress(token, () => {});

      // Wait a bit then report 50% progress
      await new Promise((resolve) => setTimeout(resolve, 50));
      tracker.handleNotification({
        progressToken: token,
        progress: 0.5,
      });

      const remaining = tracker.estimateRemainingTime(token);
      expect(remaining).toBeDefined();
      expect(remaining).toBeGreaterThanOrEqual(0);
    });

    it('should cleanup progress tracking', () => {
      const token = 'test-token';
      tracker.onProgress(token, () => {});

      expect(tracker.isTracking(token)).toBe(true);

      tracker.cleanup(token);

      expect(tracker.isTracking(token)).toBe(false);
    });

    it('should emit global progress events', () => {
      const events: ProgressUpdate[] = [];
      tracker.on('progress', (update) => events.push(update));

      const token = 'test-token';
      tracker.handleNotification({
        progressToken: token,
        progress: 0.75,
      });

      expect(events).toHaveLength(1);
      expect(events[0].progress).toBe(0.75);
    });

    it('should get last update for token', () => {
      const token = 'test-token';

      tracker.handleNotification({
        progressToken: token,
        progress: 0.25,
      });

      tracker.handleNotification({
        progressToken: token,
        progress: 0.75,
      });

      const last = tracker.getLastUpdate(token);
      expect(last?.progress).toBe(0.75);
    });

    it('should get active tokens', () => {
      tracker.onProgress('token-1', () => {});
      tracker.onProgress('token-2', () => {});

      const tokens = tracker.getActiveTokens();
      expect(tokens).toContain('token-1');
      expect(tokens).toContain('token-2');
    });
  });

  describe('Format Utilities', () => {
    it('should format progress bar', () => {
      const update: ProgressUpdate = {
        token: 'test',
        progress: 0.5,
        timestamp: new Date(),
      };

      const formatted = formatProgress(update);
      expect(formatted).toContain('50%');
      expect(formatted).toContain('█');
      expect(formatted).toContain('░');
    });

    it('should format progress with count', () => {
      const update: ProgressUpdate = {
        token: 'test',
        progress: 0.5,
        total: 100,
        current: 50,
        timestamp: new Date(),
      };

      const formatted = formatProgress(update, { showCount: true });
      expect(formatted).toContain('(50/100)');
    });

    it('should format progress with message', () => {
      const update: ProgressUpdate = {
        token: 'test',
        progress: 0.5,
        message: 'Processing files...',
        timestamp: new Date(),
      };

      const formatted = formatProgress(update, { showMessage: true });
      expect(formatted).toContain('Processing files...');
    });

    it('should format elapsed time in ms', () => {
      expect(formatElapsedTime(500)).toBe('500ms');
    });

    it('should format elapsed time in seconds', () => {
      expect(formatElapsedTime(5000)).toBe('5s');
    });

    it('should format elapsed time in minutes and seconds', () => {
      expect(formatElapsedTime(90000)).toBe('1m 30s');
    });
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const instance1 = getProgressTracker();
      const instance2 = getProgressTracker();
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getProgressTracker();
      resetProgressTracker();
      const instance2 = getProgressTracker();
      expect(instance1).not.toBe(instance2);
    });
  });
});

// ============================================================================
// Cancellation Tests
// ============================================================================

describe('Cancellation Support', () => {
  let manager: CancellationManager;
  const serverName = createServerName('test-server')!;
  const toolName = createToolName('mcp__test-server__test-tool')!;

  beforeEach(() => {
    resetCancellationManager();
    manager = getCancellationManager();
  });

  afterEach(() => {
    resetCancellationManager();
  });

  describe('CancellationManager', () => {
    it('should register and cancel requests', async () => {
      const abortController = new AbortController();

      manager.register({
        id: 'req-1',
        serverName,
        toolName,
        startedAt: new Date(),
        abortController,
      });

      expect(manager.getActiveRequests()).toHaveLength(1);
      expect(manager.hasActiveRequests()).toBe(true);

      const result = await manager.cancel('req-1', 'test');

      expect(result.success).toBe(true);
      expect(result.requestId).toBe('req-1');
      expect(manager.isCancelled('req-1')).toBe(true);
      expect(abortController.signal.aborted).toBe(true);
    });

    it('should cancel all requests', async () => {
      manager.register({
        id: 'req-1',
        serverName,
        toolName,
        startedAt: new Date(),
        abortController: new AbortController(),
      });

      manager.register({
        id: 'req-2',
        serverName,
        toolName,
        startedAt: new Date(),
        abortController: new AbortController(),
      });

      const results = await manager.cancelAll('cancel all');

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
      expect(manager.isCancelled('req-1')).toBe(true);
      expect(manager.isCancelled('req-2')).toBe(true);
    });

    it('should cancel by server', async () => {
      const serverName2 = createServerName('other-server')!;

      manager.register({
        id: 'req-1',
        serverName,
        toolName,
        startedAt: new Date(),
        abortController: new AbortController(),
      });

      manager.register({
        id: 'req-2',
        serverName: serverName2,
        toolName,
        startedAt: new Date(),
        abortController: new AbortController(),
      });

      const results = await manager.cancelByServer(serverName);

      expect(results).toHaveLength(1);
      expect(manager.isCancelled('req-1')).toBe(true);
      expect(manager.isCancelled('req-2')).toBe(false);
    });

    it('should get most recent request', () => {
      const early = new Date(Date.now() - 1000);
      const late = new Date();

      manager.register({
        id: 'req-1',
        serverName,
        toolName,
        startedAt: early,
        abortController: new AbortController(),
      });

      manager.register({
        id: 'req-2',
        serverName,
        toolName,
        startedAt: late,
        abortController: new AbortController(),
      });

      const mostRecent = manager.getMostRecentRequest();
      expect(mostRecent?.id).toBe('req-2');
    });

    it('should return undefined for already completed request', async () => {
      const result = await manager.cancel('nonexistent');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('should cleanup after delay', async () => {
      manager.register({
        id: 'req-1',
        serverName,
        toolName,
        startedAt: new Date(),
        abortController: new AbortController(),
      });

      manager.cleanup('req-1');

      // Immediately after cleanup
      expect(manager.getActiveRequests()).toHaveLength(0);
    });

    it('should emit events on registration and cancellation', async () => {
      const registered: unknown[] = [];
      const cancelled: unknown[] = [];

      manager.on('requestRegistered', (req) => registered.push(req));
      manager.on('requestCancelled', (req, reason) =>
        cancelled.push({ req, reason })
      );

      const abortController = new AbortController();
      manager.register({
        id: 'req-1',
        serverName,
        toolName,
        startedAt: new Date(),
        abortController,
      });

      expect(registered).toHaveLength(1);

      await manager.cancel('req-1', 'user cancelled');

      expect(cancelled).toHaveLength(1);
    });

    it('should send notification if sender is set', async () => {
      const notifications: unknown[] = [];

      manager.setSendNotification(async (srvName, reqId, reason) => {
        notifications.push({ srvName, reqId, reason });
      });

      manager.register({
        id: 'req-1',
        serverName,
        toolName,
        startedAt: new Date(),
        abortController: new AbortController(),
      });

      await manager.cancel('req-1', 'test reason');

      expect(notifications).toHaveLength(1);
      expect((notifications[0] as any).reqId).toBe('req-1');
      expect((notifications[0] as any).reason).toBe('test reason');
    });
  });

  describe('Error Detection', () => {
    it('should detect cancelled error by code', () => {
      const error = { code: CANCELLED_ERROR_CODE };
      expect(isRequestCancelled(error)).toBe(true);
    });

    it('should detect cancelled error by message', () => {
      const error = { message: 'Request was cancelled' };
      expect(isRequestCancelled(error)).toBe(true);
    });

    it('should not detect regular error as cancelled', () => {
      const error = { code: -32000, message: 'Some other error' };
      expect(isRequestCancelled(error)).toBe(false);
    });

    it('should create cancellation error', () => {
      const error = createCancellationError('User stopped');
      expect(error.message).toBe('User stopped');
      expect((error as any).code).toBe(CANCELLED_ERROR_CODE);
    });
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const instance1 = getCancellationManager();
      const instance2 = getCancellationManager();
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getCancellationManager();
      resetCancellationManager();
      const instance2 = getCancellationManager();
      expect(instance1).not.toBe(instance2);
    });
  });
});

// ============================================================================
// Resource Subscriptions Tests
// ============================================================================

describe('Resource Subscriptions', () => {
  let manager: SubscriptionManager;
  const serverName = createServerName('test-server')!;

  beforeEach(() => {
    resetSubscriptionManager();
    manager = getSubscriptionManager();
  });

  afterEach(() => {
    resetSubscriptionManager();
  });

  describe('SubscriptionManager', () => {
    it('should subscribe to a resource', async () => {
      // Mock the request sender
      manager.setSendRequest(async () => ({ success: true, value: undefined }));
      manager.setCheckCapabilities(async () => ({ supportsSubscriptions: true }));

      const result = await manager.subscribe(serverName, 'file:///test.txt');

      expect(result.success).toBe(true);
      expect(manager.isSubscribed(serverName, 'file:///test.txt')).toBe(true);
    });

    it('should not duplicate subscriptions', async () => {
      manager.setSendRequest(async () => ({ success: true, value: undefined }));
      manager.setCheckCapabilities(async () => ({ supportsSubscriptions: true }));

      await manager.subscribe(serverName, 'file:///test.txt');
      await manager.subscribe(serverName, 'file:///test.txt');

      expect(manager.getActiveSubscriptions()).toHaveLength(1);
    });

    it('should fail if server does not support subscriptions', async () => {
      manager.setCheckCapabilities(async () => ({ supportsSubscriptions: false }));

      const result = await manager.subscribe(serverName, 'file:///test.txt');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('does not support');
    });

    it('should unsubscribe from a resource', async () => {
      manager.setSendRequest(async () => ({ success: true, value: undefined }));
      manager.setCheckCapabilities(async () => ({ supportsSubscriptions: true }));

      await manager.subscribe(serverName, 'file:///test.txt');
      const result = await manager.unsubscribe(serverName, 'file:///test.txt');

      expect(result.success).toBe(true);
      expect(manager.isSubscribed(serverName, 'file:///test.txt')).toBe(false);
    });

    it('should handle resource updated notification', async () => {
      manager.setSendRequest(async () => ({ success: true, value: undefined }));
      manager.setCheckCapabilities(async () => ({ supportsSubscriptions: true }));

      await manager.subscribe(serverName, 'file:///test.txt');

      const updates: unknown[] = [];
      manager.on('resource-updated', (uri, srvName) =>
        updates.push({ uri, srvName })
      );

      manager.handleResourceUpdated(serverName, 'file:///test.txt');

      expect(updates).toHaveLength(1);
      expect((updates[0] as any).uri).toBe('file:///test.txt');
    });

    it('should not emit for non-subscribed resources', () => {
      const updates: unknown[] = [];
      manager.on('resource-updated', (uri) => updates.push(uri));

      manager.handleResourceUpdated(serverName, 'file:///not-subscribed.txt');

      expect(updates).toHaveLength(0);
    });

    it('should handle resource list changed notification', () => {
      const events: unknown[] = [];
      manager.on('resource-list-changed', (srvName) => events.push(srvName));

      manager.handleResourceListChanged(serverName);

      expect(events).toHaveLength(1);
    });

    it('should get subscriptions for server', async () => {
      manager.setSendRequest(async () => ({ success: true, value: undefined }));
      manager.setCheckCapabilities(async () => ({ supportsSubscriptions: true }));

      const serverName2 = createServerName('other-server')!;

      await manager.subscribe(serverName, 'file:///test1.txt');
      await manager.subscribe(serverName, 'file:///test2.txt');
      await manager.subscribe(serverName2, 'file:///other.txt');

      const subs = manager.getSubscriptionsForServer(serverName);
      expect(subs).toHaveLength(2);
    });

    it('should resubscribe for server', async () => {
      const requests: unknown[] = [];
      manager.setSendRequest(async (srvName, method, uri) => {
        requests.push({ srvName, method, uri });
        return { success: true, value: undefined };
      });
      manager.setCheckCapabilities(async () => ({ supportsSubscriptions: true }));

      await manager.subscribe(serverName, 'file:///test1.txt');
      await manager.subscribe(serverName, 'file:///test2.txt');

      // Clear requests log
      requests.length = 0;

      const results = await manager.resubscribeForServer(serverName);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.result.success)).toBe(true);
    });

    it('should unsubscribe all for server', async () => {
      manager.setSendRequest(async () => ({ success: true, value: undefined }));
      manager.setCheckCapabilities(async () => ({ supportsSubscriptions: true }));

      await manager.subscribe(serverName, 'file:///test1.txt');
      await manager.subscribe(serverName, 'file:///test2.txt');

      manager.unsubscribeAllForServer(serverName);

      expect(manager.getSubscriptionsForServer(serverName)).toHaveLength(0);
    });

    it('should get subscription count', async () => {
      manager.setSendRequest(async () => ({ success: true, value: undefined }));
      manager.setCheckCapabilities(async () => ({ supportsSubscriptions: true }));

      await manager.subscribe(serverName, 'file:///test1.txt');
      await manager.subscribe(serverName, 'file:///test2.txt');

      expect(manager.getSubscriptionCount()).toBe(2);
    });

    it('should emit subscribed/unsubscribed events', async () => {
      manager.setSendRequest(async () => ({ success: true, value: undefined }));
      manager.setCheckCapabilities(async () => ({ supportsSubscriptions: true }));

      const subscribed: unknown[] = [];
      const unsubscribed: unknown[] = [];

      manager.on('subscribed', (uri, srvName) =>
        subscribed.push({ uri, srvName })
      );
      manager.on('unsubscribed', (uri, srvName) =>
        unsubscribed.push({ uri, srvName })
      );

      await manager.subscribe(serverName, 'file:///test.txt');
      expect(subscribed).toHaveLength(1);

      await manager.unsubscribe(serverName, 'file:///test.txt');
      expect(unsubscribed).toHaveLength(1);
    });
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const instance1 = getSubscriptionManager();
      const instance2 = getSubscriptionManager();
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getSubscriptionManager();
      resetSubscriptionManager();
      const instance2 = getSubscriptionManager();
      expect(instance1).not.toBe(instance2);
    });
  });
});

// ============================================================================
// Schema Validation Tests
// ============================================================================

describe('Schema Validation', () => {
  let validator: ToolOutputValidator;

  beforeEach(() => {
    resetToolOutputValidator();
    validator = getToolOutputValidator();
  });

  afterEach(() => {
    resetToolOutputValidator();
  });

  describe('ToolOutputValidator', () => {
    it('should return no-schema for undefined schema', () => {
      const result = validator.validate(undefined, { foo: 'bar' });
      expect(result.status).toBe('no-schema');
    });

    it('should return no-schema for null schema', () => {
      const result = validator.validate(null, { foo: 'bar' });
      expect(result.status).toBe('no-schema');
    });

    it('should return valid for empty schema', () => {
      const result = validator.validate({}, { anything: 'goes' });
      expect(result.status).toBe('valid');
    });

    it('should validate simple object schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      };

      const validResult = validator.validate(schema, { name: 'John', age: 30 });
      expect(validResult.status).toBe('valid');

      const invalidResult = validator.validate(schema, { age: 30 });
      expect(invalidResult.status).toBe('invalid');
      expect(invalidResult.errors).toBeDefined();
    });

    it('should validate array schema', () => {
      const schema = {
        type: 'array',
        items: { type: 'string' },
      };

      const validResult = validator.validate(schema, ['a', 'b', 'c']);
      expect(validResult.status).toBe('valid');

      const invalidResult = validator.validate(schema, ['a', 1, 'c']);
      expect(invalidResult.status).toBe('invalid');
    });

    it('should validate nested object schema', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
            },
            required: ['id'],
          },
        },
        required: ['user'],
      };

      const validResult = validator.validate(schema, {
        user: { id: 1, name: 'John' },
      });
      expect(validResult.status).toBe('valid');

      const invalidResult = validator.validate(schema, {
        user: { name: 'John' },
      });
      expect(invalidResult.status).toBe('invalid');
    });

    it('should handle schema compilation errors gracefully', () => {
      // Invalid schema with circular reference would normally fail
      const invalidSchema = { $ref: 'nonexistent' };
      const result = validator.validate(invalidSchema, {});
      // Should not throw, should return invalid status
      expect(result.status).toBe('invalid');
      expect(result.errors?.[0]).toContain('Schema compilation error');
    });
  });

  describe('validateContent', () => {
    it('should return no-schema for undefined schema', () => {
      const result = validator.validateContent(undefined, [
        { type: 'text', text: '{"foo":"bar"}' },
      ]);
      expect(result.status).toBe('no-schema');
    });

    it('should validate JSON content from text', () => {
      const schema = {
        type: 'object',
        properties: {
          result: { type: 'string' },
        },
        required: ['result'],
      };

      const validResult = validator.validateContent(schema, [
        { type: 'text', text: '{"result":"success"}' },
      ]);
      expect(validResult.status).toBe('valid');

      const invalidResult = validator.validateContent(schema, [
        { type: 'text', text: '{"other":"value"}' },
      ]);
      expect(invalidResult.status).toBe('invalid');
    });

    it('should handle non-JSON text content', () => {
      const schema = { type: 'string' };

      const result = validator.validateContent(schema, [
        { type: 'text', text: 'plain text output' },
      ]);
      expect(result.status).toBe('valid');
    });

    it('should return valid for empty content', () => {
      const schema = { type: 'object' };

      const result = validator.validateContent(schema, []);
      expect(result.status).toBe('valid');
    });

    it('should concatenate multiple text items', () => {
      const schema = {
        type: 'object',
        properties: {
          complete: { type: 'boolean' },
        },
      };

      const result = validator.validateContent(schema, [
        { type: 'text', text: '{"com' },
        { type: 'text', text: 'plete":true}' },
      ]);
      expect(result.status).toBe('valid');
    });

    it('should ignore non-text content items', () => {
      const schema = {
        type: 'object',
        properties: {
          data: { type: 'string' },
        },
      };

      const result = validator.validateContent(schema, [
        { type: 'resource', uri: 'file:///test.txt' },
        { type: 'text', text: '{"data":"value"}' },
      ]);
      expect(result.status).toBe('valid');
    });
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const instance1 = getToolOutputValidator();
      const instance2 = getToolOutputValidator();
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getToolOutputValidator();
      resetToolOutputValidator();
      const instance2 = getToolOutputValidator();
      expect(instance1).not.toBe(instance2);
    });
  });
});
