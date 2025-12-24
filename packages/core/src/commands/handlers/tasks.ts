/**
 * Task Command Handlers
 *
 * Handlers for /tasks, /task, /kill - background task management
 *
 * @packageDocumentation
 */

import type { CommandDefinition, CommandContext, CommandResult } from "../types.js";
import { BashOutputTool } from "../../tools/bash-output.js";

/**
 * /tasks command handler - list all background tasks
 */
export function handleTasks(_args: string, _ctx: CommandContext): CommandResult {
  const bashOutputTool = new BashOutputTool();
  const result = bashOutputTool.listTasks();

  return {
    handled: true,
    entries: [
      {
        type: "assistant",
        content: result.output || "No background tasks",
        timestamp: new Date(),
      },
    ],
    clearInput: true,
  };
}

/**
 * /task <id> command handler - view output of a background task
 */
export async function handleTask(args: string, _ctx: CommandContext): Promise<CommandResult> {
  const taskId = args.trim();

  if (!taskId) {
    return {
      handled: true,
      entries: [
        {
          type: "assistant",
          content: "Usage: /task <task_id>\n\nUse /tasks to see available task IDs.",
          timestamp: new Date(),
        },
      ],
      clearInput: true,
    };
  }

  const bashOutputTool = new BashOutputTool();
  const result = await bashOutputTool.execute(taskId);

  return {
    handled: true,
    entries: [
      {
        type: "assistant",
        content: result.success
          ? result.output || "No output"
          : result.error || "Task not found",
        timestamp: new Date(),
      },
    ],
    clearInput: true,
  };
}

/**
 * /kill <id> command handler - kill a running background task
 */
export function handleKill(args: string, _ctx: CommandContext): CommandResult {
  const taskId = args.trim();

  if (!taskId) {
    return {
      handled: true,
      entries: [
        {
          type: "assistant",
          content: "Usage: /kill <task_id>\n\nUse /tasks to see available task IDs.",
          timestamp: new Date(),
        },
      ],
      clearInput: true,
    };
  }

  const bashOutputTool = new BashOutputTool();
  const result = bashOutputTool.killTask(taskId);

  return {
    handled: true,
    entries: [
      {
        type: "assistant",
        content: result.success
          ? result.output || "Task killed"
          : result.error || "Failed to kill task",
        timestamp: new Date(),
      },
    ],
    clearInput: true,
  };
}

/**
 * Task command definitions for registration
 */
export const taskCommands: CommandDefinition[] = [
  {
    name: "tasks",
    description: "List all background tasks",
    category: "tasks",
    handler: handleTasks,
  },
  {
    name: "task",
    description: "View output of a background task",
    category: "tasks",
    handler: handleTask,
    requiresArgs: true,
    examples: ["/task abc123"],
  },
  {
    name: "kill",
    description: "Kill a running background task",
    category: "tasks",
    handler: handleKill,
    requiresArgs: true,
    examples: ["/kill abc123"],
  },
];
