import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { hushed, says, silenced, unnamed } from './labels';

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

/**
 * The second rule: a name a stylesheet takes away.
 *
 * Found by running axe over the app in a browser rather than by reading it.
 * `.desktop-ai span { display: none }` under 760px left the AI Tutor button —
 * the way into the assistant in the workspace and browser navigations — with
 * no accessible name on a phone, on every screen those navigations draw. The
 * markup had the words; the stylesheet had no idea they were the only name
 * the control had. Neither file is wrong on its own, which is why the check
 * has to read both.
 */
describe('a name a stylesheet hides', () => {
  const css = readFileSync(join(src, 'styles', 'app.css'), 'utf8');

  it('passes on the app as it stands', () => {
    expect(silenced(src, css).map((p) => `${p.file}:${p.line} .${p.className}`)).toEqual([]);
  });

  it('still finds the rule it was written for', () => {
    // If this stops matching, the check above is passing on nothing — the
    // failure mode the tap test next door calls "a test that cannot fail".
    expect(hushed(css).map((r) => r.rule)).toContain('.desktop-ai span');
  });

  it('reads the rule out of the stylesheet rather than knowing it', () => {
    expect(hushed('.thing b { display: none; }')).toEqual([
      { className: 'thing', rule: '.thing b' },
    ]);
    // A media query around it changes the width, not the answer.
    expect(hushed('@media (max-width: 500px) { .thing em { display: none } }')).toEqual([
      { className: 'thing', rule: '.thing em' },
    ]);
    // Hiding the control itself is not hiding its name.
    expect(hushed('.thing { display: none }')).toEqual([]);
    expect(hushed('.thing span { opacity: 0 }')).toEqual([]);
  });

  it('catches a control whose only words the stylesheet hides', () => {
    const dir = withFile(
      'Eight.tsx',
      `export const A = () => (
  <button type="button" className="bare quiet-one" onClick={go}>
    <Icon size={15} />
    <span>Ask</span>
  </button>
);`,
    );
    const found = silenced(dir, '.quiet-one span { display: none }');
    expect(found).toHaveLength(1);
    expect(found[0].className).toBe('quiet-one');
    expect(found[0].line).toBe(2);
  });

  it('is satisfied by a name of the control’s own', () => {
    const dir = withFile(
      'Nine.tsx',
      `export const A = () => (
  <button type="button" className="bare quiet-one" aria-label="Ask" onClick={go}>
    <span>Ask</span>
  </button>
);`,
    );
    expect(silenced(dir, '.quiet-one span { display: none }')).toEqual([]);
  });

  it('is not fooled by a > inside an attribute before the label', () => {
    // The same trap the rule above fell into once: a scan that stops at the
    // first `>` never reaches the aria-label after it.
    const dir = withFile(
      'Ten.tsx',
      `export const A = () => (
  <button className="quiet-one" onClick={(e) => go(e)} aria-label="Ask">
    <span>Ask</span>
  </button>
);`,
    );
    expect(silenced(dir, '.quiet-one span { display: none }')).toEqual([]);
  });

  it('does not read a control out of a comment', () => {
    const dir = withFile(
      'Eleven.tsx',
      `/* <button className="quiet-one"><span>Ask</span></button> */
export const A = () => null;`,
    );
    expect(silenced(dir, '.quiet-one span { display: none }')).toEqual([]);
  });
});
