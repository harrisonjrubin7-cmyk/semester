/**
 * Question banks and timed tests, typed, over the account service.
 *
 * `supabase/migrations/20261001030000_assessments.sql` is the authority: who
 * writes a bank and a test, who may take it, the clock (the server's), what an
 * answer must look like, scoring, and that a student is never sent a key. All
 * only while the school runs `lms_assessments` in Core (`lib/modulemode.ts`).
 * This file asks. Every writer raises to refuse (a `ServiceError` carrying the
 * server's sentence); saving an answer past the deadline is *answered*
 * (`{ ok: false, reason: 'time_up' }`) so the finish is kept.
 *
 * There is no proctoring here and there will not be: nothing records where a
 * student looked, which window they were in, or anything about their face or
 * voice (DO-NOT-BUILD).
 */

import { cloud } from '../cloud';
import type { Grant } from '../capabilities';
import { serviceError } from '../attempt';
import type { ItemKind, QtiItem } from './qti3';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);

export interface Offering {
  course: string;
  term: string;
}
const CODE = /^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$/;
const TERM = /^[0-9]{4}(FA|SP|SU)$/;
export const offeringKey = (o: Offering): string => `${o.course}|${o.term}`;

/** Courses this person writes tests for and ones they take tests in, each over exactly `<school>/<CODE>/<TERM>`. */
export function testOfferings(grants: readonly Grant[], school: string): { writing: Offering[]; taking: Offering[] } {
  const writing = new Map<string, Offering>();
  const taking = new Map<string, Offering>();
  const prefix = `${school}/`;
  for (const g of grants) {
    if (school === '' || g.scopeKind !== 'course' || !g.scopeId.startsWith(prefix)) continue;
    const parts = g.scopeId.slice(prefix.length).split('/');
    if (parts.length !== 2 || !CODE.test(parts[0]) || !TERM.test(parts[1])) continue;
    const o = { course: parts[0], term: parts[1] };
    if (g.capability === 'assessments:author') writing.set(offeringKey(o), o);
    if (g.capability === 'assessments:take') taking.set(offeringKey(o), o);
  }
  const by = (a: Offering, b: Offering) => (a.term === b.term ? a.course.localeCompare(b.course) : b.term.localeCompare(a.term));
  return { writing: [...writing.values()].sort(by), taking: [...taking.values()].sort(by) };
}

export const KIND_WORDS: Record<ItemKind, string> = {
  multiple_choice: 'Multiple choice', multiple_response: 'Select all that apply', true_false: 'True or false',
  numeric: 'Number', short_answer: 'Short answer', essay: 'Essay',
};

export interface Bank { id: string; title: string }
export interface BankItem {
  id: string; bankId: string; kind: ItemKind; stem: string; options: { id: string; text: string }[];
  key: Record<string, unknown>; points: number; retired: boolean;
}
export interface Test {
  id: string; bankId: string; title: string; instructions: string; poolSize: number | null; itemCount: number;
  minutes: number; opensAt: string; closesAt: string; attempts: number; showAnswers: boolean; status: 'draft' | 'published' | 'closed';
}

const KINDS: readonly string[] = ['multiple_choice', 'multiple_response', 'true_false', 'numeric', 'short_answer', 'essay'];

export async function loadBanks(school: string, course: string, term: string): Promise<Bank[]> {
  const db = await cloud();
  const { data, error } = await db.from('question_banks').select('id,title').eq('tenant_id', school).eq('course_code', course).eq('term', term).order('created_at');
  if (error) throw serviceError(error, 'The banks could not be read.');
  return rows(data).map((r) => ({ id: text(r.id), title: text(r.title) }));
}

/** Items with their keys: row-level security returns them only to the course's reviewers. */
export async function loadItems(bankId: string): Promise<BankItem[]> {
  const db = await cloud();
  const { data, error } = await db.from('bank_items').select('id,bank_id,kind,stem,options,answer_key,points,retired_at').eq('bank_id', bankId).order('created_at');
  if (error) throw serviceError(error, 'The questions could not be read.');
  return rows(data).filter((r) => KINDS.includes(text(r.kind))).map((r) => ({
    id: text(r.id), bankId: text(r.bank_id), kind: r.kind as ItemKind, stem: text(r.stem),
    options: Array.isArray(r.options) ? (r.options as { id: string; text: string }[]) : [],
    key: (r.answer_key ?? {}) as Record<string, unknown>, points: Number(r.points) || 1, retired: r.retired_at != null,
  }));
}

