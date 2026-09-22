import { describe, expect, it } from 'vitest';
import econ from '../data/courses/econ';
import psci from '../data/courses/psci';
import core from '../data/courses/core';
import bus from '../data/courses/bus';
import { editDistance, judge, normalise, tolerance } from './word';

/**
 * Marking what somebody typed.
 *
 * The block that matters most here is the last one, and it is not a unit test:
 * it walks the terms of all four shipped guides and asks how many pairs sit
 * inside each other's typo tolerance. The answer is **one**, and it is the pair
 * that makes the case for the guard existing:
 *
 *     External validity ~ Internal validity, two edits apart
 *
 * Seventeen characters each, so the tolerance is two, so without the ambiguity
 * guard a student who typed `internal validity` when the answer was `external
 * validity` would be **marked right** — in the research-methods course where
 * telling those two apart is the entire lesson. That is not a hypothetical
 * about a tolerance being too wide; it is the shipped data.
 */

const GUIDES = [econ, psci, core, bus];

describe('normalise', () => {
  it('ignores everything somebody can differ on while knowing the answer', () => {
    expect(normalise('  Random   Assignment. ')).toBe('random assignment');
    expect(normalise('Cost-benefit')).toBe(normalise('cost benefit'));
    expect(normalise('naïve')).toBe('naive');
    expect(normalise('The invisible hand')).toBe('invisible hand');
    expect(normalise('p-value')).toBe('p value');
  });

  /*
   * Hyphens become spaces rather than nothing, and the difference is not
   * cosmetic: collapsing `cost-benefit` to `costbenefit` stops it matching the
   * guide that spelled it as two words, which is the case the rule exists for.
   */
  it('turns punctuation into a space rather than removing it', () => {
    expect(normalise('cost-benefit')).toBe('cost benefit');
    expect(normalise('cost-benefit')).not.toBe('costbenefit');
  });

  /*
   * The deliberate omission. `good` and `goods` are two different entries in an
   * economics glossary, so stripping a trailing `s` here would make one
   * unaskable. The tolerance reaches a plural anyway, and reaches it *only*
   * when nothing else is that close — which is the distinction an
   * unconditional rule cannot make.
   */
  it('does not strip a trailing s, because good and goods are two things', () => {
    expect(normalise('goods')).not.toBe(normalise('good'));
  });

  it('is empty for an answer that was only punctuation', () => {
    expect(normalise('  ...  ')).toBe('');
  });
});

describe('editDistance', () => {
  it('counts the edits', () => {
    expect(editDistance('monopoly', 'monopoly')).toBe(0);
    expect(editDistance('monopoly', 'monopol')).toBe(1);
    // Two, not three — measured rather than counted by eye, which got it
    // wrong the first time: `monop|oly` to `monop|sony` is one insertion and
    // one substitution.
    expect(editDistance('monopoly', 'monopsony')).toBe(2);
    expect(editDistance('bias', 'bais')).toBe(2);
  });

  /*
   * The cap is what makes the answer usable rather than a nicety, so it is
   * asserted rather than assumed: past it the function reports `cap + 1` and
   * stops, and a caller asking "within two?" gets the right answer either way.
   */
  it('stops at the cap instead of measuring how far apart two essays are', () => {
    const far = editDistance('a'.repeat(50), 'b'.repeat(50), 2);
    expect(far).toBe(3);
    // The length gate is the other early exit, and it is the one that fires on
    // somebody pasting a paragraph into the box.
    expect(editDistance('gdp', 'gross domestic product', 2)).toBe(3);
  });

  it('is symmetric', () => {
    expect(editDistance('validity', 'vailidty')).toBe(editDistance('vailidty', 'validity'));
  });
});

describe('tolerance', () => {
  /*
   * Nothing for a short answer, and this is the assertion that would go red if
   * somebody made the tolerance flat. A single edit on a four-letter term
   * reaches a different four-letter term; a student who cannot spell one has
   * not produced it.
   */
  it('forgives nothing on a short answer', () => {
    expect(tolerance('bias')).toBe(0);
    expect(tolerance('gdp')).toBe(0);
  });

  it('forgives a slip on a word, and two on a phrase', () => {
    expect(tolerance('monopoly')).toBe(1);
    expect(tolerance('external validity')).toBe(2);
  });
});

