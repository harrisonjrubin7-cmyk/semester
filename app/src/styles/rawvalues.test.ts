import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ALLOWED_RAW, AXES, ledgerOf, overLedger, renderLedger, scan, scanCss, scanTsx, totals } from './rawvalues';
import { sources } from './rules';
import { RAW_BUDGET } from './rawbudget';

/**
 * The stylesheet raw-value ledger, held to the proof standard `CLAUDE.md` sets.
 *
 * Every guard has a control: a fixture the check must convict next to the one it
 * must pass, because a scan that finds nothing is also what a scan looking in the
 * wrong place finds. That is not hypothetical — the first version of the CSS scan
 * read nothing at all (its declaration pattern wanted a leading dash), the walk
 * said "clean", and only a comparison against an independent `grep` of the same
 * tree showed it. `reads the tree` below is that comparison, kept.
 */

const SRC = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

describe('the stylesheet rules', () => {
  const css = (decl: string) => scanCss('styles/probe.css', `.x {\n  ${decl}\n}`);
  const tsx = (expr: string) => scanTsx('screens/Probe.tsx', `const s = { ${expr} };`);

  it('convicts a raw value on each axis and passes the token that replaces it', () => {
    const cases: Array<[string, string, string]> = [
      ['color', 'color: #14161b;', 'color: var(--text-primary);'],
      ['color', 'border-color: rgba(236, 238, 242, 0.24);', 'border-color: var(--border-default);'],
      ['layer', 'z-index: 40;', 'z-index: var(--layer-overlay);'],
      ['elevation', 'box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);', 'box-shadow: var(--elevation-modal);'],
      ['motion', 'transition: opacity 200ms ease;', 'transition: opacity var(--motion-save);'],
      ['motion', 'animation: rise 1s cubic-bezier(0.1, 0.2, 0.3, 0.4);', 'animation: rise var(--duration-slow) var(--ease-standard);'],
      ['space', 'padding: 14px 20px;', 'padding: var(--sp-6) var(--sp-7);'],
      ['type', 'font-size: 13px;', 'font-size: var(--type-sm);'],
    ];
    for (const [rule, bad, good] of cases) {
      expect(css(bad).map((h) => h.rule), bad).toContain(rule);
      expect(css(good), good).toEqual([]);
    }
  });

  it('counts a shadow once, as a shadow, not again as a colour', () => {
    expect(css('box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);').map((h) => h.rule)).toEqual(['elevation']);
    expect(tsx("boxShadow: '0 8px 24px rgba(0,0,0,.4)'")).toEqual([]);
  });

  it('convicts a colour function in a style object and passes the token', () => {
    expect(tsx("color: 'rgb(12, 14, 16)'").map((h) => h.rule)).toEqual(['color']);
    expect(tsx("color: 'oklch(0.5 0.1 200)'").map((h) => h.rule)).toEqual(['color']);
    expect(tsx("color: 'var(--text-primary)'")).toEqual([]);
  });

  it('leaves to design-system-audit.mjs what it counts, so no value sits on two ledgers', () => {
    // `.tsx` z-index, shadow, radius, motion and type are `design-system-baseline.json`'s; hex is `hex.test.ts`'s.
    expect(tsx('zIndex: 40')).toEqual([]);
    expect(tsx("borderRadius: '12px'")).toEqual([]);
    expect(tsx("transition: 'opacity 200ms ease'")).toEqual([]);
    expect(tsx("color: '#14161b'")).toEqual([]);
  });

  it('suggests the token that already names the value', () => {
    expect(css('z-index: 80;')[0].says).toContain('var(--layer-overlay)');
    expect(css('transition: opacity 130ms;')[0].says).toContain('--duration-fast');
    expect(css('padding: 8px;')[0].says).toContain('var(--sp-4)');
    expect(css('font-size: 12px;')[0].says).toContain('var(--type-sm)');
  });

  it('does not count a token definition, a hairline, a local layer, a url fragment or a comment', () => {
    expect(scanCss('styles/tokens.css', ':root {\n  --duration-fast: 130ms;\n  --app-bg: #090a0e;\n  --layer-menu: 90;\n}')).toEqual([]);
    expect(css('border: 1px solid var(--border-subtle);')).toEqual([]);
    expect(css('padding: 2px;')).toEqual([]);
    expect(css('z-index: 1;')).toEqual([]);
    expect(css('fill: url(#clip);')).toEqual([]);
    expect(scanCss('styles/probe.css', '/* z-index: 40; color: #fff; */ .x { color: var(--text-primary); }')).toEqual([]);
    expect(css('padding: calc(14px * var(--density, 1));')).toEqual([]);
    expect(css('font-size: calc(13px * var(--text-scale, 1));')).toEqual([]);
  });

  it('allows the reduced-motion clamp, with the reason on the allowlist', () => {
    const clamp = 'animation-duration: 0.001ms !important;';
    expect(scanCss('styles/app.css', `.x {\n  ${clamp}\n}`)).toEqual([]);
    // The exemption is for that file only: the same line elsewhere is a duration.
    expect(scanCss('styles/features.css', `.x {\n  ${clamp}\n}`).map((h) => h.rule)).toEqual(['motion']);
    for (const a of ALLOWED_RAW) expect(a.why.trim().length, a.file).toBeGreaterThan(30);
  });

  it('reports file, line, rule, the matched value and a suggestion', () => {
    const [h] = scanCss('styles/probe.css', '.a {\n  color: var(--text-primary);\n}\n.b {\n  z-index: 100;\n}');
    expect(h).toMatchObject({ file: 'styles/probe.css', line: 5, rule: 'layer', value: '100' });
    expect(h.found).toBe('z-index: 100');
    expect(h.says).toContain('--layer-skip');
  });
});

