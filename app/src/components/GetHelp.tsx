import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Account } from '../lib/cloud';
import {
  CONTEXT_KEYS,
  CONTEXT_TEXT,
  FIELD_MAX,
  IDENTITY_SENT,
  KIND_TEXT,
  NEEDS,
  NEVER_SENT,
  QUESTION_MAX,
  STATUS_TEXT,
  WITHDRAWABLE,
  asNote,
  emptyDraft,
  followUp,
  loadHelp,
  preview,
  sendHelp,
  sendable,
  takeHelpSeed,
  withdrawHelp,
  type ContextKey,
  type Destination,
  type Draft,
  type HelpSeed,
  type NeedId,
  type SentRequest,
} from '../lib/help-routes';
import { ActionButton, Notice, SectionLabel } from './ui';
import { MomentPromptSlot } from './MomentPrompt';

/**
 * Ask a person for help — the screen half of `lib/help-routes.ts`.
 *
 * Three steps, always in this order and never skipped: say what you need,
 * write the question and tick what to include, then read exactly what will be
 * sent before it goes. When the school has not connected that office, the
 * same preview becomes a note to copy and take yourself, so the route is
 * useful before any integration exists.
 */
export function GetHelp({ account }: { account: Account | null }) {
  // Taken once, on first render: an Action Center "Ask for help" that led here.
  const [seed] = useState<HelpSeed | null>(() => takeHelpSeed());
  const [needId, setNeedId] = useState<NeedId | null>(seed?.need ?? null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [requests, setRequests] = useState<SentRequest[]>([]);
  const [myName, setMyName] = useState('');
  const [destinationId, setDestinationId] = useState('');
  // Pre-filled from the action, never pre-ticked: `ticked` starts empty either way.
  const [draft, setDraft] = useState<Draft>(() => (seed ? { ...emptyDraft(), question: (seed.question ?? '').slice(0, QUESTION_MAX), fields: { ...seed.fields } } : emptyDraft()));
  const [from, setFrom] = useState(seed?.from ?? '');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  // True from a send made in this visit, so the question is about the request just made and not an old one.
  const [justSent, setJustSent] = useState(false);

  const refresh = useCallback(async () => {
    if (!account) return;
    try {
      const next = await loadHelp();
      setDestinations(next.destinations);
      setRequests(next.requests);
      setMyName(next.name);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load where to get help.');
    }
  }, [account]);

  // An account-backed resource, not render-derived state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const need = NEEDS.find((n) => n.id === needId) ?? null;
  const offices = useMemo(
    () => (need ? destinations.filter((d) => need.kinds.includes(d.kind)) : []),
    [need, destinations],
  );
  const office = offices.find((d) => d.id === destinationId) ?? null;
  const lines = preview(draft);
  const canSend = !!account && !!office?.acceptsRequests && !need?.directoryOnly;
  // What the need offers, plus anything already filled in — a seeded deadline
  // under course help is shown rather than carried invisibly.
  const shown = need
    ? CONTEXT_KEYS.filter((k) => need.offer.includes(k) || (draft.fields[k] ?? '').trim() !== '')
    : [];

  const choose = (id: NeedId) => {
    setNeedId(id);
    setFrom('');
    setDestinationId('');
    setDraft(emptyDraft());
    setConfirming(false);
    setNotice('');
  };

  const setField = (key: ContextKey, value: string) =>
    setDraft((d) => ({ ...d, fields: { ...d.fields, [key]: value } }));
  const tick = (key: ContextKey, on: boolean) =>
    setDraft((d) => {
      const ticked = new Set(d.ticked);
      if (on) ticked.add(key);
      else ticked.delete(key);
      return { ...d, ticked };
    });

  const nameOf = (id: string) => destinations.find((d) => d.id === id)?.name ?? 'A campus office';

  return (
    <section aria-labelledby="get-help-heading" style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <div>
        <SectionLabel>Get help from a person</SectionLabel>
        <h2 id="get-help-heading" style={{ fontSize: 'var(--type-xl)', marginBlock: 'var(--sp-3)' }}>
          Who can help with this?
        </h2>
        <p style={{ color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed-plus)' }}>
          Pick what you need. Nothing is sent until you have read exactly what will go, and you can
          withdraw a request at any time.
        </p>
      </div>

      {notice && <Notice alert>{notice}</Notice>}

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 'var(--sp-2)' }}>
        <legend style={{ fontWeight: 600, marginBottom: 'var(--sp-2)' }}>What do you need help with?</legend>
        {NEEDS.map((n) => (
          <label key={n.id} style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
            <input type="radio" name="help-need" checked={needId === n.id} onChange={() => choose(n.id)} />
            {n.label}
          </label>
        ))}
      </fieldset>

      {need && (
        <div className="portal-panel" style={{ display: 'grid', gap: 'var(--sp-4)' }}>
          {from && (
            <p style={{ margin: 0, color: 'var(--app-dim)' }}>
              {from}. Its details are filled in below and not included until you tick them.
            </p>
          )}
          <p role="status">{need.note}</p>

          {offices.length > 0 && (
            <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 'var(--sp-2)' }}>
              <legend style={{ fontWeight: 600, marginBottom: 'var(--sp-2)' }}>
                {need.directoryOnly ? 'Where to go' : 'Who to ask'}
              </legend>
              {offices.map((d) => (
                <div key={d.id} style={{ display: 'grid', gap: 'var(--sp-1)' }}>
                  {need.directoryOnly ? (
                    <strong>{d.name}</strong>
                  ) : (
                    <label style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
                      <input type="radio" name="help-office" checked={destinationId === d.id} onChange={() => { setDestinationId(d.id); setConfirming(false); }} />
                      <span>{d.name} · {KIND_TEXT[d.kind]}{d.acceptsRequests ? '' : ' · contact directly'}</span>
                    </label>
                  )}
                  {(d.hours || d.officialUrl) && (
                    <span style={{ color: 'var(--app-dim)', fontSize: 'var(--type-sm)' }}>
                      {d.hours}
                      {d.hours && d.officialUrl ? ' · ' : ''}
                      {d.officialUrl && <a href={d.officialUrl} target="_blank" rel="noreferrer">Official page</a>}
                    </span>
                  )}
                </div>
              ))}
            </fieldset>
          )}

          {!need.directoryOnly && (
            <>
              <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                Your question
                <textarea
                  className="input"
                  maxLength={QUESTION_MAX}
                  value={draft.question}
                  onChange={(e) => { setDraft((d) => ({ ...d, question: e.target.value })); setConfirming(false); }}
                />
              </label>

              {shown.length > 0 && (
                <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 'var(--sp-3)' }}>
                  <legend style={{ fontWeight: 600, marginBottom: 'var(--sp-2)' }}>
                    Add context (optional — only ticked lines are included)
                  </legend>
                  {shown.map((key) => (
                    <div key={key} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--sp-3)', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        id={`help-tick-${key}`}
                        checked={draft.ticked.has(key)}
                        onChange={(e) => { tick(key, e.target.checked); setConfirming(false); }}
                        aria-label={`Include ${CONTEXT_TEXT[key].toLowerCase()}`}
                      />
                      <label style={{ display: 'grid', gap: 'var(--sp-1)' }}>
                        {CONTEXT_TEXT[key]}
                        <input
                          className="input"
                          maxLength={FIELD_MAX}
                          value={draft.fields[key] ?? ''}
                          onChange={(e) => { setField(key, e.target.value); setConfirming(false); }}
                        />
                      </label>
                    </div>
                  ))}
                </fieldset>
              )}

              <div aria-live="polite">
                <SectionLabel aside={`${lines.length + (canSend ? IDENTITY_SENT.length : 0)}`}>Exactly what will be sent</SectionLabel>
                {canSend && (
                  <dl style={{ display: 'grid', gap: 'var(--sp-2)', margin: '0 0 var(--sp-3)' }} data-identity>
                    {IDENTITY_SENT.map((f) => (
                      <div key={f.key}>
                        <dt style={{ fontWeight: 600 }}>{f.label} <span style={{ fontWeight: 400, color: 'var(--app-dim)' }}>(always included, so the office can reach you)</span></dt>
                        <dd style={{ margin: 0 }}>
                          {f.key === 'email' ? account?.email || 'Your account email' : myName || 'Your Semester display name'}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {lines.length === 0 ? (
                  <p style={{ color: 'var(--app-dim)' }}>Nothing yet. Write your question above.</p>
                ) : (
                  <dl style={{ display: 'grid', gap: 'var(--sp-2)', margin: 0 }} data-lines>
                    {lines.map((l) => (
                      <div key={l.key}>
                        <dt style={{ fontWeight: 600 }}>{l.label}</dt>
                        <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{l.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p style={{ color: 'var(--app-dim)', fontSize: 'var(--type-sm)', marginTop: 'var(--sp-3)' }}>
                  Never included: {NEVER_SENT.join('; ')}.
                </p>
              </div>

              {canSend && office ? (
                confirming ? (
                  <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
                    <ActionButton
                      tone="primary"
                      disabled={busy}
                      onClick={() => {
                        setBusy(true);
                        void sendHelp(office.id, draft)
                          .then(async () => {
                            setDraft(emptyDraft());
                            setConfirming(false);
                            setNotice('');
                            setJustSent(true);
                            await refresh();
                          })
                          .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Could not send.'))
                          .finally(() => setBusy(false));
                      }}
                    >
                      {busy ? 'Sending…' : `Yes, send to ${office.name}`}
                    </ActionButton>
                    <ActionButton onClick={() => setConfirming(false)}>Not yet</ActionButton>
                  </div>
                ) : (
                  <ActionButton tone="primary" disabled={!!sendable(draft)} onClick={() => setConfirming(true)}>
                    Review and send
                  </ActionButton>
                )
              ) : (
                <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                  <p style={{ color: 'var(--app-dim)' }}>
                    {!account
                      ? 'Sign in with your university account to send this. You can still take it with you.'
                      : office
                        ? `${office.name} is reached directly, not through Semester. Take this with you.`
                        : 'Your school has not connected an office for this yet. Take this with you to office hours or an email.'}
                  </p>
                  <ActionButton
                    disabled={!!sendable(draft)}
                    onClick={() => void navigator.clipboard.writeText(asNote(draft, office?.kind ?? need.kinds[0] ?? null)).catch(() => {})}
                  >
                    Copy as a note
                  </ActionButton>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* One optional question, off unless VITE_ME_MOMENT_FEEDBACK is set; see lib/momentfeedback.ts. */}
      {justSent && <MomentPromptSlot moment="support-routed" />}

      {requests.length > 0 && (
        <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <SectionLabel aside={`${requests.length}`}>Your requests</SectionLabel>
          {requests.map((r) => {
            const next = followUp(r.status, r.reply);
            return (
              <article key={r.id} className="portal-panel" style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                <strong>{nameOf(r.destinationId)} · {STATUS_TEXT[r.status]}</strong>
                {r.question && <p style={{ margin: 0 }}>{r.question}</p>}
                <p style={{ margin: 0, color: 'var(--app-dim)', fontSize: 'var(--type-sm)' }}>
                  {r.opens === 0 ? 'Not opened yet' : `Opened ${r.opens} ${r.opens === 1 ? 'time' : 'times'} by the office`}
                </p>
                {next && <p style={{ margin: 0 }}>{next}</p>}
                {WITHDRAWABLE.has(r.status) && (
                  <ActionButton
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void withdrawHelp(r.id)
                        .then(refresh)
                        .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Could not withdraw.'))
                        .finally(() => setBusy(false));
                    }}
                  >
                    Withdraw and erase
                  </ActionButton>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
