/**
 * The Content-Security-Policy as a header, and how it stays the same policy as
 * the one in `index.html`.
 *
 * ## Why there are two copies at all
 *
 * The policy began as a `<meta>` tag because GitHub Pages, where the app is
 * served, takes no headers. A meta policy is enforced like a header with three
 * exceptions that matter here: `frame-ancestors`, `report-uri` and `sandbox`
 * are ignored in it, and it only takes effect once the parser reaches the tag
 * — anything earlier in `<head>` loads unpoliced. So on a host that *can* set a
 * header (`vercel.json`, and `public/_headers` for Netlify and Cloudflare
 * Pages) the full policy is sent as one, with `frame-ancestors` added, and the
 * tag stays for Pages.
 *
 * Two copies of a list is a list that drifts, and a drift here is not
 * harmless: a browser enforces *both* policies, so a source missing from the
 * header is refused even though the tag allows it — on the deployed build of
 * one host only, with nothing red anywhere. `src/lib/hostheaders.test.ts`
 * therefore reads all three and requires them to agree directive by directive,
 * `frame-ancestors` excepted. The tag is still where a source is *decided*
 * (`csp.test.ts` holds it to the code); the headers are held to the tag.
 *
 * ## The one part a static file cannot know
 *
 * `connect-src` ends with origins this deployment adds — the Supabase project,
 * the proxies, the university gateway — which `vite.config.ts` derives from
 * build variables and substitutes for {@link EXTRA_CONNECT}. The tag and
 * `_headers` both carry the placeholder, and the build writes the same value
 * into both (`_headers` is copied from `public/` untouched, so the `csp()`
 * plugin rewrites the copy in `dist/`). `vercel.json` is read by Vercel before
 * the build runs and cannot be rewritten, so it carries no placeholder; instead
 * a Vercel build refuses to finish when a configured origin is one its header
 * would block ({@link uncoveredOrigins}). That is a loud failure at deploy time
 * in place of a feature that silently stops working in a student's browser.
 * The fix it names is to append the origin to `vercel.json`'s `connect-src`,
 * which is why that one directive, in that one file, may be a superset of the
 * tag's: an extra source in the header opens nothing, because the tag still
 * has to allow it too.
 *
 * Plain functions, no Node and no DOM, so `vite.config.ts` and the tests both
 * import it.
 */

/** Where the deployment's own `connect-src` origins go. Spelled once. */
export const EXTRA_CONNECT = '%VITE_CSP_EXTRA_CONNECT%';

/** A policy as directive → sources, whitespace and line breaks taken out. */
export function parsePolicy(text: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const part of text.split(';')) {
    const words = part.trim().split(/\s+/).filter(Boolean);
    if (words.length) out.set(words[0].toLowerCase(), words.slice(1));
  }
  return out;
}

/** Does one CSP source allow this origin? Host wildcards included, schemes exact. */
function sourceAllows(source: string, origin: string): boolean {
  const at = /^([a-z][a-z0-9+.-]*):\/\/(.+)$/i.exec(source);
  const want = /^([a-z][a-z0-9+.-]*):\/\/(.+)$/i.exec(origin);
  if (!at || !want) return false;
  if (at[1].toLowerCase() !== want[1].toLowerCase()) return false;
  const host = at[2].replace(/\/.*$/, '').toLowerCase();
  const asked = want[2].replace(/\/.*$/, '').toLowerCase();
  if (host === asked) return true;
  // `*.supabase.co` matches `abc.supabase.co`, not `supabase.co` itself.
  return host.startsWith('*.') && asked.endsWith(host.slice(1));
}

/**
 * The origins in `extra` (space-separated, as `cspExtraConnect` returns them)
 * that `sources` would refuse, minus any in `self` — the origins the page is
 * itself served from, which `'self'` already covers.
 */
export function uncoveredOrigins(sources: string[], extra: string, self: string[] = []): string[] {
  return extra
    .split(/\s+/)
    .filter(Boolean)
    .filter((o) => !sources.some((s) => sourceAllows(s, o)))
    .filter((o) => !self.includes(o));
}
