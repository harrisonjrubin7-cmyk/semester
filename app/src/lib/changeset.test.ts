import { describe, expect, it } from 'vitest';
import { RELATED, SAME, diff, overlap, type Held } from './changeset';
import { assemble } from './harvest';
import { intakeText, type Intake } from './intake';
import type { Item, StudyCard } from './types';

/**
 * The half of the import that decides whether anything is written at all.
 *
 * Every import before this appended, which is why a re-imported syllabus
 * produced a course with two of every deadline and why a deck and the reading
 * behind it put the same fact on two cards. The acceptance criteria that
 * matter are all here: the same file twice does nothing, a revised syllabus is
 * a change list rather than a second course, and a conflict is never resolved
 * quietly.
 */

const card = (q: string, a: string): StudyCard => ({ q, a });

const item = (title: string, month: number, day: number, weight = ''): Item => ({
  id: `i-${title}`,
  c: 'bus1600',
  title,
  kind: 'Exam',
  month,
  day,
  dueTime: '',
  weight,
  where: '',
  detail: '',
  quote: '',
  source: '',
});

const held = (over: Partial<Held> = {}): Held => ({
  guide: {
    code: 'BUS 1600',
    name: 'Marketing Management',
    blurb: '',
    source: '',
    mastery: 0,
    audio: false,
    units: [
      {
        name: 'Segmentation',
        mastery: 0,
        cards: [
          card(
            'How are markets segmented?',
            'By the trade-offs buyers make between features, rather than by demographic groups alone.',
          ),
        ],
      },
    ],
    terms: [{ t: 'Segmentation', d: 'Dividing a market into groups that behave differently.' }],
  },
  items: [item('Midterm', 9, 30, '25%')],
  updates: [],
  grading: [{ what: 'Midterm', pct: '25%' }],
  sources: [],
  ...over,
});

const source: Intake = intakeText('Some slides about conjoint analysis and segmentation.') as Intake;
const base = { source: 'Session 7.pptx', sourceHash: source.hash, as: 'slides' as const, at: 1 };
const piecesOf = (reply: object) => assemble(reply, source, base).pieces;

describe('the same file twice', () => {
  it('says so rather than showing an empty sheet', () => {
    // Acceptance criterion 1. Somebody who re-adds a file wants to be told it
    // is already in, not shown a review sheet with nothing on it.
    const pieces = piecesOf({ cards: [{ q: 'q', a: 'a' }] });
    const out = diff(pieces, held({ sources: [source.hash] }));
    expect(out.seenBefore).toBe(true);
  });

  it('produces no changes the second time, even under a new filename', () => {
    /*
     * The guarantee that matters more, because a professor re-posting the same
     * deck as "Session 7 (updated).pptx" is the normal case. The source hash
     * cannot help there; the piece hashes do.
     */
    const pieces = piecesOf({
      cards: [
        { q: 'How are markets segmented?', a: 'By the trade-offs buyers make between features, rather than by demographic groups alone.' },
      ],
    });
    const out = diff(pieces, held());
    expect(out.changes).toEqual([]);
    expect(out.duplicates).toBe(1);
  });

  it('counts a repeat inside one file rather than proposing it twice', () => {
    const pieces = piecesOf({
      cards: [
        { q: 'What is conjoint analysis?', a: 'Measuring what buyers trade off against what, using forced choices between bundles.' },
        { q: 'Define conjoint analysis.', a: 'Measuring what buyers trade off against what, using forced choices between bundles.' },
      ],
    });
    const out = diff(pieces, held());
    expect(out.changes).toHaveLength(1);
    expect(out.duplicates).toBe(1);
  });
});

