import { describe, expect, it } from 'vitest';
import { reducer } from '../reducer';
import { DEFAULT_PERSISTED, initialEphemeral, type Action, type State } from '../shape';
import { draftFor } from '../../lib/mail';
import type { Course } from '../../lib/types';

/**
 * The four buttons that start an email from outside the mailbox.
 *
 * `SIMPLIFY-AUDIT.md` F1. `writeMail` navigated to the mailbox and wrote its
 * four facts — purpose, course, recipient, deadline — into a `mailSeed` field
 * that **nothing ever read**. The mailbox opens its composer from a
 * `MailDraft`, and a seed is not one, so *ask for more time*, office hours'
 * *write to them first*, and both *ask a question* buttons landed you on the
 * mailbox with no composer open at all.
 *
 * ## Why the suite did not catch it, and what that asks of this file
 *
 * Every test passed on the broken version, because nothing asserted what
 * happens *after* the action. The reducer was correct in the sense that it
 * did what it said; what it said had no reader. So the assertions here are
 * deliberately about the end state a person would see — a composer open, on a
 * draft, with the subject written — rather than about the field that was
 * stored. A test written against the seed would have passed throughout.
 *
 * The other half is `lib/mail.test.ts`, which holds what `draftFor` puts in
 * the subject. This holds that the mailbox opens it.
 */

const start = (): State => ({ ...DEFAULT_PERSISTED, ...initialEphemeral(new Date(2026, 8, 15)) });
const run = (state: State, ...actions: Action[]): State =>
  actions.reduce((s, a) => reducer(s, a), state);

const course = { id: 'econ', code: 'ECON 1020', email: 'prof@uni.edu' } as unknown as Course;
const open = (s: State) => s.mailDrafts.find((d) => d.id === s.mailDraftId) ?? null;

describe('starting an email from outside the mailbox', () => {
  it('goes to the mailbox', () => {
    expect(run(start(), { type: 'writeMail', draft: draftFor('question', { course }) }).screen).toBe(
      'mail',
    );
  });

  it('opens a composer, which is the whole of what was broken', () => {
    const s = run(start(), { type: 'writeMail', draft: draftFor('question', { course }) });
    expect(s.mailDraftId, 'a composer is open').not.toBeNull();
    expect(open(s), 'and it is a draft that exists').not.toBeNull();
  });

  it('carries the course and the address into it', () => {
    const s = run(start(), { type: 'writeMail', draft: draftFor('question', { course }) });
    expect(open(s)?.courseId).toBe('econ');
    expect(open(s)?.to).toBe('prof@uni.edu');
    expect(open(s)?.purposeId).toBe('question');
  });

  it('names the deadline in the subject', () => {
    // The reason the field existed, in its own words: "re-picking it from a
    // list of thirty-eight is the step at which people gave up."
    const item = { id: 'ps4', c: 'econ', title: 'Problem Set 4' } as never;
    const s = run(start(), {
      type: 'writeMail',
      draft: draftFor('extension', { course, item, to: course.email }),
    });
    expect(open(s)?.subject).toBe('ECON 1020 — Problem Set 4');
  });

  it('leaves the body empty rather than inventing a reason', () => {
    // `lib/mail.ts`'s SYSTEM rules forbid inventing the facts, and a purpose
    // whose `needsFacts` is true has nothing honest to put here yet.
    const s = run(start(), { type: 'writeMail', draft: draftFor('extension', { course }) });
    expect(open(s)?.body).toBe('');
  });

  it('starts a second email rather than reopening the first', () => {
    // Two different questions about two different courses are two drafts. The
    // seed it replaced was a single slot, so the second would have overwritten
    // the first had anything read it.
    const other = { id: 'psci', code: 'PSCI 1100', email: 'other@uni.edu' } as unknown as Course;
    const s = run(
      start(),
      { type: 'writeMail', draft: draftFor('question', { course }) },
      { type: 'writeMail', draft: draftFor('question', { course: other }) },
    );
    expect(s.mailDrafts).toHaveLength(2);
    expect(open(s)?.courseId).toBe('psci');
  });
});
