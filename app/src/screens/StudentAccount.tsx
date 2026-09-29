import { useEffect, useMemo, useRef, useState } from 'react';
import { useNow, useStore } from '../state/store';
import { Page } from '../components/Page';
import { ActionButton, EmptyState, Notice, Segmented, TabList } from '../components/ui';
import { CustomRow, Group } from '../components/shell/Rows';
import { LedgerRows, PlanRows, Provenance, Summary, awardKindWord, termLabel } from '../components/studentaccount/Parts';
import { AMOUNT, META, NOTE, ROW, WHAT } from '../components/rowparts';
import { useConfirm } from '../components/ConfirmDialog';
import { AidOffice, BursarOffice } from '../components/studentaccount/Offices';
import { formatDate } from '../lib/locale';
import { IntentKeys } from '../lib/idempotency';
import { CAPABILITIES } from '../lib/studentaccount/actions';
import {
  DEFAULT_GRACE_DAYS,
  cents,
  loadAccount,
  openAccount,
  readCents,
  respondToAward,
  startPayment,
  type AccountContext,
  type LoadedAccount,
  type Opening,
} from '../lib/studentaccount/client';
import { activeHold, planView, termSummary, terms, type AwardView, type IntentStatus } from '../lib/studentaccount/ledger';
import type { GateCode } from '../lib/studentaccount/gate';

/**
 * The school's student account: a person's ledger for a term, the aid set
 * against it, their payment plan, whether they are held, and a way to start
 * paying — behind `module.student_accounts`, which is off at every school
 * today, so what nearly everybody sees is the one sentence saying so.
 *
 * This is not Money's statement reader (`screens/Bill.tsx`). That is the
 * student's own copy of a statement they typed in; this is the statement
 * itself, as the school's offices keep it. The two link to each other and
 * share no state. Every figure here comes from `lib/studentaccount/ledger.ts`
 * over rows the database returned; the screen does no arithmetic of its own,
 * and the balance is never read from anywhere, because nowhere stores one.
 *
 * The offices' views sit beside the student's as tabs, and only when the
 * database says this account holds `bursar:post` or `aid:manage` at its
 * school (`my_capabilities`). What the tabs offer is decided there; what a
 * write is allowed to do is decided by each database function, again.
 */

const BLURB = 'Your school’s ledger for a term, the aid set against it, your payment plan and any hold — the school’s figures, with how old they are.';

type Loaded = { status: 'loading' } | { status: 'error'; message: string } | { status: 'done'; opening: Opening };

const OFF_WORDS: Record<GateCode, string> = {
  module_off:
    'Your school has not turned on student accounts in Semester. Your balance, aid and payments stay with your school’s student accounts office, and nothing here changes them.',
  no_finance_owner:
    'Your school has not yet named the person accountable for student accounts, so they are not on. Your balance, aid and payments stay with your school’s student accounts office.',
  finance_seat_vacant:
    'Student accounts are not on at any school yet: Semester holds no school’s money until someone qualified is accountable for it at Semester, and that seat is empty. Your balance, aid and payments stay with your school’s student accounts office.',
};

export function StudentAccount() {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    openAccount().then(
      (opening) => { if (live) setLoaded({ status: 'done', opening }); },
      (e: unknown) => { if (live) setLoaded({ status: 'error', message: e instanceof Error ? e.message : 'Could not reach your school’s account service.' }); },
    );
    return () => { live = false; };
  }, [attempt]);

  if (loaded.status === 'loading') {
    return (
      <Page blurb={BLURB}>
        <p role="status" style={NOTE}>Asking your school whether student accounts are on…</p>
      </Page>
    );
  }
  if (loaded.status === 'error') {
    return (
      <Page blurb={BLURB}>
        <Notice alert>
          {loaded.message} Nothing on your account was changed. Your school’s student accounts office still has everything.
        </Notice>
        <ActionButton tone="secondary" onClick={() => { setLoaded({ status: 'loading' }); setAttempt((n) => n + 1); }}>
          Try again
        </ActionButton>
      </Page>
    );
  }
  const { opening } = loaded;
  if (opening.kind === 'no_service' || opening.kind === 'signed_out' || opening.kind === 'no_school') {
    return (
      <Page blurb={BLURB}>
        <Notice>
          {opening.kind === 'no_service'
            ? 'A student account comes from your school’s own system, and this copy of Semester has no account service to reach it. Your school’s student accounts office controls the account; your own notes on a statement are on Money.'
            : opening.kind === 'signed_out'
              ? 'Your student account is private to you and your school’s offices, so it needs you signed in. Sign in under You → Account with the address your school knows.'
              : 'Your account is not linked to a school yet, so there is no school’s ledger to show. Choose your school under You → Account; your school’s student accounts office controls the rest.'}
        </Notice>
        <OpenMoney />
      </Page>
    );
  }
  const ctx = opening.context;
  if (!ctx.decision.on) {
    return (
      <Page blurb={BLURB}>
        <Notice>{OFF_WORDS[ctx.decision.code]}</Notice>
        <p style={NOTE}>Money still keeps the statement you type in yourself, with what each instalment comes to.</p>
        <OpenMoney />
      </Page>
    );
  }
  return <Account ctx={ctx} />;
}

