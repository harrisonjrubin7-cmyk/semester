/**
 * What a student's school has shared with Semester, as the student sees it:
 * registration readiness, holds, enrollment and degree-audit status, each with
 * its source, freshness, and whether it may be called official.
 *
 * Reads `canonical_entity_references` under the student's own RLS — their rows
 * and their school's tenant-wide ones, nothing else. It never says "you are
 * cleared to register": the most it says is that no hold is on record, from
 * whom, and how fresh that is. Anything not live or recent is labelled as not
 * the official current record, with the office's own link beside it.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Freshness } from './catalog';
import { freshnessFromAge, isOfficialCurrent } from './freshness';
import { evaluateFlag, type Environment, type KillSwitchRow } from '../flags';
import type { FeatureState } from '../../intelligence/contracts';

export interface RecordRow {
  id: string;
  canonical_entity_type: string;
  canonical_entity_id: string;
  subject_user_id: string | null;
  source_system: string;
  source_url: string | null;
  source_timestamp: string | null;
  source_of_truth: string;
  freshness_status: Freshness;
  updated_at: string;
  display: Record<string, unknown>;
}

/** Minutes a fact of this kind stays fresh, by the sync classes in catalog.ts. */
const TARGET_MINUTES: Record<string, number> = {
  registration_hold: 60,
  enrollment: 24 * 60,
  registration_window: 24 * 60,
  term: 24 * 60,
  course_section: 24 * 60,
  academic_requirement: 24 * 60,
};

export const SHOWN_TYPES = Object.keys(TARGET_MINUTES);

/** Stored freshness decays with age; hand-entered and estimated stay as they are. */
export function effectiveFreshness(row: RecordRow, now: Date): Freshness {
  const stored = row.freshness_status;
  if (stored === 'manual' || stored === 'estimated' || stored === 'needs_confirmation' || stored === 'unavailable') {
    return stored;
  }
  const decayed = freshnessFromAge(new Date(row.updated_at), TARGET_MINUTES[row.canonical_entity_type] ?? 24 * 60, now, true);
  const order: Freshness[] = ['live', 'recent', 'stale'];
  return order[Math.max(order.indexOf(stored), order.indexOf(decayed))] ?? decayed;
}

export interface Fact {
  id: string;
  text: string;
  source: string;
  freshness: Freshness;
  official: boolean;
  link: string | null;
  mine: boolean;
}

