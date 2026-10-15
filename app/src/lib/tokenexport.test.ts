import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCENTS, CORNERS, DENSITIES, GROUNDS, SIZES } from './look';
import { buildTokenExport, serialise, semanticDefs } from './tokenexport';

/**
 * The token export is a copy of the code, so it is held to the code.
 *
 * `design-tokens/semester.tokens.json` is what Figma variables, a native client
 * and the parity check read. A copy nothing compares goes stale without anyone
 * noticing, so this regenerates it and fails on any difference. To accept an
 * intended change: `npm run tokens:export`, then commit the file with the change
 * that caused it — the diff in the JSON is the review of what the change did to
 * every ground, density and corner.
 */
const FILE = new URL('../../design-tokens/semester.tokens.json', import.meta.url);
const CSS = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
const APP = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8');
const built = buildTokenExport(CSS, APP);

if (process.env.TOKENS === 'write') writeFileSync(FILE, serialise(built));

describe('the token export', () => {
  it('matches the committed file', () => {
    expect(serialise(built), 'run `npm run tokens:export` and commit design-tokens/semester.tokens.json').toBe(
      readFileSync(FILE, 'utf8'),
    );
  });

  it('has a collection per setting, with every option as a mode', () => {
    const modes = (c: string) => built.collections[c].modes;
    expect(modes('ground')).toEqual(GROUNDS.map((g) => g.id));
    expect(modes('accent')).toEqual(ACCENTS.map((a) => a.id));
    expect(modes('density')).toEqual(DENSITIES.map((d) => d.id));
    expect(modes('textSize')).toEqual(SIZES.map((s) => s.id));
    expect(modes('corners')).toEqual(CORNERS.map((c) => c.id));
  });

  it('gives every variable a value in every mode of every setting it varies with', () => {
    const gaps: string[] = [];
    for (const [name, v] of Object.entries(built.primitive)) {
      const { varies, modes } = v.$extensions.semester;
      if (varies[0] === 'stylesheet') continue; // fixed in app.css; scaled by a setting at runtime
      if (varies[0] === 'constant') {
        if (varies.length !== 1 || modes) gaps.push(`${name} is constant but lists modes`);
        continue;
      }
      for (const c of varies) {
        for (const m of built.collections[c].modes) {
          if (!modes?.[c]?.[m]) gaps.push(`${name} has no value for ${c}/${m}`);
        }
      }
    }
    expect(gaps).toEqual([]);
  });

  it('puts the right things in the right place — a control, so a vacuous diff cannot pass', () => {
    // These must vary with the setting named, or the discovery is broken and the file is empty.
    const varies = (n: string) => built.primitive[n]?.$extensions.semester.varies;
    expect(varies('app-panel')).toContain('ground');
    expect(varies('app-fg')).toContain('ground');
    expect(varies('r-md')).toContain('corners');
    // The interaction the first version hid: the Industry grounds carry a corners opinion,
    // so the radius moves with the ground as well as with the corners setting.
    expect(varies('r-md')).toContain('ground');
    // And it must not report every token as varying: the layer ladder never moves.
    expect(Object.values(built.primitive).filter((v) => v.$extensions.semester.varies[0] === 'constant').length).toBeGreaterThan(0);
    // Corners really do differ between modes (drawn 6, square 0).
    expect(built.primitive['r-md'].$extensions.semester.modes!.corners).toMatchObject({ drawn: '6px', square: '0px' });
  });

  it('resolves every semantic reference to something exported', () => {
    const broken: string[] = [];
    for (const [name, t] of Object.entries(built.semantic)) {
      const ref = /^\{(primitive|semantic)\.([a-z0-9-]+)\}$/.exec(t.$value);
      if (!ref) continue;
      const set = ref[1] === 'primitive' ? built.primitive : built.semantic;
      if (!set[ref[2]]) broken.push(`${name} → ${t.$value}`);
    }
    expect(broken).toEqual([]);
  });

  it('exports every token tokens.css defines — none skipped', () => {
    const defined = [...semanticDefs(CSS).keys()].map((k) => k.replace(/^--/, ''));
    expect(defined.length).toBeGreaterThan(100);
    expect(Object.keys(built.semantic).sort()).toEqual([...defined].sort());
  });

  it('records the contrast of ink on every ground, and body ink clears AA on all of them', () => {
    const fg = built.primitive['app-fg'].$extensions.semester.minContrast!;
    expect(Object.keys(fg)).toEqual(GROUNDS.map((g) => g.id).sort());
    for (const [ground, ratio] of Object.entries(fg)) expect(ratio, ground).toBeGreaterThanOrEqual(4.5);
  });

  it('exports the stylesheet primitives the semantic layer depends on', () => {
    expect(built.primitive['sp-4'].$value).toBe('8px');
    expect(built.primitive['sp-4'].$extensions.semester.scaledBy).toBe('density');
    expect(built.primitive['type-base'].$value).toBe('16px');
    expect(built.primitive['type-base'].$extensions.semester.scaledBy).toBe('textSize');
    expect(built.primitive['text-scale'].$extensions.semester.modes!.textSize).toMatchObject({ compact: '0.94', largest: '1.18' });
    // Every semantic alias that points at a --sp/--type/--lift/--leading token finds it.
    const dangling = Object.entries(built.semantic).filter(
      ([, t]) => t.$extensions.semester.alias && /^--(type|sp|leading|lift)-/.test(t.$extensions.semester.alias) && t.$type !== 'reference',
    );
    expect(dangling.map(([n]) => n)).toEqual([]);
  });

  it('is deterministic — building twice gives the same bytes', () => {
    expect(serialise(buildTokenExport(CSS, APP))).toBe(serialise(built));
  });
});
