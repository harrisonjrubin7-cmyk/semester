import { EXTRA_CONNECT } from './cspheader.ts';

/**
 * Turn the first static-host rule into the headers Vite's preview server sends.
 * This keeps the CI scan target on the same contract as Netlify/Cloudflare
 * instead of scanning Vite's intentionally bare development defaults.
 */
export function staticHostHeaders(text: string, extraConnect = ''): Record<string, string> {
  const lines = text.split('\n');
  if (lines[0] !== '/*') throw new Error('public/_headers must open with the /* rule');

  const headers: Record<string, string> = {};
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const at = line.indexOf(':');
    if (at < 1) throw new Error(`Invalid static host header: ${line}`);
    const name = line.slice(0, at).trim();
    headers[name] = line.slice(at + 1).trim().split(EXTRA_CONNECT).join(extraConnect);
  }
  return headers;
}

/**
 * Vite's SPA fallback otherwise serves index.html for paths such as
 * /assets/app.js/random. A browser can then resolve relative resources below
 * an attacker-controlled pseudo-directory (relative path confusion). Real
 * asset paths with an extra segment are never valid Semester routes.
 */
export function isAmbiguousStaticPath(url: string): boolean {
  const pathname = new URL(url, 'http://localhost').pathname;
  return /(?:^|\/)[^/]+\.(?:css|gif|html?|ico|jpe?g|js|json|mjs|png|svg|ttf|webmanifest|webp|woff2?)\//i.test(pathname);
}
