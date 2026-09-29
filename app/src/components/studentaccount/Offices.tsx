import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNow, useStore } from '../../state/store';
import { ActionButton, Notice, Segmented } from '../ui';
import { CustomRow, Group } from '../shell/Rows';
import { ENTRY_WORDS, LedgerRows, PlanRows, Summary, awardKindWord, termLabel } from './Parts';
import { AMOUNT, META, NOTE, ROW, WHAT } from '../rowparts';
import { useConfirm } from '../ConfirmDialog';
import { formatDate } from '../../lib/locale';
import { termNow } from '../../lib/term';
import { IntentKeys } from '../../lib/idempotency';
import {
  DEFAULT_GRACE_DAYS,
  cents,
  createPlan,
  loadAccount,
  loadStudentsSeen,
  placeHold,
  postEntry,
  readCents,
  recordDisbursement,
  refundCredit,
  releaseHold,
  reverseEntry,
  type AccountContext,
  type LoadedAccount,
  type PostKind,
} from '../../lib/studentaccount/client';
import { activeHold, planView, reversedCents, termSummary, terms, type Entry } from '../../lib/studentaccount/ledger';

/**
 * The student accounts office and the financial aid office, as views of the
 * student account screen.
 *
 * Shown only when `my_capabilities` says this account holds `bursar:post` or
 * `aid:manage` at its school — and even then every write here is checked
 * again by its own database function, which is the authority; these views
 * decide only what to offer. Each write that moves money is previewed in the
 * confirmation dialog first and carries an idempotency key that is sent again,
 * unchanged, if it is retried (`lib/idempotency.ts`).
 */

const TERM = /^\d{4}(FA|SP|SU)$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELD = { display: 'grid', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' } as const;

function errorText(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/** Pick a student: one the school's ledger already names, or an account id typed in. */
function StudentPicker({ onPick, current }: { onPick: (id: string) => void; current: string }) {
  const [seen, setSeen] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [typed, setTyped] = useState('');
  useEffect(() => {
    let live = true;
    loadStudentsSeen().then(
      (ids) => { if (live) setSeen(ids); },
      (e: unknown) => { if (live) setError(errorText(e, 'Could not read the school’s ledger.')); },
    );
    return () => { live = false; };
  }, []);
  const open = () => {
    const id = typed.trim();
    if (!UUID.test(id)) {
      setError('That is not an account id. It looks like 8-4-4-4-12 letters and digits.');
      return;
    }
    setError('');
    onPick(id);
  };
  return (
    <Group header="Which student" framed={false}>
      <CustomRow line={false}>
        <label style={FIELD}>
          Student account id
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
        </label>
        <button type="button" className="btn" onClick={open}>Open this account</button>
        {error ? <p role="alert">{error}</p> : null}
      </CustomRow>
      {seen === null && !error ? <p role="status" style={NOTE}>Reading the school’s ledger…</p> : null}
      {seen?.length === 0 ? <p style={NOTE}>Nothing has been posted at your school yet.</p> : null}
      {(seen ?? []).slice(0, 12).map((id) => (
        <CustomRow key={id}>
          <button type="button" className="bare" aria-pressed={id === current} onClick={() => onPick(id)}>
            {id === current ? `Open now: ${id}` : id}
          </button>
        </CustomRow>
      ))}
    </Group>
  );
}

/** One student's account, loaded for an office; reloads when `version` moves. */
function useAccount(studentId: string, school: string, version: number) {
  const [account, setAccount] = useState<LoadedAccount | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!studentId) return;
    let live = true;
    loadAccount(studentId, school).then(
      (a) => { if (live) { setAccount(a); setError(''); } },
      (e: unknown) => { if (live) setError(errorText(e, 'Could not read that account.')); },
    );
    return () => { live = false; };
  }, [studentId, school, version]);
  return { account: account?.studentId === studentId ? account : null, error };
}

function TermPick({ all, value, onChange }: { all: string[]; value: string; onChange: (t: string) => void }) {
  if (all.length < 2) return null;
  return <Segmented options={all.map((t) => ({ id: t, label: termLabel(t) }))} value={value} onChange={onChange} />;
}

// ── The student accounts office ────────────────────────────────────────────

