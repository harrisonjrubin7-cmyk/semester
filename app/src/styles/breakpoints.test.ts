import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DESKTOP_AT, EXTRA_LARGE_AT, MEDIUM_AT, TABLET_AT, TALL_AT } from '../lib/media';

/**
 * A layout boundary is one of the window classes, or it is on the ledger.
 *
 * `lib/media.ts` names the boundaries once and `lib/tiers.test.ts` holds the
 * *min-width* queries in `app.css` to them. That leaves the rest of the
 * stylesheets free to write any number into a media query, and four of them
 * did: after the boundaries moved from 760 and 1180 to 840 and 1200, the
 * portal sheet (`features.css`) and the unity layer kept the old ones. Between
 * 760 and 839, and again between 1180 and 1199, those blocks lay a screen out
 * for a different window class than the shell around it.
 *
 * This reads every stylesheet and every width and height condition in every
 * media query. A boundary is allowed if it is a class edge — `min-width` at
 * the edge, `max-width` at the pixel before it — or it is listed below with
 * the file it is in and why. It has the shape of `hex.test.ts`: more than
 * listed fails, an unlisted one fails, and fewer than listed fails too, so a
 * fixed query has to come off the list and the list can only get shorter.
 *
 * It does not move any of them. Re-pointing a block at the class edge changes
 * what is drawn at those widths, so each is a screenshot-checked change of its
 * own, and the ledger is the queue for it.
 */

const dir = new URL('./', import.meta.url);

/** What a query may say without a reason: the edges of the window classes. */
const EDGES = {
  'min-width': [MEDIUM_AT, TABLET_AT, DESKTOP_AT, EXTRA_LARGE_AT, 900],
  'max-width': [MEDIUM_AT - 1, TABLET_AT - 1, DESKTOP_AT - 1, 899],
  'min-height': [] as number[],
  'max-height': [TALL_AT - 1],
} as const;

const WHY = {
  old: 'Written against the 760 and 1180 boundaries that media.ts moved to 840 and 1200; between the old and new edge this block lays out for a different window class than the shell.',
  narrow: 'A small-phone adjustment below the compact edge, not a window class. Tolerated because it only narrows; it should become a container query or the 599 edge.',
  inclusive: 'Written as the edge itself rather than the pixel before it, so the block applies one pixel into the next class.',
  midDesktop: 'A one-off boundary between expanded and large with no class behind it.',
} as const;

type Entry = { count: number; why: string };

/** file → condition → the number of queries that use it and why they are not class edges. */
export const LEDGER: Record<string, Record<string, Entry>> = {
  'app.css': {
    'max-width: 520px': { count: 1, why: WHY.narrow },
    'max-width: 559px': { count: 1, why: WHY.narrow },
    'max-width: 560px': { count: 3, why: WHY.narrow },
    'max-width: 600px': { count: 1, why: WHY.inclusive },
    'max-width: 640px': { count: 2, why: WHY.narrow },
    'max-width: 900px': { count: 1, why: WHY.inclusive },
    'max-width: 1100px': { count: 1, why: WHY.midDesktop },
  },
  'features.css': {
    'min-width: 1180px': { count: 1, why: WHY.old },
    'max-width: 1179px': { count: 2, why: WHY.old },
    'max-width: 759px': { count: 3, why: WHY.old },
  },
  'form-usability.css': {
    'max-width: 639px': { count: 1, why: WHY.narrow },
  },
  'unity.css': {
    'max-width: 759px': { count: 1, why: WHY.old },
    'max-width: 639px': { count: 1, why: WHY.narrow },
  },
};

const CONDITION = /\(\s*(min|max)-(width|height)\s*:\s*([\d.]+)(px|em|rem)\s*\)/g;

interface Found {
  /** Every condition outside the edges, counted per file. */
  off: Record<string, Record<string, number>>;
  /** Every condition counted, edge or not — proves the scan reads the tree. */
  total: number;
  /** Queries carrying a length this scan could not read (range syntax, a unit it ignores). */
  unreadable: string[];
}

const stylesheets = (): Record<string, string> =>
  Object.fromEntries(
    readdirSync(dir)
      .filter((f) => f.endsWith('.css'))
      .map((f) => [f, readFileSync(new URL(f, dir), 'utf8')]),
  );

