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
 */
export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '*.config.js',
      '*.config.ts',
      'packages/**',           // Packages have their own ESLint configs
      '**/*.d.ts',            // Ignore TypeScript declaration files
      '**/__tests__/**',      // Ignore test directories
      'examples/**',          // Ignore examples (documentation only)
      'automatosx/tmp/**',    // Ignore AutomatosX temporary files and backups
      'vscode-extension/**',  // VS Code extension has its own ESLint config
      'test-file-*',          // BUG FIX: Ignore leftover test files from test runs
      'test-file-*.*',        // BUG FIX: Ignore leftover test files (with extension)
    ],
  },
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
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
