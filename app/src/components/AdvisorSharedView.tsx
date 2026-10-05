import { formatDate } from '../lib/locale';
import { useState } from 'react';
import { payloadLines, type SharePayload } from '../lib/advisor-meeting';
import { openShare, sharedWithMe, type SharedWithMe } from '../lib/advisor-shares';

const day = (iso: string) => formatDate(new Date(iso), { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * The advisor's side of a share (`advisor_meeting_mode`, Phase G).
 *
 * Folded away, and it asks the server nothing until it is opened. The list is
 * titles and dates only. Opening one reads exactly the snapshot the student
 * previewed — agenda, questions, and only the scenario, courses and actions
 * they ticked — and the student sees that it was opened. Nothing else about
 * the student is available here, by construction: the server holds nothing
 * else in a share.
 */
export function AdvisorSharedView({ signedIn }: { signedIn: boolean }) {
  const [list, setList] = useState<SharedWithMe[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<{ row: SharedWithMe; title: string; payload: SharePayload; expires_at: string } | null>(null);

  if (!signedIn) return null;

  const load = () => {
    setError('');
    sharedWithMe().then(setList, (e: unknown) => setError(e instanceof Error ? e.message : 'Shares could not be loaded.'));
  };
  const read = (row: SharedWithMe) => {
    setError('');
    openShare(row.id).then(
      (share) => setOpen({ row, ...share }),
      (e: unknown) => setError(e instanceof Error ? e.message : 'This share could not be opened.'),
    );
  };

  return (
    <details
      className="balance-more advisor-view"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open && list === null) load();
      }}
    >
      <summary>For advisors: meetings shared with you</summary>
      {error ? <p role="alert">{error}</p> : null}
      {open ? (
        <article className="advisor-view-share" aria-label={`Shared by ${open.row.shared_as || 'a student'}`}>
          <h4>{open.title}</h4>
          <p className="portal-muted">
            Shared by {open.row.shared_as || 'a student'} · open until {day(open.expires_at)}. The student can see that you opened
            it, and can revoke it. This is what they chose to share, and nothing else.
          </p>
          {payloadLines(open.payload).map((s) => (
            <section key={s.heading}>
              <h5>{s.heading}</h5>
              <ul>{s.items.map((i) => <li key={i}>{i}</li>)}</ul>
            </section>
          ))}
          <button type="button" className="balance-button" onClick={() => setOpen(null)}>
            Back to the list
          </button>
        </article>
      ) : list === null ? (
        error ? null : <p className="portal-muted">Loading…</p>
      ) : list.length ? (
        <ul className="advisor-share-list">
          {list.map((row) => (
            <li key={row.id}>
              <button type="button" className="workspace-text-button" onClick={() => read(row)}>
                {row.title}
              </button>{' '}
              — {row.shared_as || 'a student'}, shared {day(row.created_at)}, open until {day(row.expires_at)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="portal-muted">Nothing is shared with you. Only advisors at a student’s school can receive a share.</p>
      )}
    </details>
  );
}
