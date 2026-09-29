import type { ReactNode } from 'react';
import { CustomRow, Group, ValueRow } from '../shell/Rows';
import { SourceBadge } from '../SourceBadge';
import { AMOUNT, META, NOTE, ROW, WHAT } from '../rowparts';
import { aidKindOf } from '../../lib/bill';
import { formatDate } from '../../lib/locale';
import { readTerm } from '../../lib/term';
import { cents } from '../../lib/studentaccount/client';
import { signed, type Entry, type EntryKind, type PlanView, type TermSummary } from '../../lib/studentaccount/ledger';

/**
 * The pieces the student's view and the offices' views draw the same way:
 * whose figures these are, the term's balance with aid kept apart, the
 * ledger, and a plan's instalments.
 *
 * None of these holds arithmetic. Every figure arrives from `ledger.ts`
 * (`termSummary`, `planView`), which is where the four rules the student's own
 * statement reader (`lib/bill.ts`) keeps are held for the school's ledger too.
 */

export const ENTRY_WORDS: Record<EntryKind, string> = {
  charge: 'Charge',
  credit: 'Credit',
  aid_disbursement: 'Aid disbursed',
  payment: 'Payment',
  refund: 'Refund of credit',
  reversal: 'Reversal',
};

export const termLabel = (term: string): string => (/^\d{4}(FA|SP|SU)$/.test(term) ? readTerm(term).label : term);

/**
 * Whose figures these are, and how old. The ledger is the school's own,
 * posted by its student accounts office and its payment provider; awards
 * arrive from the school's aid system. Semester decides no amount.
 */
export function Provenance({ ledgerAt, awardsAt, now }: { ledgerAt: number | null; awardsAt: number | null; now: number }) {
  return (
    <div>
      <p style={NOTE}>
        These are your school’s figures, kept by its student accounts and financial aid offices. Semester shows them and
        adds them up; it never decides an amount or whether you are eligible for aid.
      </p>
      <div style={NOTE}>
        Ledger <SourceBadge label="institution_verified" at={ledgerAt} now={now} />
      </div>
      <div style={NOTE}>
        Aid awards <SourceBadge label="institution_verified" at={awardsAt} now={now} />
      </div>
    </div>
  );
}

/** The term's balance, then aid in two figures that are never added together. */
export function Summary({ s }: { s: TermSummary }) {
  const owes = s.balanceCents > 0;
  const disbursed = s.awards.reduce((n, v) => n + (v.credits ? v.disbursedCents : 0), 0);
  return (
    <>
      <Group header={`Balance for ${termLabel(s.term)}`} framed={false}>
        <ValueRow
          label={owes ? 'You owe' : s.balanceCents < 0 ? 'Credit balance, owed back to you' : 'Balance'}
          value={cents(Math.abs(s.balanceCents))}
        />
        <ValueRow label="Charges" value={cents(s.chargesCents)} />
        <ValueRow label="Paid and credited, including aid disbursed" value={cents(s.creditedCents)} />
        {s.refundedCents > 0 ? <ValueRow label="Refunded to you" value={cents(s.refundedCents)} /> : null}
      </Group>
      <Group header="Aid" framed={false}>
        <ValueRow label="Disbursed to your account" value={cents(disbursed)} />
        <ValueRow label="Anticipated — accepted, not disbursed, not money yet" value={cents(s.anticipatedCents)} />
        {s.anticipatedCents > 0 ? (
          <ValueRow label="If every anticipated award lands, the balance would be" value={cents(s.afterAnticipatedCents)} />
        ) : null}
        {s.borrowedCents > 0 ? <ValueRow label="Of the aid disbursed, borrowed and repaid later" value={cents(s.borrowedCents)} /> : null}
        {s.earnedCents > 0 ? (
          <ValueRow label="Work-study, paid to you for hours worked, never taken off this balance" value={cents(s.earnedCents)} />
        ) : null}
      </Group>
    </>
  );
}

/** The term's entries, oldest first, each with its signed amount. */
export function LedgerRows({
  entries,
  all,
  action,
}: {
  entries: readonly Entry[];
  all: readonly Entry[];
  /** A control per entry, for the offices (reverse). */
  action?: (e: Entry) => ReactNode;
}) {
  if (entries.length === 0) {
    return <p style={NOTE}>Nothing has been posted to this term yet.</p>;
  }
  return (
    <Group header="Ledger" framed={false}>
      {entries.map((e) => {
        const n = signed(e, all);
        return (
          <CustomRow key={e.id}>
            <div style={ROW}>
              <span style={WHAT}>
                {e.what}
                <span style={META}>
                  {ENTRY_WORDS[e.kind]} · {formatDate(e.at)}
                </span>
              </span>
              <span style={AMOUNT}>{n > 0 ? `+${cents(n)}` : n < 0 ? `−${cents(-n)}` : cents(0)}</span>
              {action ? action(e) : null}
            </div>
          </CustomRow>
        );
      })}
    </Group>
  );
}

const PLAN_WORDS: Record<PlanView['state'], string> = {
  settled: 'Settled',
  on_track: 'On track',
  overdue: 'Past due, inside the grace period',
  late: 'Late',
  cancelled: 'Cancelled',
};

export function PlanRows({ view, graceNote }: { view: PlanView | null; graceNote: string }) {
  if (!view) return <p style={NOTE}>There is no payment plan for this term. The student accounts office makes one.</p>;
  return (
    <Group header={`Payment plan · ${PLAN_WORDS[view.state]}`} framed={false}>
      <p style={NOTE}>{graceNote}</p>
      {view.instalments.map((i) => {
        const next = view.next?.instalment.n === i.n;
        return (
          <CustomRow key={i.n}>
            <div style={ROW}>
              <span style={WHAT}>
                Instalment {i.n} of {view.instalments.length}
                <span style={META}>
                  Due {formatDate(`${i.due}T12:00:00`)}
                  {next && view.next ? ` · ${cents(view.next.shortCents)} still to pay${view.next.overdue ? ', past due' : ''}` : ''}
                </span>
              </span>
              <span style={AMOUNT}>{cents(i.cents)}</span>
            </div>
          </CustomRow>
        );
      })}
    </Group>
  );
}

export function awardKindWord(kind: string): string {
  return aidKindOf(kind).label;
}
