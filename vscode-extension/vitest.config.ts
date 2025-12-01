import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'media/',
        'resources/',
        'src/test/',
      ],
    },
  },
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, 'src/test/__mocks__/vscode.ts')
    }
  }
});
