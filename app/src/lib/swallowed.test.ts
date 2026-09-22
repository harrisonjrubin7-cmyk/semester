import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sources } from '../styles/rules';

/**
 * No failure is discarded without somebody having written down why.
 *
 * A student's deadline sync that fails and says so is annoying. One that
 * fails, is caught, and says nothing is worse, because it is indistinguishable
 * from success: the spinner stops, the screen looks unchanged, and the thing
 * did not happen. There is no way to tell from inside the app that it went
 * wrong, and no way for the student to know they should try again.
 *
 * `scripts/swallowed.mjs` asked the whole question — of all **362** catch
 * blocks in `src` — and the answer was better than the question assumed:
 *
 *     bare        0
 *     silent     17   all defensible when read
 *     explained  85
 *     answers   143
 *     speaks    117
 *
 * The seventeen are accumulators and settlers: `refused.push({name, why})`,
 * `problems.push(…)`, `resolve(false)`, and one `return` out of a URL parse
 * with nothing to report. Every one reports, answers or deliberately skips.
 *
 * ## What this holds, and what it does not
 *
 * It holds the `bare` row at zero: **an empty catch must carry a comment.**
 *
 * That is deliberately the narrowest of the five rows, and it is the only one
 * that needs no judgement to check. Whether `resolve(false)` is the right
 * answer to a failed IndexedDB open is a question about that function; whether
 * `catch {}` with nothing in it was a decision or an omission is not a
 * question at all. The comment is the difference between the two, and asking
 * for it is asking for thirty seconds of thought at the moment the block is
 * written — which is the only moment anybody knows what it was for.
 *
 * The census stays a script rather than becoming a gate, for the reason
 * `exports.mjs` gives about young probes: this one was wrong four times in its
 * first hour, and each time in a new way. Its bare row was right every time,
 * because it is the row that reads nothing but the shape of the block.
 *
 * ## Measured
 *
 * Planting `catch {}` in `src/lib/__probe.ts` moves the count to 1 and this
 * test fails naming the file and line. Planting `catch { /* … *\/ }` beside it
 * does not. Both were run before this was trusted — a guard that has never
 * failed is not known to be a guard.
 *
 * ## Why this reads text where the census parses
 *
 * `scripts/swallowed.mjs` builds a `ts.Program`, because telling `speaks` from
 * `answers` needs to know where a callee is declared. Nothing here needs that.
 *
 * An **empty** block is the one case a regular expression can be trusted with,
 * because it is the one case that cannot contain a brace: `[^{}]*` between the
 * braces is exact, not an approximation. A catch with statements in it either
 * has no nested block — and then the body is plainly not whitespace — or has
 * one, and does not match at all, which is correct because a block with a
 * nested block is not empty.
 *
 * That matters beyond tidiness. TypeScript 7 changed the package's exports and
 * `import ts from 'typescript'` in a test now resolves to a version stub, so
 * the first draft of this file failed `tsc` the moment the dependabot bump
 * landed. A guard that breaks on its own toolchain's upgrade is not a guard.
 */

const SRC = join(process.cwd(), 'src');
const isTest = (f: string) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f);

/** Every shipping source file. `styles/rules.ts` walks; this names. */
const files = sources(SRC, { ext: ['.ts', '.tsx'] })
  .map((s) => s.path)
  .filter((p) => !isTest(p));

/** Every `catch`, however its body is written. */
const ANY = /\bcatch\s*(?:\([^)]*\))?\s*\{/g;

/**
 * A `catch` whose block holds no other block — so, if it holds nothing else
 * either, an empty one. `[^{}]*` is what makes that exact.
 */
const EMPTY = /\bcatch\s*(?:\([^)]*\))?\s*\{([^{}]*)\}/g;

/**
 * Catch blocks with no statements and no comment, as `file:line`.
 *
 * Parsed rather than matched. A regex for `catch\s*{\s*}` would miss
 * `catch (e)\n{\n\n}` and would have to be taught what a comment is; the
 * parser already knows both, and knows that a comment inside an otherwise
 * empty block leaves `statements` empty while changing the block's text.
 */
function bareCatches(): string[] {
  const found: string[] = [];
  for (const path of files) {
    const text = readFileSync(path, 'utf8');
    for (const m of text.matchAll(EMPTY)) {
      const body = m[1];
      // Comments out first: what is left is the block's statements, and the
      // block is empty exactly when there are none. Dropping this step is what
      // made a first draft of this file report 186 where the census reported
      // 0 — `catch { resolve(false); }` holds no brace either, so it matched
      // the same expression and was called bare.
      const bare = body.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
      if (bare.trim() !== '') continue;
      if (bare !== body) continue; // a comment stood there: a reason was given
      const line = text.slice(0, m.index).split('\n').length;
      found.push(`${path.slice(SRC.length + 1)}:${line}`);
    }
  }
  return found;
}

describe('a caught failure', () => {
  it('is never discarded without a written reason', () => {
    expect(
      bareCatches(),
      'an empty catch with no comment: say why the failure is safe to drop, or tell somebody',
    ).toEqual([]);
  });

  /*
   * The floor under the assertion above. If the walk stops finding files, or
   * the parser stops finding catch clauses, the list is empty for the
   * uninteresting reason and this file passes while checking nothing — which
   * is the failure mode of every census in this repository, and the one the
   * dead-export pass was thrown away for.
   */
  it('is looking at a body of code that has catch blocks in it', () => {
    expect(files.length, 'the walk still finds source').toBeGreaterThan(300);
    let clauses = 0;
    for (const path of files) {
      clauses += [...readFileSync(path, 'utf8').matchAll(ANY)].length;
    }
    expect(clauses, 'the rule still finds catch blocks').toBeGreaterThan(300);
  });
});
