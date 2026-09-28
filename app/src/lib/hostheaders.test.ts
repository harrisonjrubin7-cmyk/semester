import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The response headers a host sends, written down for the hosts that let the
 * app say what they are.
 *
 * GitHub Pages, where the app is served today, sends its own headers and takes
 * none — which is why `index.html` carries the Content-Security-Policy as a
 * <meta> tag, and why the tag's comment names the two things a meta tag cannot
 * carry. These files are those two things and the rest of the usual set, in
 * the two formats a static host reads:
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
 *   · **The header CSP carries only what a meta tag cannot.** Two policies are
 *     both enforced, so a `script-src` here would silently intersect with the
 *     tag's and `csp.test.ts` would no longer describe what the browser does.
 *     The tag stays the one list of load sources.
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
    expect(Object.fromEntries(fromNetlify())).toEqual(Object.fromEntries(fromVercel()));
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

  it('keeps load sources in the index.html tag, not here', () => {
    const extra = [...csp(fromVercel()).keys()].filter(
      (d) => !['frame-ancestors', 'report-uri', 'report-to'].includes(d),
    );
    expect(extra, 'directives a meta tag can carry belong in index.html').toEqual([]);
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
});
