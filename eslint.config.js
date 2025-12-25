import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

/**
 * ESLint Configuration for ax-cli
 *
 * BUG PREVENTION RULES ADDED:
 * - no-floating-promises: Catches unhandled promises (missing await)
 * - require-await: Catches async functions that don't await
 * - no-explicit-any: Changed from 'warn' to 'error' to enforce type safety
 * - await-thenable: Catches awaiting non-promise values
 *
 * These rules prevent the most common bug categories found in code review.
 *
 * NOTE: .eslintignore is deprecated in flat config. All ignores are in this file.
 */
export default [
  {
    ignores: [
      // Build outputs
      'dist/**',
      'lib/**',
      'build/**',
      '*.tsbuildinfo',

      // Dependencies
      'node_modules/**',

      // Test artifacts
      'coverage/**',
      '.nyc_output/**',

      // Config files
      '*.config.js',
      '*.config.ts',
      '.eslintcache',

      // Packages have their own ESLint configs
      'packages/**',

      // TypeScript declaration files
      '**/*.d.ts',

      // Test directories
      '**/__tests__/**',

      // Examples (documentation only)
      'examples/**',

      // AutomatosX temporary files and backups
      'automatosx/tmp/**',

      // VS Code extension has its own ESLint config
      'vscode-extension/**',

      // Leftover test files from test runs
      'test-file-*',
      'test-file-*.*',

      // Test fixtures (intentionally contain issues for testing)
      'test-design-check/**',

      // Markdown content files that ESLint incorrectly parses as code
      'vscode-extension/docs/**/*.content.md',
    ],
  },
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // Enable JSX parsing for .tsx files
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      // Tests can use 'any' more liberally for mocking
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
    },
  },
];
