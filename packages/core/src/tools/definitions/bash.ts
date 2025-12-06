/**
 * Bash Tool Definition - Claude Code Quality
 *
 * Execute bash commands in a persistent shell session with timeout control
 * and security measures.
 */

import type { ToolDefinition } from '../types.js';

export const bashTool: ToolDefinition = {
  name: 'bash',
  displayName: 'Bash',

  description: `Execute bash commands in a persistent shell session with timeout control and security measures.

This tool is for terminal operations like git, npm, docker, system commands, and process management. Each invocation runs in the same shell environment, preserving environment variables and working directory between calls.

IMPORTANT: This tool is for COMMAND EXECUTION only. Do NOT use it for:
- Reading files (use view_file instead)
- Editing files (use str_replace_editor or create_file instead)
- Searching files (use search instead)
- Directory listing (use view_file with a directory path)

The shell supports background processes using the ' &' suffix or background: true parameter. Background tasks return a task_id that can be monitored with bash_output.

Before executing commands that create directories or files, verify the parent directory exists using view_file. Always quote file paths containing spaces with double quotes.`,

  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: `The bash command to execute.
- Quote file paths containing spaces with double quotes
- Use && to chain dependent commands
- Use ; to chain independent commands
- Append ' &' or use background: true for background execution`,
        examples: [
          'npm test',
          'git status && git diff',
          'npm run dev &',
          'cd "/path/with spaces" && ls',
        ],
      },
      background: {
        type: 'boolean',
        description:
          'Run command in background. Returns task_id for monitoring with bash_output. Equivalent to appending " &" to command.',
        default: false,
      },
      timeout: {
        type: 'number',
        description:
          'Timeout in milliseconds. Default: 120000 (2 min). Max: 600000 (10 min). Ignored for background commands.',
        default: 120000,
        constraints: ['Must be between 1 and 600000'],
      },
    },
    required: ['command'],
  },

  usageNotes: [
    'Prefer specialized tools over bash for file operations:',
    '  - File reading: Use view_file (NOT cat, head, tail)',
    '  - File editing: Use str_replace_editor (NOT sed, awk)',
    '  - File creation: Use create_file (NOT echo >, cat <<EOF)',
    '  - File search: Use search (NOT grep, find, rg)',
    '  - Directory listing: Use view_file with directory path (NOT ls)',
    'Commands can be chained:',
    '  - Use && for dependent commands (second runs only if first succeeds)',
    '  - Use ; for independent commands (both run regardless)',
    '  - Use | for piping output',
    'Background execution:',
    '  - Append " &" or set background: true for long-running processes',
    '  - Use bash_output with task_id to check output',
    '  - Background tasks continue even if agent session ends',
    'Output handling:',
    '  - Output over 30000 characters is truncated',
    '  - Use output redirection (> file) for large outputs',
    'Environment:',
    '  - Shell session is persistent across invocations',
    '  - Environment variables and working directory are preserved',
    '  - Use cd sparingly; prefer absolute paths',
    'For git commits, use HEREDOC format for multi-line messages:',
    '  git commit -m "$(cat <<\'EOF\'\\nmessage here\\nEOF\\n)"',
  ],

  constraints: [
    'NEVER execute destructive commands without explicit user confirmation:',
    '  - rm -rf on system directories',
    '  - git push --force to main/master',
    '  - Database drop/delete operations',
    '  - System modification commands (mkfs, dd)',
    'NEVER use interactive flags that require user input:',
    '  - git rebase -i (use non-interactive alternatives)',
    '  - git add -i (use git add directly)',
    '  - Any command with -i that expects keyboard input',
    'NEVER expose secrets in command output:',
    '  - Avoid printing environment variables with secrets',
    '  - Use --quiet flags when credentials might appear',
    'NEVER skip safety mechanisms:',
    '  - git push with --no-verify unless explicitly requested',
    '  - Commands that bypass confirmation prompts',
  ],

  antiPatterns: [
    'Reading file contents with cat/head/tail (use view_file instead)',
    'Editing files with sed/awk (use str_replace_editor instead)',
    'Creating files with echo/cat (use create_file instead)',
    'Searching with grep/find/rg (use search instead)',
    'Directory listing with ls (use view_file with directory path)',
    'Any operation where a specialized tool exists',
  ],

  examples: [
    {
      description: 'Run tests',
      scenario: 'Execute the project test suite',
      input: { command: 'npm test' },
      expectedBehavior: 'Runs tests and returns results',
      notes: 'Use appropriate test command for the project (npm, pytest, go test, etc.)',
    },
    {
      description: 'Git status and diff',
      scenario: 'Check current git state before committing',
      input: { command: 'git status && git diff --staged' },
      expectedBehavior: 'Shows working tree status and staged changes',
    },
    {
      description: 'Start development server in background',
      scenario: 'Start a long-running process without blocking',
      input: { command: 'npm run dev', background: true },
      expectedBehavior: 'Returns task_id for monitoring, server runs in background',
    },
    {
      description: 'Git commit with proper message',
      scenario: 'Create a commit with multi-line message',
      input: {
        command: `git commit -m "$(cat <<'EOF'
feat: add user authentication

- Implement JWT tokens
- Add login/logout endpoints
EOF
)"`,
      },
      expectedBehavior: 'Creates commit with formatted message',
    },
    {
      description: 'Install dependencies',
      scenario: 'Install project dependencies',
      input: { command: 'npm install' },
      expectedBehavior: 'Installs packages and updates lock file',
    },
  ],

  tokenCost: 1200,
  safetyLevel: 'dangerous',
  requiresConfirmation: true,

  categories: ['command-execution'],
  alternatives: ['view_file', 'str_replace_editor', 'create_file', 'search'],
  relatedTools: ['bash_output'],
};