describe('the ledger', () => {
  it('reads the tree — checked against a grep that shares no code with it', () => {
    const hits = scan(SRC);
    expect(hits.some((h) => h.file.endsWith('.css'))).toBe(true);
    expect(hits.some((h) => h.file.endsWith('.tsx'))).toBe(true);
    // An independent count of declared (not custom-property) numeric z-indexes in the stylesheets.
    const z = walk(SRC)
      .filter((f) => f.endsWith('.css'))
      .reduce(
        (n, f) =>
          n +
          [...readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/^\s*z-index:\s*(-?\d+)\s*(?:!important)?\s*;/gm)].filter((m) => !['0', '1', '-1'].includes(m[1])).length,
        0,
      );
    const counted = hits.filter((h) => h.rule === 'layer' && h.file.endsWith('.css')).length;
    expect(counted).toBeGreaterThan(0);
    expect(counted).toBe(z);
  });

  it('is what the tree holds now — the valid case', () => {
    expect(overLedger(scan(SRC), RAW_BUDGET)).toEqual([]);
  });

  it('fails when a clean file gains a raw value, and when a ledgered file gains one more', () => {
    const base = ledgerOf(scan(SRC));
    const extra = scanCss('styles/brand.css', '.x {\n  z-index: 777;\n}');
    const grew = overLedger([...scan(SRC), ...extra], RAW_BUDGET);
    expect(grew).toHaveLength(1);
    expect(grew[0]).toMatchObject({ kind: 'grew', rule: 'layer', file: 'styles/brand.css' });
    expect(grew[0].says).toContain('--layer');
    // A file that already owes something: one more is still growth.
    const file = Object.keys(base).find((f) => base[f].layer && f.endsWith('.css'))!;
    const more = scanCss(file, '.x {\n  z-index: 778;\n}');
    expect(overLedger([...scan(SRC), ...more], RAW_BUDGET).map((d) => `${d.kind}:${d.file}`)).toEqual([`grew:${file}`]);
  });

  it('says so when a file got cleaner, and says how to record it', () => {
    const [file] = Object.keys(RAW_BUDGET);
    const drift = overLedger(scan(SRC).filter((h) => h.file !== file), RAW_BUDGET);
    expect(drift.length).toBeGreaterThan(0);
    expect(drift.every((d) => d.kind === 'shrank')).toBe(true);
    expect(drift[0].says).toContain('design-system:css -- --fix');
  });

  it('renders a ledger that round-trips to the committed file', () => {
    expect(renderLedger(RAW_BUDGET)).toBe(readFileSync(join(SRC, 'styles', 'rawbudget.ts'), 'utf8'));
  });

  it('fails on a tree it cannot read rather than passing it', () => {
    const empty = mkdtempSync(join(tmpdir(), 'ds-empty-'));
    try {
      expect(() => scan(empty)).toThrow(/no \.tsx/);
      expect(() => sources(empty)).toThrow();
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('carries no entry for a file that no longer exists', () => {
    for (const file of Object.keys(RAW_BUDGET)) expect(existsSync(join(SRC, file)), file).toBe(true);
    expect(AXES.every((a) => totals(RAW_BUDGET)[a] >= 0)).toBe(true);
  });
});

describe('the command, end to end', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('plants a violation in a copy of the tree and the ledger names it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ds-tree-'));
    dirs.push(dir);
    // Paths are reported relative to `src/`, as in the real tree.
    const src = join(dir, 'src');
    mkdirSync(join(src, 'screens'), { recursive: true });
    writeFileSync(join(src, 'screens', 'Clean.tsx'), "export const A = () => <div style={{ color: 'var(--text-primary)' }} />;\n");
    writeFileSync(join(src, 'a.css'), '.a { color: var(--text-primary); }\n');
    expect(overLedger(scan(src), {})).toEqual([]);
    writeFileSync(join(src, 'screens', 'Dirty.tsx'), "export const B = () => <div style={{ color: 'rgb(1, 2, 3)' }} />;\n");
    writeFileSync(join(src, 'b.css'), '.b {\n  z-index: 500;\n}\n');
    const drift = overLedger(scan(src), {});
    expect(drift.map((d) => `${d.file} ${d.rule}`).sort()).toEqual(['b.css layer', 'screens/Dirty.tsx color']);
    expect(drift.find((d) => d.file === 'b.css')!.line).toBe(2);
  });
});
