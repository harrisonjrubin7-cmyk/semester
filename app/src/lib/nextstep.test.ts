import { describe, expect, it } from 'vitest';
import { BESIDE, EXAM_SOON, QUIZ_SOON, beside, nextStep, rest, type StepInput, type Way } from './nextstep';
import type { Guide, StudyMode } from './types';

const way = (id: StudyMode, label: string = id): Way => ({ id, label });

const ALL = [
  way('cards', 'Cards'),
  way('read', 'Read'),
  way('field', 'Field guide'),
  way('watch', 'Watch'),
  way('quiz', 'Quiz'),
  way('cram', 'Cram'),
];

const guide = (mastery: number[]): Guide =>
  ({
    code: 'ECON 1020',
    units: mastery.map((m, i) => ({ name: `Unit ${i + 1}`, mastery: m, cards: [] })),
  }) as unknown as Guide;

const input = (over: Partial<StepInput> = {}): StepInput => ({
  ways: ALL,
  guide: guide([80, 60]),
  due: 0,
  testIn: null,
  testKind: 'Exam',
  started: true,
  ...over,
});

describe('nothing to offer', () => {
  it('says nothing for a course with no ways into it', () => {
    expect(nextStep(input({ ways: [] }))).toBeNull();
  });
});

describe('cards that have come round', () => {
  it('uses the adaptive loop recommendation when its activity is available', () => {
    const s = nextStep(
      input({
        adaptive: {
          activity: 'cards',
          label: 'Review 4 cards',
          reason: '4 retrievals are due. Recurring procedure error.',
          evidence: [],
        },
      }),
    );
    expect(s).toEqual({
      id: 'cards',
      label: 'Review 4 cards',
      why: '4 retrievals are due. Recurring procedure error.',
    });
  });

  it('beats everything else, and counts them', () => {
    const s = nextStep(input({ due: 12, testIn: 2 }));
    expect(s).toMatchObject({ id: 'cards', label: 'Review 12 cards' });
    expect(s?.why).toBe('12 cards have come round for review.');
  });

  it('reads properly for one', () => {
    const s = nextStep(input({ due: 1 }));
    expect(s?.label).toBe('Review 1 card');
    expect(s?.why).toBe('One card has come round for review.');
  });

  it('is skipped when the course has no cards', () => {
    const s = nextStep(input({ due: 9, ways: [way('read', 'Read')] }));
    expect(s?.id).not.toBe('cards');
  });
});

describe('a test close enough to matter', () => {
  it('offers the cram sheet and says when', () => {
    const s = nextStep(input({ testIn: 6 }));
    expect(s).toMatchObject({ id: 'cram', label: 'Open the cram sheet' });
    expect(s?.why).toBe('The exam is in 6 days.');
  });

  it('reads today and tomorrow as words', () => {
    expect(nextStep(input({ testIn: 0 }))?.why).toBe('The exam is today.');
    expect(nextStep(input({ testIn: 1 }))?.why).toBe('The exam is tomorrow.');
  });

  it('falls back to a quiz when there is no cram sheet', () => {
    const s = nextStep(input({ testIn: 3, ways: ALL.filter((w) => w.id !== 'cram') }));
    expect(s?.id).toBe('quiz');
  });

  it('ignores an exam that is still far off', () => {
    expect(nextStep(input({ testIn: EXAM_SOON + 1 }))?.id).not.toBe('cram');
  });

  it('ignores an exam that has gone', () => {
    expect(nextStep(input({ testIn: -2 }))?.id).not.toBe('cram');
  });

  it('calls a quiz a quiz', () => {
    // Most courses set five quizzes for every exam, and a line that promotes
    // one to an exam is a line nobody trusts the second time.
    const s = nextStep(input({ testIn: 2, testKind: 'Quiz' }));
    expect(s?.why).toBe('The quiz is in 2 days.');
  });

  it('gives a quiz a shorter runway than an exam', () => {
    // Nine days out, an exam is worth an evening and a Thursday quiz is not.
    expect(nextStep(input({ testIn: 9, testKind: 'Exam' }))?.id).toBe('cram');
    expect(nextStep(input({ testIn: 9, testKind: 'Quiz' }))?.id).not.toBe('cram');
    expect(nextStep(input({ testIn: QUIZ_SOON, testKind: 'Quiz' }))?.id).toBe('cram');
  });

  it('says exam when nobody said what the test was', () => {
    expect(nextStep(input({ testIn: 3, testKind: null }))?.why).toBe('The exam is in 3 days.');
  });
});

describe('a course not started', () => {
  it('offers reading rather than a flashcard', () => {
    const s = nextStep(input({ started: false }));
    expect(s).toMatchObject({ id: 'read', label: 'Start reading' });
    expect(s?.why).toBe('Nothing answered in this course yet.');
  });

  it('falls back to the field guide, then to whatever there is', () => {
    expect(nextStep(input({ started: false, ways: [way('field'), way('cards')] }))?.id).toBe('field');
    expect(nextStep(input({ started: false, ways: [way('watch')] }))?.id).toBe('watch');
  });

  it('beats the due count, because a card never seen has not come round', () => {
    // The bug this ordering exists for: `dueCount` counts a never-reviewed
    // card as due, so a course nobody has opened has *every* card due, and
    // the app greeted a new course with "68 cards have come round for review".
    const s = nextStep(input({ started: false, due: 68 }));
    expect(s?.label).toBe('Start reading');
    expect(s?.why).toBe('Nothing answered in this course yet.');
  });
});

