import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Citation } from './claude';

/**
 * The gate between a model's proposal and a student's real deadlines.
 *
 * Nothing here tests the model. What it tests is the refusal: `validate` exists
 * because JSON from a language model is a proposal, not a fact, and everything
 * it lets through lands on a screen that says "Straight from the syllabus".
 * A hallucinated date is a paper somebody misses; a hallucinated quote is the
 * app vouching for words the professor never wrote.
 *
 * `validate` is not exported, so these drive the real `generateCourse` with
 * only the network call replaced. The citation logic in `lib/cite.ts` runs for
 * real, because deciding whether a quote is genuinely in the document is
 * exactly the part worth exercising.
 */

/** What the model "returned" for the next call. */
let reply = '';
let citations: Citation[] = [];

vi.mock('./claude', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./claude')>()),
  ask: vi.fn(async (opts: { onCitation?: (c: Citation) => void }) => {
    for (const c of citations) opts.onCitation?.(c);
    return reply;
  }),
}));

const { generateCourse } = await import('./generate');

const SYLLABUS =
  'ECON 1020 Principles of Microeconomics. Dr. John Stromme. ' +
  'Problem Set 1 is due Friday September 4th at 11:59 PM on Gradescope. ' +
  'Midterm 1 will be held in class on September 30th. ' +
  'The final exam is scheduled for December 15th.';

/** One well-formed course, with `over` merged over the top. */
const course = (over: Record<string, unknown> = {}) => ({
  course: { code: 'ECON 1020', name: 'Principles of Microeconomics', prof: 'Dr. John Stromme' },
  schedule: [{ days: [1, 3, 5], at: 545, time: '9:05a', title: 'Lecture', meta: 'Buttrick 101' }],
  items: [
    {
      title: 'Problem Set 1',
      kind: 'Problem set',
      month: 8,
      day: 4,
      dueTime: '11:59 PM',
      where: 'Gradescope',
      quote: 'Problem Set 1 is due Friday September 4th at 11:59 PM on Gradescope.',
    },
  ],
  guide: { units: [{ name: 'Supply and demand', cards: [{ q: 'What is a demand curve?', a: 'A schedule of…' }] }] },
  ...over,
});

/** Run the pipeline against `body`, however it is wrapped. */
const run = (body: unknown, wrap: (s: string) => string = (s) => s, docs = [{ name: 'Econ.pdf', text: SYLLABUS }]) => {
  reply = wrap(typeof body === 'string' ? body : JSON.stringify(body));
  return generateCourse({ documents: docs, hint: '', year: 2026 });
};

afterEach(() => {
  citations = [];
});

describe('reading the reply', () => {
  it('takes the JSON out of a fenced block', async () => {
    const out = await run(course(), (s) => '```json\n' + s + '\n```');
    expect(out.module.course.code).toBe('ECON 1020');
  });

  it('takes it out of prose the model wrapped around it', async () => {
    const out = await run(course(), (s) => `Here is the course you asked for:\n\n${s}\n\nHope that helps!`);
    expect(out.module.course.code).toBe('ECON 1020');
  });

  it('says what to do rather than throwing a parser error', async () => {
    // The student sees this sentence. "Unexpected token < in JSON" is not a
    // sentence anybody can act on.
    await expect(run('I am afraid I cannot help with that.')).rejects.toThrow(/not usable JSON/i);
  });

  it('refuses a document that produced no course code', async () => {
    // Somebody uploaded a reading list, or last term's transcript.
    await expect(run(course({ course: { name: 'Something' } }))).rejects.toThrow(/may not be a syllabus/i);
  });

  it('refuses a course with no study guide rather than shipping an empty one', async () => {
    await expect(run(course({ guide: { units: [] } }))).rejects.toThrow(/No study guide/i);
  });
});

