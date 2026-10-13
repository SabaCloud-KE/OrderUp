import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@orderup/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@drinkhub/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
