/**
 * The academic-record ledger's client: the three tables in
 * `20260929210000_academic_record_ledger.sql`, under the signed-in account's
 * RLS. There is no call that writes the ledger, because the database has no
 * grant that would let one: an entry exists only when someone other than its
 * proposer approves a change.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChangeStatus, LedgerEntry, Proposal, RecordChange } from './ledger';

export interface RecordApi {
  /** One student's ledger and the changes proposed to it. */
  lookup(tenantId: string, studentRef: string): Promise<{ entries: LedgerEntry[]; changes: RecordChange[] }>;
  /** Every change at the school still waiting for a decision. */
  pending(tenantId: string): Promise<RecordChange[]>;
  propose(tenantId: string, p: Proposal): Promise<string>;
  decide(id: string, status: Extract<ChangeStatus, 'approved' | 'rejected'>, note: string): Promise<void>;
  withdraw(id: string): Promise<void>;
}

/** Whether an account holding these verified capabilities should see the Record tab at all. */
export function recordAllowed(verified: readonly string[]): boolean {
  return verified.some((c) => c === 'record:propose' || c === 'record:approve' || c === 'record:override' || c === 'record:read');
}
export const canPropose = (v: readonly string[]) => v.includes('record:propose');
export const canDecide = (v: readonly string[]) => v.includes('record:approve');
export const canOverride = (v: readonly string[]) => v.includes('record:override');
export const canRead = (v: readonly string[]) => v.includes('record:read') || v.includes('record:approve');

/** A database refusal as a sentence: the trigger's own words, or a plain one for a policy. */
export function refusal(error: { message?: string } | null, fallback: string): Error {
  const m = error?.message ?? '';
  if (/row-level security|permission denied/i.test(m)) return new Error('Your account cannot do that at this school.');
  if (/violates check constraint/i.test(m)) return new Error('The database refused that change as written; check the reason and the value.');
  return new Error(m || fallback);
}

const ENTRY = 'id, tenant_id, student_ref, kind, subject_key, action, value, previous_value, previous_entry_id, effective_on, reason, source, change_id, proposed_by, approved_by, override, recorded_at';
const CHANGE = 'id, tenant_id, student_ref, kind, subject_key, action, value, effective_on, reason, source, status, proposed_by, proposed_at, decided_by, decided_at, decision_note';

export function recordApi(db: SupabaseClient): RecordApi {
  return {
    async lookup(tenantId, studentRef) {
      const [e, c] = await Promise.all([
        db.from('academic_record_entries').select(ENTRY).eq('tenant_id', tenantId).eq('student_ref', studentRef),
        db.from('academic_record_changes').select(CHANGE).eq('tenant_id', tenantId).eq('student_ref', studentRef).order('proposed_at', { ascending: false }),
      ]);
      if (e.error) throw refusal(e.error, 'Could not load the record.');
      if (c.error) throw refusal(c.error, 'Could not load the changes.');
      return { entries: (e.data ?? []) as LedgerEntry[], changes: (c.data ?? []) as RecordChange[] };
    },
    async pending(tenantId) {
      const { data, error } = await db.from('academic_record_changes').select(CHANGE).eq('tenant_id', tenantId).eq('status', 'proposed').order('proposed_at');
      if (error) throw refusal(error, 'Could not load the changes waiting for a decision.');
      return (data ?? []) as RecordChange[];
    },
    async propose(tenantId, p) {
      const { data, error } = await db
        .from('academic_record_changes')
        .insert({
          tenant_id: tenantId, student_ref: p.student_ref, kind: p.kind, subject_key: p.subject_key.trim(), action: p.action,
          value: p.action === 'void' ? '' : p.value.trim(), effective_on: p.effective_on, reason: p.reason.trim(), source: p.source,
        })
        .select('id')
        .single();
      if (error) throw refusal(error, 'Could not propose the change.');
      return (data as { id: string }).id;
    },
    async decide(id, status, note) {
      const { data, error } = await db.from('academic_record_changes').update({ status, decision_note: note }).eq('id', id).select('id');
      if (error) throw refusal(error, 'Could not record the decision.');
      if (!data || data.length === 0) throw new Error('Your account cannot decide this change.');
    },
    async withdraw(id) {
      const { data, error } = await db.from('academic_record_changes').update({ status: 'withdrawn' }).eq('id', id).select('id');
      if (error) throw refusal(error, 'Could not withdraw the change.');
      if (!data || data.length === 0) throw new Error('Your account cannot withdraw this change.');
    },
  };
}
