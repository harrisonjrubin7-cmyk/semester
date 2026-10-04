/**
 * The combined risk review: one record per capability, answered by the seats
 * that own each section, required before a capability is released to anyone.
 *
 * Until now the pieces lived apart. `pia.ts` assesses a privacy surface;
 * `risk.ts` registers risks without linking them to a capability;
 * `l9-readiness.ts` stamps every capability with the same ten generic
 * references; `certification.ts` reviews fourteen domains, not capabilities.
 * No record said "for CAP-050, security looked at this on that day, privacy at
 * that, accessibility ran this, the objective is that, the support route is
 * this, the playbook is that, and these are the open risks." This is that
 * record, keyed by the same `CAP-nnn` ids the rest of the governance uses.
 *
 * Three rules shape it, each taken from how the repository already refuses to
 * overclaim.
 *
 * **A pass is evidence, not an opinion.** A `pass` names files that exist. A
 * question about something that has to have been *operated* — a restore, an
 * alert reaching a person, a screen-reader pass, a drill — needs a file under
 * `docs/evidence/`, because the master register lets no row past `tested`
 * without one. A test in the tree shows a control would fail a build; it does
 * not show anyone did the thing.
 *
 * **A vacant seat cannot sign.** Each section has an owning seat. If the seat
 * has no holder in `COUNCIL`, nothing it says counts; `risk.ts` already says
 * every seat is vacant for the same reason. Today that makes the security,
 * trust and data sections unpassable, which is true.
 *
 * **Evidence expires, strictly.** A pass is good before its `expiresOn` and
 * not on it, the rule `release-profiles.ts` adopted on 3 October (#1125). A
 * pass lasts at most 91 days.
 *
 * Nothing here reads the clock, the disk or the network: the date and the
 * existence check are passed in, so the same review always gives the same
 * verdict.
 */

import { COUNCIL, type Seat } from '../launchreadiness';
import { CONTROLS, FAILS_A_BUILD, PROOF_SHAPE, control, type State } from './trustcontrols';

export const SECTIONS = ['security', 'privacy', 'accessibility', 'reliability', 'support', 'incident', 'ai', 'safety', 'data', 'legal'] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_TITLE: Record<Section, string> = {
  security: 'Security',
  privacy: 'Privacy',
  accessibility: 'Accessibility',
  reliability: 'Reliability',
  support: 'Support',
  incident: 'Incident response',
  ai: 'AI governance',
  safety: 'Trust and safety',
  data: 'Data and records',
  legal: 'Claims and legal queue',
};

/** The seat that must answer a section. Counsel decides law; the privacy seat only routes it. */
export const SECTION_OWNER: Record<Section, Seat> = {
  security: 'security',
  privacy: 'privacy',
  accessibility: 'accessibility',
  reliability: 'operations',
  support: 'success',
  incident: 'operations',
  ai: 'trust',
  safety: 'trust',
  data: 'data',
  legal: 'privacy',
};

export const TOUCHES = ['personalData', 'minors', 'sharing', 'ai', 'money', 'userContent', 'officialRecords', 'integrations', 'staffAccess'] as const;
export type Touch = (typeof TOUCHES)[number];

export const TOUCH_TITLE: Record<Touch, string> = {
  personalData: 'Holds personal data',
  minors: 'Reachable by a minor or a guardian',
  sharing: 'Shares data with another person or party',
  ai: 'Uses an AI model',
  money: 'Moves or displays money',
  userContent: 'Holds content other users can see',
  officialRecords: 'Reads or writes an official record',
  integrations: 'Depends on an external system',
  staffAccess: 'Lets staff see or act on a student\'s data',
};

export interface Question {
  id: string;
  section: Section;
  ask: string;
  /** The question applies when the review touches this, or always. */
  when: Touch | 'always';
  /** Unresolved means no-go, and the question cannot be excepted. */
  blocking: boolean;
  /** `evidence-dir` means the thing must have been operated and a file filed. */
  evidence: 'repository' | 'evidence-dir';
  /** The control in `trustcontrols.ts` whose state seeds the answer. */
  control?: string;
}

