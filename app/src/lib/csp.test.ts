import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Content-Security-Policy is a list of the places this app loads from, and
 * a list goes out of date.
 *
 * Two ways, and they fail differently — which is why both are checked here
 * rather than one of them:
 *
 *   · **Short.** Somebody adds a provider, the app fetches a host the policy
 *     does not name, and the browser refuses it. There is no exception, no
 *     stack trace and no failing test: the feature simply does not work, on
 *     the deployed build only, and the console message is on a device nobody
 *     is holding. A <meta> policy cannot carry `report-uri`, so nothing here
 *     would ever hear about it.
 *   · **Long.** Somebody removes a provider and its host stays in the policy
 *     for ever. Nothing breaks, so nothing says so, and the policy slowly
 *     becomes a list of everywhere this app has *ever* talked to — which is
 *     the permission an injected script would want.
 *
 * So the check is bidirectional, the same shape as `security.test.ts`'s
 * tripwire over `SECURITY.md`: every host the code reaches must be in the
 * policy, and every host in the policy must be one the code reaches.
 *
 * ## What it cannot check
 *
 * Whether the policy is *enforced* — that is the browser's job and it was
 * measured in one, against the production build served by `vite preview`:
 * 72 routes, no refusals, and the same sweep with `font-src 'none'` and
 * `img-src 'self'` reporting twelve font refusals and the OpenStreetMap tile.
 * A test in jsdom cannot repeat that, and one that pretended to would be the
 * more dangerous of the two.
 */

const ROOT = process.cwd();
const HTML = join(ROOT, 'index.html');
const html = () => readFileSync(HTML, 'utf8');

/** The one `<meta http-equiv="Content-Security-Policy">`, as written. */
function policyTag(): string {
  const tags = [
    ...html().matchAll(
      /<meta\s+http-equiv="Content-Security-Policy"\s+content="([\s\S]*?)"\s*\/>/gi,
    ),
  ];
  expect(tags.length, 'index.html should carry exactly one CSP tag').toBe(1);
  return tags[0][1];
}

/** The policy as directives, with the line wrapping taken out. */
function directives(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const part of policyTag().split(';')) {
    const words = part.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    out.set(words[0], words.slice(1));
  }
  return out;
}

/** Every `.ts`/`.tsx` under `src` that is not a test. */
function sourceFiles(dir = join(ROOT, 'src')): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(path);
  }
  return out;
}

/**
 * The files that reach the network, found rather than listed.
 *
 * A hand-kept list of "the modules that fetch" is a list that goes stale
 * silently, which is the defect this whole file exists to catch — so the set
 * is derived: anything calling `fetch`, the deadline wrapper around it, the
 * Supabase client factory, or building an `https:` URL. That last one is not
 * padding. `lib/geocode.ts` builds Photon's and Nominatim's addresses and
 * hands them to `lib/findplace.ts` to fetch, so a rule keyed on `fetch` alone
 * misses Photon entirely — and would then report the policy's correct
 * `photon.komoot.io` line as stale.
 */
