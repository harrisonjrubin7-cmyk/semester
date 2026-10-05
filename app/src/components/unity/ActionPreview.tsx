import type { ReactNode } from 'react';
import type { FactProvenance } from '../../lib/factprovenance';
import { ProvenanceChips } from './ProvenanceChips';

/**
 * How an action can be taken back — a required part of a preview.
 *
 * Thirty dialogs ask "are you sure?" and about thirty write the answer to
 * "what happens?" by hand. Most say what will change; few say whether it can be
 * undone, and none make the writer decide. Making it a required field is the
 * point: the type will not compile without a stated answer.
 *
 * `request` needs `how`, because "it can be reversed" with no way to do it is
 * the sentence that sends someone to support.
 */
export type Recovery =
  | { kind: 'undo'; how?: string }
  | { kind: 'request'; how: string }
  | { kind: 'none'; how?: string };

/** The sentence for a recovery. Pure, so the words are tested and not retyped per dialog. */
export function recoveryLine(r: Recovery): string {
  switch (r.kind) {
    case 'undo':
      return r.how ? `You can undo this. ${r.how}` : 'You can undo this.';
    case 'request':
      return `This can be reversed on request: ${r.how}`;
    case 'none':
      return r.how ? `This can’t be undone. ${r.how}` : 'This can’t be undone.';
  }
}

/**
 * What a student is about to do, said before they do it.
 *
 * The content for `ConfirmDialog`'s `preview` slot (and anywhere else a choice
 * waits on a sentence). Not a second dialog: `ConfirmDialog` already puts focus
 * on Cancel, traps Tab and returns focus. What was missing was a shape for what
 * goes inside it, and `docs/ACTION-EXPLAINABILITY-AND-STUDENT-CONTROL.md`
 * already names it — what it says, what it does not change, what it is subject
 * to — to which this adds the one part that was always optional and should not
 * be: whether it can be taken back. `whoCanHelp` closes the seventh question
 * every screen has to answer; it stays optional because a local, undoable
 * action has nobody to ask.
 *
 * Order is the order a person asks the questions: what is it, what happens,
 * what exactly, what stays, can I take it back. A definition list, so a screen
 * reader hears the labels and a sighted reader scans them.
 *
 * Reversible work does not need a dialog at all — `lib/undo.ts` offers an undo
 * toast for those, because a confirmation clicked through a hundred times stops
 * asking. This is for what leaves something behind or leaves Semester.
 *
 * Provenance is optional and uses the one vocabulary (`FactProvenance`), so a
 * dialog that used to type "Institution verified · scope · source" by hand
 * draws the same chips as everything else.
 */
export function ActionPreview({
  subject,
  says,
  exactly,
  doesNotChange,
  subjectTo,
  recovery,
  whoCanHelp,
  provenance,
}: {
  /** The thing acted on — a share, a draft, a course. Drawn in bold. */
  subject?: string;
  /** What will happen, and to whom, in one plain sentence. */
  says: ReactNode;
  /** The exact payload, when there is one: the summary that will be sent, the draft that will be saved. */
  exactly?: ReactNode;
  /** What stays as it is. People ask this second, and it is often the reassurance. */
  doesNotChange?: ReactNode;
  /** The caveat: "Subject to your school’s official audit." */
  subjectTo?: ReactNode;
  recovery: Recovery;
  /** The person or office to ask if this goes wrong or is unclear: "Your advisor, or the Registrar’s office (Mon–Fri, 9–5)." */
  whoCanHelp?: ReactNode;
  provenance?: FactProvenance;
}) {
  return (
    <div className="action-preview">
      {subject ? (
        <p className="action-preview-subject">
          <strong>{subject}</strong>
        </p>
      ) : null}
      {provenance ? <ProvenanceChips provenance={provenance} /> : null}
      <dl className="action-preview-facts">
        <dt>What happens</dt>
        <dd>{says}</dd>
        {exactly ? (
          <>
            <dt>Exactly what</dt>
            <dd>{exactly}</dd>
          </>
        ) : null}
        {doesNotChange ? (
          <>
            <dt>What stays the same</dt>
            <dd>{doesNotChange}</dd>
          </>
        ) : null}
        <dt>Taking it back</dt>
        <dd>{recoveryLine(recovery)}</dd>
        {whoCanHelp ? (
          <>
            <dt>Who can help</dt>
            <dd>{whoCanHelp}</dd>
          </>
        ) : null}
      </dl>
      {subjectTo ? <p className="action-preview-caveat">{subjectTo}</p> : null}
    </div>
  );
}
