/**
 * The university's side of the student journey, governed before it is useful.
 *
 * Faculty analytics, curriculum, institutional research, accreditation, the
 * developer platform, warehouse exports and international readiness. Each is
 * a way for an institution to learn from Semester, and each is also a way to
 * build a surveillance product by accident. So the rules come first in this
 * file and the features are written against them:
 *
 * 1. **Aggregates only, at n ≥ 10.** `MIN_COHORT` is the same floor the
 *    database's check constraints enforce on `course_demand_snapshot` and the
 *    outcome aggregates (see the expansion migration). A cell under it is
 *    suppressed, and so is the next-smallest cell in its group, because one
 *    suppressed cell beside a published total is not suppressed at all.
 * 2. **No student grain.** No metric may be defined per student.
 *    `defineMetric` throws on it.
 * 3. **Some measures never exist.** Risk scores, reading time, mouse movement,
 *    attention, AI-usage tracking, integrity accusations, wellbeing scores and
 *    location. `FORBIDDEN` names them and `defineMetric` refuses any metric that
 *    sources one — not "hidden by default", refused.
 * 4. **Sensitive reports wait for a person.** Equity-gap analysis and anything
 *    marked `sensitive` cannot be exported until a named reviewer who is not
 *    its author has approved it.
 * 5. **Lineage travels with the number.** Every export carries each metric's
 *    definition and source, so a figure pasted into a slide can be traced.
 */

export const MIN_COHORT = 10;

/** The capability the Operations studio sits under — `module.institutional_operations` in the flag registry. */
export const OPERATIONS_CAPABILITY = 'outcomes:read';

/**
 * Whether this person may open the studio at all.
 *
 * Takes *verified* capabilities — what the gateway confirmed over the school —
 * never a role picked in the UI. Today nothing populates that list on the
 * client, so this answers no for everybody, and the tab stays hidden even with
 * the build flag on. That is the intended state until a verified capability
 * is wired through, the same stance the Control tab takes.
 */
export function operationsAllowed(verified: readonly string[]): boolean {
  return verified.includes(OPERATIONS_CAPABILITY);
}

export const FORBIDDEN = [
  { id: 'risk_score', says: 'Individual student risk scores' },
  { id: 'reading_time', says: 'Covert reading-time tracking' },
  { id: 'mouse', says: 'Mouse or keystroke tracking' },
  { id: 'attention', says: 'Attention or engagement inference' },
  { id: 'ai_usage', says: 'Tracking individual AI usage' },
  { id: 'integrity_flag', says: 'Automated academic-integrity accusations' },
  { id: 'wellbeing_score', says: 'Wellbeing or behavioral scoring' },
  { id: 'location', says: 'Location or presence tracking' },
] as const;

export type ForbiddenId = (typeof FORBIDDEN)[number]['id'];
const FORBIDDEN_IDS = new Set<string>(FORBIDDEN.map((f) => f.id));

export type Grain = 'course' | 'section' | 'program' | 'department' | 'cohort' | 'institution';

export interface Metric {
  id: string;
  name: string;
  /** What it counts, in a sentence a dean can read. */
  definition: string;
  grain: Grain;
  /** Where it comes from — tables or event names. The lineage. */
  sources: readonly string[];
  owner: string;
  sensitive: boolean;
}

/** Refuses what the rules above refuse. Returns the metric so a list can be built from calls. */
export function defineMetric(m: Metric): Metric {
  if ((m.grain as string) === 'student' || (m.grain as string) === 'individual') {
    throw new Error(`${m.id}: metrics are aggregate — no per-student grain`);
  }
  const bad = m.sources.find((s) => FORBIDDEN_IDS.has(s));
  if (bad) throw new Error(`${m.id}: sources a forbidden measure (${bad})`);
  if (!m.sources.length) throw new Error(`${m.id}: a metric with no source has no lineage`);
  if (!m.owner.trim()) throw new Error(`${m.id}: every metric has an owner`);
  return m;
}

