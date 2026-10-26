// Study abroad (role register: Study Abroad Advisor): programs, applications, learning agreements, travel readiness and
// returned-credit reconciliation. Pure; mirrors lib/sabMigration.ts and is unit-tested in tests/abroad.test.ts.
// Rules: one live application per student per term; applications close at the program deadline; approvals never exceed
// program capacity; a learning agreement is approved only as the exact lines the student proposed (hash-pinned) and any
// change sends it back for approval; departure needs every readiness item; reconciliation covers every agreed line and
// never grants more credit than agreed; advisors never act on their own application. Nothing posts to the transcript.
export type State = 'submitted' | 'approved' | 'agreed' | 'ready' | 'abroad' | 'returned' | 'reconciled' | 'declined' | 'withdrawn' | 'cancelled';
export type Step = 'approve' | 'decline' | 'propose' | 'approve_agreement' | 'return_agreement' | 'confirm_ready' | 'depart' | 'come_back' | 'reconcile' | 'withdraw' | 'cancel';
export type Actor = 'student' | 'advisor';
export const LIVE: State[] = ['submitted', 'approved', 'agreed', 'ready', 'abroad', 'returned'];
export const HOLDS_PLACE: State[] = ['approved', 'agreed', 'ready', 'abroad', 'returned', 'reconciled'];
export const CHECKLIST = ['passport_valid', 'visa_or_not_needed', 'health_insurance', 'emergency_contact', 'predeparture_session', 'host_registration'] as const;
export type ChecklistItem = (typeof CHECKLIST)[number];

const MOVES: Record<Step, { who: Actor | 'either'; from: State[]; to: State }> = {
  approve: { who: 'advisor', from: ['submitted'], to: 'approved' },
  decline: { who: 'advisor', from: ['submitted'], to: 'declined' },
  propose: { who: 'student', from: ['approved', 'agreed'], to: 'approved' },
  approve_agreement: { who: 'advisor', from: ['approved'], to: 'agreed' },
  return_agreement: { who: 'advisor', from: ['approved'], to: 'approved' },
  confirm_ready: { who: 'advisor', from: ['agreed'], to: 'ready' },
  depart: { who: 'advisor', from: ['ready'], to: 'abroad' },
  come_back: { who: 'either', from: ['abroad'], to: 'returned' },
  reconcile: { who: 'advisor', from: ['returned'], to: 'reconciled' },
  withdraw: { who: 'student', from: ['submitted', 'approved', 'agreed', 'ready'], to: 'withdrawn' },
  cancel: { who: 'advisor', from: ['submitted', 'approved', 'agreed', 'ready'], to: 'cancelled' },
};

export function next(state: State, step: Step, actor: Actor): State | null {
  const m = MOVES[step];
  return m && (m.who === 'either' || m.who === actor) && m.from.includes(state) ? m.to : null;
}
export const openSteps = (state: State, actor: Actor) => (Object.keys(MOVES) as Step[]).filter((s) => next(state, s, actor));
export const needsReason = (s: Step) => ['decline', 'return_agreement', 'cancel'].includes(s);

export type Line = { hostCourse: string; hostTitle: string; homeCode: string; credits: number };
export function agreementBlocker(lines: Line[]) {
  if (lines.length < 1 || lines.length > 12) return 'List between 1 and 12 courses.';
  for (const l of lines) {
    if (l.hostCourse.trim().length < 2 || l.homeCode.trim().length < 2) return 'Each line needs the host course and the home course it counts as.';
    if (!(l.credits > 0 && l.credits <= 12)) return 'Each line needs between 0 and 12 credits.';
  }
  if (new Set(lines.map((l) => l.hostCourse.trim().toUpperCase())).size !== lines.length) return 'A host course appears twice.';
  return null;
}

export const readinessComplete = (c: Partial<Record<ChecklistItem, boolean>>) => CHECKLIST.every((k) => c[k] === true);

export type Result = { credits: number; grade: string };
export function reconcileBlocker(lines: Line[], results: Result[]) {
  if (results.length !== lines.length) return 'Record a result for every course in the agreement.';
  for (let i = 0; i < lines.length; i++) {
    const r = results[i];
    if (!(r.credits >= 0) || r.credits > lines[i].credits) return `Line ${i + 1}: credit granted must be between 0 and the agreed ${lines[i].credits}.`;
    if (r.grade.trim().length < 1) return `Line ${i + 1}: record the host grade (or "W").`;
  }
  return null;
}

export function approveBlocker(p: { self: boolean; capacity: number; placesHeld: number; programActive: boolean }) {
  if (p.self) return 'Ask another advisor to act on your own application.';
  if (!p.programActive) return 'This program is closed.';
  if (p.placesHeld >= p.capacity) return 'This program is full.';
  return null;
}
