import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000, // 60s timeout for analyzer tests (AST parsing is slow in CI, especially on Windows)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/vscode-extension/**', // VSCode extension has its own test setup
      '**/tests/memory/**', // Temporarily excluded - context injection tests need refactoring
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'tests/',
        'vscode-extension/', // Exclude from coverage
      ],
      // Coverage thresholds - start low and increase over time
      // Current baseline: 0.8% - goal is to incrementally improve
      thresholds: {
        statements: 1,
        branches: 1,
        functions: 1,
        lines: 1,
      },
    },
  },
});
