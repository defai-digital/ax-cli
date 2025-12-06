/**
 * Multi Edit Tool Definition - Claude Code Quality
 *
 * Make multiple edits to a single file in one atomic operation.
 */

import type { ToolDefinition } from '../types.js';

export const multiEditTool: ToolDefinition = {
  name: 'multi_edit',
  displayName: 'Multi Edit',

  description: `Make multiple edits to a single file in one atomic operation.

Use this instead of multiple str_replace_editor calls when you need to make several changes to the same file. Edits are applied sequentially and the operation fails entirely if any edit is invalid (all-or-nothing).

Each edit in the array operates on the result of the previous edit. This means:
1. The first edit modifies the original file
2. The second edit operates on the result after the first edit
3. And so on...

This is useful for:
- Making multiple related changes to a file
- Refactoring that requires several coordinated changes
- Adding imports AND using them in the same operation`,

  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to edit',
        format: 'file-path',
      },
      edits: {
        type: 'array',
        description:
          'Array of edits to apply sequentially. Each edit operates on the result of the previous edit.',
        items: {
          type: 'object',
          properties: {
            old_str: {
              type: 'string',
              description: 'Text to replace',
            },
            new_str: {
              type: 'string',
              description: 'Replacement text',
            },
          },
          required: ['old_str', 'new_str'],
        },
      },
    },
    required: ['path', 'edits'],
  },

  usageNotes: [
    'Use when making 2+ changes to the same file',
    'More efficient than multiple str_replace_editor calls',
    'Edits are applied sequentially - order matters!',
    'Later edits operate on the result of earlier edits',
    'All edits succeed or none do (atomic operation)',
    'Always view_file first to see current content',
    'Plan the edit order carefully when edits might affect each other',
  ],

  constraints: [
    'File must exist',
    'All old_str values must be found (in sequence)',
    'If any edit fails, the entire operation is rolled back',
    'Each edit must find its old_str in the content after previous edits',
  ],

  antiPatterns: [
    'Using for a single edit (use str_replace_editor instead)',
    'Not reading the file first',
    'Not considering how earlier edits affect later ones',
    'Edits that conflict or overlap',
  ],

  examples: [
    {
      description: 'Add import and use it',
      scenario: 'Import a function and add a call to it',
      input: {
        path: '/project/src/app.ts',
        edits: [
          {
            old_str: "import { existingFn } from './utils';",
            new_str: `import { existingFn } from './utils';
import { newFn } from './helpers';`,
          },
          {
            old_str: 'existingFn();',
            new_str: `existingFn();
newFn();`,
          },
        ],
      },
      expectedBehavior: 'Adds import and uses the new function',
    },
    {
      description: 'Refactor multiple related items',
      scenario: 'Rename a constant and update its usages',
      input: {
        path: '/project/src/config.ts',
        edits: [
          {
            old_str: 'const OLD_NAME = 100;',
            new_str: 'const NEW_NAME = 100;',
          },
          {
            old_str: 'console.log(OLD_NAME);',
            new_str: 'console.log(NEW_NAME);',
          },
          {
            old_str: 'return OLD_NAME * 2;',
            new_str: 'return NEW_NAME * 2;',
          },
        ],
      },
      expectedBehavior: 'Renames constant and updates all usages atomically',
    },
  ],

  tokenCost: 450,
  safetyLevel: 'moderate',
  requiresConfirmation: false,

  categories: ['file-operations'],
  alternatives: ['str_replace_editor'],
  relatedTools: ['view_file', 'str_replace_editor'],
};
