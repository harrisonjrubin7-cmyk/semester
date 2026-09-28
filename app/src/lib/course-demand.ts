import type { CatalogCourse } from './registration';

/**
 * Privacy-safe course demand forecasting (`demand_forecasting`, Phase K,
 * D-051), against `supabase/migrations/20260928305000_course_demand_forecasting.sql`.
 *
 * **The student's side.** A student may contribute their registration cart
 * for one term: course codes, each a primary or a backup. Nothing else — no
 * section, time, instructor or name. `contributionFrom` builds exactly that,
 * and the consent dialog shows exactly that before anything is sent.
 * Stopping is prospective: counts already published keep the student until
 * the next refresh, and no refresh after that counts them.
 *
 * **The staff side.** A registrar or department reads counts, never rows.
 * The database publishes a course only when ten or more consenting students
 * plan it, and a backup count only when ten or more hold it. `readDemandRow`
 * refuses anything below that anyway — the second lock, so a count of three
 * never reaches a screen however it got into a response.
 *
 * **What it is not for.** Admissions, or any automated enrollment decision.
 * Said on both screens.
 */

export const DEMAND_SOURCE_LINE = 'Based on anonymized planning data from students who chose to contribute.';
export const NOT_FOR_LINE = 'Not used for admissions or for any automated enrollment decision.';
export const MIN_STUDENTS = 10;
export const MAX_COURSES = 30;

/** The same shape the database accepts: "ECON 1010", "CS 101", "MATH 1300W". */
const CODE = /^[A-Z&]{2,8} ?[0-9]{3,4}[A-Z]?$/;
/** Upper case, one space, and always a space before the number, so "econ1010" is "ECON 1010" — the department scope splits on it. */
export const normalizeCode = (code: string) =>
  code.trim().toUpperCase().replace(/\s+/g, ' ').replace(/^([A-Z&]+) ?([0-9])/, '$1 $2');

export interface Contributed {
  course: string;
  role: 'primary' | 'backup';
  /** For a backup: 1 is the first to try. */
  rank?: number;
}

export interface Contribution {
  term: string;
  courses: Contributed[];
  /** Codes the cart holds that are not course codes the database accepts. */
  skipped: string[];
}

/**
 * What would be sent for the cart: each course code once, as a primary when
 * any section of it is in the cart, otherwise as a backup at the best rank the
 * student gave it. The term is the cart's own (the commonest, if it mixes).
 */
export function contributionFrom(
  cart: readonly CatalogCourse[],
  backups: Readonly<Record<string, readonly string[]>>,
  catalog: readonly CatalogCourse[],
): Contribution | null {
  if (!cart.length) return null;
  const terms = new Map<string, number>();
  for (const c of cart) terms.set(c.term, (terms.get(c.term) ?? 0) + 1);
  const term = [...terms.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];

  const byId = new Map(catalog.map((c) => [c.id, c]));
  const skipped = new Set<string>();
  const primary = new Set<string>();
  for (const c of cart.filter((c) => c.term === term)) {
    const code = normalizeCode(c.code);
    if (CODE.test(code)) primary.add(code);
    else skipped.add(c.code);
  }
  const backup = new Map<string, number>();
  for (const c of cart) {
    (backups[c.id] ?? []).forEach((id, i) => {
      const b = byId.get(id);
      if (!b || b.term !== term) return;
      const code = normalizeCode(b.code);
      if (!CODE.test(code)) {
        skipped.add(b.code);
        return;
      }
      if (primary.has(code)) return;
      backup.set(code, Math.min(backup.get(code) ?? Infinity, i + 1));
    });
  }
  const courses: Contributed[] = [
    ...[...primary].sort().map((course) => ({ course, role: 'primary' as const })),
    ...[...backup.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([course, rank]) => ({ course, role: 'backup' as const, rank })),
  ].slice(0, MAX_COURSES);
  return { term, courses, skipped: [...skipped] };
}

export interface MyContribution {
  consentedAt: number | null;
  revokedAt: number | null;
  courses: Contributed[];
}

const time = (v: unknown) => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : null;
};