describe('judging a typed answer', () => {
  const OTHERS = ['Internal validity', 'Reliability', 'Bias', 'Random sampling'];

  it('takes the answer', () => {
    expect(judge('external validity', 'External validity', OTHERS)).toEqual({ ok: true, exact: true });
  });

  it('takes it through the case, the spacing and the full stop', () => {
    expect(judge('  External  Validity. ', 'External validity', OTHERS)).toMatchObject({ ok: true });
  });

  it('takes a typo on a phrase', () => {
    expect(judge('externl validty', 'External validity', OTHERS)).toEqual({ ok: true, exact: false });
  });

  it('refuses an empty answer, and a box with only punctuation in it', () => {
    expect(judge('', 'External validity', OTHERS).ok).toBe(false);
    expect(judge('   ?  ', 'External validity', OTHERS).ok).toBe(false);
  });

  it('refuses a different answer', () => {
    expect(judge('reliability', 'External validity', OTHERS).ok).toBe(false);
  });

  /*
   * ── The one that matters ──────────────────────────────────────────────
   *
   * Two edits, and the tolerance for a seventeen-character answer is two. The
   * guard is the only thing standing between this and a student being told
   * they know the difference between internal and external validity on the
   * strength of having typed the wrong one.
   */
  it('refuses a near miss that is exactly another term, and says which', () => {
    const v = judge('internal validity', 'External validity', OTHERS);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.confusedWith).toBe('Internal validity');
  });

  /*
   * The control for that one, and the reason it is not just a strict marker
   * wearing a guard's clothes. `externl validty` is two edits from the answer
   * and nowhere near `Internal validity`, and it is taken. A guard that
   * refused both would protect the same thing and be useless.
   */
  it('control: a typo that is not also another term is still taken', () => {
    expect(judge('externl validty', 'External validity', OTHERS).ok).toBe(true);
  });

  /*
   * And the other control. An exact match is checked before the guard runs, so
   * a term that *has* a close neighbour is still answerable — somebody typing
   * `internal validity` for an answer of `Internal validity` is right, and a
   * guard that could not tell that from the case above would make the whole
   * pair unaskable.
   */
  it('control: an exact answer is never refused for having a close neighbour', () => {
    const others = ['External validity', 'Reliability'];
    expect(judge('internal validity', 'Internal validity', others)).toEqual({ ok: true, exact: true });
  });

  /*
   * ── The tie, which is the whole reason the comparison is `<=` ──────────
   *
   * `external` and `internal` are two edits apart, so there is a string one
   * edit from each: `ixternal` has the `e` corrected and the `x` not. Typed
   * against an answer of `External validity` it is exactly as close to
   * `Internal validity`, and it is evidence of nothing — the student has
   * produced a string that is equally a misspelling of either term.
   *
   * Marking it right is a coin flip recorded as knowledge. Written `rival < d`
   * rather than `rival <= d` that is precisely what happens, and every other
   * test in this file passes either way: the near-miss case above has a rival
   * at distance 0 against an answer at distance 2, so it is refused under both
   * readings. This one was found by reverting the comparison and watching
   * nothing go red.
   */
  it('refuses a near miss that is equally close to two terms', () => {
    const v = judge('ixternal validity', 'External validity', OTHERS);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.confusedWith).toBe('Internal validity');
  });

  /*
   * And its control, because a tie only means something if being nearer still
   * wins: one edit closer to the answer than to the rival is taken.
   */
  it('control: a near miss that is nearer the answer than the rival is taken', () => {
    expect(judge('externl validity', 'External validity', OTHERS).ok).toBe(true);
  });

  /*
   * The guard reads the list it is given, so an empty list has to mean "no
   * rivals" rather than "no guard" — and the difference is visible only by
   * asking the same question both ways.
   */
  it('is the list that refuses it, not the answer', () => {
    expect(judge('internal validity', 'External validity', []).ok).toBe(true);
    expect(judge('internal validity', 'External validity', ['Internal validity']).ok).toBe(false);
  });

  it('ignores the answer appearing in its own rivals list', () => {
    expect(judge('externl validty', 'External validity', ['External validity']).ok).toBe(true);
  });
});

describe('the shipped guides, measured rather than assumed', () => {
  const named = GUIDES.flatMap((m) =>
    (m.guide.terms ?? []).map((t) => ({ code: m.course.code, t: t.t })),
  );

  it('control: there are terms to measure', () => {
    // A zero here would make every assertion below pass while measuring an
    // empty list, which is what a broken probe looks like.
    expect(named.length).toBe(82);
  });

  /*
   * Exactly one pair of shipped terms sits inside the typo tolerance, and the
   * number is pinned rather than bounded because it is the finding: the guard
   * is not defending against a class of problem somebody imagined, it is
   * defending against `External validity` and `Internal validity` in PSCI 1104.
   *
   * If a course is added whose glossary has more, this goes red and somebody
   * reads the list — which is the right outcome. The tolerance is not the thing
   * to loosen when that happens; the guard is what makes it safe, and the list
   * is what tells you it is working.
   */
  it('has exactly one pair of terms close enough to need the guard', () => {
    const close: string[] = [];
    for (const m of GUIDES) {
      const terms = (m.guide.terms ?? []).map((t) => t.t);
      for (let i = 0; i < terms.length; i++) {
        for (let j = i + 1; j < terms.length; j++) {
          const a = normalise(terms[i]);
          const b = normalise(terms[j]);
          if (editDistance(a, b, 6) <= Math.max(tolerance(a), tolerance(b))) {
            close.push(`${terms[i]} ~ ${terms[j]}`);
          }
        }
      }
    }
    expect(close).toEqual(['External validity ~ Internal validity']);
  });

  /*
   * And the guard holds for every one of them, asked in both directions.
   *
   * Both directions because the tolerance is computed from the *answer*, so a
   * pair can be safe one way round and not the other whenever the two differ
   * in length. These two do not, which is exactly why asserting only one
   * direction would prove less than it looks.
   */
  it('and refuses each of them, asked either way round', () => {
    const all = named.map((n) => n.t);
    for (const m of GUIDES) {
      const terms = (m.guide.terms ?? []).map((t) => t.t);
      for (const a of terms) {
        for (const b of terms) {
          if (a === b) continue;
          const v = judge(b, a, all);
          expect(v.ok, `typing "${b}" was accepted for "${a}"`).toBe(false);
        }
      }
    }
  });

  /*
   * The control for that sweep, and it is the one the repository keeps
   * relearning: a marker that refuses everything would pass it. So every term
   * has to be answerable by typing itself.
   */
  it('control: every shipped term is answerable by typing it', () => {
    const all = named.map((n) => n.t);
    for (const { code, t } of named) {
      expect(judge(t, t, all), `${code}: "${t}"`).toEqual({ ok: true, exact: true });
    }
  });
});
