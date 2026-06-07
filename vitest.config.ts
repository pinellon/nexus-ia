import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.git/**',
      '**/.tmp-tests/**',
      '**/.tmp-preview/**',
      '**/data/**',
      '**/NexusAI/data/**',
      '**/NexusAI/_archive/**',
    ],
  },
});
