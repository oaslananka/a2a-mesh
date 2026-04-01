import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    testTimeout: 15000,
    hookTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary', 'html'],
      include: [
        'packages/core/src/**/*.ts',
        'packages/adapters/src/**/*.ts',
        'packages/client/src/**/*.ts',
        'packages/registry/src/**/*.ts',
        'packages/testing/src/**/*.ts',
        'cli/src/**/*.ts',
      ],
      exclude: [
        'apps/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/index.ts',
        '**/build.config.ts',
        '**/dist/**',
        'packages/grpc/**',
        'packages/ws/**',
        'packages/create-a2a-agent/**',
        'packages/core/src/storage/ITaskStorage.ts',
        'packages/core/src/types/auth.ts',
        'packages/core/src/types/extensions.ts',
        'packages/core/src/types/task.ts',
        'packages/registry/src/storage/IAgentStorage.ts',
      ],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 85,
        lines: 85,
      },
    },
    projects: [
      {
        test: {
          name: 'unit',
          include: ['packages/*/tests/**/*.test.ts', 'cli/tests/**/*.test.ts'],
          exclude: ['tests/integration/**'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          testTimeout: 30000,
          hookTimeout: 15000,
        },
      },
    ],
  },
});
