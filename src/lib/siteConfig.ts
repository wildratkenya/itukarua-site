/**
 * Single source of truth for the canonical public host.
 *
 * Set VITE_SITE_URL in the environment (build time) to move the site to a
 * custom domain. The fallback keeps the Vercel host working, so nothing breaks
 * when the variable is absent. No trailing slash.
 */
const RAW_SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.trim() ||
  'https://itukarua3.vercel.app';

export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, '');

export const SITE_NAME = 'Itukarua';

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og.jpg`;

export const TWITTER_HANDLE = '@itukarua';

/** Join the canonical host with a root-relative path. */
export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