/** The link to the student's own statement reader. One home each; this is the way between them. */
function OpenMoney() {
  const { dispatch } = useStore();
  return (
    <button
      type="button"
      className="btn"
      style={{ marginTop: 'var(--sp-5)' }}
      onClick={() => {
        dispatch({ type: 'setCostsTab', tab: 'bill' });
        dispatch({ type: 'go', screen: 'costs' });
      }}
    >
      Open your own statement on Money
    </button>
  );
}

type View = 'mine' | 'bursar' | 'aid';

function Account({ ctx }: { ctx: AccountContext }) {
  const bursar = ctx.capabilities.includes(CAPABILITIES.bursar);
  const aid = ctx.capabilities.includes(CAPABILITIES.aid);
  const tabs = [
    { id: 'mine' as const, label: 'Your account' },
    ...(bursar ? [{ id: 'bursar' as const, label: 'Student accounts office' }] : []),
    ...(aid ? [{ id: 'aid' as const, label: 'Financial aid office' }] : []),
  ];
  const [view, setView] = useState<View>(bursar ? 'bursar' : aid ? 'aid' : 'mine');
  return (
    <Page blurb={BLURB}>
      {tabs.length > 1 ? <TabList label="Student account views" className="portal-tabs" value={view} onChange={setView} tabs={tabs} /> : null}
      {view === 'bursar' && bursar ? <BursarOffice ctx={ctx} /> : view === 'aid' && aid ? <AidOffice ctx={ctx} /> : <YourAccount ctx={ctx} />}
    </Page>
  );
}

const INTENT_WORDS: Record<IntentStatus, string> = {
  open: 'Waiting for the payment provider',
  paid: 'Paid',
  failed: 'Did not go through',
  refunded: 'Refunded',
};

