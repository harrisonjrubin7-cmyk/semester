/**
 * Admissions, typed, over the account service.
 *
 * `supabase/migrations/20261001060000_admissions.sql` is the authority: who
 * configures a cycle, what an applicant may do, the two-hands rule on a
 * decision, the release that makes it visible and the response and deposit that
 * follow, all only while the school runs `admissions` in Core
 * (`lib/modulemode.ts`). This file asks. A person decides every admission:
 * nothing here ranks, scores or summarises an applicant.
 */

import { cloud } from '../cloud';
import type { Grant } from '../capabilities';
import { serviceError } from '../attempt';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);

export type AdmissionsCapability = 'admissions:configure' | 'admissions:review' | 'admissions:decide' | 'admissions:read';

/** The admissions capabilities this person holds over exactly their school. */
export function admissionsCapabilities(grants: readonly Grant[], school: string): Set<AdmissionsCapability> {
  const held = new Set<AdmissionsCapability>();
  if (school === '') return held;
  for (const g of grants) {
    if (g.scopeKind === 'school' && g.scopeId === school && g.capability.startsWith('admissions:')) held.add(g.capability as AdmissionsCapability);
  }
  return held;
}

export interface Question { key: string; label: string; kind: 'text' | 'choice'; required: boolean; options?: string[] }
export interface ChecklistItem { key: string; label: string; required: boolean }

const KEY = /^[a-z0-9_]{1,40}$/;

/**
 * Questions as an author types them, one per line:
 *
 *     essay | Why this school | text | required
 *     major | Intended major | choice | optional | Econ, History
 */
export function parseQuestions(input: string): { questions: Question[] } | { error: string } {
  const out: Question[] = [];
  const lines = input.split('\n').map((l) => l.trim()).filter((l) => l !== '');
  for (const [i, line] of lines.entries()) {
    const at = `Line ${i + 1}`;
    const p = line.split('|').map((x) => x.trim());
    if (p.length < 4 || !KEY.test(p[0]) || p[1] === '') return { error: `${at}: write “key | Question | text or choice | required or optional”, with a key of lowercase letters, digits and _.` };
    if (p[2] !== 'text' && p[2] !== 'choice') return { error: `${at}: the kind is “text” or “choice”.` };
    if (p[3] !== 'required' && p[3] !== 'optional') return { error: `${at}: the fourth part is “required” or “optional”.` };
    const options = p[2] === 'choice' ? (p[4] ?? '').split(',').map((o) => o.trim()).filter((o) => o !== '') : undefined;
    if (p[2] === 'choice' && (options?.length ?? 0) < 2) return { error: `${at}: a choice needs at least two options after the fourth part.` };
    out.push({ key: p[0], label: p[1], kind: p[2], required: p[3] === 'required', ...(options ? { options } : {}) });
  }
  if (new Set(out.map((q) => q.key)).size !== out.length) return { error: 'Each question needs its own key.' };
  return { questions: out };
}

/** Checklist items, one per line: `transcript | Secondary transcript | required`. */
export function parseChecklist(input: string): { items: ChecklistItem[] } | { error: string } {
  const out: ChecklistItem[] = [];
  const lines = input.split('\n').map((l) => l.trim()).filter((l) => l !== '');
  for (const [i, line] of lines.entries()) {
    const p = line.split('|').map((x) => x.trim());
    if (p.length < 3 || !KEY.test(p[0]) || p[1] === '' || (p[2] !== 'required' && p[2] !== 'optional')) {
      return { error: `Line ${i + 1}: write “key | Document | required or optional”.` };
    }
    out.push({ key: p[0], label: p[1], required: p[2] === 'required' });
  }
  if (new Set(out.map((c) => c.key)).size !== out.length) return { error: 'Each checklist item needs its own key.' };
  return { items: out };
}

export interface Cycle {
  id: string;
  name: string;
  term: string;
  opensAt: string;
  closesAt: string;
  questions: Question[];
  checklist: ChecklistItem[];
  opened: boolean;
  closed: boolean;
}

