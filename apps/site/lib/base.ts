/**
 * Where the site is served from. '' for its own domain (charts.funnest.xyz),
 * '/charts' when it lives under the service domain (funnest.xyz/charts).
 * Set BASE_PATH at build time; next.config forwards it here.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Prefix a public-folder path (Next's basePath doesn't rewrite plain <img src>). */
export const asset = (path: string) => `${BASE_PATH}${path}`;
