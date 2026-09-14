import { describe, expect, it } from 'vitest';
import { reducer } from '../reducer';
import { DEFAULT_PERSISTED, initialEphemeral, type Action, type State } from '../shape';

/**
 * The mailbox's two kinds of state, and the rules that keep them apart.
 *
 * **A mark is not a move.** Reading and starring happen constantly — opening a
 * message marks it read — and they are reversed by doing them again, so they
 * carry no undo. Archiving, deleting and snoozing take a conversation off the
 * screen, so those are one action with one undo behind it. Getting this wrong
 * is not a subtle bug: the first version put "Moved · Undo" across the top of
 * the app every time an email was opened.
 *
 * **A draft is a real record from the first keystroke.** That is what makes
 * closing the compose window safe, and it is why Drafts is a folder rather
 * than a promise.
 */
const start = (): State => ({ ...DEFAULT_PERSISTED, ...initialEphemeral(new Date(2026, 8, 10)) });

const run = (state: State, ...actions: Action[]): State =>
  actions.reduce((s, a) => reducer(s, a), state);

describe('marks', () => {
  it('reads and stars without offering an undo', () => {
    const after = run(start(), { type: 'markMail', ids: ['m1', 'm2'], mark: { read: true } });
    expect(after.mailMarks).toEqual({ m1: { read: true }, m2: { read: true } });
    expect(after.undone).toBeNull();
  });

  it('merges over what is already marked rather than replacing it', () => {
    const after = run(
      start(),
      { type: 'markMail', ids: ['m1'], mark: { star: true } },
      { type: 'markMail', ids: ['m1'], mark: { read: true } },
    );
    expect(after.mailMarks.m1).toEqual({ star: true, read: true });
  });

  it('leaves no empty row behind when a mark is cleared', () => {
    const after = run(
      start(),
      { type: 'markMail', ids: ['m1'], mark: { star: true } },
      { type: 'markMail', ids: ['m1'], mark: null },
    );
    expect(after.mailMarks).toEqual({});
  });

  it('keeps the message open — reading it is not moving it', () => {
    const after = run(
      { ...start(), mailOpen: 't1' },
      { type: 'markMail', ids: ['m1'], mark: { read: true } },
    );
    expect(after.mailOpen).toBe('t1');
  });
});

describe('moves', () => {
  it('archives, and offers to take it back', () => {
    const after = run(start(), { type: 'moveMail', ids: ['m1'], to: 'archive' });
    expect(after.mailMarks.m1.folder).toBe('archive');
    expect(after.undone?.label).toBe('Moved');
  });

  it('closes the reader when the open conversation is the one moved', () => {
    const after = run({ ...start(), mailOpen: 't1' }, { type: 'moveMail', ids: ['m1', 't1'], to: 'trash' });
    expect(after.mailOpen).toBeNull();
  });

  it('snoozes without refiling: the folder it is in is where it stays', () => {
    const at = new Date(2026, 8, 11, 8).getTime();
    const after = run(start(), { type: 'moveMail', ids: ['m1'], snooze: at });
    expect(after.mailMarks.m1).toEqual({ snooze: at });
  });

  it('wakes a snoozed message rather than storing an hour in the past', () => {
    const after = run(
      start(),
      { type: 'moveMail', ids: ['m1'], snooze: 123 },
      { type: 'moveMail', ids: ['m1'], to: 'inbox' },
    );
    expect(after.mailMarks.m1).toEqual({ folder: 'inbox' });
  });
});

describe('drafts', () => {
  it('exists from the moment Compose is pressed', () => {
    const after = run(start(), { type: 'composeMail', draft: { to: 'prof@v.edu' } });
    expect(after.mailDrafts).toHaveLength(1);
    expect(after.mailDrafts[0].to).toBe('prof@v.edu');
    expect(after.mailDrafts[0].handed).toBeNull();
    expect(after.mailDraftId).toBe(after.mailDrafts[0].id);
  });

  it('stays in Drafts when the window is shut', () => {
    const open = run(start(), { type: 'composeMail', draft: {} });
    const shut = run(open, { type: 'composeMail', draft: null });
    expect(shut.mailDraftId).toBeNull();
    expect(shut.mailDrafts).toHaveLength(1);
  });

  it('is edited in place, and stamped when it was touched', () => {
    const open = run(start(), { type: 'composeMail', draft: {} });
    const id = open.mailDrafts[0].id;
    const after = run(open, { type: 'editMailDraft', id, patch: { subject: 'An extension' } });
    expect(after.mailDrafts[0].subject).toBe('An extension');
    expect(after.mailDrafts[0].updated).toBeGreaterThanOrEqual(open.mailDrafts[0].updated);
  });

  it('moves to Sent on the hour it was handed to a mail app, and shuts the window', () => {
    const open = run(start(), { type: 'composeMail', draft: {} });
    const id = open.mailDrafts[0].id;
    const after = run(open, { type: 'handedMail', id, at: 1_760_000_000_000 });
    expect(after.mailDrafts[0].handed).toBe(1_760_000_000_000);
    expect(after.mailDraftId).toBeNull();
  });

  it('can be discarded, and put back', () => {
    const open = run(start(), { type: 'composeMail', draft: { subject: 'Half a thought' } });
    const id = open.mailDrafts[0].id;
    const gone = run(open, { type: 'dropMailDraft', id });
    expect(gone.mailDrafts).toHaveLength(0);
    expect(gone.mailDraftId).toBeNull();
    const back = run(gone, { type: 'undo' });
    expect(back.mailDrafts[0].subject).toBe('Half a thought');
  });
});