export async function loadTests(school: string, course: string, term: string): Promise<Test[]> {
  const db = await cloud();
  const { data, error } = await db
    .from('assessments')
    .select('id,bank_id,title,instructions,item_ids,pool_size,minutes,opens_at,closes_at,attempts_allowed,show_answers,status')
    .eq('tenant_id', school).eq('course_code', course).eq('term', term).order('opens_at', { ascending: false });
  if (error) throw serviceError(error, 'The tests could not be read.');
  return rows(data).map((r) => ({
    id: text(r.id), bankId: text(r.bank_id), title: text(r.title), instructions: text(r.instructions),
    poolSize: r.pool_size == null ? null : Number(r.pool_size), itemCount: Array.isArray(r.item_ids) ? r.item_ids.length : Number(r.pool_size) || 0,
    minutes: Number(r.minutes) || 0, opensAt: text(r.opens_at), closesAt: text(r.closes_at), attempts: Number(r.attempts_allowed) || 1,
    showAnswers: r.show_answers === true, status: r.status === 'published' || r.status === 'closed' ? r.status : 'draft',
  }));
}

export interface AttemptRow {
  id: string; assessmentId: string; attempt: number; startedAt: string; deadlineAt: string;
  status: 'in_progress' | 'submitted' | 'expired'; score: number | null; points: number | null; needsReview: boolean;
}

/** The caller's own attempts; a reviewer's reads every student's. */
export async function loadAttempts(assessmentIds: readonly string[]): Promise<AttemptRow[]> {
  if (assessmentIds.length === 0) return [];
  const db = await cloud();
  const { data, error } = await db
    .from('assessment_attempts')
    .select('id,assessment_id,attempt,started_at,deadline_at,status,score,points,needs_review')
    .in('assessment_id', [...assessmentIds]).order('started_at', { ascending: false });
  if (error) throw serviceError(error, 'The attempts could not be read.');
  return rows(data).map((r) => ({
    id: text(r.id), assessmentId: text(r.assessment_id), attempt: Number(r.attempt) || 1, startedAt: text(r.started_at), deadlineAt: text(r.deadline_at),
    status: r.status === 'submitted' || r.status === 'expired' ? r.status : 'in_progress',
    score: r.score == null ? null : Number(r.score), points: r.points == null ? null : Number(r.points), needsReview: r.needs_review === true,
  }));
}

// ── The instructor's writers ────────────────────────────────────────────

export async function createBank(course: string, term: string, title: string, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('assessment_bank_create', { want_course: course, want_term: term, want_title: title, want_key: key });
  if (error) throw serviceError(error, 'The bank was not created.');
  return text(data);
}

export async function addItem(bankId: string, item: QtiItem, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('assessment_bank_add_item', {
    want_bank: bankId, want_kind: item.kind, want_stem: item.stem, want_options: item.options, want_answer_key: item.key, want_points: item.points, want_key: key,
  });
  if (error) throw serviceError(error, 'The question was not added.');
  return text(data);
}

export async function retireItem(id: string, key: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('assessment_bank_retire_item', { want_item: id, want_key: key });
  if (error) throw serviceError(error, 'The question was not retired.');
}

export interface NewTest {
  title: string; instructions: string; itemIds: string[] | null; poolSize: number | null; minutes: number;
  opensAt: string; closesAt: string; attempts: number; shuffle: boolean; showAnswers: boolean;
}

export async function createTest(bankId: string, t: NewTest, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('assessment_create', {
    want_bank: bankId, want_title: t.title, want_instructions: t.instructions, want_item_ids: t.itemIds, want_pool_size: t.poolSize,
    want_minutes: t.minutes, want_opens: t.opensAt, want_closes: t.closesAt, want_attempts: t.attempts, want_shuffle: t.shuffle,
    want_show_answers: t.showAnswers, want_key: key,
  });
  if (error) throw serviceError(error, 'The test was not created.');
  return text(data);
}

export async function publishTest(id: string, key: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('assessment_publish', { want_id: id, want_key: key });
  if (error) throw serviceError(error, 'The test was not published.');
}

export async function closeTest(id: string, key: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('assessment_close', { want_id: id, want_key: key });
  if (error) throw serviceError(error, 'The test was not closed.');
}

export async function grantTime(testId: string, student: string, percent: number, reason: string, key: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('assessment_grant_time', { want_assessment: testId, want_student: student, want_percent: percent, want_reason: reason, want_key: key });
  if (error) throw serviceError(error, 'The extra time was not granted.');
}

// ── Taking a test ───────────────────────────────────────────────────────

export interface Started { attemptId: string; attempt: number; startedAt: string; deadlineAt: string; resumed: boolean }

export async function startTest(testId: string, key: string): Promise<Started> {
  const db = await cloud();
  const { data, error } = await db.rpc('assessment_start', { want_assessment: testId, want_key: key });
  if (error) throw serviceError(error, 'The test was not started.');
  const r = (data ?? {}) as Row;
  return { attemptId: text(r.attempt_id), attempt: Number(r.attempt) || 1, startedAt: text(r.started_at), deadlineAt: text(r.deadline_at), resumed: r.resumed === true };
}

