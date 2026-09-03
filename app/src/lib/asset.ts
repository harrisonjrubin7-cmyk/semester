/**
 * Where the app is served from.
 *
 * In development that is the root, and `/audio/lessons/econ/unit-0.mp3` is a
 * real address. Deployed to GitHub Pages it is a subpath —
 * `/semester/audio/...` — and every absolute path in the data becomes a 404
 * with no error shown: a player that loads nothing, a document link that goes
 * nowhere.
 *
 * So nothing reads a leading-slash path directly. The data keeps writing the
 * honest path from the site root, and this puts the base in front of it at the
 * moment of use. Vite fills BASE_URL in at build time from `base`, which the
 * Pages workflow sets.
 */
export function asset(path: string): string {
  if (!path) return path;
  // Anything already absolute — an https URL, a blob:, a data: — is left alone.
  if (/^[a-z]+:/i.test(path)) return path;
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
