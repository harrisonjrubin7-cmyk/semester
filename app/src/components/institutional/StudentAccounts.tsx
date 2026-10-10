/**
 * Student accounts, for a school's bursar and business office, on the tables
 * in `20260929220000_student_accounts.sql`.
 *
 * A student's account is found by the school's identifier: its balance, how
 * old that balance is, whether a financial hold applies, every entry, a
 * month's statement, a receipt for each payment, and a payment-plan schedule.
 * Nothing on it is edited. A charge, payment, refund, adjustment, reversal,
 * aid credit or chargeback is requested, and enters the account only when
 * someone else approves it; the queue says before anyone presses which
 * requests need a high-value approver and which the viewer is barred from.
 * A month is reconciled against the payment provider's settlement file —
 * read here, in the browser, with only its counts and fingerprint recorded —
 * and then closed by someone other than the person who reconciled it.
 *
 * No money moves on this screen and no card is asked for. Payments are made
 * through the school's hosted provider and recorded by its reference.
 */
import { useCallback, useEffect, useState } from 'react';
import { cloud } from '../../lib/cloud';
import { download } from '../../lib/deliver';
import { secondLine } from '../../lib/dim';
import {
  AID_CATEGORIES, CATEGORIES, DEFAULT_SETTINGS, KINDS, KIND_LABEL, PROVIDER_KINDS, REFERENCING_KINDS, STUDENT_REF,
  aging, balance, barredApprovers, holdStatus, livePlan, money, needsHighApproval, parseCents, parseSettlement, periodOf, planStanding,
  proposalProblems, receipt, reconcileProvider, statement, statementCsv,
  type AccountCategory, type AccountEntry, type AccountKind, type AccountRequest, type FinanceSettings, type PaymentPlanRecord, type Proposal,
} from '../../lib/finance/accounts';
import { financeApi, type FinanceApi, type Reconciliation } from '../../lib/finance/api';
import {
  FinanceCommandError, forgetPendingFinanceCommand, newFinanceCommandKey, pendingFinanceCommand, pendingFinanceCommands, rememberPendingFinanceCommand,
  type FinanceCommandReceipt, type FinanceCommandUiState,
} from '../../lib/finance/commands';
import { parseTable, sha256 } from '../../lib/migration/center';
import { ActionButton, EmptyState, FilePick, Notice, SectionLabel } from '../ui';

export interface StudentAccountsProps {
  tenantId: string;
  viewerId: string | null;
  request: boolean;
  approve: boolean;
  approveHigh: boolean;
  close: boolean;
  read: boolean;
  api?: FinanceApi;
  /** Injected in tests; today, as YYYY-MM-DD. */
  today?: string;
}