describe('substance, not string equality', () => {
  it('calls the same fact in different words a duplicate', () => {
    // The failure that makes a student drill one belief twice.
    const pieces = piecesOf({
      cards: [
        {
          q: 'On what basis are markets divided?',
          a: 'By the trade-offs buyers make between features, rather than demographic groups alone.',
        },
      ],
    });
    expect(diff(pieces, held()).duplicates).toBe(1);
  });

  it('calls a genuinely different point new', () => {
    const pieces = piecesOf({
      cards: [
        {
          q: 'What did the laptop study find?',
          a: 'Across 240 buyers, price outweighed screen size by roughly four to one.',
        },
      ],
    });
    const out = diff(pieces, held());
    expect(out.changes).toHaveLength(1);
    expect(out.changes[0].verdict).toBe('new');
  });

  it('scores overlap on what is said, not on the words everything shares', () => {
    // Without dropping the filler, every pair of English sentences looks
    // like a near-duplicate of every other.
    expect(overlap('The price of the good is in the table', 'The size of the screen is in the table'))
      .toBeLessThan(RELATED);
    expect(overlap('Price outweighed screen size four to one', 'Screen size was outweighed by price, four to one'))
      .toBeGreaterThanOrEqual(SAME);
  });
});

describe('a conflict is never resolved quietly', () => {
  it('surfaces a moved deadline rather than adding a second one', () => {
    // Acceptance criterion 2: a revised syllabus produces a change list, not
    // a duplicate course.
    const pieces = piecesOf({ items: [{ title: 'Midterm', month: 9, day: 7, weight: '25%' }] });
    const out = diff(pieces, held());
    expect(out.changes).toHaveLength(1);
    expect(out.changes[0].verdict).toBe('conflict');
    expect(out.changes[0].against).toContain('10/30');
    expect(out.changes[0].because).toContain('10/7');
  });

  it('surfaces a changed weight on a deadline that has not moved', () => {
    const pieces = piecesOf({ items: [{ title: 'Midterm', month: 9, day: 30, weight: '30%' }] });
    const out = diff(pieces, held());
    expect(out.changes[0].verdict).toBe('conflict');
    expect(out.changes[0].because).toMatch(/30%.*25%/);
  });

  it('surfaces a changed weight in the grading table', () => {
    // The numbers the whole grade projection rests on.
    const pieces = piecesOf({ grading: [{ what: 'Midterm', pct: '30%' }] });
    const out = diff(pieces, held());
    expect(out.changes[0].verdict).toBe('conflict');
  });

  it('surfaces the same term defined two different ways', () => {
    // One of the two is what the exam will use, and it is not the app's call.
    const pieces = piecesOf({
      terms: [{ t: 'Segmentation', d: 'Splitting buyers by how much they are willing to pay.' }],
    });
    const out = diff(pieces, held());
    expect(out.changes[0].verdict).toBe('conflict');
    expect(out.changes[0].against).toContain('behave differently');
  });

  it('does not call a reworded definition of the same idea a conflict', () => {
    const pieces = piecesOf({
      terms: [{ t: 'Segmentation', d: 'Dividing a market into groups which behave differently.' }],
    });
    expect(diff(pieces, held()).duplicates).toBe(1);
  });

  it('leaves an unchanged deadline alone entirely', () => {
    const pieces = piecesOf({ items: [{ title: 'Midterm 1', month: 9, day: 30, weight: '25%' }] });
    // Renamed, same day, same weight. Not a second deadline.
    expect(diff(pieces, held()).duplicates).toBe(1);
  });
});

