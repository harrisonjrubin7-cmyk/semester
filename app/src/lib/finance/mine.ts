/**
 * A student's own account at their school: the entries the school's approvers
 * posted, read under the student's RLS through the one link an approver made
 * (`academic_record_subjects`). A student sees what is posted — never a
 * request still waiting, never who approved it — and pays on the school's own
 * page, not here. The one thing a student writes is a payment plan asked for,
 * whose balance and schedule the database works out from the ledger.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_SCHOOL_PLAN, DEFAULT_SETTINGS, KIND_LABEL, aging, balance, holdStatus, livePlan, planStanding, statement,
  type AccountEntry, type Aging, type FinanceSettings, type HoldStatus, type PaymentPlanRecord, type PlanStanding,
  type SchoolPlanRules, type Statement,
} from './accounts';
import { refusal } from './api';
import { askForPlan, plansFor, withdrawPlan } from './plans';

export interface MyLink {
  tenant_id: string;
  school: string;
  student_ref: string;
}

export interface MyAccount extends MyLink {
  entries: AccountEntry[];
  settings: FinanceSettings;
  plans: PaymentPlanRecord[];
  planRules: SchoolPlanRules;
}

export interface MyAccountApi {
  /** Every school that has linked this account to its student record. */
  accounts(userId: string): Promise<MyAccount[]>;
  /** Asks the school for a plan; the database reads the balance and writes the schedule. */
  askForPlan(tenantId: string, studentRef: string, installments: number, firstDue: string): Promise<void>;
  withdrawPlan(id: string): Promise<void>;
}

// The columns a student is shown. Who requested and approved an entry is the
// school's to know; the student's screen never asks for it.
const ENTRY = 'id, tenant_id, student_ref, kind, category, amount_cents, description, reference_entry_id, provider_ref, effective_on, period, request_id, high_value, recorded_at';

