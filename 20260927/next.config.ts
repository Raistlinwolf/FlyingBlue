import type { NextConfig } from 'next';

// Static export: the app is plain HTML/JS/CSS that talks to Supabase from the browser,
// so it can be hosted on GitHub Pages. NEXT_PUBLIC_BASE_PATH is the repository sub-path
// there (e.g. "/FlyingBlue"); leave it empty for local development.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
