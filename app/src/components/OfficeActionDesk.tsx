import { useEffect, useState } from 'react';
import {
  ACTION_TYPES,
  ELIGIBILITY,
  STATUS_TEXT,
  completionLine,
  deskSteps,
  draftProblems,
  type DeskStep,
  type Draft,
  type OfficeActionType,
} from '../lib/office-actions';
import { deskActions, moveAction, myPublishScopes, saveDraft, type DeskRow, type PublishScope } from '../lib/office-actions-remote';
import { ConfirmDialog } from './ConfirmDialog';

const STEP_TEXT: Record<DeskStep, string> = {
  submit: 'Submit for review',
  approve: 'Approve and publish…',
  return: 'Return with a note',
  withdraw: 'Withdraw…',
};

const blank = (s: PublishScope | undefined): Draft => ({
  office: s?.office ?? '',
  scopeKind: s?.scopeKind ?? 'school',
  scopeId: s?.scopeId ?? '',
  type: s?.resourceOnly ? 'resource' : 'deadline',
  audience: 'tenant',
  target: '',
  title: '',
  why: '',
  due: '',
  url: '',
  source: '',
});

type Confirm = { kind: 'draft' } | { kind: 'step'; row: DeskRow; step: 'approve' | 'withdraw' };

/**
 * The office desk (`office_action_feed`, Phase J): the publish workflow's
 * scaffold. Renders nothing unless the database says this account may publish
 * for an office (`my_action_publish_scopes`); the browser never decides that
 * from a role name.
 *
 * Draft → submit → a colleague approves or returns it with a note →
 * published → withdrawn. Nobody approves their own. Every rule is the
 * database's; this form only says what it would refuse before it is asked.
 * What an office sees about students is one line: a count once ten or more
 * have marked an action done, and otherwise that there is no count.
 */
