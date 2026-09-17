import { describe, expect, it } from 'vitest';
import {
  CREATION_LIMIT,
  designSvg,
  formResponse,
  newCreation,
  newLayer,
  newQuestion,
  readCreations,
  responseRows,
  sheetText,
  splitClip,
  videoSeconds,
  visibleQuestions,
  xml,
  type FormData,
  type Question,
  type VideoClip,
} from './creations';

/**
 * The three makers, where their logic actually decides something.
 *
 * A form marks work and takes answers from other people; a design becomes an
 * SVG that goes into a file; a video's arithmetic decides whether a loop
 * terminates. Each of those is a place where being slightly wrong is not a
 * cosmetic problem, and each is what these tests are about.
 */

/* ── Forms ──────────────────────────────────────────────────────────────── */

const q = (over: Partial<Question> = {}): Question => ({ ...newQuestion(), id: 'q1', ...over });

const form = (over: Partial<FormData> = {}): FormData => ({
  description: '',
  questions: [],
  responses: [],
  accepting: true,
  published: null,
  opens: '',
  closes: '',
  limit: 100,
  quiz: false,
  sheetId: null,
  ...over,
});

describe('taking a response', () => {
  it('records the answers it was given', () => {
    const f = form({ questions: [q({ title: 'Name', type: 'Short answer' })] });
    expect(formResponse(f, { q1: ' Ada ' }).answers.q1, 'trimmed').toBe('Ada');
  });

  it('refuses when the form is shut, full, or outside its dates', () => {
    const f = form({ questions: [q()] });
    expect(() => formResponse({ ...f, accepting: false }, {})).toThrow(/not accepting/i);
    expect(() => formResponse({ ...f, limit: 1, responses: [{ id: 'r', at: '', answers: {}, score: 0, possible: 0 }] }, {})).toThrow();
    expect(() => formResponse({ ...f, opens: '2030-01-01' }, {}, new Date(2026, 0, 1))).toThrow();
    expect(() => formResponse({ ...f, closes: '2020-01-01' }, {}, new Date(2026, 0, 1))).toThrow();
  });

  it('opens and closes on the reader’s own calendar days', () => {
    const f = form({ questions: [q()], opens: '2026-10-01', closes: '2026-10-04' });
    expect(() => formResponse(f, { q1: 'x' }, new Date(2026, 9, 1))).not.toThrow();
    expect(() => formResponse(f, { q1: 'x' }, new Date(2026, 9, 4)), 'its last day').not.toThrow();
    expect(() => formResponse(f, { q1: 'x' }, new Date(2026, 9, 5))).toThrow();
  });

  it('refuses a form with nothing in it', () => {
    expect(() => formResponse(form(), {})).toThrow(/add a question/i);
  });

  it('holds a required answer, and a value each type will take', () => {
    const need = (over: Partial<Question>, value: string) =>
      formResponse(form({ questions: [q(over)] }), { q1: value });
    expect(() => formResponse(form({ questions: [q({ required: true })] }), {})).toThrow(/before continuing/i);
    expect(() => need({ type: 'Multiple choice', options: ['a', 'b'] }, 'c')).toThrow(/listed option/i);
    expect(() => need({ type: 'Checkboxes', options: ['a', 'b'] }, 'a\nc')).toThrow(/listed options/i);
    expect(() => need({ type: 'Number' }, 'seven')).toThrow(/number/i);
    expect(() => need({ type: 'Rating' }, '9')).toThrow(/1 to 5/i);
    expect(() => need({ type: 'Date' }, '2026-02-31')).toThrow(/valid date/i);
    expect(() => need({ type: 'Time' }, '25:00')).toThrow(/valid time/i);
    expect(() => need({ type: 'Time' }, '09:30')).not.toThrow();
  });

  /*
   * The rule that makes conditions usable: a question nobody can see cannot
   * be required. Without it a conditional form is unanswerable as soon as a
   * hidden branch contains a required question.
   */
  it('does not require an answer to a question it is not showing', () => {
    const f = form({
      questions: [
        q({ id: 'q1', title: 'Do you drive?', type: 'Multiple choice', options: ['Yes', 'No'] }),
        q({ id: 'q2', title: 'Plate', required: true, condition: { questionId: 'q1', equals: 'Yes' } }),
      ],
    });
    expect(() => formResponse(f, { q1: 'No' })).not.toThrow();
    expect(() => formResponse(f, { q1: 'Yes' })).toThrow(/Plate/);
  });

  it('hides everything hanging off a hidden question', () => {
    const f = form({
      questions: [
        q({ id: 'q1', type: 'Multiple choice', options: ['Yes', 'No'] }),
        q({ id: 'q2', condition: { questionId: 'q1', equals: 'Yes' }, type: 'Multiple choice', options: ['A', 'B'] }),
        q({ id: 'q3', condition: { questionId: 'q2', equals: 'A' } }),
      ],
    });
    // A stale answer to q2 must not resurrect q3 while q2 itself is hidden.
    expect(visibleQuestions(f, { q1: 'No', q2: 'A' }).map((x) => x.id)).toEqual(['q1']);
    expect(visibleQuestions(f, { q1: 'Yes', q2: 'A' }).map((x) => x.id)).toEqual(['q1', 'q2', 'q3']);
  });
});

