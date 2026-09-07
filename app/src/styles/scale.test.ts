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
