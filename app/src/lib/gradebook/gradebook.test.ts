import { describe, expect, it } from 'vitest';
import { finalGrade, letterFor, schemeProblems } from './compute';
import { ANA, AT, BEN, CAL, OTHER_PROF, PROF, REGISTRAR, SCHEME, SECOND, TA, course } from './fixture';
import { current, enterScore, fileRegrade, latestReleased, moderate, release, releasedFor, resolveRegrade, type ScoreInput } from './ledger';
import type { Decision, Entry, Gradebook } from './model';
import { cell, registrarCsv, studentView } from './views';

const ok = <T>(d: Decision<T>): T => {
  if (!d.ok) throw new Error(`expected ok, got ${d.refusal}: ${d.reason}`);
  return d.value;
};
const refusal = <T>(d: Decision<T>) => (d.ok ? 'ok' : d.refusal);
/** A step that must work: a refused one would leave the book as it was and make a test vacuous. */
const step = (o: { book: Gradebook; decision: Decision<unknown> }): Gradebook => {
  ok(o.decision);
  return o.book;
};

const score = (over: Partial<ScoreInput> & { key: string }): ScoreInput => ({
  itemId: 'ps1', studentId: ANA.id, score: 9, mark: null, comment: '', reason: '', ...over,
});

/** Enter and release one grade, as the instructor. */
function graded(book: Gradebook, itemId: string, studentId: string, s: number | null, mark: Entry['mark'] = null): Gradebook {
  const e = enterScore(book, PROF, score({ itemId, studentId, score: s, mark, key: `enter-${itemId}-${studentId}` }), AT);
  ok(e.decision);
  const r = release(e.book, PROF, { itemId, key: `release-${itemId}-${studentId}` }, AT);
  ok(r.decision);
  return r.book;
}

describe('a grading scheme', () => {
  it('is one when its weights sum to exactly 100 and its letters descend to 0', () => {
    expect(schemeProblems(SCHEME)).toEqual([]);
  });

  it('is refused when the weights do not sum to 100, and says what they sum to', () => {
    const short = { ...SCHEME, categories: [SCHEME.categories[0], { ...SCHEME.categories[1], weight: 50 }] };
    expect(schemeProblems(short)).toEqual(['The weights sum to 90, not 100.']);
    const thirds = { ...SCHEME, categories: ['a', 'b', 'c'].map((k) => ({ key: k, name: k, weight: 33.333, dropLowest: 0 })) };
    expect(schemeProblems(thirds)).toEqual(['The weights sum to 99.999, not 100.']);
  });

  it('refuses a repeated key, a letter scale that does not descend, and one that leaves percentages without a letter', () => {
    const bad = {
      ...SCHEME,
      categories: [SCHEME.categories[0], { ...SCHEME.categories[1], key: 'problem-sets' }],
      letters: [{ letter: 'A', min: 90 }, { letter: 'B', min: 95 }, { letter: 'C', min: 10 }],
    };
    const p = schemeProblems(bad);
    expect(p).toContain('The category key "problem-sets" is used twice.');
    expect(p).toContain("B's minimum must be below A's.");
    expect(p).toContain('The last letter must start at 0, so every percentage has one.');
  });

  it('reads the letter from the percentage rounded to two places', () => {
    expect(letterFor(89.995, SCHEME.letters)).toBe('A');
    expect(letterFor(89.994, SCHEME.letters)).toBe('B');
    expect(letterFor(0, SCHEME.letters)).toBe('F');
  });
});

