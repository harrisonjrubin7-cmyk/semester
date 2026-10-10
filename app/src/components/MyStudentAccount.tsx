/**
 * The student's own account at their school, on Bill, above the figures they
 * type themselves: what the school's ledger says they owe today, how old it
 * is, whether a financial hold applies, every posted entry, a receipt for
 * each payment, and a month's statement to keep.
 *
 * It reads only what an approver posted, through the link the school's
 * registrar made from its student identifier to this account; before that
 * link there is nothing to read, and the screen says who makes it. Nothing
 * here is a payment: paying happens on the school's own page, and a payment
 * appears here once Student Accounts records it.
 *
 * The one thing a student does here is ask for a payment plan: how many
 * payments and when the first is due. The schedule shown is the one the
 * database will write, by the school's own rules, from the balance the ledger
 * holds; Student Accounts agrees to it or not, and once agreed the screen
 * shows each payment paid, due or late, read from the ledger.
 */
import { useEffect, useState } from 'react';
import { cloud } from '../lib/cloud';
import { download } from '../lib/deliver';
import { secondLine } from '../lib/dim';
import { firstDueRange, money, paymentPlan, periodOf, receipt, statementCsv, type AccountEntry, type Installment, type PaymentPlanRecord, type PlanStanding } from '../lib/finance/accounts';
import { myAccountApi, myStatement, myView, whatItIs, type MyAccount, type MyAccountApi } from '../lib/finance/mine';
import { useStore } from '../state/store';
import { ActionButton, EmptyState, Notice, SectionLabel } from './ui';
import {
  FinanceCommandError, forgetPendingFinanceCommand, newFinanceCommandKey, pendingFinanceCommand, rememberPendingFinanceCommand,
  type FinanceCommandUiState,
} from '../lib/finance/commands';

export interface MyStudentAccountProps {
  enabled: boolean;
  /** The school's payment page, opened in a new tab. Empty hides the link. */
  payUrl: string;
  /** Overrides the store's account, for tests. */
  accountId?: string | null;
  api?: MyAccountApi;
  /** Injected in tests; today, as YYYY-MM-DD. */
  today?: string;
}

type Loaded =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; accounts: MyAccount[] };

const quiet = { fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' } as const;
const body = { fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)' } as const;
const cell = { textAlign: 'left', padding: 'var(--sp-2)', borderTop: '1px solid var(--app-line)', fontSize: 'var(--type-sm)', verticalAlign: 'top' } as const;
const num = { ...cell, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } as const;
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function MyStudentAccount({ enabled, payUrl, accountId, api, today }: MyStudentAccountProps) {
  const { account } = useStore();
  const userId = accountId !== undefined ? accountId : (account?.id ?? null);
  // Kept with the account it was read for, so a switch on a shared device
  // shows loading until the new account's answer arrives, never the last one's.
  const [loaded, setLoaded] = useState<{ for: string | null; value: Loaded }>({ for: null, value: { kind: 'loading' } });
  const [client, setClient] = useState<MyAccountApi | null>(api ?? null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!enabled || !userId) return;
    let live = true;
    (api ? Promise.resolve(api) : cloud().then(myAccountApi))
      .then((a) => {
        if (live) setClient(a);
        return a.accounts(userId);
      })
      .then(
        (accounts) => live && setLoaded({ for: userId, value: { kind: 'ready', accounts } }),
        (e: unknown) => live && setLoaded({ for: userId, value: { kind: 'error', message: e instanceof Error ? e.message : 'Could not load your account.' } }),
      );
    return () => {
      live = false;
    };
  }, [enabled, userId, api, round]);

  if (!enabled) return null;
  const header = <SectionLabel>From your school</SectionLabel>;
  if (!userId) {
    return (
      <section aria-label="From your school">
        {header}
        <p style={quiet}>Sign in to see the account your school keeps for you, if it has linked it.</p>
      </section>
    );
  }
  const state = loaded.for === userId ? loaded.value : { kind: 'loading' as const };
  if (state.kind === 'loading') {
    return (
      <section aria-label="From your school">
        {header}
        <p role="status" style={quiet}>Reading your school’s account…</p>
      </section>
    );
  }
  if (state.kind === 'error') {
    return (
      <section aria-label="From your school">
        {header}
        <Notice alert>{state.message}</Notice>
      </section>
    );
  }
  if (state.accounts.length === 0) {
    return (
      <section aria-label="From your school">
        {header}
        <EmptyState
          inline
          title="Your school has not linked your account"
          body="Your registrar links your student record to this account. Until then the figures below are the ones you type."
        />
      </section>
    );
  }
  const day = today ?? localToday();
  return (
    <>
      {state.accounts.map((a) => (
        <SchoolAccount
          key={`${a.tenant_id}/${a.student_ref}`}
          account={a}
          day={day}
          payUrl={payUrl}
          many={state.accounts.length > 1}
          api={client}
          userId={userId}
          onChanged={() => setRound((r) => r + 1)}
        />
      ))}
    </>
  );
}

