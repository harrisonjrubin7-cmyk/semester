import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EXTRA_CONNECT, parsePolicy, uncoveredOrigins } from './cspheader';
import { isAmbiguousStaticPath, staticHostHeaders } from './previewsecurity';

/**
 * The response headers a host sends, written down for the hosts that let the
 * app say what they are.
 *
 * GitHub Pages, where the app is served today, sends its own headers and takes
 * none — which is why `index.html` carries the Content-Security-Policy as a
 * <meta> tag. These files carry the *whole* policy again as a header, plus
 * `frame-ancestors` and the rest of the usual set, in the two formats a static
 * host reads:
 *
 *   · `vercel.json`, the first `headers` rule (`/(.*)`).
 *   · `public/_headers`, which Vite copies into `dist/` and which Netlify and
 *     Cloudflare Pages both read.
 *
 * **Neither does anything on Pages.** The go-live line "Security headers
 * configured at the host" stays unticked until production is served from a
 * host that reads one of them, and a probe of the live response shows them.
 *
 * ## What is checked, and why each
 *
 *   · **The two files agree.** Two copies of one list is a list that drifts;
 *     whichever host the app moves to must send the same thing.
 *   · **Framing is allowed where LTI needs it, and nowhere else.** A course
 *     link in Brightspace opens the app *inside the LMS's iframe*: the `lti`
 *     Edge Function redirects that frame to `SEMESTER_APP_URL`. So
 *     `frame-ancestors 'none'` and `X-Frame-Options: DENY` would each break
 *     every school launch. The policy is `'self'` plus each school's LMS
 *     origin, and nothing broader: no bare `*`, no scheme-only source, no
 *     `http:`. Adding a school means adding its LMS origin here.
 *   · **The header CSP is the tag's policy, directive for directive.** It used
 *     to carry only `frame-ancestors`, on the grounds that two enforced
 *     policies intersect and a second list would drift. But a meta policy
 *     cannot carry `frame-ancestors`, `report-uri` or `sandbox` and applies
 *     late, so on a host that can send the header the whole policy belongs in
 *     it. The drift is answered by a test instead: the tag stays the one place
 *     a source is decided (`csp.test.ts` holds it to the code), and the
 *     headers are held to the tag. `src/lib/cspheader.ts` has the rest.
 *   · **Every browser feature the code calls is permitted.** A
 *     `Permissions-Policy` that omits `microphone` turns recording off on the
 *     deployed build only, with no error anywhere a developer would look — the
 *     same "short list" failure `csp.test.ts` guards for hosts. So the features
 *     are found in the source, not listed by hand.
 */

const ROOT = process.cwd();

type Headers = Map<string, string>;

function fromVercel(): Headers {
  const config = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const all = config.headers.find((r) => r.source === '/(.*)');
  expect(all, 'vercel.json should have a `/(.*)` headers rule').toBeTruthy();
  return new Map(all!.headers.map((h) => [h.key.toLowerCase(), h.value]));
}

function fromNetlify(): Headers {
  const lines = readFileSync(join(ROOT, 'public/_headers'), 'utf8').split('\n');
  expect(lines[0], 'public/_headers should open with the `/*` rule').toBe('/*');
  const out: Headers = new Map();
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    expect(line, 'every header line is indented under `/*`').toMatch(/^\s+\S/);
    const at = line.indexOf(':');
    out.set(line.slice(0, at).trim().toLowerCase(), line.slice(at + 1).trim());
  }
  return out;
}

function csp(h: Headers): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const part of (h.get('content-security-policy') ?? '').split(';')) {
    const words = part.trim().split(/\s+/).filter(Boolean);
    if (words.length) out.set(words[0], words.slice(1));
  }
  return out;
}

function permissions(h: Headers): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of (h.get('permissions-policy') ?? '').split(',')) {
    const [feature, allow] = part.trim().split('=');
    if (feature) out.set(feature, allow);
  }
  return out;
}

function sourceFiles(dir = join(ROOT, 'src')): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(path);
  }
  return out;
}

