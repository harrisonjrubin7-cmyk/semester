/// <reference types="node" />
// Reads real files on purpose, like handout.test.ts: the fault this guards is
// two files drifting apart, and a fixture would drift with them.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { incidentProblems } from '../../scripts/status-history.mjs';

/**
 * `public/status.html` sits outside the bundle so it still renders when the
 * app does not, which means Vite never gives it the build's Supabase values.
 * It carries its own copy. If the project moves and only `.env.production` is
 * updated, the status page goes on probing the old project and reports
 * whatever that one is doing — a status page that is confidently wrong.
 */
const root = process.cwd();
const page = readFileSync(join(root, 'public', 'status.html'), 'utf8');
const env = readFileSync(join(root, '.env.production'), 'utf8');

const envValue = (name: string): string => {
  const line = env.split('\n').find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} missing from .env.production`);
  return line.slice(name.length + 1).trim();
};
const pageValue = (name: string): string => {
  const match = page.match(new RegExp(`var ${name} = '([^']+)'`));
  if (!match) throw new Error(`${name} missing from status.html`);
  return match[1];
};

describe('the status page', () => {
  it('probes the same Supabase project the app is built against', () => {
    expect(pageValue('SUPABASE_URL')).toBe(envValue('VITE_SUPABASE_URL'));
  });

  it('uses the publishable key the app already ships, never a secret one', () => {
    const key = pageValue('SUPABASE_KEY');
    expect(key).toBe(envValue('VITE_SUPABASE_KEY'));
    expect(key.startsWith('sb_publishable_')).toBe(true);
  });

  it('probes the database API the hourly smoke check probes, not only sign-in', () => {
    const read = '/rest/v1/schools?select=id&limit=1';
    expect(readFileSync(join(root, 'scripts', 'public-production-smoke.mjs'), 'utf8')).toContain(read);
    expect(page).toContain(`SUPABASE_URL + '${read}'`);
  });

  /**
   * The service worker answers same-origin GETs from its cache. Anyone who has
   * used the app has `index.html` and the incident list in there, so without
   * this the page reports the app up because it was up once, and shows the
   * incident list from before the incident. The page asks with `no-store`; the
   * worker has to honour that before any branch that could answer from cache.
   */
  it('is never answered from the service worker’s cache', () => {
    const sw = readFileSync(join(root, 'public', 'sw.js'), 'utf8');
    const pass = sw.indexOf("if (request.cache === 'no-store') return;");
    expect(pass, 'sw.js no longer passes no-store requests to the network').toBeGreaterThan(-1);
    expect(pass).toBeLessThan(sw.indexOf("request.mode === 'navigate'"));
    expect(pass).toBeLessThan(sw.indexOf('caches.match(request'));
    // And every same-origin request the page makes asks for it.
    const sameOrigin = [...page.matchAll(/fetch\('(\.\/[^']+)'([^)]*)\)/g)];
    expect(sameOrigin.map((m) => m[1])).toContain('./status-incidents.json');
    for (const m of sameOrigin) expect(m[2], m[1]).toContain("cache: 'no-store'");
    expect(page).toMatch(/fetch\(check\.url, \{ cache: 'no-store'/);
  });

  it('has an incident list that parses, in the structure the page and the feed read', () => {
    const data = JSON.parse(readFileSync(join(root, 'public', 'status-incidents.json'), 'utf8'));
    expect(Array.isArray(data.incidents)).toBe(true);
    expect(incidentProblems(data)).toEqual([]);
  });
});