describe('the final grade', () => {
  it('weights categories, drops the lowest problem set, and maps a letter', () => {
    let b = course();
    b = graded(b, 'ps1', ANA.id, 10);
    b = graded(b, 'ps2', ANA.id, 5);
    b = graded(b, 'ps3', ANA.id, 8);
    b = graded(b, 'mid', ANA.id, 85);
    const f = finalGrade(b.scheme, b.items, releasedFor(b, ANA.id));
    // Problem sets 18/20 after dropping the 5 → 90%; 0.4 × 90 + 0.6 × 85 = 87.
    expect(f.percent).toBe(87);
    expect(f.letter).toBe('B');
    expect(f.categories.find((c) => c.key === 'problem-sets')).toMatchObject({ counted: 2, dropped: 1 });
  });

  it('leaves excused work out, counts missing as zero, and never drops the only item', () => {
    let b = course();
    b = graded(b, 'ps1', ANA.id, null, 'excused');
    b = graded(b, 'ps2', ANA.id, null, 'missing');
    b = graded(b, 'mid', ANA.id, 100);
    const f = finalGrade(b.scheme, b.items, releasedFor(b, ANA.id));
    // One problem set counted (the missing zero), drop-lowest 1 keeps it: 0%.
    expect(f.categories.find((c) => c.key === 'problem-sets')).toMatchObject({ percent: 0, counted: 1, dropped: 0, excused: 1 });
    expect(f.percent).toBe(60);
  });

  it('re-weights over the categories with something released, and says which were left out', () => {
    const b = graded(course(), 'mid', ANA.id, 72);
    const f = finalGrade(b.scheme, b.items, releasedFor(b, ANA.id));
    expect(f.percent).toBe(72);
    expect(f.reason).toContain('Nothing released yet in problem-sets');
  });

  it('is I while anything released is incomplete, whatever the arithmetic', () => {
    let b = graded(course(), 'mid', ANA.id, 95);
    b = graded(b, 'ps1', ANA.id, null, 'incomplete');
    expect(finalGrade(b.scheme, b.items, releasedFor(b, ANA.id)).letter).toBe('I');
  });

  it('has no number when nothing is released, and refuses to be handed a draft', () => {
    const b = course();
    expect(finalGrade(b.scheme, b.items, [])).toMatchObject({ percent: null, letter: null });
    const d = step(enterScore(b, TA, score({ key: 'draft-only-1' }), AT));
    expect(() => finalGrade(d.scheme, d.items, [current(d, 'ps1', ANA.id)!])).toThrow(/only released grades count/);
  });
});

describe('entering a score', () => {
  it('records a draft the student cannot see', () => {
    const { book, decision } = enterScore(course(), TA, score({ key: 'ta-enters-1', comment: 'Good work' }), AT);
    expect(ok(decision)).toBe(1);
    expect(current(book, 'ps1', ANA.id)).toMatchObject({ status: 'draft', action: 'entered', gradedBy: TA.id });
    expect(studentView(book, ANA).lines).toEqual([]);
    expect(JSON.stringify(studentView(book, ANA))).not.toContain('Good work');
  });

  it('is refused to anybody without grades:enter on this course — a student, faculty elsewhere, the registrar', () => {
    for (const who of [ANA, OTHER_PROF, REGISTRAR]) {
      const { book, decision } = enterScore(course(), who, score({ studentId: BEN.id, key: `nope-${who.id}` }), AT);
      expect(refusal(decision), who.id).toBe('not-authorised');
      expect(book.entries).toEqual([]);
    }
  });

  it('is refused for a student who is not enrolled here, and for your own grade', () => {
    expect(refusal(enterScore(course(), TA, score({ studentId: CAL.id, key: 'cal-elsewhere' }), AT).decision)).toBe('not-on-roster');
    const taking = { id: ANA.id, capabilities: ['grades:enter' as const] };
    expect(refusal(enterScore(course(), taking, score({ key: 'own-grade-1' }), AT).decision)).toBe('self-grade');
  });

  it('refuses a score out of range, a mark that contradicts it, and no score without a reason for none', () => {
    const b = course();
    for (const [s, m] of [[-1, null], [21, null], [Number.NaN, null], [5, 'excused'], [5, 'missing'], [null, null], [null, 'late']] as const) {
      expect(refusal(enterScore(b, TA, score({ score: s, mark: m, key: `bad-${s}-${m}` }), AT).decision), `${s} ${m}`).toBe('bad-score');
    }
    expect(ok(enterScore(b, TA, score({ score: 20, key: 'extra-credit' }), AT).decision)).toBe(1);
    expect(ok(enterScore(b, TA, score({ score: 7, mark: 'late', key: 'late-seven' }), AT).decision)).toBe(1);
  });

  it('replays the same key and request without writing twice', () => {
    const first = enterScore(course(), TA, score({ key: 'same-key-1' }), AT);
    const again = enterScore(first.book, TA, score({ key: 'same-key-1' }), AT);
    expect(again.decision).toMatchObject({ ok: true, value: 1, replayed: true });
    expect(again.book).toBe(first.book);
    expect(again.book.entries).toHaveLength(1);
  });

  it('refuses the same key for a different request or from somebody else, and a key that is not one', () => {
    const first = step(enterScore(course(), TA, score({ key: 'same-key-2' }), AT));
    expect(refusal(enterScore(first, TA, score({ score: 3, key: 'same-key-2' }), AT).decision)).toBe('key-reused');
    expect(refusal(enterScore(first, PROF, score({ key: 'same-key-2' }), AT).decision)).toBe('key-reused');
    expect(refusal(enterScore(first, TA, score({ key: 'short' }), AT).decision)).toBe('bad-key');
  });
});

