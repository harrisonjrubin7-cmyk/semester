// Integration Admin: connector scopes (least privilege) and registrar reconciliation diffs. Pure; unit-tested.
import type { Connector } from './mappingRules';

/** What each connector may be granted, and the minimum it needs to work. Anything outside ALLOWED is refused. */
export const SCOPE_CATALOG: Record<Connector, { allowed: string[]; required: string[] }> = {
  SIS: { allowed: ['people.read', 'enrollments.read', 'sections.read', 'enrollments.write'], required: ['people.read', 'enrollments.read', 'sections.read'] },
  LMS: { allowed: ['courses.read', 'roster.read', 'assignments.read', 'grades.read'], required: ['courses.read', 'roster.read'] },
  SSO: { allowed: ['identity.read', 'groups.read'], required: ['identity.read'] },
  Calendar: { allowed: ['events.read', 'events.write'], required: ['events.read'] },
};
/** Write scopes into official systems need a stated reason. */
export const WRITE_SCOPES = new Set(['enrollments.write', 'events.write']);

export function validateScopes(connector: Connector, scopes: string[], reason: string): string | null {
  const cat = SCOPE_CATALOG[connector];
  if (!cat) return 'Unknown connector.';
  const set = new Set(scopes);
  if (set.size !== scopes.length) return 'A scope is listed twice.';
  const bad = scopes.find((s) => !cat.allowed.includes(s));
  if (bad) return `${connector} cannot be granted "${bad}".`;
  const missing = cat.required.filter((s) => !set.has(s));
  if (missing.length) return `${connector} needs ${missing.join(', ')} to work.`;
  if (scopes.some((s) => WRITE_SCOPES.has(s)) && reason.trim().length < 10) return 'Say why this connector needs to write to an official system.';
  return null;
}

export type Seat = { student: string; section: string };
export type Mirror = { id: string; student: string; section: string; status: string };
export type Finding =
  | { kind: 'missing_in_records'; student: string; section: string; enrollmentId: string | null }
  | { kind: 'not_in_ledger'; student: string; section: string; enrollmentId: string };

/**
 * Ledger seats are the truth for registrar-made enrollments. A seat whose record is absent or not Enrolled is repairable.
 * A record marked Enrolled with no seat is reported only — it may come from the SIS feed, so a person decides.
 */
export function diffLedger(seats: Seat[], mirrors: Mirror[], ledgerSections: Set<string>): Finding[] {
  const key = (s: string, c: string) => `${s}|${c}`;
  const bySeat = new Map<string, Mirror[]>();
  for (const m of mirrors) { const k = key(m.student, m.section); bySeat.set(k, [...(bySeat.get(k) ?? []), m]); }
  const seatKeys = new Set(seats.map((s) => key(s.student, s.section)));
  const out: Finding[] = [];
  for (const s of seats) {
    const ms = bySeat.get(key(s.student, s.section)) ?? [];
    if (!ms.some((m) => m.status === 'Enrolled')) out.push({ kind: 'missing_in_records', student: s.student, section: s.section, enrollmentId: (ms.find((m) => m.status !== 'Dropped') ?? ms[0])?.id ?? null });
  }
  for (const m of mirrors) {
    if (m.status === 'Enrolled' && ledgerSections.has(m.section) && !seatKeys.has(key(m.student, m.section))) out.push({ kind: 'not_in_ledger', student: m.student, section: m.section, enrollmentId: m.id });
  }
  return out;
}