function readCycle(r: Row): Cycle {
  return {
    id: text(r.id), name: text(r.name), term: text(r.term), opensAt: text(r.opens_at), closesAt: text(r.closes_at),
    questions: Array.isArray(r.questions) ? (r.questions as Row[]).map((q) => ({
      key: text(q.key), label: text(q.label), kind: q.kind === 'choice' ? 'choice' as const : 'text' as const, required: q.required === true,
      ...(Array.isArray(q.options) ? { options: (q.options as unknown[]).map(text) } : {}),
    })) : [],
    checklist: Array.isArray(r.checklist) ? (r.checklist as Row[]).map((c) => ({ key: text(c.key), label: text(c.label), required: c.required !== false })) : [],
    opened: r.opened_at != null, closed: r.closed_at != null,
  };
}

const CYCLE_COLUMNS = 'id,name,term,opens_at,closes_at,questions,checklist,opened_at,closed_at';

export async function loadCycles(school: string): Promise<Cycle[]> {
  const db = await cloud();
  const { data, error } = await db.from('admission_cycles').select(CYCLE_COLUMNS).eq('tenant_id', school).order('opens_at', { ascending: false });
  if (error) throw serviceError(error, 'The admission cycles could not be read.');
  return rows(data).map(readCycle);
}

export type DocState = 'none' | 'sent' | 'received' | 'waived';

export interface MyApplication {
  id: string;
  cycle: Cycle;
  status: 'draft' | 'submitted' | 'withdrawn';
  answers: Record<string, string>;
  docs: Record<string, DocState>;
  decision: { decision: 'admit' | 'deny' | 'waitlist'; conditions: string } | null;
  response: 'accept' | 'decline' | null;
  deposit: boolean;
}

/** The caller's own applications, each with its cycle, document states, a released decision, their answer and deposit. */
export async function loadMyApplications(me: string): Promise<MyApplication[]> {
  const db = await cloud();
  const { data, error } = await db.from('applications').select('id,cycle_id,status,answers').eq('applicant', me).order('created_at', { ascending: false });
  if (error) throw serviceError(error, 'Your applications could not be read.');
  const list = rows(data);
  if (list.length === 0) return [];
  const ids = list.map((r) => text(r.id));
  const [cy, docs, dec, resp, dep] = await Promise.all([
    db.from('admission_cycles').select(CYCLE_COLUMNS).in('id', list.map((r) => text(r.cycle_id))),
    db.from('application_documents').select('application_id,doc_key,version,state').in('application_id', ids),
    db.from('application_decisions').select('application_id,version,decision,conditions').in('application_id', ids),
    db.from('application_responses').select('application_id,response').in('application_id', ids),
    db.from('application_deposits').select('application_id').in('application_id', ids),
  ]);
  for (const x of [cy, docs, dec, resp, dep]) if (x.error) throw serviceError(x.error, 'Your applications could not be read.');
  const cycles = new Map(rows(cy.data).map((r) => [text(r.id), readCycle(r)]));
  return list.flatMap((r) => {
    const cycle = cycles.get(text(r.cycle_id));
    if (!cycle) return [];
    const id = text(r.id);
    const state: Record<string, { v: number; s: DocState }> = {};
    for (const d of rows(docs.data).filter((x) => text(x.application_id) === id)) {
      const v = Number(d.version) || 0;
      if (!state[text(d.doc_key)] || v > state[text(d.doc_key)].v) state[text(d.doc_key)] = { v, s: text(d.state) as DocState };
    }
    const latest = rows(dec.data).filter((x) => text(x.application_id) === id).sort((a, b) => (Number(b.version) || 0) - (Number(a.version) || 0))[0];
    const answered = rows(resp.data).find((x) => text(x.application_id) === id);
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries((r.answers ?? {}) as Record<string, unknown>)) answers[k] = text(v);
    return [{
      id, cycle, status: r.status === 'submitted' ? 'submitted' as const : r.status === 'withdrawn' ? 'withdrawn' as const : 'draft' as const,
      answers, docs: Object.fromEntries(Object.entries(state).map(([k, v]) => [k, v.s])),
      decision: latest ? { decision: text(latest.decision) as 'admit' | 'deny' | 'waitlist', conditions: text(latest.conditions) } : null,
      response: answered ? (answered.response === 'accept' ? 'accept' as const : 'decline' as const) : null,
      deposit: rows(dep.data).some((x) => text(x.application_id) === id),
    }];
  });
}

