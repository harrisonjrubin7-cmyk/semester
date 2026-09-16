import { describe, expect, it } from 'vitest';
import {
  coverage,
  coverageLine,
  readProposal,
  readSpan,
  saysEverything,
  scopePrompt,
  unitsIn,
  worthSaying,
} from './covers';

const UNITS = [
  { name: '1 · Theory-driven research' },
  { name: '2 · Concepts and measurement' },
  { name: '3 · Describing a variable' },
  { name: '4 · Hypotheses and variables' },
  { name: '5 · Causality' },
  { name: '6 · Research design and validity' },
  { name: '7 · Experiments' },
  { name: '8 · Controlling without an experiment' },
  { name: '9 · Sampling' },
];

describe('readSpan', () => {
  it('reads the shapes a syllabus actually writes', () => {
    expect(readSpan('Everything through Oct 13 — units 1 to 8.')).toEqual({ from: 1, to: 8 });
    expect(readSpan('Covers chapters 4–7')).toEqual({ from: 4, to: 7 });
    expect(readSpan('sessions 3 through 9, closed note')).toEqual({ from: 3, to: 9 });
    expect(readSpan('weeks 2-5')).toEqual({ from: 2, to: 5 });
  });

  it('takes a single part as a span of one', () => {
    expect(readSpan('On unit 7 only')).toEqual({ from: 7, to: 7 });
  });

  it('puts a backwards range the right way round', () => {
    expect(readSpan('units 8 to 1')).toEqual({ from: 1, to: 8 });
  });

  it('refuses a bare range, which in a deadline is usually something else', () => {
    // The failure this narrowness exists for: a weight, a time, a page count.
    expect(readSpan('Weighted 25 to 30% of the grade')).toBeNull();
    expect(readSpan('In class, 2 to 4 pm')).toBeNull();
    expect(readSpan('Multiple choice, in class, closed note.')).toBeNull();
  });
});

describe('saysEverything', () => {
  it('recognises a cumulative exam by the words for it', () => {
    expect(saysEverything('A comprehensive final')).toBe(true);
    expect(saysEverything('Cumulative — everything covered this term')).toBe(true);
    expect(saysEverything('Second of the three multiple-choice exams.')).toBe(false);
  });
});

describe('unitsIn', () => {
  it('selects by the number in the guide’s own name', () => {
    expect(unitsIn(UNITS, { from: 1, to: 3 })).toEqual([0, 1, 2]);
    expect(unitsIn(UNITS, { from: 7, to: 20 })).toEqual([6, 7, 8]);
  });

  it('selects nothing from a guide that numbers nothing', () => {
    expect(unitsIn([{ name: 'Markets' }, { name: 'Monopoly' }], { from: 1, to: 2 })).toEqual([]);
  });
});

describe('coverage', () => {
  it('follows what the syllabus said', () => {
    const c = coverage({
      exam: { title: 'Midterm exam', detail: 'Everything through Oct 13 — units 1 to 8.' },
      units: UNITS,
    });
    expect(c.source).toBe('said');
    expect(c.units).toHaveLength(8);
    expect(coverageLine(c, UNITS.length)).toContain('the syllabus says 1 to 8');
  });

  it('counts the whole course when nothing says otherwise', () => {
    const c = coverage({
      exam: { title: 'Midterm 2', detail: 'Second of the three multiple-choice exams.' },
      units: UNITS,
    });
    expect(c.source).toBe('whole');
    expect(c.units).toHaveLength(UNITS.length);
    // The default says it is a default, with the fix in the same sentence.
    expect(coverageLine(c, UNITS.length)).toContain('Nothing in this deadline says');
  });

  it('will not guess a span from a course with several exams', () => {
    // The inference deliberately not made: three exams, nine units, no split.
    const c = coverage({ exam: { title: 'Midterm 1' }, units: UNITS });
    expect(c.units).toHaveLength(UNITS.length);
    expect(c.source).toBe('whole');
  });

  it('lets what you typed beat what the PDF managed to write down', () => {
    const c = coverage({
      exam: { title: 'Midterm exam', detail: 'units 1 to 8' },
      units: UNITS,
      yours: '3 to 6',
    });
    expect(c.source).toBe('yours');
    expect(c.units).toEqual([2, 3, 4, 5]);
    expect(coverageLine(c, UNITS.length)).toContain('because you said so');
  });

  it('takes a bare range in the box that asks nothing else', () => {
    expect(coverage({ exam: { title: 'Final' }, units: UNITS, yours: '5-9' }).units).toEqual([
      4, 5, 6, 7, 8,
    ]);
    expect(coverage({ exam: { title: 'Final' }, units: UNITS, yours: '7' }).units).toEqual([6]);
  });

  it('takes "all" as an answer, and says whose answer it was', () => {
    const c = coverage({ exam: { title: 'Final' }, units: UNITS, yours: 'all' });
    expect(c.source).toBe('yours');
    expect(c.units).toHaveLength(UNITS.length);
    expect(coverageLine(c, UNITS.length)).toContain('because you said so');
  });

  it('falls back to the whole course rather than to an empty one', () => {
    // A span that selects nothing — out of range, or a guide with no numbers —
    // must not leave a runway with no units on it.
    const c = coverage({ exam: { title: 'Final', detail: 'units 40 to 50' }, units: UNITS });
    expect(c.source).toBe('whole');
    expect(c.units).toHaveLength(UNITS.length);
    const unnumbered = coverage({
      exam: { title: 'Final', detail: 'units 1 to 3' },
      units: [{ name: 'Markets' }],
    });
    expect(unnumbered.source).toBe('whole');
    expect(unnumbered.units).toEqual([0]);
  });

  it('does not read a span out of a cumulative exam', () => {
    const c = coverage({
      exam: { title: 'Final', detail: 'Cumulative. Units 1 to 3 get extra weight.' },
      units: UNITS,
    });
    expect(c.source).toBe('whole');
    expect(c.units).toHaveLength(UNITS.length);
  });

  it('has nothing to offer a course with one unit', () => {
    expect(worthSaying(1)).toBe(false);
    expect(worthSaying(9)).toBe(true);
  });
});

