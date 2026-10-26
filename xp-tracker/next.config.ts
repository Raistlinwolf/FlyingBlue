import type { NextConfig } from 'next';
import pkg from './package.json' with { type: 'json' };

// Static export: the app is plain HTML/JS/CSS that talks to Supabase from the browser,
// so it can be hosted on GitHub Pages. NEXT_PUBLIC_BASE_PATH is the repository sub-path
// there (e.g. "/FlyingBlue"); leave it empty for local development.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  // Shown at the bottom of Settings; bump it with `npm version` and tag the release.
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
};

export default nextConfig;
