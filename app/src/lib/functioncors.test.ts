/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_ORIGINS,
  allowOrigin,
  allowedOrigins,
  corsHeaders,
  devAllowed,
} from '../../../supabase/functions/_shared/cors';

/**
 * The secret that made three functions unreachable and said nothing — and the
 * fallback that made them reachable from everywhere.
 *
 * On 21 September 2026 `ALLOWED_ORIGIN` was found set to a localhost address
 * on the live project. `claude`, `fetchcal` and `canvas` all read it, so the
 * shared AI key, the calendar-link reader and the Canvas sync were every one
 * of them dead from the deployed site — while the functions were ACTIVE, the
 * deployed code was byte-identical to this repository, and CI was green.
 *
 * The opposite fault sat in the same function: with the secret unset, or with
 * `*` in it, every origin on the web was answered `*`. The rule now fails
 * closed — the production origin is built in, the secret only adds https
 * origins, loopback needs `CORS_ALLOW_DEV`, and anything else gets no
 * `Access-Control-Allow-Origin` at all.
 *
 * A CORS decision cannot be seen from either end, so a test of the decision
 * table is the only place it can be caught. That is why `_shared/cors.ts`
 * takes its inputs as arguments and never reads `Deno.env`.
 */

const PAGES = 'https://harrisonjrubin7-cmyk.github.io';
const LOCAL = 'http://localhost:5173';
const EVIL = 'https://evil.example';
const OTHER = 'https://semester.example.edu';

describe('with nothing configured', () => {
  it('still answers the deployed site, because it is built in', () => {
    // The 21 September failure, from the other side: an unset secret must not
    // take production out.
    expect(PRODUCTION_ORIGINS).toContain(PAGES);
    expect(allowOrigin(undefined, PAGES)).toBe(PAGES);
    expect(allowOrigin('', PAGES)).toBe(PAGES);
  });

  it('answers nobody else — never a star', () => {
    for (const raw of [undefined, null, '', '   ']) {
      expect(allowOrigin(raw, EVIL), String(raw)).toBeNull();
      expect(corsHeaders(raw, EVIL)).not.toHaveProperty('Access-Control-Allow-Origin');
    }
    expect(allowedOrigins(undefined)).toEqual([PAGES]);
  });

  it('and an explicit star is ignored rather than honoured', () => {
    expect(allowOrigin('*', EVIL)).toBeNull();
    expect(allowOrigin(`${PAGES},*`, EVIL)).toBeNull();
    expect(allowedOrigins('*')).not.toContain('*');
    // The star does not break the real entries beside it.
    expect(allowOrigin(`*,${OTHER}`, OTHER)).toBe(OTHER);
  });
});

describe('with a list', () => {
  it('echoes a configured https origin back to itself', () => {
    expect(allowOrigin(OTHER, OTHER)).toBe(OTHER);
    expect(allowOrigin(`${PAGES}, ${OTHER}`, OTHER)).toBe(OTHER);
  });

  it('forgives the trailing slash the address bar adds, and case in the host', () => {
    expect(allowOrigin(`${OTHER}/`, OTHER)).toBe(OTHER);
    expect(allowOrigin(OTHER, `${OTHER}/`)).toBe(OTHER);
    expect(allowOrigin('https://Semester.Example.edu', OTHER)).toBe(OTHER);
  });

  it('drops entries that are not exact https origins', () => {
    expect(allowedOrigins(`http://plain.example,${OTHER}/path,https://*.example`)).toEqual([PAGES]);
  });
});

describe('an origin that is not allowed', () => {
  it('gets no Allow-Origin header at all — not a star, not somebody else’s origin', () => {
    const h = corsHeaders(OTHER, EVIL);
    expect(h).not.toHaveProperty('Access-Control-Allow-Origin');
    expect(Object.values(h)).not.toContain('*');
    expect(Object.values(h)).not.toContain(OTHER);
    expect(Object.values(h)).not.toContain(PAGES);
  });

  it('nor does a request with no Origin, or the null origin of a sandboxed frame', () => {
    expect(allowOrigin(OTHER, null)).toBeNull();
    expect(allowOrigin(OTHER, '')).toBeNull();
    expect(allowOrigin(OTHER, 'null')).toBeNull();
  });

  it('a lookalike host is not the listed host', () => {
    expect(allowOrigin(undefined, `${PAGES}.evil.example`)).toBeNull();
    expect(allowOrigin(undefined, 'http://harrisonjrubin7-cmyk.github.io')).toBeNull();
  });
});

