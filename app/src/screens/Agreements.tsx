import { useCallback, useEffect, useState } from 'react';
import { useNow, useStore } from '../state/store';
import { Page } from '../components/Page';
import { Notice, SectionLabel } from '../components/ui';
import { Trouble } from '../components/Trouble';
import { CATEGORY_TEXT } from '../components/community/ReportSheet';
import { ReasonHint, REASON_MIN } from '../components/community/Escalation';
import { cloudConfigured } from '../lib/cloud';
import { COMMUNITY_FLAGS, enabled } from '../community/flags';
import {
  accountHash,
  activateAgreement,
  canManageAgreements,
  loadAgreements,
  retireAgreement,
  saveAgreement,
  type Agreement,
  type AgreementDraft,
  type AgreementEvent,
} from '../community/client';
import { formatDateTime } from '../lib/locale';

const CATEGORY = Object.fromEntries(CATEGORY_TEXT);
const BLURB = 'Which universities have agreed to receive escalations of serious safety cases, and on what terms.';

const day = (iso: string) =>
  formatDateTime(new Date(`${iso.slice(0, 10)}T12:00:00`), { year: 'numeric', month: 'short', day: 'numeric' });
const when = (iso: string) =>
  formatDateTime(new Date(iso), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** YYYY-MM-DD, local. */
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type AgreementState = 'active' | 'draft' | 'retired' | 'ended';

/** Where an agreement stands. Ended outranks everything: the server treats it as off. */
export function agreementState(a: Agreement, today: string): AgreementState {
  if (a.expiresOn && a.expiresOn < today) return 'ended';
  if (a.enabled) return 'active';
  return a.activatedAt === null && a.draftedAt !== null ? 'draft' : 'retired';
}

const STATE_TEXT: Record<AgreementState, string> = {
  active: 'Active',
  draft: 'Draft — waiting for a second person to activate it',
  retired: 'Retired',
  ended: 'Ended',
};

const EVENT_TEXT: Record<AgreementEvent['event'], string> = {
  drafted: 'Draft recorded',
  activated: 'Activated',
  retired: 'Retired',
};

/**
 * The escalation agreements, for senior Trust & Safety staff.
 *
 * An agreement is what lets a P0 or P1 case be sent to a university at all.
 * One person records it — or edits it, which always makes it a draft again —
 * and a different person activates it after reading it against the signed
 * copy; the database compares the two by hash and refuses otherwise, and this
 * screen says so rather than offering a button that will be refused. Retiring
 * takes one person, because switching off is always safe.
 *
 * It never switches a school's programme on: that is a deployment step, and
 * an active agreement at a school whose switch is off sends nothing.
 */
export function Agreements() {
  const { account } = useStore();
  if (!enabled(COMMUNITY_FLAGS, 'institutionEscalation')) {
    return (
      <Page blurb={BLURB}>
        <Notice>Institution escalation isn’t switched on in this build.</Notice>
      </Page>
    );
  }
  if (!cloudConfigured || !account) {
    return (
      <Page blurb={BLURB}>
        <Notice>Sign in with a Trust & Safety account to manage agreements.</Notice>
      </Page>
    );
  }
  return <Manager accountId={account.id} />;
}

function Manager({ accountId }: { accountId: string }) {
  const now = useNow();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [events, setEvents] = useState<AgreementEvent[]>([]);
  const [me, setMe] = useState('');
  const [editing, setEditing] = useState<Agreement | 'new' | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const ok = await canManageAgreements();
      setAllowed(ok);
      if (!ok) return;
      const [got, hash] = await Promise.all([loadAgreements(), accountHash(accountId)]);
      setSchools(got.schools);
      setAgreements(got.agreements);
      setEvents(got.events);
      setMe(hash);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the agreements.');
    }
  }, [accountId]);

  // An account-backed resource, not render-derived state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const done = async (said: string) => {
    setStatus(said);
    setEditing(null);
    await refresh();
  };

  if (allowed === false) {
    return (
      <Page blurb={BLURB}>
        <Notice>This account doesn’t hold the escalation-agreement role, so there is nothing to show.</Notice>
      </Page>
    );
  }

  const today = isoDay(now);
  const name = (id: string) => schools.find((s) => s.id === id)?.name ?? id;
  const without = schools.filter((s) => !agreements.some((a) => a.tenantId === s.id));

  return (
    <Page blurb={BLURB}>
      <Notice>
        One person records an agreement; a different person activates it after reading it against the signed copy. Any
        edit makes it a draft again. Activating an agreement doesn’t switch escalation on at a school — that is a
        deployment step — and nothing is sent to a school whose switch is off.
      </Notice>
      {status && <p role="status">{status}</p>}
      {error && <Trouble said={error} />}

      {editing ? (
        <AgreementForm
          initial={editing === 'new' ? null : editing}
          schools={editing === 'new' ? without : schools}
          today={today}
          onCancel={() => setEditing(null)}
          onSaved={() => done('Draft saved. A different person has to activate it before anything can be sent.')}
        />
      ) : (
        <div style={{ marginBlock: 'var(--sp-4)' }}>
          <button type="button" className="btn btn-primary" disabled={without.length === 0} onClick={() => setEditing('new')}>
            Record a new agreement
          </button>
        </div>
      )}

      <SectionLabel aside={`${agreements.length}`}>Agreements</SectionLabel>
      {agreements.length === 0 && <p style={{ color: 'var(--app-dim)' }}>No university has an agreement yet.</p>}
      {[...agreements]
        .sort((a, b) => name(a.tenantId).localeCompare(name(b.tenantId)))
        .map((a) => (
          <AgreementCard
            key={a.tenantId}
            agreement={a}
            school={name(a.tenantId)}
            state={agreementState(a, today)}
            mine={a.draftedBy === me}
            history={events.filter((e) => e.tenantId === a.tenantId).slice(0, 5)}
            onEdit={() => setEditing(a)}
            onDone={done}
          />
        ))}
    </Page>
  );
}

