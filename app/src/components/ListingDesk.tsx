import { useCallback, useEffect, useState } from 'react';
import { Notice, SectionLabel } from './ui';
import { cloud } from '../lib/cloud';
import { useMyCapabilities } from '../lib/capabilities';
import { LISTING_KINDS, eligibilityLines, type ListingKind } from '../lib/listings';

/**
 * The staff side of verified listings: publishers draft and submit, moderators
 * publish or remove. Draws nothing unless `my_capabilities()` reports
 * `opportunity:publish` or `opportunity:moderate` — and the table's own
 * policies still decide every write.
 *
 * A moderator here only ever changes `status`. The database would currently
 * let a moderator rewrite a listing's title and body too; this screen offers
 * no way to, and the PR asks whether the policy should be narrowed to match.
 */

interface Row { id: string; kind: string; title: string; status: string; url: string | null; publisher_scope_id: string; eligibility: unknown }

export function ListingDesk({ school }: { school: string }) {
  const grants = useMyCapabilities();
  const publishScopes = grants.filter((g) => g.capability === 'opportunity:publish');
  const moderates = grants.some((g) => g.capability === 'opportunity:moderate');
  const [rows, setRows] = useState<Row[]>([]);
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState({ kind: 'job' as ListingKind, title: '', body: '', url: '', deadline: '', eligibility: '', scope: '' });

  const refresh = useCallback(async () => {
    if (!publishScopes.length && !moderates) return;
    const { data } = await (await cloud()).from('opportunities')
      .select('id, kind, title, status, url, publisher_scope_id, eligibility')
      .in('status', ['draft', 'pending_review', 'published']).order('created_at', { ascending: false }).limit(100);
    setRows((data ?? []) as Row[]);
  }, [publishScopes.length, moderates]);

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
        deadline: draft.deadline || null, eligibility: draft.eligibility.trim() ? { text: draft.eligibility.trim() } : {},
        publisher_id: user.user?.id, publisher_scope_kind: scope.scopeKind, publisher_scope_id: scope.scopeId,
        tenant_id: school || null, status: 'pending_review',
      });
    });
  };

  const setStatus = (id: string, status: 'published' | 'removed') =>
    act(async () => (await cloud()).from('opportunities').update({ status }).eq('id', id));

  const pending = rows.filter((r) => r.status === 'pending_review');

  return (
    <section className="jx-card" aria-labelledby="listing-desk-heading">
      <SectionLabel>Listings</SectionLabel>
      <h2 id="listing-desk-heading" className="jx-card-title">Verified listings desk</h2>
      {notice ? <Notice alert>{notice}</Notice> : null}

      {moderates ? (
        <>
          <SectionLabel>Waiting for review ({pending.length})</SectionLabel>
          {!pending.length ? <p className="jx-muted">Nothing waiting.</p> : null}
          {pending.map((r) => (
            <div key={r.id} className="jx-entry">
              <div className="jx-entry-title">{r.title}</div>
              <div className="jx-entry-what">{r.kind} · from {r.publisher_scope_id}{r.url ? ` · ${r.url}` : ''}</div>
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
