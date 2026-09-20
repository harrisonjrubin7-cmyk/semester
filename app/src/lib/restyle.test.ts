import { describe, expect, it } from 'vitest';
import {
  check,
  chapters,
  parseReply,
  quantities,
  restyledId,
  restyledScript,
} from '../../../pipeline/restyle.mjs';

/**
 * What a restyled podcast script is not allowed to do.
 *
 * `pipeline/restyle-script.mjs` asks a model to change how an episode sounds
 * and to leave what it says alone. The prompt says so at length; this is what
 * makes it true. A rewrite pass that invents a figure produces a script that
 * sounds exactly as confident as the four that shipped, and a student revising
 * from it has no way to tell.
 *
 * The guard lives here because this is where CI runs, and `restyle.mjs` is
 * pure — no SDK, no network, no filesystem — so vitest reads it across the
 * root for nothing. Same arrangement as `slidefit.test.ts` and `shorts.test.ts`.
 */

// The shapes come from `pipeline/restyle.d.mts` rather than being restated
// here — a test that declares its own idea of a script can pass against a
// module that changed.
import type { Script, ScriptLine as Line } from '../../../pipeline/restyle.mjs';

const ORIGINAL: Script = {
  id: 'econ-podcast',
  course: 'econ',
  title: 'ECON 1020 — Thinking at the Margin',
  voices: { host: 'en-us-lessac-medium', expert: 'en-us-ryan-high' },
  lines: [
    { chapter: 'Cold open', v: 'host', t: 'Eighty percent of this grade is three exams.' },
    { v: 'expert', t: 'And the other twenty is problem sets.' },
    { chapter: 'Supply and demand', v: 'host', t: 'What moves you along a curve?' },
    { v: 'expert', t: 'A change in the price of the good itself.' },
    { chapter: 'Self-test', v: 'host', t: 'One. What is a sunk cost?', pause: 7 },
    { v: 'expert', t: 'Spent and unrecoverable.' },
  ],
};

/** A restyle that behaved: different words, same facts and same skeleton. */
const GOOD: Script = {
  ...ORIGINAL,
  lines: [
    { chapter: 'Cold open', v: 'host', t: 'So — eighty percent of this grade? Three exams.' },
    { v: 'expert', t: 'Right, and the remaining twenty is the problem sets.' },
    { chapter: 'Supply and demand', v: 'host', t: 'Okay, so what actually moves you along a curve?' },
    { v: 'expert', t: 'Only one thing: a change in the price of the good itself.' },
    { chapter: 'Self-test', v: 'host', t: 'Number one. What is a sunk cost?', pause: 7 },
    { v: 'expert', t: 'Money spent, and unrecoverable.' },
  ],
};

const withLines = (lines: Line[]): Script => ({ ...ORIGINAL, lines });

describe('reading quantities out of a script', () => {
  it('finds digits', () => {
    expect([...quantities('the pitch takes 400 ms').keys()]).toContain('400');
  });

  it('finds numbers spelled out for the ear, as the same fact as the digits', () => {
    // `audio/README.md` requires the spelling: a synthesiser reads "80%"
    // badly, so the scripts that ship say "eighty percent". A digits-only
    // check would have seen no figures at all in ECON's opening line — and a
    // words-only one would call "80 percent" a different claim.
    expect([...quantities('Eighty percent of this grade').keys()]).toContain('80');
    expect([...quantities('80 percent of this grade').keys()]).toContain('80');
  });

  it('treats a decimal as one quantity', () => {
    expect([...quantities('a 4.5 to 1 ratio').keys()].sort()).toEqual(['1', '4.5']);
  });

  it('keeps a proportion as its own word', () => {
    // "a quarter" and "25" are the same arithmetic and not the same claim —
    // one is a share of something, the other could be anything. Collapsing
    // them would let a rewrite swap one for the other unnoticed.
    expect([...quantities('about a quarter of the marks').keys()]).toEqual(['quarter']);
    expect(quantities('a quarter').has('25')).toBe(false);
  });

  it('ignores a comma inside a figure, so 1,000 and 1000 are one fact', () => {
    expect(quantities('1,000 students').get('1000')).toBe(1);
  });
});

