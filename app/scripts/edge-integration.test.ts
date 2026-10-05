import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OUT, render } from './edge-integration.ts';

describe('the Edge Function copy of the integration tick', () => {
  it('is exactly what the generator writes, file for file', () => {
    // A change to the tick, the worker or the library that is not re-copied
    // would deploy the old code while every app test passes on the new.
    const want = render();
    expect(want.size, 'the generator rendered nothing').toBeGreaterThan(5);
    expect(readdirSync(OUT).sort()).toEqual([...want.keys()].sort());
    for (const [name, text] of want) {
      expect(readFileSync(join(OUT, name), 'utf8'), `${name} is stale: cd app && node scripts/edge-integration.ts`).toBe(text);
    }
  });

  it('carries no import Deno cannot resolve', () => {
    for (const [name, text] of render()) {
      for (const m of text.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
        expect(m[1], `${name}: ${m[1]}`).toMatch(/^(\.\/[a-z-]+\.ts|jsr:@supabase\/supabase-js@2)$/);
      }
    }
  });

  it('and would notice a stale copy (the control)', () => {
    const [name, text] = [...render()][0];
    expect(text.replace('export', 'export ')).not.toBe(readFileSync(join(OUT, name), 'utf8'));
  });
});