describe('localhost, only when the dev flag says so', () => {
  it('is refused on the live project even when the secret lists it', () => {
    // Exactly the live misconfiguration of 21 September: now it neither opens
    // localhost nor closes production.
    expect(allowOrigin(LOCAL, LOCAL)).toBeNull();
    expect(allowOrigin(LOCAL, PAGES)).toBe(PAGES);
    expect(allowOrigin(LOCAL, LOCAL, 'false')).toBeNull();
    expect(allowOrigin(LOCAL, LOCAL, '')).toBeNull();
  });

  it('is answered, on any port, with CORS_ALLOW_DEV on', () => {
    expect(allowOrigin(undefined, LOCAL, '1')).toBe(LOCAL);
    expect(allowOrigin(undefined, 'http://127.0.0.1:5199', 'true')).toBe('http://127.0.0.1:5199');
    expect(devAllowed('yes')).toBe(true);
    expect(devAllowed('0')).toBe(false);
    expect(devAllowed(undefined)).toBe(false);
  });

  it('and the dev flag opens loopback only, not the world', () => {
    expect(allowOrigin(undefined, EVIL, '1')).toBeNull();
    expect(allowOrigin(undefined, 'http://localhost.evil.example', '1')).toBeNull();
  });
});

describe('the headers as a whole', () => {
  it('varies on Origin, on an answer and on a refusal alike', () => {
    expect(corsHeaders(OTHER, OTHER).Vary).toBe('Origin');
    expect(corsHeaders(OTHER, EVIL).Vary).toBe('Origin');
  });

  it('still lists every header the app sends', () => {
    const h = corsHeaders(undefined, PAGES)['Access-Control-Allow-Headers'];
    // `anthropic-version` is on every call to `claude`; a preflight that omits
    // one header refuses the whole request before the function runs.
    for (const name of ['authorization', 'content-type', 'anthropic-version', 'apikey', 'x-client-info']) {
      expect(h).toContain(name);
    }
    expect(corsHeaders(undefined, PAGES)['Access-Control-Allow-Methods']).toContain('OPTIONS');
  });
});

describe('every function that answers a browser uses the shared rule', () => {
  /*
   * The tripwire. A function written the old way — a module-level object with
   * the header spelt out by hand, or a star — is the recurrence, and nothing
   * else here would notice.
   */
  const root = join(process.cwd(), '..');
  const read = (p: string) => readFileSync(join(root, p), 'utf8');

  for (const fn of ['claude', 'fetchcal', 'canvas', 'delete-account']) {
    it(`${fn} builds its headers per request, with the dev flag`, () => {
      const src = read(`supabase/functions/${fn}/index.ts`);
      expect(src, `${fn} no longer imports the shared rule`).toContain('_shared/cors.ts');
      expect(src, `${fn} builds CORS per request`).toMatch(
        /const cors = corsHeaders\(Deno\.env\.get\('ALLOWED_ORIGIN'\), req\.headers\.get\('Origin'\), Deno\.env\.get\('CORS_ALLOW_DEV'\)\)/,
      );
      expect(src, `${fn} has a hand-written Allow-Origin again`).not.toMatch(/'Access-Control-Allow-Origin'/);
    });
  }

  it('no function or shared module writes a wildcard origin', () => {
    const files = [
      'supabase/functions/_shared/cors.ts',
      'supabase/functions/_shared/trustroom.ts',
      ...['claude', 'fetchcal', 'canvas', 'lti', 'trust-room', 'calendar', 'push', 'integration-tick', 'delete-account'].map(
        (f) => `supabase/functions/${f}/index.ts`,
      ),
    ];
    for (const f of files) {
      const src = read(f);
      expect(src, f).not.toMatch(/Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]\*['"]/);
      expect(src, f).not.toMatch(/const ANY = '\*'/);
    }
  });
});