export interface OfficeApplication {
  id: string;
  applicant: string;
  status: 'draft' | 'submitted' | 'withdrawn';
  answers: Record<string, string>;
  docs: Record<string, DocState>;
  reviews: { reviewer: string; recommendation: string; notes: string; mine: boolean }[];
  decision: string | null;
  released: boolean;
  response: string | null;
  deposit: boolean;
}

export async function loadOfficeApplications(school: string, cycle: string, me: string): Promise<OfficeApplication[]> {
  const db = await cloud();
  const { data, error } = await db.from('applications').select('id,applicant,status,answers').eq('tenant_id', school).eq('cycle_id', cycle).order('created_at');
  if (error) throw serviceError(error, 'The applications could not be read.');
  const list = rows(data);
  if (list.length === 0) return [];
  const ids = list.map((r) => text(r.id));
  const [docs, rev, dec, rel, resp, dep] = await Promise.all([
    db.from('application_documents').select('application_id,doc_key,version,state').in('application_id', ids),
    db.from('application_reviews').select('application_id,reviewer,recommendation,notes').in('application_id', ids),
    db.from('application_decisions').select('application_id,version,decision').in('application_id', ids),
    db.from('application_decision_releases').select('application_id').in('application_id', ids),
    db.from('application_responses').select('application_id,response').in('application_id', ids),
    db.from('application_deposits').select('application_id').in('application_id', ids),
  ]);
  for (const x of [docs, rev, dec, rel, resp, dep]) if (x.error) throw serviceError(x.error, 'The applications could not be read.');
  return list.map((r) => {
    const id = text(r.id);
    const state: Record<string, { v: number; s: DocState }> = {};
    for (const d of rows(docs.data).filter((x) => text(x.application_id) === id)) {
      const v = Number(d.version) || 0;
      if (!state[text(d.doc_key)] || v > state[text(d.doc_key)].v) state[text(d.doc_key)] = { v, s: text(d.state) as DocState };
    }
    const latest = rows(dec.data).filter((x) => text(x.application_id) === id).sort((a, b) => (Number(b.version) || 0) - (Number(a.version) || 0))[0];
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries((r.answers ?? {}) as Record<string, unknown>)) answers[k] = text(v);
    return {
      id, applicant: text(r.applicant), status: r.status === 'submitted' ? 'submitted' as const : r.status === 'withdrawn' ? 'withdrawn' as const : 'draft' as const, answers,
      docs: Object.fromEntries(Object.entries(state).map(([k, v]) => [k, v.s])),
      reviews: rows(rev.data).filter((x) => text(x.application_id) === id).map((x) => ({
        reviewer: text(x.reviewer), recommendation: text(x.recommendation), notes: text(x.notes), mine: me !== '' && text(x.reviewer) === me,
      })),
      decision: latest ? text(latest.decision) : null,
      released: rows(rel.data).some((x) => text(x.application_id) === id),
      response: (() => { const a = rows(resp.data).find((x) => text(x.application_id) === id); return a ? text(a.response) : null; })(),
      deposit: rows(dep.data).some((x) => text(x.application_id) === id),
    };
  });
}

/** Whether every required question has an answer: what the submit button waits for. */
export function missingAnswers(cycle: Pick<Cycle, 'questions'>, answers: Record<string, string>): string[] {
  return cycle.questions.filter((q) => q.required && (answers[q.key] ?? '').trim() === '').map((q) => q.label);
}

