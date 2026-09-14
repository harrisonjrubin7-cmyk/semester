import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A reader may refuse. A reader may not crash.
 *
 * Fifty-odd functions across `lib/` and `state/` take `unknown` and turn it
 * into something the app can hold: `readDrop`, `readApplications`,
 * `readCapabilities`, `readResults`. Their input is never trusted — it is
 * storage that may have been hand-edited, truncated by a failed write, or
 * written by an older build, or it is a response off the network.
 *
 * Two outcomes are correct and they are not the same:
 *
 * - **Refusing.** `readAthletics` throws `Use a version 1 athletics export
 *   with up to 250 events.` That is a decision, written for somebody who is
 *   importing a file, and its caller shows the sentence. Deliberate.
 * - **Falling back.** `readDrop` returns 0 for anything that is not a count.
 *
 * `TypeError` is neither. It is the reader meeting a shape nobody considered
 * — `item.lat` on a null row, `Number()` on an object whose `toString` is
 * null — and it means the guard above it is incomplete.
 *
 * ## Why a crash here is not a local failure
 *
 * The readers on the storage path run inside `loadPersisted`, whose `catch`
 * returns `DEFAULT_PERSISTED`. That catch is written for "a private window,
 * or storage disabled", where defaults are exactly right, and it cannot tell
 * that case from a single unreadable field. So a `TypeError` in one reader
 * discarded the whole of a saved term — the navigation, every ticked
 * deadline, the recents, the day budget — and the next dispatch wrote the
 * defaults back over it. `state/storage.test.ts` holds that end of it.
 *
 * Three readers were crashing when this was written: `readDrop` on
 * `{"toString":null}`, `readResults` on `[null]`, and `readStoredDirectory`
 * on `undefined`. All three inputs are things JSON can carry.
 *
 * The list is scanned rather than written out, so a reader added next month
 * is covered by this without anybody remembering to add it.
 */

const ROOTS = ['src/lib', 'src/state'];
const SIGNATURE = /^export (?:async )?function ((?:read|parse)[A-Za-z]*)\s*\(\s*\w+\s*:\s*unknown/gm;

function readers(): { module: string; name: string }[] {
  const out: { module: string; name: string }[] = [];
  for (const dir of ROOTS) {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.ts') || file.includes('.test.')) continue;
      const src = readFileSync(join(dir, file), 'utf8');
      for (const m of src.matchAll(SIGNATURE)) {
        out.push({ module: `${dir.replace('src/', '../')}/${file.replace(/\.ts$/, '')}`, name: m[1] });
      }
    }
  }
  return out;
}

/**
 * Shapes a save or a response can actually be in. Every one of these is
 * either valid JSON or a value `JSON.parse` hands back, so none of them is a
 * hypothetical — `{"toString":null}` is four seconds of work in a devtools
 * console and is what found the crash on the storage path.
 */
const HOSTILE: [string, unknown][] = [
  ['undefined', undefined],
  ['null', null],
  ['0', 0],
  ['-1', -1],
  ['NaN', NaN],
  ['a string', 'x'],
  ['true', true],
  ['[]', []],
  ['{}', {}],
  ['[null]', [null]],
  ['[0]', [0]],
  ['["x"]', ['x']],
  ['[[]]', [[]]],
  ['[{}]', [{}]],
  ['{toString:null}', JSON.parse('{"toString":null}')],
  ['{valueOf:null}', JSON.parse('{"valueOf":null}')],
  ['{__proto__:…}', JSON.parse('{"__proto__":{"x":1}}')],
  ['{length:"no"}', { length: 'no' }],
  ['{items:null}', { items: null }],
  ['{items:[null]}', { items: [null] }],
  ['{entries:0}', { entries: 0 }],
  ['deeply nested', { a: { b: { c: { d: {} } } } }],
];

describe('every reader of untrusted input', () => {
  const found = readers();

  it('is found by scanning, so a new one cannot escape this', () => {
    expect(found.length, 'readers taking `unknown`').toBeGreaterThan(40);
  });

  it('refuses with a sentence, or falls back — never a TypeError', async () => {
    const crashed: string[] = [];
    for (const { module, name } of found) {
      const ns = (await import(/* @vite-ignore */ module)) as Record<string, unknown>;
      const fn = ns[name];
      if (typeof fn !== 'function') continue;
      for (const [label, value] of HOSTILE) {
        try {
          (fn as (v: unknown) => unknown)(value);
        } catch (e) {
          // A written refusal is the contract. A TypeError is a missing guard.
          if (e instanceof TypeError || !(e instanceof Error) || !e.message.trim()) {
            crashed.push(`${module.replace('../', '')}.${name}(${label}) — ${String(e).slice(0, 80)}`);
          }
          break;
        }
      }
    }
    expect(crashed, 'a reader met a shape nobody guarded').toEqual([]);
  });
});
