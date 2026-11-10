import { defineConfig } from 'tsup';

// resvg is a native optional dependency, loaded only for PNG output: never bundle it.
const external = ['@resvg/resvg-js'];

export default defineConfig([
  { entry: ['src/index.ts'], format: 'esm', clean: true, external },
  // The command gets a shebang so `npx @funnest/charts-cli` / `funnest-charts` can run it.
  { entry: ['src/cli.ts'], format: 'esm', external, banner: { js: '#!/usr/bin/env node' } },
]);