describe('marking a quiz', () => {
  const marked = (over: Partial<Question>, given: string) =>
    formResponse(form({ quiz: true, questions: [q({ answer: 'Paris', points: 2, ...over })] }), { q1: given });

  it('marks case-insensitively and ignores surrounding space', () => {
    expect(marked({}, '  paris ')).toMatchObject({ score: 2, possible: 2 });
    expect(marked({}, 'Lyon')).toMatchObject({ score: 0, possible: 2 });
  });

  it('treats checkbox answers as a set, not a sequence', () => {
    const f = form({
      quiz: true,
      questions: [q({ type: 'Checkboxes', options: ['a', 'b', 'c'], answer: 'a\nb', points: 3 })],
    });
    expect(formResponse(f, { q1: 'b\na' }).score, 'order must not decide the mark').toBe(3);
    expect(formResponse(f, { q1: 'a\nc' }).score).toBe(0);
  });

  /*
   * `possible` counts only what was actually keyed. A quiz with one marked
   * question out of six must not report the other five as wrong — that is a
   * score a student would act on.
   */
  it('counts only the questions that have an answer key', () => {
    const f = form({
      quiz: true,
      questions: [q({ id: 'q1', answer: 'yes', points: 5 }), q({ id: 'q2', answer: '', points: 5 })],
    });
    expect(formResponse(f, { q1: 'yes', q2: 'anything' })).toMatchObject({ score: 5, possible: 5 });
  });

  it('marks nothing at all when the form is not a quiz', () => {
    const f = form({ quiz: false, questions: [q({ answer: 'Paris', points: 2 })] });
    expect(formResponse(f, { q1: 'Paris' })).toMatchObject({ score: 0, possible: 0 });
  });
});

/* ── The spreadsheet guard ──────────────────────────────────────────────── */

describe('response text on its way into a cell', () => {
  /*
   * The one line in `creations.ts` that is a security control. A form takes
   * text from other people, and a cell beginning `=` is a formula in every
   * spreadsheet there is — including this app's own and whatever opens the
   * exported CSV.
   */
  it('defuses every character a spreadsheet reads as a formula', () => {
    for (const lead of ['=', '+', '@', '-']) {
      expect(sheetText(`${lead}IMPORTXML("x")`)).toBe(`'${lead}IMPORTXML("x")`);
    }
    expect(sheetText('  =SUM(A1)'), 'leading space does not disarm it').toBe("'  =SUM(A1)");
  });

  it('leaves ordinary answers exactly as they were', () => {
    for (const plain of ['Ada Lovelace', '42', 'a-b', 'x = y']) expect(sheetText(plain)).toBe(plain);
  });

  it('escapes every answer that reaches the rows', () => {
    const p = newCreation('form');
    p.form.questions = [q({ id: 'q1', title: 'Comment' })];
    p.form.responses = [{ id: 'r1', at: '2026-10-01T00:00:00.000Z', answers: { q1: '=1+1' }, score: 0, possible: 0 }];
    expect(responseRows(p)[1][1]).toBe("'=1+1");
  });
});

/* ── Designs ────────────────────────────────────────────────────────────── */

