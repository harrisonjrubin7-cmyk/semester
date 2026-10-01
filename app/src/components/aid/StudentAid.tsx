import { useEffect, useState } from 'react';
import { EmptyState, Notice, SectionLabel } from '../ui';
import { loadAwards, loadDisbursements } from '../../lib/aid/client';
import type { Award, Disbursement } from '../../lib/aid/model';
import { money } from '../../lib/finance/accounts';
import { STATUS_LABEL, TYPE_LABEL, dayOf, reconciliationSentence, studentSentence } from '../../lib/aid/views';

/**
 * A student's own aid awards and what has been paid out against each.
 *
 * What the database returns is all there is: an award waiting for its second
 * person is not returned, and the history, the approvals and the staff's reasons
 * are not readable by a student. The sentences state what the school recorded,
 * nothing estimated: how much has been paid out, how much is still to come, and
 * whether a payment was matched to the aid credit on the student account.
 */
export function StudentAid({ studentRef }: { studentRef: string }) {
  const [state, setState] = useState<{ awards: Award[]; paid: Disbursement[] } | null | string>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const awards = await loadAwards(studentRef);
      const paid = (await Promise.all(awards.map((a) => loadDisbursements(a.id)))).flat();
      return { awards, paid };
    })().then(
      (r) => {
        if (live) setState(r);
      },
      (e: unknown) => {
        if (live) setState(e instanceof Error ? e.message : 'Could not load your aid awards.');
      },
    );
    return () => {
      live = false;
    };
  }, [studentRef]);

  if (state === null) return <p role="status">Loading your aid awards…</p>;
  if (typeof state === 'string') return <Notice alert>{state} Nothing has changed.</Notice>;
  if (state.awards.length === 0) {
    return <EmptyState inline title="Your school has recorded no aid award for you" body="Awards your school records for you appear here, with what has been paid out against each." />;
  }
  return (
    <>
      {state.awards.map((a) => {
        const mine = state.paid.filter((d) => d.awardId === a.id);
        return (
          <section key={a.id} aria-label={`Award ${a.fundName}`}>
            <SectionLabel>
              {a.fundName} · {a.aidYear}
            </SectionLabel>
            <p>
              {TYPE_LABEL[a.awardType]}, {money(a.amountCents)}. <strong>{STATUS_LABEL[a.status]}</strong>.
            </p>
            <p>{studentSentence(a, mine)}</p>
            {mine.length > 0 && (
              <ul aria-label={`Paid out against ${a.fundName}`} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {mine.map((d) => (
                  <li key={d.id} style={{ paddingBlock: 'var(--sp-3)', borderBottom: '1px solid var(--app-line-soft)' }}>
                    {money(d.amountCents)} on {dayOf(d.disbursedOn)}. {reconciliationSentence(d)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
