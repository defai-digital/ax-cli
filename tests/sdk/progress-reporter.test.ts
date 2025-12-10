/**
 * Tests for Progress Reporter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ProgressReporter,
  ProgressEventType,
  getProgressReporter,
  type ProgressEvent,
} from "../../packages/core/src/sdk/progress-reporter.js";

describe("Progress Reporter", () => {
  let reporter: ProgressReporter;

  beforeEach(() => {
    ProgressReporter.reset();
    reporter = ProgressReporter.getInstance();
  });

  afterEach(() => {
    ProgressReporter.reset();
  });

  describe("singleton pattern", () => {
    it("should return same instance", () => {
      const instance1 = ProgressReporter.getInstance();
      const instance2 = ProgressReporter.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should return new instance after reset", () => {
      const instance1 = ProgressReporter.getInstance();
      ProgressReporter.reset();
      const instance2 = ProgressReporter.getInstance();
      expect(instance1).not.toBe(instance2);
    });

    it("should remove all listeners on reset", () => {
      const callback = vi.fn();
      reporter.onProgress(callback);
      expect(reporter.listenerCount("progress")).toBe(1);

      ProgressReporter.reset();
      const newReporter = ProgressReporter.getInstance();
      expect(newReporter.listenerCount("progress")).toBe(0);
    });

    it("should handle reset when no instance exists", () => {
      ProgressReporter.reset();
      ProgressReporter.reset(); // Should not throw
    });
  });

  describe("getProgressReporter", () => {
    it("should return the singleton instance", () => {
      const instance = getProgressReporter();
      expect(instance).toBe(reporter);
    });
  });

  describe("report", () => {
    it("should emit progress event with timestamp", () => {
      const callback = vi.fn();
      reporter.onProgress(callback);

      reporter.report({
        type: ProgressEventType.TASK_START,
        agentId: "agent-1",
        name: "test-task",
      });

      expect(callback).toHaveBeenCalledTimes(1);
      const event = callback.mock.calls[0][0] as ProgressEvent;
      expect(event.type).toBe(ProgressEventType.TASK_START);
      expect(event.agentId).toBe("agent-1");
      expect(event.name).toBe("test-task");
      expect(event.timestamp).toBeDefined();
      expect(typeof event.timestamp).toBe("number");
    });

    it("should emit to both progress and type-specific channels", () => {
      const progressCallback = vi.fn();
      const typeCallback = vi.fn();

      reporter.onProgress(progressCallback);
      reporter.onEvent(ProgressEventType.TASK_COMPLETE, typeCallback);

      reporter.report({
        type: ProgressEventType.TASK_COMPLETE,
        agentId: "agent-1",
        name: "task",
      });

      expect(progressCallback).toHaveBeenCalledTimes(1);
      expect(typeCallback).toHaveBeenCalledTimes(1);
    });

    it("should deep copy metadata to prevent mutation", () => {
      const callback = vi.fn();
      reporter.onProgress(callback);

      const metadata = { nested: { value: "original" } };
      reporter.report({
        type: ProgressEventType.STATUS_UPDATE,
        agentId: "agent-1",
        name: "status",
        metadata,
      });

      // Modify original metadata
      metadata.nested.value = "modified";

      // Event should have original value (deep copy)
      const event = callback.mock.calls[0][0] as ProgressEvent;
      expect(event.metadata?.nested).toEqual({ value: "original" });
    });

    it("should provide separate event objects to each channel", () => {
      const progressCallback = vi.fn();
      const typeCallback = vi.fn();

      reporter.onProgress(progressCallback);
      reporter.onEvent(ProgressEventType.TASK_START, typeCallback);

      reporter.report({
        type: ProgressEventType.TASK_START,
        agentId: "agent-1",
        name: "task",
        metadata: { key: "value" },
      });

      // Mutate event received by progress callback
      const progressEvent = progressCallback.mock.calls[0][0] as ProgressEvent;
      progressEvent.metadata!.key = "mutated";

      // Type callback should have unmutated metadata
      const typeEvent = typeCallback.mock.calls[0][0] as ProgressEvent;
      expect(typeEvent.metadata!.key).toBe("value");
    });

    describe("validation", () => {
      it("should throw for missing agentId", () => {
        expect(() =>
          reporter.report({
            type: ProgressEventType.TASK_START,
            agentId: "",
            name: "task",
          })
        ).toThrow("agentId is required");
      });

      it("should throw for non-string agentId", () => {
        expect(() =>
          reporter.report({
            type: ProgressEventType.TASK_START,
            agentId: 123 as unknown as string,
            name: "task",
          })
        ).toThrow("agentId is required and must be a string");
      });

      it("should throw for missing name", () => {
        expect(() =>
          reporter.report({
            type: ProgressEventType.TASK_START,
            agentId: "agent-1",
            name: "",
          })
        ).toThrow("name is required");
      });

      it("should throw for non-string name", () => {
        expect(() =>
          reporter.report({
            type: ProgressEventType.TASK_START,
            agentId: "agent-1",
            name: null as unknown as string,
          })
        ).toThrow("name is required and must be a string");
      });

      it("should throw for invalid type", () => {
        expect(() =>
          reporter.report({
            type: "invalid" as ProgressEventType,
            agentId: "agent-1",
            name: "task",
          })
        ).toThrow("type is required and must be a valid ProgressEventType");
      });

      it("should throw for missing type", () => {
        expect(() =>
          reporter.report({
            type: undefined as unknown as ProgressEventType,
            agentId: "agent-1",
            name: "task",
          })
        ).toThrow("type is required");
      });
    });
  });

  describe("taskStart", () => {
    it("should report task start event", () => {
      const callback = vi.fn();
      reporter.onEvent(ProgressEventType.TASK_START, callback);

      reporter.taskStart("agent-1", "my-task", "Starting task");

      expect(callback).toHaveBeenCalledTimes(1);
      const event = callback.mock.calls[0][0] as ProgressEvent;
      expect(event.type).toBe(ProgressEventType.TASK_START);
      expect(event.agentId).toBe("agent-1");
      expect(event.name).toBe("my-task");
      expect(event.message).toBe("Starting task");
      expect(event.progress).toBe(0);
    });

    it("should work without message", () => {
      const callback = vi.fn();
      reporter.onEvent(ProgressEventType.TASK_START, callback);

      reporter.taskStart("agent-1", "task");

      const event = callback.mock.calls[0][0] as ProgressEvent;
      expect(event.message).toBeUndefined();
    });
  });

  describe("taskProgress", () => {
    it("should report task progress event", () => {
      const callback = vi.fn();
      reporter.onEvent(ProgressEventType.TASK_PROGRESS, callback);

      reporter.taskProgress("agent-1", "task", 50, "Halfway done");

      expect(callback).toHaveBeenCalledTimes(1);
      const event = callback.mock.calls[0][0] as ProgressEvent;
      expect(event.type).toBe(ProgressEventType.TASK_PROGRESS);
      expect(event.progress).toBe(50);
      expect(event.message).toBe("Halfway done");
    });

    it("should clamp progress to 0-100 range", () => {
      const callback = vi.fn();
      reporter.onEvent(ProgressEventType.TASK_PROGRESS, callback);

      reporter.taskProgress("agent-1", "task", -10);
      expect((callback.mock.calls[0][0] as ProgressEvent).progress).toBe(0);

      reporter.taskProgress("agent-1", "task", 150);
      expect((callback.mock.calls[1][0] as ProgressEvent).progress).toBe(100);
    });

    it("should default to 0 for NaN progress", () => {
      const callback = vi.fn();
      reporter.onEvent(ProgressEventType.TASK_PROGRESS, callback);

      reporter.taskProgress("agent-1", "task", NaN);

      expect((callback.mock.calls[0][0] as ProgressEvent).progress).toBe(0);
    });

    it("should default to 0 for Infinity progress", () => {
      const callback = vi.fn();
      reporter.onEvent(ProgressEventType.TASK_PROGRESS, callback);

      reporter.taskProgress("agent-1", "task", Infinity);

      expect((callback.mock.calls[0][0] as ProgressEvent).progress).toBe(0);
    });

    it("should default to 0 for non-number progress", () => {
      const callback = vi.fn();
      reporter.onEvent(ProgressEventType.TASK_PROGRESS, callback);

      reporter.taskProgress("agent-1", "task", "50" as unknown as number);

      expect((callback.mock.calls[0][0] as ProgressEvent).progress).toBe(0);
    });
  });

  describe("taskComplete", () => {
    it("should report task complete event with progress 100", () => {
      const callback = vi.fn();
      reporter.onEvent(ProgressEventType.TASK_COMPLETE, callback);

      reporter.taskComplete("agent-1", "task", "Task finished");

      const event = callback.mock.calls[0][0] as ProgressEvent;
      expect(event.type).toBe(ProgressEventType.TASK_COMPLETE);
      expect(event.progress).toBe(100);
      expect(event.message).toBe("Task finished");
    });
  });

  describe("taskError", () => {
    it("should report task error event", () => {
      const callback = vi.fn();
      reporter.onEvent(ProgressEventType.TASK_ERROR, callback);

      reporter.taskError("agent-1", "task", "Something went wrong");

      const event = callback.mock.calls[0][0] as ProgressEvent;
      expect(event.type).toBe(ProgressEventType.TASK_ERROR);
      expect(event.message).toBe("Something went wrong");
    });
  });

  describe("toolStart", () => {
    it("should report tool start event", () => {
      const callback = vi.fn();
      reporter.onEvent(ProgressEventType.TOOL_START, callback);

      reporter.toolStart("agent-1", "bash", "Running command");

      const event = callback.mock.calls[0][0] as ProgressEvent;
      expect(event.type).toBe(ProgressEventType.TOOL_START);
      expect(event.name).toBe("bash");
      expect(event.message).toBe("Running command");
    });
  });

  describe("toolComplete", () => {
    it("should report tool complete event", () => {
      const callback = vi.fn();
      reporter.onEvent(ProgressEventType.TOOL_COMPLETE, callback);

      reporter.toolComplete("agent-1", "bash", "Command completed");

      const event = callback.mock.calls[0][0] as ProgressEvent;
      expect(event.type).toBe(ProgressEventType.TOOL_COMPLETE);
      expect(event.name).toBe("bash");
      expect(event.message).toBe("Command completed");
    });
  });

  describe("statusUpdate", () => {
    it("should report status update event", () => {
      const callback = vi.fn();
      reporter.onEvent(ProgressEventType.STATUS_UPDATE, callback);

      reporter.statusUpdate("agent-1", "Processing files", { count: 10 });

      const event = callback.mock.calls[0][0] as ProgressEvent;
      expect(event.type).toBe(ProgressEventType.STATUS_UPDATE);
      expect(event.name).toBe("status");
      expect(event.message).toBe("Processing files");
      expect(event.metadata).toEqual({ count: 10 });
    });

    it("should work without metadata", () => {
      const callback = vi.fn();
      reporter.onEvent(ProgressEventType.STATUS_UPDATE, callback);

      reporter.statusUpdate("agent-1", "Simple status");

      const event = callback.mock.calls[0][0] as ProgressEvent;
      expect(event.metadata).toBeUndefined();
    });
  });

  describe("onProgress", () => {
    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = reporter.onProgress(callback);

      reporter.taskStart("agent-1", "task");
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      reporter.taskStart("agent-1", "task2");
      expect(callback).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe("onEvent", () => {
    it("should subscribe to specific event type", () => {
      const startCallback = vi.fn();
      const completeCallback = vi.fn();

      reporter.onEvent(ProgressEventType.TASK_START, startCallback);
      reporter.onEvent(ProgressEventType.TASK_COMPLETE, completeCallback);

      reporter.taskStart("agent-1", "task");

      expect(startCallback).toHaveBeenCalledTimes(1);
      expect(completeCallback).toHaveBeenCalledTimes(0);
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = reporter.onEvent(ProgressEventType.TASK_START, callback);

      reporter.taskStart("agent-1", "task");
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      reporter.taskStart("agent-1", "task2");
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("getStats", () => {
    it("should return listener count and max listeners", () => {
      const stats = reporter.getStats();

      expect(stats.listenerCount).toBe(0);
      expect(stats.maxListeners).toBe(50);
    });

    it("should update listener count when subscribed", () => {
      reporter.onProgress(() => {});
      reporter.onProgress(() => {});

      const stats = reporter.getStats();
      expect(stats.listenerCount).toBe(2);
    });
  });

  describe("ProgressEventType enum", () => {
    it("should have all expected values", () => {
      expect(ProgressEventType.TASK_START).toBe("task_start");
      expect(ProgressEventType.TASK_PROGRESS).toBe("task_progress");
      expect(ProgressEventType.TASK_COMPLETE).toBe("task_complete");
      expect(ProgressEventType.TASK_ERROR).toBe("task_error");
      expect(ProgressEventType.TOOL_START).toBe("tool_start");
      expect(ProgressEventType.TOOL_COMPLETE).toBe("tool_complete");
      expect(ProgressEventType.STATUS_UPDATE).toBe("status_update");
    });
  });
});
