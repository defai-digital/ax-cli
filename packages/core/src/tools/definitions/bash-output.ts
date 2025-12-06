/**
 * Bash Output Tool Definition - Claude Code Quality
 *
 * Get output from background bash tasks.
 */

import type { ToolDefinition } from '../types.js';

export const bashOutputTool: ToolDefinition = {
  name: 'bash_output',
  displayName: 'Bash Output',

  description: `Get output from a background bash task.

Use this tool after running a command with ' &' suffix or background: true. It retrieves the stdout/stderr output from the background process.

Background tasks run independently and continue even if the agent session ends. Use this tool to:
- Check if a background task is still running
- Get incremental output from long-running processes
- Wait for a background task to complete and get final output`,

  parameters: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description:
          'The background task ID returned when starting a background command',
        examples: ['task-12345', 'bg-npm-dev-001'],
      },
      wait: {
        type: 'boolean',
        description:
          'Wait for task to complete before returning output. If false, returns current output immediately.',
        default: false,
      },
      timeout: {
        type: 'number',
        description:
          'Maximum time to wait in milliseconds if wait is true. Default: 120000 (2 min).',
        default: 120000,
        constraints: ['Must be between 1 and 600000'],
      },
    },
    required: ['task_id'],
  },

  usageNotes: [
    'Use after starting a background task with bash tool',
    'Set wait: true to block until the task completes',
    'Without wait, returns immediately with current output',
    'Returns both stdout and stderr from the process',
    'Check the status field to see if task is still running',
    'For long-running servers, call periodically to check logs',
  ],

  constraints: [
    'task_id must be a valid ID from a previous background bash command',
    'Cannot cancel or kill background tasks (they run until completion)',
    'Large outputs may be truncated',
  ],

  antiPatterns: [
    'Using without first starting a background task',
    'Calling with invalid or expired task_id',
    'Setting very long timeout for tasks that may never complete',
  ],

  examples: [
    {
      description: 'Check background task status',
      scenario: 'See output from a running dev server',
      input: { task_id: 'task-12345' },
      expectedBehavior: 'Returns current output and running status',
    },
    {
      description: 'Wait for task completion',
      scenario: 'Wait for a build to finish',
      input: { task_id: 'task-build-001', wait: true, timeout: 300000 },
      expectedBehavior: 'Blocks until build completes, returns full output',
    },
  ],

  tokenCost: 300,
  safetyLevel: 'safe',
  requiresConfirmation: false,

  categories: ['command-execution'],
  alternatives: [],
  relatedTools: ['bash'],
};
