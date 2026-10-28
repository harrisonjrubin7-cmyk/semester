// Applicant packages and status (owner source S-90). Pure.
export type AppDraft = { institutionId: string; institution: string; program: string; entryTerm: string; statement: string; documents: { url: string; filename: string }[] };
export type Package = { recipient: { institutionId: string; institution: string }; program: string; entryTerm: string; statement: string; documents: { filename: string; url: string }[] };

/** The exact package an institution will receive: only these fields, in this order. */
export function buildPackage(d: AppDraft): Package {
  return {
    recipient: { institutionId: d.institutionId, institution: d.institution },
    program: d.program.trim(), entryTerm: d.entryTerm.trim(), statement: d.statement,
    documents: d.documents.map((x) => ({ filename: x.filename, url: x.url })),
  };
}
/** Canonical JSON (stable key order) so the same package always hashes the same. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

export function missing(d: AppDraft): string[] {
  return [d.statement.length < 200 ? 'a statement of at least 200 characters' : '', d.documents.length ? '' : 'a transcript', d.program.trim() ? '' : 'a program'].filter(Boolean);
}

export type Mode = 'native' | 'planning';
/** Copy for each operating mode (S-90 §2). */
export function modeNotice(m: Mode): string {
  return m === 'native'
    ? 'Apply directly to this institution through Semester. Admissions staff review applications and release official decisions.'
    : 'Prepare your application here, then submit through the institution’s own admissions channel. Your checklist here is not a receipt.';
}

/** Separate status dimensions (S-90 §6) instead of one label. */
export type Dimensions = { preparation: string; delivery: string; processing: string; decision: string };
export function dimensions(a: { status: string; mode: Mode; received: boolean; missing: number }): Dimensions {
  const decided = ['Admitted', 'Waitlisted', 'Declined'].includes(a.status);
  return {
    preparation: a.status === 'Draft' ? (a.missing ? `Drafting · ${a.missing} item${a.missing === 1 ? '' : 's'} missing` : 'Ready to preview') : a.status === 'Withdrawn' ? 'Withdrawn' : 'Submitted',
    delivery: a.status === 'Draft' ? 'Not sent' : a.mode === 'planning' ? 'Outside Semester' : a.received ? 'Received by the institution' : 'Not confirmed',
    processing: a.status === 'Under Review' ? 'Under review' : decided ? 'Reviewed' : a.received ? 'Waiting for review' : '—',
    decision: decided ? `Released: ${a.status}` : 'Not released',
  };
}