export function OfficeActionDesk({ signedIn }: { signedIn: boolean }) {
  const [scopes, setScopes] = useState<PublishScope[] | null>(null);
  const [rows, setRows] = useState<DeskRow[]>([]);
  const [draft, setDraft] = useState<Draft>(blank(undefined));
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [returning, setReturning] = useState<{ id: string; note: string } | null>(null);
  const [said, setSaid] = useState('');
  const [failed, setFailed] = useState('');

  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    myPublishScopes()
      .then(async (found) => {
        if (!live) return;
        setScopes(found);
        if (!found.length) return;
        const listed = await deskActions();
        if (!live) return;
        setRows(listed);
        setDraft((d) => (d.office ? d : blank(found[0])));
      })
      .catch(() => live && setScopes([]));
    return () => {
      live = false;
    };
  }, [signedIn, round]);

  if (!signedIn || !scopes?.length) return null;

  const scope = scopes.find((s) => s.office === draft.office && s.scopeId === draft.scopeId) ?? scopes[0];
  const problems = draftProblems(draft, scope.resourceOnly);
  const tenant = scope.scopeId.split('/')[0];
  const types: readonly OfficeActionType[] = scope.resourceOnly ? ['resource', 'event'] : ACTION_TYPES;

  const run = async (what: () => Promise<unknown>, ok: string) => {
    setFailed('');
    try {
      await what();
      setSaid(ok);
      setRound((r) => r + 1);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e));
    }
  };

  const field = (label: string, input: React.ReactNode) => (
    <label className="office-field">
      <span>{label}</span>
      {input}
    </label>
  );

  return (
    <section className="portal-panel office-desk" aria-label="Publish for your office">
      <h3>Publish for your office</h3>
      <p className="portal-muted">
        Shown because your account can publish for an office. A draft reaches no student until a colleague in the same
        office approves it. You never see who an action reached, or who did it — only a count, once ten or more students
        mark it done.
      </p>
      {said ? <p role="status" className="balance-said">{said}</p> : null}
      {failed ? <p role="alert">{failed}</p> : null}

      <form
        className="office-form"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!problems.length) setConfirm({ kind: 'draft' });
        }}
      >
        {field('Office and scope', <select aria-label="Office and scope"
            value={`${scope.office}|${scope.scopeKind}|${scope.scopeId}`}
            onChange={(ev) => {
              const [office, scopeKind, scopeId] = ev.target.value.split('|');
              const next = scopes.find((s) => s.office === office && s.scopeKind === scopeKind && s.scopeId === scopeId);
              setDraft({ ...draft, office, scopeKind, scopeId, type: next?.resourceOnly ? 'resource' : draft.type });
            }}
          >
            {scopes.map((s) => (
              <option key={`${s.office}|${s.scopeKind}|${s.scopeId}`} value={`${s.office}|${s.scopeKind}|${s.scopeId}`}>
                {s.label} · {s.scopeId}
                {s.resourceOnly ? ' (resources and events)' : ''}
              </option>
            ))}
          </select>)}
        {field('Kind', <select aria-label="Kind" value={draft.type} onChange={(ev) => setDraft({ ...draft, type: ev.target.value as OfficeActionType })}>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>)}
        {field('Who it is for', <select aria-label="Who it is for"
            value={draft.audience}
            onChange={(ev) => {
              const audience = ev.target.value as Draft['audience'];
              setDraft({ ...draft, audience, target: audience === 'cohort' || audience === 'program' ? `${tenant}/` : '' });
            }}
          >
            <option value="tenant">Every student at the school</option>
            <option value="cohort">A cohort</option>
            <option value="program">Students who chose a program</option>
            <option value="eligibility">Students who said something applies to them</option>
          </select>)}
        {draft.audience === 'eligibility'
          ? field('Eligibility', <select aria-label="Eligibility" value={draft.target} onChange={(ev) => setDraft({ ...draft, target: ev.target.value })}>
                <option value="">Choose…</option>
                {ELIGIBILITY.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.label}
                  </option>
                ))}
              </select>)
          : draft.audience !== 'tenant'
            ? field(draft.audience === 'cohort' ? 'Cohort' : 'Program',
                <input aria-label={draft.audience === 'cohort' ? 'Cohort' : 'Program'} value={draft.target} onChange={(ev) => setDraft({ ...draft, target: ev.target.value })} placeholder={`${tenant}/…`} />)
            : null}
        {field('Title', <input aria-label="Title" value={draft.title} maxLength={200} onChange={(ev) => setDraft({ ...draft, title: ev.target.value })} />)}
        {field('Why it matters', <textarea aria-label="Why it matters" value={draft.why} maxLength={1000} onChange={(ev) => setDraft({ ...draft, why: ev.target.value })} />)}
        {field('Due date (optional)', <input aria-label="Due date (optional)" type="date" value={draft.due} onChange={(ev) => setDraft({ ...draft, due: ev.target.value })} />)}
        {field('Official page', <input aria-label="Official page" type="url" value={draft.url} placeholder="https://" onChange={(ev) => setDraft({ ...draft, url: ev.target.value })} />)}
        {field('Source', <input aria-label="Source" value={draft.source} maxLength={300} placeholder="e.g. Financial Aid verification policy" onChange={(ev) => setDraft({ ...draft, source: ev.target.value })} />)}
        {problems.length ? (
          <ul className="office-problems" aria-label="Before this can be saved">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
        <button type="submit" className="balance-button" disabled={problems.length > 0}>
          Save draft…
        </button>
      </form>

      {rows.length ? (
        <ul className="office-list">
          {rows.map((r) => (
            <li key={r.id} className="office-card" data-status={r.status}>
              <p className="office-from">
                {STATUS_TEXT[r.status]}
                {r.mine ? ' · yours' : ''}
              </p>
              <p className="office-title">
                <strong>{r.title}</strong>
              </p>
              <p className="portal-muted">
                {r.audience === 'tenant' ? 'Every student at the school' : `${r.audience}: ${r.target ?? ''}`}
              </p>
              {r.reviewNote && r.status === 'draft' ? <p>Returned: {r.reviewNote}</p> : null}
              {r.status === 'published' ? <p>{completionLine(r.completed)}</p> : null}
              {returning?.id === r.id ? (
                <div>
                  <label className="office-field">
                    <span>What needs changing</span>
                    <textarea value={returning.note} onChange={(ev) => setReturning({ id: r.id, note: ev.target.value })} />
                  </label>
                  <button
                    type="button"
                    className="balance-button"
                    disabled={!returning.note.trim()}
                    onClick={() => {
                      const note = returning.note;
                      setReturning(null);
                      void run(() => moveAction(r.id, 'return', note), 'Returned to its author.');
                    }}
                  >
                    Return
                  </button>{' '}
                  <button type="button" className="balance-button" onClick={() => setReturning(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="office-buttons">
                  {deskSteps(r.status, r.mine).map((step) => (
                    <button
                      key={step}
                      type="button"
                      className="balance-button"
                      onClick={() => {
                        if (step === 'approve' || step === 'withdraw') setConfirm({ kind: 'step', row: r, step });
                        else if (step === 'return') setReturning({ id: r.id, note: '' });
                        else void run(() => moveAction(r.id, step), 'Submitted for review.');
                      }}
                    >
                      {STEP_TEXT[step]}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="portal-muted">Nothing drafted or published yet.</p>
      )}

      {confirm?.kind === 'draft' ? (
        <ConfirmDialog
          title="Save this draft?"
          preview={
            <>
              <p>
                <strong>{draft.title}</strong>
              </p>
              <p>{draft.why}</p>
              {draft.due ? <p>Due {draft.due}</p> : null}
              <p className="dialog-url">{draft.url}</p>
              <p>Institution verified · {scope.label} · {draft.source}</p>
              <p>No student sees a draft. Submit it, and a colleague in your office approves it before it is published.</p>
            </>
          }
          confirmLabel="Save draft"
          onConfirm={() => {
            setConfirm(null);
            const d = draft;
            void run(async () => {
              await saveDraft(d);
              setDraft(blank(scope));
            }, 'Draft saved.');
          }}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {confirm?.kind === 'step' ? (
        <ConfirmDialog
          title={confirm.step === 'approve' ? 'Publish this to students?' : 'Withdraw this?'}
          preview={
            <>
              <p>
                <strong>{confirm.row.title}</strong>
              </p>
              <p>{confirm.row.why}</p>
              <p className="dialog-url">{confirm.row.url}</p>
              <p>
                {confirm.step === 'approve'
                  ? 'Every student it reaches sees it on Today and Key dates, labelled Institution verified.'
                  : 'It leaves every student’s feed. It stays here as your office’s record.'}
              </p>
            </>
          }
          confirmLabel={confirm.step === 'approve' ? 'Publish' : 'Withdraw'}
          onConfirm={() => {
            const { row, step } = confirm;
            setConfirm(null);
            void run(() => moveAction(row.id, step), step === 'approve' ? 'Published.' : 'Withdrawn.');
          }}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </section>
  );
}
