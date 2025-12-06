/**
 * View File Tool Definition - Claude Code Quality
 *
 * Read and display file contents or directory listings.
 */

import type { ToolDefinition } from '../types.js';

export const viewFileTool: ToolDefinition = {
  name: 'view_file',
  displayName: 'View File',

  description: `Read and display file contents or directory listings.

This tool reads files from the local filesystem and displays their contents with line numbers. It can also list directory contents when given a directory path.

For files:
- Displays content with line numbers (1-indexed)
- Supports partial reading with start_line/end_line
- Handles text files, images, PDFs, and Jupyter notebooks
- Lines over 2000 characters are truncated

For directories:
- Lists files and subdirectories
- Shows file types and sizes
- Respects .gitignore patterns

IMPORTANT: Always use this tool to read a file BEFORE attempting to edit it. This ensures you have the exact current content and correct indentation for str_replace_editor.`,

  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description:
          'Absolute or relative path to file or directory. Use absolute paths for reliability.',
        format: 'file-path',
        examples: ['/project/src/index.ts', 'package.json', './src/'],
      },
      start_line: {
        type: 'number',
        description:
          'Starting line number for partial file view (1-indexed). Only for files.',
        constraints: ['Must be >= 1', 'Must be <= end_line if end_line is specified'],
      },
      end_line: {
        type: 'number',
        description:
          'Ending line number for partial file view (inclusive). Only for files.',
        constraints: ['Must be >= start_line'],
      },
    },
    required: ['path'],
  },

  usageNotes: [
    'ALWAYS read a file before attempting to edit it with str_replace_editor',
    'Use absolute paths for reliability across different working directories',
    'For large files, use start_line/end_line to read specific sections',
    'When viewing a directory, returns a listing instead of contents',
    'Supports various file types:',
    '  - Text files: displayed with line numbers',
    '  - Images (PNG, JPG, etc.): displayed visually',
    '  - PDFs: extracted text and visual content',
    '  - Jupyter notebooks (.ipynb): cells with outputs',
    '  - Binary files: shows file type information',
    'Line numbers in output start at 1, matching editor conventions',
    'Empty files return a system reminder warning',
    'When editing code from view_file output, copy the exact content after the line number prefix',
  ],

  constraints: [
    'Cannot modify files (use str_replace_editor or create_file)',
    'Do not view potentially sensitive files unless necessary:',
    '  - .env files with secrets',
    '  - credential files',
    '  - private keys',
    'Lines over 2000 characters are truncated',
    'Maximum default read is 2000 lines from start',
  ],

  antiPatterns: [
    'Using bash cat/head/tail instead of view_file',
    'Modifying files (use str_replace_editor instead)',
    'Creating files (use create_file instead)',
    'Viewing binary files expecting text content',
    'Editing without reading first',
  ],

  examples: [
    {
      description: 'Read entire file',
      scenario: 'Understand a source file before editing',
      input: { path: '/project/src/utils.ts' },
      expectedBehavior: 'Returns file contents with line numbers',
    },
    {
      description: 'Read specific lines',
      scenario: 'Focus on a particular function or section',
      input: { path: '/project/src/utils.ts', start_line: 50, end_line: 75 },
      expectedBehavior: 'Returns lines 50-75 with line numbers',
    },
    {
      description: 'List directory contents',
      scenario: 'Explore project structure',
      input: { path: '/project/src/' },
      expectedBehavior: 'Returns listing of files and directories',
    },
    {
      description: 'Read package.json',
      scenario: 'Check project dependencies and scripts',
      input: { path: 'package.json' },
      expectedBehavior: 'Returns package.json contents',
    },
  ],

  tokenCost: 500,
  safetyLevel: 'safe',
  requiresConfirmation: false,

  categories: ['file-operations'],
  alternatives: [],
  relatedTools: ['str_replace_editor', 'create_file', 'search'],
};