/** The data dictionary. Every figure the institutional layer can show is one of these. */
export const DICTIONARY: readonly Metric[] = [
  defineMetric({ id: 'funnel', name: 'Admitted-to-enrolled funnel', definition: 'Students at each stage — admitted, confirmed, oriented, enrolled, returned — by entering cohort.', grain: 'cohort', sources: ['launchpad_stage_aggregate', 'enrollment_snapshot'], owner: 'Enrollment management', sensitive: false }),
  defineMetric({ id: 'service_access', name: 'Service access and capacity', definition: 'Appointments offered, booked and waited for, by office and week.', grain: 'institution', sources: ['office_capacity_snapshot'], owner: 'Student affairs', sensitive: false }),
  defineMetric({ id: 'registration_ready', name: 'Registration readiness', definition: 'Share of a cohort with no holds and a planned cart one week before their window.', grain: 'cohort', sources: ['registration_day_aggregate'], owner: 'Registrar', sensitive: false }),
  defineMetric({ id: 'course_demand', name: 'Course demand', definition: 'Students planning or backing up a course for next term.', grain: 'course', sources: ['course_demand_snapshot'], owner: 'Registrar', sensitive: false }),
  defineMetric({ id: 'question_themes', name: 'Class question themes', definition: 'The topics a class asks about most, grouped — never who asked.', grain: 'section', sources: ['question_theme_aggregate'], owner: 'Teaching center', sensitive: false }),
  defineMetric({ id: 'resource_use', name: 'Resource use', definition: 'How many students in a section opened each shared resource, by week.', grain: 'section', sources: ['resource_open_aggregate'], owner: 'Teaching center', sensitive: false }),
  defineMetric({ id: 'policy_clarity', name: 'Course-policy clarity', definition: 'Students who marked a syllabus policy as unclear, by policy.', grain: 'section', sources: ['policy_feedback'], owner: 'Teaching center', sensitive: false }),
  defineMetric({ id: 'access_barriers', name: 'Accessibility barrier reports', definition: 'Barriers reported against course materials and spaces, by type.', grain: 'institution', sources: ['barrier_report'], owner: 'Access services', sensitive: false }),
  defineMetric({ id: 'workflow_friction', name: 'Assignment workflow friction', definition: 'Submission retries and deadline clarification requests, by assignment.', grain: 'section', sources: ['submission_event_aggregate'], owner: 'Teaching center', sensitive: false }),
  defineMetric({ id: 'equity_gap', name: 'Equity and access gaps', definition: 'Differences in service access between cohorts that consented to demographic reporting.', grain: 'cohort', sources: ['consented_demographic_aggregate', 'office_capacity_snapshot'], owner: 'Institutional research', sensitive: true }),
  defineMetric({ id: 'intervention', name: 'Intervention evaluation', definition: 'Outcomes of a named program against a matched cohort, pre-registered.', grain: 'cohort', sources: ['outcome_aggregate'], owner: 'Institutional research', sensitive: true }),
];

export interface Cell {
  key: string;
  group: string;
  n: number;
}

export interface SuppressedCell extends Cell {
  shown: number | null;
  why?: 'small' | 'complement';
}

/**
 * Suppress small cells, then protect them from subtraction.
 *
 * Primary: any cell under `min` is withheld. Complementary: in any group where
 * exactly one cell was withheld, the smallest remaining cell is withheld too —
 * otherwise the group total minus the others gives the hidden one back.
 */
export function suppress(cells: readonly Cell[], min = MIN_COHORT): SuppressedCell[] {
  const out: SuppressedCell[] = cells.map((c) => (c.n < min ? { ...c, shown: null, why: 'small' } : { ...c, shown: c.n }));
  const groups = new Set(out.map((c) => c.group));
  for (const g of groups) {
    const inGroup = out.filter((c) => c.group === g);
    if (inGroup.filter((c) => c.shown === null).length === 1) {
      const next = inGroup.filter((c) => c.shown !== null).sort((a, b) => a.n - b.n)[0];
      if (next) {
        next.shown = null;
        next.why = 'complement';
      }
    }
  }
  return out;
}

/** The enrollment funnel, suppressed, with stage-to-stage conversion where both ends are shown. */
export function funnel(stages: readonly { stage: string; n: number }[], min = MIN_COHORT) {
  return stages.map((s, i) => {
    const shown = s.n >= min ? s.n : null;
    const prev = i > 0 && stages[i - 1].n >= min ? stages[i - 1].n : null;
    return { stage: s.stage, shown, conversion: shown !== null && prev ? shown / prev : null };
  });
}

