// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  UNNAMED,
  byAsker,
  byCourse,
  claimFrom,
  forget,
  read,
  record,
  total,
  type Spent,
  type Usage,
} from './spend';

/**
 * Every call that spends the student's money says what it was for.
 *
 * `lib/claude.ts` has reported what a reply cost since the meter was built,
 * through an `onUsage` hook the caller had to remember. **One of the
 * twenty-five callers remembered it.** The other twenty-four — building a
 * course from a syllabus, checking a generated quote against its source,
 * reading a syllabus for dates, drafting an email, solving a problem — spent
 * and recorded nothing, so the meter in Settings read as though the only
 * money the app had ever cost was the chat.
 *
 * A number that is wrong is worse than no number, and that is the argument
 * `lib/spend.ts` is built on. This is the check that keeps it: recording now
 * happens inside `ask`, so nothing can spend silently, and the one thing a
 * caller still has to supply is what it was doing. A caller that does not is
 * a row on the meter reading `unnamed`, which is visible — and this test,
 * which is louder.
 *
 * Read out of the source, like `lib/functions.test.ts` reads the engine's
 * `case` labels, for the same reason: adding a call site and describing it are
 * two different afternoons, and without this the second one never comes.
 */

const SRC = join('src');

/** Every `.ts` and `.tsx` under `src`, except the tests. */
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...sources(path));
      continue;
    }
    if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
    out.push(path);
  }
  return out;
}

/**
 * The `ask({ … })` calls in a file, as the text inside their braces.
 *
 * Brace-counted rather than matched with a regular expression: an options
 * object holds nested objects, template strings and arrow functions, and a
 * non-greedy match to the first `}` stops inside the first of them — which
 * would read the first nested object as the whole call and pass a file that
 * names nothing.
 */