describe('moderation', () => {
  const moderated = { ...course(), scheme: { ...SCHEME, moderationRequired: true } };

  it('is a second person: the grader cannot moderate their own grade', () => {
    const b = step(enterScore(moderated, PROF, score({ key: 'prof-grades-1' }), AT));
    expect(refusal(moderate(b, PROF, { itemId: 'ps1', studentId: ANA.id, key: 'prof-moderates-1' }, AT).decision)).toBe('self-moderation');
    expect(ok(moderate(b, SECOND, { itemId: 'ps1', studentId: ANA.id, key: 'second-moderates-1' }, AT).decision)).toBe(2);
  });

  it('holds a draft the scheme says must be moderated, and releases the moderated one', () => {
    let b = step(enterScore(moderated, TA, score({ key: 'ta-ana-1' }), AT));
    b = step(enterScore(b, TA, score({ studentId: BEN.id, score: 6, key: 'ta-ben-1' }), AT));
    b = step(moderate(b, PROF, { itemId: 'ps1', studentId: ANA.id, key: 'prof-mods-ana' }, AT));
    const r = release(b, PROF, { itemId: 'ps1', key: 'release-ps1-1' }, AT);
    expect(ok(r.decision)).toEqual({ released: 1, held: 1 });
    expect(latestReleased(r.book, 'ps1', ANA.id)?.score).toBe(9);
    expect(latestReleased(r.book, 'ps1', BEN.id)).toBeNull();
    expect(studentView(r.book, BEN).lines).toEqual([]);
  });

  it('has nothing to moderate once released, and needs grades:moderate', () => {
    const b = graded(course(), 'ps1', ANA.id, 9);
    expect(refusal(moderate(b, SECOND, { itemId: 'ps1', studentId: ANA.id, key: 'late-moderation' }, AT).decision)).toBe('nothing-to-moderate');
    expect(refusal(moderate(b, TA, { itemId: 'ps1', studentId: ANA.id, key: 'ta-moderation' }, AT).decision)).toBe('not-authorised');
  });
});