describe('dates that are not real', () => {
  const withItems = (items: unknown[]) => run(course({ items }));

  it('drops a month outside the year and says so', async () => {
    // Month is 0-based here, so 12 is the classic off-by-one from a model
    // that counted from January as 1.
    const out = await withItems([{ title: 'Ghost paper', month: 12, day: 1, quote: '' }]);
    expect(out.module.items).toHaveLength(0);
    expect(out.notes.join(' ')).toContain('Ghost paper');
    expect(out.notes.join(' ')).toMatch(/not a real one/i);
  });

  it('drops a day the month could never have', async () => {
    const out = await withItems([{ title: 'Impossible', month: 8, day: 32, quote: '' }]);
    expect(out.module.items).toHaveLength(0);
  });

  it('drops a date that is not a number at all', async () => {
    const out = await withItems([{ title: 'Vague', month: 'September', day: 'the 4th', quote: '' }]);
    expect(out.module.items).toHaveLength(0);
  });

  it('keeps the ones either side of a bad one', async () => {
    // A single bad row must not cost the student the rest of their semester.
    const out = await withItems([
      { title: 'Good one', month: 8, day: 4, quote: '' },
      { title: 'Bad one', month: 13, day: 4, quote: '' },
      { title: 'Another good one', month: 9, day: 1, quote: '' },
    ]);
    expect(out.module.items.map((i) => i.title)).toEqual(['Good one', 'Another good one']);
  });

  it('says plainly when nothing dated survived', async () => {
    const out = await withItems([]);
    expect(out.notes.join(' ')).toMatch(/No dated work was found/i);
  });
});

describe('quotes, which the app presents as the syllabus’s own words', () => {
  const withQuote = (quote: string, cites: Citation[] = []) => {
    citations = cites;
    return run(course({ items: [{ title: 'Problem Set 1', month: 8, day: 4, quote }] }));
  };

  it('keeps a quote that is in the document', async () => {
    const out = await withQuote('Problem Set 1 is due Friday September 4th');
    expect(out.module.items[0].quote).toContain('Problem Set 1 is due');
    expect(out.notes.join(' ')).not.toMatch(/quote removed/i);
  });

  it('removes one that is not, and says it did', async () => {
    /*
     * The single most important refusal in this file. The screen labels this
     * text "Straight from the syllabus" — so a sentence the model composed
     * itself would be the app vouching for words the professor never wrote.
     */
    const out = await withQuote('Late work will be accepted without penalty.');
    expect(out.module.items[0].quote).toBe('');
    expect(out.notes.join(' ')).toMatch(/not in the document/i);
  });

  it('does not throw away a real quote over punctuation the model normalised', async () => {
    /*
     * Models rewrite a dash or a quotation mark without meaning anything by
     * it, and PDF extraction breaks lines mid-sentence. Comparing raw would
     * delete quotes that are genuinely there — which teaches a student to
     * distrust the ones that stay, and that is worse than showing none.
     *
     * The syllabus here writes a straight apostrophe, a hyphen and single
     * spaces; the quote comes back curly, em-dashed and line-wrapped.
     */
    citations = [];
    const wavy = await run(
      course({
        items: [
          {
            title: 'Paper',
            month: 8,
            day: 4,
            quote: 'the professor’s office—room 210—is open\n   on Fridays',
          },
        ],
      }),
      (s) => s,
      [{ name: 'Econ.pdf', text: "The professor's office-room 210-is open on Fridays." }],
    );
    expect(wavy.module.items[0].quote).not.toBe('');
    expect(wavy.notes.join(' ')).not.toMatch(/not in the document/i);
  });

  it('accepts a quote the API itself cited, and keeps the page', async () => {
    // The document search is the stronger check, but a citation carries a page
    // number that no text search can supply.
    const out = await withQuote('A sentence only the API can vouch for.', [
      { text: 'A sentence only the API can vouch for.', page: 4 },
    ]);
    expect(out.module.items[0].quote).not.toBe('');
    expect(out.module.items[0].checked).toMatchObject({ confirmed: true, page: 4 });
  });

  it('leaves an item with no quote alone rather than inventing one', async () => {
    const out = await withQuote('');
    expect(out.module.items[0].quote).toBe('');
    expect(out.module.items[0].checked).toBeUndefined();
    expect(out.notes.join(' ')).not.toMatch(/quote removed/i);
  });
});

