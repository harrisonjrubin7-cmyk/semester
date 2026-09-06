import { describe, expect, it } from 'vitest';
import { KIND_LABEL, SURE, guess, type Kind } from './classify';
import { hashOf, intakeText, isUrl } from './intake';
import type { Intake } from './intake';

/**
 * What kind of thing did the student just hand over?
 *
 * Everything downstream turns on the answer, and the failure that matters is
 * not "no answer" — it is a confident wrong one, which files a problem set as
 * a reading and is discovered while revising from it. So most of what is
 * tested here is the declining: that ambiguous material comes back below the
 * asking threshold rather than as somebody's best guess out of ten.
 *
 * Only the free path is tested. `classify()` asks the model, and what would be
 * tested there is a stub's reply.
 */

const item = (text: string, extra: Partial<Intake> = {}): Intake => ({
  ...(intakeText(text) as Intake),
  ...extra,
});

const SYLLABUS = `ECON 1020 — Principles of Microeconomics
Course syllabus, Fall 2026

Office hours: Tuesdays 2–4pm, Calhoun 411.
Grading policy: Midterm 1 is 25% of your grade, the final is 35%.
Academic integrity is taken seriously in this course.`;

const DECK = `Slide 1
Conjoint analysis
Session 7

Slide 2
What buyers actually trade off

Slide 3
Worked example: a laptop at three price points`;

const EMAIL = `From: stromme@vanderbilt.edu
Subject: Midterm moved

Dear class,

The midterm has been moved to Wednesday 7 October. Everything else stands.

Best regards,
Prof. Stromme`;

const PSET = `Problem Set 3 — due Friday

1. Calculate the price elasticity of demand at the point where P = 12 and Q = 40.
2. Solve for the equilibrium quantity given the two curves above.
Show your work. Round to two decimal places.`;

const RETURNED = `Paper 1 — feedback on your argument

Your grade is 84/100. Marked out of 100 across four criteria.
The regrade window closes on 14 October.`;

describe('what it is, from the shape of the text', () => {
  const kindOf = (text: string, extra?: Partial<Intake>) => guess(item(text, extra)).kind;

  it('knows a syllabus by its weights and its policies', () => {
    expect(kindOf(SYLLABUS)).toBe('syllabus');
  });

  it('knows a deck by the slide numbers, which only a real deck has', () => {
    expect(kindOf(DECK)).toBe('slides');
  });

  it('knows an email by its headers', () => {
    expect(kindOf(EMAIL)).toBe('announcement');
  });

  it('knows a problem set by what it asks you to do', () => {
    expect(kindOf(PSET)).toBe('problem-set');
  });

  it('knows returned work by the mark on it', () => {
    expect(kindOf(RETURNED)).toBe('returned');
  });

  it('is sure enough about all of those to proceed without asking', () => {
    for (const text of [SYLLABUS, DECK, EMAIL, PSET, RETURNED]) {
      expect(guess(item(text)).confidence).toBeGreaterThanOrEqual(SURE);
    }
  });
});

describe('declining to guess', () => {
  it('says unclear when nothing in the text points anywhere', () => {
    const v = guess(item('The quick brown fox jumped over the lazy dog. It did so twice.'));
    expect(v.kind).toBe('unclear');
    expect(v.confidence).toBe(0);
  });

  it('is unsure when two readings are equally supported', () => {
    /*
     * The case the whole step exists for. This carries a problem set's
     * numbered "calculate" and an exam's "you have 50 minutes" in equal
     * measure, and it is genuinely one or the other — so the answer has to be
     * below the threshold rather than a coin toss reported as a fact.
     */
    const both = `Quiz 2
You have 50 minutes. Closed book.
1. Calculate the marginal cost at Q = 20.
Show your work.`;
    expect(guess(item(both)).confidence).toBeLessThan(SURE);
  });

  it('does not let one mention of a syllabus make a problem set into one', () => {
    // Real material mentions its neighbours. Weighted signals rather than
    // first-match is what stops a passing reference deciding the answer.
    const psetThatMentions = `${PSET}\n\nSee the course syllabus for the late policy.`;
    expect(guess(item(psetThatMentions)).kind).toBe('problem-set');
  });

  it('does not turn an email about the midterm into an exam paper', () => {
    // Naming an exam is not being one, and the headers settle it. This came
    // back at 0.63 — under the threshold — until the weights said so.
    const v = guess(item(EMAIL));
    expect(v.kind).toBe('announcement');
    expect(v.confidence).toBeGreaterThanOrEqual(SURE);
  });

  it('does fire "exam" on the phrasing of an actual paper', () => {
    const paper = `Closed book. You have 50 minutes.
Circle the best answer for each of the following.`;
    expect(guess(item(paper)).kind).toBe('exam');
  });

  it('does not fire "exam" inside "examine"', () => {
    const v = guess(item('We examine the case for rent control. Chapter 4, pp. 88–101. (2019)'));
    expect(v.kind).not.toBe('exam');
  });
});