function SchoolAccount({ account: a, day, payUrl, many, api, userId, onChanged }: {
  account: MyAccount; day: string; payUrl: string; many: boolean; api: MyAccountApi | null; userId: string | null; onChanged: () => void;
}) {
  const v = myView(a, day);
  const [period, setPeriod] = useState(v.period ?? periodOf(day));
  const st = myStatement(a, period);
  const shown = a.entries.filter((e) => e.effective_on <= day);
  const later = a.entries.filter((e) => e.effective_on > day);

  return (
    <section aria-label={many ? `From ${a.school}` : 'From your school'} style={{ marginTop: 'var(--sp-6)' }}>
      <SectionLabel aside={a.school}>From your school</SectionLabel>
      <p style={body}>{v.headline}</p>
      {a.entries.length > 0 && (
        <p style={{ fontSize: 'var(--type-display-sm)', margin: 'var(--sp-2) 0', fontVariantNumeric: 'tabular-nums' }} aria-label="Balance today">
          {money(Math.abs(v.owed))}
        </p>
      )}
      <p role="status" style={v.hold.held ? { ...body, fontWeight: 600 } : quiet}>{v.hold.line}</p>
      {v.next && <p style={quiet}>{v.next}</p>}
      {v.upcoming > 0 && <p style={quiet}>{money(v.upcoming)} more is on the account for later dates, and is not owed yet.</p>}

      {v.owed > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBlock: 'var(--sp-3)' }} aria-label="What you owe, by age">
          <thead>
            <tr><th style={num}>Up to 30 days</th><th style={num}>31–60</th><th style={num}>61–90</th><th style={num}>Over 90</th></tr>
          </thead>
          <tbody>
            <tr><td style={num}>{money(v.age.current)}</td><td style={num}>{money(v.age.d31_60)}</td><td style={num}>{money(v.age.d61_90)}</td><td style={num}>{money(v.age.over90)}</td></tr>
          </tbody>
        </table>
      )}

      {payUrl && v.owed > 0 && (
        <p style={body}>
          <a href={payUrl} target="_blank" rel="noopener noreferrer">Pay on your school’s page →</a>
        </p>
      )}

      <PlanSection account={a} owed={v.owed} plan={v.plan} standing={v.standing} day={day} api={api} userId={userId} onChanged={onChanged} />

      {shown.length > 0 && <Entries entries={shown} label="Posted to your account" />}
      {later.length > 0 && <Entries entries={later} label="On your account for later dates" />}

      {v.periods.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'end', marginTop: 'var(--sp-4)' }}>
          <label style={{ display: 'grid', gap: 'var(--sp-2)', fontSize: 'var(--type-sm)' }}>
            Statement for
            <select className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {v.periods.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <ActionButton onClick={() => download({ name: `${st.number}.csv`, body: statementCsv(st), mime: 'text/csv' })}>
            Download statement
          </ActionButton>
          <span style={quiet}>
            Brought forward {money(st.opening_cents)}, carried forward {money(st.closing_cents)}.
          </span>
        </div>
      )}

      <p style={{ ...quiet, marginTop: 'var(--sp-4)' }}>
        Read from the account {a.school} keeps under student number {a.student_ref}. Only entries Student Accounts has
        approved appear here. If one looks wrong, ask Student Accounts; nobody can change it from this screen.
      </p>
    </section>
  );
}

