/**
 * String Replace Editor Tool Definition - Claude Code Quality
 *
 * Edit files with precise string replacement.
 */

import type { ToolDefinition } from '../types.js';

export const strReplaceEditorTool: ToolDefinition = {
  name: 'str_replace_editor',
  displayName: 'String Replace Editor',

  description: `Edit files with precise string replacement.

This tool performs exact string matching and replacement within files. It's the primary way to modify existing files safely and precisely.

The replacement is EXACT - the old_str must match the file content character-for-character, including whitespace and indentation. If old_str appears multiple times and replace_all is false (default), the operation fails to prevent unintended changes.

IMPORTANT: Always use view_file to read the file first before editing. This ensures you have the exact current content and correct indentation.

When copying text from view_file output, ignore the line number prefix. The format is: spaces + line number + tab + actual content. Copy only the content after the tab.`,

  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to edit. Must exist.',
        format: 'file-path',
      },
      old_str: {
        type: 'string',
        description: `Text to replace. Must match EXACTLY including:
- Whitespace (spaces, tabs)
- Line endings
- Indentation
Include enough context to make the match unique. For multi-line replacements, include complete lines.`,
        examples: [
          'const x = 1;',
          'function processData(input) {\n  return input;\n}',
        ],
      },
      new_str: {
        type: 'string',
        description:
          'Replacement text. Must be different from old_str. Preserve original indentation style.',
        examples: [
          'const x = 2;',
          'function processData(input) {\n  // Validate input\n  if (!input) return null;\n  return input;\n}',
        ],
      },
      replace_all: {
        type: 'boolean',
        description:
          'Replace ALL occurrences instead of failing on duplicates. Use for variable/function renaming.',
        default: false,
      },
    },
    required: ['path', 'old_str', 'new_str'],
  },

  usageNotes: [
    'ALWAYS view_file first to see current content and indentation',
    'Match indentation exactly - copy from the file, do not assume',
    'Include enough surrounding context to make old_str unique:',
    '  - Bad: "return true;"  (likely appears multiple times)',
    '  - Good: "function validate(x) {\\n  return true;\\n}"',
    'For multiple changes to the same file, use multi_edit instead',
    'Use replace_all: true for renaming across file (variables, functions, etc.)',
    'Preserve the coding style of the file (tabs vs spaces, semicolons, etc.)',
    'When editing code from view_file output, ignore the line number prefix',
    'The line number format is: spaces + line number + tab + actual content',
    'For large multi-line changes, include the entire block to replace',
  ],

  constraints: [
    'File must exist (cannot create new files - use create_file)',
    'old_str must exist in the file',
    'old_str must be unique unless replace_all is true',
    'new_str must be different from old_str',
    'Must read file with view_file before editing',
    'Cannot use for creating new files (use create_file)',
  ],

  antiPatterns: [
    'Editing without reading the file first',
    'Using bash sed/awk for editing',
    'Making multiple separate edits when multi_edit would work',
    'Guessing indentation instead of copying from file',
    'Using very short old_str that may not be unique',
    'Trying to create a file (use create_file instead)',
  ],

  examples: [
    {
      description: 'Fix a simple bug',
      scenario: 'Change a value in the code',
      input: {
        path: '/project/src/config.ts',
        old_str: 'const MAX_RETRIES = 3;',
        new_str: 'const MAX_RETRIES = 5;',
      },
      expectedBehavior: 'Updates the constant value',
    },
    {
      description: 'Rename a variable across file',
      scenario: 'Rename a variable consistently',
      input: {
        path: '/project/src/utils.ts',
        old_str: 'userData',
        new_str: 'userProfile',
        replace_all: true,
      },
      expectedBehavior: 'Renames all occurrences of userData to userProfile',
    },
    {
      description: 'Add error handling to a function',
      scenario: 'Wrap existing code with try-catch',
      input: {
        path: '/project/src/api.ts',
        old_str: `async function fetchData(url) {
  const response = await fetch(url);
  return response.json();
}`,
        new_str: `async function fetchData(url) {
  try {
    const response = await fetch(url);
    return response.json();
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
}`,
      },
      expectedBehavior: 'Adds try-catch around the function body',
    },
    {
      description: 'Add import statement',
      scenario: 'Add a new import at the top of a file',
      input: {
        path: '/project/src/utils.ts',
        old_str: "import { existingImport } from './existing';",
        new_str: `import { existingImport } from './existing';
import { newImport } from './new';`,
      },
      expectedBehavior: 'Adds new import after existing one',
    },
  ],

  tokenCost: 600,
  safetyLevel: 'moderate',
  requiresConfirmation: false,

  categories: ['file-operations'],
  alternatives: ['multi_edit', 'create_file'],
  relatedTools: ['view_file', 'multi_edit'],
};