/** A call in the source, and the Permissions-Policy features it needs. */
const FEATURES: [RegExp, string[]][] = [
  [/getUserMedia\s*\(\s*\{[^}]*\baudio\b/, ['microphone']],
  [/getUserMedia\s*\(\s*\{[^}]*\bvideo\b/, ['camera']],
  [/getDisplayMedia\s*\(/, ['display-capture']],
  [/geolocation\.(getCurrentPosition|watchPosition)\s*\(/, ['geolocation']],
  [/clipboard\??\.writeText/, ['clipboard-write']],
  [/clipboard\??\.readText/, ['clipboard-read']],
  [/wakeLock/, ['screen-wake-lock']],
];

describe('host security headers', () => {
  it('vercel.json and public/_headers send the same headers', () => {
    // The CSP is compared on its own below, directive by directive, because it
    // is the one value the two files are allowed to spell differently.
    const strip = (h: Headers) => {
      const out = Object.fromEntries(h);
      delete out['content-security-policy'];
      return out;
    };
    expect(strip(fromNetlify())).toEqual(strip(fromVercel()));
    expect(fromNetlify().has('content-security-policy')).toBe(true);
    expect(fromVercel().has('content-security-policy')).toBe(true);
  });

  it('carries the set a meta tag cannot', () => {
    const h = fromVercel();
    const hsts = h.get('strict-transport-security') ?? '';
    expect(Number(/max-age=(\d+)/.exec(hsts)?.[1] ?? 0)).toBeGreaterThanOrEqual(31536000);
    expect(h.get('x-content-type-options')).toBe('nosniff');
    expect(h.get('referrer-policy')).toBeTruthy();
    expect(csp(h).get('frame-ancestors')).toBeTruthy();
  });

  it('allows framing by the LMS and by nothing broader', () => {
    const h = fromVercel();
    // X-Frame-Options cannot name an allow-list; any value of it would either
    // break LTI (DENY) or say nothing frame-ancestors does not (SAMEORIGIN).
    expect(h.has('x-frame-options')).toBe(false);
    const sources = csp(h).get('frame-ancestors')!;
    expect(sources).toContain("'self'");
    expect(sources).toContain('https://brightspace.vanderbilt.edu');
    for (const s of sources) {
      expect(s, `${s} is too broad for frame-ancestors`).toMatch(/^('self'|https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+)$/);
    }
  });

  it('permits every browser feature the code calls', () => {
    const allowed = permissions(fromVercel());
    const missing: string[] = [];
    const found = new Set<string>();
    for (const file of sourceFiles()) {
      const text = readFileSync(file, 'utf8');
      for (const [pattern, features] of FEATURES) {
        if (!pattern.test(text)) continue;
        for (const f of features) {
          found.add(f);
          if (allowed.get(f) !== '(self)') missing.push(`${f} (${file.slice(ROOT.length + 1)})`);
        }
      }
    }
    // A scan that finds nothing is also what a broken pattern looks like. The
    // app records audio and scans barcodes, so these two must be seen.
    expect([...found]).toEqual(expect.arrayContaining(['microphone', 'camera']));
    expect(missing).toEqual([]);
  });

  it('gives the CI preview the static-host headers and rejects impossible asset subpaths', () => {
    const raw = readFileSync(join(ROOT, 'public/_headers'), 'utf8');
    const headers = new Map(
      Object.entries(staticHostHeaders(raw, 'https://configured.example')).map(([name, value]) => [name.toLowerCase(), value]),
    );
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(parsePolicy(headers.get('content-security-policy') ?? '').get('frame-ancestors')).toBeTruthy();
    expect(headers.get('content-security-policy')).toContain('https://configured.example');
    expect(headers.get('content-security-policy')).not.toContain(EXTRA_CONNECT);

    expect(isAmbiguousStaticPath('/assets/app.js/random')).toBe(true);
    expect(isAmbiguousStaticPath('/apple-touch-icon.png/random')).toBe(true);
    expect(isAmbiguousStaticPath('/courses/fall-2026')).toBe(false);
    expect(isAmbiguousStaticPath('/assets/app.js')).toBe(false);

    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    for (const asset of ['icon.svg', 'apple-touch-icon.png', 'manifest.webmanifest']) {
      expect(html).toContain(`href="%BASE_URL%${asset}"`);
    }
  });
});

/** The `<meta http-equiv="Content-Security-Policy">` in index.html, as written. */
function metaPolicy(): string {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const tags = [
    ...html.matchAll(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([\s\S]*?)"\s*\/>/gi),
  ];
  expect(tags.length, 'index.html should carry exactly one CSP tag').toBe(1);
  return tags[0][1];
}

/** A policy with `frame-ancestors` taken out — the one directive a tag cannot carry. */
function withoutFraming(policy: Map<string, string[]>): Record<string, string[]> {
  const out = Object.fromEntries(policy);
  delete out['frame-ancestors'];
  return out;
}

const netlifyPolicy = () => parsePolicy(fromNetlify().get('content-security-policy') ?? '');
const vercelPolicy = () => parsePolicy(fromVercel().get('content-security-policy') ?? '');

describe('the header policy is the tag policy, sent where it can be enforced properly', () => {
  /*
   * The finding: the full policy lived only in the <meta> tag, and the header
   * carried `frame-ancestors` alone. A meta policy ignores `frame-ancestors`,
   * `report-uri` and `sandbox`, and applies only from the point the parser
   * reaches it. So on the hosts that can send a header, the whole policy is
   * sent as one — and the tag stays for GitHub Pages, which cannot.
   *
   * Two copies drift, and a drift is not harmless: a browser enforces both
   * policies, so a source the header lacks is refused even where the tag
   * allows it, on one host's deployed build only. These tests are what make
   * the tag the single source of truth.
   */

  it('public/_headers carries every directive of the tag, source for source, plus frame-ancestors', () => {
    // Placeholder and all: the build writes the same deployment origins into
    // both (the `csp()` plugin in vite.config.ts rewrites dist/_headers).
    expect(withoutFraming(netlifyPolicy())).toEqual(withoutFraming(parsePolicy(metaPolicy())));
    expect(netlifyPolicy().get('connect-src')).toContain(EXTRA_CONNECT);
    expect(netlifyPolicy().get('frame-ancestors')).toBeTruthy();
  });

  it('vercel.json carries the same, less the placeholder it cannot have', () => {
    /*
     * Vercel reads vercel.json before the build, so nothing can substitute
     * into it: a literal `%VITE_…%` would ship as an unparseable source. Its
     * `connect-src` may be a *superset* of the tag's fixed sources — that is
     * where a Vercel build's own origin goes when `vercelUncovered` fails the
     * build — and every other directive must match exactly.
     */
    const tag = withoutFraming(parsePolicy(metaPolicy()));
    const header = withoutFraming(vercelPolicy());
    expect(JSON.stringify(header)).not.toContain(EXTRA_CONNECT);
    const tagConnect = (tag['connect-src'] ?? []).filter((s) => s !== EXTRA_CONNECT);
    const headerConnect = header['connect-src'] ?? [];
    expect(headerConnect.slice(0, tagConnect.length), "vercel.json connect-src must open with the tag's sources").toEqual(
      tagConnect,
    );
    for (const extra of headerConnect.slice(tagConnect.length)) {
      // Only a literal https origin may be appended: no wildcard, no scheme-only source.
      expect(extra, `${extra} is too broad to append to connect-src`).toMatch(/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+$/);
    }
    delete tag['connect-src'];
    delete header['connect-src'];
    expect(header).toEqual(tag);
  });

  it('control: the comparison can see a difference', () => {
    // A parser that returned an empty map for everything would pass both
    // tests above. Pin that the tag is really read, and that one changed
    // source really registers as a disagreement.
    const tag = parsePolicy(metaPolicy());
    expect(tag.size).toBeGreaterThanOrEqual(10);
    expect(tag.get('script-src')).toEqual(["'self'"]);
    const tampered = parsePolicy(metaPolicy().replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"));
    expect(withoutFraming(tampered)).not.toEqual(withoutFraming(netlifyPolicy()));
  });

  it('neither header is looser than the tag where it matters most', () => {
    for (const [name, h] of [
      ['vercel.json', fromVercel()],
      ['_headers', fromNetlify()],
    ] as const) {
      const p = csp(h);
      expect(p.get('default-src'), name).toEqual(["'self'"]);
      expect(p.get('object-src'), name).toEqual(["'none'"]);
      expect(p.get('script-src'), name).toEqual(["'self'"]);
      expect(p.get('base-uri'), name).toEqual(["'self'"]);
      expect(h.get('content-security-policy'), name).not.toContain("'unsafe-eval'");
    }
  });

  it('the build substitutes the placeholder in dist/_headers, as it does in the tag', () => {
    // Vite copies public/ verbatim; only the plugin puts the origins in. If it
    // goes, Netlify ships a literal placeholder and refuses a Supabase custom
    // domain the tag allows.
    const config = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
    expect(config).toMatch(/closeBundle\(\)\s*\{[\s\S]*?_headers[\s\S]*?EXTRA_CONNECT/);
    expect(config).toContain('vercelUncovered(process.env.VITE_CSP_EXTRA_CONNECT)');
  });
});

describe('uncoveredOrigins, which fails a Vercel build its header would break', () => {
  const sources = ["'self'", 'blob:', 'https://*.supabase.co', 'wss://*.supabase.co', 'https://api.anthropic.com'];

  it('passes what the fixed sources already allow', () => {
    expect(
      uncoveredOrigins(sources, 'https://abc.supabase.co wss://abc.supabase.co https://api.anthropic.com'),
    ).toEqual([]);
    expect(uncoveredOrigins(sources, '')).toEqual([]);
  });

  it('names what they do not', () => {
    // The control: a checker that allowed everything would pass the case above.
    expect(uncoveredOrigins(sources, 'https://fn.semester.app https://abc.supabase.co')).toEqual([
      'https://fn.semester.app',
    ]);
    // A wildcard matches subdomains, not the bare domain or a lookalike.
    expect(uncoveredOrigins(sources, 'https://supabase.co https://evilsupabase.co')).toEqual([
      'https://supabase.co',
      'https://evilsupabase.co',
    ]);
    // The scheme must match: an https source does not allow wss.
    expect(uncoveredOrigins(['https://x.example'], 'wss://x.example')).toEqual(['wss://x.example']);
  });

  it("exempts the deployment's own origin, which is 'self'", () => {
    expect(uncoveredOrigins(sources, 'https://app.vercel.app', ['https://app.vercel.app'])).toEqual([]);
  });
});