describe('checking a restyled script', () => {
  it('passes a rewrite that changed only the words', () => {
    expect(check(ORIGINAL, GOOD)).toEqual([]);
  });

  it('refuses an invented number', () => {
    // The worst outcome, and the one a helpful rewrite reaches for: an
    // illustrative figure that no one checked, said in the same voice as the
    // real ones.
    const bad = withLines(
      GOOD.lines.map((l, i) =>
        i === 3 ? { ...l, t: 'A change in price — say a 15 percent rise.' } : l,
      ),
    );
    expect(check(ORIGINAL, bad).join(' ')).toMatch(/not in the original.*15/);
  });

  it('refuses a dropped number', () => {
    const bad = withLines(
      GOOD.lines.map((l, i) =>
        i === 0 ? { ...l, t: 'So — most of this grade? Exams.' } : l,
      ),
    );
    expect(check(ORIGINAL, bad).join(' ')).toMatch(/dropped from the original/);
  });

  it('allows a figure to move between digits and words', () => {
    // "three exams" and "3 exams" are the same fact. A check that called this
    // a change would be a check nobody could use.
    const reworded = withLines(
      GOOD.lines.map((l, i) => (i === 4 ? { ...l, t: '1. What is a sunk cost?', pause: 7 } : l)),
    );
    expect(check(ORIGINAL, reworded)).toEqual([]);
  });

  it('refuses a renamed chapter', () => {
    const bad = withLines(
      GOOD.lines.map((l) => (l.chapter === 'Self-test' ? { ...l, chapter: 'Quiz time' } : l)),
    );
    const said = check(ORIGINAL, bad).join(' ');
    expect(said).toMatch(/Chapters lost: Self-test/);
    expect(said).toMatch(/Chapters invented: Quiz time/);
  });

  it('refuses reordered chapters even when none is lost', () => {
    const bad = withLines([GOOD.lines[2], GOOD.lines[3], GOOD.lines[0], GOOD.lines[1], GOOD.lines[4], GOOD.lines[5]]);
    expect(check(ORIGINAL, bad).join(' ')).toMatch(/order changed/);
  });

  it('refuses a speaker the voices map does not have', () => {
    const bad = withLines(GOOD.lines.map((l, i) => (i === 1 ? { ...l, v: 'narrator' } : l)));
    expect(check(ORIGINAL, bad).join(' ')).toMatch(/Unknown speaker "narrator"/);
  });

  it('refuses a self-test with its answering silence removed', () => {
    const bad = withLines(
      GOOD.lines.map((l) => {
        const { pause: _drop, ...rest } = l;
        return rest;
      }),
    );
    expect(check(ORIGINAL, bad).join(' ')).toMatch(/answer-pauses were dropped/);
  });

  it('refuses an empty line rather than synthesising silence', () => {
    const bad = withLines(GOOD.lines.map((l, i) => (i === 1 ? { ...l, t: '   ' } : l)));
    expect(check(ORIGINAL, bad).join(' ')).toMatch(/no spoken text/);
  });

  it('refuses something that is not a script at all', () => {
    expect(check(ORIGINAL, null).join(' ')).toMatch(/not a script/);
    expect(check(ORIGINAL, { lines: [] }).join(' ')).toMatch(/no lines/);
    expect(check(ORIGINAL, { title: 'hi' }).join(' ')).toMatch(/not a script/);
  });

  it('reports every problem at once, not the first', () => {
    // A rewrite that went wrong usually went wrong in several ways, and
    // fixing them one round-trip at a time costs a model call each.
    const bad = withLines([
      { chapter: 'Cold open', v: 'announcer', t: 'Ninety percent of this grade is two exams.' },
    ]);
    expect(check(ORIGINAL, bad).length).toBeGreaterThan(2);
  });
});

