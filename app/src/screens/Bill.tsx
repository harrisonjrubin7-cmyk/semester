/**
 * The university's statement, and the aid set against it.
 *
 * The other half of this screen is what a student chose to spend — books, an
 * access code, a lab fee. This is the half somebody else decides: tuition, a
 * room, a meal plan, and the awards credited against them. It is ten to twenty
 * times the money and it is the half nobody checks, because the statement
 * arrives as a PDF that states a balance and explains nothing.
 *
 * What the app adds is in `lib/bill.ts`: the four mistakes the arithmetic
 * stops, and the promise that an instalment plan adds back up to the balance
 * exactly. This file is the surface over it and holds no arithmetic of its own.
 *
 * ## It never touches money
 *
 * There is no card field here, no account number, and no payment. The app
 * shows what is owed and when, and opens the university's own payment page.
 * Paying is a thing that happens on the university's site, under the
 * university's authentication, and bringing it in here would mean holding
 * somebody's payment details to no purpose.
 */

import { useMemo, useState } from 'react';
import { secondLine } from '../lib/dim';
import { useStore } from '../state/store';
import { CustomRow, Group } from '../components/shell/Rows';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel, Segmented } from '../components/ui';
import { CAMPUS_LINKS } from '../data/campus';
import {
  AID_KINDS,
  CHARGE_KINDS,
  aidKindOf,
  billFor,
  blankPlan,
  chargeKindOf,
  forTerm,
  line,
  money,
  readMoney,
  todo,
  type AidKind,
  type ChargeKind,
  type Plan,
} from '../lib/bill';
import { isoToDate, longLabel } from '../lib/date';
import { readTerm } from '../lib/term';

/** How many instalments a plan can be split into. Five is the common one. */
const PARTS = [1, 2, 3, 4, 5, 6, 8, 10, 12];

