/**
 * Financial-aid records, typed, over the account service.
 *
 * `supabase/migrations/20261001070000_financial_aid.sql` is the authority: an
 * offer a second person approves, the student's answer to each part, a
 * disbursement record, and satisfactory academic progress as a rule applied to
 * the academic record with a determination a person makes, all only while the
 * school runs `financial_aid` in Core (`lib/modulemode.ts`). This file asks.
 * Nothing here moves money, packages by formula or predicts a student's aid.
 */

import { cloud } from '../cloud';
import type { Grant } from '../capabilities';
import { serviceError } from '../attempt';
import { formatNumber } from '../locale';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);
const num = (v: unknown): number | null => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

export type AidCapability = 'aid:propose' | 'aid:approve' | 'aid:disburse' | 'aid:evaluate' | 'aid:determine' | 'aid:read';

/** The aid capabilities this person holds over exactly their school. */
export function aidCapabilities(grants: readonly Grant[], school: string): Set<AidCapability> {
  const held = new Set<AidCapability>();
  if (school === '') return held;
  for (const g of grants) {
    if (g.scopeKind === 'school' && g.scopeId === school && g.capability.startsWith('aid:')) held.add(g.capability as AidCapability);
  }
  return held;
}

export type ComponentKind = 'grant' | 'scholarship' | 'loan' | 'work_study';
export const KIND_WORDS: Record<ComponentKind, string> = { grant: 'Grant', scholarship: 'Scholarship', loan: 'Loan', work_study: 'Work-study' };
export interface Component { key: string; kind: ComponentKind; name: string; amount_cents: number }

/** Dollars and cents as typed (`3,000`, `3000.5`, `$550.00`) to whole cents, or null. */
export function toCents(input: string): number | null {
  const t = input.replace(/[$,\s]/g, '');
  if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  return cents > 0 && cents <= 999999999 ? cents : null;
}