describe('a design as SVG', () => {
  const canvas = () => newCreation('design').design;

  it('escapes text somebody typed', () => {
    const d = canvas();
    d.layers = [newLayer('text', d)];
    d.layers[0].text = '<script>alert(1)</script>';
    const out = designSvg(d);
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('escapes all five of the characters that matter', () => {
    expect(xml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
  });

  /*
   * The image whitelist. A layer's `fileId` maps to whatever the caller read
   * out of the file store, and anything that is not a base64 raster is
   * dropped — an SVG carrying its own script, or a `javascript:` URI, would
   * otherwise be rendered into a document the student then shares.
   */
  it('draws only base64 rasters, and silently drops anything else', () => {
    const d = canvas();
    d.layers = [newLayer('image', d)];
    d.layers[0].fileId = 'f1';

    const png = designSvg(d, { f1: 'data:image/png;base64,AAAA' });
    expect(png).toContain('<image');

    for (const bad of ['javascript:alert(1)', 'data:image/svg+xml;base64,AAAA', 'https://example.com/x.png', '']) {
      expect(designSvg(d, { f1: bad }), bad || '(empty)').not.toContain('<image');
    }
  });

  it('puts each line of a text layer on its own row', () => {
    const d = canvas();
    d.layers = [newLayer('text', d)];
    d.layers[0].text = 'one\ntwo';
    const out = designSvg(d);
    expect(out.match(/<tspan/g)).toHaveLength(2);
  });
});

/* ── Videos ─────────────────────────────────────────────────────────────── */

const clip = (over: Partial<VideoClip> = {}): VideoClip => ({
  id: 'c1',
  fileId: 'f1',
  name: 'take.mp4',
  duration: 60,
  start: 10,
  end: 40,
  speed: 1,
  volume: 1,
  caption: '',
  ...over,
});

describe('a video sequence', () => {
  it('is the sum of the trims, divided by their speeds', () => {
    expect(videoSeconds([clip()])).toBe(30);
    expect(videoSeconds([clip({ speed: 2 })])).toBe(15);
    expect(videoSeconds([clip(), clip({ id: 'c2', start: 0, end: 5 })])).toBe(35);
    expect(videoSeconds([])).toBe(0);
  });

  it('splits into two clips that together cover the original', () => {
    const [a, b] = splitClip(clip(), 25);
    expect([a.start, a.end]).toEqual([10, 25]);
    expect([b.start, b.end]).toEqual([25, 40]);
    expect(b.id).not.toBe(a.id);
    expect(videoSeconds([a, b])).toBe(videoSeconds([clip()]));
  });

  it('refuses a split at or outside the trimmed edges', () => {
    for (const at of [10, 40, 5, 50]) expect(() => splitClip(clip(), at), String(at)).toThrow();
  });
});

/* ── The library reader ─────────────────────────────────────────────────── */

describe('a creation library', () => {
  const lib = (p: unknown) => readCreations({ version: 1, projects: [p] });

  it('reads a project a screen would save', () => {
    expect(lib(newCreation('form')).projects[0].kind).toBe('form');
  });

  it('refuses an unknown kind and a bad colour', () => {
    expect(() => lib({ ...newCreation('form'), kind: 'podcast' })).toThrow();
    const d = newCreation('design');
    d.design.background = 'white';
    expect(() => lib(d)).toThrow(/design/i);
  });

  /*
   * A condition may only point backwards. Two questions each hiding the other
   * is not a form, and letting one in would make `visibleQuestions` a cycle
   * detector instead of a filter.
   */
  it('refuses a condition on a question that has not been seen yet', () => {
    const p = newCreation('form');
    p.form.questions = [
      q({ id: 'q1', condition: { questionId: 'q2', equals: 'x' } }),
      q({ id: 'q2' }),
    ];
    expect(() => lib(p)).toThrow(/condition/i);
  });

  it('refuses a clip whose range is empty or outside its own footage', () => {
    const p = newCreation('video');
    p.video.clips = [clip({ end: 10 })];
    expect(() => lib(p), 'end equal to start').toThrow(/clip/i);
    p.video.clips = [clip({ end: 90 })];
    expect(() => lib(p), 'end past the footage').toThrow(/clip/i);
  });

  it('refuses an answer filed against a question that does not exist', () => {
    const p = newCreation('form');
    p.form.questions = [q({ id: 'q1' })];
    p.form.responses = [{ id: 'r1', at: new Date().toISOString(), answers: { ghost: 'x' }, score: 0, possible: 0 }];
    expect(() => lib(p)).toThrow(/response/i);
  });

  it('refuses more projects than it holds', () => {
    const many = Array.from({ length: CREATION_LIMIT + 1 }, (_, i) => ({ ...newCreation('form'), id: `p${i}` }));
    expect(() => readCreations({ version: 1, projects: many })).toThrow(new RegExp(String(CREATION_LIMIT)));
  });

  it('refuses two projects sharing an id', () => {
    const p = newCreation('form');
    expect(() => readCreations({ version: 1, projects: [p, { ...p }] })).toThrow();
  });
});