function AgreementCard({
  agreement: a,
  school,
  state,
  mine,
  history,
  onEdit,
  onDone,
}: {
  agreement: Agreement;
  school: string;
  state: AgreementState;
  mine: boolean;
  history: AgreementEvent[];
  onEdit: () => void;
  onDone: (said: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const act = (work: Promise<void>, said: string) => {
    setBusy(true);
    setError('');
    void work
      .then(() => onDone(said))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'That did not work.'))
      .finally(() => setBusy(false));
  };

  return (
    <article className="portal-panel" aria-label={`Agreement with ${school}`} style={{ display: 'grid', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
      <strong>{school}</strong>
      <span style={{ color: 'var(--app-dim)' }}>
        {STATE_TEXT[state]} · {a.agreementRef}
      </span>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: 'var(--sp-1) var(--sp-3)' }}>
        <dt>Receives</dt>
        <dd style={{ margin: 0 }}>{a.contact || '—'}</dd>
        <dt>Covers</dt>
        <dd style={{ margin: 0 }}>{a.categories.map((c) => CATEGORY[c] ?? c).join('; ')}</dd>
        <dt>Identity</dt>
        <dd style={{ margin: 0 }}>
          {a.identityRequired ? 'An opaque reference the school can resolve with Semester — never a name or email' : 'Nothing that identifies the author'}
        </dd>
        <dt>Channel</dt>
        <dd style={{ margin: 0 }}>{a.channel}</dd>
        <dt>Ends</dt>
        <dd style={{ margin: 0 }}>{a.expiresOn ? day(a.expiresOn) : 'No end date recorded'}</dd>
      </dl>

      {state === 'draft' &&
        (mine ? (
          <p style={{ margin: 0 }}>You recorded this version. A different person has to activate it.</p>
        ) : (
          <>
            <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
              What you checked against the signed copy
              <textarea className="input" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <ReasonHint reason={reason} keptWith="the agreement’s history" />
          </>
        ))}
      {state === 'active' && (
        <>
          <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            Why it is being retired
            <textarea className="input" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <ReasonHint reason={reason} keptWith="the agreement’s history" />
          <p style={{ margin: 0, color: 'var(--app-dim)' }}>
            Retiring stops new escalations and holds any not yet delivered. One person can do it.
          </p>
        </>
      )}
      {state === 'ended' && <p style={{ margin: 0 }}>This agreement has ended, so nothing is sent under it. Record a new one to continue.</p>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        {state === 'draft' && !mine && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || reason.trim().length < REASON_MIN}
            onClick={() => act(activateAgreement(a.tenantId, reason.trim()), `The agreement with ${school} is active.`)}
          >
            Activate
          </button>
        )}
        {state === 'active' && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || reason.trim().length < REASON_MIN}
            onClick={() => act(retireAgreement(a.tenantId, reason.trim()), `The agreement with ${school} is retired.`)}
          >
            Retire
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onEdit}>
          {state === 'ended' || state === 'retired' ? 'Record a new version' : 'Edit'}
        </button>
      </div>
      {state === 'active' && (
        <p style={{ margin: 0, color: 'var(--app-dim)' }}>Editing makes it a draft, which stops escalations until someone else activates it.</p>
      )}

      {history.length > 0 && (
        <details>
          <summary>History</summary>
          <ul style={{ margin: 0 }}>
            {history.map((e, i) => (
              <li key={i}>
                {EVENT_TEXT[e.event]} {when(e.occurredAt)} · {e.agreementRef}
                {e.reason ? ` — “${e.reason}”` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
      {error && <Trouble said={error} />}
    </article>
  );
}

const CHANNEL_NAME = /^[a-z0-9_]{1,40}$/;

function AgreementForm({
  initial,
  schools,
  today,
  onCancel,
  onSaved,
}: {
  initial: Agreement | null;
  schools: { id: string; name: string }[];
  today: string;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const plus = (days: number) => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + days);
    return isoDay(d);
  };
  const [draft, setDraft] = useState<AgreementDraft>({
    tenantId: initial?.tenantId ?? schools[0]?.id ?? '',
    agreementRef: initial?.agreementRef ?? '',
    categories: initial?.categories ?? [],
    identityRequired: initial?.identityRequired ?? false,
    channel: initial?.channel ?? '',
    contact: initial?.contact ?? '',
    expiresOn: initial?.expiresOn && initial.expiresOn > today ? initial.expiresOn : plus(365),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const channelName = draft.channel.replace(/^webhook:/, '');
  const set = (patch: Partial<AgreementDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const problems = [
    !draft.tenantId && 'Choose the university.',
    draft.agreementRef.trim().length < 3 && 'Name the signed agreement.',
    draft.contact.trim().length < 3 && 'Name the office at the school that receives escalations.',
    draft.categories.length === 0 && 'Choose at least one kind of case it covers.',
    !CHANNEL_NAME.test(channelName) && 'The channel name is lowercase letters, digits and underscores.',
    !(draft.expiresOn > today && draft.expiresOn <= plus(1096)) && 'It ends between tomorrow and three years from now.',
  ].filter(Boolean) as string[];

  return (
    <form
      aria-label={initial ? 'Edit the agreement' : 'Record a new agreement'}
      className="portal-panel"
      style={{ display: 'grid', gap: 'var(--sp-3)', marginBlock: 'var(--sp-4)' }}
      onSubmit={(e) => {
        e.preventDefault();
        if (problems.length) return;
        setBusy(true);
        setError('');
        void saveAgreement({ ...draft, agreementRef: draft.agreementRef.trim(), contact: draft.contact.trim(), channel: `webhook:${channelName}` })
          .then(onSaved)
          .catch((err: unknown) => setError(err instanceof Error ? err.message : 'The agreement was not saved.'))
          .finally(() => setBusy(false));
      }}
    >
      <strong>{initial ? 'Edit the agreement' : 'Record a new agreement'}</strong>
      {initial?.enabled && (
        <p style={{ margin: 0 }}>Saving makes this a draft again. Escalations to this school stop until a different person activates it.</p>
      )}
      <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        University
        <select className="input" value={draft.tenantId} disabled={Boolean(initial)} onChange={(e) => set({ tenantId: e.target.value })}>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        Signed agreement reference
        <input className="input" maxLength={200} value={draft.agreementRef} onChange={(e) => set({ agreementRef: e.target.value })} />
      </label>
      <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        Office that receives escalations
        <input className="input" maxLength={200} placeholder="e.g. Dean of Students office" value={draft.contact} onChange={(e) => set({ contact: e.target.value })} />
      </label>
      <fieldset style={{ display: 'grid', gap: 'var(--sp-2)', border: 0, padding: 0, margin: 0 }}>
        <legend style={{ marginBottom: 'var(--sp-2)' }}>Kinds of case it covers</legend>
        {CATEGORY_TEXT.map(([value, text]) => (
          <label key={value} style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={draft.categories.includes(value)}
              onChange={(e) =>
                set({ categories: e.target.checked ? [...draft.categories, value] : draft.categories.filter((c) => c !== value) })
              }
            />
            {text}
          </label>
        ))}
        <span style={{ color: 'var(--app-dim)' }}>Only P0 and P1 cases in these categories can ever be escalated.</span>
      </fieldset>
      <label style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
        <input type="checkbox" checked={draft.identityRequired} onChange={(e) => set({ identityRequired: e.target.checked })} />
        The agreement requires an identity reference
      </label>
      {draft.identityRequired && (
        <p style={{ margin: 0, color: 'var(--app-dim)' }}>
          Each escalation will carry an opaque reference the school can resolve only by asking Semester — never a name, an
          email or an account id. Tick this only if the signed agreement says so.
        </p>
      )}
      <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        Delivery channel name
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <span aria-hidden="true">webhook:</span>
          <input className="input" maxLength={40} value={channelName} onChange={(e) => set({ channel: `webhook:${e.target.value}` })} />
        </span>
      </label>
      <p style={{ margin: 0, color: 'var(--app-dim)' }}>
        A name, not an address. The address and signing key for it are set on the delivery function by whoever deploys it,
        so nothing typed here can send a case anywhere new.
      </p>
      <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        Ends on
        <input className="input" type="date" min={plus(1)} max={plus(1096)} value={draft.expiresOn} onChange={(e) => set({ expiresOn: e.target.value })} />
      </label>
      {/* What is still missing, said politely as it changes — guidance, not an alarm. Always
          present, so the region exists before its content changes. */}
      <ul role="status" id="agreement-still-needed" style={{ margin: 0, color: 'var(--app-dim)' }}>
        {problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <button className="btn btn-primary" aria-describedby="agreement-still-needed" disabled={busy || problems.length > 0}>
          Save as a draft
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && <Trouble said={error} />}
    </form>
  );
}
