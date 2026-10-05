/**
 * Student accounts' client: the tables in `20260929220000_student_accounts.sql`,
 * under the signed-in account's RLS. There is no call that writes the ledger,
 * moves money or takes a card: an entry exists only when someone other than
 * its requester approves a request, and a payment is recorded by the hosted
 * provider's reference.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_SETTINGS, type AccountEntry, type AccountRequest, type FinanceSettings, type PaymentPlanRecord, type Proposal, type SchoolPlanRules } from './accounts';
import { cancelPlan, decidePlan, planRules, plansFor, plansWaiting } from './plans';

export interface Reconciliation {
  id: string;
  period: string;
  provider_total_cents: number;
  ledger_total_cents: number;
  ledger_count: number;
  matched: number;
  missing: number;
  extra: number;
  differing: number;
  passed: boolean;
  recorded_by: string | null;
  recorded_at: string;
}

export interface ReconciliationCounts {
  provider_total_cents: number;
  matched: number;
  missing: number;
  extra: number;
  differing: number;
}

export interface FinanceApi {
  lookup(tenantId: string, studentRef: string): Promise<{ entries: AccountEntry[]; requests: AccountRequest[] }>;
  pending(tenantId: string): Promise<AccountRequest[]>;
  settings(tenantId: string): Promise<FinanceSettings>;
  closed(tenantId: string): Promise<string[]>;
  /** The school's provider-backed entries in a month: what a reconciliation compares. */
  periodEntries(tenantId: string, period: string): Promise<AccountEntry[]>;
  reconciliations(tenantId: string, period: string): Promise<Reconciliation[]>;
  request(tenantId: string, p: Proposal): Promise<string>;
  decide(id: string, status: 'approved' | 'rejected', note: string): Promise<void>;
  withdraw(id: string): Promise<void>;
  reconcile(tenantId: string, period: string, c: ReconciliationCounts, sha: string): Promise<void>;
  close(tenantId: string, period: string, note: string): Promise<void>;
  /** Payment plans (`student_payment_plans`): one student's, newest first. */
  plans(tenantId: string, studentRef: string): Promise<PaymentPlanRecord[]>;
  plansWaiting(tenantId: string): Promise<PaymentPlanRecord[]>;
  planRules(tenantId: string): Promise<SchoolPlanRules>;
  decidePlan(id: string, status: 'approved' | 'rejected', note: string): Promise<void>;
  cancelPlan(id: string, note: string): Promise<void>;
}

export function financeAllowed(verified: readonly string[]): boolean {
  return verified.some((c) => c.startsWith('finance:'));
}
export const canRequest = (v: readonly string[]) => v.includes('finance:request');
export const canApprove = (v: readonly string[]) => v.includes('finance:approve');
export const canApproveHigh = (v: readonly string[]) => v.includes('finance:approve_high');
export const canClose = (v: readonly string[]) => v.includes('finance:close');
export const canReadAccounts = (v: readonly string[]) => v.includes('finance:read') || v.includes('finance:approve') || v.includes('finance:close');

/** A database refusal as a sentence: the trigger's own words, or a plain one for a policy or a constraint. */
export function refusal(error: { message?: string } | null, fallback: string): Error {
  const m = error?.message ?? '';
  if (/row-level security|permission denied/i.test(m)) return new Error('Your account cannot do that at this school.');
  if (/no_pan/.test(m)) return new Error('That looks like a card number. Card numbers are never recorded here.');
  if (/violates check constraint/i.test(m)) return new Error('The database refused that request as written; check the kind, category and reference.');
  return new Error(m || fallback);
}

const ENTRY = 'id, tenant_id, student_ref, kind, category, amount_cents, description, reference_entry_id, provider_ref, effective_on, period, request_id, requested_by, approved_by, high_value, recorded_at';
const REQUEST = 'id, tenant_id, student_ref, kind, category, amount_cents, description, reference_entry_id, provider_ref, effective_on, status, requested_by, requested_at, decided_by, decided_at';