describe('a reading of the line, offered rather than applied', () => {
  const units = [
    { name: '1 · Foundations' },
    { name: '2 · Measurement' },
    { name: '3 · Causal inference' },
    { name: '4 · The Fisher paper' },
    { name: '5 · Panel data' },
    { name: '6 · Experiments' },
  ];

  const said =
    'Midterm · In class, 75 minutes. Everything up to and including the Fisher paper is fair game; ' +
    'nothing after it will be asked.';

  it('is the case the two parsers decline, which is why it exists', () => {
    // The precondition for the whole feature. If `coverage` could read this
    // line there would be nothing to offer, and offering anyway would invite
    // somebody to replace a fact with a guess.
    expect(coverage({ exam: { title: 'Midterm', detail: said }, units }).source).toBe('whole');
  });

  it('reads a span and the sentence it came from', () => {
    const p = readProposal({ from: 1, to: 4, because: 'Everything up to and including the Fisher paper is fair game' }, units, said)!;
    expect(p.span).toEqual({ from: 1, to: 4 });
    expect(p.units).toEqual([0, 1, 2, 3]);
    expect(p.text).toBe('units 1 to 4');
  });

  it('refuses a quote the source does not contain', () => {
    /*
     * The check that makes confirming a decision rather than a leap of faith.
     * A plausible sentence the syllabus never wrote is the worst possible
     * evidence, because it reads exactly like the real thing — the same rule
     * `lib/cite.ts` applies to every quote this app generates.
     */
    expect(
      readProposal({ from: 1, to: 4, because: 'The midterm covers the first four units.' }, units, said),
    ).toBeNull();
  });

  it('refuses a paraphrase, however close', () => {
    expect(
      readProposal({ from: 1, to: 4, because: 'Everything up to the Fisher paper is fair game' }, units, said),
    ).toBeNull();
  });

  it('says nothing when the line says nothing, which is the common answer', () => {
    expect(readProposal({ from: null }, units, said)).toBeNull();
    expect(readProposal({}, units, said)).toBeNull();
    expect(readProposal('no', units, said)).toBeNull();
  });

  it('refuses a number that is not a unit number', () => {
    /*
     * Found by trying. A mutation that replaced the integer check with a bare
     * `typeof === 'number'` passed every test in this block, because the
     * quote check was catching the malformed replies on its own — so the
     * narrowing here was asserted by nothing.
     *
     * The dangerous shape is the last one: a silence reported as `null` and
     * a quote that *is* in the source. Without the check, `null` reads as an
     * object, falls through to a default, and the app proposes a scope for a
     * line that declined to state one.
     */
    const quote = 'nothing after it will be asked';
    expect(readProposal({ from: 1.5, to: 4, because: quote }, units, said)).toBeNull();
    expect(readProposal({ from: '1', to: '4', because: quote }, units, said)).toBeNull();
    expect(readProposal({ from: 0, to: 4, because: quote }, units, said)).toBeNull();
    expect(readProposal({ from: null, because: quote }, units, said)).toBeNull();
  });

  it('refuses a span that selects no unit this course has', () => {
    expect(
      readProposal({ from: 40, to: 44, because: 'Everything up to and including the Fisher paper is fair game' }, units, said),
    ).toBeNull();
  });

  it('refuses a proposal that covers everything, which is the default dressed up', () => {
    expect(
      readProposal({ from: 1, to: 6, because: 'Everything up to and including the Fisher paper is fair game' }, units, said),
    ).toBeNull();
  });

  it('takes one unit as a span of one', () => {
    const p = readProposal({ from: 4, because: 'nothing after it will be asked' }, units, said)!;
    expect(p.units).toEqual([3]);
    expect(p.text).toBe('unit 4');
  });

  it('changes nothing until it is confirmed', () => {
    /*
     * The design, asserted rather than described. `coverage` takes the three
     * sources it always did — there is no fourth — so a proposal that has been
     * read and not accepted cannot reach any count on any screen. It is only
     * when its `text` is written into the student's own box that anything
     * moves, and then the source is `yours`, because a person said so.
     */
    const before = coverage({ exam: { title: 'Midterm', detail: said }, units });
    expect(before.source).toBe('whole');
    expect(before.units).toHaveLength(6);

    const p = readProposal({ from: 1, to: 4, because: 'Everything up to and including the Fisher paper is fair game' }, units, said)!;

    // Still nothing: reading it did not write it.
    expect(coverage({ exam: { title: 'Midterm', detail: said }, units }).units).toHaveLength(6);

    const after = coverage({ exam: { title: 'Midterm', detail: said }, units, yours: p.text });
    expect(after.source).toBe('yours');
    expect(after.units).toEqual([0, 1, 2, 3]);
  });

  it('tells the model to answer with nothing where the line is silent', () => {
    // The prompt and the reader are in one file so they cannot drift, the
    // arrangement `lib/figure.ts` settled on after a prompt asked for a field
    // nothing read.
    const p = scopePrompt(units);
    expect(p).toContain('{"from": null}');
    expect(p).toContain('word for word');
    expect(p).toContain('1 · Foundations');
    // The one inference the engine refuses, refused in the prompt too.
    expect(p).toContain('Do not infer a split from how many exams there are');
  });
});
