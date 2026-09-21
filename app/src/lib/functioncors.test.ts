/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allowOrigin, allowedOrigins, corsHeaders } from '../../../supabase/functions/_shared/cors';

/**
 * The secret that made three functions unreachable and said nothing.
 *
 * On 21 September 2026 `ALLOWED_ORIGIN` was found set to a localhost address
 * on the live project. `claude`, `fetchcal` and `canvas` all read it, so the
 * shared AI key, the calendar-link reader and the Canvas sync were every one
 * of them dead from the deployed site — while the functions were ACTIVE, the
 * deployed code was byte-identical to this repository, and CI was green.
 *
 * A CORS refusal cannot be seen from either end. The browser rejects the
 * response before the page sees it, so the app reports "could not reach" — the
 * same sentence it prints for a dead host — and the function's own logs show a
 * request that arrived and was answered. There is no runtime check that finds
 * this. A test of the decision table is the only place it can be caught, which
 * is why `_shared/cors.ts` takes the raw secret as an argument and never reads
 * `Deno.env`: it makes the rule importable from here.
 */

const PAGES = 'https://harrisonjrubin7-cmyk.github.io';
const LOCAL = 'http://localhost:5173';

describe('with nothing configured', () => {
  it('answers every origin, as it always did', () => {
    expect(allowOrigin(undefined, PAGES)).toBe('*');
    expect(allowOrigin('', PAGES)).toBe('*');
    expect(allowOrigin('   ', null)).toBe('*');
    expect(allowedOrigins(undefined)).toEqual(['*']);
  });

  it('and an explicit star stays a star', () => {
    expect(allowOrigin('*', PAGES)).toBe('*');
    expect(allowOrigin(`${PAGES},*`, LOCAL)).toBe('*');
  });
});

describe('with a list, both origins work — which is the whole point', () => {
  const both = `${PAGES},${LOCAL}`;

  it('echoes the Pages origin back to the Pages site', () => {
    expect(allowOrigin(both, PAGES)).toBe(PAGES);
  });

  it('echoes localhost back to a dev server', () => {
    expect(allowOrigin(both, LOCAL)).toBe(LOCAL);
  });

  it('copes with the spaces a person types after a comma', () => {
    expect(allowOrigin(`${PAGES}, ${LOCAL}`, LOCAL)).toBe(LOCAL);
  });

  /*
   * The mistake most likely to be made, and the one that would reproduce the
   * incident exactly: an origin never has a trailing slash, but that is what
   * the address bar hands you.
   */
  it('forgives the trailing slash the address bar adds', () => {
    expect(allowOrigin(`${PAGES}/`, PAGES)).toBe(PAGES);
    expect(allowOrigin(PAGES, `${PAGES}/`)).toBe(PAGES);
  });
});

describe('an origin that is not on the list', () => {
  it('is refused, and refused with a real origin rather than a star', () => {
    /*
     * The control on the control. Answering `*` here would turn a
     * misconfigured allowlist into an open one — the browser would accept it
     * and nobody would ever learn the list was wrong. It answers the first
     * configured origin, which the browser compares to its own and rejects.
     */
    const said = allowOrigin(PAGES, 'https://evil.example');
    expect(said).toBe(PAGES);
    expect(said).not.toBe('*');
  });

  it('and a request with no Origin header at all is not a browser', () => {
    expect(allowOrigin(PAGES, null)).toBe(PAGES);
    expect(allowOrigin(PAGES, '')).toBe(PAGES);
  });

  it('reproduces the incident: localhost configured, Pages asking', () => {
    // Exactly the live misconfiguration. The header comes back as localhost,
    // the browser on the Pages origin rejects it, and `fetch` throws "Load
    // failed" with nothing logged anywhere. This is the case that cost a day.
    expect(allowOrigin(LOCAL, PAGES)).toBe(LOCAL);
    expect(allowOrigin(LOCAL, PAGES)).not.toBe(PAGES);
    // And with both listed, the same request succeeds — the fix, in one line.
    expect(allowOrigin(`${LOCAL},${PAGES}`, PAGES)).toBe(PAGES);
  });
});

describe('the headers as a whole', () => {
  it('varies on Origin, because the answer now depends on it', () => {
    // Without this a shared cache can hand one origin's header to another, and
    // the failure appears and disappears depending on who asked first.
    expect(corsHeaders(`${PAGES},${LOCAL}`, PAGES).Vary).toBe('Origin');
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

describe('every function that reads the secret uses the shared rule', () => {
  /*
   * The tripwire. Three functions read `ALLOWED_ORIGIN`, and the fault was
   * that they each spread one fixed value. A fourth written the old way — or
   * one of these three quietly reverted — is the recurrence, and nothing else
   * here would notice.
   */
  const root = join(process.cwd(), '..');
  const read = (p: string) => readFileSync(join(root, p), 'utf8');

  for (const fn of ['claude', 'fetchcal', 'canvas']) {
    it(`${fn} builds its headers per request`, () => {
      const src = read(`supabase/functions/${fn}/index.ts`);
      expect(src, `${fn} no longer imports the shared rule`).toContain("_shared/cors.ts");
      expect(src, `${fn} builds CORS per request`).toMatch(
        /const cors = corsHeaders\(Deno\.env\.get\('ALLOWED_ORIGIN'\), req\.headers\.get\('Origin'\)\)/,
      );
      // The old shape: a module-level object with the header written out by
      // hand. Its return is what this whole file exists to prevent.
      expect(src, `${fn} has a hand-written Allow-Origin again`).not.toMatch(
        /'Access-Control-Allow-Origin':\s*Deno\.env\.get/,
      );
    });
  }
});
