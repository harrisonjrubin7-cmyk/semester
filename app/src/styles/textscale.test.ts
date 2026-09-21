import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every font size in the stylesheets answers the Text size setting.
 *
 * `styles/rules.ts` already argues this, in the words it fails with: "a bare
 * number or a raw `px` is a piece of the app that setting cannot reach: it
 * looks right on the machine it was written on and stays small for anybody
 * who needs larger type." It enforces it across about twelve hundred inline
 * `fontSize:` in TSX — and it reads `.tsx` only, by the default on `sources`.
 * The three stylesheets were never looked at, and they are where the classes
 * used on every screen live.
 *
 * Measured in Chromium with its default font raised from 16 to 24, which is
 * the ordinary way somebody with low vision makes the web readable and is the
 * exact reader `lib/look.ts` describes the root-size fix being for — "every
 * other site they had made bigger; this one quietly undid it". Across eight
 * screens, 481 text elements:
 *
 *     before   419 grew with the setting, 62 did not   (13%)
 *     after    476 grew,                    5 did not   (1%)
 *
 * The 62 included `.kicker`, which sits above every screen title, and
 * `.skip-link`, which is the first thing a keyboard user meets. The kicker
 * went from 43% of the screen title's size to 29% of it for the reader who
 * had asked for larger type. That is 1.4.4 Resize Text, and it is AA.
 *
 * The five that remain are Leaflet's own furniture — its zoom glyphs and its
 * attribution line — and they are listed below rather than fixed: the control
 * sizes itself, and growing the text inside it is how a third-party widget's
 * layout breaks. `density.test.ts` leaves the same component's geometry alone
 * for the same reason.
 *
 * ## What this cost at the default setting, which is nothing
 *
 * `calc(15px * var(--text-scale, 1))` is 15px when the scale is 1, so an app
 * on an unchanged browser is unchanged. Proved rather than reasoned: 481 text
 * elements over the same eight screens, computed `font-size` and
 * `line-height` compared either side of this change at the 16px default —
 * **0 differed**, and neither set had an element the other lacked.
 */
const DIR = join(process.cwd(), 'src/styles');

/**
 * The four kinds that are allowed to be absolute, each because the setting is
 * not the thing that should move them.
 *
 * Written as a predicate over the value rather than a list of line numbers:
 * a line number is a thing that rots the moment somebody adds a rule above it,
 * which is the class of fault this whole file is about.
 */
const allowed = (value: string): boolean =>
  /^\d+(\.\d+)?(pt|cm|mm|in)$/.test(value) || // print, in physical units
  /var\(--doc-size/.test(value) || //            a document's own zoom control
  /^clamp\(/.test(value) || //                   display type sized by viewport
  /^\d+(\.\d+)?(em|%|rem)$/.test(value); //      already relative

/** Only the third-party control's own furniture, by selector. */
const THIRD_PARTY = /\.leaflet-/;

const sheets = (): { name: string; text: string }[] =>
  readdirSync(DIR)
    .filter((f) => f.endsWith('.css'))
    .map((f) => ({ name: f, text: readFileSync(join(DIR, f), 'utf8') }));

/** Comments blanked, so prose quoting a size is not read as a declaration. */
const code = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

interface Bad {
  where: string;
  value: string;
}

function unreachable(): Bad[] {
  const out: Bad[] = [];
  for (const { name, text } of sheets()) {
    const src = code(text);
    const lines = src.split('\n');
    for (const m of src.matchAll(/font-size:\s*([^;}!]+)/g)) {
      const v = m[1].trim();
      if (/var\(--text-scale/.test(v) || /var\(--type-/.test(v)) continue;
      if (!/\d/.test(v)) continue; // inherit, larger, smaller
      if (allowed(v)) continue;
      const at = src.slice(0, m.index).split('\n').length - 1;
      let selector = '';
      for (let i = at; i >= 0 && i > at - 40; i -= 1) {
        const t = lines[i].trim();
        if (t.includes('{')) {
          selector = t.slice(0, t.indexOf('{')).trim();
          break;
        }
      }
      if (THIRD_PARTY.test(selector)) continue;
      out.push({ where: `${name}:${at + 1}  ${selector}`, value: v });
    }
  }
  return out;
}

describe('the stylesheets and the Text size setting', () => {
  it('is reading stylesheets at all, so a clean result means something', () => {
    // The census-over-an-empty-list guard `sources()` carries, for the same
    // reason: a walk that finds no files passes without checking anything.
    const found = sheets();
    expect(found.length, 'no stylesheets under src/styles').toBeGreaterThanOrEqual(3);
    const total = found.reduce((n, s) => n + [...code(s.text).matchAll(/font-size:/g)].length, 0);
    expect(total, 'no font-size declarations found — the probe is broken').toBeGreaterThan(100);
  });

  it('leaves no font size the setting cannot reach', () => {
    const bad = unreachable();
    expect(
      bad,
      `font sizes the Text size setting cannot reach:\n  ${bad
        .map((b) => `${b.where}  →  ${b.value}`)
        .join('\n  ')}`,
    ).toEqual([]);
  });

  it('would catch a bare px, which is what it is here for', () => {
    // The rule applied to a decoy, because a rule that reports nothing on a
    // clean tree and nothing on a dirty one is not a rule. `.kicker` was
    // `font-size: 10px` and is the exact line this file was written for.
    const decoy = '.kicker { font-size: 10px; }';
    expect(/var\(--text-scale/.test(decoy)).toBe(false);
    expect(allowed('10px')).toBe(false);
    expect(allowed('calc(11px * var(--text-scale, 1))')).toBe(false);
  });

  it('lets the four absolute kinds through, and only those', () => {
    expect(allowed('9pt')).toBe(true);
    expect(allowed('calc(var(--doc-size) * 1.9)')).toBe(true);
    expect(allowed('clamp(28px, 5.2vw, 58px)')).toBe(true);
    expect(allowed('1.2em')).toBe(true);
    expect(allowed('13px')).toBe(false);
    expect(allowed('10.5px')).toBe(false);
  });
});
