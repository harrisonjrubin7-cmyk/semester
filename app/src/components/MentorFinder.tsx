import { useCallback, useEffect, useState } from 'react';
import { Notice, SectionLabel } from './ui';
import { matchMentors, type StudentType } from '../lib/launchpad';
import {
  NO_ROSTERS,
  answerRequest,
  asMentors,
  askMentor,
  loadRosters,
  split,
  type MentorKind,
  type Offer,
  type Rosters,
} from '../lib/mentors';

/**
 * Find a mentor, ask, and answer — for peer mentors (Launchpad) and alumni
 * (Opportunities) alike.
 *
 * Renders `fallback` until the school has at least one offer this person can
 * see, so the "not connected yet" line stays true where it is true. Matching
 * uses only the interests the student ticked against the topics a mentor
 * listed. Before a request is accepted, each side sees only the other's chosen
 * display name; after, the screen says the school's program connects them —
 * no contact details pass through Semester.
 */
export function MentorFinder({
  kind,
  interests,
  types = [],
  fallback,
}: {
  kind: MentorKind;
  interests: readonly string[];
  types?: readonly StudentType[];
  fallback: React.ReactNode;
}) {
  const [rosters, setRosters] = useState<Rosters>(NO_ROSTERS);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    try {
      setRosters(await loadRosters(kind));
    } catch {
      setRosters(NO_ROSTERS);
    }
  }, [kind]);

  // An account-backed resource, not render-derived state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const run = (work: () => Promise<void>) => {
    setBusy(true);
    setNotice('');
    work()
      .then(refresh)
      .catch((e: unknown) => setNotice(e instanceof Error ? e.message : 'That did not go through.'))
      .finally(() => setBusy(false));
  };

  const me = rosters.me;
  const mine = me ? split(rosters.requests, me) : { sent: [], waiting: [], mentoring: [] };
  if (!me || (!rosters.offers.length && !rosters.requests.length)) return <>{fallback}</>;

  const pendingTo = new Set(mine.sent.filter((r) => r.status === 'pending' || r.status === 'accepted').map((r) => r.recipient));
  const pool = asMentors(rosters.offers).filter((m) => !pendingTo.has(m.offer.userId));
  // Peer mentors are matched on ticked interests only. Alumni are listed even
  // with nothing ticked — but then with no claimed overlap, never an invented one.
  const matches = kind === 'peer' || interests.length
    ? matchMentors(interests, types, pool, kind === 'peer' ? 3 : 5)
    : pool.slice(0, 5).map((mentor) => ({ mentor, shared: [] as string[] }));
  const ask = (o: Offer) => {
    if (name.trim().length < 2) {
      setNotice('Choose a name to show them — at least two characters.');
      return;
    }
    run(() => askMentor(o, name, interests.filter((i) => o.topics.includes(i)), note));
  };

  return (
    <div className="jx-list">
      {notice ? <Notice alert>{notice}</Notice> : null}

      {mine.waiting.length ? (
        <>
          <SectionLabel>Asking you</SectionLabel>
          {mine.waiting.map((r) => (
            <div key={r.id} className="jx-entry">
              <div className="jx-entry-title">{r.requesterName}</div>
              {r.topics.length ? <div className="jx-entry-what">Wants to talk about {r.topics.join(', ')}</div> : null}
              {r.note ? <div className="jx-privacy">{r.note}</div> : null}
              <div className="jx-actions">
                <button type="button" className="jx-go" disabled={busy} onClick={() => run(() => answerRequest(r.id, 'accepted'))}>Accept</button>
                <button type="button" className="jx-go" disabled={busy} onClick={() => run(() => answerRequest(r.id, 'declined'))}>Decline</button>
              </div>
            </div>
          ))}
        </>
      ) : null}

      {mine.mentoring.length ? (
        <>
          <SectionLabel>You are mentoring</SectionLabel>
          {mine.mentoring.map((r) => (
            <div key={r.id} className="jx-entry">
              <div className="jx-entry-head">
                <span className="jx-entry-title">{r.requesterName}</span>
                <span className="jx-tag">Accepted</span>
              </div>
              {r.topics.length ? <div className="jx-entry-what">Wants to talk about {r.topics.join(', ')}</div> : null}
              <div className="jx-entry-what">Your school’s mentoring program connects you from here — no contact details go through Semester.</div>
            </div>
          ))}
        </>
      ) : null}

      {mine.sent.length ? (
        <>
          <SectionLabel>Your requests</SectionLabel>
          {mine.sent.map((r) => {
            const who = rosters.offers.find((o) => o.userId === r.recipient)?.name ?? 'A mentor';
            return (
              <div key={r.id} className="jx-entry">
                <div className="jx-entry-head">
                  <span className="jx-entry-title">{who}</span>
                  <span className="jx-tag">{r.status === 'pending' ? 'Waiting' : r.status === 'accepted' ? 'Accepted' : r.status === 'declined' ? 'Declined' : 'Withdrawn'}</span>
                </div>
                {r.status === 'accepted' ? (
                  <div className="jx-entry-what">Accepted. Your school’s mentoring program connects you from here — no contact details go through Semester.</div>
                ) : null}
                {r.status === 'pending' ? (
                  <button type="button" className="jx-go" disabled={busy} onClick={() => run(() => answerRequest(r.id, 'withdrawn'))}>Withdraw</button>
                ) : null}
              </div>
            );
          })}
        </>
      ) : null}

      {matches.length ? (
        <>
          <SectionLabel>{kind === 'peer' ? 'Mentors who match what you ticked' : 'Alumni offering to mentor'}</SectionLabel>
          <label className="jx-field">
            <span>The name they will see — yours to choose</span>
            <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="Name to show a mentor" />
          </label>
          <label className="jx-field">
            <span>A short note (optional)</span>
            <input className="input" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} aria-label="Note to a mentor" />
          </label>
          {matches.map(({ mentor, shared }) => {
            const offer = pool.find((m) => m.id === mentor.id)!.offer;
            return (
              <div key={mentor.id} className="jx-entry">
                <div className="jx-entry-title">{mentor.name}</div>
                <div className="jx-entry-what">{shared.length ? `You both picked: ${shared.join(', ')}` : `Talks about ${offer.topics.join(', ')}`}</div>
                <button type="button" className="jx-go" disabled={busy} onClick={() => ask(offer)}>Ask {mentor.name}</button>
              </div>
            );
          })}
        </>
      ) : kind === 'peer' ? (
        <p className="jx-muted">No mentor in your cohort lists those topics yet. Tick another, or check back.</p>
      ) : null}
      <p className="jx-muted">A request is only a request: nothing happens until they accept, and either of you can say no.</p>
    </div>
  );
}