export const QUESTIONS: readonly Question[] = [
  // Security
  { id: 'RR-SEC-1', section: 'security', ask: 'Is there a threat model for this capability\'s trust boundaries, with each high-severity row tied to a test or check?', when: 'always', blocking: true, evidence: 'repository' },
  { id: 'RR-SEC-2', section: 'security', ask: 'Does every read and write enforce tenant and role in the database or server, with a negative test for each role?', when: 'always', blocking: true, evidence: 'repository', control: 'TC-SEC-01' },
  { id: 'RR-SEC-3', section: 'security', ask: 'Is every staff or support path purpose-scoped, time-bound and visible to the student, and does a break-glass grant widen access only inside that scope?', when: 'staffAccess', blocking: true, evidence: 'repository', control: 'TC-SEC-09' },
  { id: 'RR-SEC-4', section: 'security', ask: 'Is each consequential action confirmed, idempotent and receipted, with two people where it is high impact?', when: 'officialRecords', blocking: true, evidence: 'repository', control: 'TC-SEC-08' },
  { id: 'RR-SEC-5', section: 'security', ask: 'Does every integration fail closed, with least scopes and a signed or authenticated channel?', when: 'integrations', blocking: true, evidence: 'repository', control: 'TC-SEC-03' },
  { id: 'RR-SEC-6', section: 'security', ask: 'Is new code covered by static analysis and an authenticated dynamic scan?', when: 'always', blocking: false, evidence: 'evidence-dir', control: 'TC-SEC-06' },
  { id: 'RR-SEC-7', section: 'security', ask: 'Is every new secret inventoried, with a rotation owner and a logged rotation?', when: 'always', blocking: false, evidence: 'evidence-dir', control: 'TC-SEC-13' },
  // Privacy
  { id: 'RR-PRV-1', section: 'privacy', ask: 'Is there a privacy impact assessment with all eleven answers, a reader list and cited evidence?', when: 'personalData', blocking: true, evidence: 'repository', control: 'TC-PRV-07' },
  { id: 'RR-PRV-2', section: 'privacy', ask: 'Is every personal-data column in the export and erasure map, and does the deletion check cover the new tables?', when: 'personalData', blocking: true, evidence: 'repository', control: 'TC-PRV-01' },
  { id: 'RR-PRV-3', section: 'privacy', ask: 'Is each retention period stated, listed in the retention tripwire and approved?', when: 'personalData', blocking: false, evidence: 'repository', control: 'TC-PRV-03' },
  { id: 'RR-PRV-4', section: 'privacy', ask: 'Is the minor and guardian posture decided, tested in SQL and reviewed by counsel (requires qualified human counsel review)?', when: 'minors', blocking: true, evidence: 'repository', control: 'TC-PRV-06' },
  { id: 'RR-PRV-5', section: 'privacy', ask: 'Does every share record purpose and basis, expire, and revoke immediately, with reads logged?', when: 'sharing', blocking: true, evidence: 'repository', control: 'TC-PRV-05' },
  { id: 'RR-PRV-6', section: 'privacy', ask: 'Is every provider that touches the data on the subprocessor list, with signed terms and a deletion path?', when: 'personalData', blocking: true, evidence: 'evidence-dir', control: 'TC-PRV-08' },
  // Accessibility
  { id: 'RR-A11-1', section: 'accessibility', ask: 'Is the primary journey completed by keyboard alone, automated in a real browser and confirmed by a recorded manual run?', when: 'always', blocking: true, evidence: 'evidence-dir', control: 'TC-A11-02' },
  { id: 'RR-A11-2', section: 'accessibility', ask: 'Are screen reader, zoom to 400 percent and forced colours results recorded for the primary journey?', when: 'always', blocking: true, evidence: 'evidence-dir', control: 'TC-A11-06' },
  { id: 'RR-A11-3', section: 'accessibility', ask: 'Does text meet contrast in every ground and in the empty, error and hover states, as painted?', when: 'always', blocking: true, evidence: 'repository', control: 'TC-A11-04' },
  { id: 'RR-A11-4', section: 'accessibility', ask: 'Does every loading, empty, denied, offline and error state explain what happened, what to do and who can help, and keep the user\'s input?', when: 'always', blocking: false, evidence: 'repository', control: 'TC-A11-05' },
  { id: 'RR-A11-5', section: 'accessibility', ask: 'Do audio and video have captions and transcripts, and images a text alternative?', when: 'userContent', blocking: false, evidence: 'repository', control: 'TC-A11-07' },
  // Reliability
  { id: 'RR-REL-1', section: 'reliability', ask: 'Is there a service-level objective for the primary journey, with eligible and good events defined and counted from real events?', when: 'always', blocking: true, evidence: 'evidence-dir', control: 'TC-REL-02' },
  { id: 'RR-REL-2', section: 'reliability', ask: 'Is there a switch that turns it off, drilled against production?', when: 'always', blocking: true, evidence: 'evidence-dir', control: 'TC-REL-05' },
  { id: 'RR-REL-3', section: 'reliability', ask: 'Does an alert reach an assigned person when its objective burns?', when: 'always', blocking: true, evidence: 'evidence-dir', control: 'TC-REL-06' },
  { id: 'RR-REL-4', section: 'reliability', ask: 'Is recovery documented and rehearsed, with a measured recovery time and point?', when: 'always', blocking: true, evidence: 'evidence-dir', control: 'TC-REL-04' },
  { id: 'RR-REL-5', section: 'reliability', ask: 'Has the peak load for this capability (registration day, grade release, billing due date) been run?', when: 'always', blocking: false, evidence: 'evidence-dir', control: 'TC-REL-03' },
  { id: 'RR-REL-6', section: 'reliability', ask: 'When the external system is down, does the capability keep its native function and label what is stale?', when: 'integrations', blocking: true, evidence: 'repository' },
  // Support
  { id: 'RR-SUP-1', section: 'support', ask: 'Is there a named support route with an owner, hours and a macro, and does a user know where to find it?', when: 'always', blocking: true, evidence: 'repository', control: 'TC-SUP-02' },
  { id: 'RR-SUP-2', section: 'support', ask: 'Are the known limitations written where the user will read them?', when: 'always', blocking: false, evidence: 'repository' },
  // Incident
  { id: 'RR-INC-1', section: 'incident', ask: 'Is there a playbook for the incident this capability could cause, and has it been exercised?', when: 'always', blocking: true, evidence: 'evidence-dir', control: 'TC-INC-04' },
  { id: 'RR-INC-2', section: 'incident', ask: 'Are the people who approve and send the message named and reachable outside business hours?', when: 'always', blocking: true, evidence: 'evidence-dir', control: 'TC-INC-03' },
  // AI
  { id: 'RR-AI-1', section: 'ai', ask: 'Is the AI risk tier assigned and the use not on the prohibited list?', when: 'ai', blocking: true, evidence: 'repository', control: 'TC-AI-03' },
  { id: 'RR-AI-2', section: 'ai', ask: 'Does a person confirm every consequential action, with sources and uncertainty shown?', when: 'ai', blocking: true, evidence: 'repository' },
  { id: 'RR-AI-3', section: 'ai', ask: 'Does the adversarial suite include this capability\'s data and tools, run on the current model?', when: 'ai', blocking: true, evidence: 'evidence-dir', control: 'TC-AI-04' },
  // Trust and safety
  { id: 'RR-TSF-1', section: 'safety', ask: 'Can a user report, can a case be triaged and decided with a reason, and can the author appeal?', when: 'userContent', blocking: true, evidence: 'repository', control: 'TC-TSF-01' },
  { id: 'RR-TSF-2', section: 'safety', ask: 'Is moderator access least-privilege, with reads as well as reveals logged?', when: 'userContent', blocking: true, evidence: 'repository', control: 'TC-TSF-02' },
  { id: 'RR-TSF-3', section: 'safety', ask: 'Are the abuse-material, self-harm and law-enforcement routes decided with counsel and exercised (requires qualified human counsel review)?', when: 'userContent', blocking: true, evidence: 'evidence-dir', control: 'TC-TSF-05' },
  // Data and records
  { id: 'RR-DAT-1', section: 'data', ask: 'Is the system of record named, with source precedence and a conflict policy a student can see?', when: 'officialRecords', blocking: true, evidence: 'repository' },
  { id: 'RR-DAT-2', section: 'data', ask: 'Are amounts and records derived from a ledger, re-read at commit and reconciled against the source?', when: 'money', blocking: true, evidence: 'repository', control: 'TC-SEC-12' },
  // Claims
  { id: 'RR-LEG-1', section: 'legal', ask: 'Is every public claim about this capability in the claims register at a status its evidence supports, and every counsel-queue item it depends on closed (requires qualified human counsel review)?', when: 'always', blocking: true, evidence: 'evidence-dir' },
];