describe('fuller, and filling a gap', () => {
  it('proposes replacing a shallower card with a deeper one', () => {
    const shallow = held({
      guide: {
        ...held().guide,
        units: [
          {
            name: 'Segmentation',
            mastery: 0,
            cards: [card('What is conjoint analysis?', 'A way of measuring trade-offs between product features.')],
          },
        ],
      },
    });
    const pieces = piecesOf({
      cards: [
        {
          q: 'What is conjoint analysis?',
          a: 'A way of measuring trade-offs between product features, by putting buyers to forced choices between bundles and reading the weights out of which bundle they pick.',
        },
      ],
    });
    const out = diff(pieces, shallow);
    expect(out.changes[0].verdict).toBe('fuller');
    expect(out.changes[0].against).toContain('measuring trade-offs');
  });

  it('completes a card that was left as a topic label', () => {
    /*
     * "Know the GGL study" is a placeholder somebody wrote and never finished.
     * New material answering it belongs *in* that card rather than beside it,
     * or the deck ends up with the question and the answer as two cards.
     */
    const thin = held({
      guide: {
        ...held().guide,
        units: [{ name: 'Segmentation', mastery: 0, cards: [card('The GGL study', 'Know the GGL study')] }],
      },
    });
    const pieces = piecesOf({
      cards: [
        {
          q: 'What did the GGL study show?',
          a: 'Know the GGL study and its finding that grouping by behaviour beat grouping by age in every one of its four markets.',
        },
      ],
    });
    const out = diff(pieces, thin);
    expect(out.changes[0].verdict).toBe('gap-fill');
  });

  it('files new cards into a unit the course already has', () => {
    const pieces = piecesOf({ unit: { name: 'Segmentation', body: 'How markets divide.' } });
    const out = diff(pieces, held());
    expect(out.changes[0].verdict).toBe('gap-fill');
    expect(out.changes[0].because).toMatch(/already has this unit/i);
  });

  it('calls a topic the course does not have a new unit', () => {
    const pieces = piecesOf({ unit: { name: 'Conjoint analysis', body: 'Forced choices.' } });
    expect(diff(pieces, held()).changes[0].verdict).toBe('new');
  });
});

describe('what the sheet adds up to', () => {
  it('counts duplicates rather than listing them', () => {
    // Six pieces already covered is one line, not six rows to read past.
    const same = 'By the trade-offs buyers make between features, rather than by demographic groups alone.';
    const pieces = piecesOf({
      cards: [
        { q: 'a', a: same },
        { q: 'b', a: `${same} Really.` },
        { q: 'c', a: 'Across 240 buyers, price outweighed screen size by four to one.' },
      ],
    });
    const out = diff(pieces, held());
    expect(out.duplicates).toBe(2);
    expect(out.changes).toHaveLength(1);
  });

  it('gives every change a reason somebody could argue with', () => {
    const pieces = piecesOf({
      cards: [{ q: 'q', a: 'Across 240 buyers, price outweighed screen size by four to one.' }],
      items: [{ title: 'Midterm', month: 9, day: 7 }],
      terms: [{ t: 'Conjoint', d: 'Forced choices between bundles.' }],
    });
    for (const c of diff(pieces, held()).changes) {
      expect(c.because.length).toBeGreaterThan(10);
    }
  });

  it('says nothing at all about a course with nothing to compare against', () => {
    // A brand new course. Everything is new, and none of it is a conflict.
    const empty = held({
      guide: { ...held().guide, units: [], terms: [] },
      items: [],
      grading: [],
    });
    const pieces = piecesOf({
      cards: [{ q: 'q', a: 'Across 240 buyers, price outweighed screen size by four to one.' }],
      items: [{ title: 'Midterm', month: 9, day: 30 }],
    });
    const out = diff(pieces, empty);
    expect(out.changes.map((c) => c.verdict)).toEqual(['new', 'new']);
    expect(out.duplicates).toBe(0);
  });
});

describe('it compares against added material too, not only the syllabus', () => {
  it('finds a duplicate of a card that came from an earlier import', () => {
    // Otherwise the second deck duplicates the first one, which is precisely
    // the case somebody hits in week seven.
    const withUpdate = held({
      guide: { ...held().guide, units: [{ name: 'Segmentation', mastery: 0, cards: [] }] },
      updates: [
        {
          id: 'u1',
          courseId: 'bus1600',
          unit: 0,
          title: 'Session 6',
          source: '',
          body: '',
          cards: [card('What did the laptop study find?', 'Across 240 buyers, price outweighed screen size by four to one.')],
          terms: [],
          fileIds: [],
          created: 0,
        },
      ],
    });
    const pieces = piecesOf({
      cards: [{ q: 'In the laptop study, what won?', a: 'Across 240 buyers, price outweighed screen size by roughly four to one.' }],
    });
    expect(diff(pieces, withUpdate).duplicates).toBe(1);
  });
});