export function BursarOffice({ ctx }: { ctx: AccountContext }) {
  const { say } = useStore();
  const now = useNow();
  const [student, setStudent] = useState('');
  const [version, setVersion] = useState(0);
  const { account, error } = useAccount(student, ctx.school, version);
  const [picked, setPicked] = useState('');
  const [status, setStatus] = useState('');
  const keys = useRef(new IntentKeys()).current;
  const { confirmFirst, dialog } = useConfirm();

  // The post form.
  const [kind, setKind] = useState<PostKind>('charge');
  const [postTerm, setPostTerm] = useState(() => termNow(new Date()).id);
  const [postAmount, setPostAmount] = useState('');
  const [postWhat, setPostWhat] = useState('');
  // The other forms.
  const [refundAmount, setRefundAmount] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [parts, setParts] = useState('4');
  const [first, setFirst] = useState('');
  const [every, setEvery] = useState<'1' | '2' | '3'>('1');

  const all = useMemo(() => (account ? terms(account) : []), [account]);
  const term = all.includes(picked) ? picked : (all[all.length - 1] ?? postTerm);

  /** Run a write under its key; the key survives a failure so a retry is the same request. */
  const write = (signature: string, doing: string, done: string, run: (key: string) => Promise<unknown>) => async () => {
    setStatus(doing);
    try {
      await run(keys.keyFor(signature));
      keys.settle(signature);
      setStatus('');
      say(done);
      setVersion((n) => n + 1);
    } catch (e) {
      setStatus(errorText(e, 'Nothing was changed.'));
    }
  };
  const confirm = (title: string, confirmLabel: string, preview: ReactNode, run: () => Promise<void>) => confirmFirst({ title, confirmLabel, preview, run });

  const post = () => {
    const amount = readCents(postAmount);
    const what = postWhat.trim();
    if (!student) return setStatus('Open a student’s account first.');
    if (!TERM.test(postTerm)) return setStatus('A term is written like 2026FA, 2027SP or 2027SU.');
    if (amount === null || amount <= 0) return setStatus('The amount is dollars and cents, more than nothing — 1250.00, say.');
    if (!what) return setStatus('Say what the entry is for; the student reads it on their ledger.');
    const sig = `post:${student}:${postTerm}:${kind}:${amount}:${what}`;
    confirm(
      `Post a ${ENTRY_WORDS[kind].toLowerCase()} of ${cents(amount)}`,
      'Post the entry',
      <p>
        To {termLabel(postTerm)} for student {student}: “{what}”. {kind === 'charge' ? 'It raises the balance they owe.' : 'It lowers the balance they owe.'} An entry
        is never edited; a mistake is answered by reversing it.
      </p>,
      write(sig, 'Posting…', `${ENTRY_WORDS[kind]} of ${cents(amount)} posted.`, async (key) => {
        await postEntry(student, postTerm, kind, amount, what, key);
        setPostAmount('');
        setPostWhat('');
      }),
    );
  };

  const reverse = (e: Entry) => {
    if (!account) return;
    const left = e.cents - reversedCents(e, account.entries);
    confirm(
      `Reverse “${e.what}”`,
      'Reverse the entry',
      <p>
        Posts a reversal of the {cents(left)} left of this {ENTRY_WORDS[e.kind].toLowerCase()}, dated today. The original stays on the ledger, and the
        student sees both.
      </p>,
      write(`reverse:${e.id}:${left}`, 'Reversing…', `Reversed ${cents(left)} of “${e.what}”.`, (key) => reverseEntry(e.id, null, `Reverses ${e.what}`, key)),
    );
  };

  const office = !student ? null : error && !account ? (
    <Notice alert>{error}</Notice>
  ) : !account ? (
    <p role="status" style={NOTE}>Reading the account…</p>
  ) : (
    (() => {
      const s = termSummary(account, term);
      const hold = activeHold(account);
      const plan = account.plans.find((p) => p.term === term && p.cancelledAt === undefined) ?? null;
      const grace = ctx.settings?.graceDays ?? DEFAULT_GRACE_DAYS;
      const credit = s.balanceCents < 0 ? -s.balanceCents : 0;
      const refundTyped = refundAmount.trim() ? readCents(refundAmount) : credit;
      return (
        <>
          <TermPick all={all} value={term} onChange={setPicked} />
          <Summary s={s} />
          <LedgerRows
            entries={account.entries.filter((e) => e.term === term)}
            all={account.entries}
            action={(e) =>
              e.kind === 'reversal' || e.kind === 'aid_disbursement' || e.cents - reversedCents(e, account.entries) <= 0 ? null : (
                <button type="button" className="btn" aria-label={`Reverse ${e.what}`} onClick={() => reverse(e)}>
                  Reverse entry
                </button>
              )
            }
          />

          <Group header="Hold" framed={false}>
            <CustomRow line={false}>
              {hold ? (
                <>
                  <p>
                    Held since {formatDate(hold.placedAt)} at a balance of {cents(hold.balanceCents)}: “{hold.reason}”.
                  </p>
                  <label style={FIELD}>
                    Why it is released — the student reads this
                    <input className="input" value={holdReason} onChange={(e) => setHoldReason(e.target.value)} />
                  </label>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const why = holdReason.trim();
                      if (!why) return setStatus('Say why the hold is released.');
                      confirm('Release the hold', 'Release the hold', <p>The student can register again as far as Student Accounts is concerned. “{why}”</p>,
                        write(`release:${hold.id}`, 'Releasing…', 'Hold released.', async () => { await releaseHold(hold.id, why); setHoldReason(''); }));
                    }}
                  >
                    Release the hold
                  </button>
                </>
              ) : (
                <>
                  <p style={NOTE}>
                    Not held. A hold needs a balance over your school’s threshold of {cents(ctx.settings?.thresholdCents ?? 0)}.
                  </p>
                  <label style={FIELD}>
                    Why it is placed — the student reads this
                    <input className="input" value={holdReason} onChange={(e) => setHoldReason(e.target.value)} />
                  </label>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const why = holdReason.trim();
                      if (!why) return setStatus('Say why the hold is placed; the student reads it.');
                      confirm('Place a hold', 'Place the hold', <p>A hold can stop this student registering. The registrar sees that they are held, never why. “{why}”</p>,
                        write(`hold:${student}`, 'Placing the hold…', 'Hold placed.', async () => { await placeHold(student, why); setHoldReason(''); }));
                    }}
                  >
                    Place a hold
                  </button>
                </>
              )}
            </CustomRow>
          </Group>

          {credit > 0 ? (
            <Group header="Refund the credit balance" framed={false}>
              <CustomRow line={false}>
                <label style={FIELD}>
                  Amount — up to {cents(credit)}
                  <input className="input" inputMode="decimal" value={refundAmount} placeholder={cents(credit)} onChange={(e) => setRefundAmount(e.target.value)} />
                </label>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    if (refundTyped === null || refundTyped <= 0 || refundTyped > credit) return setStatus(`A refund is more than nothing and no more than ${cents(credit)}.`);
                    confirm(`Refund ${cents(refundTyped)}`, 'Record the refund', <p>Records that {cents(refundTyped)} of the {termLabel(term)} credit balance went back to the student. Anticipated aid is not a credit and is never refunded.</p>,
                      write(`refund:${student}:${term}:${refundTyped}`, 'Recording the refund…', `Refund of ${cents(refundTyped)} recorded.`, async (key) => { await refundCredit(student, term, refundTyped, key); setRefundAmount(''); }));
                  }}
                >
                  Refund the credit
                </button>
              </CustomRow>
            </Group>
          ) : null}

          {plan ? (
            <PlanRows view={planView(plan, account.entries, now, grace)} graceNote={`Late is more than ${grace} days past due.`} />
          ) : s.balanceCents > 0 ? (
            <Group header="Make a payment plan" framed={false}>
              <CustomRow line={false}>
                <p style={NOTE}>The plan divides the {cents(s.balanceCents)} owed now; the parts add back to it exactly.</p>
                <label style={FIELD}>
                  Instalments, 2 to 12
                  <input className="input" inputMode="numeric" value={parts} onChange={(e) => setParts(e.target.value)} />
                </label>
                <label style={FIELD}>
                  First due, as a date
                  <input className="input" type="date" value={first} onChange={(e) => setFirst(e.target.value)} />
                </label>
                <Segmented options={[{ id: '1', label: 'Monthly' }, { id: '2', label: 'Every 2 months' }, { id: '3', label: 'Every 3 months' }] as const} value={every} onChange={setEvery} />
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const n = Number(parts);
                    if (!Number.isInteger(n) || n < 2 || n > 12) return setStatus('A plan has 2 to 12 instalments.');
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(first)) return setStatus('Choose the date the first instalment is due.');
                    confirm(`Make a ${n}-part plan`, 'Make the plan', <p>{cents(s.balanceCents)} for {termLabel(term)} in {n} instalments from {formatDate(`${first}T12:00:00`)}, every {every === '1' ? 'month' : `${every} months`}.</p>,
                      write(`plan:${student}:${term}:${n}:${first}:${every}`, 'Making the plan…', 'Payment plan made.', (key) => createPlan(student, term, n, first, Number(every), key)));
                  }}
                >
                  Make the plan
                </button>
              </CustomRow>
            </Group>
          ) : null}
        </>
      );
    })()
  );

  return (
    <>
      <StudentPicker onPick={setStudent} current={student} />
      {office}
      <Group header="Post an entry" framed={false}>
        <CustomRow line={false}>
          <Segmented options={[{ id: 'charge', label: 'Charge' }, { id: 'credit', label: 'Credit' }, { id: 'payment', label: 'Counter payment' }] as const} value={kind} onChange={setKind} />
          <label style={FIELD}>
            Term
            <input className="input" value={postTerm} onChange={(e) => setPostTerm(e.target.value.toUpperCase())} />
          </label>
          <label style={FIELD}>
            Amount, in dollars
            <input className="input" inputMode="decimal" value={postAmount} onChange={(e) => setPostAmount(e.target.value)} />
          </label>
          <label style={FIELD}>
            What it is for — the student reads this
            <input className="input" value={postWhat} onChange={(e) => setPostWhat(e.target.value)} />
          </label>
        </CustomRow>
        <ActionButton tone="primary" onClick={post} disabled={!student}>
          Post the entry
        </ActionButton>
        {!student ? <p style={NOTE}>Open a student’s account above to post to it.</p> : null}
      </Group>
      {status ? <p role="status">{status}</p> : null}
      {dialog}
    </>
  );
}