function networkFiles(): string[] {
  const reaches = /\b(fetch|fetchWithin)\s*\(|createClient\s*\(|new URL\(\s*['"`]https:/;
  return sourceFiles().filter((f) => reaches.test(readFileSync(f, 'utf8')));
}

/** Every `https://host` written into one of those files. */
function hostsReached(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const file of networkFiles()) {
    for (const m of readFileSync(file, 'utf8').matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) {
      const host = m[1].toLowerCase();
      if (!out.has(host)) out.set(host, []);
      if (!out.get(host)!.includes(file)) out.get(host)!.push(file);
    }
  }
  return out;
}

/**
 * Hosts that appear in a network-reaching file and are never *connected* to.
 *
 * `connect-src` governs `fetch`, XHR, websockets and beacons. It does not
 * govern a link, and every one of these is a link — an address put into an
 * object for the student to click, not one this app opens. Four of them, each
 * checked by reading the line it is on:
 *
 *   · `drive.google.com` — `webViewLink`, the fallback address of a file just
 *     uploaded to Drive.
 *   · `mail.google.com` — the `link` on a fetched Gmail message, so that
 *     "open in Gmail" goes somewhere.
 *   · `calendar.google.com` — the "add this feed" address in `lib/feedlink.ts`.
 *   · `nominatim.org` — the geocoder's home page, shown beside the setting
 *     that turns it on, because a student switching on a service that sends an
 *     address to a third party should be able to go and read about it.
 *
 * Kept as an explicit list rather than a pattern: "it is only a link" is a
 * claim about a line of code, and the next one is a claim about a different
 * line. Adding to this list should cost a reading.
 */
const LINKED_NOT_FETCHED = new Set([
  'drive.google.com',
  'mail.google.com',
  'calendar.google.com',
  'nominatim.org',
]);

/** Does a `connect-src` source list allow this host? Wildcards included. */
function allows(sources: string[], host: string): boolean {
  return sources.some((source) => {
    const bare = source.replace(/^(https|wss):\/\//, '').replace(/\/.*$/, '');
    if (bare === host) return true;
    if (bare.startsWith('*.')) return host.endsWith(bare.slice(1));
    return false;
  });
}

describe('the policy is there and says the things that make it worth having', () => {
  it('is a single tag in index.html', () => {
    expect(policyTag().length, 'the policy is empty').toBeGreaterThan(100);
  });

  it('closes the defaults rather than only opening what it needs', () => {
    const d = directives();
    expect(d.get('default-src')).toEqual(["'self'"]);
    // A page with no <object> and no <base> should say so: both are ways to
    // load or rebase that `script-src` does not cover.
    expect(d.get('object-src')).toEqual(["'none'"]);
    expect(d.get('base-uri')).toEqual(["'self'"]);
    expect(d.get('form-action')).toEqual(["'self'"]);
  });

  it('and does not hand back what it just took', () => {
    const script = directives().get('script-src') ?? [];
    expect(script, 'script-src is missing').toContain("'self'");
    // The two that make a script policy decorative. The production build has
    // no inline script and no eval — `dist/index.html` carried neither when
    // this was written — so neither is needed and neither should appear.
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
    expect(policyTag()).not.toContain("'unsafe-eval'");
  });

  it('allows inline style, which is load-bearing and should not be tidied away', () => {
    /*
     * This one looks like the thing to delete and is not, so it is pinned.
     *
     * Mermaid returns a diagram as an SVG string with a <style> element inside
     * it — 59 rules, measured — and `components/Drawing.tsx` puts that string
     * into the page as it came, which is deliberate: `securityLevel: 'strict'`
     * is what makes that safe, and `lib/diagram.ts`'s sanitiser runs on the
     * *other* language. `diagram.ts` also calls `setAttribute('style', …)`,
     * which `style-src` governs where a React `style={{…}}` prop does not.
     *
     * Measured in a browser: with `'unsafe-inline'` the injected sheet reports
     * 59 rules; without it the same render reports no sheet at all and the
     * console carries 64 refusals. Every generated figure in every study guide
     * draws unstyled. That is the cost of tightening this line, and it is the
     * reason to leave it alone until the diagrams are rendered some other way.
     */
    expect(directives().get('style-src')).toContain("'unsafe-inline'");
  });

  it('allows the map its tiles, and the marker icons Leaflet inlines', () => {
    // Both measured: with `img-src 'self'` the sweep reports a refused
    // `https://b.tile.openstreetmap.org/…png`, and the built stylesheet
    // carries a `url(data:image/png` for the marker.
    const img = directives().get('img-src') ?? [];
    expect(img).toContain('data:');
    expect(allows(img, 'a.tile.openstreetmap.org')).toBe(true);
  });
});

describe('connect-src and the code agree about where this app talks', () => {
  it('names every host the app fetches from', () => {
    const sources = directives().get('connect-src') ?? [];
    const missing = [...hostsReached()]
      .filter(([host]) => !LINKED_NOT_FETCHED.has(host))
      .filter(([host]) => !allows(sources, host))
      .map(([host, files]) => `${host} (${files.join(', ')})`);
    expect(missing, 'reached by the app, absent from connect-src').toEqual([]);
  });

  it('and names nothing the app never reaches', () => {
    /*
     * The same defect the other way round, and the one nothing else would
     * report: a host left behind by a provider that was removed costs nothing
     * to keep and is exactly the permission worth not having.
     *
     * Only the literal hosts. `*.supabase.co` is a wildcard because the
     * project reference is per-deployment and appears in no source file, and
     * `'self'`, `blob:` and the `wss:` forms are not hosts at all.
     */
    const reached = new Set(hostsReached().keys());
    const stale = (directives().get('connect-src') ?? [])
      .filter((s) => s.startsWith('https://') && !s.includes('*'))
      .map((s) => s.slice('https://'.length))
      .filter((host) => !reached.has(host));
    expect(stale, 'named in connect-src, reached by nothing').toEqual([]);
  });

  it('and the probe reads the code rather than reporting an empty tree', () => {
    /*
     * The control, and the reason the two sweeps above mean anything. A
     * derivation that finds no files passes both of them: no missing hosts and
     * no stale ones is also what a broken `readdirSync` looks like — and this
     * repository has shipped exactly that probe before, in the teardown work
     * `CLAUDE.md` describes.
     *
     * So both ends are pinned to something that is certainly there: the
     * connector module, which every provider goes through, and Anthropic,
     * which the assistant cannot work without.
     */
    const files = networkFiles();
    expect(files.length, 'no file in src was found to reach the network').toBeGreaterThan(4);
    expect(
      files.some((f) => f.endsWith(`${'connect'}.ts`)),
      'lib/connect.ts is no longer seen to reach the network, or the scan is broken',
    ).toBe(true);
    const reached = hostsReached();
    expect(reached.size, 'the scan found no hosts at all').toBeGreaterThan(8);
    expect([...reached.keys()]).toContain('api.anthropic.com');
    // And the exception list is about hosts that are actually there — an
    // entry for a host nothing mentions is a line nobody will ever remove.
    for (const host of LINKED_NOT_FETCHED) {
      expect(reached.has(host), `${host} is excused but appears nowhere`).toBe(true);
    }
  });
});

describe('the origins a deployment adds are still substituted', () => {
  it('index.html asks for them', () => {
    // Vite replaces `%VITE_…%` in the HTML from the resolved environment. If
    // the placeholder is renamed on one side only, the policy silently loses
    // the Supabase project and the university gateway — which is a deployed
    // app with sync and the university screen switched off, and nothing red.
    expect(policyTag()).toContain('%VITE_CSP_EXTRA_CONNECT%');
  });

  it('and vite.config.ts supplies them', () => {
    const config = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
    expect(config).toContain('VITE_CSP_EXTRA_CONNECT');
    expect(config).toContain('cspExtraConnect');
    // The four build variables it derives an origin from. A fifth being added
    // to `pages.yml` and not here is the failure this line names.
    for (const name of [
      'VITE_SUPABASE_URL',
      'VITE_CLAUDE_PROXY',
      'VITE_ICS_PROXY',
      'VITE_OAUTH_PROXY',
      'VITE_UNIVERSITY_GATEWAY_URL',
    ]) {
      expect(config, `${name} no longer contributes an origin`).toContain(name);
    }
  });

  it('and the dev server takes the tag back out, because inline is how it serves', () => {
    // `@vitejs/plugin-react` injects its refresh preamble inline, which
    // `script-src 'self'` refuses — so `npm run dev` opens blank if this
    // stops happening. The plugin is the whole of the fix and it is one line
    // away from being deleted as dead code.
    const config = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
    expect(config).toContain("csp(command === 'serve')");
  });
});
