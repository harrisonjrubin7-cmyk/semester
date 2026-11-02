// Registration readiness (pilot workflow "Review registration readiness"). Pure; unit-tested in tests/readiness.test.ts.
export type DraftRow = { code: string; credits: number; missing: string[]; approved: boolean; pending: boolean; conflicts: string[] };
export type CheckState = 'ok' | 'blocked' | 'info';
export type Check = { key: 'holds' | 'courses' | 'prerequisites' | 'conflicts' | 'credits'; label: string; state: CheckState; detail: string; fixPath?: string };
export type Readiness = { ready: boolean; checks: Check[]; credits: number };

const list = (xs: string[]) => [...new Set(xs)].join(', ');

export function computeReadiness(draft: DraftRow[], holds: string[]): Readiness {
  const credits = draft.reduce((n, r) => n + (r.credits || 0), 0);
  const missing = draft.filter((r) => r.missing.length && !r.approved);
  const waiting = missing.filter((r) => r.pending);
  const conflicts = draft.filter((r) => r.conflicts.length);
  const checks: Check[] = [
    holds.length
      ? { key: 'holds', label: 'No registration holds', state: 'blocked', detail: `${holds.length === 1 ? 'A hold blocks' : `${holds.length} holds block`} registration: ${list(holds)}. The office that placed it has to release it.`, fixPath: '/help' }
      : { key: 'holds', label: 'No registration holds', state: 'ok', detail: 'No holds on your record.' },
    draft.length
      ? { key: 'courses', label: 'Courses chosen', state: 'ok', detail: `${draft.length} ${draft.length === 1 ? 'section' : 'sections'} in your draft.` }
      : { key: 'courses', label: 'Courses chosen', state: 'blocked', detail: 'Add at least one section from the catalog.' },
    missing.length
      ? { key: 'prerequisites', label: 'Prerequisites met', state: 'blocked', detail: waiting.length === missing.length ? `Waiting on override approval for ${list(waiting.map((r) => r.code))}.` : `Missing prerequisites for ${list(missing.filter((r) => !r.pending).map((r) => r.code))}. Request an override or remove the course.` }
      : { key: 'prerequisites', label: 'Prerequisites met', state: 'ok', detail: 'Every course has its prerequisites or an approved override.' },
    conflicts.length
      ? { key: 'conflicts', label: 'No time conflicts', state: 'blocked', detail: `Overlapping meeting times: ${list(conflicts.map((r) => r.code))}.` }
      : { key: 'conflicts', label: 'No time conflicts', state: 'ok', detail: 'No sections overlap.' },
    { key: 'credits', label: 'Credit load', state: 'info', detail: `${credits} credits. Your institution's load limits are checked by the Registrar.` },
  ];
  return { ready: checks.every((c) => c.state !== 'blocked'), checks, credits };
}

/** The first thing stopping submission, as a sentence, or null. */
export const firstBlocker = (r: Readiness) => r.checks.find((c) => c.state === 'blocked')?.detail ?? null;