describe('release', () => {
  it('needs grades:release', () => {
    const b = step(enterScore(course(), TA, score({ key: 'ta-enters-2' }), AT));
    expect(refusal(release(b, TA, { itemId: 'ps1', key: 'ta-releases-1' }, AT).decision)).toBe('not-authorised');
    expect(refusal(release(b, REGISTRAR, { itemId: 'ps1', key: 'registrar-releases' }, AT).decision)).toBe('not-authorised');
  });

  it('says when there is nothing to release, and replays rather than releasing twice', () => {
    const b = step(enterScore(course(), TA, score({ key: 'ta-enters-3' }), AT));
    const r = release(b, PROF, { itemId: 'ps1', key: 'release-once' }, AT);
    expect(ok(r.decision)).toEqual({ released: 1, held: 0 });
    expect(release(r.book, PROF, { itemId: 'ps1', key: 'release-once' }, AT).decision).toMatchObject({ replayed: true });
    expect(refusal(release(r.book, PROF, { itemId: 'ps1', key: 'release-twice' }, AT).decision)).toBe('nothing-to-release');
  });

  it('shows a student their own released grade and nobody else\'s', () => {
    let b = graded(course(), 'ps1', ANA.id, 9);
    b = step(enterScore(b, PROF, score({ studentId: BEN.id, score: 4, comment: 'Ben: see me', key: 'ben-ps1-enter' }), AT));
    b = step(release(b, PROF, { itemId: 'ps1', key: 'release-ben' }, AT));
    const ana = studentView(b, ANA);
    expect(ana.lines.map((l) => [l.itemId, l.score])).toEqual([['ps1', 9]]);
    expect(JSON.stringify(ana)).not.toContain('Ben: see me');
    expect(studentView(b, CAL).lines).toEqual([]);
    // The control: Ben's grade is released, so its absence above is the filter's doing.
    expect(studentView(b, BEN).lines.map((l) => [l.itemId, l.score, l.comment])).toEqual([['ps1', 4, 'Ben: see me']]);
  });
});

describe('changing a released grade', () => {
  it('needs a reason, and leaves the released grade in view until the change is released', () => {
    const b = graded(course(), 'ps1', ANA.id, 6);
    expect(refusal(enterScore(b, PROF, score({ score: 8, key: 'change-no-reason' }), AT).decision)).toBe('reason-required');
    const c = step(enterScore(b, PROF, score({ score: 8, reason: 'Misread question 3', key: 'change-with-reason' }), AT));
    expect(current(c, 'ps1', ANA.id)).toMatchObject({ status: 'draft', action: 'changed', reason: 'Misread question 3', version: 3 });
    expect(studentView(c, ANA).lines[0].score).toBe(6);
    const r = step(release(c, PROF, { itemId: 'ps1', key: 'release-change' }, AT));
    expect(studentView(r, ANA).lines[0].score).toBe(8);
  });

  it('never edits or removes a version: every earlier one is still there, byte for byte', () => {
    const b = graded(course(), 'ps1', ANA.id, 6);
    const before = JSON.stringify(b.entries);
    let c = step(enterScore(b, PROF, score({ score: 8, reason: 'Recount', key: 'recount-1' }), AT));
    c = step(release(c, PROF, { itemId: 'ps1', key: 'release-recount' }, AT));
    c = step(fileRegrade(c, ANA, { itemId: 'ps1', reason: 'Question 4 matches the key', key: 'ana-asks-1' }, AT));
    c = step(resolveRegrade(c, TA, { requestId: 'ana-asks-1', outcome: 'changed', score: 9, mark: null, note: 'Q4 was right', key: 'resolve-ana-1' }, AT));
    expect(JSON.stringify(c.entries.slice(0, b.entries.length))).toBe(before);
    expect(c.entries.map((e) => [e.version, e.action, e.status])).toEqual([
      [1, 'entered', 'draft'], [2, 'released', 'released'], [3, 'changed', 'draft'], [4, 'released', 'released'], [5, 'regraded', 'draft'],
    ]);
  });
});

