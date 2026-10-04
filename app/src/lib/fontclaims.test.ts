import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BODYFACES, TYPEFACES } from './look';

/**
 * A typeface the app offers has to be a typeface the app can draw.
 *
 * "Hyperlegible" is offered to the reader for whom reading is tiring, described
 * as Atkinson Hyperlegible, and set as `"Atkinson Hyperlegible", system-ui,
 * sans-serif`. Nothing loads Atkinson: `typefaces.css` declares Barlow, Barlow
 * Condensed and Cinzel. So for everyone who does not happen to have it
 * installed — nearly everyone — the choice silently draws the system font while
 * its description promises something else, and the person who picked it for
 * legibility has been told something untrue.
 *
 * This holds every offered face to one of three things: an operating-system
 * family, a family with an `@font-face` in the stylesheets, or an entry on the
 * ledger below that says why not. The ledger only shrinks — bundle the font and
 * its entry must go — so the defect is recorded rather than forgotten, and no
 * new face can be offered on a hope.
 */

/** Families every supported operating system provides. The fallback is the same face, so the claim is true. */
const OS = new Set(
  ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Georgia', 'Times New Roman', 'ui-monospace', 'SF Mono', 'Menlo', 'Consolas', 'serif', 'sans-serif', 'monospace'].map((f) => f.toLowerCase()),
);

/** First family of a CSS font stack, unquoted and lower-cased. */
const first = (stack: string) => stack.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();

/** Families that have an `@font-face` in any stylesheet. */
function bundled(css: string[]): Set<string> {
  const out = new Set<string>();
  for (const sheet of css) {
    for (const block of sheet.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const fam = /font-family:\s*['"]?([^;'"]+)['"]?\s*;/.exec(block[1]);
      if (fam) out.add(fam[1].trim().toLowerCase());
    }
  }
  return out;
}

/** Offered faces with nothing behind them, other than those the ledger accounts for. */
export function unbacked(stacks: string[], have: Set<string>, ledger: Set<string>): string[] {
  return [...new Set(stacks.map(first))].filter((f) => !OS.has(f) && !have.has(f) && !ledger.has(f));
}

/** Offered but not bundled, and why. Delete the entry when the font ships. */
const LEDGER: Record<string, string> = {
  'atkinson hyperlegible':
    'Offered as the legibility body face but not bundled: it draws as the system font unless the reader has it installed. Bundling it (SIL OFL) is an owner decision recorded in the design-system spec, §11.',
};

const styles = new URL('../styles/', import.meta.url);
const sheets = readdirSync(styles).filter((f) => f.endsWith('.css')).map((f) => readFileSync(new URL(f, styles), 'utf8'));
const have = bundled(sheets);
const offered = [...TYPEFACES.map((t) => t.heading), ...BODYFACES.map((b) => b.body)];

describe('every offered typeface can be drawn', () => {
  it('reads the stylesheets, and finds the faces the app does bundle', () => {
    expect(have.has('barlow')).toBe(true);
    expect(have.has('barlow condensed')).toBe(true);
  });

  it('has no face that is neither an OS family, bundled, nor on the ledger', () => {
    expect(unbacked(offered, have, new Set(Object.keys(LEDGER))), 'bundle it with an @font-face, or list it with a reason').toEqual([]);
  });

  it('lists only what is still true: offered, and still not bundled', () => {
    const stale = Object.keys(LEDGER).filter((f) => have.has(f) || !offered.map(first).includes(f));
    expect(stale, 'the ledger only shrinks — remove an entry once its font ships or is no longer offered').toEqual([]);
  });

  it('gives every entry a reason', () => {
    for (const [f, why] of Object.entries(LEDGER)) expect(why.length, f).toBeGreaterThan(40);
  });

  it('is not vacuous: it flags a face with nothing behind it', () => {
    expect(unbacked(['"Comic Neue", system-ui'], have, new Set())).toEqual(['comic neue']);
    expect(unbacked(['"Atkinson Hyperlegible", system-ui'], have, new Set())).toEqual(['atkinson hyperlegible']);
  });
});
