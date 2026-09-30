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
import { readNarrowing } from '../featurepolicy';
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
  appointment: 60,
  referral: 60,
  // A campus alert (tenant-wide) is 15 minutes; a bursar action item (the
  // student's own) is a day. Same canonical type, told apart by whose it is.
  notification: 15,
  internship: 24 * 60,
  job: 24 * 60,
  event: 24 * 60,
  // Free and busy room slots: ten minutes, because an hour-old "free" is a
  // walk across campus to a taken room.
  study_space: 24 * 60,
  space_availability: 10,
};

/**
 * Room types are loaded on their own (`loadRoomRecords`): a school's free and
 * busy slots run to hundreds of tenant-wide rows, and sharing one capped query
 * with a student's holds and alerts would let the slots crowd those out.
 */
export const ROOM_TYPES = ['study_space', 'space_availability'];

export const SHOWN_TYPES = Object.keys(TARGET_MINUTES).filter((t) => !ROOM_TYPES.includes(t));

function targetFor(row: RecordRow): number {
  if (row.canonical_entity_type === 'notification' && row.subject_user_id !== null) return 24 * 60;
  return TARGET_MINUTES[row.canonical_entity_type] ?? 24 * 60;
}

/** Stored freshness decays with age; hand-entered and estimated stay as they are. */
export function effectiveFreshness(row: RecordRow, now: Date): Freshness {
  const stored = row.freshness_status;
  if (stored === 'manual' || stored === 'estimated' || stored === 'needs_confirmation' || stored === 'unavailable') {
    return stored;
  }
  const decayed = freshnessFromAge(new Date(row.updated_at), targetFor(row), now, true);
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
  /** What the link does, when "Open the official page" is not it. */
  linkLabel?: string;
  /** A sentence that must travel with this fact, whatever its freshness. */
  caveat?: string;
  mine: boolean;
}

export interface SchoolRecordsView {
  readiness: 'blocked' | 'no_hold_on_record' | 'unknown';
  window: Fact | null;
  holds: Fact[];
  enrollment: Fact | null;
  requirements: (Fact & { met: number; inProgress: number; notMet: number }) | null;
  /** Official campus alerts still in force, emergencies first. */
  alerts: Fact[];
  appointment: Fact | null;
  referrals: Fact[];
  /** Bursar action items: the office, a due date and the link — never an amount. */
  actions: Fact[];
  opportunity: Fact | null;
  event: Fact | null;
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

  // ── Campus: alerts, advising, bursar, career, events ─────────────────────
  const soonest = (list: RecordRow[], key: string, within: number) => list
    .filter((r) => { const t = Date.parse(str(r.display[key])); return t > now.getTime() && t - now.getTime() <= within; })
    .sort((a, b) => Date.parse(str(a.display[key])) - Date.parse(str(b.display[key])))[0];
  const when = (iso: string) => {
    const d = new Date(iso);
    return `${day(iso)}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })} UTC`;
  };
  const RANK: Record<string, number> = { emergency: 0, advisory: 1, info: 2 };
  const LEVEL: Record<string, string> = { emergency: 'Emergency', advisory: 'Advisory', info: 'Notice' };

  const alerts = of('notification')
    .filter((r) => r.subject_user_id === null && typeof r.display.severity === 'string')
    .filter((r) => !str(r.display.expires_at) || Date.parse(str(r.display.expires_at)) > now.getTime())
    .sort((a, b) => (RANK[str(a.display.severity)] ?? 3) - (RANK[str(b.display.severity)] ?? 3))
    .map((r) => ({
      ...fact(r, `${LEVEL[str(r.display.severity)] ?? 'Notice'}: ${str(r.display.headline)}`, now, r.display.source_url),
      caveat: `Follow ${r.source_of_truth} for anything urgent — Semester is not an emergency channel and may show this late.`,
    }));

  const MODE: Record<string, string> = { in_person: 'in person', video: 'by video', phone: 'by phone' };
  const apt = soonest(of('appointment').filter((r) => r.subject_user_id === userId), 'starts_at', 30 * 86_400_000);
  const appointment = apt
    ? { ...fact(apt, `Advising appointment ${when(str(apt.display.starts_at))} — ${str(apt.display.office)}${MODE[str(apt.display.mode)] ? `, ${MODE[str(apt.display.mode)]}` : ''}`,
        now, apt.display.prep_url), linkLabel: 'Prepare' }
    : null;

  const referrals = of('referral').filter((r) => r.subject_user_id === userId)
    .map((r) => ({ ...fact(r, `${str(r.display.office) || 'An office'} asked to hear from you`, now, r.display.action_url), linkLabel: 'Get in touch' }));

  const actions = of('notification').filter((r) => r.subject_user_id === userId)
    .map((r) => fact(r, `An action from ${str(r.display.office) || 'an office'}${str(r.display.due_at) ? ` — due ${day(str(r.display.due_at))}` : ''}`,
      now, r.display.action_url));

  const post = soonest([...of('internship'), ...of('job')], 'deadline_at', 14 * 86_400_000);
  const opportunity = post
    ? fact(post, `${str(post.display.title)} at ${str(post.display.employer)} — apply by ${day(str(post.display.deadline_at))}`, now, post.display.source_url)
    : null;
  const ev = soonest(of('event'), 'starts_at', 7 * 86_400_000);
  const event = ev
    ? fact(ev, `${str(ev.display.title)} — ${when(str(ev.display.starts_at))}${str(ev.display.location) ? `, ${str(ev.display.location)}` : ''}`, now, ev.display.source_url)
    : null;