describe('what the filename and the format add', () => {
  it('takes the filename as evidence, since it usually says', () => {
    const bare = 'Three points about pricing and how buyers respond to them.';
    expect(guess(item(bare)).kind).toBe('unclear');
    expect(guess(item(bare, { name: 'Session 7 slides.pptx' })).kind).toBe('slides');
  });

  it('treats extracted slide numbers as the strongest signal there is', () => {
    // Only a real deck carries these — `extract.ts` puts them there and puts
    // them nowhere else.
    const v = guess(
      item('Marketing Management\nWhat buyers trade off\nA worked example', {
        name: 'week7.pdf',
        pages: [
          { page: 1, text: 'a' },
          { page: 2, text: 'b' },
          { page: 3, text: 'c' },
        ],
      }),
    );
    expect(v.kind).toBe('slides');
  });
});

describe('what it says about itself', () => {
  it('names the session, because that is what makes the question answerable', () => {
    // "Is this lecture slides?" is hard to confirm. "Is this Session 7?" is
    // one glance at the file.
    expect(guess(item(DECK)).about).toBe('Session 7');
    expect(guess(item('Chapter 4 — Segregation by design\nAbstract\nIntroduction')).about).toBe(
      'Chapter 4',
    );
  });

  it('quotes what decided it rather than paraphrasing', () => {
    // Somebody is going to check these against the file.
    const v = guess(item(SYLLABUS));
    expect(v.because.length).toBeGreaterThan(0);
    for (const b of v.because) expect(SYLLABUS.toLowerCase()).toContain(b.toLowerCase());
  });

  it('has a phrase on screen for every class it can return', () => {
    const kinds: Kind[] = [
      'syllabus', 'slides', 'reading', 'problem-set', 'assignment', 'exam',
      'returned', 'announcement', 'notes', 'reference', 'unclear',
    ];
    for (const k of kinds) expect(KIND_LABEL[k]).toBeTruthy();
  });
});

describe('the content hash', () => {
  it('is the same for the same text, which is what makes a re-import do nothing', () => {
    expect(hashOf(SYLLABUS)).toBe(hashOf(SYLLABUS));
  });

  it('changes when the text does, including by one character', () => {
    expect(hashOf(SYLLABUS)).not.toBe(hashOf(`${SYLLABUS} `));
    expect(hashOf('Midterm is 25%')).not.toBe(hashOf('Midterm is 30%'));
  });

  it('does not collide across a realistic set of material', () => {
    const many = [SYLLABUS, DECK, EMAIL, PSET, RETURNED].flatMap((t) =>
      Array.from({ length: 200 }, (_, i) => `${t}\nline ${i}`),
    );
    expect(new Set(many.map(hashOf)).size).toBe(many.length);
  });

  it('is not affected by the two orderings of a line ending', () => {
    // A file saved on Windows and the same file saved on a Mac are the same
    // material, and re-importing one after the other must produce nothing.
    expect(intakeText('Week 1\r\nWeek 2')!.hash).toBe(intakeText('Week 1\nWeek 2')!.hash);
  });
});

describe('pasted text', () => {
  it('names a block by its first line, so a list of them reads', () => {
    expect(intakeText('Midterm moved to the 7th\n\nEverything else stands.')!.name).toBe(
      'Midterm moved to the 7th',
    );
  });

  it('is nothing at all when nothing was pasted', () => {
    expect(intakeText('   \n\n ')).toBeNull();
  });
});

describe('telling an address from a paste', () => {
  it('knows one when it sees one', () => {
    for (const u of [
      'https://brightspace.vanderbilt.edu/d2l/le/12345',
      'http://example.edu/syllabus.pdf',
      'www.vanderbilt.edu/econ',
      'webcal://example.edu/feed.ics',
    ]) {
      expect(isUrl(u), u).toBe(true);
    }
  });

  it('does not mistake prose that mentions one', () => {
    expect(isUrl('See https://example.edu for the readings')).toBe(false);
    expect(isUrl('Problem Set 3 is due Friday')).toBe(false);
    expect(isUrl('')).toBe(false);
  });
});
