import { useCallback, useEffect, useState } from 'react';
import { Notice, SectionLabel } from './ui';
import { cloud } from '../lib/cloud';
import { useMyCapabilities } from '../lib/capabilities';
import { LISTING_KINDS, QUEUE_LIMIT, deadlineForStorage, deadlineLabel, eligibilityLines, loadReviewQueue, moderateListing, type ListingKind, type QueuedListing } from '../lib/listings';

/**
 * The staff side of verified listings: publishers draft and submit, moderators
 * publish or remove. Draws nothing unless `my_capabilities()` reports
 * `opportunity:publish` or `opportunity:moderate` — and the table's own
 * policies still decide every write.
 *
 * A moderator only ever changes `status`, and the database holds them to it:
 * `moderate_opportunity` is their one door, and it writes nothing else. The
 * title, body, link, deadline and eligibility stay the publisher's words.
 */

type Row = QueuedListing;

export function ListingDesk({ school }: { school: string }) {
  const grants = useMyCapabilities();
  const publishScopes = grants.filter((g) => g.capability === 'opportunity:publish');
  const moderates = grants.some((g) => g.capability === 'opportunity:moderate');
  const [rows, setRows] = useState<Row[]>([]);
  const [more, setMore] = useState(false);
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState({ kind: 'job' as ListingKind, title: '', body: '', url: '', deadline: '', eligibility: '', scope: '' });

  const refresh = useCallback(async () => {
    if (!moderates) return;
    try {
      const q = await loadReviewQueue();
      setRows(q.rows);
      setMore(q.more);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not load the review queue.');
    }
  }, [moderates]);

  // An account-backed resource, not render-derived state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  if (!publishScopes.length && !moderates) return null;

  const act = (work: () => Promise<{ error: { message: string } | null }>) => {
    setNotice('');
    work().then(({ error }) => (error ? setNotice(error.message) : refresh()), (e: unknown) => setNotice(String(e)));
  };

  const submit = () => {
    const scope = publishScopes.find((g) => `${g.scopeKind}:${g.scopeId}` === draft.scope) ?? publishScopes[0];
    if (!draft.title.trim()) return setNotice('A listing needs a title.');
    if (draft.url && !/^https:\/\//i.test(draft.url)) return setNotice('The link has to start with https://');
    act(async () => {
      const db = await cloud();
      const { data: user } = await db.auth.getUser();
      return db.from('opportunities').insert({
        kind: draft.kind, title: draft.title.trim(), body: draft.body.trim(), url: draft.url.trim() || null,
        deadline: deadlineForStorage(draft.deadline), eligibility: draft.eligibility.trim() ? { text: draft.eligibility.trim() } : {},
        publisher_id: user.user?.id, publisher_scope_kind: scope.scopeKind, publisher_scope_id: scope.scopeId,
        tenant_id: school || null, status: 'pending_review',
      });
    });
  };

  const setStatus = (id: string, status: 'published' | 'removed') =>
    act(async () => {
      try {
        await moderateListing(id, status);
        return { error: null };
      } catch (e) {
        return { error: { message: e instanceof Error ? e.message : 'Could not change that listing.' } };
      }
    });

  const pending = rows;

  return (
    <section className="jx-card" aria-labelledby="listing-desk-heading">
      <SectionLabel>Listings</SectionLabel>
      <h2 id="listing-desk-heading" className="jx-card-title">Verified listings desk</h2>
      {notice ? <Notice alert>{notice}</Notice> : null}

      {moderates ? (
        <>
          <SectionLabel>Waiting for review ({pending.length})</SectionLabel>
          {!pending.length ? <p className="jx-muted">Nothing waiting.</p> : null}
          {more ? <p className="jx-muted">More than {QUEUE_LIMIT} are waiting; the oldest are shown first.</p> : null}
          {pending.map((r) => (
            <div key={r.id} className="jx-entry">
              <div className="jx-entry-title">{r.title}</div>
              <div className="jx-entry-what">{r.kind} · from {r.publisher_scope_id}{r.url ? ` · ${r.url}` : ''}{r.deadline ? ` · apply by ${deadlineLabel(r.deadline)}` : ' · no deadline'}</div>
              {r.body ? <div className="jx-entry-what">{r.body}</div> : <div className="jx-muted">No description.</div>}
              {eligibilityLines(r.eligibility).map((e) => <div key={e} className="jx-privacy">{e}</div>)}
              <div className="jx-actions">
                <button type="button" className="jx-go" onClick={() => setStatus(r.id, 'published')}>Publish</button>
                <button type="button" className="jx-go" onClick={() => setStatus(r.id, 'removed')}>Remove</button>
              </div>
            </div>
          ))}
        </>
      ) : null}

      {publishScopes.length ? (
        <>
          <SectionLabel>Submit a listing for review</SectionLabel>
          {publishScopes.length > 1 ? (
            <label className="jx-field">
              <span>Publishing as</span>
              <select className="input" value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value })} aria-label="Publishing as">
                {publishScopes.map((g) => <option key={`${g.scopeKind}:${g.scopeId}`} value={`${g.scopeKind}:${g.scopeId}`}>{g.scopeId}</option>)}
              </select>
            </label>
          ) : null}
          <label className="jx-field">
            <span>Type</span>
            <select className="input" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as ListingKind })} aria-label="Listing type">
              {LISTING_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label.replace(/s$/, '')}</option>)}
            </select>
          </label>
          <label className="jx-field"><span>Title</span><input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label="Listing title" /></label>
          <label className="jx-field"><span>Description</span><textarea className="input jx-area" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} aria-label="Listing description" /></label>
          <label className="jx-field"><span>Link (https)</span><input className="input" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} aria-label="Listing link" /></label>
          <label className="jx-field"><span>Deadline</span><input className="input" type="date" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} aria-label="Listing deadline" /></label>
          <label className="jx-field"><span>Eligibility, in your words — shown to students exactly as written</span><textarea className="input jx-area" value={draft.eligibility} onChange={(e) => setDraft({ ...draft, eligibility: e.target.value })} aria-label="Listing eligibility" /></label>
          <button type="button" className="btn btn-secondary" onClick={submit}>Submit for review</button>
          <p className="jx-muted">A moderator publishes it. You cannot publish your own listing.</p>
        </>
      ) : null}
    </section>
  );
}
