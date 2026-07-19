import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false,    // 串行运行，避免 DB 竞争
    sequence: { concurrent: false },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});