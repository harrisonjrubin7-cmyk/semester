import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { tokensFor } from '../lib/look';

/**
 * The semantic layer names values; it does not decide them.
 *
 * `tokens.css` sits between the per-ground primitives and the components.
 * Its whole value is that adopting a name changes the name and not the
 * number — so the four ways it could quietly stop being true are held here:
 *
 *   1. A semantic token pointing at a primitive that does not exist. CSS does
 *      not fail on that; the token computes to nothing and every component
 *      that reads it loses its colour on every ground at once.
 *   2. A colour written into the layer. It would be one colour on thirteen
 *      grounds, outside `lib/contrast.test.ts`, which is the exact fault
 *      `warnFor` in `lib/look.ts` was written to undo.
 *   3. A name shared with `industry.css`, which loads first and owns
 *      `--space-*`, `--radius-*` and `--shadow-*`: a same-named declaration
 *      here would retune the design system underneath.
 *   4. The ladder and the ring drifting from the numbers the app's own
 *      stacking, focus and target rules are written against.
 */

const read = (f: string) =>
  readFileSync(new URL(`./${f}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, ' '),
  );

const TOKENS = read('tokens.css');
const UNITY = read('unity.css');
const APP = read('app.css');
const INDUSTRY = read('industry.css');

const defined = (css: string) => new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

/** Everything `tokensFor` writes onto the root at runtime, on the default look. */
const runtime = new Set(Object.keys(tokensFor({}, false)));

/** The root block of tokens.css, name → value. */
function rootDefs(): Map<string, string> {
  const block = /:root\s*\{([\s\S]*?)\n\}/.exec(TOKENS)![1];
  return new Map([...block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

describe('the semantic token layer', () => {
  const defs = rootDefs();
  const everywhere = new Set([...defined(APP), ...defined(INDUSTRY), ...defined(TOKENS), ...runtime]);

  it('has the families the brief names', () => {
    for (const family of ['--surface-', '--text-', '--border-', '--action-', '--status-', '--focus-', '--target-', '--duration-', '--motion-', '--layer-', '--elevation-', '--shape-', '--layout-']) {
      expect([...defs.keys()].some((k) => k.startsWith(family)), family).toBe(true);
    }
  });

  it('points only at tokens that exist', () => {
    const missing: string[] = [];
    for (const [name, value] of defs) {
      for (const m of value.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
        if (!everywhere.has(m[1])) missing.push(`${name} → ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('writes no colour of its own', () => {
    expect(TOKENS).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(TOKENS).not.toMatch(/\brgba?\(|\bhsla?\(/i);
  });

  it('shares no name with industry.css', () => {
    const theirs = defined(INDUSTRY);
    expect([...defs.keys()].filter((k) => theirs.has(k))).toEqual([]);
    expect([...defs.keys()].filter((k) => /^--(space|radius|shadow)-/.test(k))).toEqual([]);
  });

  it('keeps the layer ladder on the values the stacking rules are written against', () => {
    // `styles/stacking.test.ts` and `components/fromframe.test.tsx` pin these
    // numbers in app.css; the ladder names them, it does not move them.
    expect(defs.get('--layer-sticky')).toBe('20');
    expect(defs.get('--layer-chrome')).toBe('21');
    expect(defs.get('--layer-overlay')).toBe('80');
    expect(defs.get('--layer-menu')).toBe('90');
    expect(defs.get('--layer-skip')).toBe('100');
    expect(APP).toMatch(/\.skip-link\s*\{[^}]*z-index:\s*100;/);
    expect(APP).toMatch(/\.deskwork > \.deskstrip\s*\{\s*z-index:\s*21;/);
  });

  it('is the ring the app draws, at the same values', () => {
    const ring = /\.device :focus-visible\s*\{([^}]*)\}/.exec(APP)![1];
    expect(ring).toContain('var(--focus-color)');
    expect(ring).toContain('scroll-margin-top: var(--focus-clear-top)');
    expect(defs.get('--focus-color')).toBe('var(--app-accent-deep)');
    expect(defs.get('--focus-clear-top')).toBe('96px');
    expect(defs.get('--focus-clear-bottom')).toBe('84px');
  });

  it('names the fingertip the tap overlay already reaches', () => {
    expect(defs.get('--target-primary')).toBe('44px');
    expect(defs.get('--target-min')).toBe('24px');
    expect(APP).toContain('max(100%, 44px)');
  });

  it('stills every motion role for reduced motion and for the app’s own setting', () => {
    const roles = [...defs.keys()].filter((k) => k.startsWith('--motion-'));
    expect(roles.length).toBeGreaterThanOrEqual(5);
    const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(TOKENS)![1];
    const calm = /:root\[data-calm='still'\],\s*:root\[data-calm='calm'\]\s*\{([^}]*)\}/.exec(TOKENS)![1];
    for (const r of roles) {
      expect(reduced, r).toMatch(new RegExp(`${r}:\\s*0ms`));
      expect(calm, r).toMatch(new RegExp(`${r}:\\s*0ms`));
    }
  });
});

describe('the shared components’ sheet', () => {
  it('sets every font size from the type scale', () => {
    const sizes = [...UNITY.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1]);
    expect(sizes.length).toBeGreaterThan(10);
    expect(sizes.filter((v) => !/^var\(--type-/.test(v))).toEqual([]);
  });

  it('writes no colour except the scrim’s documented fallback', () => {
    const hex = UNITY.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
    expect(hex).toEqual([]);
    const rgba = UNITY.match(/rgba?\([^)]*\)/g) ?? [];
    expect(rgba).toEqual(['rgba(0, 0, 0, 0.5)']);
    expect(UNITY).toContain('var(--scrim, rgba(0, 0, 0, 0.5))');
  });

  it('animates only through the motion role tokens', () => {
    const moves = [...UNITY.matchAll(/(?:transition|animation):\s*([^;]+);/g)].map((m) => m[1]);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.filter((v) => !/var\(--motion-/.test(v))).toEqual([]);
  });

  it('gives every primary target the practical fingertip', () => {
    for (const sel of ['.next-step', '.command-widget-open', '.visibility-choice']) {
      const body = new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`).exec(UNITY)![1];
      expect(body, sel).toContain('min-height: var(--target-primary)');
    }
  });
});
