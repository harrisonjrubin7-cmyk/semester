import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Glass is allowed in four places, and each can be made opaque.
 *
 * `docs/ELEVATION-AND-GLASS-POLICY.md` lists them: the header and the tab
 * bar (chrome over scrolling content), the soft layout's folder and the
 * Focus bar (transient overlays). Never a card, a table, a form or anything
 * somebody reads at length — text over a moving blur is contrast nobody can
 * test.
 *
 * And every one of them has to go opaque when the person asks for less
 * transparency or more contrast. Before this file the three that already
 * existed fell back only when the *platform* could not blur, which is the
 * case nobody was asking about.
 */

const DIR = new URL('.', import.meta.url).pathname;
const SHEETS = readdirSync(DIR)
  .filter((f) => f.endsWith('.css'))
  .map((f) => ({ f, css: readFileSync(join(DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }));

const ALLOWED = ['.app-header', '.app-tabs', '.soft-folder', '.focus-bar'];

/** Every selector that turns a blur on, with the sheet it is in. */
function blurred(): { f: string; selector: string }[] {
  const out: { f: string; selector: string }[] = [];
  for (const { f, css } of SHEETS) {
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/(?:^|[;\s])backdrop-filter:\s*(?!none)[^;]+;/.test(m[2])) continue;
      for (const sel of m[1].split(',')) out.push({ f, selector: sel.trim() });
    }
  }
  return out;
}

describe('the glass policy', () => {
  it('finds the blurs it is about', () => {
    expect(blurred().length).toBeGreaterThanOrEqual(4);
  });

  it('allows a blur only on the listed surfaces', () => {
    const off = blurred().filter(({ selector }) => !ALLOWED.some((a) => selector.endsWith(a)));
    expect(off.map((o) => `${o.f}: ${o.selector}`)).toEqual([]);
  });

  it('makes every allowed surface opaque for reduced transparency and more contrast', () => {
    const unity = SHEETS.find((s) => s.f === 'unity.css')!.css;
    const media = /@media \(prefers-reduced-transparency: reduce\), \(prefers-contrast: more\), \(forced-colors: active\)\s*\{([\s\S]*?)\n\}/.exec(unity);
    expect(media, 'the reduced-transparency block').not.toBeNull();
    for (const a of ALLOWED) {
      expect(media![1], a).toContain(a);
    }
    expect(media![1]).toContain('backdrop-filter: none');
  });

  it('and for the app’s own Low stimulation setting', () => {
    const unity = SHEETS.find((s) => s.f === 'unity.css')!.css;
    for (const a of ALLOWED) {
      expect(unity, a).toContain(`:root[data-calm='calm'] ${a}`);
    }
  });
});