describe('where you are', () => {
  it('closes the message when the folder changes', () => {
    const after = run({ ...start(), mailOpen: 't1' }, { type: 'mailFolder', folder: 'archive' });
    expect(after.mailFolder).toBe('archive');
    expect(after.mailOpen).toBeNull();
  });

  it('takes an announcement to the screen that reads dates out of it', () => {
    const after = run(start(), { type: 'tellChange', text: 'Class is cancelled Thursday.' });
    expect(after.screen).toBe('announce');
    expect(after.changes).toBe('told');
    expect(after.changeText).toContain('cancelled');
  });
});

/**
 * Labels of your own, which the mailbox has had a field for since it existed
 * and no way to write to.
 *
 * `Mark.labels` is on the type, `marked()` merges it over the provider's
 * labels, and `listing` filters by it — so the rail could narrow to a course
 * label Gmail happened to send and there was no control anywhere that put one
 * on. The interesting part is the toggle over a mixed selection: adding to the
 * ones without and removing from the ones with is not one patch, which is why
 * this is the only mark written per message rather than through `applied`.
 */
describe('labels', () => {
  it('puts one on and takes it off again', () => {
    const on = run(start(), { type: 'labelMail', ids: ['m1'], label: 'ECON 1020' });
    expect(on.mailMarks.m1.labels).toEqual(['ECON 1020']);

    const off = run(on, { type: 'labelMail', ids: ['m1'], label: 'ECON 1020' });
    // And leaves no row behind — an empty mark syncs and persists for ever.
    expect(off.mailMarks.m1).toBeUndefined();
  });

  it('keeps the other labels when one comes off', () => {
    const both = run(
      start(),
      { type: 'labelMail', ids: ['m1'], label: 'ECON 1020' },
      { type: 'labelMail', ids: ['m1'], label: 'PSCI 1104' },
    );
    const one = run(both, { type: 'labelMail', ids: ['m1'], label: 'ECON 1020' });
    expect(one.mailMarks.m1.labels).toEqual(['PSCI 1104']);
  });

  it('adds to the ones without it and removes from the ones with', () => {
    const mixed = run(start(), { type: 'labelMail', ids: ['m1'], label: 'ECON 1020' });
    const after = run(mixed, { type: 'labelMail', ids: ['m1', 'm2'], label: 'ECON 1020' });
    expect(after.mailMarks.m1).toBeUndefined();
    expect(after.mailMarks.m2.labels).toEqual(['ECON 1020']);
  });

  it('leaves the rest of a mark alone', () => {
    const starred = run(
      start(),
      { type: 'markMail', ids: ['m1'], mark: { star: true } },
      { type: 'labelMail', ids: ['m1'], label: 'ECON 1020' },
    );
    expect(starred.mailMarks.m1.star).toBe(true);
    expect(starred.mailMarks.m1.labels).toEqual(['ECON 1020']);

    const unlabelled = run(starred, { type: 'labelMail', ids: ['m1'], label: 'ECON 1020' });
    expect(unlabelled.mailMarks.m1).toEqual({ star: true });
  });
});

/**
 * Waking a snoozed message, which the screen had no control for.
 *
 * A snooze of zero is what `mergeMark` reads as "woken" and drops, rather
 * than storing an hour in the past for the rest of the term. Worth a test
 * because the alternative — a mark row per snoozed message, for ever — is
 * invisible on screen and shows up as a store that only grows.
 */
describe('waking a snooze', () => {
  it('leaves nothing behind', () => {
    const asleep = run(start(), {
      type: 'moveMail',
      ids: ['m1'],
      snooze: new Date(2026, 8, 12).getTime(),
    });
    expect(asleep.mailMarks.m1.snooze).toBeGreaterThan(0);

    const awake = run(asleep, { type: 'moveMail', ids: ['m1'], snooze: 0 });
    expect(awake.mailMarks.m1).toBeUndefined();
  });
});
