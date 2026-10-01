/**
 * The financial-aid record's reads and writes, typed, over the account service.
 *
 * Every function is one RPC or one table, and
 * `supabase/migrations/20260930270000_admissions_aid.sql` is the authority:
 * who may record, who may approve a high award and that it is never the person
 * who recorded it, which mode the school is in, what a disbursement may link to
 * and what is refused at the field are all decided there. Row-level security
 * decides what a read returns: aid staff read every award at their school; a
 * student reads their own awards and disbursements through the link the
 * school's registrar made on the academic record, and neither the history nor
 * the approvals.
 *
 * Nothing here writes to the student-accounts ledger. A disbursement may name an
 * aid credit on it by id, so that the two reconcile; the database reads that
 * entry and records the id, and this file has no call that could do more.
 */

import { cloud } from '../cloud';
import type { Grant } from '../capabilities';
import { serviceError } from '../attempt';
import type { AidCapability, Award, AwardHistoryEntry, Disbursement } from './model';
import { isAidStatus, isAwardType, type AidStatus, type AwardType } from './rules';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const maybe = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const num = (v: unknown): number => (typeof v === 'number' ? v : Number.parseInt(text(v), 10) || 0);
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);
const status = (v: unknown): AidStatus => (isAidStatus(v) ? v : 'offered');

/** The aid capabilities this person holds on their own school. A grant on anything else is not one. */
export function aidCapabilities(grants: readonly Grant[], school: string): AidCapability[] {
  const held = new Set<string>();
  for (const g of grants) if (school !== '' && g.scopeKind === 'school' && g.scopeId === school) held.add(g.capability);
  return (['aid:read', 'aid:record', 'aid:approve_high'] as const).filter((c) => held.has(c));
}

export function readAward(r: Row): Award {
  return {
    id: text(r.id),
    studentRef: text(r.student_ref),
    aidYear: text(r.aid_year),
    fundName: text(r.fund_name),
    awardType: isAwardType(r.award_type) ? r.award_type : 'other',
    amountCents: num(r.amount_cents),
    status: status(r.status),
    highValue: r.high_value === true,
    approvedAt: maybe(r.approved_at),
    recordedAt: text(r.recorded_at),
  };
}

export function readHistory(r: Row): AwardHistoryEntry {
  return {
    id: text(r.id),
    awardId: text(r.award_id),
    seq: num(r.seq),
    kind: r.kind === 'correction' ? 'correction' : 'status',
    fromStatus: isAidStatus(r.from_status) ? r.from_status : null,
    toStatus: status(r.to_status),
    correctsSeq: r.corrects_seq == null ? null : num(r.corrects_seq),
    reason: text(r.reason),
    recordedBy: maybe(r.recorded_by),
    recordedAt: text(r.recorded_at),
  };
}

export function readDisbursement(r: Row): Disbursement {
  return {
    id: text(r.id),
    awardId: text(r.award_id),
    amountCents: num(r.amount_cents),
    disbursedOn: text(r.disbursed_on),
    ledgerEntryId: maybe(r.ledger_entry_id),
    recordedAt: text(r.recorded_at),
  };
}

const AWARD_COLUMNS = 'id,student_ref,aid_year,fund_name,award_type,amount_cents,status,high_value,approved_at,recorded_at';
const HISTORY_COLUMNS = 'id,award_id,seq,kind,from_status,to_status,corrects_seq,reason,recorded_by,recorded_at';
const DISBURSEMENT_COLUMNS = 'id,award_id,amount_cents,disbursed_on,ledger_entry_id,recorded_at';

/** The awards for one student reference. Row-level security says which of them this caller may read. */
export async function loadAwards(studentRef: string): Promise<Award[]> {
  const db = await cloud();
  const { data, error } = await db
    .from('aid_awards')
    .select(AWARD_COLUMNS)
    .eq('student_ref', studentRef)
    .order('aid_year', { ascending: false })
    .order('fund_name')
    .limit(200);
  if (error) throw serviceError(error, 'Could not load the aid awards.');
  return rows(data).map(readAward);
}

export async function loadHistory(awardId: string): Promise<AwardHistoryEntry[]> {
  const db = await cloud();
  const { data, error } = await db.from('aid_award_history').select(HISTORY_COLUMNS).eq('award_id', awardId).order('seq', { ascending: true });
  if (error) throw serviceError(error, 'Could not load the award history.');
  return rows(data).map(readHistory);
}

export async function loadDisbursements(awardId: string): Promise<Disbursement[]> {
  const db = await cloud();
  const { data, error } = await db
    .from('aid_disbursements')
    .select(DISBURSEMENT_COLUMNS)
    .eq('award_id', awardId)
    .order('disbursed_on', { ascending: true });
  if (error) throw serviceError(error, 'Could not load the disbursements.');
  return rows(data).map(readDisbursement);
}

/**
 * The student reference the school linked to this account, or null when it has
 * not. The link is made by the school's record approvers
 * (`academic_record_subjects`); a student cannot make or change it.
 */
export async function myStudentRef(me: string): Promise<string | null> {
  const db = await cloud();
  const { data, error } = await db.from('academic_record_subjects').select('student_ref').eq('user_id', me).limit(1);
  if (error) throw serviceError(error, 'Could not read which academic record is yours.');
  const first = rows(data)[0];
  return first ? maybe(first.student_ref) : null;
}

// ── Writing ──────────────────────────────────────────────────────────────

/** Records an award, as offered. At or above the school's threshold it waits for a second person. */
export async function recordAward(
  studentRef: string, aidYear: string, fund: string, type: AwardType, amountCents: number, reason: string, key: string,
): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('aid_award_record', {
    want_student_ref: studentRef,
    want_aid_year: aidYear,
    want_fund: fund,
    want_type: type,
    want_amount_cents: amountCents,
    want_reason: reason,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The award was not recorded.');
  return text(data);
}

/** The second person's approval of a high award. The database refuses the person who recorded it. */
export async function approveAward(awardId: string, note: string, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('aid_award_approve', { want_award: awardId, want_note: note, want_key: key });
  if (error) throw serviceError(error, 'The award was not approved.');
  return text(data);
}

/** Moves an award to its next status. `disbursed` is reached by recording disbursements. */
export async function recordAwardStatus(awardId: string, to: AidStatus, reason: string, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('aid_status_record', { want_award: awardId, want_to: to, want_reason: reason, want_key: key });
  if (error) throw serviceError(error, 'The status was not recorded.');
  return text(data);
}

export async function correctAwardStatus(awardId: string, to: AidStatus, corrects: number, reason: string, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('aid_status_correct', {
    want_award: awardId,
    want_to: to,
    want_corrects: corrects,
    want_reason: reason,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The correction was not recorded.');
  return text(data);
}

/** Records a disbursement, optionally naming the student-accounts aid credit it reconciles with. Writes nothing to that ledger. */
export async function recordDisbursement(
  awardId: string, amountCents: number, on: string, ledgerEntryId: string | null, key: string,
): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('aid_disbursement_record', {
    want_award: awardId,
    want_amount_cents: amountCents,
    want_on: on,
    want_ledger_entry: ledgerEntryId,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The disbursement was not recorded.');
  return text(data);
}