export function Bill() {
  // `now` from the store rather than `new Date()` here: it is the one clock
  // every screen reads, so "overdue" changes at midnight on this screen at the
  // same moment it changes on Today.
  const { state, dispatch, now } = useStore();

  const charges = useMemo(() => forTerm(state.charges, state.term), [state.charges, state.term]);
  const awards = useMemo(() => forTerm(state.aid, state.term), [state.aid, state.term]);
  const payments = useMemo(() => forTerm(state.payments, state.term), [state.payments, state.term]);
  const plan = state.plans[state.term] ?? blankPlan();

  // One call rather than four, so this screen, the Today card and the reminder
  // cannot disagree about what is owed. The lists above are read again only to
  // draw the rows; every figure comes from here.
  const { owed: o, instalments, next, paidCents: done } = useMemo(
    () => billFor(state, state.term, now),
    [state, state.term, now],
  );
  const said = useMemo(() => todo(o, next), [o, next]);

  const statement = state.linkUrls.myvu || CAMPUS_LINKS.find((l) => l.id === 'myvu')?.url || '';

  // One draft, reused by the three forms below. Each one writes only the
  // fields it shows, so a half-typed charge cannot leak into an award.
  const [what, setWhat] = useState('');
  const [amount, setAmount] = useState('');
  const [chargeKind, setChargeKind] = useState<ChargeKind>('tuition');
  const [aidKind, setAidKind] = useState<AidKind>('grant');
  const [pending, setPending] = useState(false);
  const [on, setOn] = useState('');
  const [adding, setAdding] = useState<'charge' | 'aid' | 'payment'>('charge');
  const [bad, setBad] = useState('');

  const clear = () => {
    setWhat('');
    setAmount('');
    setPending(false);
    setOn('');
    setBad('');
  };

  const add = () => {
    const cents = readMoney(amount);
    if (cents === null) {
      setBad('That is not an amount the app can read. Try 3241.50, or $3,241.50.');
      return;
    }
    if (cents === 0) {
      setBad('A line of $0.00 tells a December version of you nothing. Leave it out.');
      return;
    }
    if (!what.trim()) {
      setBad('Say what it is, so the list still means something in December.');
      return;
    }
    if (adding === 'charge') {
      dispatch({
        type: 'addCharge',
        charge: { term: state.term, what: what.trim(), kind: chargeKind, cents },
      });
    } else if (adding === 'aid') {
      dispatch({
        type: 'addAid',
        aid: { term: state.term, what: what.trim(), kind: aidKind, cents, pending },
      });
    } else {
      if (!on) {
        setBad('Say when you paid it. A payment with no date cannot be set against an instalment.');
        return;
      }
      dispatch({
        type: 'addPayment',
        payment: { term: state.term, what: what.trim(), cents, on },
      });
    }
    clear();
  };

  const setPlanTo = (patch: Partial<Plan>) =>
    dispatch({ type: 'setPlan', term: state.term, plan: { ...plan, ...patch } });

  return (
    <>
      <Blueprint style={{ padding: '15px 16px', marginTop: 'var(--sp-6)' }}>
        <div className="kicker">{readTerm(state.term).label}</div>
        <div
          className="chrome-text"
          style={{
            fontSize: 'calc(24px * var(--text-scale, 1))',
            lineHeight: 1.15,
            marginTop: 'var(--sp-3)',
            textWrap: 'pretty',
          }}
        >
          {line(o)}
        </div>
        {said.map((s) => (
          <div
            key={s}
            style={{
              fontSize: 'var(--type-base)',
              opacity: 0.7,
              marginTop: 'var(--sp-4)',
              lineHeight: 'var(--leading-relaxed)',
            }}
          >
            {s}
          </div>
        ))}
      </Blueprint>

      {charges.length > 0 && (
        <Group header="Charged" framed={false}>
          {charges.map((c) => (
            <CustomRow key={c.id}>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'baseline' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base)', lineHeight: 1.35 }}>
                  {c.what}
                  <span style={{ opacity: 0.5 }}>
                    {' · '}
                    {chargeKindOf(c.kind).label}
                  </span>
                </span>
                <span
                  style={{
                    flex: 'none',
                    fontSize: 'var(--type-md)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {money(c.cents)}
                </span>
                <button
                  type="button"
                  className="bare"
                  aria-label={`Remove ${c.what}`}
                  onClick={() => dispatch({ type: 'dropCharge', id: c.id })}
                  style={{ width: 24, flex: 'none', opacity: 0.45, fontSize: 'var(--type-md)' }}
                >
                  ×
                </button>
              </div>
            </CustomRow>
          ))}
        </Group>
      )}

      {awards.length > 0 && (
        <Group header="Aid" framed={false}>
          {awards.map((a) => {
            const kind = aidKindOf(a.kind);
            return (
              <CustomRow key={a.id}>
                <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'baseline' }}>
                  <span
                    style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base)', lineHeight: 1.35 }}
                  >
                    {a.what}
                    <span style={{ opacity: 0.5 }}>
                      {' · '}
                      {kind.label}
                      {/* The two facts that change what the number means. Said
                          on the row rather than only in the summary, because
                          this is the list somebody scans. */}
                      {kind.credits ? '' : ' · paid to you, not to the bill'}
                      {kind.repaid ? ' · paid back' : ''}
                    </span>
                  </span>
                  <span
                    style={{
                      flex: 'none',
                      fontSize: 'var(--type-md)',
                      fontVariantNumeric: 'tabular-nums',
                      opacity: a.pending ? 0.55 : 1,
                    }}
                  >
                    {money(a.cents)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    aria-pressed={!a.pending}
                    onClick={() => dispatch({ type: 'patchAid', id: a.id, patch: { pending: !a.pending } })}
                    style={{ flex: 'none', height: 28, fontSize: 'var(--type-xs)', padding: '0 8px' }}
                  >
                    {a.pending ? 'Not yet' : 'Confirmed'}
                  </button>
                  <button
                    type="button"
                    className="bare"
                    aria-label={`Remove ${a.what}`}
                    onClick={() => dispatch({ type: 'dropAid', id: a.id })}
                    style={{ width: 24, flex: 'none', opacity: 0.45, fontSize: 'var(--type-md)' }}
                  >
                    ×
                  </button>
                </div>
              </CustomRow>
            );
          })}
        </Group>
      )}

      <SectionLabel>The plan</SectionLabel>
      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
        <select
          className="input"
          value={plan.parts}
          aria-label="How many instalments"
          onChange={(e) => setPlanTo({ parts: Number(e.target.value) })}
          style={{ flex: 1, minWidth: 0 }}
        >
          {PARTS.map((n) => (
            <option key={n} value={n}>
              {n === 1 ? 'Pay in full' : `${n} instalments`}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="date"
          value={plan.first}
          aria-label={plan.parts === 1 ? 'When it is due' : 'When the first instalment is due'}
          onChange={(e) => setPlanTo({ first: e.target.value })}
          style={{ flex: 1, minWidth: 0 }}
        />
      </div>

      {instalments.length === 0 ? (
        <div
          style={{
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            ...secondLine(),
            marginBottom: 'var(--sp-4)',
            lineHeight: 'var(--leading-normal)',
          }}
        >
          {o.owedCents <= 0
            ? 'Nothing to schedule — there is no balance left on this term.'
            : 'Put the due date off your statement in and the app splits the balance across it. It will not guess a date that carries a late fee.'}
        </div>
      ) : (
        <Group header={`${money(o.owedCents)} across ${instalments.length === 1 ? 'one payment' : `${instalments.length} instalments`}`} framed={false}>
          {instalments.map((inst) => {
            const isNext = next?.instalment.n === inst.n;
            const settled = next === null || inst.n < next.instalment.n;
            return (
              <CustomRow key={inst.n}>
                <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'baseline' }}>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 'var(--type-base)',
                      opacity: settled ? 0.5 : 1,
                    }}
                  >
                    {longLabel(isoToDate(inst.due))}
                    {settled ? ' · paid' : ''}
                    {isNext && next.overdue ? ' · overdue' : ''}
                    {isNext && !next.overdue && next.shortCents < inst.cents
                      ? ` · ${money(inst.cents - next.shortCents)} of it paid`
                      : ''}
                  </span>
                  <span
                    style={{
                      flex: 'none',
                      fontSize: 'var(--type-md)',
                      fontVariantNumeric: 'tabular-nums',
                      opacity: settled ? 0.5 : 1,
                      color: isNext && next.overdue ? 'var(--app-warn)' : undefined,
                    }}
                  >
                    {money(inst.cents)}
                  </span>
                </div>
              </CustomRow>
            );
          })}
        </Group>
      )}

      {payments.length > 0 && (
        <Group header={`Paid — ${money(done)}`} framed={false}>
          {payments.map((p) => (
            <CustomRow key={p.id}>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'baseline' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base)' }}>
                  {p.what}
                  <span style={{ opacity: 0.5 }}>
                    {' · '}
                    {longLabel(isoToDate(p.on))}
                  </span>
                </span>
                <span
                  style={{
                    flex: 'none',
                    fontSize: 'var(--type-base)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {money(p.cents)}
                </span>
                <button
                  type="button"
                  className="bare"
                  aria-label={`Remove ${p.what}`}
                  onClick={() => dispatch({ type: 'dropPayment', id: p.id })}
                  style={{ width: 24, flex: 'none', opacity: 0.45, fontSize: 'var(--type-md)' }}
                >
                  ×
                </button>
              </div>
            </CustomRow>
          ))}
        </Group>
      )}

      <SectionLabel>Add a line</SectionLabel>
      {/* The shared control rather than a fourth hand-rolled row of pills, and
          named "An award" rather than "Aid" on purpose: the section above is
          already a foldable group called Aid, and two buttons with the same
          name on one screen is a screen reader reading the same word twice
          for two different things. Found by driving the screen, not by
          reading it. */}
      <Segmented
        options={[
          { id: 'charge', label: 'A charge' },
          { id: 'aid', label: 'An award' },
          { id: 'payment', label: 'A payment' },
        ]}
        value={adding}
        onChange={(which) => {
          setAdding(which);
          setBad('');
        }}
        style={{ marginBottom: 'var(--sp-4)' }}
      />

      <input
        className="input"
        value={what}
        aria-label="What it is"
        placeholder={
          adding === 'charge'
            ? 'Tuition, 15 hours'
            : adding === 'aid'
              ? 'Need-based grant'
              : 'Instalment 1'
        }
        onChange={(e) => setWhat(e.target.value)}
        style={{ width: '100%', marginBottom: 'var(--sp-4)' }}
      />

      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
        <input
          className="input"
          value={amount}
          aria-label="How much"
          placeholder="3241.50"
          inputMode="decimal"
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: 120, flex: 'none' }}
        />
        {adding === 'charge' && (
          <select
            className="input"
            value={chargeKind}
            aria-label="What kind of charge"
            onChange={(e) => setChargeKind(e.target.value as ChargeKind)}
            style={{ flex: 1, minWidth: 0 }}
          >
            {CHARGE_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        )}
        {adding === 'aid' && (
          <select
            className="input"
            value={aidKind}
            aria-label="What kind of aid"
            onChange={(e) => setAidKind(e.target.value as AidKind)}
            style={{ flex: 1, minWidth: 0 }}
          >
            {AID_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        )}
        {adding === 'payment' && (
          <input
            className="input"
            type="date"
            value={on}
            aria-label="When you paid it"
            onChange={(e) => setOn(e.target.value)}
            style={{ flex: 1, minWidth: 0 }}
          />
        )}
      </div>

      {adding === 'aid' && (
        <button
          type="button"
          className="bare tappable"
          aria-pressed={pending}
          onClick={() => setPending((v) => !v)}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '9px 11px',
            marginBottom: 'var(--sp-4)',
            borderRadius: 'var(--r-md)',
            border: `1px solid ${pending ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
            background: pending ? 'var(--app-accent-wash)' : 'transparent',
            fontSize: 'var(--type-base)',
          }}
        >
          Still conditional — it is not credited until it clears
        </button>
      )}

      {adding === 'aid' && !aidKindOf(aidKind).credits && (
        <div
          style={{
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            ...secondLine(),
            marginBottom: 'var(--sp-4)',
            lineHeight: 'var(--leading-normal)',
          }}
        >
          Work-study is a job. It is paid to you for hours worked, so the app records it and keeps it
          out of what the statement says you owe.
        </div>
      )}

      {bad ? (
        <div
          style={{
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            color: 'var(--app-warn)',
            marginBottom: 'var(--sp-4)',
            lineHeight: 'var(--leading-normal)',
          }}
        >
          {bad}
        </div>
      ) : null}

      <button type="button" className="btn btn-primary btn-block" onClick={add} style={{ height: 44 }}>
        Add it
      </button>

      {statement ? (
        <a
          href={statement}
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary btn-block"
          style={{
            height: 42,
            marginTop: 'var(--sp-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
          }}
        >
          Open your statement →
        </a>
      ) : null}

      <div
        style={{
          fontSize: 'var(--type-xs)',
          ...secondLine(),
          marginTop: 14,
          lineHeight: 'var(--leading-normal)',
        }}
      >
        Nothing here is read off your student account, and nothing here is a payment. The account is
        behind single sign-on and publishes nothing a student can read on their own, so you type the
        figures off the statement and the app does the arithmetic the statement does not — what is
        actually covered, what is only hoped for, and what each instalment comes to. Paying happens
        on the university's own page.
      </div>
    </>
  );
}