/** Rows from `my_demand_contribution`: the consent repeated on each, and the courses. */
export function readContribution(rows: unknown): MyContribution | null {
  if (!Array.isArray(rows)) return null;
  const list = rows.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object');
  if (!list.length) return null;
  const first = list[0];
  const courses: Contributed[] = [];
  for (const r of list) {
    if (typeof r.course_code !== 'string') continue;
    courses.push(
      r.role === 'backup'
        ? { course: r.course_code, role: 'backup', rank: typeof r.backup_rank === 'number' ? r.backup_rank : 1 }
        : { course: r.course_code, role: 'primary' },
    );
  }
  return { consentedAt: time(first.consented_at), revokedAt: time(first.revoked_at), courses };
}

const key = (c: Contributed) => `${c.role}:${c.course}:${c.role === 'backup' ? c.rank : ''}`;
/** Whether the cart would send something different from what was sent. */
export function contributionChanged(sent: readonly Contributed[], now: readonly Contributed[]): boolean {
  const a = sent.map(key).sort().join('|');
  const b = now.map(key).sort().join('|');
  return a !== b;
}

// ── The staff side ────────────────────────────────────────────────────────

export interface DemandRow {
  course: string;
  department: string;
  planned: number;
  /** Null when fewer than ten hold it as a backup. */
  backups: number | null;
  countedAt: number;
  capacity: number | null;
  waitlist: number | null;
  sections: number;
  capacitySource: string | null;
  capacitySyncedAt: number | null;
}

export const departmentOf = (code: string) => normalizeCode(code).split(' ')[0].replace(/[0-9].*$/, '') || code;

const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : null);

/** A row from `course_demand`, or null — including for any count below ten. */
export function readDemandRow(row: unknown): DemandRow | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const course = typeof r.course_code === 'string' ? r.course_code : '';
  const planned = int(r.planned_students);
  const backups = int(r.backup_students);
  const countedAt = time(r.generated_at);
  if (!course || planned === null || planned < MIN_STUDENTS || countedAt === null) return null;
  const sections = int(r.sections) ?? 0;
  return {
    course,
    department: departmentOf(course),
    planned,
    backups: backups !== null && backups >= MIN_STUDENTS ? backups : null,
    countedAt,
    capacity: sections > 0 ? int(r.capacity) : null,
    waitlist: sections > 0 ? int(r.waitlist) : null,
    sections,
    capacitySource: sections > 0 && typeof r.capacity_source === 'string' ? r.capacity_source : null,
    capacitySyncedAt: sections > 0 ? time(r.capacity_synced_at) : null,
  };
}

export function readDemand(rows: unknown): DemandRow[] {
  return Array.isArray(rows) ? rows.map(readDemandRow).filter((r): r is DemandRow => r !== null) : [];
}

/** Departments, each with its courses, largest planned first. */
export function byDepartment(rows: readonly DemandRow[]): { department: string; rows: DemandRow[] }[] {
  const out = new Map<string, DemandRow[]>();
  for (const r of rows) out.set(r.department, [...(out.get(r.department) ?? []), r]);
  return [...out.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([department, list]) => ({ department, rows: [...list].sort((a, b) => b.planned - a.planned || a.course.localeCompare(b.course)) }));
}

/** "10 or more" is never shown as a smaller number; backups below ten are said, not counted. */
export const backupLine = (r: DemandRow) => (r.backups === null ? 'Fewer than 10 hold it as a backup' : `${r.backups} as a backup`);

/** Seats and waitlist when the registrar has synced sections; otherwise that it is not connected. */
export function capacityLine(r: DemandRow): string {
  if (r.capacity === null) return 'Capacity not connected';
  const seats = `${r.capacity} seats in ${r.sections} section${r.sections === 1 ? '' : 's'}`;
  const wait = r.waitlist ? ` · ${r.waitlist} waitlisted` : '';
  return `${seats}${wait}`;
}

/**
 * Planned against seats, as a fact rather than a forecast of who gets in:
 * "12 more planned than seats", or nothing when capacity is not connected or
 * there is room.
 */
export function pressureLine(r: DemandRow): string | null {
  if (r.capacity === null || r.planned <= r.capacity) return null;
  return `${r.planned - r.capacity} more planned than seats`;
}
