import { defineConfig } from 'vitest/config';

// Tests import workspace packages from their TypeScript source (the `funnest-source`
// export condition), so they run without building dist/ first (CI does exactly that).
const conditions = ['funnest-source', 'module', 'node', 'development|production'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions, externalConditions: ['funnest-source'] } },
  test: {
    include: ['packages/*/src/**/*.test.ts'],
  },
});