/**
 * Class question themes, counted by distinct asker and withheld under the floor.
 *
 * Takes a hashed asker id only to count distinct students; the result carries
 * no ids at all.
 */
export function questionThemes(questions: readonly { theme: string; asker: string }[], min = MIN_COHORT) {
  const by = new Map<string, Set<string>>();
  for (const q of questions) by.set(q.theme, (by.get(q.theme) ?? new Set()).add(q.asker));
  const rows = [...by.entries()].map(([theme, s]) => ({ theme, students: s.size }));
  return {
    shown: rows.filter((r) => r.students >= min).sort((a, b) => b.students - a.students),
    withheld: rows.filter((r) => r.students < min).length,
  };
}

// ── Review before release ────────────────────────────────────────────────────

export interface Review {
  author: string;
  reviewer: string;
  approvedAt: string;
}

export interface Report {
  id: string;
  title: string;
  metrics: readonly string[];
  cells: readonly Cell[];
  review?: Review;
}

export type ExportRefusal = 'unknown_metric' | 'needs_review' | 'self_review' | 'forbidden_field';

/**
 * Whether a report may leave the building, and as what.
 *
 * Sensitive metrics need a reviewer who is not the author. Cells are suppressed
 * on the way out, always — an export never carries a number the screen would
 * not show. The header lists each metric's definition and sources.
 */
export function exportReport(r: Report, min = MIN_COHORT): { ok: true; csv: string } | { ok: false; why: ExportRefusal } {
  const defs = r.metrics.map((id) => DICTIONARY.find((m) => m.id === id));
  if (defs.some((d) => !d)) return { ok: false, why: 'unknown_metric' };
  if (r.cells.some((c) => FORBIDDEN_IDS.has(c.key) || FORBIDDEN_IDS.has(c.group))) return { ok: false, why: 'forbidden_field' };
  if (defs.some((d) => d!.sensitive)) {
    // Both names, trimmed: a blank author passes any reviewer comparison and
    // leaves nobody whose work was checked.
    const author = r.review?.author?.trim() ?? '';
    const reviewer = r.review?.reviewer?.trim() ?? '';
    if (!author || !reviewer || !r.review?.approvedAt) return { ok: false, why: 'needs_review' };
    if (reviewer.toLowerCase() === author.toLowerCase()) return { ok: false, why: 'self_review' };
  }
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [
    `# ${r.title}`,
    ...defs.map((d) => `# ${d!.id}: ${d!.definition} Sources: ${d!.sources.join(', ')}. Owner: ${d!.owner}.`),
    `# Cells under ${min} are withheld, with one more per group where needed to stop subtraction.`,
    'group,key,n',
    ...suppress(r.cells, min).map((c) => `${q(c.group)},${q(c.key)},${c.shown === null ? '' : c.shown}`),
  ];
  return { ok: true, csv: lines.join('\n') };
}

// ── Curriculum ───────────────────────────────────────────────────────────────

export interface CourseNode {
  id: string;
  prereqs: readonly string[];
  outcomes: readonly string[];
}

export interface OutcomeLink {
  outcome: string;
  skills: readonly string[];
  credentials: readonly string[];
  careers: readonly string[];
}

/** A prerequisite cycle, if there is one, as the ids around it. */
export function findCycle(courses: readonly CourseNode[]): string[] | null {
  const by = new Map(courses.map((c) => [c.id, c]));
  const state = new Map<string, 1 | 2>();
  const path: string[] = [];
  const visit = (id: string): string[] | null => {
    if (state.get(id) === 2) return null;
    if (state.get(id) === 1) return path.slice(path.indexOf(id)).concat(id);
    state.set(id, 1);
    path.push(id);
    for (const p of by.get(id)?.prereqs ?? []) {
      const found = visit(p);
      if (found) return found;
    }
    path.pop();
    state.set(id, 2);
    return null;
  };
  for (const c of courses) {
    const found = visit(c.id);
    if (found) return found;
  }
  return null;
}

/** The fewest terms to reach a course, if one prerequisite layer takes a term. */
export function termsTo(courseId: string, courses: readonly CourseNode[]): number {
  if (findCycle(courses)) throw new Error('prerequisite cycle');
  const by = new Map(courses.map((c) => [c.id, c]));
  const memo = new Map<string, number>();
  const depth = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    const pre = by.get(id)?.prereqs ?? [];
    const d = 1 + (pre.length ? Math.max(...pre.map(depth)) : 0);
    memo.set(id, d);
    return d;
  };
  return depth(courseId);
}

