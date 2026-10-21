import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import {
  APPLICATION_LAYER_BASELINE,
  PRISMA_IN_PRESENTATION_BASELINE,
} from './eslint.architecture-baseline.mjs';

// ADR 003 — Monolito modular por capas (docs/adr/003-arquitectura-monolito-modular.md)
const PRISMA_PRESENTATION_MESSAGE =
  'ADR 003: Prisma no se usa en presentación. Mueve el acceso a datos a src/modules/<módulo>/application|infrastructure y llama al caso de uso.';
/** Next.js dynamic segments use literal `[id]`; escape for ESLint glob `files`. */
function escapePresentationBaselinePath(path) {
  return path.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

const APPLICATION_LAYER_MESSAGE =
  'ADR 003: application no importa Next.js ni Prisma; usa infrastructure y presentation para HTTP.';

const PRISMA_PRESENTATION_BASELINE_FILES = PRISMA_IN_PRESENTATION_BASELINE.map(
  escapePresentationBaselinePath,
);

const PRESENTATION_LAYERS = [
  'src/app/**/*.{ts,tsx}',
  'src/components/**/*.{ts,tsx}',
  'src/hooks/**/*.{ts,tsx}',
  'src/services/**/*.{ts,tsx}',
  'src/stores/**/*.{ts,tsx}',
  'src/providers/**/*.{ts,tsx}',
  'src/actions/**/*.{ts,tsx}',
  'src/utils/**/*.{ts,tsx}',
  'src/types/**/*.{ts,tsx}',
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Next 16 enables this as error; codebase uses fetch-on-mount patterns widely.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: PRESENTATION_LAYERS,
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        paths: [
          { name: '@/lib/prisma', message: PRISMA_PRESENTATION_MESSAGE },
          { name: '@prisma/client', message: PRISMA_PRESENTATION_MESSAGE, allowTypeImports: true },
        ],
      }],
    },
  },
  {
    files: ['src/modules/*/presentation/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        paths: [
          { name: '@/lib/prisma', message: PRISMA_PRESENTATION_MESSAGE },
          { name: '@prisma/client', message: PRISMA_PRESENTATION_MESSAGE, allowTypeImports: true },
        ],
      }],
    },
  },
  // Baseline legacy violators (ADR 003 phase 0): exact paths so dynamic segments are not glob classes.
  {
    files: PRISMA_PRESENTATION_BASELINE_FILES,
    rules: {
      '@typescript-eslint/no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/modules/*/application/**/*.ts'],
    ignores: [
      'src/modules/*/application/**/*.test.ts',
      'src/modules/*/application/**/__tests__/**',
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        paths: [
          { name: 'next', message: APPLICATION_LAYER_MESSAGE },
          { name: '@/lib/prisma', message: APPLICATION_LAYER_MESSAGE },
        ],
        patterns: [
          { group: ['next/*'], message: APPLICATION_LAYER_MESSAGE },
        ],
      }],
    },
  },
  {
    files: APPLICATION_LAYER_BASELINE.map(escapePresentationBaselinePath),
    rules: {
      '@typescript-eslint/no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/modules/*/domain/**/*.ts'],
    ignores: ['src/modules/*/domain/**/*.test.ts', 'src/modules/*/domain/**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        paths: [
          { name: 'next', message: 'ADR 003: domain es puro (sin Next.js).' },
          { name: 'react', message: 'ADR 003: domain es puro (sin React).' },
          { name: '@/lib/prisma', message: 'ADR 003: domain no accede a la BD; usa infrastructure.' },
          { name: '@prisma/client', message: 'ADR 003: en domain solo `import type` de Prisma.', allowTypeImports: true },
        ],
        patterns: [
          { group: ['next/*'], message: 'ADR 003: domain es puro (sin Next.js).' },
          { group: ['@/modules/*/application', '@/modules/*/application/**', '@/modules/*/infrastructure', '@/modules/*/infrastructure/**'], message: 'ADR 003: domain no depende de application/infrastructure.' },
        ],
      }],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'dist/**',
    'next-env.d.ts',
    'node_modules/**',
    '.agents/**',
    '.minimax/**',
    'coverage/**',
    'tests/e2e/**',
    'tests/accessibility/**',
    'tests/performance/k6/**',
  ]),
]);

export default eslintConfig;
