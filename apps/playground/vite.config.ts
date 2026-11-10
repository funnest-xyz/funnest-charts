import { defaultClientConditions, defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    // Resolve workspace packages to their TS source so edits hot-reload without a build step.
    conditions: ['funnest-source', ...defaultClientConditions],
    // @funnest/charts-ui uses Preact internally; make sure every import shares one instance.
    dedupe: ['preact', 'react', 'react-dom'],
  },
  optimizeDeps: {
    // Pre-bundle all Preact entry points together up front. Discovering them lazily
    // can produce separately optimized copies, which breaks hooks.
    include: [
      'preact',
      'preact/hooks',
      'preact/jsx-runtime',
      'preact/jsx-dev-runtime',
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
    ],
  },
  // Two pages: the vanilla widget demo and the React wrapper demo.
  build: { rollupOptions: { input: { main: 'index.html', react: 'react.html' } } },
  server: { host: true },
});
