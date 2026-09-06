import { describe, expect, it } from 'vitest';
import { BESIDE, EXAM_SOON, beside, nextStep, rest, type StepInput, type Way } from './nextstep';
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
  examIn: null,
  started: true,
  ...over,
});

describe('nothing to offer', () => {
  it('says nothing for a course with no ways into it', () => {
    expect(nextStep(input({ ways: [] }))).toBeNull();
  });
});

describe('cards that have come round', () => {
  it('beats everything else, and counts them', () => {
    const s = nextStep(input({ due: 12, examIn: 2 }));
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

describe('an exam close enough to matter', () => {
  it('offers the cram sheet and says when', () => {
    const s = nextStep(input({ examIn: 6 }));
    expect(s).toMatchObject({ id: 'cram', label: 'Open the cram sheet' });
    expect(s?.why).toBe('The exam is in 6 days.');
  });

  it('reads today and tomorrow as words', () => {
    expect(nextStep(input({ examIn: 0 }))?.why).toBe('The exam is today.');
    expect(nextStep(input({ examIn: 1 }))?.why).toBe('The exam is tomorrow.');
  });

  it('falls back to a quiz when there is no cram sheet', () => {
    const s = nextStep(input({ examIn: 3, ways: ALL.filter((w) => w.id !== 'cram') }));
    expect(s?.id).toBe('quiz');
  });

  it('ignores an exam that is still far off', () => {
    expect(nextStep(input({ examIn: EXAM_SOON + 1 }))?.id).not.toBe('cram');
  });

  it('ignores an exam that has gone', () => {
    expect(nextStep(input({ examIn: -2 }))?.id).not.toBe('cram');
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
  it('names it and gives its figure', () => {
    const s = nextStep(input({ guide: guide([90, 40, 70]) }));
    expect(s).toMatchObject({ id: 'cards', label: 'Drill the weakest unit' });
    expect(s?.why).toBe('Unit 2 is at 40%, the lowest here.');
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
    for (const over of [{ due: 4 }, { examIn: 2 }, { started: false }, { guide: guide([90, 30]) }]) {
      const s = nextStep(input(over));
      expect(s?.why, JSON.stringify(over)).not.toBe('');
    }
  });

  it('never shouts', () => {
    for (const over of [{ due: 4 }, { examIn: 0 }, { started: false }]) {
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