function Entries({ entries, label }: { entries: AccountEntry[]; label: string }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 'var(--sp-4)' }} aria-label={label}>
      <caption style={{ ...quiet, textAlign: 'left', paddingBottom: 'var(--sp-2)' }}>{label}</caption>
      <thead>
        <tr><th style={cell}>Date</th><th style={cell}>What</th><th style={{ ...cell, textAlign: 'right' }}>Amount</th><th style={cell}><span className="sr-only">Receipt</span></th></tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.id}>
            <td style={{ ...cell, whiteSpace: 'nowrap' }}>{e.effective_on}</td>
            <td style={cell}>{whatItIs(e)}</td>
            <td style={num}>{money(e.amount_cents)}</td>
            <td style={cell}>
              {e.kind === 'payment' && (
                <button
                  type="button"
                  className="bare tappable"
                  aria-label={`Receipt for the payment of ${e.effective_on}`}
                  onClick={() => download({ name: `receipt-${e.provider_ref || e.id}.txt`, body: receipt(e).join('\n') + '\n', mime: 'text/plain' })}
                >
                  Receipt
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const STATE_LABEL = { paid: 'Paid', late: 'Late', due: 'Due today', upcoming: 'Coming' } as const;

function Schedule({ schedule, standing, label }: { schedule: readonly Installment[]; standing: PlanStanding | null; label: string }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 'var(--sp-3)' }} aria-label={label}>
      <thead>
        <tr><th style={cell}>Due</th><th style={{ ...cell, textAlign: 'right' }}>Payment</th>{standing && <th style={cell}>Status</th>}</tr>
      </thead>
      <tbody>
        {schedule.map((p, i) => (
          <tr key={i}>
            <td style={{ ...cell, whiteSpace: 'nowrap' }}>{p.due_on}</td>
            <td style={num}>{money(p.cents)}</td>
            {standing && <td style={cell}>{STATE_LABEL[standing.rows[i]?.state ?? 'upcoming']}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PlanSection({ account: a, owed, plan, standing, day, api, userId, onChanged }: {
  account: MyAccount; owed: number; plan: PaymentPlanRecord | null; standing: PlanStanding | null; day: string;
  api: MyAccountApi | null; userId: string | null; onChanged: () => void;
}) {
  const rules = a.planRules;
  const [count, setCount] = useState(Math.min(4, rules.max_installments));
  const [first, setFirst] = useState(day);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const [command, setCommand] = useState<{ state: FinanceCommandUiState; key: string; text: string } | null>(() => {
    const key = pendingFinanceCommand(a.tenant_id, a.student_ref, 'plan.request');
    return key ? { state: 'unknown', key, text: 'Unknown — a previous plan request has no confirmed response. Check for its accepted receipt before asking again.' } : null;
  });
  const range = firstDueRange(day);
  const last = a.plans.find((p) => p.status === 'rejected' || p.status === 'cancelled');

  const act = (work: Promise<void>) => {
    setBusy(true);
    setSaid('');
    work.then(onChanged, (e: unknown) => setSaid(e instanceof Error ? e.message : 'Student Accounts could not be asked.')).finally(() => setBusy(false));
  };

  const heading = <h3 style={{ ...body, fontWeight: 600, marginTop: 'var(--sp-5)' }}>Payment plan</h3>;
  const commandNotice = command && (
    <div>
      <Notice alert={command.state !== 'accepted' && command.state !== 'pending'}>{command.text}</Notice>
      {command.state === 'unknown' && api && (
        <button type="button" className="btn" onClick={() => {
          setBusy(true);
          api.planReceipt(a.tenant_id, a.student_ref, command.key).then((receipt) => {
            forgetPendingFinanceCommand(a.tenant_id, a.student_ref, 'plan.request');
            setCommand({ state: 'accepted', key: command.key, text: `Accepted — recovered receipt ${receipt.id}.` });
            onChanged();
          }, (error: unknown) => {
            const state = error instanceof FinanceCommandError ? error.kind : 'unknown';
            if (state !== 'unknown') forgetPendingFinanceCommand(a.tenant_id, a.student_ref, 'plan.request');
            setCommand({ state, key: command.key, text: state === 'denied'
              ? 'Denied — no accepted receipt was available. Review the plan before asking again.'
              : state === 'conflict' ? `Conflict — ${error instanceof Error ? error.message : 'The command key conflicts.'}` : 'Unknown — receipt recovery still has no answer. Do not ask again yet.' });
          }).finally(() => setBusy(false));
        }}>Check for accepted receipt</button>
      )}
    </div>
  );

  if (plan && plan.status === 'approved' && standing) {
    const line = standing.state === 'complete'
      ? 'Your plan is paid in full.'
      : standing.state === 'behind'
        ? `Your plan is ${money(standing.behind_cents)} behind.`
        : standing.next ? `Your plan is on track. Next: ${money(standing.next.cents)} on ${standing.next.due_on}.` : 'Your plan is on track.';
    return (
      <section aria-label="Payment plan">
        {heading}
        <p role="status" style={standing.state === 'behind' ? { ...body, fontWeight: 600 } : body}>{line}</p>
        <p style={quiet}>
          Agreed with Student Accounts for {money(plan.balance_cents)}. Paid toward it so far: {money(Math.max(0, standing.paid_cents))}. While
          the plan is kept, no financial hold applies. Charges posted after it are not part of it.
        </p>
        <Schedule schedule={plan.schedule} standing={standing} label="Your plan" />
        {commandNotice}
      </section>
    );
  }

  if (plan && plan.status === 'proposed') {
    // Only the asker withdraws (the guard says so); a plan Student Accounts
    // asked for on the student's behalf is theirs to withdraw.
    const mine = userId !== null && plan.requested_by === userId;
    return (
      <section aria-label="Payment plan">
        {heading}
        <p role="status" style={body}>You asked for this plan. Student Accounts decides it; until they agree, the usual hold rule applies.</p>
        <Schedule schedule={plan.schedule} standing={null} label="The plan you asked for" />
        {mine && api && (
          <button type="button" className="bare tappable" disabled={busy} style={{ marginTop: 'var(--sp-3)' }} onClick={() => act(api.withdrawPlan(plan.id))}>
            Withdraw this request
          </button>
        )}
        {commandNotice}
        {said && <Notice alert>{said}</Notice>}
      </section>
    );
  }

  if (owed <= 0) return null;
  if (!rules.offered) {
    return (
      <section aria-label="Payment plan">
        {heading}
        <p style={quiet}>Your school does not offer payment plans here. Ask Student Accounts what it can arrange.</p>
      </section>
    );
  }

  const choices = Array.from({ length: rules.max_installments - 1 }, (_, i) => i + 2);
  const preview = paymentPlan(owed, count, first, rules);
  const firstOk = first >= range.min && first <= range.max;
  return (
    <section aria-label="Payment plan">
      {heading}
      {last && (
        <p style={quiet}>
          {last.status === 'cancelled' ? 'Your last plan was cancelled' : 'Your last plan request was not agreed'}
          {(last.status === 'cancelled' ? last.cancel_note : last.decision_note) ? `: ${last.status === 'cancelled' ? last.cancel_note : last.decision_note}` : '.'}
        </p>
      )}
      <p style={quiet}>
        Spread what you owe today, {money(owed)}, over monthly payments. At least {rules.min_down_percent}% comes first, and no monthly
        payment is under {money(rules.min_installment_cents)}. Asking sends this schedule to Student Accounts; nothing is paid or charged here.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', alignItems: 'end', marginTop: 'var(--sp-3)' }}>
        <label style={{ display: 'grid', gap: 'var(--sp-2)', fontSize: 'var(--type-sm)' }}>
          Payments
          <select className="input" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {choices.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 'var(--sp-2)', fontSize: 'var(--type-sm)' }}>
          First payment on
          <input type="date" className="input" value={first} min={range.min} max={range.max} onChange={(e) => e.target.value && setFirst(e.target.value)} />
        </label>
      </div>
      {!firstOk ? (
        <p role="status" style={quiet}>The first payment is due between today and {range.max}.</p>
      ) : 'refused' in preview ? (
        <p role="status" style={quiet}>{preview.refused}</p>
      ) : (
        <>
          <Schedule schedule={preview.schedule} standing={null} label="The plan you would ask for" />
          {api && (
            <ActionButton
              tone="primary"
              disabled={busy || command?.state === 'unknown' || command?.state === 'pending'}
              style={{ marginTop: 'var(--sp-4)' }}
              onClick={() => {
                const key = newFinanceCommandKey('plan.request');
                rememberPendingFinanceCommand(a.tenant_id, a.student_ref, 'plan.request', key);
                setBusy(true);
                setCommand({ state: 'pending', key, text: 'Pending — waiting for an accepted plan receipt.' });
                api.askForPlan(a.tenant_id, a.student_ref, count, first, key).then((receipt) => {
                  forgetPendingFinanceCommand(a.tenant_id, a.student_ref, 'plan.request');
                  setCommand({ state: 'accepted', key, text: `Accepted — receipt ${receipt.id}.` });
                  onChanged();
                }, (error: unknown) => {
                  // The production client classifies transport failures as `unknown`.
                  // An unclassified rejection is therefore a definite refusal from an
                  // injected/legacy client, not evidence that the command may have landed.
                  const state = error instanceof FinanceCommandError ? error.kind : 'denied';
                  if (state !== 'unknown') forgetPendingFinanceCommand(a.tenant_id, a.student_ref, 'plan.request');
                  setCommand({ state, key, text: state === 'unknown'
                    ? 'Unknown — check for the accepted receipt before asking again.'
                    : `${state === 'conflict' ? 'Conflict' : 'Denied'} — ${error instanceof Error ? error.message : 'The plan request was not accepted.'}` });
                }).finally(() => setBusy(false));
              }}
            >
              Ask Student Accounts for this plan
            </ActionButton>
          )}
        </>
      )}
      {commandNotice}
      {said && <Notice alert>{said}</Notice>}
    </section>
  );
}