function scan(sources: Record<string, string> = stylesheets()): Found {
  const out: Found = { off: {}, total: 0, unreadable: [] };
  for (const [file, text] of Object.entries(sources)) {
    const css = text.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/@media([^{]*)\{/g)) {
      const prelude = m[1];
      const lengths = [...prelude.matchAll(/[\d.]+(px|em|rem)/g)].length;
      const conditions = [...prelude.matchAll(CONDITION)];
      if (lengths !== conditions.length) out.unreadable.push(`${file}: @media${prelude.trimEnd()}`);
      for (const c of conditions) {
        out.total += 1;
        const edges: readonly number[] = EDGES[`${c[1]}-${c[2]}` as keyof typeof EDGES];
        if (c[4] === 'px' && edges.includes(Number(c[3]))) continue;
        const key = `${c[1]}-${c[2]}: ${c[3]}${c[4]}`;
        ((out.off[file] ??= {})[key] ??= 0);
        out.off[file][key] += 1;
      }
    }
  }
  return out;
}

describe('media query boundaries', () => {
  const now = scan();

  it('reads every stylesheet it can see, and every length in them', () => {
    expect(now.total).toBeGreaterThan(40);
    expect(now.unreadable, 'write widths as (min-width: Npx) / (max-width: Npx) so this guard can read them').toEqual([]);
  });

  it('has no boundary that is neither a class edge nor on the ledger', () => {
    const over: string[] = [];
    for (const [file, conds] of Object.entries(now.off)) {
      for (const [cond, n] of Object.entries(conds)) {
        const allowed = LEDGER[file]?.[cond]?.count ?? 0;
        if (n > allowed) over.push(`${file}: ${n} × ${cond}, ledger allows ${allowed}`);
      }
    }
    expect(over, 'use a window-class edge from lib/media.ts (and the pixel before it for max-width), or list it with a reason').toEqual([]);
  });

  it('lists no more than the files still hold', () => {
    const stale: string[] = [];
    for (const [file, conds] of Object.entries(LEDGER)) {
      for (const [cond, { count }] of Object.entries(conds)) {
        const n = now.off[file]?.[cond] ?? 0;
        if (n < count) stale.push(`${file}: ledger says ${count} × ${cond}, file has ${n}`);
      }
    }
    expect(stale, 'lower the count or delete the entry: the ledger only shrinks').toEqual([]);
  });

  it('gives every entry a reason', () => {
    for (const [file, conds] of Object.entries(LEDGER)) {
      for (const [cond, { why }] of Object.entries(conds)) expect(why.trim().length, `${file} ${cond}`).toBeGreaterThan(20);
    }
  });

  it('knows the old edges are the ones it is protecting against', () => {
    // If 760 or 1180 ever become class edges again this ledger entry is wrong, not just stale.
    for (const old of [759, 760, 1179, 1180]) {
      expect([MEDIUM_AT, TABLET_AT, DESKTOP_AT, EXTRA_LARGE_AT]).not.toContain(old);
    }
  });
});

describe('the scan itself', () => {
  // A guard that has never failed is not known to be a guard: feed it a stylesheet and watch.
  const fake = (css: string) => scan({ 'fake.css': css });

  it('passes a class edge and the pixel before it', () => {
    const r = fake(`@media (min-width: ${TABLET_AT}px) { a{} } @media (max-width: ${TABLET_AT - 1}px) { a{} } @media (max-height: ${TALL_AT - 1}px) and (pointer: coarse) { a{} }`);
    expect(r.off).toEqual({});
    expect(r.unreadable).toEqual([]);
  });

  it('catches an old edge, an inclusive edge, and a stray height', () => {
    const r = fake('@media (min-width:1180px){a{}} @media (max-width: 840px){a{}} @media (max-height: 700px){a{}}');
    const keys = Object.values(r.off).flatMap((c) => Object.keys(c)).sort();
    expect(keys).toEqual(['max-height: 700px', 'max-width: 840px', 'min-width: 1180px']);
  });

  it('reports range syntax and other units instead of silently skipping them', () => {
    expect(fake('@media (width >= 800px) { a{} }').unreadable).toHaveLength(1);
    expect(fake('@media (min-width: 50em) { a{} }').off['fake.css']).toEqual({ 'min-width: 50em': 1 });
  });
});