  const blocking = holds.some((h) => h.text.startsWith('Action required before'));
  // "No hold on record" only with evidence: fresh hold data from the school that
  // blocks nothing, and a window to register in. No hold rows at all is not
  // evidence — the scope may be unapproved or consent withheld — so then this
  // says nothing about holds.
  const readiness: SchoolRecordsView['readiness'] = blocking
    ? 'blocked'
    : window && window.official && holdRows.length > 0
        && holdRows.every((r) => isOfficialCurrent(effectiveFreshness(r, now), 'connected_institutional'))
      ? 'no_hold_on_record'
      : 'unknown';

  return { readiness, window, holds, enrollment, requirements, alerts, appointment, referrals, actions, opportunity, event,
    empty: !window && holds.length === 0 && !enrollment && !requirements && alerts.length === 0 && !appointment
      && referrals.length === 0 && actions.length === 0 && !opportunity && !event };
}

// ── Loading, behind the flag ───────────────────────────────────────────────

export const RECORD_COLUMNS =
  'id,canonical_entity_type,canonical_entity_id,subject_user_id,source_system,source_url,source_timestamp,source_of_truth,freshness_status,updated_at,display';

export function buildEnvironment(mode: string | undefined): Environment {
  return mode === 'production' ? 'production' : 'development';
}

const CARDS_FLAG = 'module.source_freshness_cards';

/**
 * Whether this school has the cards on. The tenant row is read through the
 * existing `public.feature_state`, its role and cohort limits through
 * `readNarrowing`; the kill switches the student can see are their school's
 * and the global ones.
 */
/**
 * Whether the school-records module is on for this school — or whether we could
 * not tell. A failed read is `'error'`, never `'off'`: "off" is a claim about
 * the school, and a dropped request is not evidence about the school.
 */
export async function cardsState(db: SupabaseClient, school: string, environment: Environment, now: Date): Promise<'on' | 'off' | 'error'> {
  if (!school) return 'off';
  const [{ data: state, error: stateError }, { data: switches, error: switchError }, narrowing] = await Promise.all([
    db.rpc('feature_state', { want_capability: CARDS_FLAG, want_tenant: school }),
    db.from('feature_kill_switch').select('switch_key,tenant_id,engaged'),
    // The school's role and cohort limits, and the caller's own roles and
    // cohorts. Unread is `error`, never "no limit".
    readNarrowing(db, CARDS_FLAG, school).catch(() => null),
  ]);
  if (stateError || switchError || !narrowing) return 'error';
  const killSwitches: KillSwitchRow[] = (switches ?? []).map((k: { switch_key: string; tenant_id: string | null; engaged: boolean }) =>
    ({ key: k.switch_key, tenantId: k.tenant_id, engaged: k.engaged }));
  return evaluateFlag(CARDS_FLAG, {
    environment, tenantId: school, now, killSwitches,
    tenantPolicy: {
      [CARDS_FLAG]: { state: (state ?? 'off') as FeatureState, permittedRoles: narrowing.permittedRoles, permittedCohorts: narrowing.permittedCohorts },
    },
    roles: narrowing.roles,
    cohorts: narrowing.cohorts,
    capabilities: [],
  }).allowed ? 'on' : 'off';
}

/** `cardsState`, with a failed read counted as off — for callers that fail closed. */
export async function cardsEnabled(db: SupabaseClient, school: string, environment: Environment, now: Date): Promise<boolean> {
  return (await cardsState(db, school, environment, now)) === 'on';
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

/**
 * Study spaces and their slots, apart from the facts Today and Notices read.
 * Two queries, each bounded to what the screen can use: every space, and only
 * the slots still running or yet to start today. One capped query over every
 * slot ever synced let finished ones crowd out today's — and the rooms too.
 * Slot times are stored as `toISOString()` output, so they compare as text.
 */
export async function loadRoomRecords(db: SupabaseClient, now = new Date()): Promise<RecordRow[]> {
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
  const [spaces, slots] = await Promise.all([
    db.from('canonical_entity_references').select(RECORD_COLUMNS)
      .eq('canonical_entity_type', 'study_space').is('external_deleted_at', null).limit(500),
    db.from('canonical_entity_references').select(RECORD_COLUMNS)
      .eq('canonical_entity_type', 'space_availability').is('external_deleted_at', null)
      .gt('display->>ends_at', now.toISOString())
      .lte('display->>starts_at', endOfDay)
      .order('display->>starts_at', { ascending: true })
      .limit(2000),
  ]);
  const error = spaces.error ?? slots.error;
  if (error) throw new Error(error.message || 'Could not load room availability.');
  return [...(spaces.data ?? []), ...(slots.data ?? [])] as unknown as RecordRow[];
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
  appointment: { label: 'Advising appointments', why: 'So Today can remind you and link the preparation page. Never an advisor’s notes.' },
  referral: { label: 'Referrals', why: 'So you know which office asked to hear from you, and how to reach it. Never the reason.' },
  notification: { label: 'Action items and alerts', why: 'Your bursar’s action items (the office, a due date and its link — never an amount), and campus-wide alerts, which are not about you.' },
  internship: { label: 'Internships', why: 'Published by your career office; not about you.' },
  job: { label: 'Jobs', why: 'Published by your career office; not about you.' },
  event: { label: 'Campus events', why: 'Published by your school; not about you.' },
};
