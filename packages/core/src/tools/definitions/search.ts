/**
 * Search Tool Definition - Claude Code Quality
 *
 * Unified search tool for finding text content or files in the codebase.
 */

import type { ToolDefinition } from '../types.js';

export const searchTool: ToolDefinition = {
  name: 'search',
  displayName: 'Search',

  description: `Unified search tool for finding text content or files in the codebase.

This tool combines text search (like grep/ripgrep) and file search (like find) into a single interface. It's powered by ripgrep for fast, accurate results.

Use this tool instead of bash grep/find/rg commands. It's faster, safer, and integrated with the agent workflow.

Search types:
- "text": Search file CONTENTS for matching text/patterns
- "files": Search file NAMES/PATHS matching pattern
- "both": Search both content and file names (default)

Results are sorted by relevance and common directories like node_modules are excluded by default.`,

  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Search pattern. Can be literal text or regex (set regex: true).',
        examples: ['TODO', 'function.*export', 'class UserService', '*.test.ts'],
      },
      search_type: {
        type: 'string',
        enum: ['text', 'files', 'both'],
        description:
          'Type of search. "text" for content, "files" for names, "both" for both.',
        default: 'both',
      },
      include_pattern: {
        type: 'string',
        description: 'Glob pattern for files to include. Example: "*.ts", "src/**/*.js"',
        examples: ['*.ts', '*.{js,jsx}', 'src/**/*'],
      },
      exclude_pattern: {
        type: 'string',
        description:
          'Glob pattern for files to exclude. Example: "*.log", "node_modules"',
        examples: ['*.log', 'node_modules', 'dist', '*.min.js'],
      },
      case_sensitive: {
        type: 'boolean',
        description: 'Whether search is case-sensitive.',
        default: false,
      },
      whole_word: {
        type: 'boolean',
        description: 'Match whole words only.',
        default: false,
      },
      regex: {
        type: 'boolean',
        description: 'Treat query as regular expression.',
        default: false,
      },
      max_results: {
        type: 'number',
        description: 'Maximum results to return.',
        default: 50,
        constraints: ['Must be between 1 and 500'],
      },
      file_types: {
        type: 'array',
        description:
          'File extensions to search (without dot). Example: ["ts", "js", "py"]',
        examples: [['ts', 'tsx'], ['py'], ['js', 'jsx', 'ts', 'tsx']],
        items: {
          type: 'string',
        },
      },
      include_hidden: {
        type: 'boolean',
        description: 'Include hidden files (starting with dot).',
        default: false,
      },
    },
    required: ['query'],
  },

  usageNotes: [
    'Always use this instead of bash grep/find/rg',
    'Default search_type "both" searches content AND file names',
    'Use include_pattern to narrow down to specific file types',
    'Common patterns:',
    '  - Find function: search("function myFunction")',
    '  - Find files: search("*.test.ts", { search_type: "files" })',
    '  - Find in specific files: search("TODO", { include_pattern: "*.ts" })',
    'For complex regex, set regex: true',
    'Results are sorted by relevance',
    'node_modules and common build directories are excluded by default',
    'Use file_types for common extensions instead of include_pattern',
  ],

  constraints: [
    'Does not search binary files',
    'node_modules excluded by default',
    'Max 500 results per search',
    'Very large files may be partially searched',
    'Regex patterns must be valid ripgrep syntax',
  ],

  antiPatterns: [
    'Using bash grep instead of search',
    'Using bash find instead of search',
    'Using bash rg instead of search',
    'Searching without specifying file types for large codebases',
  ],

  examples: [
    {
      description: 'Find TODO comments',
      scenario: 'Locate all TODO items in the codebase',
      input: { query: 'TODO', search_type: 'text' },
      expectedBehavior:
        'Returns all lines containing TODO with file paths and line numbers',
    },
    {
      description: 'Find test files',
      scenario: 'Locate all test files in the project',
      input: { query: '*.test.ts', search_type: 'files' },
      expectedBehavior: 'Returns paths to all .test.ts files',
    },
    {
      description: 'Find function definition',
      scenario: 'Locate where a specific function is defined',
      input: {
        query: 'function processPayment',
        search_type: 'text',
        include_pattern: '*.ts',
      },
      expectedBehavior: 'Returns file and line where processPayment is defined',
    },
    {
      description: 'Find class usage with regex',
      scenario: 'Find all instantiations of a class',
      input: {
        query: 'new UserService\\(',
        regex: true,
        search_type: 'text',
      },
      expectedBehavior: 'Returns all places where UserService is instantiated',
    },
    {
      description: 'Search in specific file types',
      scenario: 'Find imports in TypeScript files only',
      input: {
        query: "import.*from 'react'",
        regex: true,
        file_types: ['ts', 'tsx'],
      },
      expectedBehavior: 'Returns all React imports in TypeScript files',
    },
  ],

  tokenCost: 550,
  safetyLevel: 'safe',
  requiresConfirmation: false,

  categories: ['search'],
  alternatives: [],
  relatedTools: ['view_file'],
};