/** Required checklist items not yet received or waived. */
export function missingDocuments(cycle: Pick<Cycle, 'checklist'>, docs: Record<string, DocState>): string[] {
  return cycle.checklist.filter((c) => c.required && docs[c.key] !== 'received' && docs[c.key] !== 'waived').map((c) => c.label);
}

// ── The writers ──────────────────────────────────────────────────────────

async function call(name: string, args: Record<string, unknown>, fallback: string): Promise<Row> {
  const db = await cloud();
  const { data, error } = await db.rpc(name, args);
  if (error) throw serviceError(error, fallback);
  return (data ?? {}) as Row;
}

export async function saveCycle(
  c: { name: string; term: string; opens: string; closes: string; questions: Question[]; checklist: ChecklistItem[] }, key: string,
): Promise<string> {
  const r = await call('admissions_cycle_save', { want_name: c.name, want_term: c.term, want_opens: c.opens, want_closes: c.closes, want_questions: c.questions, want_checklist: c.checklist, want_key: key }, 'The cycle was not saved.');
  return text(r.id);
}
export const openCycle = (id: string, key: string) => call('admissions_cycle_open', { want_cycle: id, want_key: key }, 'The cycle was not opened.');
export const closeCycle = (id: string, key: string) => call('admissions_cycle_close', { want_cycle: id, want_key: key }, 'The cycle was not closed.');
export async function startApplication(cycle: string, key: string): Promise<string> {
  return text((await call('application_start', { want_cycle: cycle, want_key: key }, 'The application was not started.')).id);
}
export async function saveAnswers(application: string, answers: Record<string, string>): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('application_save', { want_application: application, want_answers: answers });
  if (error) throw serviceError(error, 'Your answers were not saved.');
}
export const submitApplication = (id: string, key: string) => call('application_submit', { want_application: id, want_key: key }, 'The application was not submitted.');
export const withdrawApplication = (id: string, key: string) => call('application_withdraw', { want_application: id, want_key: key }, 'The application was not withdrawn.');
export const markDocument = (id: string, doc: string, state: 'sent' | 'received' | 'waived', note: string, key: string) =>
  call('application_document_mark', { want_application: id, want_doc: doc, want_state: state, want_note: note, want_key: key }, 'The document was not marked.');
export const reviewApplication = (id: string, recommendation: 'admit' | 'deny' | 'waitlist' | 'discuss', notes: string, key: string) =>
  call('application_review', { want_application: id, want_recommendation: recommendation, want_notes: notes, want_key: key }, 'The review was not saved.');
export const decideApplication = (id: string, decision: 'admit' | 'deny' | 'waitlist', reason: string, conditions: string, key: string) =>
  call('application_decide', { want_application: id, want_decision: decision, want_reason: reason, want_conditions: conditions, want_key: key }, 'The decision was not recorded.');
export async function releaseDecisions(cycle: string, key: string): Promise<number> {
  return Number((await call('admissions_release', { want_cycle: cycle, want_key: key }, 'The decisions were not released.')).released) || 0;
}
export const respondToOffer = (id: string, response: 'accept' | 'decline', key: string) =>
  call('application_respond', { want_application: id, want_response: response, want_key: key }, 'Your answer was not sent.');
export const recordDeposit = (id: string, reference: string, key: string) =>
  call('admissions_deposit_record', { want_application: id, want_reference: reference, want_key: key }, 'The deposit was not recorded.');

export interface Yield { started: number; submitted: number; withdrawn: number; admitted: number; accepted: number; deposited: number }
export async function loadYield(cycle: string): Promise<Yield> {
  const r = await call('admissions_yield', { want_cycle: cycle }, 'The counts could not be read.');
  const n = (v: unknown) => Number(v) || 0;
  return { started: n(r.started), submitted: n(r.submitted), withdrawn: n(r.withdrawn), admitted: n(r.admitted), accepted: n(r.accepted), deposited: n(r.deposited) };
}
