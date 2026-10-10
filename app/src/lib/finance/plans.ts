/**
 * Payment plans' client: `student_payment_plans` and their schedules
 * (`20260929230000_student_payment_plans.sql`), under the caller's RLS. The
 * student's screen and the bursar's both read through here, so a plan reads
 * the same on both. Nothing here writes a schedule: the database does, from
 * the ledger's balance, when a plan is asked for.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_SCHOOL_PLAN, type Installment, type PaymentPlanRecord, type PlanStatus, type SchoolPlanRules } from './accounts';
import { refusal } from './api';
import { submitFinanceCommand, type FinanceCommandReceipt } from './commands';

// Who decided or cancelled a plan is the school's to know; neither screen asks.
const PLAN = 'id, tenant_id, student_ref, installments, first_due, balance_cents, status, requested_by, requested_at, decided_at, decision_note, cancelled_at, cancel_note';

type PlanRow = Omit<PaymentPlanRecord, 'schedule'>;

async function withSchedules(db: SupabaseClient, rows: PlanRow[]): Promise<PaymentPlanRecord[]> {
  if (rows.length === 0) return [];
  const { data, error } = await db.from('student_payment_plan_installments').select('plan_id, seq, due_on, cents')
    .in('plan_id', rows.map((r) => r.id)).order('seq');
  if (error) throw refusal(error, 'Could not read the plan’s schedule.');
  const by = new Map<string, Installment[]>();
  for (const i of (data ?? []) as { plan_id: string; seq: number; due_on: string; cents: number }[]) {
    by.set(i.plan_id, [...(by.get(i.plan_id) ?? []), { due_on: i.due_on, cents: Number(i.cents) }]);
  }
  return rows.map((r) => ({ ...r, balance_cents: Number(r.balance_cents), schedule: by.get(r.id) ?? [] }));
}

/** Every plan on one student's account, newest first. */
export async function plansFor(db: SupabaseClient, tenantId: string, studentRef: string): Promise<PaymentPlanRecord[]> {
  const { data, error } = await db.from('student_payment_plans').select(PLAN)
    .eq('tenant_id', tenantId).eq('student_ref', studentRef).order('requested_at', { ascending: false });
  if (error) throw refusal(error, 'Could not read the payment plans.');
  return withSchedules(db, (data ?? []) as PlanRow[]);
}

/** A school's plans asked for and not yet decided, oldest first. */
export async function plansWaiting(db: SupabaseClient, tenantId: string): Promise<PaymentPlanRecord[]> {
  const { data, error } = await db.from('student_payment_plans').select(PLAN)
    .eq('tenant_id', tenantId).eq('status', 'proposed').order('requested_at');
  if (error) throw refusal(error, 'Could not read the plans waiting for a decision.');
  return withSchedules(db, (data ?? []) as PlanRow[]);
}

/** The school's plan rules, or the defaults the database applies when it has set none. */
export async function planRules(db: SupabaseClient, tenantId: string): Promise<SchoolPlanRules> {
  const { data, error } = await db.from('student_account_settings')
    .select('plans_offered, plan_min_down_percent, plan_max_installments, plan_min_installment_cents').eq('tenant_id', tenantId).maybeSingle();
  if (error) throw refusal(error, 'Could not read the school’s plan rules.');
  const r = data as { plans_offered: boolean; plan_min_down_percent: number; plan_max_installments: number; plan_min_installment_cents: number } | null;
  return r
    ? { offered: r.plans_offered, min_down_percent: r.plan_min_down_percent, max_installments: r.plan_max_installments, min_installment_cents: Number(r.plan_min_installment_cents) }
    : DEFAULT_SCHOOL_PLAN;
}

/** Asks for a plan. The database reads the balance and writes the schedule; its refusal comes back as it said it. */
export async function askForPlan(
  db: SupabaseClient, tenantId: string, studentRef: string, installments: number, firstDue: string, commandKey: string,
): Promise<FinanceCommandReceipt> {
  return submitFinanceCommand(db, tenantId, studentRef, 'plan.request', commandKey, null, {
    installments, first_due: firstDue,
  });
}

async function setPlan(db: SupabaseClient, id: string, patch: Record<string, unknown>, nobody: string): Promise<void> {
  const { data, error } = await db.from('student_payment_plans').update(patch).eq('id', id).select('id');
  if (error) throw refusal(error, 'Could not change the plan.');
  if (!data || data.length === 0) throw new Error(nobody);
}

export const withdrawPlan = (db: SupabaseClient, id: string) =>
  setPlan(db, id, { status: 'withdrawn' as PlanStatus }, 'Your account cannot withdraw this plan.');
export const decidePlan = (db: SupabaseClient, id: string, status: 'approved' | 'rejected', note: string) =>
  setPlan(db, id, { status, decision_note: note.trim() }, 'Your account cannot decide this plan.');
export const cancelPlan = (db: SupabaseClient, id: string, note: string) =>
  setPlan(db, id, { status: 'cancelled' as PlanStatus, cancel_note: note.trim() }, 'Your account cannot cancel this plan.');