function YourAccount({ ctx }: { ctx: AccountContext }) {
  const { say } = useStore();
  const now = useNow();
  const [account, setAccount] = useState<LoadedAccount | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [picked, setPicked] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const keys = useRef(new IntentKeys()).current;
  const { confirmFirst, dialog } = useConfirm();

  useEffect(() => {
    let live = true;
    loadAccount(ctx.userId, ctx.school).then(
      (a) => { if (live) { setAccount(a); setError(''); } },
      (e: unknown) => { if (live) setError(e instanceof Error ? e.message : 'Could not read your account.'); },
    );
    return () => { live = false; };
  }, [ctx.userId, ctx.school, attempt]);

  const all = useMemo(() => (account ? terms(account) : []), [account]);
  const term = all.includes(picked) ? picked : (all[all.length - 1] ?? '');

  if (error && !account) {
    return (
      <>
        <Notice alert>{error} Your school’s student accounts office still has everything; nothing was changed.</Notice>
        <ActionButton onClick={() => setAttempt((n) => n + 1)}>Try again</ActionButton>
      </>
    );
  }
  if (!account) return <p role="status" style={NOTE}>Reading your account…</p>;
  if (all.length === 0) {
    return (
      <>
        <EmptyState
          title="Nothing on your account yet"
          body="When your school posts a charge, or its financial aid office sends an award, it shows here with the date it arrived. Nothing is owed until then."
        />
        <OpenMoney />
      </>
    );
  }

  const s = termSummary(account, term);
  const hold = activeHold(account);
  const plan = account.plans.find((p) => p.term === term && p.cancelledAt === undefined) ?? null;
  const grace = ctx.settings?.graceDays ?? DEFAULT_GRACE_DAYS;
  const pv = plan ? planView(plan, account.entries, now, grace) : null;
  const entries = account.entries.filter((e) => e.term === term);
  const ledgerAt = account.entries.reduce<number | null>((n, e) => Math.max(n ?? 0, e.at), null);
  const awardsAt = account.awards.reduce<number | null>((n, a) => Math.max(n ?? 0, a.syncedAt), null);
  const intents = account.intents.filter((i) => i.term === term);
  const typed = amount.trim() ? readCents(amount) : s.balanceCents;
  const payable = typed !== null && typed > 0 && typed <= s.balanceCents;

  const pay = () => {
    if (typed === null || !payable) {
      setStatus(`A payment is more than nothing and no more than the ${cents(s.balanceCents)} this term owes.`);
      return;
    }
    const signature = `pay:${term}:${typed}`;
    confirmFirst({
      title: `Start a payment of ${cents(typed)}`,
      confirmLabel: 'Start the payment',
      preview: (
        <p>
          Toward {termLabel(term)}, which owes {cents(s.balanceCents)}. Nothing is charged in Semester: your school’s payment provider takes the card, and
          the ledger shows the payment once the provider confirms it.
        </p>
      ),
      run: async () => {
        setBusy(true);
        setStatus('Starting the payment…');
        try {
          await startPayment(term, typed, keys.keyFor(signature));
          keys.settle(signature);
          setAmount('');
          setStatus('');
          say(`Payment of ${cents(typed)} started. Your school’s payment provider finishes it.`);
          setAttempt((n) => n + 1);
        } catch (e) {
          // The key is kept: pressing again sends the same request, which the
          // database recognises instead of starting a second payment.
          setStatus(e instanceof Error ? e.message : 'The payment was not started.');
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const answer = (v: AwardView, accept: boolean) =>
    confirmFirst({
      title: `${accept ? 'Accept' : 'Decline'} ${v.award.what}`,
      confirmLabel: accept ? 'Accept the award' : 'Decline the award',
      preview: (
        <>
          <p>
            {awardKindWord(v.award.kind)} of {cents(v.award.offeredCents)}, as your school’s financial aid office offered it.
            {v.repaid ? ' A loan is repaid later.' : ''}
          </p>
          <p>Your answer goes to the financial aid office. After this, only that office changes it.</p>
        </>
      ),
      run: async () => {
        setStatus('Sending your answer…');
        try {
          const answered = await respondToAward(v.award.id, accept);
          setStatus('');
          say(`${v.award.what}: ${answered}.`);
          setAttempt((n) => n + 1);
        } catch (e) {
          setStatus(e instanceof Error ? e.message : 'Your answer was not recorded.');
        }
      },
    });

  return (
    <>
      <Provenance ledgerAt={ledgerAt} awardsAt={awardsAt} now={now.getTime()} />
      {all.length > 1 ? <Segmented options={all.map((t) => ({ id: t, label: termLabel(t) }))} value={term} onChange={setPicked} /> : null}

      {hold ? (
        <Notice alert>
          Your school’s student accounts office has a hold on your account, placed {formatDate(hold.placedAt)}: “{hold.reason}”. A hold can stop
          registration. Paying the balance or talking to that office is how it is released.
        </Notice>
      ) : (
        <p style={NOTE}>No hold from Student Accounts.</p>
      )}

      <Summary s={s} />

      {s.balanceCents > 0 ? (
        <Group header="Pay toward this term" framed={false}>
          <CustomRow line={false}>
            <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
              Amount, in dollars — leave it blank to pay the whole {cents(s.balanceCents)}
              <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={cents(s.balanceCents)} />
            </label>
          </CustomRow>
          <ActionButton tone="primary" onClick={pay} disabled={busy}>
            Pay toward {termLabel(term)}
          </ActionButton>
        </Group>
      ) : (
        <p style={NOTE}>Nothing is owed for {termLabel(term)}, so there is nothing to pay.</p>
      )}
      {status ? <p role="status">{status}</p> : null}

      <Group header="Aid awards" framed={false}>
        {s.awards.length === 0 ? (
          <CustomRow line={false}>
            <span style={NOTE}>Your school’s financial aid office has sent no award for this term.</span>
          </CustomRow>
        ) : (
          s.awards.map((v) => (
            <CustomRow key={v.award.id}>
              <div style={ROW}>
                <span style={WHAT}>
                  {v.award.what}
                  <span style={META}>
                    {awardKindWord(v.award.kind)} · {v.award.status} · offered {cents(v.award.offeredCents)} · disbursed {cents(v.disbursedCents)}
                    {v.anticipatedCents > 0 ? ` · anticipated ${cents(v.anticipatedCents)}` : ''}
                  </span>
                  {v.waitingOn ? <span style={META}>{v.waitingOn}</span> : null}
                </span>
                {v.award.status === 'offered' ? (
                  <span style={AMOUNT}>
                    <button type="button" className="btn" aria-label={`Accept ${v.award.what}`} onClick={() => answer(v, true)}>Accept award</button>{' '}
                    <button type="button" className="btn" aria-label={`Decline ${v.award.what}`} onClick={() => answer(v, false)}>Decline award</button>
                  </span>
                ) : null}
              </div>
            </CustomRow>
          ))
        )}
      </Group>

      <PlanRows
        view={pv}
        graceNote={
          ctx.settings
            ? `Your school counts an instalment late ${grace} days after it is due.`
            : `Late means more than ${grace} days past due, Semester’s default; your school may allow longer.`
        }
      />

      <LedgerRows entries={entries} all={account.entries} />

      {intents.length > 0 ? (
        <Group header="Payments you started" framed={false}>
          {intents.map((i) => (
            <CustomRow key={i.id}>
              <div style={ROW}>
                <span style={WHAT}>
                  {INTENT_WORDS[i.status]}
                  <span style={META}>Started {formatDate(i.createdAt)}</span>
                </span>
                <span style={AMOUNT}>{cents(i.cents)}</span>
              </div>
            </CustomRow>
          ))}
        </Group>
      ) : null}

      <OpenMoney />
      {dialog}
    </>
  );
}