export interface TakeItem { id: string; kind: ItemKind; stem: string; options: { id: string; text: string }[]; points: number }
export type Answer = Record<string, unknown>;
export interface Sheet {
  status: 'in_progress' | 'submitted' | 'expired';
  deadlineAt: string | null;
  remainingSeconds: number;
  items: TakeItem[];
  answers: Record<string, Answer>;
  score: number | null;
  points: number | null;
  needsReview: boolean;
}

/** The questions of an attempt in progress, with no key, the time left and answers already saved. */
export async function loadSheet(attemptId: string): Promise<Sheet> {
  const db = await cloud();
  const { data, error } = await db.rpc('assessment_items', { want_attempt: attemptId });
  if (error) throw serviceError(error, 'The test could not be loaded.');
  const r = (data ?? {}) as Row;
  const status = r.status === 'submitted' || r.status === 'expired' ? r.status : 'in_progress';
  return {
    status, deadlineAt: r.deadline_at == null ? null : text(r.deadline_at), remainingSeconds: Number(r.remaining_seconds) || 0,
    items: rows(r.items).filter((i) => KINDS.includes(text(i.kind))).map((i) => ({
      id: text(i.id), kind: i.kind as ItemKind, stem: text(i.stem), options: Array.isArray(i.options) ? (i.options as { id: string; text: string }[]) : [], points: Number(i.points) || 1,
    })),
    answers: (r.answers ?? {}) as Record<string, Answer>,
    score: r.score == null ? null : Number(r.score), points: r.points == null ? null : Number(r.points), needsReview: r.needs_review === true,
  };
}

/** `{ ok: false, reason: 'time_up' }` when the deadline passed: the attempt was finished with what was saved. */
export async function saveAnswer(attemptId: string, itemId: string, answer: Answer): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await cloud();
  const { data, error } = await db.rpc('assessment_save_answer', { want_attempt: attemptId, want_item: itemId, want_answer: answer });
  if (error) throw serviceError(error, 'That answer was not saved.');
  const r = (data ?? {}) as Row;
  return r.ok === true ? { ok: true } : { ok: false, reason: text(r.reason) || 'time_up' };
}

export interface Finished { status: 'submitted' | 'expired'; score: number; points: number; needsReview: boolean }

export async function finishTest(attemptId: string, key: string): Promise<Finished> {
  const db = await cloud();
  const { data, error } = await db.rpc('assessment_finish', { want_attempt: attemptId, want_key: key });
  if (error) throw serviceError(error, 'The test was not submitted.');
  const r = (data ?? {}) as Row;
  return { status: r.status === 'expired' ? 'expired' : 'submitted', score: Number(r.score) || 0, points: Number(r.points) || 0, needsReview: r.needs_review === true };
}

export interface Review {
  status: string; score: number | null; points: number | null; needsReview: boolean; shown: boolean;
  items: { id: string; kind: ItemKind; stem: string; options: { id: string; text: string }[]; answer: Answer | null; correct?: boolean | null; awarded?: number | null; points?: number; key?: Record<string, unknown> }[];
}

export async function loadReview(attemptId: string): Promise<Review> {
  const db = await cloud();
  const { data, error } = await db.rpc('assessment_review', { want_attempt: attemptId });
  if (error) throw serviceError(error, 'The review could not be loaded.');
  const r = (data ?? {}) as Row;
  return {
    status: text(r.status), score: r.score == null ? null : Number(r.score), points: r.points == null ? null : Number(r.points), needsReview: r.needs_review === true, shown: r.shown === true,
    items: rows(r.items).filter((i) => KINDS.includes(text(i.kind))).map((i) => ({
      id: text(i.id), kind: i.kind as ItemKind, stem: text(i.stem), options: Array.isArray(i.options) ? (i.options as { id: string; text: string }[]) : [],
      answer: (i.answer ?? null) as Answer | null, correct: i.correct as boolean | null | undefined, awarded: i.awarded == null ? null : Number(i.awarded),
      points: i.points == null ? undefined : Number(i.points), key: i.key as Record<string, unknown> | undefined,
    })),
  };
}

/** Whether an answer holds anything, so an empty box is not saved as an answer. */
export function answered(kind: ItemKind, a: Answer | undefined): boolean {
  if (!a) return false;
  if (kind === 'multiple_choice') return typeof a.choice === 'string' && a.choice !== '';
  if (kind === 'multiple_response') return Array.isArray(a.choices) && a.choices.length > 0;
  if (kind === 'true_false') return typeof a.value === 'boolean';
  if (kind === 'numeric') return typeof a.value === 'number' && Number.isFinite(a.value);
  return typeof a.text === 'string' && a.text.trim() !== '';
}

/** mm:ss for a count of seconds. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