describe('the unit furthest behind', () => {
  it('names it without claiming to have measured it', () => {
    // Was `Unit 2 is at 40%, the lowest here.` — and forty per cent of what,
    // measured how? `unit.mastery` is `unitMastery`'s blend, which for a unit
    // nobody has answered is entirely the figure a person wrote into the
    // guide. Printing it put a confident two-digit measurement on ten units
    // nothing had measured. See `lib/knowing.ts`.
    const s = nextStep(input({ guide: guide([90, 40, 70]) }));
    expect(s).toMatchObject({ id: 'cards', label: 'Drill the weakest unit' });
    expect(s?.why).toBe('Unit 2 is the least studied here.');
    expect(s?.why).not.toMatch(/\d+%/);
  });

  it('says where it stands when the caller passes the evidence', () => {
    const s = nextStep(
      input({ guide: guide([90, 40, 70]), standings: ['retained', 'review', 'practising'] }),
    );
    expect(s?.why).toBe('Unit 2 is the least studied here — needs review.');
  });

  it('still ranks on the blend, which is what the blend is for', () => {
    // The standings are for the sentence only. Passing a set that would rank
    // differently must not change which unit is picked — otherwise the
    // ordering silently depends on whether a caller supplied them.
    const s = nextStep(
      input({ guide: guide([90, 40, 70]), standings: ['unseen', 'retained', 'retained'] }),
    );
    expect(s?.why?.startsWith('Unit 2 ')).toBe(true);
  });

  it('does not pick a weakest of one', () => {
    expect(nextStep(input({ guide: guide([40]) }))?.label).not.toBe('Drill the weakest unit');
  });

  it('says something else when every unit is at full strength', () => {
    const s = nextStep(input({ guide: guide([100, 100]) }));
    expect(s).toMatchObject({ id: 'quiz', label: 'Test yourself' });
    expect(s?.why).toBe('Nothing is due. A quiz keeps it honest.');
  });
});

describe('the reason', () => {
  it('is there for every recommendation drawn from evidence', () => {
    for (const over of [{ due: 4 }, { testIn: 2 }, { started: false }, { guide: guide([90, 30]) }]) {
      const s = nextStep(input(over));
      expect(s?.why, JSON.stringify(over)).not.toBe('');
    }
  });

  it('never shouts', () => {
    for (const over of [{ due: 4 }, { testIn: 0 }, { started: false }]) {
      expect(`${nextStep(input(over))?.label} ${nextStep(input(over))?.why}`).not.toMatch(/!/);
    }
  });
});

describe('what sits beside it, and what is left', () => {
  const step = nextStep(input({ due: 5 }));

  it('never offers the recommendation twice', () => {
    expect(beside(ALL, step).map((w) => w.id)).not.toContain(step?.id);
    expect(rest(ALL, step).map((w) => w.id)).not.toContain(step?.id);
  });

  it('shows a few beside and keeps the rest', () => {
    expect(beside(ALL, step)).toHaveLength(BESIDE);
    expect(beside(ALL, step).length + rest(ALL, step).length).toBe(ALL.length - 1);
  });

  it('hides nothing — every way is in one list or the other', () => {
    const shown = [step?.id, ...beside(ALL, step).map((w) => w.id), ...rest(ALL, step).map((w) => w.id)];
    for (const w of ALL) expect(shown, w.id).toContain(w.id);
  });

  it('keeps the order the modes are listed in', () => {
    expect(beside(ALL, step).map((w) => w.id)).toEqual(['read', 'field', 'watch']);
  });
});
describe('cards that are up because a test is near', () => {
  it('says the test rather than claiming they came round', () => {
    /*
     * Directly under a standing that reads "nothing come round", the sentence
     * "4 cards have come round for review" is a contradiction a reader cannot
     * resolve — and both halves are individually right, which is why looking
     * at the screen found it and no test did. `lib/intime.ts` pulls cards back
     * ahead of a test; `dueOwn` is how many the interval brought round by
     * itself.
     */
    const step = nextStep(input({ due: 4, dueOwn: 0, testIn: 15, testKind: 'Exam' }));
    expect(step?.label).toBe('Review 4 cards');
    expect(step?.why).toBe('4 cards are back ahead of the exam.');
  });

  it('still says came round where the interval did the work', () => {
    expect(nextStep(input({ due: 4, dueOwn: 4, testIn: 15, testKind: 'Exam' }))?.why).toBe(
      '4 cards have come round for review.',
    );
  });

  it('keeps the old sentence for a caller that says nothing about intervals', () => {
    // `dueOwn` defaults to `due`, so every call written before this reads the
    // same as it always did.
    expect(nextStep(input({ due: 4, testIn: 15, testKind: 'Exam' }))?.why).toBe(
      '4 cards have come round for review.',
    );
  });

  it('does not blame a test that is not there', () => {
    expect(nextStep(input({ due: 4, dueOwn: 0, testIn: null, testKind: null }))?.why).toBe(
      '4 cards have come round for review.',
    );
  });

  it('counts one card as one', () => {
    expect(nextStep(input({ due: 1, dueOwn: 0, testIn: 3, testKind: 'Quiz' }))?.why).toBe(
      'One card is back ahead of the quiz.',
    );
  });
});
