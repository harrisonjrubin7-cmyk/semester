import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The type scale, and how far the app has drifted off it.
 *
 * `styles/app.css` names six sizes — `--type-xs` through `--type-xl` — and each
 * one expands to exactly the `calc(Npx * var(--text-scale, 1))` that screens
 * were writing by hand. Eight hundred and thirty of those were the six named
 * sizes spelled out longhand, which is not a difference of opinion about type;
 * it is the same value written two ways, and the second way is invisible to
 * anybody changing the scale.
 *
 * Those are gone. What is left is real drift: sizes that are genuinely not on
 * the scale, most of them half a pixel off one that is. This file holds the
 * line at both ends — no going back to longhand, and no more drift than there
 * is today.
 */

const TOKENS: Record<string, string> = {
  '11': 'xs',
  '12': 'sm',
  '13': 'base',
  '14': 'md',
  '15': 'lg',
  '26': 'xl',
};

/** Every `.tsx` under `src`, read once. */
function sources(dir: string, out: { path: string; text: string }[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sources(path, out);
    else if (entry.name.endsWith('.tsx')) out.push({ path, text: readFileSync(path, 'utf8') });
  }
  return out;
}

const FILES = sources(join(process.cwd(), 'src'));
const HAND = /calc\((\d+(?:\.\d+)?)px \* var\(--text-scale, 1\)\)/g;

function found() {
  const hits: { path: string; px: string }[] = [];
  for (const f of FILES) {
    for (const m of f.text.matchAll(HAND)) hits.push({ path: f.path, px: m[1] });
  }
  return hits;
}

describe('the type scale', () => {
  it('has no size written longhand that a token already names', () => {
    const wrong = found()
      .filter((h) => TOKENS[h.px])
      .map((h) => `${h.path.split('/src/')[1]} — ${h.px}px is var(--type-${TOKENS[h.px]})`);
    // Named rather than counted: the failure has to say which file, or the
    // next person has to run the grep this test exists to replace.
    expect([...new Set(wrong)]).toEqual([]);
  });

  /*
   * A budget, not a ban.
   *
   * Six hundred-odd sizes are genuinely off the scale — 11.5, 12.5, 13.5 and a
   * long tail of display sizes used once each. Snapping them is a change to how
   * the app looks on every screen, which is a decision to take deliberately and
   * not a side effect of a cleanup pass. So this does not fail on them; it
   * stops there being more of them than there are today, and the number is
   * written down here where a change to it is visible in a diff.
   */
  it('has not drifted further off it', () => {
    const off = found().filter((h) => !TOKENS[h.px]);
    expect(off.length).toBeLessThanOrEqual(711);
  });

  it('still defines every token it claims to', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/app.css'), 'utf8');
    for (const [px, name] of Object.entries(TOKENS)) {
      expect(css).toContain(`--type-${name}: calc(${px}px * var(--text-scale, 1))`);
    }
  });
});

/**
 * The same three questions about leading.
 *
 * `--leading-tight`, `--leading-normal` and `--leading-relaxed` are 1.3, 1.45
 * and 1.5, and five hundred and twenty-three inline styles were writing those
 * three numbers out. A bare number and the token compute to the same unitless
 * line-height, so swapping them changed nothing on screen and everything about
 * whether the three values can be moved together.
 */
const LEADING: Record<string, string> = {
  '1.3': 'tight',
  '1.45': 'normal',
  '1.5': 'relaxed',
};

const NUMERIC = /lineHeight: (\d+(?:\.\d+)?)/g;

function leadings() {
  const hits: { path: string; n: string }[] = [];
  for (const f of FILES) {
    for (const m of f.text.matchAll(NUMERIC)) hits.push({ path: f.path, n: m[1] });
  }
  return hits;
}

describe('the leading scale', () => {
  it('has no line height written as a number that a token already names', () => {
    const wrong = leadings()
      .filter((h) => LEADING[h.n])
      .map((h) => `${h.path.split('/src/')[1]} — ${h.n} is var(--leading-${LEADING[h.n]})`);
    expect([...new Set(wrong)]).toEqual([]);
  });

  /* The same budget, for the same reason: 1.55, 1.4, 1.35 and a tail below
     them are a hundred-odd real decisions, and folding them into three steps
     is a change to how every paragraph in the app sets. Not here. */
  it('has not drifted further off it', () => {
    expect(leadings().filter((h) => !LEADING[h.n]).length).toBeLessThanOrEqual(234);
  });

  it('still defines every token it claims to', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/app.css'), 'utf8');
    for (const [n, name] of Object.entries(LEADING)) {
      expect(css).toContain(`--leading-${name}: ${n};`);
    }
  });
});

/**
 * And the third: spacing.
 *
 * This one is not only about naming. `--sp-*` multiplies by `--density`, the
 * Comfortable / Snug / Tight setting, and a margin written as a plain number
 * is a margin that setting cannot reach. It reached 5.3% of the elements on
 * screen before this; 27.3% after. So a number here that a step already names
 * is not a synonym — it is a piece of the app opting out of a setting the user
 * was offered.
 */
const SP: Record<string, string> = {
  '2': '1',
  '4': '2',
  '6': '3',
  '8': '4',
  '10': '5',
  '12': '6',
  '16': '7',
};

const SPACING = new RegExp(
  '\\b(gap|rowGap|columnGap|margin(?:Top|Bottom|Left|Right)|padding(?:Top|Bottom|Left|Right)?): (\\d+)(?![0-9.])',
  'g',
);

function spacings() {
  const hits: { path: string; prop: string; n: string }[] = [];
  for (const f of FILES) {
    for (const m of f.text.matchAll(SPACING)) hits.push({ path: f.path, prop: m[1], n: m[2] });
  }
  return hits;
}

describe('the spacing scale', () => {
  it('has no gap or margin written as a number that a step already names', () => {
    const wrong = spacings()
      .filter((h) => SP[h.n])
      .map((h) => `${h.path.split('/src/')[1]} — ${h.prop}: ${h.n} is var(--sp-${SP[h.n]})`);
    expect([...new Set(wrong)]).toEqual([]);
  });

  /* 558 left, and they are real: 14, 7, 9, 18 and a tail, none of which is a
     step. Folding them in is a change to the look, not a change of name. */
  it('has not drifted further off it', () => {
    expect(spacings().filter((h) => !SP[h.n]).length).toBeLessThanOrEqual(558);
  });

  it('still multiplies every step by the density setting', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/app.css'), 'utf8');
    for (const [px, step] of Object.entries(SP)) {
      // The multiplier is the whole point: a step that lost it would look
      // right and silently switch the setting off wherever it was used.
      expect(css).toContain(`--sp-${step}: calc(${px}px * var(--density, 1))`);
    }
  });
});
