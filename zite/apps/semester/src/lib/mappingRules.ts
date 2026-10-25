// Integration field mappings and drift detection (Integration Admin app: "mappings, drift"). Pure; unit-tested.
// A mapping says which field a connected system sends maps to which Semester field, with a fixed transform. Targets are an
// allowlist: a mapping can never write somewhere Semester did not intend (no free-form paths). Drift compares the fields a
// source currently sends with the approved mapping and reports what would break, before any sync relies on it.
export const CONNECTORS = ['SIS', 'LMS', 'SSO', 'Calendar'] as const;
export type Connector = (typeof CONNECTORS)[number];
export const TRANSFORMS = ['copy', 'trim', 'lowercase', 'uppercase', 'date', 'number', 'boolean'] as const;
export type Transform = (typeof TRANSFORMS)[number];

export const TARGETS: Record<Connector, string[]> = {
  SIS: ['person.externalId', 'person.email', 'person.name', 'enrollment.status', 'enrollment.term', 'section.code', 'section.term', 'section.capacity', 'course.code', 'course.title', 'course.credits', 'grade.final'],
  LMS: ['person.externalId', 'person.email', 'section.code', 'assignment.title', 'assignment.dueAt', 'assignment.points', 'submission.state'],
  SSO: ['person.externalId', 'person.email', 'person.name', 'membership.role'],
  Calendar: ['event.title', 'event.startsAt', 'event.endsAt', 'event.location'],
};
/** Targets that may never be fed by an automated sync without a human workflow (official records). */
export const PROTECTED_TARGETS = new Set(['grade.final', 'membership.role']);

export type MappingRow = { source: string; target: string; transform: Transform; required: boolean };

export function validateMapping(connector: Connector, rows: MappingRow[]): string | null {
  if (!rows.length) return 'Map at least one field.';
  const allowed = new Set(TARGETS[connector]);
  const seenSrc = new Set<string>(), seenTgt = new Set<string>();
  for (const r of rows) {
    const src = r.source.trim();
    if (!/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(src)) return `“${r.source}” is not a valid source field name.`;
    if (!allowed.has(r.target)) return `${r.target} is not a field ${connector} may write.`;
    if (!(TRANSFORMS as readonly string[]).includes(r.transform)) return `Unknown transform ${r.transform}.`;
    if (seenSrc.has(src.toLowerCase())) return `${src} is mapped twice.`;
    if (seenTgt.has(r.target)) return `Two source fields write ${r.target}.`;
    seenSrc.add(src.toLowerCase()); seenTgt.add(r.target);
  }
  if (!rows.some((r) => r.target === 'person.externalId' || r.target.endsWith('.code') || r.target === 'event.title')) return 'Include a stable identifier (an external id or a code).';
  return null;
}

export type Drift = { missingRequired: string[]; missingOptional: string[]; newFields: string[]; protectedTargets: string[]; ok: boolean };
/** Compare the fields a source sends now against the approved mapping. ok = nothing required is missing. */
export function detectDrift(rows: MappingRow[], sentFields: string[]): Drift {
  const sent = new Set(sentFields.map((f) => f.trim().toLowerCase()).filter(Boolean));
  const mapped = new Set(rows.map((r) => r.source.trim().toLowerCase()));
  const missingRequired = rows.filter((r) => r.required && !sent.has(r.source.trim().toLowerCase())).map((r) => r.source);
  const missingOptional = rows.filter((r) => !r.required && !sent.has(r.source.trim().toLowerCase())).map((r) => r.source);
  const newFields = [...sent].filter((f) => !mapped.has(f));
  const protectedTargets = rows.filter((r) => PROTECTED_TARGETS.has(r.target)).map((r) => r.target);
  return { missingRequired, missingOptional, newFields, protectedTargets, ok: missingRequired.length === 0 };
}
