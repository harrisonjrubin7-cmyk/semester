import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EDGE_GUARDS } from './edgeguards';

/**
 * Every edge function is listed with the credential it answers to, and its
 * source carries the evidence. See `edgeguards.ts` for why: `config.toml` turns
 * the platform's JWT check off everywhere, so a function with no check of its
 * own is open and nothing else would say so.
 */

const FUNCTIONS_DIR = join(__dirname, '../../../supabase/functions');
const CONFIG = readFileSync(join(__dirname, '../../../supabase/config.toml'), 'utf8');

const onDisk = readdirSync(FUNCTIONS_DIR)
  .filter((n) => !n.startsWith('_') && statSync(join(FUNCTIONS_DIR, n)).isDirectory())
  .sort();
const source = (fn: string) => readFileSync(join(FUNCTIONS_DIR, fn, 'index.ts'), 'utf8');

describe('the registry and the directory', () => {
  it('has functions to be right or wrong about', () => {
    expect(onDisk.length).toBeGreaterThan(5);
  });

  it('lists every function that exists, so a new one cannot be deployed unguarded', () => {
    const listed = new Set(EDGE_GUARDS.map((g) => g.fn));
    expect(onDisk.filter((f) => !listed.has(f)), 'functions with no declared guard').toEqual([]);
  });

  it('lists nothing that does not exist', () => {
    expect(EDGE_GUARDS.map((g) => g.fn).filter((f) => !onDisk.includes(f))).toEqual([]);
  });

  it('lists each function once', () => {
    const names = EDGE_GUARDS.map((g) => g.fn);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('each function carries the evidence for its guard', () => {
  for (const g of EDGE_GUARDS) {
    it(`${g.fn} (${g.guards.join(' or ')})`, () => {
      const src = source(g.fn);
      for (const e of g.evidence) expect(src, `${g.fn} should match ${e}`).toMatch(e);
    });
  }
});

describe('a function that answers anyone says so, and why', () => {
  it('gives a reason for every public function, and only for them', () => {
    for (const g of EDGE_GUARDS) {
      if (g.guards.includes('public')) expect(g.why && g.why.length > 40, `${g.fn} needs a reason`).toBe(true);
      else expect(g.why, `${g.fn} is not public`).toBeUndefined();
    }
  });

  it('keeps the public list short enough to read', () => {
    expect(EDGE_GUARDS.filter((g) => g.guards.includes('public')).map((g) => g.fn)).toEqual(['lead-intake']);
  });
});

describe('config.toml agrees that the platform check is off, so the function check is the only one', () => {
  it('turns verify_jwt off exactly for the listed functions', () => {
    const off = [...CONFIG.matchAll(/\[functions\.([a-z0-9-]+)\]\s*\nverify_jwt\s*=\s*false/g)].map((m) => m[1]).sort();
    expect(off).toEqual(EDGE_GUARDS.map((g) => g.fn).sort());
  });
});
