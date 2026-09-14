import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * A safety control that fails has to say so.
 *
 * Blocking and unblocking are the two things in this app a person does *about
 * somebody else*, and the only evidence either worked is the screen changing:
 * their messages leave the room, or their row leaves the list. Both go through
 * the account, and `lib/classmates.ts` throws `explain(error.message)` when it
 * cannot — a sentence written to be read.
 *
 * Both call sites threw that sentence away. `void block(...).then(...)` with
 * no `.catch` means a rejected block never runs its `.then`, so the messages
 * stay, the row stays, and nothing anywhere says why. That does not read as
 * "the block failed"; it reads as a dead button — and the person walks away
 * believing they blocked somebody they did not.
 *
 * Both files already knew the idiom. `components/room/Talk.tsx` ends four
 * other calls with `.catch((e) => setError(...))`, and the effect directly
 * above the unblock button in `screens/Classmates.tsx` is catch-aware too.
 * These two buttons were the outliers in their own files, which is why a rule
 * is worth more here than a fix: the next one will be written the same way.
 *
 * Held on the source because the failure is a promise nobody awaited — there
 * is no render to assert against, and jsdom will not produce a Supabase error.
 */

const CALLERS = [
  ['src/components/room/Talk.tsx', 'block'],
  ['src/screens/Classmates.tsx', 'unblock'],
] as const;

describe('blocking and unblocking', () => {
  for (const [file, verb] of CALLERS) {
    it(`says so when ${verb} does not reach the account (${file.split('/').pop()})`, () => {
      const src = readFileSync(file, 'utf8');
      const at = src.indexOf(`void ${verb}(`);
      expect(at, `${file} still calls ${verb}`).toBeGreaterThan(-1);
      expect(src.indexOf(`void ${verb}(`, at + 1), `${verb} is called once`).toBe(-1);

      /*
       * The whole chain, not the first call in it. Balancing to the first
       * `)` stops at `block(me, id)` and reports every guarded call as
       * unguarded — the `.catch` is two lines further on. So after the depth
       * returns to zero, keep going while the next thing is another `.` in
       * the same chain.
       */
      let i = at;
      let depth = 0;
      for (; i < src.length; i += 1) {
        const c = src[i];
        if ('([{'.includes(c)) depth += 1;
        else if (')]}'.includes(c)) {
          depth -= 1;
          if (depth === 0) {
            // Skip whitespace and comments to see whether the chain continues.
            let j = i + 1;
            for (;;) {
              while (j < src.length && /\s/.test(src[j])) j += 1;
              if (src.startsWith('/*', j)) {
                j = src.indexOf('*/', j) + 2;
                continue;
              }
              if (src.startsWith('//', j)) {
                j = src.indexOf('\n', j) + 1;
                continue;
              }
              break;
            }
            if (src[j] !== '.') break;
            i = j;
          }
        }
      }
      const chain = src.slice(at, i + 1);
      expect(chain, `a rejected ${verb} is reported, not dropped`).toMatch(/\.catch\(/);
    });
  }

  it('still throws a sentence worth showing, rather than a bare failure', () => {
    // If this stops being a written message the rule above is worth less, and
    // the call sites should stop quoting it.
    const lib = readFileSync('src/lib/classmates.ts', 'utf8');
    for (const verb of ['block', 'unblock']) {
      const at = lib.indexOf(`export async function ${verb}(`);
      expect(at, `${verb} is still here`).toBeGreaterThan(-1);
      const body = lib.slice(at, lib.indexOf('\n}', at));
      expect(body, `${verb} explains itself`).toMatch(/throw new Error\(explain\(/);
    }
  });
});
