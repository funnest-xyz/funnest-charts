import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

// '' = served at the domain root (charts.funnest.xyz); '/charts' = funnest.xyz/charts.
const basePath = process.env.BASE_PATH ?? '';

const root = fileURLToPath(new URL('../..', import.meta.url));
const src = (pkg: string) => `../../packages/${pkg}/src/index.ts`;

export default function config(phase: string): NextConfig {
  const dev = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    reactStrictMode: true,
    // Static HTML — deployable to Vercel or any static host.
    output: 'export',
    basePath,
    trailingSlash: true,
    images: { unoptimized: true },
    env: { NEXT_PUBLIC_BASE_PATH: basePath },
    turbopack: {
      root,
      // In dev, read the libraries' TypeScript source so edits show up immediately
      // (production builds use the published dist output, like real users).
      ...(dev && {
        resolveAlias: {
          '@funnest/charts': src('core'),
          '@funnest/charts-ui': src('ui'),
          '@funnest/charts-react': src('react'),
          '@funnest/charts-viz': src('viz'),
        },
      }),
    },
  };
}
