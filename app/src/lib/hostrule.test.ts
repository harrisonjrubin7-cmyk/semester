import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The public-host rule is written twice — `publichost.ts` (tested, used by the dev server's calendar
 * forwarder) and `supabase/functions/fetchcal/index.ts` (deployed alone to Deno, which cannot import
 * from the app). Two copies drift. They did: the deployed one lacked the empty-host refusal the tested
 * one had, and both missed IPv4-in-IPv6 as a URL spells it. This holds the code between the markers
 * identical in both, so a fix to one cannot ship without the other.
 */

const root = join(import.meta.dirname, '../../..');
const BEGIN = '// --- host rule: begin';
const END = '// --- host rule: end';

/** The rule between the markers, with comments, `export` and whitespace removed, so only the logic is compared. */
function ruleOf(source: string): string {
  const a = source.indexOf(BEGIN);
  const b = source.indexOf(END);
  if (a < 0 || b < a) throw new Error('markers missing or out of order');
  return source
    .slice(a, b)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\bexport\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const tested = readFileSync(join(root, 'app/src/lib/publichost.ts'), 'utf8');
const deployed = readFileSync(join(root, 'supabase/functions/fetchcal/index.ts'), 'utf8');

describe('the host rule in its two homes', () => {
  it('is the same code in both', () => {
    expect(ruleOf(deployed)).toBe(ruleOf(tested));
  });

  it('is not empty (a comparison of two nothings would pass)', () => {
    expect(ruleOf(tested)).toMatch(/function privateHost/);
    expect(ruleOf(tested).length).toBeGreaterThan(500);
  });

  it('control: a one-character change to either copy is seen', () => {
    expect(ruleOf(tested.replace('a === 169 && b === 254', 'a === 169 && b === 253'))).not.toBe(ruleOf(deployed));
    expect(ruleOf(deployed.replace("h.endsWith('.internal')", "h.endsWith('.internals')"))).not.toBe(ruleOf(tested));
  });
});