export const question = (id: string): Question | undefined => QUESTIONS.find((q) => q.id === id);

export type Answer =
  | { status: 'pass'; reviewer: Seat; reviewedOn: string; expiresOn: string; evidence: readonly string[] }
  | { status: 'fail'; reviewer?: Seat; note: string }
  | { status: 'owed'; reviewer?: Seat; note: string }
  | { status: 'accepted'; acceptedBy: Seat; reviewedOn: string; until: string; reason: string };

export interface Review {
  /** `CAP-nnn`, one of the sixty. */
  capability: string;
  title: string;
  touches: readonly Touch[];
  /** The day the review was opened. */
  opened: string;
  answers: Readonly<Record<string, Answer>>;
  /** Risk ids from `risk.ts` that this capability can realise. */
  risks: readonly string[];
  /** Playbooks from `incidentplaybooks.ts`. */
  playbooks: readonly string[];
}

export const applicable = (review: Pick<Review, 'touches'>): readonly Question[] =>
  QUESTIONS.filter((q) => q.when === 'always' || review.touches.includes(q.when));

export const MAX_PASS_DAYS = 91;
export const MAX_EXCEPTION_DAYS = 90;

export const daysBetween = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** The seat is held when `COUNCIL` names a holder. */
export const seatHeld = (seat: Seat): boolean => COUNCIL.some((s) => s.seat === seat && s.holder !== null);

