import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Two things the app draws and never says.
 *
 * Both are the same failure wearing different clothes: a fact rendered as a
 * shape or a colour, with nothing in the accessibility tree behind it. Neither
 * shows up in a screenshot, a type check or a click-through — they are wrong
 * only for somebody who is not looking at the screen, which is exactly the
 * class of bug a suite has to hold because nobody stumbles over it.
 */
function tsx(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) tsx(p, out);
    else if (/\.tsx$/.test(e) && !/\.test\./.test(e)) out.push(p);
  }
  return out;
}

const FILES = tsx('src').map((f) => ({ file: f, src: readFileSync(f, 'utf8') }));

/**
 * A bar is a number drawn as a length.
 *
 * Seven meters, and four of them were the only place their figure appeared:
 * Study's mastery bar beside "11 units · 68 cards", Guide's per-unit bar beside
 * "12 cards", the load-by-course bar beside "3 left", and the deck-coverage bar
 * on Me — whose own comment says it shows "what the line does not show". A
 * screen reader met two nested `<div>`s and read nothing at all.
 *
 * `Meter` takes a required `label` now, so the compiler asks the question at
 * every site: a string for a bar that has to speak, an explicit `null` for one
 * whose number is already in the words. The type is most of the enforcement.
 * This is the rest of it — that the mechanism behind the type is still there.
 */
describe('every bar that carries a number', () => {
  const ui = FILES.find(({ file }) => file.endsWith('components/ui.tsx'))!;

  it('says the number, or says it is a repeat', () => {
    const meter = /export function Meter\([\s\S]*?\n}\n/.exec(ui.src);
    expect(meter, 'Meter has moved; point this test at it').not.toBeNull();
    const src = meter![0];
    expect(src, 'a labelled bar is a progressbar').toContain("role: 'progressbar'");
    expect(src).toContain("'aria-valuenow'");
    expect(src).toContain("'aria-valuemin'");
    expect(src).toContain("'aria-valuemax'");
    // Without the text a reader says "62" and leaves the unit to be guessed.
    expect(src, 'the value needs its unit').toContain("'aria-valuetext'");
    // And the other branch actually hides it, rather than leaving a nameless
    // progressbar that announces a bare number with nothing to attach it to.
    expect(src, 'an unlabelled bar is hidden, not silent-but-present').toContain("'aria-hidden'");
  });

  it('makes every caller decide, with no default to fall through', () => {
    // `label: string | null` and no `= something`. A default is what turns a
    // decision into an omission, and the omission is invisible.
    expect(ui.src).toMatch(/label: string \| null;/);
    expect(ui.src, 'a default would let a new bar ship silent').not.toMatch(/label = /);
  });

  it('is used with a label decided at each site', () => {
    const calls = FILES.flatMap(({ file, src }) =>
      [...src.matchAll(/<Meter[\s\S]{0,320}?\/>/g)].map((m) => ({ file, text: m[0] })),
    );
    expect(calls.length, 'the meters have moved or been renamed').toBeGreaterThanOrEqual(7);
    const mute = calls.filter((c) => !/\blabel=/.test(c.text)).map((c) => c.file);
    expect(mute, 'a bar with no label decision').toEqual([]);
  });
});

/**
 * A failure that is only visible is a failure half the people using the app
 * miss — which is `Trouble`'s own comment, and `Trouble` was right. Twelve
 * other error messages were not: a plain `<div>` in the warn colour, appearing
 * where nothing was before. Press Sign in with a wrong password and, to a
 * screen reader, nothing whatever happened.
 *
 * `role="alert"` is the whole fix, and it changes nothing about how any of
 * them looks. This rule is what stops the thirteenth appearing.
 */
describe('every message that says something went wrong', () => {
  /** `{error && (`, `{error ? (`, `{errors.length > 0 && (` and their kin. */
  const SHOWN = /\{\s*\w*(?:[eE]rror|oops|failed|problem)\w*\s*(?:&&|\?|\.length\s*>\s*0\s*&&)/;

  function silent(): string[] {
    const out: string[] = [];
    for (const { file, src } of FILES) {
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        if (!SHOWN.test(line)) return;
        // The node it renders, or the component it delegates to, has to be
        // one a reader is told about.
        const shown = lines.slice(i, i + 12).join('\n');
        if (/<Trouble|<Problem|role="alert"|role="status"|aria-live/.test(shown)) return;
        out.push(`${file}:${i + 1}`);
      });
    }
    return out;
  }

  it('is announced when it appears', () => {
    expect(silent(), 'an error nobody is told about').toEqual([]);
  });

  it('still has errors to check', () => {
    // Guards the rule above: were the state renamed off `error` everywhere,
    // an empty list would pass it while the app said nothing at all.
    const shown = FILES.filter(({ src }) => SHOWN.test(src));
    expect(shown.length).toBeGreaterThanOrEqual(10);
  });

  it('keeps the component that got this right first', () => {
    const trouble = FILES.find(({ file }) => file.endsWith('components/Trouble.tsx'))!;
    expect(trouble.src).toContain('role="alert"');
  });
});