// ── The financial aid office ───────────────────────────────────────────────

export function AidOffice({ ctx }: { ctx: AccountContext }) {
  const { say } = useStore();
  const [student, setStudent] = useState('');
  const [version, setVersion] = useState(0);
  const { account, error } = useAccount(student, ctx.school, version);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const keys = useRef(new IntentKeys()).current;
  const { confirmFirst, dialog } = useConfirm();

  const views = useMemo(() => (account ? terms(account).flatMap((t) => termSummary(account, t).awards) : []), [account]);

  const disburse = (awardId: string, what: string, left: number) => {
    const typed = (amounts[awardId] ?? '').trim();
    const amount = typed ? readCents(typed) : left;
    if (amount === null || amount <= 0 || amount > left) return setStatus(`A disbursement is more than nothing and no more than the ${cents(left)} left of the award.`);
    const sig = `disburse:${awardId}:${amount}`;
    confirmFirst({
      title: `Record a disbursement of ${cents(amount)}`,
      confirmLabel: 'Record the disbursement',
      preview: (
        <p>
          Against “{what}”. This records money your school’s aid system has already disbursed; Semester sets no amount of its own. It lowers the
          student’s balance.
        </p>
      ),
      run: async () => {
        setStatus('Recording…');
        try {
          await recordDisbursement(awardId, amount, keys.keyFor(sig));
          keys.settle(sig);
          setStatus('');
          setAmounts((a) => ({ ...a, [awardId]: '' }));
          say(`Disbursement of ${cents(amount)} recorded against ${what}.`);
          setVersion((n) => n + 1);
        } catch (e) {
          setStatus(errorText(e, 'The disbursement was not recorded.'));
        }
      },
    });
  };

  return (
    <>
      <StudentPicker onPick={setStudent} current={student} />
      {!student ? null : error && !account ? (
        <Notice alert>{error}</Notice>
      ) : !account ? (
        <p role="status" style={NOTE}>Reading the awards…</p>
      ) : views.length === 0 ? (
        <p style={NOTE}>Your school’s aid system has sent no award for this student.</p>
      ) : (
        <Group header="Awards" framed={false}>
          {views.map((v) => {
            const left = v.anticipatedCents;
            return (
              <CustomRow key={v.award.id}>
                <div style={ROW}>
                  <span style={WHAT}>
                    {v.award.what}
                    <span style={META}>
                      {termLabel(v.award.term)} · {awardKindWord(v.award.kind)} · {v.award.status} · offered {cents(v.award.offeredCents)} · disbursed{' '}
                      {cents(v.disbursedCents)}
                    </span>
                    {v.waitingOn ? <span style={META}>{v.waitingOn}</span> : null}
                  </span>
                  <span style={AMOUNT}>{cents(left)} left</span>
                </div>
                {left > 0 && !v.waitingOn ? (
                  <div style={ROW}>
                    <label style={{ ...FIELD, ...WHAT }}>
                      Amount disbursed
                      <input
                        className="input"
                        inputMode="decimal"
                        placeholder={cents(left)}
                        value={amounts[v.award.id] ?? ''}
                        onChange={(e) => setAmounts((a) => ({ ...a, [v.award.id]: e.target.value }))}
                      />
                    </label>
                    <button type="button" className="btn" aria-label={`Record a disbursement against ${v.award.what}`} onClick={() => disburse(v.award.id, v.award.what, left)}>
                      Record disbursement
                    </button>
                  </div>
                ) : null}
              </CustomRow>
            );
          })}
        </Group>
      )}
      {status ? <p role="status">{status}</p> : null}
      {dialog}
    </>
  );
}