export interface SchoolRecordsView {
  readiness: 'blocked' | 'no_hold_on_record' | 'unknown';
  window: Fact | null;
  holds: Fact[];
  enrollment: Fact | null;
  requirements: (Fact & { met: number; inProgress: number; notMet: number }) | null;
  empty: boolean;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const httpsOrNull = (v: unknown) => (typeof v === 'string' && /^https:\/\//.test(v) ? v : null);
const day = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
};

function fact(row: RecordRow, text: string, now: Date, link?: unknown): Fact {
  const freshness = effectiveFreshness(row, now);
  return {
    id: row.id,
    text,
    source: row.source_of_truth,
    freshness,
    official: isOfficialCurrent(freshness, 'connected_institutional'),
    link: httpsOrNull(link) ?? httpsOrNull(row.source_url),
    mine: row.subject_user_id !== null,
  };
}

export function schoolRecordsView(rows: readonly RecordRow[], userId: string | null, now: Date): SchoolRecordsView {
  const live = rows.filter((r) => SHOWN_TYPES.includes(r.canonical_entity_type));
  const of = (t: string) => live.filter((r) => r.canonical_entity_type === t);

  const windows = of('registration_window')
    .filter((r) => Date.parse(str(r.display.closes_at)) > now.getTime())
    .sort((a, b) => Date.parse(str(a.display.opens_at)) - Date.parse(str(b.display.opens_at)));
  const w = windows[0];
  const window = w
    ? fact(w,
      Date.parse(str(w.display.opens_at)) > now.getTime()
        ? `Registration opens ${day(str(w.display.opens_at))}${str(w.display.audience) ? ` for ${str(w.display.audience)}` : ''}`
        : `Registration is open until ${day(str(w.display.closes_at))}`,
      now, w.display.source_url)
    : null;

  const holdRows = of('registration_hold').filter((r) => r.subject_user_id === userId);
  const holds = holdRows.map((r) =>
    fact(r, `${r.display.blocks_registration === true ? 'Action required before you can register' : 'Action required'} — ${str(r.display.office) || 'an office'}`,
      now, r.display.action_url));

  const enrolled = of('enrollment').filter((r) => r.subject_user_id === userId);
  const counted = enrolled.filter((r) => r.display.status === 'enrolled').length;
  const waitlisted = enrolled.filter((r) => r.display.status === 'waitlisted').length;
  const newest = enrolled.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const enrollment = newest
    ? fact(newest, `Enrolled in ${counted} section${counted === 1 ? '' : 's'}${waitlisted ? `, waitlisted in ${waitlisted}` : ''}`, now)
    : null;

  const reqs = of('academic_requirement').filter((r) => r.subject_user_id === userId);
  let requirements: SchoolRecordsView['requirements'] = null;
  if (reqs.length) {
    const met = reqs.filter((r) => r.display.status === 'met').length;
    const inProgress = reqs.filter((r) => r.display.status === 'in_progress').length;
    const notMet = reqs.filter((r) => r.display.status === 'not_met').length;
    const oldest = reqs.slice().sort((a, b) => a.updated_at.localeCompare(b.updated_at))[0];
    requirements = {
      ...fact(oldest, `${met} of ${reqs.length} requirements met in your degree audit`, now, oldest.display.source_url),
      met, inProgress, notMet,
    };
  }

  const blocking = holds.some((h) => h.text.startsWith('Action required before'));
  // "No hold on record" only when the hold feed is fresh enough to be believed
  // and there is a window to register in; otherwise say nothing about it.
  const readiness: SchoolRecordsView['readiness'] = blocking
    ? 'blocked'
    : window && window.official && holdRows.every((r) => isOfficialCurrent(effectiveFreshness(r, now), 'connected_institutional'))
      ? 'no_hold_on_record'
      : 'unknown';

  return { readiness, window, holds, enrollment, requirements,
    empty: !window && holds.length === 0 && !enrollment && !requirements };
}

// ── Loading, behind the flag ───────────────────────────────────────────────

export const RECORD_COLUMNS =
  'id,canonical_entity_type,canonical_entity_id,subject_user_id,source_system,source_url,source_timestamp,source_of_truth,freshness_status,updated_at,display';

export function buildEnvironment(mode: string | undefined): Environment {
  return mode === 'production' ? 'production' : 'development';
}

/**
 * Whether this school has the cards on. The tenant row is read through the
 * existing `public.feature_state`; the kill switches the student can see are
 * their school's and the global ones.
 */
export async function cardsEnabled(db: SupabaseClient, school: string, environment: Environment, now: Date): Promise<boolean> {
  if (!school) return false;
  const [{ data: state, error: stateError }, { data: switches, error: switchError }] = await Promise.all([
    db.rpc('feature_state', { want_capability: 'module.source_freshness_cards', want_tenant: school }),
    db.from('feature_kill_switch').select('switch_key,tenant_id,engaged'),
  ]);
  if (stateError || switchError) return false;
  const killSwitches: KillSwitchRow[] = (switches ?? []).map((k: { switch_key: string; tenant_id: string | null; engaged: boolean }) =>
    ({ key: k.switch_key, tenantId: k.tenant_id, engaged: k.engaged }));
  return evaluateFlag('module.source_freshness_cards', {
    environment, tenantId: school, now, killSwitches,
    tenantPolicy: { 'module.source_freshness_cards': { state: (state ?? 'off') as FeatureState } },
    capabilities: [],
  }).allowed;
}

export async function loadRecords(db: SupabaseClient): Promise<RecordRow[]> {
  const { data, error } = await db.from('canonical_entity_references')
    .select(RECORD_COLUMNS)
    .in('canonical_entity_type', SHOWN_TYPES)
    .is('external_deleted_at', null)
    .limit(500);
  if (error) throw new Error(error.message || 'Could not load what your school shared.');
  return (data ?? []) as unknown as RecordRow[];
}

/** The student's own imported records of one kind, removed now. */
export async function forgetMine(db: SupabaseClient, userId: string, type: string): Promise<number> {
  const { data, error } = await db.from('canonical_entity_references')
    .delete().eq('subject_user_id', userId).eq('canonical_entity_type', type).select('id');
  if (error) throw new Error(error.message || 'Could not delete those records.');
  return (data ?? []).length;
}

export interface IntegrationConsent { id: string; capability: string; status: string; recorded_at: string }

export async function loadConsents(db: SupabaseClient): Promise<IntegrationConsent[]> {
  const { data, error } = await db.from('consent_record')
    .select('id,capability,status,recorded_at')
    .like('capability', 'integration:%')
    .order('recorded_at', { ascending: false });
  if (error) throw new Error(error.message || 'Could not load your consents.');
  return (data ?? []) as IntegrationConsent[];
}

/** Revoking stops the next sync bringing personal records back; it deletes nothing by itself. */
export async function revokeConsent(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from('consent_record')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message || 'Could not revoke that consent.');
}

export const PURPOSE: Record<string, { label: string; why: string }> = {
  registration_hold: { label: 'Registration holds', why: 'So Today can tell you an office needs something before you register. Only the office and its link — never the reason.' },
  enrollment: { label: 'Your enrollments', why: 'So your courses in Semester match the registrar’s list.' },
  academic_requirement: { label: 'Degree-audit status', why: 'So My Path can show which requirements your official audit counts as met.' },
  registration_window: { label: 'Registration windows', why: 'Published by your registrar for everyone in your year; not about you.' },
  term: { label: 'Terms', why: 'Your school’s term dates; not about you.' },
  course_section: { label: 'Course sections', why: 'The school’s published sections; not about you.' },
};
