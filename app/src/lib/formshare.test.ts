import { describe, expect, it, vi } from 'vitest';
import { formResponse, markAnswers, newQuestion } from './creations';
import type { FormData, Question } from './creations';
import { answerable, asked, askedForm, keyOf, shareLink } from './formshare';

/**
 * The half of publishing a form that has no network in it.
 *
 * The other half — the policies — is `supabase/forms.check.sql`, which runs
 * against a real Postgres and is the only place a row-level security rule can
 * honestly be tested. What is here is the part this app is responsible for:
 * that the answer key is not in what gets uploaded, and that splitting the
 * scorer in two did not change any mark.
 */

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

describe('what a respondent is sent', () => {
  const marked = [
    q({ id: 'q1', title: 'Which section?', type: 'Multiple choice', options: ['001', '002'], answer: '001', points: 3 }),
    q({ id: 'q2', title: 'Why?', type: 'Paragraph', answer: 'because', points: 2 }),
  ];

  it('is missing the answer key that the source questions have', () => {
    // The control. Stripping proves nothing about a source that was already
    // bare, and this is the assertion that would have caught a `marked`
    // fixture quietly losing its answers.
    expect(marked.map((x) => x.answer)).toEqual(['001', 'because']);
    expect(marked.map((x) => x.points)).toEqual([3, 2]);

    for (const out of asked(marked)) {
      expect(out.answer, 'an answer reached the respondent').toBe('');
      expect(out.points, 'a mark reached the respondent').toBe(0);
    }
  });

  it('keeps everything a respondent has to see', () => {
    const [a] = asked(marked);
    expect(a.id).toBe('q1');
    expect(a.title).toBe('Which section?');
    expect(a.type).toBe('Multiple choice');
    expect(a.options).toEqual(['001', '002']);
  });

  it('carries the branching condition, which is not a secret', () => {
    const [out] = asked([q({ condition: { questionId: 'q0', equals: 'Yes' } })]);
    expect(out.condition).toEqual({ questionId: 'q0', equals: 'Yes' });
  });

  it('is a rebuild, so a field added to Question later does not leak by default', () => {
    // `asked` starts from `newQuestion()` and copies six fields across. If it
    // ever becomes a delete of two known keys instead, a seventh field added
    // to `Question` ships to respondents the day it is added and nothing goes
    // red. This is the test that goes red.
    const extra = { ...q({ answer: 'x' }), secretNote: 'not for respondents' } as unknown as Question;
    expect(Object.keys(asked([extra])[0]).sort()).toEqual(Object.keys(newQuestion()).sort());
  });

  it('does not mutate the author’s own options array', () => {
    const source = q({ options: ['a', 'b'] });
    asked([source])[0].options.push('c');
    expect(source.options).toEqual(['a', 'b']);
  });
});

describe('the key kept back', () => {
  it('holds only the questions that were actually marked', () => {
    const key = keyOf([q({ id: 'q1', answer: '001', points: 3 }), q({ id: 'q2', answer: '   ', points: 9 })]);
    expect(Object.keys(key)).toEqual(['q1']);
    expect(key.q1).toEqual({ answer: '001', points: 3 });
  });
});

describe('marking where the key is', () => {
  /*
   * The reason the split is safe. `formResponse` used to check and mark in one
   * pass because both always happened on one machine; a published form does
   * them on two. These assert the seam changed nothing: whatever the local
   * path scores, the author's device scores from the answers alone.
   */
  const quiz = form({
    quiz: true,
    questions: [
      q({ id: 'q1', type: 'Multiple choice', options: ['001', '002'], answer: '001', points: 3 }),
      q({ id: 'q2', type: 'Checkboxes', options: ['a', 'b', 'c'], answer: 'a\nb', points: 4 }),
      q({ id: 'q3', type: 'Short answer', answer: 'Kant', points: 1 }),
    ],
  });

  for (const [what, answers, score] of [
    ['all right', { q1: '001', q2: 'b\na', q3: 'kant' }, 8],
    ['some right', { q1: '002', q2: 'a\nb', q3: 'Hume' }, 4],
    ['none right', { q1: '002', q2: 'c', q3: '' }, 0],
  ] as [string, Record<string, string>, number][]) {
    it(`agrees with the local path — ${what}`, () => {
      const local = formResponse(quiz, answers);
      expect(local.score).toBe(score);
      expect(markAnswers(quiz, local.answers)).toEqual({ score: local.score, possible: local.possible });
    });
  }

  it('marks nothing when the form is not a quiz', () => {
    expect(markAnswers({ ...quiz, quiz: false }, { q1: '001' })).toEqual({ score: 0, possible: 0 });
  });
});

describe('the link', () => {
  it('reads a published id out of the address bar', () => {
    expect(askedForm('?form=11111111-2222-3333-4444-555555555555')).toBe('11111111-2222-3333-4444-555555555555');
  });

  for (const junk of ['', '?form=', '?form=../../etc', '?form=<script>', '?form=1', '?screen=study']) {
    it(`refuses ${junk || 'an empty query'}`, () => {
      expect(askedForm(junk)).toBeNull();
    });
  }

  it('is right under a repository subpath as well as at a root', () => {
    expect(shareLink('abc', { origin: 'https://x.github.io', pathname: '/semester/' })).toBe(
      'https://x.github.io/semester/?form=abc',
    );
    expect(shareLink('abc', { origin: 'http://localhost:5173', pathname: '/' })).toBe(
      'http://localhost:5173/?form=abc',
    );
    // A deep link with a file on the end, which is what a 404 fallback serves.
    expect(shareLink('abc', { origin: 'https://x.github.io', pathname: '/semester/index.html' })).toBe(
      'https://x.github.io/semester/?form=abc',
    );
  });
});

describe('answering a form this device cannot fully see', () => {
  const published = {
    id: '11111111-2222-3333-4444-555555555555',
    title: 'Study group interest',
    description: '',
    questions: asked([q({ id: 'q1', title: 'Section?', required: true, answer: '001', points: 3 })]),
    closes: null,
  };

  it('validates what was typed without holding a key to mark it with', () => {
    const shape = answerable(published);
    expect(shape.quiz, 'a respondent’s device must never be marking').toBe(false);
    expect(shape.questions.every((x) => x.answer === '')).toBe(true);
    expect(() => formResponse(shape, { q1: '' })).toThrow(/before continuing/);
    expect(formResponse(shape, { q1: 'anything' }).possible).toBe(0);
  });

  it('does not let a cap it cannot see stop an answer it should send', () => {
    // The count is behind a policy this device may write to and may not read,
    // so the client must not invent one. The database refuses, and `answer()`
    // turns that refusal into a sentence.
    expect(answerable(published).responses).toEqual([]);
    expect(answerable(published).limit).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('with no account service in the build', () => {
  it('says so rather than failing at a fetch', async () => {
    vi.resetModules();
    vi.doMock('./cloud', () => ({
      cloudConfigured: false,
      cloud: () => Promise.reject(new Error('should not be reached')),
    }));
    const mod = await import('./formshare');
    await expect(mod.openForm('11111111-2222-3333-4444-555555555555')).rejects.toThrow(
      /no account service/,
    );
    vi.doUnmock('./cloud');
    vi.resetModules();
  });
});