/** Every course that depends on this one, directly or not — the impact of changing it. */
export function downstream(courseId: string, courses: readonly CourseNode[]): string[] {
  const out = new Set<string>();
  let frontier = [courseId];
  while (frontier.length) {
    const next = courses.filter((c) => c.prereqs.some((p) => frontier.includes(p)) && !out.has(c.id)).map((c) => c.id);
    next.forEach((id) => out.add(id));
    frontier = next;
  }
  return [...out].sort();
}

/**
 * Bottlenecks: courses where aggregate demand exceeds seats, weighted by how
 * much depends on them. Demand under the cohort floor is not used at all —
 * a bottleneck claim resting on nine students is a guess about nine students.
 */
export function bottlenecks(
  courses: readonly CourseNode[],
  demand: readonly { id: string; planned: number; seats: number }[],
  min = MIN_COHORT,
) {
  return demand
    .filter((d) => d.planned >= min && d.seats >= 0)
    .map((d) => ({ id: d.id, unmet: Math.max(0, d.planned - d.seats), blocks: downstream(d.id, courses).length }))
    .filter((d) => d.unmet > 0)
    .sort((a, b) => b.unmet * (1 + b.blocks) - a.unmet * (1 + a.blocks) || a.id.localeCompare(b.id));
}

/** How many sections a demand figure needs, and what is left over. */
export function capacityScenario(planned: number, seatsPerSection: number, sections: number) {
  const seats = Math.max(0, seatsPerSection) * Math.max(0, sections);
  const needed = seatsPerSection > 0 ? Math.ceil(planned / seatsPerSection) : 0;
  return { seats, unmet: Math.max(0, planned - seats), sectionsNeeded: needed, spare: Math.max(0, seats - planned) };
}

/** Course → outcome → skill → credential / career, flattened for a table. */
export function curriculumMap(courses: readonly CourseNode[], links: readonly OutcomeLink[]) {
  return courses.flatMap((c) =>
    c.outcomes.map((o) => {
      const l = links.find((x) => x.outcome === o);
      return { course: c.id, outcome: o, skills: l?.skills ?? [], credentials: l?.credentials ?? [], careers: l?.careers ?? [] };
    }),
  );
}

// ── Accreditation and evidence ───────────────────────────────────────────────

export interface Evidence {
  id: string;
  standard: string;
  title: string;
  owner: string;
  updated: string;
  /** Months between required reviews. */
  every: number;
  state: 'draft' | 'review' | 'approved';
  approver?: string;
}

export type Freshness = 'fresh' | 'due' | 'stale' | 'unowned';

function monthsBetween(a: string, b: string): number {
  const x = new Date(a);
  const y = new Date(b);
  return (y.getUTCFullYear() - x.getUTCFullYear()) * 12 + (y.getUTCMonth() - x.getUTCMonth()) - (y.getUTCDate() < x.getUTCDate() ? 1 : 0);
}

/** Fresh, due within a month, stale past its cycle, or owned by nobody. */
export function freshness(e: Evidence, today: string): Freshness {
  if (!e.owner.trim()) return 'unowned';
  const age = monthsBetween(e.updated, today);
  if (age >= e.every) return 'stale';
  if (age >= e.every - 1) return 'due';
  return 'fresh';
}

/** Standards with no approved evidence behind them. */
export function uncovered(standards: readonly string[], evidence: readonly Evidence[]): string[] {
  return standards.filter((s) => !evidence.some((e) => e.standard === s && e.state === 'approved'));
}

/** Approve — never by the owner. Separation of duties is the whole point of the step. */
export function approve(e: Evidence, approver: string): Evidence {
  if (e.state !== 'review') throw new Error('only evidence in review can be approved');
  if (!approver.trim() || approver === e.owner) throw new Error('evidence is approved by somebody other than its owner');
  return { ...e, state: 'approved', approver };
}

// ── Developer platform ───────────────────────────────────────────────────────