describe('ids', () => {
  it('gives every deadline an id of its own', async () => {
    // Two items sharing an id means ticking one ticks the other.
    const out = await run(
      course({
        items: [
          { id: 'ps1', title: 'Problem Set 1', month: 8, day: 4, quote: '' },
          { id: 'ps1', title: 'Problem Set 1 (resit)', month: 8, day: 11, quote: '' },
          { id: 'ps1', title: 'Problem Set 1 (again)', month: 8, day: 18, quote: '' },
        ],
      }),
    );
    const ids = out.module.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('files every item against the course it came from', async () => {
    const out = await run(course());
    for (const item of out.module.items) expect(item.c).toBe(out.module.course.id);
  });

  it('slugs a course id out of the code when the model gives none', async () => {
    const out = await run(course());
    expect(out.module.course.id).toBe('econ-1020');
  });
});

describe('the meeting pattern', () => {
  it('drops a block whose days are not days of the week', async () => {
    const out = await run(course({ schedule: [{ days: [1, 9], at: 545, time: '9a', title: 'x' }] }));
    expect(out.module.schedule).toHaveLength(0);
    expect(out.notes.join(' ')).toMatch(/No meeting pattern/i);
  });

  it('clamps a start time to somewhere inside a day', async () => {
    // 2500 minutes past midnight is not a time, and the hour grid would draw
    // it off the bottom of the day.
    const out = await run(course({ schedule: [{ days: [1], at: 2500, time: 'x', title: 'x' }] }));
    expect(out.module.schedule[0].at).toBe(1439);
  });

  it('falls back to the course code when a block has no title', async () => {
    const out = await run(course({ schedule: [{ days: [1], at: 545, time: '9a', title: '' }] }));
    expect(out.module.schedule[0].title).toBe('ECON 1020');
  });
});

describe('the study guide', () => {
  it('drops a card with no question or no answer', async () => {
    const out = await run(
      course({
        guide: {
          units: [
            {
              name: 'Unit',
              cards: [
                { q: 'A real question?', a: 'A real answer.' },
                { q: 'Question with no answer?' },
                { a: 'Answer with no question.' },
                null,
              ],
            },
          ],
        },
      }),
    );
    expect(out.module.guide.units[0].cards).toHaveLength(1);
  });

  it('drops a unit left with nothing in it', async () => {
    // An empty unit is a heading that opens onto nothing.
    const out = await run(
      course({
        guide: {
          units: [
            { name: 'Full', cards: [{ q: 'q', a: 'a' }] },
            { name: 'Empty', cards: [{ q: 'no answer' }] },
          ],
        },
      }),
    );
    expect(out.module.guide.units.map((u) => u.name)).toEqual(['Full']);
  });

  it('starts every unit unmastered, whatever the model claimed', async () => {
    // Mastery is measured from the student's own answers. A generated figure
    // would tell somebody they know a unit they have never opened.
    const out = await run(
      course({ guide: { units: [{ name: 'U', mastery: 90, cards: [{ q: 'q', a: 'a' }] }] } }),
    );
    expect(out.module.guide.units[0].mastery).toBe(0);
    expect(out.module.guide.mastery).toBe(0);
  });

  it('claims no audio for a course nobody has recorded', async () => {
    const out = await run(course({ guide: { audio: true, units: [{ name: 'U', cards: [{ q: 'q', a: 'a' }] }] } }));
    expect(out.module.guide.audio).toBe(false);
  });
});

describe('the course record', () => {
  it('keeps an LMS link only when it is a real address', async () => {
    const withLms = async (lms: unknown) =>
      (await run(course({ course: { code: 'ECON 1020', lms } }))).module.course.lms;
    expect(await withLms('https://brightspace.vanderbilt.edu/d2l/home/123')).toContain('brightspace');
    expect(await withLms('ask your professor')).toBeUndefined();
    expect(await withLms('javascript:alert(1)')).toBeUndefined();
    expect(await withLms(42)).toBeUndefined();
  });

  it('records which file it came from, on the course and on every item', async () => {
    // "Straight from the syllabus" has to be able to name which syllabus.
    const out = await run(course(), (s) => s, [{ name: 'Econ1020_Fall.pdf', text: SYLLABUS }]);
    expect(out.module.course.source).toBe('Econ1020_Fall.pdf');
    for (const item of out.module.items) expect(item.source).toBe('Econ1020_Fall.pdf');
  });

  it('fills the fields a syllabus may simply not state', async () => {
    const out = await run(course({ course: { code: 'ECON 1020' } }));
    expect(out.module.course).toMatchObject({ name: '', prof: '', room: '', credits: '', grading: [] });
  });
});

/**
 * A reply whose shape is not the shape that was asked for.
 *
 * The checks in this file are unforgiving about a month of 13 and were, until
 * these tests, entirely trusting about shape. A model asked for a list can
 * answer with an object or a sentence, and a syllabus that states its weights
 * in prose — "40% exams, 60% papers" — is the ordinary case that produces the
 * worst of them.
 */
describe('a reply of the wrong shape', () => {
  it('keeps no weightings it cannot read, rather than saving a sentence', async () => {
    /*
     * The bad one, because nothing threw. The string was written onto the
     * course and saved, and every screen that reads a weighting calls `.map`
     * on it — so the Grades screen broke afterwards, and went on breaking
     * until the course was deleted.
     */
    const out = await run(course({ course: { code: 'ECON 1020', grading: '40% exams, 60% papers' } }));
    expect(out.module.course.grading).toEqual([]);
    expect(out.notes.join(' ')).toMatch(/weightings did not come back/i);
  });

  it('keeps the rows of a weighting list that are whole, and drops the rest', async () => {
    const out = await run(
      course({
        course: {
          code: 'ECON 1020',
          grading: [{ what: 'Exams', pct: '60%' }, { what: 'Papers' }, 'Participation', null],
        },
      }),
    );
    expect(out.module.course.grading).toEqual([{ what: 'Exams', pct: '60%' }]);
  });

  it('says nothing about weightings when the syllabus stated none', async () => {
    // Absent is not the same as unreadable, and a note about neither would be
    // noise on every course whose syllabus is quiet about its marking.
    const out = await run(course());
    expect(out.notes.join(' ')).not.toMatch(/weightings/i);
  });

  it('treats deadlines that came back as an object as no deadlines', async () => {
    // Not a crash. This used to throw "(raw.items ?? []).entries is not a
    // function" at somebody who had just uploaded a PDF.
    const out = await run(course({ items: { first: { title: 'x', month: 8, day: 4 } } }));
    expect(out.module.items).toEqual([]);
    expect(out.notes.join(' ')).toMatch(/No dated work was found/i);
  });

  it('treats deadlines that came back as prose as no deadlines', async () => {
    const out = await run(course({ items: 'Problem Set 1 is due on the 4th' }));
    expect(out.module.items).toEqual([]);
  });

  it('treats a meeting pattern of the wrong shape as no pattern', async () => {
    const out = await run(course({ schedule: { monday: '9am' } }));
    expect(out.module.schedule).toEqual([]);
    expect(out.notes.join(' ')).toMatch(/No meeting pattern/i);
  });

  /*
   * The same mistake as `items` and `grading` above, on the guide.
   *
   * A string has a length, so `raw.guide?.units?.length` waved these through
   * and the student got a raw TypeError where this file writes a sentence for
   * everything else it refuses. Measured before the fix:
   *
   *     { units: 'three units' }         raw.guide.units.map is not a function
   *     { units: [{ cards: 'lots' }] }   (u.cards ?? []).filter is not a function
   */
  /*
   * The sentence was already right; the check was not.
   *
   * "Dropped … its date (3/31) is not a real one" was written for exactly
   * this, and `day <= 31` let four months' worth of unreal dates through —
   * whereupon `new Date(year, month, day)` answers 31 April with 1 May rather
   * than refusing. A syllabus with a date typo in it, which is a thing syllabi
   * have, put a deadline on a day it never named and said nothing about it.
   */
  it('drops a date that is not a date, and says which', async () => {
    const out = await run(
      course({
        items: [
          { title: 'April 31', kind: 'Essay', month: 3, day: 31, dueTime: '11:59 PM' },
          { title: 'February 30', kind: 'Essay', month: 1, day: 30, dueTime: '11:59 PM' },
          { title: 'Real one', kind: 'Essay', month: 3, day: 30, dueTime: '11:59 PM' },
        ],
      }),
    );
    expect(out.module.items.map((i) => i.title)).toEqual(['Real one']);
    expect(out.notes.join(' ')).toContain('its date (3/31) is not a real one');
    expect(out.notes.join(' ')).toContain('its date (1/30) is not a real one');
  });

  it('keeps the 29th of February, having no year to judge it by', async () => {
    // The import does not know the term yet, and a caller that cannot say
    // which year it is should not throw away a date that might be real.
    const out = await run(
      course({ items: [{ title: 'Leap day', kind: 'Essay', month: 1, day: 29, dueTime: '11:59 PM' }] }),
    );
    expect(out.module.items.map((i) => i.title)).toEqual(['Leap day']);
  });

  it('refuses a guide whose units are a string, not only an object', async () => {
    await expect(run(course({ guide: { units: 'three units' } }))).rejects.toThrow(
      /No study guide/i,
    );
  });

  it('takes a unit whose cards are not a list as a unit with none', async () => {
    const out = await run(
      course({
        guide: { units: [{ name: 'Broken', cards: 'lots' }, { name: 'Fine', cards: [{ q: 'q', a: 'a' }] }] },
      }),
    );
    expect(out.module.guide.units.map((u) => u.name)).toEqual(['Fine']);
  });

  it('says so when a unit was left out, rather than dropping it quietly', async () => {
    // The rule this file states for everything else it throws away.
    const out = await run(
      course({
        guide: { units: [{ name: 'Empty', cards: [] }, { name: 'Full', cards: [{ q: 'q', a: 'a' }] }] },
      }),
    );
    expect(out.notes.join(' ')).toMatch(/1 unit came back with no usable cards/);
  });

  it('will not take terms or frames that are not lists', async () => {
    // Stored as strings, these threw later: the glossary maps over `terms`,
    // and three screens test `frames && frames.length` before mapping it.
    const out = await run(
      course({
        guide: {
          units: [{ name: 'U', cards: [{ q: 'q', a: 'a' }] }],
          terms: 'a glossary',
          frames: 'some frames',
        },
      }),
    );
    expect(out.module.guide.terms).toEqual([]);
    expect(out.module.guide.frames).toBeUndefined();
  });

  it('still refuses a guide whose units are not a list', async () => {
    // This one was already right, and stays that way: an object has no
    // length, so the friendly refusal fires rather than a TypeError.
    await expect(run(course({ guide: { units: { a: { name: 'U', cards: [] } } } }))).rejects.toThrow(
      /No study guide/i,
    );
  });
});

describe('what the preview is told', () => {
  it('leads with a count of what came through', async () => {
    const out = await run(course());
    expect(out.notes[0]).toMatch(/1 units?, 1 cards?, 1 dated obligations?/);
  });

  it('says nothing about quote checking when there was no document to cite', async () => {
    // An import from pasted text gets silence rather than a reassurance the
    // app cannot back.
    const out = await run(course());
    expect(out.quotesLine).toBeUndefined();
  });

  it('reports how the quotes stood up when the API cited them', async () => {
    citations = [{ text: 'Problem Set 1 is due Friday September 4th at 11:59 PM on Gradescope.', page: 2 }];
    const out = await run(course());
    expect(out.quotesLine).toBeTruthy();
  });
});
