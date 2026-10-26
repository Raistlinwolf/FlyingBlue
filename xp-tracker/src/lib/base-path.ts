/** The sub-path the site is served from (e.g. "/FlyingBlue" on GitHub Pages). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Prefixes a public asset path. next/link and the router add the base path themselves. */
export function asset(path: string): string {
  return `${BASE_PATH}${path}`;
}
