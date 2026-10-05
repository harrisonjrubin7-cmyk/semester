import { describe, expect, it } from 'vitest';
import { sources, withoutComments } from './rules';

/**
 * A colour is a token unless somebody wrote down why it is not (DD-009).
 *
 * Thirteen grounds and eleven accents are the only place a colour is decided,
 * and `lib/contrast.test.ts` measures everything they can produce. A hex
 * written into a component is one colour on every ground, outside that test —
 * the fault `warnFor` in `lib/look.ts` was written to undo, and the one the
 * design census counted (31 of them) without stopping anyone adding a
 * thirty-second.
 *
 * This is the ledger the census's number lacked. It has the shape of
 * `styles/budget.ts`: each file is listed with how many literals it holds and
 * why they are not tokens. More than listed fails; a file that is not listed
 * fails at one; fewer than listed fails too, so a fixed file has to be taken
 * off the list and the list can only get shorter.
 *
 * The count is the census's own — a quoted `#rgb` to `#rrggbbaa`, comments
 * stripped — so the number here and the one `npm run census:design` prints
 * are the same number. Colours inside a template or a stylesheet are not read
 * by either.
 *
 * Every entry below is a colour that *must not* follow the ground: a canvas
 * the student exports, a video frame, a scannable code, a third-party
 * renderer's theme, or a map marker drawn outside the DOM.
 */

const WHY = {
  export: 'Drawn onto a canvas that becomes an exported image; it must look the same whatever ground the student is on.',
  video: 'A video frame or letterbox. Black behind footage is the picture, not the theme.',
  scan: 'A code a camera has to read; it needs its own ground whatever the app is wearing.',
  third: "A third-party renderer's own theme object, which takes hex and cannot read CSS variables.",
  map: 'A Leaflet marker drawn as an HTML string outside React, where var() is not resolved against the ground.',
  call: 'The call surface is black on every ground by design: the video sits on it and white ink is measured against that black.',
  meta: 'A <meta name="theme-color"> value; a browser reads it before any stylesheet exists.',
} as const;

export const LEDGER: Record<string, { count: number; why: string }> = {
  'components/Drawing.tsx': { count: 7, why: WHY.third },
  'components/LiveMap.tsx': { count: 4, why: WHY.map },
  'components/ScanIsbn.tsx': { count: 1, why: WHY.video },
  'components/SemesterWrapped.tsx': { count: 2, why: WHY.export },
  'components/Subscribe.tsx': { count: 1, why: WHY.scan },
  'components/creation/DesignEditor.tsx': { count: 6, why: 'The design editor’s own canvas chrome (selection blue, comment red, white handle rings) and the default gradient stop; the artwork is the student’s, not the theme’s.' },
  'components/creation/VideoEditor.tsx': { count: 3, why: WHY.video },
  'screens/call/Green.tsx': { count: 2, why: WHY.call },
  'screens/call/Tile.tsx': { count: 3, why: WHY.call },
  'site/render.tsx': { count: 1, why: WHY.meta },
};

const HEX = /['"`]#[0-9a-fA-F]{3,8}\b/g;
const dir = new URL('..', import.meta.url).pathname;

function counts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of sources(dir, { tests: false })) {
    const n = withoutComments(f.text).match(HEX)?.length ?? 0;
    if (n) out[f.path.slice(dir.length)] = n;
  }
  return out;
}

describe('hex colour literals in .tsx are on the ledger', () => {
  const now = counts();

  it('has none in a file that is not listed, and no more than a listed file owes', () => {
    const over = Object.entries(now)
      .filter(([file, n]) => n > (LEDGER[file]?.count ?? 0))
      .map(([file, n]) => `${file}: ${n} hex literals, ledger allows ${LEDGER[file]?.count ?? 0}`);
    expect(over, 'use an --app-* / --chart-* token, or list the file with a reason').toEqual([]);
  });

  it('lists no more than a file still holds', () => {
    const stale = Object.entries(LEDGER)
      .filter(([file, { count }]) => (now[file] ?? 0) < count)
      .map(([file, { count }]) => `${file}: ledger says ${count}, file has ${now[file] ?? 0}`);
    expect(stale, 'lower the count or delete the entry: the ledger only shrinks').toEqual([]);
  });

  it('gives every entry a reason', () => {
    for (const [file, { why }] of Object.entries(LEDGER)) expect(why.trim().length, file).toBeGreaterThan(20);
  });

  it('reads the tree, and its total is the one the census prints', () => {
    expect(Object.keys(now).length).toBeGreaterThan(0);
    expect(Object.values(now).reduce((a, b) => a + b, 0)).toBe(
      Object.values(LEDGER).reduce((a, { count }) => a + count, 0),
    );
  });
});