export function myAccountApi(db: SupabaseClient): MyAccountApi {
  return {
    async accounts(userId) {
      // Filtered to this account as well as by RLS: a staff member who is
      // also a student reads every link at their school, and this screen is
      // only ever about their own.
      const links = await db.from('academic_record_subjects').select('tenant_id, student_ref').eq('user_id', userId);
      if (links.error) throw refusal(links.error, 'Could not find your school’s account.');
      const mine = (links.data ?? []) as { tenant_id: string; student_ref: string }[];
      if (mine.length === 0) return [];
      const tenants = [...new Set(mine.map((l) => l.tenant_id))];
      const [schools, settings] = await Promise.all([
        db.from('schools').select('id, name').in('id', tenants),
        db.from('student_account_settings')
          .select('tenant_id, high_value_cents, hold_after_days, hold_minimum_cents, plans_offered, plan_min_down_percent, plan_max_installments, plan_min_installment_cents')
          .in('tenant_id', tenants),
      ]);
      if (schools.error) throw refusal(schools.error, 'Could not read your school.');
      if (settings.error) throw refusal(settings.error, 'Could not read your school’s hold rule.');
      const names = new Map(((schools.data ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));
      type Row = FinanceSettings & { tenant_id: string; plans_offered?: boolean; plan_min_down_percent?: number; plan_max_installments?: number; plan_min_installment_cents?: number };
      const rules = new Map(((settings.data ?? []) as Row[]).map((s) => [s.tenant_id, s]));
      return Promise.all(mine.map(async (l) => {
        const { data, error } = await db.from('student_account_entries').select(ENTRY)
          .eq('tenant_id', l.tenant_id).eq('student_ref', l.student_ref).order('effective_on').order('recorded_at');
        if (error) throw refusal(error, 'Could not load your account.');
        const plans = await plansFor(db, l.tenant_id, l.student_ref);
        const r = rules.get(l.tenant_id);
        return {
          ...l,
          school: names.get(l.tenant_id) ?? l.tenant_id,
          entries: ((data ?? []) as Omit<AccountEntry, 'requested_by' | 'approved_by'>[]).map((e) => ({ ...e, requested_by: null, approved_by: null })),
          settings: r ? { high_value_cents: r.high_value_cents, hold_after_days: r.hold_after_days, hold_minimum_cents: r.hold_minimum_cents } : DEFAULT_SETTINGS,
          plans,
          planRules: r
            ? {
              offered: r.plans_offered ?? DEFAULT_SCHOOL_PLAN.offered,
              min_down_percent: r.plan_min_down_percent ?? DEFAULT_SCHOOL_PLAN.min_down_percent,
              max_installments: r.plan_max_installments ?? DEFAULT_SCHOOL_PLAN.max_installments,
              min_installment_cents: Number(r.plan_min_installment_cents ?? DEFAULT_SCHOOL_PLAN.min_installment_cents),
            }
            : DEFAULT_SCHOOL_PLAN,
        };
      }));
    },
    async askForPlan(tenantId, studentRef, installments, firstDue) {
      await askForPlan(db, tenantId, studentRef, installments, firstDue);
    },
    withdrawPlan: (id) => withdrawPlan(db, id),
  };
}

export interface MyView {
  owed: number;
  age: Aging;
  hold: HoldStatus;
  /** The plan asked for or agreed, if any, and — once agreed — whether it is being kept. */
  plan: PaymentPlanRecord | null;
  standing: PlanStanding | null;
  /** Months with an entry, newest first: the statements there are to read. */
  periods: string[];
  /** The statement shown first: this month's, else the latest before it, else the first there is. */
  period: string | null;
  /** Charges effective after today: on the account, not yet due. */
  upcoming: number;
  /** What the student reads first, in a sentence. */
  headline: string;
  /** A second sentence when there is something to do, and who to ask. */
  next: string | null;
}

/**
 * What a student is shown about one account on one day. Every figure comes
 * from `accounts.ts`, the functions the bursar's screen uses, so the two can
 * never disagree about a balance or a hold.
 */
export function myView(a: MyAccount, today: string): MyView {
  const owed = balance(a.entries, today);
  const age = aging(a.entries, today);
  const plan = livePlan(a.plans);
  const standing = plan && plan.status === 'approved' ? planStanding(plan, a.entries, today) : null;
  const hold = holdStatus(a.entries, today, a.settings, standing);
  const periods = [...new Set(a.entries.map((e) => e.period))].sort().reverse();
  const period = periods.find((p) => p <= today.slice(0, 7)) ?? periods[periods.length - 1] ?? null;
  const upcoming = balance(a.entries.filter((e) => e.effective_on > today && e.amount_cents > 0));
  const headline = a.entries.length === 0
    ? 'Nothing has been posted to your account yet.'
    : owed > 0 ? 'You owe your school this today.'
      : owed < 0 ? 'Your account is in credit.' : 'Your account is settled.';
  const overdue = age.d31_60 + age.d61_90 + age.over90;
  const next = standing?.state === 'behind'
    ? 'Your payment plan is behind. Pay what is late on your school’s own page, or talk to Student Accounts before they cancel the plan.'
    : hold.held
    ? `A financial hold applies: more than ${a.settings.hold_after_days} days overdue. Pay on your school’s own page, or ask for a payment plan below.`
    : standing ? null
    : overdue > 0
      ? `Part of this is more than 30 days old. A hold applies once more than the school’s minimum is over ${a.settings.hold_after_days} days old.`
      : owed < 0 ? 'A credit is refunded or carried forward by Student Accounts; ask them which.' : null;
  return { owed, age, hold, plan, standing, periods, period, upcoming, headline, next };
}

/**
 * What an entry is, for the student: the kind, or for aid the category that
 * names it ("Scholarship"), which is what a student calls it.
 */
export function whatItIs(e: AccountEntry): string {
  const kind = e.kind === 'aid_credit' ? e.category.charAt(0).toUpperCase() + e.category.slice(1) : KIND_LABEL[e.kind];
  return `${kind}: ${e.description}`;
}

/** The statement for a month, as the ledger reads today. */
export const myStatement = (a: MyAccount, period: string): Statement => statement(a.entries, a.student_ref, period);
