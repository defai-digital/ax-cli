/**
 * Create File Tool Definition - Claude Code Quality
 *
 * Create a new file or overwrite an existing file with specified content.
 */

import type { ToolDefinition } from '../types.js';

export const createFileTool: ToolDefinition = {
  name: 'create_file',
  displayName: 'Create File',

  description: `Create a new file or overwrite an existing file with specified content.

This tool writes content to a file path. If the file exists, it will be OVERWRITTEN. If parent directories don't exist, they will be created automatically.

IMPORTANT: For modifying existing files, prefer str_replace_editor. This tool is for:
- Creating new files from scratch
- Complete file rewrites when editing is impractical

When creating code files, match the project's coding style (indentation, quotes, semicolons, etc.) and include all necessary imports and complete implementations.`,

  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description:
          'Path where the file should be created. Parent directories are created if needed.',
        format: 'file-path',
        examples: ['/project/src/utils/format.ts', './config.json'],
      },
      content: {
        type: 'string',
        description:
          'Complete content to write to the file. Include all necessary code, imports, etc.',
      },
    },
    required: ['path', 'content'],
  },

  usageNotes: [
    'Creates parent directories automatically if they do not exist',
    'Prefer str_replace_editor for modifying existing files',
    'For existing files, use view_file first to understand current content',
    'Do NOT create documentation files (README, etc.) unless explicitly requested',
    'Do NOT use emojis in file content unless explicitly requested',
    'Match the coding style of the project (indentation, quotes, etc.)',
    'Include complete, working code - not stubs or placeholders',
    'Always include necessary imports at the top of the file',
    'Add appropriate file headers/comments if the project uses them',
  ],

  constraints: [
    'OVERWRITES existing files without warning',
    'For existing files, view_file should be called first to understand context',
    'Avoid creating files that duplicate existing functionality',
    'Do not create unnecessary configuration files',
    'Do not create test files unless explicitly requested',
  ],

  antiPatterns: [
    'Using bash echo/cat to create files',
    'Creating files when editing would suffice',
    'Creating documentation without being asked',
    'Creating placeholder/stub files',
    'Creating files that duplicate existing patterns',
    'Overwriting files without reading them first',
  ],

  examples: [
    {
      description: 'Create a new utility file',
      scenario: 'Add a new helper function file',
      input: {
        path: '/project/src/utils/format.ts',
        content: `/**
 * Format utilities
 */

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
`,
      },
      expectedBehavior: 'Creates format.ts with the utility functions',
    },
    {
      description: 'Create a test file',
      scenario: 'Add tests for an existing module',
      input: {
        path: '/project/src/utils/format.test.ts',
        content: `import { formatCurrency, formatDate } from './format';

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });
});

describe('formatDate', () => {
  it('formats date as ISO string', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    expect(formatDate(date)).toBe('2024-01-15');
  });
});
`,
      },
      expectedBehavior: 'Creates format.test.ts with test cases',
    },
    {
      description: 'Create a configuration file',
      scenario: 'Add a new JSON configuration',
      input: {
        path: '/project/config/settings.json',
        content: `{
  "apiEndpoint": "https://api.example.com",
  "timeout": 30000,
  "retries": 3
}
`,
      },
      expectedBehavior: 'Creates settings.json with configuration',
    },
  ],

  tokenCost: 400,
  safetyLevel: 'moderate',
  requiresConfirmation: false,

  categories: ['file-operations'],
  alternatives: ['str_replace_editor'],
  relatedTools: ['view_file', 'str_replace_editor'],
};
