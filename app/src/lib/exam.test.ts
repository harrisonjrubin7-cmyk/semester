import { describe, expect, it } from 'vitest';
import {
  FORMATS,
  SYSTEM,
  brief,
  clock,
  codeIn,
  examFileName,
  format,
  fromGuide,
  invite,
  letter,
  marksFor,
  paper,
  pointsFor,
  readExam,
  readSeed,
  result,
  seedCode,
  shapeFor,
  total,
  verdict,
  type Answer,
  type Question,
} from './exam';
import type { Guide } from './types';

const q = (over: Partial<Question> = {}): Question => ({
  id: 'q1',
  kind: 'choice',
  prompt: 'Which is a public good?',
  options: ['A lighthouse', 'A sandwich', 'A haircut', 'A ticket'],
  answer: '0',
  why: 'Non-rival and non-excludable.',
  points: 2,
  ...over,
});

const guide = (cards = 12): Guide =>
  ({
    code: 'ECON 1020',
    name: 'Principles',
    units: [
      {
        name: '1 · Markets',
        mastery: 0,
        terms: [],
        test: [],
        cards: Array.from({ length: cards }, (_, i) => ({
          q: `Question ${i}?`,
          a: `Answer number ${i}, which is distinct from every other.`,
        })),
      },
    ],
    terms: [],
  }) as unknown as Guide;

describe('shapeFor', () => {
  it('budgets by minutes, because that is what a real paper is written against', () => {
    const short = shapeFor(20, 'mixed');
    const long = shapeFor(90, 'mixed');
    expect(long.counts.choice).toBeGreaterThan(short.counts.choice);
    expect(long.points).toBeGreaterThan(short.points);
  });

  it('keeps a mixed paper mixed even when the time is short', () => {
    const shape = shapeFor(15, 'mixed');
    expect(shape.counts.choice).toBeGreaterThan(0);
    expect(shape.counts.short).toBeGreaterThan(0);
    expect(shape.counts.long).toBeGreaterThan(0);
  });

  it('writes no questions of a kind the format does not ask for', () => {
    const shape = shapeFor(60, 'choice');
    expect(shape.counts.short).toBe(0);
    expect(shape.counts.long).toBe(0);
  });

  it('clamps a nonsense length rather than producing a thousand questions', () => {
    expect(shapeFor(0, 'choice').minutes).toBe(5);
    expect(shapeFor(9999, 'choice').minutes).toBe(180);
  });

  it('totals the points from the counts, so the paper and its header agree', () => {
    const shape = shapeFor(50, 'mixed');
    const sum =
      shape.counts.choice * pointsFor('choice') +
      shape.counts.short * pointsFor('short') +
      shape.counts.long * pointsFor('long');
    expect(shape.points).toBe(sum);
  });

  it('falls back to the first format rather than throwing', () => {
    expect(format('nonsense').id).toBe(FORMATS[0].id);
  });
});

describe('marksFor', () => {
  it('marks a choice question itself, because a letter matches or it does not', () => {
    expect(marksFor(q(), { given: '0' })).toBe(2);
    expect(marksFor(q(), { given: '2' })).toBe(0);
  });

  it('gives nothing for an unanswered question, not for a blank that happens to match', () => {
    expect(marksFor(q({ answer: '' }), { given: '' })).toBe(0);
    expect(marksFor(q(), undefined)).toBe(0);
  });

  it('leaves a written answer to you, and gives half for partly', () => {
    const written = q({ kind: 'short', points: 6, options: [], answer: 'Because…' });
    expect(marksFor(written, { given: 'my answer' })).toBe(0);
    expect(marksFor(written, { given: 'my answer', mark: 'partly' })).toBe(3);
    expect(marksFor(written, { given: 'my answer', mark: 'right' })).toBe(6);
    expect(marksFor(written, { given: 'my answer', mark: 'wrong' })).toBe(0);
  });
});

describe('result', () => {
  const questions = [
    q({ id: 'a' }),
    q({ id: 'b', kind: 'short', points: 6, options: [], answer: 'Key' }),
  ];

  it('adds up what is marked and says what is not', () => {
    const answers: Record<string, Answer> = { a: { given: '0' }, b: { given: 'something' } };
    const r = result(questions, answers);
    expect(r.got).toBe(2);
    expect(r.outOf).toBe(8);
    expect(r.unmarked).toBe(1);
  });

  it('does not count an unanswered written question as waiting to be marked', () => {
    expect(result(questions, { a: { given: '0' }, b: { given: '  ' } }).unmarked).toBe(0);
  });

  it('is zero rather than NaN for an empty paper', () => {
    expect(result([], {}).pct).toBe(0);
  });
});