const quiet = { fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' } as const;
const body = { fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)' } as const;
const grid = { display: 'grid', gap: 'var(--sp-4)', marginBlock: 'var(--sp-4)' } as const;
const label = { display: 'grid', gap: 'var(--sp-2)', fontSize: 'var(--type-sm)' } as const;
const h3 = { ...body, fontWeight: 600, marginTop: 'var(--sp-5)' } as const;
const cell = { textAlign: 'left', padding: 'var(--sp-2)', borderTop: '1px solid var(--app-line)', fontSize: 'var(--type-sm)', verticalAlign: 'top' } as const;
const num = { ...cell, textAlign: 'right', whiteSpace: 'nowrap' } as const;
const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function StudentAccounts(props: StudentAccountsProps) {
  const { tenantId, api, read, approve, close } = props;
  const [client, setClient] = useState<FinanceApi | null>(api ?? null);
  const [message, setMessage] = useState('');
  const [ref, setRef] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [pending, setPending] = useState<AccountRequest[]>([]);
  const [plansPending, setPlansPending] = useState<PaymentPlanRecord[]>([]);
  const [settings, setSettings] = useState<FinanceSettings>(DEFAULT_SETTINGS);
  const [closed, setClosed] = useState<string[]>([]);
  const day = props.today ?? localToday();

  useEffect(() => {
    if (api) return;
    let live = true;
    void cloud().then((db) => {
      if (live) setClient(financeApi(db));
    }, () => {
      if (live) setMessage('Student accounts need a connection to your school’s Semester project.');
    });
    return () => {
      live = false;
    };
  }, [api]);

  const fetchShared = useCallback(() => {
    if (!client) return Promise.resolve(null);
    return Promise.all([
      read || approve ? client.pending(tenantId) : Promise.resolve([] as AccountRequest[]),
      client.settings(tenantId).catch(() => DEFAULT_SETTINGS),
      client.closed(tenantId).catch(() => [] as string[]),
      read || approve ? client.plansWaiting(tenantId) : Promise.resolve([] as PaymentPlanRecord[]),
    ]);
  }, [client, tenantId, read, approve]);
  const refresh = () => void fetchShared().then((r) => {
    if (!r) return;
    setPending(r[0]);
    setSettings(r[1]);
    setClosed(r[2]);
    setPlansPending(r[3]);
  }, (e: unknown) => setMessage(errorText(e, 'Could not load the requests waiting.')));

  useEffect(() => {
    let live = true;
    fetchShared().then((r) => {
      if (!live || !r) return;
      setPending(r[0]);
      setSettings(r[1]);
      setClosed(r[2]);
      setPlansPending(r[3]);
    }, (e: unknown) => {
      if (live) setMessage(errorText(e, 'Could not load the requests waiting.'));
    });
    return () => {
      live = false;
    };
  }, [fetchShared]);

  if (!client) return message ? <Notice alert>{message}</Notice> : <p role="status" style={body}>Loading…</p>;

  return (
    <section aria-label="Student accounts">
      <SectionLabel>Student accounts</SectionLabel>
      <p style={{ ...quiet, marginBottom: 'var(--sp-4)' }}>
        Your school’s record of what each student owes and has paid. Nothing here is edited: a charge, payment, refund,
        adjustment, reversal, scholarship or chargeback is requested, and enters the account when someone else approves it.
        No money moves here and no card is asked for — payments go through your school’s payment provider and are recorded
        by its reference.
      </p>
      {message && <Notice alert>{message}</Notice>}

      <form
        aria-label="Find a student’s account"
        style={grid}
        onSubmit={(e) => {
          e.preventDefault();
          if (STUDENT_REF.test(ref.trim())) setOpen(ref.trim());
        }}
      >
        <label style={label}>
          Student identifier, as your student information system has it
          <input className="input" value={ref} placeholder="S0012345" onChange={(e) => setRef(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-secondary btn-block" disabled={!STUDENT_REF.test(ref.trim())}>Open the account</button>
      </form>

      {open && <Account key={open} {...props} api={client} studentRef={open} day={day} settings={settings} closed={closed} onRequested={refresh} />}
      {(read || approve) && <Queue {...props} api={client} pending={pending} settings={settings} onDecided={refresh} />}
      {(read || approve) && <PlanQueue api={client} plans={plansPending} viewerId={props.viewerId} approve={approve} onDecided={refresh} />}
      {close && <MonthClose tenantId={tenantId} api={client} viewerId={props.viewerId} closed={closed} day={day} onClosed={refresh} />}
    </section>
  );
}

// ── One student's account ───────────────────────────────────────────────────

function Account({
  tenantId, studentRef, api, day, settings, closed, viewerId, request, read, approve, onRequested,
}: StudentAccountsProps & { api: FinanceApi; studentRef: string; day: string; settings: FinanceSettings; closed: string[]; onRequested: () => void }) {
  const [entries, setEntries] = useState<AccountEntry[]>([]);
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [plans, setPlans] = useState<PaymentPlanRecord[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [note, setNote] = useState('');
  const [command, setCommand] = useState<{ state: FinanceCommandUiState; key: string; request: Pick<AccountRequest, 'id' | 'tenant_id' | 'student_ref'>; text: string } | null>(null);
  const [period, setPeriod] = useState(periodOf(day));

  const fetch = useCallback(
    () => Promise.all([api.lookup(tenantId, studentRef), read ? api.plans(tenantId, studentRef) : Promise.resolve([] as PaymentPlanRecord[])])
      .then(([r, p]) => ({ ...r, plans: p })),
    [api, tenantId, studentRef, read],
  );
  const reload = () => fetch().then((r) => {
    setEntries(r.entries);
    setRequests(r.requests);
    setPlans(r.plans);
  });
  useEffect(() => {
    let live = true;
    fetch().then((r) => {
      if (!live) return;
      setEntries(r.entries);
      setRequests(r.requests);
      setPlans(r.plans);
      setState('ready');
    }, (e: unknown) => {
      if (!live) return;
      setNote(errorText(e, 'Could not load the account.'));
      setState('error');
    });
    return () => {
      live = false;
    };
  }, [fetch]);
  useEffect(() => {
    if (command) return;
    const saved = pendingFinanceCommands().find((candidate) => candidate.tenantId === tenantId && candidate.studentRef === studentRef && candidate.action === 'request.withdraw');
    if (!saved) return;
    setCommand({ state: 'unknown', key: saved.key, request: { id: saved.resourceId, tenant_id: tenantId, student_ref: studentRef }, text: 'Unknown — a previous withdrawal has no confirmed response. Check for its accepted receipt before trying again.' });
  }, [command, studentRef, tenantId]);

  if (state === 'loading') return <p role="status" style={body}>Loading the account…</p>;
  if (state === 'error') return <Notice alert>{note}</Notice>;

  const mine = requests.filter((r) => r.status === 'proposed' && r.requested_by === viewerId);
  const owed = balance(entries);
  const age = aging(entries, day);
  const live = livePlan(plans);
  const standing = live && live.status === 'approved' ? planStanding(live, entries, day) : null;
  const hold = holdStatus(entries, day, settings, standing);
  const st = statement(entries, studentRef, period);

  return (
    <section aria-label={`Account of ${studentRef}`}>
      <h3 style={h3}>Account of {studentRef}</h3>
      {!read ? (
        <p style={quiet}>Your account makes requests on this account; it does not read the account itself.</p>
      ) : (
        <>
          <p style={body}>
            Balance {owed >= 0 ? 'owed' : 'in credit'}: <strong>{money(Math.abs(owed))}</strong>
          </p>
          <p role="status" style={quiet}>{hold.held ? `${hold.line}. ${money(hold.overdue_cents)} is more than ${settings.hold_after_days} days overdue.` : hold.line}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBlock: 'var(--sp-3)' }} aria-label="Balance by age">
            <thead>
              <tr>
                <th style={cell}>Current</th><th style={cell}>31–60 days</th><th style={cell}>61–90 days</th><th style={cell}>Over 90</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={num}>{money(age.current)}</td><td style={num}>{money(age.d31_60)}</td><td style={num}>{money(age.d61_90)}</td><td style={num}>{money(age.over90)}</td>
              </tr>
            </tbody>
          </table>

          {entries.length === 0 ? (
            <EmptyState inline title="Nothing on this account" body="No entry has been approved for this student." />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-label="Entries">
              <thead>
                <tr><th style={cell}>Date</th><th style={cell}>What</th><th style={cell}>Reference</th><th style={{ ...cell, textAlign: 'right' }}>Amount</th><th style={cell}><span className="sr-only">Receipt</span></th></tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>{e.effective_on}</td>
                    <td style={cell}>{KIND_LABEL[e.kind]}: {e.description}{e.high_value ? ' (high-value approval)' : ''}</td>
                    <td style={cell}>{e.provider_ref || '—'}</td>
                    <td style={num}>{money(e.amount_cents)}</td>
                    <td style={cell}>
                      {e.kind === 'payment' && (
                        <button type="button" className="bare tappable" onClick={() => download({ name: `receipt-${e.provider_ref}.txt`, body: receipt(e).join('\n') + '\n', mime: 'text/plain' })}>
                          Receipt
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={grid}>
            <label style={label}>
              Statement for
              <input className="input" type="month" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} />
            </label>
            <p style={quiet}>
              {st.number}: brought forward {money(st.opening_cents)}, {st.lines.length} {st.lines.length === 1 ? 'entry' : 'entries'}, carried forward {money(st.closing_cents)}.
            </p>
            <ActionButton onClick={() => download({ name: `${st.number}.csv`, body: statementCsv(st), mime: 'text/csv' })}>Download the statement</ActionButton>
          </div>

          <StaffPlan plans={plans} standing={standing} approve={approve} api={api} onChanged={() => void reload()} />
        </>
      )}

      {mine.length > 0 && (
        <>
          <h3 style={h3}>Your requests waiting for a decision</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {mine.map((r) => (
              <li key={r.id} style={{ borderTop: '1px solid var(--app-line)', paddingBlock: 'var(--sp-3)' }}>
                <span style={{ ...body, display: 'block' }}>{summary(r)}</span>
                <button type="button" className="bare tappable" onClick={() => {
                  const key = newFinanceCommandKey('request.withdraw');
                  rememberPendingFinanceCommand(tenantId, studentRef, 'request.withdraw', key, r.id);
                  setCommand({ state: 'pending', key, request: r, text: 'Pending — waiting for a withdrawal receipt.' });
                  api.withdraw(tenantId, studentRef, r.id, 1, key).then(() => reload()).then(() => {
                    forgetPendingFinanceCommand(tenantId, studentRef, 'request.withdraw', r.id);
                    setCommand({ state: 'accepted', key, request: r, text: 'Accepted — the request was withdrawn.' });
                    onRequested();
                  }, (e: unknown) => {
                    const state = e instanceof FinanceCommandError ? e.kind : 'unknown';
                    if (state !== 'unknown') forgetPendingFinanceCommand(tenantId, studentRef, 'request.withdraw', r.id);
                    setCommand({ state, key, request: r, text: state === 'unknown'
                      ? 'Unknown — check for the accepted withdrawal receipt before trying again.'
                      : `${state === 'conflict' ? 'Conflict' : 'Denied'} — ${errorText(e, 'Could not withdraw.')}` });
                  });
                }} disabled={command?.state === 'unknown' || command?.state === 'pending'}>
                  Withdraw
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {command && (
        <div>
          <Notice alert={command.state !== 'accepted' && command.state !== 'pending'}>{command.text}</Notice>
          {command.state === 'unknown' && (
            <button type="button" className="btn" onClick={() => api.receipt(tenantId, studentRef, 'request.withdraw', command.key).then(() => reload()).then(() => {
              forgetPendingFinanceCommand(tenantId, studentRef, 'request.withdraw', command.request.id);
              setCommand({ ...command, state: 'accepted', text: 'Accepted — recovered the withdrawal receipt.' });
              onRequested();
            }, (e: unknown) => {
              const state = e instanceof FinanceCommandError ? e.kind : 'unknown';
              if (state !== 'unknown') forgetPendingFinanceCommand(tenantId, studentRef, 'request.withdraw', command.request.id);
              setCommand({ ...command, state, text: state === 'denied'
                ? 'Denied — no accepted receipt was available. Review the request before trying again.'
                : state === 'conflict' ? `Conflict — ${errorText(e, 'The command key conflicts.')}` : 'Unknown — receipt recovery still has no answer. Do not try again yet.' });
            })}>Check for accepted receipt</button>
          )}
        </div>
      )}
      {note && <Notice alert>{note}</Notice>}
      {request && (
        <RequestForm
          tenantId={tenantId}
          studentRef={studentRef}
          entries={entries}
          closed={closed}
          settings={settings}
          day={day}
          onRequest={(p, commandKey) => api.request(tenantId, p, commandKey).then((receipt) => reload().then(() => receipt)).then((receipt) => {
            setNote('');
            onRequested();
            return receipt;
          })}
          onRecover={(commandKey) => api.receipt(tenantId, studentRef, 'request.create', commandKey)}
        />
      )}
    </section>
  );
}

function StaffPlan({ plans, standing, approve, api, onChanged }: {
  plans: readonly PaymentPlanRecord[]; standing: ReturnType<typeof planStanding> | null; approve: boolean; api: FinanceApi; onChanged: () => void;
}) {
  const [why, setWhy] = useState('');
  const [note, setNote] = useState('');
  const live = livePlan(plans);
  if (!live) {
    return (
      <section aria-label="Payment plan" style={{ marginTop: 'var(--sp-4)' }}>
        <h3 style={h3}>Payment plan</h3>
        <p style={quiet}>No plan. A student asks for one from Bill, by your school’s plan rules; it waits below for someone to decide it.</p>
      </section>
    );
  }
  return (
    <section aria-label="Payment plan" style={{ marginTop: 'var(--sp-4)' }}>
      <h3 style={h3}>Payment plan</h3>
      <p role="status" style={body}>
        {live.status === 'proposed'
          ? `Asked for on ${live.requested_at.slice(0, 10)}: ${money(live.balance_cents)} over ${live.installments} payments, waiting for a decision.`
          : standing?.state === 'complete' ? `Agreed for ${money(live.balance_cents)}, and paid in full.`
            : standing?.state === 'behind' ? `Agreed for ${money(live.balance_cents)}, and ${money(standing.behind_cents)} behind. The hold rule applies again.`
              : `Agreed for ${money(live.balance_cents)}, and being kept: no financial hold while it is.`}
      </p>
      <ol style={{ ...quiet, paddingLeft: 'var(--sp-6)' }} aria-label="Plan schedule">
        {live.schedule.map((p, i) => (
          <li key={i}>{p.due_on}: {money(p.cents)}{standing ? ` — ${standing.rows[i]?.state ?? 'upcoming'}` : ''}</li>
        ))}
      </ol>
      {live.status === 'approved' && approve && (
        <form
          aria-label="Cancel the plan"
          style={grid}
          onSubmit={(e) => {
            e.preventDefault();
            api.cancelPlan(live.id, why).then(() => {
              setNote('');
              setWhy('');
              onChanged();
            }, (err: unknown) => setNote(errorText(err, 'Could not cancel the plan.')));
          }}
        >
          <label style={label}>
            Why the plan is cancelled (the student reads this)
            <input className="input" value={why} onChange={(e) => setWhy(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-secondary btn-block" disabled={why.trim().length < 3}>Cancel the plan</button>
        </form>
      )}
      {note && <Notice alert>{note}</Notice>}
    </section>
  );
}

const summary = (r: AccountRequest) => `${r.student_ref} · ${KIND_LABEL[r.kind]} of ${money(r.amount_cents)}, ${r.description}, effective ${r.effective_on}`;

function RequestForm({
  tenantId, studentRef, entries, closed, settings, day, onRequest, onRecover,
}: {
  tenantId: string;
  studentRef: string;
  entries: readonly AccountEntry[];
  closed: readonly string[];
  settings: FinanceSettings;
  day: string;
  onRequest: (p: Proposal, commandKey: string) => Promise<FinanceCommandReceipt>;
  onRecover: (commandKey: string) => Promise<FinanceCommandReceipt>;
}) {
  const [kind, setKind] = useState<AccountKind>('charge');
  const [category, setCategory] = useState<AccountCategory>('tuition');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [providerRef, setProviderRef] = useState('');
  const [refId, setRefId] = useState('');
  const [on, setOn] = useState(day);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ state: FinanceCommandUiState; key: string; text: string } | null>(() => {
    const key = pendingFinanceCommand(tenantId, studentRef, 'request.create');
    return key ? { state: 'unknown', key, text: 'Unknown — a previous request has no confirmed response. Check for its accepted receipt before making another request.' } : null;
  });

  const cats = kind === 'aid_credit' ? AID_CATEGORIES : kind === 'reversal' ? CATEGORIES : CATEGORIES.filter((c) => !AID_CATEGORIES.includes(c));
  const choosable = kind === 'reversal' ? entries.filter((e) => e.kind !== 'reversal') : entries.filter((e) => e.kind === 'payment');
  const p: Proposal = {
    student_ref: studentRef, kind, category: cats.includes(category) ? category : cats[0], amount_cents: parseCents(amount) ?? 0,
    description, reference_entry_id: REFERENCING_KINDS.includes(kind) ? refId || null : null, provider_ref: PROVIDER_KINDS.includes(kind) ? providerRef : '', effective_on: on,
  };
  const problems = proposalProblems(p, entries, closed);
  const high = needsHighApproval(p, settings);

  return (
    <form
      aria-label="Make a request"
      style={grid}
      onSubmit={(e) => {
        e.preventDefault();
        if (problems.length) return;
        const commandKey = newFinanceCommandKey('request.create');
        rememberPendingFinanceCommand(tenantId, studentRef, 'request.create', commandKey);
        setBusy(true);
        setOutcome({ state: 'pending', key: commandKey, text: 'Pending — waiting for an accepted receipt.' });
        onRequest(p, commandKey).then((accepted) => {
          forgetPendingFinanceCommand(tenantId, studentRef, 'request.create');
          setAmount('');
          setDescription('');
          setProviderRef('');
          setRefId('');
          setOutcome({ state: 'accepted', key: commandKey, text: `Accepted — receipt ${accepted.id}.` });
        }, (err: unknown) => {
          const state = err instanceof FinanceCommandError ? err.kind : 'unknown';
          if (state !== 'unknown') forgetPendingFinanceCommand(tenantId, studentRef, 'request.create');
          setOutcome({ state, key: commandKey, text: state === 'unknown'
            ? 'Unknown — no answer came back. Check for the accepted receipt before making another request.'
            : `${state === 'conflict' ? 'Conflict' : 'Denied'} — ${errorText(err, 'The command was not accepted.')}` });
        }).finally(() => setBusy(false));
      }}
    >
      <h3 style={h3}>Make a request</h3>
      <label style={label}>
        Kind
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
          {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      </label>
      <label style={label}>
        Category
        <select className="input" value={p.category} onChange={(e) => setCategory(e.target.value as AccountCategory)}>
          {cats.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
        </select>
      </label>
      {REFERENCING_KINDS.includes(kind) && (
        <label style={label}>
          {kind === 'reversal' ? 'The entry to reverse' : 'The payment this answers'}
          <select className="input" value={refId} onChange={(e) => {
            setRefId(e.target.value);
            const hit = entries.find((x) => x.id === e.target.value);
            if (hit && kind === 'reversal') setAmount((Math.abs(hit.amount_cents) / 100).toFixed(2));
          }}>
            <option value="">Choose…</option>
            {choosable.map((e) => <option key={e.id} value={e.id}>{e.effective_on} · {KIND_LABEL[e.kind]} · {money(e.amount_cents)} · {e.description}</option>)}
          </select>
        </label>
      )}
      <label style={label}>
        Amount (dollars)
        <input className="input" inputMode="decimal" value={amount} placeholder="0.00" onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label style={label}>
        Description
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      {PROVIDER_KINDS.includes(kind) && (
        <label style={label}>
          Payment provider reference (never a card number)
          <input className="input" value={providerRef} placeholder="pi_3Nq8xLk2" onChange={(e) => setProviderRef(e.target.value)} />
        </label>
      )}
      <label style={label}>
        Effective
        <input className="input" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
      </label>
      {high && <p role="status" style={quiet}>At {money(p.amount_cents)} this needs a high-value approver.</p>}
      {(amount || description) && problems.length > 0 && (
        <ul style={{ ...quiet, paddingLeft: 'var(--sp-6)' }}>{problems.map((m) => <li key={m}>{m}</li>)}</ul>
      )}
      {outcome && (
        <div>
          <Notice alert={outcome.state !== 'accepted' && outcome.state !== 'pending'}>{outcome.text}</Notice>
          {outcome.state === 'unknown' && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setBusy(true);
                onRecover(outcome.key).then((accepted) => {
                  forgetPendingFinanceCommand(tenantId, studentRef, 'request.create');
                  setOutcome({ state: 'accepted', key: outcome.key, text: `Accepted — recovered receipt ${accepted.id}.` });
                }, (err: unknown) => {
                  const state = err instanceof FinanceCommandError ? err.kind : 'unknown';
                  if (state !== 'unknown') forgetPendingFinanceCommand(tenantId, studentRef, 'request.create');
                  setOutcome({ state, key: outcome.key, text: state === 'conflict'
                    ? `Conflict — ${errorText(err, 'The key belongs to another command.')}`
                    : state === 'denied'
                      ? 'Denied — no accepted receipt was available to this account. Review the request before resubmitting.'
                      : 'Unknown — receipt recovery still has no answer. Do not create a new command yet.' });
                }).finally(() => setBusy(false));
              }}
            >
              Check for accepted receipt
            </button>
          )}
        </div>
      )}
      <button type="submit" className="btn btn-primary btn-block" disabled={busy || problems.length > 0 || outcome?.state === 'unknown' || outcome?.state === 'pending'}>{busy ? 'Requesting…' : 'Request'}</button>
    </form>
  );
}

// ── The queue ───────────────────────────────────────────────────────────────

function Queue({
  api, pending, settings, tenantId, viewerId, approve, approveHigh, onDecided,
}: StudentAccountsProps & { api: FinanceApi; pending: readonly AccountRequest[]; settings: FinanceSettings; onDecided: () => void }) {
  const [busy, setBusy] = useState(false);
  const [command, setCommand] = useState<{ state: FinanceCommandUiState; key: string; request: Pick<AccountRequest, 'id' | 'tenant_id' | 'student_ref'>; action: 'request.approve' | 'request.reject'; text: string } | null>(null);
  // The entries a refund or reversal answers, to know who is barred from approving it.
  const [answered, setAnswered] = useState<AccountEntry[]>([]);
  const key = [...new Set(pending.filter((r) => r.reference_entry_id).map((r) => `${r.tenant_id}\u0000${r.student_ref}`))].join('|');
  useEffect(() => {
    let live = true;
    const pairs = key ? key.split('|').map((k) => k.split('\u0000')) : [];
    Promise.all(pairs.map(([t, s]) => api.lookup(t, s).then((r) => r.entries))).then((all) => {
      if (live) setAnswered(all.flat());
    }, () => undefined);
    return () => {
      live = false;
    };
  }, [api, key]);
  useEffect(() => {
    if (command) return;
    const saved = pendingFinanceCommands().find((candidate) => candidate.tenantId === tenantId
      && (candidate.action === 'request.approve' || candidate.action === 'request.reject'));
    if (!saved) return;
    const action = saved.action as 'request.approve' | 'request.reject';
    setCommand({
      state: 'unknown', key: saved.key, action,
      request: { id: saved.resourceId, tenant_id: saved.tenantId, student_ref: saved.studentRef },
      text: 'Unknown — a previous decision has no confirmed response. Check for its accepted receipt before deciding again.',
    });
  }, [command, tenantId]);

  const decide = (r: AccountRequest, status: 'approved' | 'rejected') => {
    const action = status === 'approved' ? 'request.approve' : 'request.reject';
    const key = newFinanceCommandKey(action);
    rememberPendingFinanceCommand(r.tenant_id, r.student_ref, action, key, r.id);
    setBusy(true);
    setCommand({ state: 'pending', key, request: r, action, text: 'Pending — waiting for a decision receipt.' });
    api.decide(r.tenant_id, r.student_ref, r.id, 1, status, '', key).then(() => {
      forgetPendingFinanceCommand(r.tenant_id, r.student_ref, action, r.id);
      setCommand({ state: 'accepted', key, request: r, action, text: `Accepted — the request was ${status}.` });
      onDecided();
    }, (e: unknown) => {
      const state = e instanceof FinanceCommandError ? e.kind : 'unknown';
      if (state !== 'unknown') forgetPendingFinanceCommand(r.tenant_id, r.student_ref, action, r.id);
      setCommand({ state, key, request: r, action, text: state === 'unknown'
        ? 'Unknown — check for the accepted decision receipt before trying again.'
        : `${state === 'conflict' ? 'Conflict' : 'Denied'} — ${errorText(e, 'Could not record the decision.')}` });
    }).finally(() => setBusy(false));
  };
  return (
    <section aria-label="Requests waiting for a decision" style={{ marginTop: 'var(--sp-6)' }}>
      <h3 style={h3}>Waiting for a decision</h3>
      {!approve && <p style={quiet}>Your account reads these; deciding them needs finance approval.</p>}
      {command && (
        <div>
          <Notice alert={command.state !== 'accepted' && command.state !== 'pending'}>{command.text}</Notice>
          {command.state === 'unknown' && (
            <button type="button" className="btn" onClick={() => {
              setBusy(true);
              api.receipt(command.request.tenant_id, command.request.student_ref, command.action, command.key).then(() => {
                forgetPendingFinanceCommand(command.request.tenant_id, command.request.student_ref, command.action, command.request.id);
                setCommand({ ...command, state: 'accepted', text: 'Accepted — recovered the decision receipt.' });
                onDecided();
              }, (e: unknown) => {
                const state = e instanceof FinanceCommandError ? e.kind : 'unknown';
                if (state !== 'unknown') forgetPendingFinanceCommand(command.request.tenant_id, command.request.student_ref, command.action, command.request.id);
                setCommand({ ...command, state, text: state === 'denied'
                  ? 'Denied — no accepted receipt was available. Refresh before deciding again.'
                  : state === 'conflict' ? `Conflict — ${errorText(e, 'The command key conflicts.')}` : 'Unknown — receipt recovery still has no answer. Do not decide again yet.' });
              }).finally(() => setBusy(false));
            }}>Check for accepted receipt</button>
          )}
        </div>
      )}
      {pending.length === 0 ? (
        <p style={quiet}>Nothing is waiting.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {pending.map((r) => {
            const own = r.requested_by !== null && r.requested_by === viewerId;
            const barred = viewerId !== null && barredApprovers(r, answered).includes(viewerId);
            const high = needsHighApproval(r, settings);
            const why = own ? 'You made this request, so someone else decides it.'
              : barred ? 'You put the payment or entry this answers on the ledger, so someone else decides it.'
              : high && !approveHigh ? 'This needs a high-value approver, which your account is not.' : '';
            return (
              <li key={r.id} style={{ borderTop: '1px solid var(--app-line)', paddingBlock: 'var(--sp-3)' }}>
                <span style={{ ...body, display: 'block' }}>{summary(r)}</span>
                {high && <span style={{ ...quiet, display: 'block' }}>High value</span>}
                {approve && (why ? (
                  <p style={quiet}>{why}</p>
                ) : (
                  <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-3)' }}>
                    <ActionButton tone="primary" disabled={busy || command?.state === 'unknown' || command?.state === 'pending'} onClick={() => decide(r, 'approved')}>Approve</ActionButton>
                    <ActionButton disabled={busy || command?.state === 'unknown' || command?.state === 'pending'} onClick={() => decide(r, 'rejected')}>Reject</ActionButton>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PlanQueue({ api, plans, viewerId, approve, onDecided }: {
  api: FinanceApi; plans: readonly PaymentPlanRecord[]; viewerId: string | null; approve: boolean; onDecided: () => void;
}) {
  const [note, setNote] = useState('');
  const [said, setSaid] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const act = (work: Promise<void>) => {
    setBusy(true);
    setNote('');
    work.then(onDecided, (e: unknown) => setNote(errorText(e, 'Could not record the decision.'))).finally(() => setBusy(false));
  };
  return (
    <section aria-label="Payment plans waiting for a decision" style={{ marginTop: 'var(--sp-6)' }}>
      <h3 style={h3}>Payment plans waiting</h3>
      <p style={quiet}>
        The balance and schedule were worked out by the database from the ledger when the plan was asked for. A plan is approved
        only while the balance is still that one and its first payment is not past; otherwise the student asks again.
      </p>
      {note && <Notice alert>{note}</Notice>}
      {plans.length === 0 ? (
        <p style={quiet}>No plan is waiting.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {plans.map((p) => {
            const own = p.requested_by !== null && p.requested_by === viewerId;
            return (
              <li key={p.id} style={{ borderTop: '1px solid var(--app-line)', paddingBlock: 'var(--sp-3)' }}>
                <span style={{ ...body, display: 'block' }}>
                  {p.student_ref} · {money(p.balance_cents)} over {p.installments} payments from {p.first_due}, asked on {p.requested_at.slice(0, 10)}
                </span>
                <span style={{ ...quiet, display: 'block' }}>{p.schedule.map((i) => `${i.due_on} ${money(i.cents)}`).join(' · ')}</span>
                {approve && (own ? (
                  <p style={quiet}>You asked for this plan, so someone else decides it.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 'var(--sp-3)', marginTop: 'var(--sp-3)' }}>
                    <label style={label}>
                      A note for the student (optional)
                      <input className="input" value={said[p.id] ?? ''} onChange={(e) => setSaid({ ...said, [p.id]: e.target.value })} />
                    </label>
                    <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
                      <ActionButton tone="primary" disabled={busy} onClick={() => act(api.decidePlan(p.id, 'approved', said[p.id] ?? ''))}>Agree to the plan</ActionButton>
                      <ActionButton disabled={busy} onClick={() => act(api.decidePlan(p.id, 'rejected', said[p.id] ?? ''))}>Decline</ActionButton>
                    </div>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── The monthly close ───────────────────────────────────────────────────────

function MonthClose({
  tenantId, api, viewerId, closed, day, onClosed,
}: { tenantId: string; api: FinanceApi; viewerId: string | null; closed: readonly string[]; day: string; onClosed: () => void }) {
  const [period, setPeriod] = useState(periodOf(day));
  const [recs, setRecs] = useState<Reconciliation[]>([]);
  const [ledger, setLedger] = useState<AccountEntry[]>([]);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const fetch = useCallback(() => Promise.all([api.reconciliations(tenantId, period), api.periodEntries(tenantId, period)]), [api, tenantId, period]);
  const reload = () => fetch().then(([r, l]) => {
    setRecs(r);
    setLedger(l);
  });
  useEffect(() => {
    let live = true;
    fetch().then(([r, l]) => {
      if (!live) return;
      setRecs(r);
      setLedger(l);
    }, (e: unknown) => {
      if (live) setNote(errorText(e, 'Could not load the month.'));
    });
    return () => {
      live = false;
    };
  }, [fetch]);

  const parsed = file ? (() => {
    const t = parseTable(file.text);
    return parseSettlement(t.headers, t.rows);
  })() : null;
  const result = parsed && !('refused' in parsed) ? reconcileProvider(parsed, ledger, period) : null;
  const latest = recs[0] ?? null;
  const isClosed = closed.includes(period);

  return (
    <section aria-label="Monthly close" style={{ marginTop: 'var(--sp-6)' }}>
      <h3 style={h3}>Reconcile and close a month</h3>
      <label style={label}>
        Month
        <input className="input" type="month" value={period} onChange={(e) => {
          if (!e.target.value) return;
          setPeriod(e.target.value);
          setFile(null);
        }} />
      </label>
      {isClosed ? (
        <p role="status" style={quiet}>{period} is closed. Corrections go in an open month.</p>
      ) : (
        <>
          <p style={quiet}>
            The payment provider’s settlement file is read in this browser. What is recorded is its totals and its fingerprint;
            the ledger’s side is read by the database itself.
          </p>
          <FilePick accept=".csv,.tsv,.txt,text/csv" multiple={false} onPick={(files) => {
            const f = files[0];
            if (f) f.text().then((text) => setFile({ name: f.name, text }), () => setNote(`Could not read ${f.name}.`));
          }}>
            {file ? `Settlement file: ${file.name}` : 'Choose the provider’s settlement file'}
          </FilePick>
          {parsed && 'refused' in parsed && <Notice alert>{parsed.refused}</Notice>}
          {result && (
            <div role="status" style={{ marginTop: 'var(--sp-3)' }}>
              <p style={body}>
                Provider {money(result.provider_total_cents)}, ledger {money(result.ledger_total_cents)}: {result.matched} matched,
                {' '}{result.missing.length} missing from the ledger, {result.extra.length} not in the settlement, {result.differing.length} different.
              </p>
              {result.differing.length > 0 && (
                <ul style={{ ...quiet, paddingLeft: 'var(--sp-6)' }}>
                  {result.differing.slice(0, 10).map((d) => <li key={d.provider_ref}>{d.provider_ref}: provider {money(d.provider_cents)}, ledger {money(d.ledger_cents)}</li>)}
                </ul>
              )}
              <ActionButton tone="primary" disabled={busy} style={{ marginTop: 'var(--sp-3)' }} onClick={() => {
                setBusy(true);
                setNote('');
                void sha256(file!.text)
                  .then((sha) => api.reconcile(tenantId, period, {
                    provider_total_cents: result.provider_total_cents, matched: result.matched, missing: result.missing.length,
                    extra: result.extra.length, differing: result.differing.length,
                  }, sha))
                  .then(reload, (e: unknown) => setNote(errorText(e, 'Could not record the reconciliation.')))
                  .finally(() => setBusy(false));
              }}>
                Record this reconciliation
              </ActionButton>
            </div>
          )}
          {latest && (
            <p style={{ ...quiet, marginTop: 'var(--sp-3)' }}>
              Latest reconciliation: {latest.passed ? 'passed' : 'did not pass'} — provider {money(latest.provider_total_cents)}, ledger {money(latest.ledger_total_cents)} over {latest.ledger_count} entries.
            </p>
          )}
          {latest?.passed && (latest.recorded_by === viewerId ? (
            <p style={quiet}>You recorded this reconciliation, so someone else closes the month.</p>
          ) : (
            <ActionButton disabled={busy} style={{ marginTop: 'var(--sp-3)' }} onClick={() => {
              setBusy(true);
              setNote('');
              api.close(tenantId, period, '').then(onClosed, (e: unknown) => setNote(errorText(e, 'Could not close the month.'))).finally(() => setBusy(false));
            }}>
              Close {period}
            </ActionButton>
          ))}
        </>
      )}
      {note && <Notice alert>{note}</Notice>}
    </section>
  );
}