describe('against the four scripts that actually shipped', () => {
  /*
   * A fixture proves the check rejects what it was written to reject. These
   * prove it accepts what it must: every episode in the repository, unchanged,
   * has to come back clean. A check that flags a real script has a false
   * positive rate of one in four and would be turned off within a week.
   */
  const dir = new URL('../../../audio/scripts/', import.meta.url);
  const ids = ['bus1600', 'core2500', 'econ1020', 'psci1104'];

  for (const id of ids) {
    it(`passes ${id} against itself`, async () => {
      const { readFileSync } = await import('node:fs');
      const script = JSON.parse(readFileSync(new URL(`${id}.json`, dir), 'utf8'));
      expect(script.lines.length).toBeGreaterThan(50);
      expect(check(script, script)).toEqual([]);
    });
  }

  it('counts repeats, so softening one of four still shows', () => {
    // The case that rewrote this check. "eighty" is said four times in the
    // ECON episode; comparing sets, three of them could be styled away and
    // the fourth would vouch for all four.
    expect(quantities('eighty, and eighty again, and eighty').get('80')).toBe(3);
  });

  it('catches a figure styled out of a real episode', async () => {
    // Not a fixture: ECON's own opening line, with the one number in it
    // softened the way a rewrite softens things.
    const { readFileSync } = await import('node:fs');
    const script = JSON.parse(readFileSync(new URL('econ1020.json', dir), 'utf8'));
    const softened = {
      ...script,
      lines: script.lines.map((l: Line, i: number) =>
        i === 0 ? { ...l, t: l.t.replace(/Eighty percent/, 'Most') } : l,
      ),
    };
    expect(check(script, softened).join(' ')).toMatch(/dropped from the original: 80/);
  });
});

describe('the identity of a restyled episode', () => {
  it('is its own edition, not a replacement', () => {
    // Both may exist at once — the app lists editions per course, and two
    // files claiming to be `econ-podcast` would be one file.
    expect(restyledId(ORIGINAL, 'storyteller')).toBe('econ-podcast-storyteller');
  });

  it('reads chapters in running order', () => {
    expect(chapters(ORIGINAL)).toEqual(['Cold open', 'Supply and demand', 'Self-test']);
  });
});

describe('reading the model\u2019s reply', () => {
  /*
   * The seam between a model's output and this repository's files, and the
   * one part of `restyle-script.mjs` that cannot be exercised without a
   * network call — which is exactly why it lives in the pure module. A seam
   * that needs an API key to test is a seam nobody tests.
   */
  it('reads plain JSON', () => {
    expect(parseReply('{"lines":[{"v":"host","t":"hi"}]}').lines).toHaveLength(1);
  });

  it('unwraps a fenced block, which is the one deviation worth forgiving', () => {
    expect(parseReply('```json\n{"lines":[1,2]}\n```').lines).toHaveLength(2);
    expect(parseReply('```\n{"lines":[1]}\n```').lines).toHaveLength(1);
  });

  it('ignores surrounding whitespace', () => {
    expect(parseReply('\n\n  {"lines":[1]}  \n').lines).toHaveLength(1);
  });

  it('throws on prose rather than guessing at it', () => {
    // A throw is handled exactly like a failed check: nothing is written.
    expect(() => parseReply('Sure! Here is the restyled script:')).toThrow(/not JSON/);
  });

  it('throws on an empty reply', () => {
    expect(() => parseReply('')).toThrow(/returned nothing/);
    expect(() => parseReply(null)).toThrow(/returned nothing/);
  });
});

describe('the file a passing restyle becomes', () => {
  it('keeps the course and the voices, and takes a new identity', () => {
    const style = { label: 'Storyteller', blurb: '', rules: [] };
    const out = restyledScript(ORIGINAL, 'storyteller', style, GOOD.lines);
    expect(out.id).toBe('econ-podcast-storyteller');
    expect(out.course).toBe('econ');
    expect(out.voices).toEqual(ORIGINAL.voices);
    expect(out.title).toMatch(/Storyteller$/);
    expect(out.lines).toBe(GOOD.lines);
  });

  it('leaves the original untouched', () => {
    const before = JSON.stringify(ORIGINAL);
    restyledScript(ORIGINAL, 'storyteller', { label: 'S', blurb: '', rules: [] }, []);
    expect(JSON.stringify(ORIGINAL)).toBe(before);
  });
});