describe('verdict', () => {
  it('says the score is partial while anything is unmarked', () => {
    expect(verdict({ got: 2, outOf: 8, pct: 25, unmarked: 1 })).toContain('still to mark');
  });

  it('never scolds a first sitting', () => {
    const said = verdict({ got: 1, outOf: 10, pct: 10, unmarked: 0 });
    expect(said).not.toMatch(/should|fail|bad|poor/i);
    expect(said).toContain('first sitting');
  });
});

describe('fromGuide', () => {
  it('builds a paper out of your own cards, with no model in it', () => {
    const shape = shapeFor(30, 'mixed');
    const questions = fromGuide(guide(), shape, 7);
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.every((x) => x.prompt)).toBe(true);
  });

  it('always points a choice question at a real option', () => {
    for (const x of fromGuide(guide(), shapeFor(40, 'choice'), 3)) {
      const i = Number(x.answer);
      expect(x.options[i]).toBeTruthy();
    }
  });

  it('gives four distinct options — a two-option question is a coin toss', () => {
    for (const x of fromGuide(guide(), shapeFor(40, 'choice'), 5)) {
      expect(new Set(x.options).size).toBe(4);
    }
  });

  it('is reproducible for one seed and different for another', () => {
    const shape = shapeFor(30, 'choice');
    const a = fromGuide(guide(), shape, 1).map((x) => x.prompt);
    const b = fromGuide(guide(), shape, 1).map((x) => x.prompt);
    const c = fromGuide(guide(), shape, 2).map((x) => x.prompt);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('skips choice questions rather than shipping two options when the guide is tiny', () => {
    const tiny = fromGuide(guide(2), shapeFor(40, 'choice'), 1);
    expect(tiny.filter((x) => x.kind === 'choice')).toEqual([]);
  });

  it('gives back nothing for a guide with no cards, instead of throwing', () => {
    expect(fromGuide(guide(0), shapeFor(30, 'mixed'), 1)).toEqual([]);
  });
});

describe('the system prompt', () => {
  it('forbids inventing something to build a question around', () => {
    expect(SYSTEM).toContain('do not invent a fact');
  });

  it('rules out the tells of a bad multiple-choice question', () => {
    expect(SYSTEM).toContain('all of the above');
    expect(SYSTEM).toContain('ONE right option');
  });

  it('asks for questions that test use rather than recognition', () => {
    expect(SYSTEM).toContain('Test whether they can use it');
  });
});

describe('brief', () => {
  it('hands over the counts rather than asking the model to work them out', () => {
    const shape = shapeFor(50, 'mixed');
    const text = brief({ formatId: 'mixed', shape, course: 'ECON 1020', material: 'x', about: '', topics: '' });
    expect(text).toContain(`multiple choice: ${shape.counts.choice}`);
    expect(text).toContain('computed by the app');
  });

  it('says plainly when there is no material rather than leaving a gap', () => {
    const text = brief({ formatId: 'mixed', shape: shapeFor(30, 'mixed'), course: '', material: '', about: '', topics: '' });
    expect(text).toContain('rather than inventing one');
  });
});

describe('readExam', () => {
  const shape = shapeFor(30, 'mixed');

  it('reads a paper', () => {
    const out = readExam(
      '{"title":"Midterm","questions":[{"kind":"choice","prompt":"P","options":["a","b"],"answer":1,"why":"w"}]}',
      shape,
    );
    expect(out.title).toBe('Midterm');
    expect(out.questions[0].answer).toBe('1');
    expect(out.questions[0].points).toBe(2);
  });

  it('drops a choice question whose answer points outside its own options', () => {
    const out = readExam(
      '{"questions":[{"kind":"choice","prompt":"Bad","options":["a","b"],"answer":7},{"kind":"short","prompt":"Good","answer":"k"}]}',
      shape,
    );
    expect(out.questions.map((x) => x.prompt)).toEqual(['Good']);
  });

  it('drops a written question with no key, which cannot be marked against anything', () => {
    const out = readExam(
      '{"questions":[{"kind":"short","prompt":"P"},{"kind":"long","prompt":"Q","answer":"k"}]}',
      shape,
    );
    expect(out.questions.map((x) => x.prompt)).toEqual(['Q']);
  });

  it('survives a fence and an apology around the JSON', () => {
    const out = readExam('Sure:\n```json\n{"questions":[{"kind":"short","prompt":"P","answer":"k"}]}\n```', shape);
    expect(out.questions.length).toBe(1);
  });

  it('throws when nothing usable came back, so the screen can say so', () => {
    expect(() => readExam('{"questions":[]}', shape)).toThrow(/usable/i);
    expect(() => readExam('nope', shape)).toThrow();
    expect(() => readExam('{ broken }', shape)).toThrow(/malformed/i);
  });

  it('names the paper itself when the model did not', () => {
    const out = readExam('{"questions":[{"kind":"short","prompt":"P","answer":"k"}]}', shape);
    expect(out.title).toContain('30 minutes');
  });
});

describe('paper', () => {
  const exam = {
    title: 'Practice paper',
    course: 'ECON 1020',
    minutes: 30,
    questions: [q(), q({ id: 'q2', kind: 'short', points: 6, options: [], answer: 'The key' })],
  };

  it('puts the key at the end, so it can be printed and sat properly', () => {
    const text = paper(exam);
    expect(text.indexOf('## The key')).toBeGreaterThan(text.indexOf('Which is a public good?'));
  });

  it('letters the options and marks the questions', () => {
    const text = paper(exam);
    expect(text).toContain('- A. A lighthouse');
    expect(text).toContain('**1.** (2)');
  });

  it('names the right option in the key rather than a bare index', () => {
    expect(paper(exam)).toContain('**1.** A. A lighthouse');
  });

  it('heads it with the marks it is out of', () => {
    expect(paper(exam)).toContain(`${total(exam.questions)} marks`);
  });
});

describe('seed codes', () => {
  it('round-trips a seed through its code', () => {
    for (const seed of [1, 42, 9999, 99999]) {
      expect(readSeed(seedCode(seed))).toBe(seed);
    }
  });

  it('reads a code back however it was typed', () => {
    expect(readSeed('7ps')).toBe(readSeed('7PS'));
    expect(readSeed('  7ps  ')).toBe(readSeed('7PS'));
  });

  it('is four characters for the seeds the app generates', () => {
    expect(seedCode(1)).toHaveLength(4);
    expect(seedCode(99_999)).toHaveLength(4);
  });

  it('refuses something that is not a code rather than guessing a paper', () => {
    expect(readSeed('')).toBe(null);
    expect(readSeed('hello there')).toBe(null);
    expect(readSeed('!!')).toBe(null);
    expect(readSeed('0')).toBe(null);
  });
});

describe('sharing a paper', () => {
  it('writes an invitation carrying the code and the shape', () => {
    const text = invite({ code: '7PS4', courseCode: 'ECON 1020', minutes: 15, formatId: 'choice' });
    expect(text).toContain('Practice paper 7PS4');
    expect(text).toContain('ECON 1020, 15 min');
    expect(text).toContain('all multiple choice');
  });

  it('reads the code back out of the message', () => {
    const text = invite({ code: '7PS4', courseCode: 'ECON 1020', minutes: 15, formatId: 'choice' });
    expect(codeIn(text)).toBe('7PS4');
  });

  it('does not offer an ordinary word as a paper anybody can sit', () => {
    // A chip that leads nowhere is worse than no chip.
    expect(codeIn('does anyone have the reading for TUES')).toBe(null);
    expect(codeIn('nothing here at all')).toBe(null);
  });

  it('only reads a code that follows the word paper', () => {
    expect(codeIn('the code is 7PS4')).toBe(null);
    expect(codeIn('sit paper 7PS4 if you have time')).toBe('7PS4');
  });
});

describe('the small pieces', () => {
  it('letters options from A', () => {
    expect(letter(0)).toBe('A');
    expect(letter(3)).toBe('D');
  });

  it('names the file after the paper', () => {
    expect(examFileName('ECON 1020 Midterm 1')).toBe('econ-1020-midterm-1.md');
    expect(examFileName('!!!')).toBe('practice-paper.md');
  });

  it('says the clock the way a clock does', () => {
    expect(clock(90)).toBe('1:30');
    expect(clock(5)).toBe('0:05');
    expect(clock(-10)).toBe('0:00');
  });
});