/** Read scopes are the default. Nothing here reads private student content. */
export const SCOPES = [
  { id: 'catalog:read', says: 'Courses, sections and the academic calendar.', write: false },
  { id: 'resources:read', says: 'Published campus resources and offices.', write: false },
  { id: 'aggregates:read', says: 'Suppressed aggregate reports (n ≥ 10).', write: false },
  { id: 'notices:write', says: 'Post official notices to the communications hub, labelled with their source.', write: true },
  { id: 'resources:write', says: 'Publish or update campus resource entries.', write: true },
] as const;

export type Scope = (typeof SCOPES)[number]['id'];

/** Events a webhook may carry. None carries a student's own content. */
export const WEBHOOK_EVENTS = ['catalog.updated', 'resource.published', 'notice.acknowledged_count', 'report.approved'] as const;

export const KEY_MAX_AGE_DAYS = 90;
export const DEPRECATION_NOTICE_MONTHS = 12;
export const RATE_LIMITS = { standard: 600, bulk: 60 } as const;

export interface ApiKey {
  id: string;
  scopes: readonly string[];
  rotated: string;
  tenant: string;
}

export type KeyProblem = 'unknown_scope' | 'needs_rotation' | 'no_tenant' | 'no_scopes';

export function keyProblems(k: ApiKey, today: string): KeyProblem[] {
  const out: KeyProblem[] = [];
  if (!k.tenant.trim()) out.push('no_tenant');
  if (!k.scopes.length) out.push('no_scopes');
  if (k.scopes.some((s) => !SCOPES.some((x) => x.id === s))) out.push('unknown_scope');
  const age = (new Date(today).getTime() - new Date(k.rotated).getTime()) / 86_400_000;
  if (!(age <= KEY_MAX_AGE_DAYS)) out.push('needs_rotation');
  return out;
}

/** A version may be switched off only after a full notice period. */
export function mayRetire(announced: string, sunset: string): boolean {
  return monthsBetween(announced, sunset) >= DEPRECATION_NOTICE_MONTHS;
}

export const CERTIFICATION = [
  'Uses only the scopes it lists, and lists why',
  'Handles 429 with backoff; never retries a write blindly',
  'Verifies webhook signatures',
  'Stores no student content outside the tenant',
  'Passes the sandbox tenant test suite',
  'Names a security contact',
] as const;

// ── Continuity and international readiness ──────────────────────────────────

export interface ContinuityPlan {
  rtoHours: number;
  rpoHours: number;
  lastRestoreTest: string;
  regions: number;
  emergencyAccessReviewed: string;
}

/** What a tenant continuity plan is missing, against stated targets. */
export function continuityGaps(p: ContinuityPlan, today: string): string[] {
  const gaps: string[] = [];
  if (p.rtoHours > 24) gaps.push('Recovery time over 24 hours');
  if (p.rpoHours > 24) gaps.push('More than a day of data at risk');
  if (!p.lastRestoreTest || monthsBetween(p.lastRestoreTest, today) >= 6) gaps.push('No restore test in six months');
  if (p.regions < 2) gaps.push('One region — no regional outage strategy');
  if (!p.emergencyAccessReviewed || monthsBetween(p.emergencyAccessReviewed, today) >= 12) gaps.push('Staff emergency access not reviewed this year');
  return gaps;
}

export const INTERNATIONAL = [
  { id: 'gdpr', title: 'Data subject requests: access, correction, erasure, portability', area: 'Privacy' },
  { id: 'residency', title: 'Data residency: tenant data stays in the chosen region', area: 'Privacy' },
  { id: 'calendars', title: 'Regional academic calendars and term structures', area: 'Academic' },
  { id: 'credentials', title: 'Credential frameworks (ECTS, national qualification levels)', area: 'Academic' },
  { id: 'policies', title: 'Localized terms, consent and accessibility law', area: 'Compliance' },
  { id: 'payments', title: 'Payment and tax handling per country', area: 'Commercial' },
  { id: 'languages', title: 'Translation, including right-to-left scripts', area: 'Product' },
  { id: 'integrations', title: 'Country-specific student systems', area: 'Product' },
  { id: 'partners', title: 'A regional partner for support and implementation', area: 'Commercial' },
] as const;

const RTL = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi', 'dv', 'ckb']);

/** Whether a BCP 47 tag is written right to left. */
export function isRtl(lang: string): boolean {
  return RTL.has(lang.toLowerCase().split('-')[0]);
}