export type Standing = 'passed' | 'accepted' | 'failed' | 'known-gap' | 'owed' | 'expired' | 'invalid' | 'unanswered';

export interface Line {
  question: Question;
  standing: Standing;
  why: string;
}

const CONTROL_STANDING: Record<State, Standing> = { enforced: 'owed', partial: 'owed', documented: 'owed', absent: 'known-gap' };

/** What the control register already knows about a question nobody has answered. */
function seeded(q: Question): Line {
  const c = q.control ? control(q.control) : undefined;
  if (!c) return { question: q, standing: 'unanswered', why: 'Not yet reviewed.' };
  const standing = CONTROL_STANDING[c.state];
  const why =
    c.state === 'absent'
      ? `${c.id} is absent: ${c.gap ?? 'nothing exists'}`
      : c.state === 'enforced'
        ? `${c.id} is enforced in the repository; the owning seat has not reviewed it.`
        : `${c.id} is ${c.state}: ${c.gap ?? 'see the control'}`;
  return { question: q, standing, why };
}

/** Whether a path proves what the question asks. */
function proves(q: Question, paths: readonly string[], exists: (p: string) => boolean): string | undefined {
  if (paths.length === 0) return 'names no evidence';
  const missing = paths.find((p) => !exists(p));
  if (missing) return `${missing} does not exist`;
  if (q.evidence === 'evidence-dir' && !paths.some((p) => p.startsWith('docs/evidence/'))) return 'needs a file under docs/evidence/ because the thing must have been operated';
  const c = q.control ? control(q.control) : undefined;
  if (q.evidence === 'repository' && c && FAILS_A_BUILD.includes(c.mechanism) && !paths.some((p) => PROOF_SHAPE.test(p) || p.startsWith('docs/evidence/'))) {
    return `needs a test, check or workflow, since ${c.id} claims to fail a build`;
  }
  return undefined;
}

function judge(q: Question, review: Review, today: string, exists: (p: string) => boolean, held: (seat: Seat) => boolean): Line {
  const a = review.answers[q.id];
  if (!a) return seeded(q);

  if (a.status === 'owed') return { question: q, standing: 'owed', why: a.note };
  if (a.status === 'fail') return { question: q, standing: 'failed', why: a.note };

  if (a.status === 'accepted') {
    if (q.blocking) return { question: q, standing: 'invalid', why: 'a blocking question cannot be excepted' };
    if (!held(a.acceptedBy) || a.acceptedBy !== 'founder') return { question: q, standing: 'invalid', why: 'only the founder seat can accept a risk, and it must be held' };
    if (daysBetween(a.reviewedOn, a.until) > MAX_EXCEPTION_DAYS) return { question: q, standing: 'invalid', why: `an exception lasts at most ${MAX_EXCEPTION_DAYS} days` };
    if (a.reviewedOn > today) return { question: q, standing: 'invalid', why: 'dated in the future' };
    if (today >= a.until) return { question: q, standing: 'expired', why: `the exception ended ${a.until}` };
    return { question: q, standing: 'accepted', why: a.reason };
  }

  // pass
  const owner = SECTION_OWNER[q.section];
  if (a.reviewer !== owner) return { question: q, standing: 'invalid', why: `${q.section} is answered by the ${owner} seat, not ${a.reviewer}` };
  if (!held(owner)) return { question: q, standing: 'invalid', why: `the ${owner} seat is vacant` };
  if (a.reviewedOn > today) return { question: q, standing: 'invalid', why: 'dated in the future' };
  if (daysBetween(a.reviewedOn, a.expiresOn) > MAX_PASS_DAYS) return { question: q, standing: 'invalid', why: `a pass lasts at most ${MAX_PASS_DAYS} days` };
  if (today >= a.expiresOn) return { question: q, standing: 'expired', why: `the pass ended ${a.expiresOn}` };
  const problem = proves(q, a.evidence, exists);
  if (problem) return { question: q, standing: 'invalid', why: problem };
  return { question: q, standing: 'passed', why: a.evidence.join(', ') };
}

