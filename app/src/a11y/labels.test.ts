import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { says, unnamed } from './labels';

/**
 * The label rule, from the test suite's side.
 *
 * The checking itself is `labels.ts`, and `npm run lint` runs the same function
 * through `scripts/labels.mjs` — one implementation, two ways in, the same
 * arrangement as the style rule next door.
 *
 * What this adds is the two ways a naive version of this rule goes wrong: a
 * `>` inside an `onChange` arrow function, which stops a scan half way through
 * the attribute list and hides the `aria-label` in the other half, and a
 * control written inside a comment, which is not a control.
 */

const src = join(process.cwd(), 'src');

/** A directory with one file in it, for the cases the app itself does not have. */
function withFile(name: string, text: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'labels-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
  const path = join(dir, 'src', name);
  writeFileSync(path, text);
  return join(dir, 'src');
}

describe('the label rule', () => {
  it('passes on the app as it stands', () => {
    // Named, not counted: a failure has to say which file, or the next person
    // goes looking for it with a grep.
    expect(unnamed(src).map((p) => `${p.file}:${p.line} <${p.tag}>`)).toEqual([]);
  });

  it('catches a select with the label only in the layout', () => {
    const dir = withFile(
      'One.tsx',
      `export const A = () => (
  <>
    <SectionLabel>Which course</SectionLabel>
    <select value={id} onChange={(e) => set(e.target.value)}>
      <option value="">All</option>
    </select>
  </>
);`,
    );
    const found = unnamed(dir);
    expect(found).toHaveLength(1);
    expect(found[0].tag).toBe('select');
    expect(found[0].line).toBe(4);
    expect(says(found[0])).toContain('aria-label');
  });

  it('reads past a > inside an attribute expression', () => {
    // The arrow in `onChange` and the comparison in `style` both contain a
    // `>`. A scan that stops at the first one never reaches the aria-label.
    const dir = withFile(
      'Two.tsx',
      `export const A = () => (
  <select
    value={n}
    onChange={(e) => set(Number(e.target.value))}
    style={{ opacity: n > 2 ? 1 : 0.5 }}
    aria-label="Which unit"
  >
    <option value="0">One</option>
  </select>
);`,
    );
    expect(unnamed(dir)).toEqual([]);
  });

  it('does not read a control out of a comment', () => {
    const dir = withFile(
      'Three.tsx',
      `/** "19:00" from minutes, and back — what an <input type=time> speaks. */
export const toField = (m: number) => m;`,
    );
    expect(unnamed(dir)).toEqual([]);
  });

  it('accepts the names a browser can actually compute', () => {
    const dir = withFile(
      'Four.tsx',
      `export const A = () => (
  <>
    <input aria-label="Your name" value={a} />
    <input aria-labelledby="who" value={b} />
    <input id="mail" value={c} />
    <input type="hidden" value={e} />
  </>
);`,
    );
    expect(unnamed(dir)).toEqual([]);
  });

  it('accepts a control wrapped in its own label', () => {
    // The oldest way of saying it, and the one `Attendance` and `PiecesRow`
    // were already using. Until the rule could see it, both were passing only
    // because they also had a placeholder.
    const dir = withFile(
      'Six.tsx',
      `export const A = () => (
  <>
    <label>
      Absences allowed
      <input inputMode="numeric" value={a} onChange={(e) => set(e.target.value)} />
    </label>
    <label>
      Then % off, each
      <input inputMode="decimal" value={b} onChange={(e) => set(e.target.value)} />
    </label>
  </>
);`,
    );
    expect(unnamed(dir)).toEqual([]);
  });

  it('does not accept a placeholder', () => {
    /*
     * It counted once, and the browser does derive a name from it — it is the
     * last resort of the accessible-name computation, so axe stays quiet too.
     * The reason to reject it is not the screen reader: a placeholder is gone
     * the moment somebody types, so on a form that asks five things in a row
     * the field being filled in is the one with no label left.
     */
    const dir = withFile(
      'Seven.tsx',
      `export const A = () => (
  <input placeholder="someone@vanderbilt.edu" value={d} />
);`,
    );
    expect(unnamed(dir)).toEqual([
      {
        file: 'Seven.tsx',
        line: 2,
        tag: 'input',
        found: '<input placeholder="someone@vanderbilt.edu" value={d} />',
      },
    ]);
  });

  it('leaves alone the inputs named by what is drawn around them', () => {
    // A file input behind a button, and a checkbox inside its own label. Both
    // are named by their surroundings, which this rule cannot see.
    const dir = withFile(
      'Five.tsx',
      `export const A = () => (
  <>
    <input ref={pick} type="file" hidden onChange={(e) => load(e.target.files)} />
    <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
    <input type="radio" checked={on} onChange={(e) => set(e.target.checked)} />
  </>
);`,
    );
    expect(unnamed(dir)).toEqual([]);
  });
});
