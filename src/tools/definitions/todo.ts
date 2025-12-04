/**
 * Todo Tools Definition - Claude Code Quality
 *
 * Create and update task lists for planning and tracking work.
 */

import type { ToolDefinition } from '../types.js';

export const createTodoListTool: ToolDefinition = {
  name: 'create_todo_list',
  displayName: 'Create Todo List',

  description: `Create a structured task list for planning and tracking work.

Use this tool for complex tasks that require multiple steps. It helps you:
- Plan work systematically
- Track progress visibly
- Communicate status to the user
- Stay organized on multi-step tasks

WHEN TO USE:
- Tasks with 3+ distinct steps
- Complex features requiring planning
- User explicitly requests a todo list
- Multiple independent tasks to complete

WHEN NOT TO USE:
- Single, simple tasks
- Tasks completable in 1-2 steps
- Purely informational questions

Create the todo list at the START of a multi-step task, then use update_todo_list as you complete each item.`,

  parameters: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: 'Array of todo items to create',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier (e.g., "1", "auth-1", "step-1")',
            },
            content: {
              type: 'string',
              description: 'Clear, actionable task description',
            },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'completed'],
              description:
                'Current status. Start most as "pending", one as "in_progress"',
            },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'Task priority for ordering',
            },
          },
          required: ['id', 'content', 'status', 'priority'],
        },
      },
    },
    required: ['todos'],
  },

  usageNotes: [
    'Create todos at the START of a multi-step task',
    'Have exactly ONE task as in_progress at any time',
    'Mark tasks completed IMMEDIATELY when done (do not batch)',
    'Tasks should be specific and actionable:',
    '  - Bad: "Fix bugs"',
    '  - Good: "Fix null pointer in UserService.getUser()"',
    'Use priority to indicate execution order',
    'Each task needs content (what) and could have notes (how)',
    'Update todo list as you complete each task with update_todo_list',
  ],

  constraints: [
    'Do not create todos for single simple tasks',
    'Only one task should be in_progress at a time',
    'Task IDs must be unique',
    'Mark completed immediately, not in batches',
  ],

  antiPatterns: [
    'Creating todos for trivial single-step tasks',
    'Having multiple tasks in_progress simultaneously',
    'Batching completion updates instead of updating immediately',
    'Using vague task descriptions',
  ],

  examples: [
    {
      description: 'Plan a feature implementation',
      scenario: 'User asks to add dark mode to the app',
      input: {
        todos: [
          {
            id: '1',
            content: 'Add theme context and provider',
            status: 'in_progress',
            priority: 'high',
          },
          {
            id: '2',
            content: 'Create dark mode CSS variables',
            status: 'pending',
            priority: 'high',
          },
          {
            id: '3',
            content: 'Add toggle component to settings',
            status: 'pending',
            priority: 'medium',
          },
          {
            id: '4',
            content: 'Persist theme preference',
            status: 'pending',
            priority: 'medium',
          },
          {
            id: '5',
            content: 'Test theme switching',
            status: 'pending',
            priority: 'low',
          },
        ],
      },
      expectedBehavior: 'Creates a todo list with planned implementation steps',
    },
    {
      description: 'Plan bug fix investigation',
      scenario: 'User reports a complex bug to fix',
      input: {
        todos: [
          {
            id: '1',
            content: 'Reproduce the bug locally',
            status: 'in_progress',
            priority: 'high',
          },
          {
            id: '2',
            content: 'Identify root cause',
            status: 'pending',
            priority: 'high',
          },
          {
            id: '3',
            content: 'Implement fix',
            status: 'pending',
            priority: 'high',
          },
          {
            id: '4',
            content: 'Add regression test',
            status: 'pending',
            priority: 'medium',
          },
        ],
      },
      expectedBehavior: 'Creates a todo list for bug investigation and fix',
    },
  ],

  tokenCost: 700,
  safetyLevel: 'safe',
  requiresConfirmation: false,

  categories: ['task-management'],
  alternatives: [],
  relatedTools: ['update_todo_list'],
};

export const updateTodoListTool: ToolDefinition = {
  name: 'update_todo_list',
  displayName: 'Update Todo List',

  description: `Update status or content of existing todo items.

Use this to mark tasks complete, update status, or modify task descriptions as work progresses.

IMPORTANT: Update todos IMMEDIATELY when completing a task - do not batch updates. When marking a task complete, also set the next task to in_progress.`,

  parameters: {
    type: 'object',
    properties: {
      updates: {
        type: 'array',
        description: 'Array of updates to apply',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID of the todo item to update',
            },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'completed'],
              description: 'New status',
            },
            content: {
              type: 'string',
              description: 'New content (optional)',
            },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'New priority (optional)',
            },
          },
          required: ['id'],
        },
      },
    },
    required: ['updates'],
  },

  usageNotes: [
    'Update status IMMEDIATELY when completing a task',
    'When marking complete, also set next task to in_progress',
    'Do not batch status updates - update as you complete',
    'Only one task should be in_progress at a time',
    'Can update content if task scope changes',
    'Can update priority if priorities shift',
  ],

  constraints: [
    'Task ID must exist in the todo list',
    'Do not batch multiple completions',
    'Keep exactly one task in_progress',
  ],

  antiPatterns: [
    'Waiting to batch completion updates',
    'Having zero or multiple in_progress tasks',
    'Updating tasks that do not exist',
  ],

  examples: [
    {
      description: 'Complete a task and start next',
      scenario: 'Finished first task, moving to second',
      input: {
        updates: [
          { id: '1', status: 'completed' },
          { id: '2', status: 'in_progress' },
        ],
      },
      expectedBehavior: 'Marks task 1 complete and task 2 in progress',
    },
    {
      description: 'Update task content',
      scenario: 'Task scope changed during work',
      input: {
        updates: [
          {
            id: '3',
            content: 'Add toggle component with animation',
            priority: 'high',
          },
        ],
      },
      expectedBehavior: 'Updates task content and priority',
    },
  ],

  tokenCost: 400,
  safetyLevel: 'safe',
  requiresConfirmation: false,

  categories: ['task-management'],
  alternatives: [],
  relatedTools: ['create_todo_list'],
};