export type Verdict = 'go' | 'conditional' | 'no-go';

export interface Result {
  verdict: Verdict;
  lines: readonly Line[];
  /** Unresolved blocking questions. */
  hard: readonly Line[];
  /** Unresolved or excepted non-blocking questions. */
  soft: readonly Line[];
  /** Answer ids that name no question that applies, so a stale answer cannot hide. */
  strays: readonly string[];
}

const RESOLVED: readonly Standing[] = ['passed'];

export function evaluate(review: Review, today: string, exists: (p: string) => boolean, held: (seat: Seat) => boolean = seatHeld): Result {
  const asked = applicable(review);
  const lines = asked.map((q) => judge(q, review, today, exists, held));
  const hard = lines.filter((l) => l.question.blocking && !RESOLVED.includes(l.standing));
  const soft = lines.filter((l) => !l.question.blocking && !RESOLVED.includes(l.standing));
  const askedIds = new Set(asked.map((q) => q.id));
  const strays = Object.keys(review.answers).filter((id) => !askedIds.has(id));
  const verdict: Verdict = hard.length > 0 || strays.length > 0 ? 'no-go' : soft.length > 0 ? 'conditional' : 'go';
  return { verdict, lines, hard, soft, strays };
}

/** The review opened for a capability, if any. */
export const reviewFor = (capability: string): Review | undefined => REVIEWS.find((r) => r.capability === capability);

/**
 * The verdict a release decision should read. A capability with no review is
 * `no-go`, not "no objection": the absence of a record is the thing this
 * register exists to make visible.
 */
export function gateFor(capability: string, today: string, exists: (p: string) => boolean, held: (seat: Seat) => boolean = seatHeld): { verdict: Verdict; reviewed: boolean; result?: Result } {
  const review = reviewFor(capability);
  if (!review) return { verdict: 'no-go', reviewed: false };
  const result = evaluate(review, today, exists, held);
  return { verdict: result.verdict, reviewed: true, result };
}

/** How many of each standing a result holds, for a summary row. */
export function counts(result: Result): Record<Standing, number> {
  const out: Record<Standing, number> = { passed: 0, accepted: 0, failed: 0, 'known-gap': 0, owed: 0, expired: 0, invalid: 0, unanswered: 0 };
  for (const l of result.lines) out[l.standing] += 1;
  return out;
}

/** Every control id a question cites, so a test can hold the references to the register. */
export const citedControls = (): string[] => QUESTIONS.flatMap((q) => (q.control ? [q.control] : []));

export const controlsKnown = (): boolean => citedControls().every((id) => CONTROLS.some((c) => c.id === id));

// ── The reviews opened ──

const OPENED = '2026-10-04';

/**
 * The five capabilities the activation register marks high risk. Each review
 * is opened with no human answers: the seats that must give them are mostly
 * vacant, and an answer written here on their behalf would be the thing this
 * record exists to prevent. What each shows is what the control register
 * already knows.
 */
export const REVIEWS: readonly Review[] = [
  {
    capability: 'CAP-041',
    title: 'Family',
    touches: ['personalData', 'minors', 'sharing', 'officialRecords', 'staffAccess'],
    opened: OPENED,
    answers: {},
    risks: ['R-01', 'R-13'],
    playbooks: ['IR-01', 'IR-08', 'IR-12'],
  },
  {
    capability: 'CAP-046',
    title: 'Money',
    touches: ['personalData', 'money', 'officialRecords', 'integrations'],
    opened: OPENED,
    answers: {},
    risks: ['R-01', 'R-08'],
    playbooks: ['IR-03', 'IR-05', 'IR-10'],
  },
  {
    capability: 'CAP-047',
    title: 'Meal Plan',
    touches: ['personalData', 'money', 'integrations'],
    opened: OPENED,
    answers: {},
    risks: ['R-08'],
    playbooks: ['IR-05', 'IR-10'],
  },
  {
    capability: 'CAP-048',
    title: 'Housing',
    touches: ['personalData', 'officialRecords', 'integrations'],
    opened: OPENED,
    answers: {},
    risks: ['R-01', 'R-08'],
    playbooks: ['IR-03', 'IR-05'],
  },
  {
    capability: 'CAP-050',
    title: 'Registration',
    touches: ['personalData', 'officialRecords', 'integrations'],
    opened: OPENED,
    answers: {},
    risks: ['R-01', 'R-08'],
    playbooks: ['IR-03', 'IR-05', 'IR-06'],
  },
];
