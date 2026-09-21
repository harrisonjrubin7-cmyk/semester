import { useMemo } from 'react';
import { useNow, useStore } from '../state/store';
import { secondLine } from '../lib/dim';
import { ActionButton, SectionLabel } from './ui';
import { absenceDraft, absenceEmail, eventDays, runsOver, type AthleticEvent } from '../lib/athletics';
import { draftFor } from '../lib/mail';
import { fromMarkdown } from '../lib/document';

/**
 * Telling the professors, one professor at a time.
 *
 * The letter has been here since the screen was written, and it was one
 * document covering the whole trip: every conflicting class in every course,
 * addressed to "Professor", produced as a document to copy out of. Which is
 * most of the work done and the last step left undone, because the step that
 * does not happen is the one where somebody opens their mail client, finds the
 * right address, and pastes.
 *
 * So the notice goes through the app's own drafting path instead —
 * `draftFor` in `lib/mail.ts`, the same one behind *ask for more time* under a
 * deadline and *write to them first* in office hours. The draft opens in the
 * mailbox, addressed from the syllabus, with the subject and the missed
 * sessions already in it, and the student reads it and sends it themselves.
 * The app does not send: mail is connected read-only on purpose, and
 * `lib/mail.ts` says why at length.
 *
 * ## One per course, not one for the trip
 *
 * A professor is answering about their own course. A letter listing four
 * courses' worth of classes asks them to find the two lines that concern them,
 * and it is the same letter four people read — so three of them are reading
 * somebody else's business, including which other classes this student is
 * behind in.
 *
 * ## What happens when there is no address
 *
 * A course imported from a syllabus that never named one, which is common. The
 * fallback is the document the screen always produced: the whole trip, in one
 * letter, to print or paste wherever the professor can be reached. Losing the
 * ability to write it at all would be a worse answer than an unaddressed one.
 *
 * ## It authorises nothing
 *
 * Both say so in their own words. An athletics office authorises an absence
 * and this app has no connection to one; what it has is the right words ready
 * and the right sessions already listed, which is the tedious part.
 */
export function AbsenceNotices({
  event,
  conflicts,
}: {
  event: AthleticEvent;
  /** The screen's own hour-level reading of the trip, for the fallback letter. */
  conflicts: string[];
}) {
  const { catalog, dispatch } = useStore();
  const now = useNow();

  const missed = useMemo(() => runsOver(catalog, eventDays(event), now), [catalog, event, now]);

  const line = {
    fontSize: 'var(--type-sm)',
    ...secondLine(),
    lineHeight: 'var(--leading-normal)',
    textWrap: 'pretty',
  } as const;

  const letter = () =>
    dispatch({
      type: 'makeDocument',
      open: true,
      doc: {
        title: `${event.title} · Academic absence request`,
        subtitle: 'Draft for review · Not sent, and not an official authorization',
        courseId: null,
        blocks: fromMarkdown(absenceDraft(event, conflicts)),
      },
    });

  return (
    <>
      <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-3)' }}>Tell your professors</SectionLabel>
      <p style={{ ...line, marginBlock: 0 }}>
        A draft each, opened in the mailbox with the sessions it affects already listed. Read it before
        you send it — the app does not send, and none of this authorises an absence. Official
        documentation comes from your athletics office.
      </p>

      {missed.length === 0 ? (
        <p style={{ fontSize: 'var(--type-base)', ...secondLine(), marginTop: 'var(--sp-4)' }}>
          No class or deadline in these days, so there is nobody to tell.
        </p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
          {missed.map((m) => {
            const course = catalog.byId[m.course];
            if (!course) return null;
            const note = absenceEmail(event, course, m);
            const addressed = Boolean(course.email);
            return (
              <ActionButton
                key={m.course}
                style={{ flex: '1 1 auto' }}
                onClick={() =>
                  addressed
                    ? dispatch({
                        type: 'writeMail',
                        draft: {
                          ...draftFor('absence', { course }),
                          subject: note.subject,
                          body: note.body,
                        },
                      })
                    : letter()
                }
              >
                {addressed ? `Email ${course.code}` : `${course.code} — write a letter`}
              </ActionButton>
            );
          })}
        </div>
      )}

      {missed.some((m) => !catalog.byId[m.course]?.email) && (
        <p style={{ ...line, marginTop: 'var(--sp-4)' }}>
          No address on file for one of these, so that one opens the printable letter for the whole
          trip instead. Adding the instructor’s email to the course makes it a draft like the others.
        </p>
      )}
    </>
  );
}
