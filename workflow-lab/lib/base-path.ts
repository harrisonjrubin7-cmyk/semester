/**
 * The path prefix workflow-lab is served under (see the root vercel.json, where
 * the `/lab` rewrite targets this service). `next.config.ts` sets it as
 * `basePath`, which prefixes `<Link>`, `redirect()` and static assets on its own.
 * Plain `<a href>`, `<form action>` and `NextResponse.redirect(new URL(...))` do
 * not get it, so those go through `withBasePath`.
 */
export const BASE_PATH = "/lab";

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
