import { defineConfig } from 'tsup';

// Preact is bundled in so consumers never install or see it.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  noExternal: ['preact'],
});
