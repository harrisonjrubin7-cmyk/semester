import { useEffect, useMemo, useState } from 'react';
import { SectionLabel } from './ui';
import { SourceBadge } from './SourceBadge';
import { useSchoolRecords } from '../lib/school-records-hook';
import { LISTING_KINDS, arrange, deadlineLabel, fromCareerFeed, loadModerated, trackId, trackerEntry, type Listing, type ListingKind } from '../lib/listings';
import type { Opportunity } from '../lib/opportunities';
import { useNow } from '../state/store';

/**
 * Verified listings on the Opportunities tracker. Draws nothing until there is
 * at least one — a school with no publishers and no career feed sees the
 * tracker as before. "Track this" copies a listing into the student's own
 * tracker with the listing's link as its source; nothing is sent anywhere.
 */
/** `tracked` holds the Tracker's entry ids and sources, so a listing is known whether or not it has a link. */
export function VerifiedListings({ onTrack, tracked }: { onTrack: (o: Opportunity) => void; tracked: readonly string[] }) {
  const now = useNow();
  const [moderated, setModerated] = useState<Listing[]>([]);
  const [kind, setKind] = useState<ListingKind | 'all'>('all');
  const school = useSchoolRecords();

  useEffect(() => {
    let live = true;
    loadModerated().then((l) => { if (live) setModerated(l); }, () => {});
    return () => { live = false; };
  }, []);

  const all = useMemo(
    () => arrange([...moderated, ...(school.status === 'ready' ? fromCareerFeed(school.rows) : [])], now),
    [moderated, school, now],
  );
  if (!all.length) return null;
  const shown = all.filter((l) => kind === 'all' || l.kind === kind);

  return (
    <section aria-label="Verified listings">
      <SectionLabel>Verified listings</SectionLabel>
      <p className="jx-muted">Approved by a moderator, or sent by your school’s career office. Eligibility is the office’s own wording — check it with them; Semester does not decide it.</p>
      <div className="jx-chips" role="radiogroup" aria-label="Listing type">
        {[{ id: 'all' as const, label: 'All' }, ...LISTING_KINDS].map((k) => (
          <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className={`jx-chip${kind === k.id ? ' jx-chip-on' : ''}`} onClick={() => setKind(k.id)}>
            {k.label}
          </button>
        ))}
      </div>
      {shown.map((l) => {
        const isTracked = tracked.includes(trackId(l)) || (!!l.url && tracked.includes(l.url));
        return (
          <article key={l.id} className="jx-entry">
            <div className="jx-entry-head">
              <span className="jx-entry-title">{l.title}</span>
              <span className="jx-tag">{LISTING_KINDS.find((k) => k.id === l.kind)!.label.replace(/s$/, '')}</span>
            </div>
            <div className="jx-entry-what">
              {[l.from, l.deadline && `apply by ${deadlineLabel(l.deadline)}`].filter(Boolean).join(' · ')}
            </div>
            <SourceBadge label={l.source === 'career_feed' ? 'imported' : 'institution_verified'} />
            {l.body ? <div className="jx-entry-what">{l.body}</div> : null}
            {l.eligibility.length ? (
              <div className="jx-privacy">
                Eligibility, as the office wrote it:
                <ul>{l.eligibility.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            ) : null}
            <div className="jx-actions">
              {l.url ? (
                <a className="jx-door-link" href={l.url} target="_blank" rel="noopener noreferrer">Open the listing ↗</a>
              ) : null}
              <button type="button" className="jx-go" disabled={isTracked} onClick={() => onTrack(trackerEntry(l))}>
                {isTracked ? 'Tracking' : 'Track this'}
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
