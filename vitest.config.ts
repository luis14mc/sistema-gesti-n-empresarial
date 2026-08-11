import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // E2E (.e2e.spec.ts) and accessibility helpers that depend on
    // @playwright/test are executed by Playwright, not Vitest.
    exclude: [
      '**/node_modules/**',
      '**/.next/**',
      '**/coverage/**',
      '**/dist/**',
      'tests/e2e/**',
      'tests/accessibility/**',
    ],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    coverage: {
      reporter: ['text', 'json', 'lcov', 'html'],
      thresholds: {
        // Sprint 3: bloquear merge si cobertura cae del 60%
        lines:   60,
        functions: 60,
        statements: 60,
        branches:  50,
      },
      // Excluir del cómputo: storage s3 (probado con AWS reales en staging)
      exclude: [
        'node_modules/',
        '.next/',
        'coverage/',
        'tests/e2e/**',
        'tests/accessibility/**',
        'src/lib/storage/s3.ts',
        'src/**/*.d.ts',
      ],
    },
  },
});