export function financeApi(db: SupabaseClient): FinanceApi {
  return {
    async lookup(tenantId, studentRef) {
      const [e, r] = await Promise.all([
        db.from('student_account_entries').select(ENTRY).eq('tenant_id', tenantId).eq('student_ref', studentRef).order('effective_on'),
        db.from('student_account_requests').select(REQUEST).eq('tenant_id', tenantId).eq('student_ref', studentRef).order('requested_at', { ascending: false }),
      ]);
      if (e.error) throw refusal(e.error, 'Could not load the account.');
      if (r.error) throw refusal(r.error, 'Could not load the requests.');
      return { entries: (e.data ?? []) as AccountEntry[], requests: (r.data ?? []) as AccountRequest[] };
    },
    async pending(tenantId) {
      const { data, error } = await db.from('student_account_requests').select(REQUEST).eq('tenant_id', tenantId).eq('status', 'proposed').order('requested_at');
      if (error) throw refusal(error, 'Could not load the requests waiting for a decision.');
      return (data ?? []) as AccountRequest[];
    },
    async settings(tenantId) {
      const { data, error } = await db.from('student_account_settings').select('high_value_cents, hold_after_days, hold_minimum_cents').eq('tenant_id', tenantId).maybeSingle();
      if (error) throw refusal(error, 'Could not load the thresholds.');
      return (data as FinanceSettings | null) ?? DEFAULT_SETTINGS;
    },
    async closed(tenantId) {
      const { data, error } = await db.from('student_account_closes').select('period').eq('tenant_id', tenantId);
      if (error) throw refusal(error, 'Could not load the closed months.');
      return ((data ?? []) as { period: string }[]).map((r) => r.period);
    },
    async periodEntries(tenantId, period) {
      const { data, error } = await db.from('student_account_entries').select(ENTRY).eq('tenant_id', tenantId).eq('period', period).in('kind', ['payment', 'refund', 'chargeback']);
      if (error) throw refusal(error, 'Could not load the month’s payments.');
      return (data ?? []) as AccountEntry[];
    },
    async reconciliations(tenantId, period) {
      const { data, error } = await db
        .from('student_account_reconciliations')
        .select('id, period, provider_total_cents, ledger_total_cents, ledger_count, matched, missing, extra, differing, passed, recorded_by, recorded_at')
        .eq('tenant_id', tenantId).eq('period', period).order('recorded_at', { ascending: false });
      if (error) throw refusal(error, 'Could not load the reconciliations.');
      return (data ?? []) as Reconciliation[];
    },
    async request(tenantId, p) {
      const { data, error } = await db
        .from('student_account_requests')
        .insert({
          tenant_id: tenantId, student_ref: p.student_ref, kind: p.kind, category: p.category, amount_cents: p.amount_cents,
          description: p.description.trim(), reference_entry_id: p.reference_entry_id, provider_ref: p.provider_ref.trim(), effective_on: p.effective_on,
        })
        .select('id')
        .single();
      if (error) throw refusal(error, 'Could not make the request.');
      return (data as { id: string }).id;
    },
    async decide(id, status, note) {
      const { data, error } = await db.from('student_account_requests').update({ status, decision_note: note }).eq('id', id).select('id');
      if (error) throw refusal(error, 'Could not record the decision.');
      if (!data || data.length === 0) throw new Error('Your account cannot decide this request.');
    },
    async withdraw(id) {
      const { data, error } = await db.from('student_account_requests').update({ status: 'withdrawn' }).eq('id', id).select('id');
      if (error) throw refusal(error, 'Could not withdraw the request.');
      if (!data || data.length === 0) throw new Error('Your account cannot withdraw this request.');
    },
    async reconcile(tenantId, period, c, sha) {
      const { error } = await db.from('student_account_reconciliations').insert({ tenant_id: tenantId, period, ...c, settlement_sha256: sha });
      if (error) throw refusal(error, 'Could not record the reconciliation.');
    },
    async close(tenantId, period, note) {
      // reconciliation_id is set by the trigger to the latest passing one; the column is required, so any value is sent.
      const { error } = await db.from('student_account_closes').insert({ tenant_id: tenantId, period, note, reconciliation_id: '00000000-0000-0000-0000-000000000000' });
      if (error) throw refusal(error, 'Could not close the month.');
    },
    plans: (tenantId, studentRef) => plansFor(db, tenantId, studentRef),
    plansWaiting: (tenantId) => plansWaiting(db, tenantId),
    planRules: (tenantId) => planRules(db, tenantId),
    decidePlan: (id, status, note) => decidePlan(db, id, status, note),
    cancelPlan: (id, note) => cancelPlan(db, id, note),
  };
}