describe('regrade requests', () => {
  it('are filed by the student over a released grade only', () => {
    const b = step(enterScore(course(), PROF, score({ key: 'unreleased-1' }), AT));
    expect(refusal(fileRegrade(b, ANA, { itemId: 'ps1', reason: 'Please look', key: 'ana-too-early' }, AT).decision)).toBe('no-released-grade');
    expect(refusal(fileRegrade(b, CAL, { itemId: 'ps1', reason: 'Please look', key: 'cal-not-here' }, AT).decision)).toBe('no-released-grade');
  });

  it('allow one open request per item, and are resolved once, by a grader', () => {
    let b = graded(course(), 'ps1', ANA.id, 6);
    b = step(fileRegrade(b, ANA, { itemId: 'ps1', reason: 'Q4', key: 'ana-regrade-1' }, AT));
    expect(refusal(fileRegrade(b, ANA, { itemId: 'ps1', reason: 'Again', key: 'ana-regrade-2' }, AT).decision)).toBe('regrade-open');
    expect(refusal(resolveRegrade(b, ANA, { requestId: 'ana-regrade-1', outcome: 'changed', score: 10, mark: null, note: 'I agree', key: 'ana-resolves' }, AT).decision)).toBe('not-authorised');
    expect(refusal(resolveRegrade(b, TA, { requestId: 'ana-regrade-1', outcome: 'upheld', score: null, mark: null, note: ' ', key: 'ta-no-note' }, AT).decision)).toBe('reason-required');

    const r = resolveRegrade(b, TA, { requestId: 'ana-regrade-1', outcome: 'changed', score: 8, mark: null, note: 'Q4 was right', key: 'ta-resolves-1' }, AT);
    const entryId = ok(r.decision);
    expect(current(r.book, 'ps1', ANA.id)).toMatchObject({ id: entryId, status: 'draft', action: 'regraded', regradeId: 'ana-regrade-1', score: 8 });
    // The student reads the answer at once, and the new score once it is released.
    expect(studentView(r.book, ANA)).toMatchObject({ lines: [{ score: 6 }], regrades: [{ resolution: { outcome: 'changed', note: 'Q4 was right' } }] });
    expect(refusal(resolveRegrade(r.book, TA, { requestId: 'ana-regrade-1', outcome: 'upheld', score: null, mark: null, note: 'No', key: 'ta-resolves-2' }, AT).decision)).toBe('already-resolved');
    // And the grade the request contested is exactly as it was.
    expect(r.book.entries.find((e) => e.id === r.book.regrades[0].contestedEntry)).toMatchObject({ status: 'released', score: 6 });
  });
});

describe('the registrar export', () => {
  function term() {
    let b = graded(course(), 'mid', ANA.id, 91);
    b = graded(b, 'mid', BEN.id, 64);
    // A draft change for Ana that must not reach the registrar.
    b = step(enterScore(b, PROF, score({ itemId: 'mid', score: 40, reason: 'typo?', key: 'ana-draft-change' }), AT));
    return b;
  }
  const names = {
    [ANA.id]: { studentNumber: 'S001', name: 'Ana, "Annie" Ruiz' },
    [BEN.id]: { studentNumber: 'S002', name: '=HYPERLINK("http://x")' },
  };

  it('lists every enrolled student with their released final grade only', () => {
    const csv = ok(registrarCsv(term(), REGISTRAR, names));
    expect(csv.split('\r\n')).toEqual([
      'student_number,name,course,term,percent,letter,basis',
      'S001,"Ana, ""Annie"" Ruiz",ECON 1020,2026FA,91.00,A,91% earns A. Nothing released yet in problem-sets; the other categories are re-weighted.',
      'S002,"\'=HYPERLINK(""http://x"")",ECON 1020,2026FA,64.00,D,64% earns D. Nothing released yet in problem-sets; the other categories are re-weighted.',
      '',
    ]);
  });

  it('is refused to a TA, and refused outright when the weights do not sum to 100', () => {
    expect(refusal(registrarCsv(term(), TA, names))).toBe('not-authorised');
    const off = { ...term(), scheme: { ...SCHEME, categories: [{ ...SCHEME.categories[0], weight: 30 }, SCHEME.categories[1]] } };
    const d = registrarCsv(off, REGISTRAR, names);
    expect(refusal(d)).toBe('bad-scheme');
    expect(d.reason).toContain('The weights sum to 90, not 100.');
  });

  it('never lets a cell start a formula', () => {
    for (const v of ['=1+1', '+1', '-1', '@SUM(A1)']) expect(cell(v).replace(/^"/, '').startsWith("'")).toBe(true);
    expect(cell('plain')).toBe('plain');
    expect(cell(null)).toBe('');
  });
});
