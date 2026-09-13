/**
 * The mailbox: where you are in it, what you have done to a message, and the
 * drafts you have written.
 *
 * Two kinds of state and they behave differently on purpose. A **mark** is
 * yours over a message the app can only read — starred, archived, snoozed,
 * deleted — and it never reaches Gmail; `lib/mailbox.ts` says why the account
 * stays read-only. A **draft** is the app's own and is a real thing: it exists
 * from the moment Compose is pressed, so closing the window leaves an email in
 * Drafts rather than nowhere, which is the behaviour every mail client has and
 * the one everybody relies on without noticing.
 *
 * Returns null for an action that is not this slice's, so `reducer` can try
 * the next one. See `state/reducer.ts`.
 */

import { newId } from '../../lib/idb';
import { emptyDraft, type MailDraft, type Mark, type Marks } from '../../lib/mailbox';
import type { Action, State } from '../shape';
import { push } from './navigate';

/** One mark merged over whatever was there, with the empty ones swept up. */
function mergeMark(was: Mark | undefined, patch: Mark | null): Mark | null {
  if (patch === null) return null;
  const next: Mark = { ...was, ...patch };
  // A snooze of null means woken, and an empty object means nothing is marked
  // at all — both should leave no row behind rather than an empty one that
  // syncs and persists forever.
  if (next.snooze === undefined || next.snooze === 0) delete next.snooze;
  if (Object.keys(next).length === 0) return null;
  return next;
}

/** One patch over many messages, with the emptied rows swept out. */
function applied(was: Marks, ids: string[], patch: Mark | null): Marks {
  const marks = { ...was };
  for (const id of ids) {
    const next = mergeMark(marks[id], patch);
    if (next) marks[id] = next;
    else delete marks[id];
  }
  return marks;
}

export function mailbox(state: State, action: Action): State | null {
  switch (action.type) {
    /**
     * The message that says a deadline moved, sent where it can be acted on.
     *
     * The Changes screen already reads an announcement into proposed edits,
     * quoting the sentence each one rests on. What it could not do was be
     * handed the announcement — it had a box you pasted into, and the paste
     * was the step nobody took when the email was two taps away in the
     * mailbox.
     */
    case 'tellChange':
      return push({ ...state, changeText: action.text, changes: 'told' }, 'announce');

    case 'mailFolder':
      // Opening a folder closes the message: the one open was in the folder
      // you just left, and a reading pane showing a message the list no longer
      // holds is the commonest small bug in a mail client.
      return { ...state, mailFolder: action.folder, mailOpen: null };

    case 'openMail':
      return { ...state, mailOpen: action.id };

    case 'markMail':
      return { ...state, mailMarks: applied(state.mailMarks, action.ids, action.mark) };

    case 'moveMail': {
      const marks = applied(state.mailMarks, action.ids, {
        // No folder is a snooze, which is a date rather than a filing: the
        // message keeps the folder it is in and the inbox stops showing it
        // until that hour. See `inFolder` in `lib/mailbox.ts`.
        ...(action.to ? { folder: action.to } : null),
        // A snooze of zero is a waking: `mergeMark` drops the field rather
        // than storing an hour in the past for the rest of the term.
        snooze: action.snooze ?? 0,
      });
      // Moving the open message closes the reader, which is what archiving
      // from the pane means — the list it was in no longer holds it.
      const open = state.mailOpen && action.ids.includes(state.mailOpen) ? null : state.mailOpen;
      return { ...state, mailMarks: marks, mailOpen: open };
    }

    case 'composeMail': {
      if (action.draft === null) return { ...state, mailDraftId: null };
      const draft: MailDraft = {
        ...emptyDraft(),
        ...action.draft,
        id: newId(),
        updated: Date.now(),
      };
      return { ...state, mailDrafts: [draft, ...state.mailDrafts], mailDraftId: draft.id };
    }

    case 'openMailDraft':
      return { ...state, mailDraftId: action.id, mailOpen: null };

    case 'editMailDraft':
      return {
        ...state,
        mailDrafts: state.mailDrafts.map((d) =>
          d.id === action.id ? { ...d, ...action.patch, updated: Date.now() } : d,
        ),
      };

    /**
     * Handed to a mail app, which is as much as this app can honestly know.
     *
     * Not "sent": the compose window opened in Gmail with the draft in it and
     * what happened next happened there. It moves to Sent because that is
     * where somebody will look for it, and the screen says plainly that the
     * app did not send it.
     */
    case 'handedMail':
      return {
        ...state,
        mailDrafts: state.mailDrafts.map((d) =>
          d.id === action.id ? { ...d, handed: action.at, updated: action.at } : d,
        ),
        mailDraftId: state.mailDraftId === action.id ? null : state.mailDraftId,
      };

    case 'dropMailDraft':
      return {
        ...state,
        mailDrafts: state.mailDrafts.filter((d) => d.id !== action.id),
        mailDraftId: state.mailDraftId === action.id ? null : state.mailDraftId,
      };

    case 'setMailPane':
      return { ...state, mailPane: action.pane };

    default:
      return null;
  }
}