export function asksIn(source: string): string[] {
  const out: string[] = [];
  const opener = /(?<![A-Za-z0-9_$.])ask\(\s*\{/g;
  for (let m = opener.exec(source); m; m = opener.exec(source)) {
    const from = m.index + m[0].length - 1;
    let depth = 0;
    for (let i = from; i < source.length; i += 1) {
      const c = source[i];
      if (c === '{') depth += 1;
      else if (c === '}') {
        depth -= 1;
        if (depth === 0) {
          out.push(source.slice(from, i + 1));
          break;
        }
      }
    }
  }
  return out;
}

/**
 * The same text with every string literal emptied out.
 *
 * Because the first version of the check below did not do this, and the one
 * file it wrongly cleared is the one it most needed to catch: `lib/classify.ts`
 * asks the model to reply with `{"kind":"…","about":"…"}`, and a search for
 * `about:` found it inside that prompt. A silent call site, reported as named,
 * by a probe reading the words the model is sent.
 */
function stripped(call: string): string {
  return call
    .replace(/\\./g, '')
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""')
    .replace(/`[^`]*`/g, '``');
}

/** Whether one call's options name what the call is for. */
export function namesItself(call: string): boolean {
  return /(?:^|[\s,{])about\s*:/.test(stripped(call));
}

describe('the ask() call sites', () => {
  const files = sources(SRC).filter((f) => !f.endsWith(join('lib', 'claude.ts')));
  const calls = files.flatMap((file) => asksIn(readFileSync(file, 'utf8')).map((call) => ({ file, call })));

  it('are found at all', () => {
    // Guards everything below: a brace-counter that matched nothing would let
    // every assertion after this pass without reading a line of the app.
    expect(calls.length).toBeGreaterThan(20);
  });

  it('every one of them says what it is for', () => {
    const quiet = calls.filter(({ call }) => !namesItself(call)).map(({ file }) => file);
    expect([...new Set(quiet)]).toEqual([]);
  });

  it('none of them records the reply itself, because `ask` does', () => {
    // Two writes for one reply is a meter that reads double, which is the
    // same fault as one that reads low and harder to notice.
    const twice = files.filter((f) => /\brecord\(\s*\{/.test(readFileSync(f, 'utf8')));
    expect(twice).toEqual([]);
  });
});

describe('reading the call sites', () => {
  it('takes the whole options object, nested braces and all', () => {
    const found = asksIn('await ask({ about: "x", onText: (t) => { keep(t); }, max: 1 });');
    expect(found).toHaveLength(1);
    expect(namesItself(found[0])).toBe(true);
  });

  it('does not stop at the first nested closing brace', () => {
    // The bug a non-greedy regular expression has, written as a test: the
    // naming comes after the nested function, so a short read calls this file
    // silent when it is not.
    const found = asksIn('ask({ onText: (t) => { keep(t); }, about: "reading" })');
    expect(namesItself(found[0])).toBe(true);
  });

  it('sees a call that names nothing as naming nothing', () => {
    // The control. A check that answered "named" for everything would pass
    // every assertion above while reading nothing.
    expect(namesItself(asksIn('ask({ system: "s", messages: [] })')[0])).toBe(false);
  });

  it('is not fooled by a prompt that describes an “about” field', () => {
    /*
     * The exact line that fooled the first version of this check, copied from
     * `lib/classify.ts`: a prompt listing the fields it wants back, one of
     * which is called `about`. A dash, a space, the word, a colon — which is
     * what an option key looks like too, and `classify.ts` was the one silent
     * call site the probe cleared. It was reading the words the model is sent
     * rather than the code that sends them.
     */
    const call = asksIn("ask({ system: 'Reply with JSON.\\n- about: the unit it belongs to\\n', maxTokens: 700 })")[0];
    expect(namesItself(call)).toBe(false);
  });

  it('still sees a real naming beside a prompt like that', () => {
    // The control on the control: emptying the strings must not empty the key.
    const call = asksIn("ask({ system: '- about: the unit', about: 'what this is' })")[0];
    expect(namesItself(call)).toBe(true);
  });

  it('is not fooled by a word ending in ask', () => {
    expect(asksIn('subtask({ about: "x" })')).toEqual([]);
    expect(asksIn('this.ask({ about: "x" })')).toEqual([]);
  });
});

/*
 * `usage`, not `use` — the trap `lib/spend.test.ts` documents at its own top
 * and this file walked straight into. `use` is a React hook name, so the hooks
 * rule reads every call to it as a hook called outside a component, and the
 * whole lint step exits non-zero over a fixture builder in a test.
 */
const usage = (n: number): Usage => ({ input: n, output: n, cacheWrite: 0, cacheRead: 0 });
const row = (from: string, courseId: string | null, n: number): Spent =>
  ({ at: 1, model: 'claude-sonnet-5', from, ...(courseId ? { courseId } : {}), use: usage(n) }) as Spent;

describe('what a course cost to build', () => {
  /*
   * `psci` first, and cheaper, on purpose.
   *
   * A row order that already matched the spending would pass whether or not
   * anything sorted — object insertion order is the order somebody typed, and
   * the first version of this test had the expensive course first and proved
   * nothing about the sort.
   */
  const rows = [
    row('course', 'psci', 200),
    row('course', 'econ', 1000),
    row('quote check', 'econ', 500),
    row('ask', null, 9000),
  ];

  it('adds up the replies filed against each course', () => {
    expect(byCourse(rows).map((r) => [r.courseId, r.spent.asks, r.spent.tokens])).toEqual([
      ['econ', 2, 3000],
      ['psci', 1, 400],
    ]);
  });

  it('leaves out what belongs to no course rather than filing it under a blank', () => {
    // A row labelled nothing reads as a course whose name failed to load, and
    // the total beside it already covers the money.
    expect(byCourse(rows).map((r) => r.courseId)).not.toContain('');
    expect(total(rows).tokens).toBe(21_400);
  });

  it('puts the expensive course first, so the answer is the top row', () => {
    expect(byCourse(rows)[0].courseId).toBe('econ');
  });

  it('answers with nothing when nothing was spent on a course', () => {
    expect(byCourse([row('ask', null, 10)])).toEqual([]);
  });

  it('claims nothing from a moment that is not one', () => {
    /*
     * `validate` in `lib/generate.ts` takes the moment its build started and
     * defaults it to zero, because tests call it directly with no build behind
     * them. A claim from zero would sweep every row the ledger has ever held
     * into whichever course was being validated — so the refusal lives here,
     * in the function anybody can call, rather than at the one call site that
     * happens to remember.
     */
    forget();
    record({ at: Date.now(), model: 'claude-sonnet-5', from: 'ask', use: usage(10) });
    claimFrom(0, 'econ');
    expect(read()[0].courseId).toBeUndefined();
  });
});

describe('what each kind of asking cost', () => {
  it('groups by what asked, whatever course it was for', () => {
    const rows = [row('course', 'econ', 1000), row('course', 'psci', 400), row('quote check', 'econ', 100)];
    expect(byAsker(rows).map((r) => [r.from, r.spent.asks])).toEqual([
      ['course', 2],
      ['quote check', 1],
    ]);
  });

  it('shows what was never named, rather than hiding it', () => {
    expect(byAsker([row(UNNAMED, null, 5)])[0].from).toBe(UNNAMED);
  });
});


describe('claiming a build’s spending once the course exists', () => {
  beforeEach(() => forget());

  it('files the rows written since the build started', () => {
    // The case it is for: `generateCourse` spends before it knows the course's
    // id, because the id comes out of the reply it is paying for.
    const began = Date.now();
    record({ at: began + 1, model: 'claude-sonnet-5', from: 'course', use: usage(1000) });
    claimFrom(began, 'econ' as Spent['courseId'] & string);
    expect(read()[0].courseId).toBe('econ');
  });

  it('leaves alone what was spent before it started', () => {
    // The control, and the reason this takes a moment rather than sweeping the
    // ledger: a question asked in the Ask tab an hour earlier is not part of
    // the build, and filing it under the course would overstate the bill.
    const began = Date.now();
    record({ at: began - 60_000, model: 'claude-sonnet-5', from: 'ask', use: usage(10) });
    record({ at: began + 1, model: 'claude-sonnet-5', from: 'course', use: usage(1000) });
    claimFrom(began, 'econ' as Spent['courseId'] & string);
    expect(read().map((r) => r.courseId ?? null)).toEqual([null, 'econ']);
  });

  it('never takes a row that already names a course', () => {
    // Two builds can overlap. A claim that overwrote would file one course's
    // spending under the other, which is worse than leaving it unattributed.
    const began = Date.now();
    record({
      at: began + 1,
      model: 'claude-sonnet-5',
      from: 'quote check',
      courseId: 'psci' as Spent['courseId'] & string,
      use: usage(50),
    });
    claimFrom(began, 'econ' as Spent['courseId'] & string);
    expect(read()[0].courseId).toBe('psci');
  });

  it('makes the build the answer to what the course cost', () => {
    const began = Date.now();
    record({ at: began + 1, model: 'claude-sonnet-5', from: 'course', use: usage(1000) });
    record({ at: began + 2, model: 'claude-sonnet-5', from: 'reading material', use: usage(200) });
    claimFrom(began, 'econ' as Spent['courseId'] & string);
    const [row] = byCourse(read());
    expect([row.courseId, row.spent.asks, row.spent.tokens]).toEqual(['econ', 2, 2400]);
  });
});