export const dollars = (cents: number): string => `$${formatNumber(cents / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Components one per line: `pell | grant | Pell Grant | 3,000.00`. */
export function parseComponents(input: string): { components: Component[] } | { error: string } {
  const out: Component[] = [];
  const lines = input.split('\n').map((l) => l.trim()).filter((l) => l !== '');
  if (lines.length === 0) return { error: 'Add at least one component.' };
  for (const [i, line] of lines.entries()) {
    const p = line.split('|').map((x) => x.trim());
    if (p.length !== 4 || !/^[a-z0-9_]{1,40}$/.test(p[0]) || p[2] === '') return { error: `Line ${i + 1}: write “key | kind | name | amount”, with a key of lowercase letters, digits and _.` };
    if (!(p[1] in KIND_WORDS)) return { error: `Line ${i + 1}: the kind is grant, scholarship, loan or work_study.` };
    const cents = toCents(p[3]);
    if (cents === null) return { error: `Line ${i + 1}: “${p[3]}” is not an amount in dollars.` };
    out.push({ key: p[0], kind: p[1] as ComponentKind, name: p[2], amount_cents: cents });
  }
  if (new Set(out.map((c) => c.key)).size !== out.length) return { error: 'Each component needs its own key.' };
  return { components: out };
}

export interface OfferVersion {
  id: string;
  offerId: string;
  studentRef: string;
  aidYear: string;
  version: number;
  components: Component[];
  note: string;
  approved: boolean;
  latest: boolean;
  proposedByMe: boolean;
  answers: Record<string, 'accept' | 'decline'>;
  disbursed: Record<string, number>;
}

const readComponents = (v: unknown): Component[] => rows(v).map((c) => ({
  key: text(c.key), kind: (text(c.kind) in KIND_WORDS ? text(c.kind) : 'grant') as ComponentKind, name: text(c.name), amount_cents: Number(c.amount_cents) || 0,
}));

/** Every offer version the caller can read, with approvals, answers and disbursed totals. A student reads only approved ones. */
export async function loadOffers(school: string, me: string): Promise<OfferVersion[]> {
  const db = await cloud();
  const { data: offers, error } = await db.from('aid_offers').select('id,student_ref,aid_year').eq('tenant_id', school);
  if (error) throw serviceError(error, 'The offers could not be read.');
  const list = rows(offers);
  if (list.length === 0) return [];
  const [vers, appr, resp, disb] = await Promise.all([
    db.from('aid_offer_versions').select('id,offer_id,version,components,note,proposed_by').eq('tenant_id', school).order('version'),
    db.from('aid_offer_approvals').select('offer_version_id').eq('tenant_id', school),
    db.from('aid_offer_responses').select('offer_version_id,component_key,response').eq('tenant_id', school),
    db.from('aid_disbursements').select('offer_version_id,component_key,amount_cents').eq('tenant_id', school),
  ]);
  for (const x of [vers, appr, resp, disb]) if (x.error) throw serviceError(x.error, 'The offers could not be read.');
  const by = new Map(list.map((o) => [text(o.id), o]));
  const approved = new Set(rows(appr.data).map((a) => text(a.offer_version_id)));
  const newest = new Map<string, number>();
  for (const v of rows(vers.data)) newest.set(text(v.offer_id), Math.max(newest.get(text(v.offer_id)) ?? 0, Number(v.version) || 0));
  return rows(vers.data).flatMap((v) => {
    const o = by.get(text(v.offer_id));
    if (!o) return [];
    const id = text(v.id);
    const answers: Record<string, 'accept' | 'decline'> = {};
    for (const r of rows(resp.data).filter((x) => text(x.offer_version_id) === id)) answers[text(r.component_key)] = r.response === 'accept' ? 'accept' : 'decline';
    const disbursed: Record<string, number> = {};
    for (const d of rows(disb.data).filter((x) => text(x.offer_version_id) === id)) disbursed[text(d.component_key)] = (disbursed[text(d.component_key)] ?? 0) + (Number(d.amount_cents) || 0);
    return [{
      id, offerId: text(v.offer_id), studentRef: text(o.student_ref), aidYear: text(o.aid_year), version: Number(v.version) || 1,
      components: readComponents(v.components), note: text(v.note), approved: approved.has(id), latest: (Number(v.version) || 0) === newest.get(text(v.offer_id)),
      proposedByMe: me !== '' && text(v.proposed_by) === me, answers, disbursed,
    }];
  });
}

export interface Standing {
  id: string;
  studentRef: string;
  aidYear: string;
  determination: 'satisfactory' | 'warning' | 'suspended' | 'reinstated';
  reason: string;
  decidedAt: string;
}

export async function loadStandings(school: string): Promise<Standing[]> {
  const db = await cloud();
  const { data, error } = await db.from('aid_sap_determinations').select('id,student_ref,aid_year,determination,reason,decided_at').eq('tenant_id', school).order('decided_at', { ascending: false });
  if (error) throw serviceError(error, 'The standings could not be read.');
  return rows(data).map((r) => ({
    id: text(r.id), studentRef: text(r.student_ref), aidYear: text(r.aid_year),
    determination: (['satisfactory', 'warning', 'suspended', 'reinstated'].includes(text(r.determination)) ? text(r.determination) : 'warning') as Standing['determination'],
    reason: text(r.reason), decidedAt: text(r.decided_at),
  }));
}

export interface Evaluation {
  id: string;
  studentRef: string;
  gpa: number | null;
  attempted: number;
  earned: number;
  completionPct: number | null;
  meetsGpa: boolean;
  meetsCompletion: boolean;
  evaluatedAt: string;
  mine: boolean;
}

export async function loadEvaluations(school: string, me: string): Promise<Evaluation[]> {
  const db = await cloud();
  const { data, error } = await db.from('aid_sap_evaluations').select('id,student_ref,gpa,attempted,earned,completion_pct,meets_gpa,meets_completion,evaluated_at,evaluated_by')
    .eq('tenant_id', school).order('evaluated_at', { ascending: false }).limit(50);
  if (error) throw serviceError(error, 'The evaluations could not be read.');
  return rows(data).map((r) => ({
    id: text(r.id), studentRef: text(r.student_ref), gpa: num(r.gpa), attempted: Number(r.attempted) || 0, earned: Number(r.earned) || 0,
    completionPct: num(r.completion_pct), meetsGpa: r.meets_gpa === true, meetsCompletion: r.meets_completion === true,
    evaluatedAt: text(r.evaluated_at), mine: me !== '' && text(r.evaluated_by) === me,
  }));
}

// ── The writers ──────────────────────────────────────────────────────────

async function call(name: string, args: Record<string, unknown>, fallback: string): Promise<Row> {
  const db = await cloud();
  const { data, error } = await db.rpc(name, args);
  if (error) throw serviceError(error, fallback);
  return (data ?? {}) as Row;
}

export const proposeOffer = (student: string, year: string, components: readonly Component[], note: string, key: string) =>
  call('aid_offer_propose', { want_student: student, want_year: year, want_components: components, want_note: note, want_key: key }, 'The offer was not saved.');
export const approveOffer = (version: string, key: string) => call('aid_offer_approve', { want_version: version, want_key: key }, 'The offer was not approved.');
export const respondToComponent = (version: string, component: string, response: 'accept' | 'decline', key: string) =>
  call('aid_offer_respond', { want_version: version, want_component: component, want_response: response, want_key: key }, 'Your answer was not sent.');
export const disburse = (version: string, component: string, term: string, cents: number, reference: string, key: string) =>
  call('aid_disburse', { want_version: version, want_component: component, want_term: term, want_amount_cents: cents, want_reference: reference, want_key: key }, 'The disbursement was not recorded.');
export const setPolicy = (minGpa: number, minCompletion: number, note: string, key: string) =>
  call('aid_sap_policy_set', { want_min_gpa: minGpa, want_min_completion: minCompletion, want_note: note, want_key: key }, 'The policy was not saved.');
export async function evaluateProgress(student: string, key: string): Promise<{ gpa: number | null; completion: number | null; meetsGpa: boolean; meetsCompletion: boolean; withoutEntry: number }> {
  const r = await call('aid_sap_evaluate', { want_student: student, want_key: key }, 'The evaluation could not be run.');
  return { gpa: num(r.gpa), completion: num(r.completion_pct), meetsGpa: r.meets_gpa === true, meetsCompletion: r.meets_completion === true, withoutEntry: Number(r.credits_without_an_entry) || 0 };
}
export const determine = (evaluation: string, year: string, determination: Standing['determination'], reason: string, key: string) =>
  call('aid_sap_determine', { want_evaluation: evaluation, want_year: year, want_determination: determination, want_reason: reason, want_key: key }, 'The determination was not recorded.');
