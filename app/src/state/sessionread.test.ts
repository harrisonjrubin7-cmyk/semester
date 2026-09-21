/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every field of the session half of state has somebody who reads it.
 *
 * `state/keyread.test.ts` asks this of the *persisted* half, after the
 * twenty-third pass found `lastOpened` — written on every navigation and read
 * in no commit this repository has ever had. This is the same question about
 * the half that is not saved, and it was written because that half had one
 * too.
 *
 * `query` was it. Two lines wrote it, both in `ai/converse.ts`, when the
 * assistant acted on an "open this screen" proposal carrying a search. No
 * screen read it: every search box in this app is a local `useState`. So the
 * card offered *"Open Personal, searching for “Stromme”"*, and afterwards said
 * — past tense — that it had done that.
 *
 * ## What counts as a reader
 *
 * `state.<field>`, anywhere outside the three carriers: `state/shape.ts`
 * declares and defaults it, `state/slices/` reduces it, `state/persist/`
 * moves it. None of those three is somebody *using* the value, which is the
 * whole distinction — `query` had a declaration, a default and a reducer
 * case, and looked completely wired from any one of them.
 *
 * A destructure — `const { calSource } = state` — is counted too. There are
 * three in the codebase and two are ephemeral fields, so this is a real shape
 * rather than a hypothetical one, and a guard that missed it would report a
 * live field as dead.
 *
 * Tests are not readers. A field only a test touches is the thing this looks
 * for, not the thing that excuses it.
 *
 * ## Neither is prose, and that is not hypothetical
 *
 * The first version of this passed against a faithful revert of the bug it
 * was written for. `lib/tools.ts` explains, at length, that `state.query` was
 * written by two lines and read by nothing — and the probe matched that
 * sentence and counted the file as a reader. `ai/split.test.ts` and
 * `ai/live.test.ts` both record the same trap the other way up: a codebase
 * that documents what it used to do needs a test that can tell the
 * explanation from the thing being explained. Comments come out first, and
 * the second case below is what keeps that true.
 */

const SRC = join(process.cwd(), 'src');

/**
 * A file with its comments taken out.
 *
 * Block comments then line comments, and deliberately nothing cleverer: the
 * twenty-sixth pass had a stripper that also tried to remove template
 * literals, mispaired a backtick in one file and swallowed the code between,
 * which turned a live table into a dead one and produced seventeen false
 * findings before anybody noticed.
 */
const code = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** The three files that hold a field without using it. */
const CARRIER = /state[\\/]shape\.ts$|state[\\/]slices[\\/]|state[\\/]persist[\\/]/;

function sources(): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) {
        out.push({ path: full, text: code(readFileSync(full, 'utf8')) });
      }
    }
  };
  walk(SRC);
  return out;
}

/** The field names `initialEphemeral` sets, which is the session half. */
function ephemeralFields(): string[] {
  const shape = readFileSync(join(SRC, 'state', 'shape.ts'), 'utf8');
  const at = shape.indexOf('export function initialEphemeral');
  expect(at, 'initialEphemeral has moved or been renamed').toBeGreaterThan(-1);
  const body = shape.slice(at, shape.indexOf('\n}\n', at));
  const names = [...body.matchAll(/^ {4}(\w+):/gm)].map((m) => m[1]);
  // The control: if the parse stops matching, every field reads as dead and
  // this file fails for the wrong reason. A body with no fields in it is a
  // broken probe, not a clean tree.
  expect(names.length, 'parsed no fields out of initialEphemeral').toBeGreaterThan(20);
  return names;
}

describe('the session half of state', () => {
  const files = sources().filter((f) => !CARRIER.test(f.path));
  const fields = ephemeralFields();

  it('has a reader for every field, outside the files that merely carry it', () => {
    const dead = fields.filter((field) => {
      const dotted = new RegExp(String.raw`\bstate\.${field}\b`);
      const pulled = new RegExp(String.raw`const \{[^}]*\b${field}\b[^}]*\} = state\b`);
      return !files.some((f) => dotted.test(f.text) || pulled.test(f.text));
    });
    expect(
      dead,
      'written on every change and read by nobody — see the note above, and `state/keyread.test.ts`',
    ).toEqual([]);
  });

  it('does not count a file that merely talks about a field', () => {
    /*
     * The control that matters, because this is how the first version of this
     * test passed against the bug. `lib/tools.ts` contains the words
     * `state.query` in a note explaining that nothing reads it; with comments
     * left in, that note reads as a reader.
     */
    const tools = readFileSync(join(SRC, 'lib', 'tools.ts'), 'utf8');
    expect(tools, 'the note this control is about has been rewritten').toContain('state.query');
    expect(/\bstate\.query\b/.test(code(tools)), 'a comment counted as a read').toBe(false);
  });

  it('finds the readers it is looking for', () => {
    // A control on the matcher rather than on the tree. `screen` is read all
    // over the app with a dot; `calSource` is read once, by destructuring, in
    // `screens/Calendar.tsx`. A probe that only knew the first shape would
    // call the second one dead.
    const readsDotted = files.some((f) => /\bstate\.screen\b/.test(f.text));
    const readsPulled = files.some((f) => /const \{[^}]*\bcalSource\b[^}]*\} = state\b/.test(f.text));
    expect(readsDotted, 'state.screen').toBe(true);
    expect(readsPulled, 'const { calSource } = state').toBe(true);
  });
});
