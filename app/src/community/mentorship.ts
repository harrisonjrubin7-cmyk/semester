/**
 * Peer mentorship as a structured, opt-in, time-bounded programme.
 *
 * `lib/mentors.ts` and `20260928021700_mentor_rosters.sql` hold the request
 * and the mutual yes: only the recipient accepts, capacity is checked at
 * acceptance, and an assignment lasts 180 days at most. What they do not
 * hold is the programme around a pairing, and that is what this file adds:
 *
 * - the programme templates, each with a purpose, a length and what it is
 *   *not* for;
 * - what a mentor must have done before they are offered to anyone;
 * - what a match may be explained from, and the words it is explained in;
 * - the check-in points of a pairing, and the fact that either side may end,
 *   pause or ask for a rematch at any of them without a mark against them;
 * - what a coordinator sees, which is counts under the cohort floor and
 *   never a person.
 *
 * `FORBIDDEN_MATCH_INPUTS` is the line the blueprints draw twice: never match
 * on inferred disability, mental-health status, protected identity, grades,
 * risk labels, behavioural profiles or private academic records. A screen
 * cannot cross it by accident, because `explainMatch` refuses an input it
 * does not know.
 */
import { MIN_COHORT, suppress } from '../lib/institution-ops';
import { NOT_AN_EMERGENCY_SERVICE } from './governance';

export const PROGRAMS = [
  { id: 'transfer_transition', name: 'Transfer transition', purpose: 'Navigate services, culture and academic planning after transferring in', weeks: [6, 10], scope: 'Navigation, belonging, resources' },
  { id: 'first_term', name: 'First-term success', purpose: 'Establish routines and support connections in the first term', weeks: [6, 12], scope: 'Orientation and adjustment' },
  { id: 'academic_pathway', name: 'Academic pathway', purpose: 'Explore a major or discipline', weeks: [12, 16], scope: 'Study habits, opportunities, department navigation' },
  { id: 'career_exploration', name: 'Career exploration', purpose: 'Learn about roles, portfolios and professional pathways', weeks: [6, 12], scope: 'Informational and career preparation' },
  { id: 'international_transition', name: 'International transition', purpose: 'Find campus resources and peer connection', weeks: [12, 16], scope: 'Non-legal, non-immigration guidance' },
  { id: 'learning_strategy', name: 'Accessibility and learning strategy', purpose: 'Peer support around study practices and resource navigation', weeks: [12, 16], scope: 'Student-controlled; no diagnosis disclosure required' },
  { id: 'club_leadership', name: 'Club and leadership', purpose: 'Prepare new officers and student leaders', weeks: [8, 16], scope: 'Governance, events, community leadership' },
] as const;

export type ProgramId = (typeof PROGRAMS)[number]['id'];

/** What every mentor is trained to say, and what a mentorship is never for. */
export const MENTOR_BOUNDARY =
  'I can listen, help you identify options, and connect you to the right resource. I cannot make official academic, legal, medical, financial-aid, immigration, disciplinary, or crisis decisions.';

export const OUT_OF_SCOPE = ['clinical counseling', 'legal advice', 'immigration advice', 'emergency support', 'official academic decisions'] as const;

// ── Mentor onboarding ───────────────────────────────────────────────────────

export const TRAINING_MODULES = [
  { id: 'listening', name: 'Active listening and boundaries' },
  { id: 'humility', name: 'Cultural humility and accessibility' },
  { id: 'escalation', name: 'Escalation and referral' },
  { id: 'privacy', name: 'Confidentiality and privacy' },
] as const;

export type ModuleId = (typeof TRAINING_MODULES)[number]['id'];

/** Training is renewed yearly. */
export const RENEWAL_DAYS = 365;

export type Format = 'in_person' | 'online' | 'either';

export interface MentorProfile {
  id: string;
  name: string;
  programs: readonly ProgramId[];
  topics: readonly string[];
  availability: readonly string[];
  languages: readonly string[];
  format: Format;
  /** ISO date each module was completed. */
  training: Partial<Record<ModuleId, string>>;
  conductAcknowledgedOn: string | null;
  /** Lived experience the mentor chose to offer, in their own words. Offered only when a mentee asked. */
  livedExperience: readonly string[];
  /** Concurrent mentees the mentor will take; the coordinator caps it. */
  capacity: number;
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Why a mentor cannot yet be offered; empty when they can. */
export function eligibilityProblems(m: MentorProfile, today: string): string[] {
  const problems: string[] = [];
  for (const mod of TRAINING_MODULES) {
    const on = m.training[mod.id];
    if (!on) problems.push(`training not complete: ${mod.name}`);
    else if (daysBetween(on, today) > RENEWAL_DAYS) problems.push(`training due for renewal: ${mod.name}`);
  }
  if (!m.conductAcknowledgedOn) problems.push('code of conduct not acknowledged');
  if (!m.programs.length) problems.push('no programme chosen');
  if (m.capacity < 1) problems.push('no capacity offered');
  return problems;
}

// ── Matching ────────────────────────────────────────────────────────────────

export interface MenteeRequest {
  id: string;
  program: ProgramId;
  goal: string;
  topics: readonly string[];
  availability: readonly string[];
  format: Format;
  languages: readonly string[];
  communication?: string;
  /** Voluntarily shared. Read only to show the mentor what to arrange, never to match. */
  accessibility?: string;
  /** Asked for explicitly. Only then is a mentor's lived experience compared. */
  wantsLivedExperience?: readonly string[];
}

/** Never an input to a match, whatever a caller hands in. */
export const FORBIDDEN_MATCH_INPUTS = [
  'grade', 'gpa', 'standing', 'accommodation', 'disability', 'diagnosis', 'health', 'wellbeing', 'risk', 'score',
  'behavior', 'behaviour', 'attendance', 'submission', 'ethnicity', 'race', 'religion', 'gender', 'orientation',
  'nationality', 'immigration', 'income', 'aid', 'conduct_record', 'safety_state',
] as const;

export function assertMatchInputs(input: Record<string, unknown>): void {
  const keys = Object.keys(input).map((k) => k.toLowerCase());
  const hit = FORBIDDEN_MATCH_INPUTS.filter((f) => keys.some((k) => k.includes(f)));
  if (hit.length) throw new Error(`a match may not read: ${hit.join(', ')}`);
}

export interface Match {
  mentor: MentorProfile;
  /** "Why this person may be a fit", each line from something both chose. */
  why: string[];
}

const overlap = (a: readonly string[], b: readonly string[]) => a.filter((x) => b.includes(x));

/**
 * The short, explainable set. A mentor appears only for the mentee's
 * programme and with something in common the mentee can see; the order is
 * by how much is shared, then by name, and it is never a score. `limit`
 * keeps it short because a list of forty is a ranking with extra steps.
 */
export function explainMatch(request: MenteeRequest, mentors: readonly MentorProfile[], today: string, limit = 3): Match[] {
  assertMatchInputs(request as unknown as Record<string, unknown>);
  return mentors
    .filter((m) => m.programs.includes(request.program) && eligibilityProblems(m, today).length === 0)
    .map((mentor) => {
      const why: string[] = [];
      const topics = overlap(mentor.topics, request.topics);
      if (topics.length) why.push(`You both chose: ${topics.join(', ')}`);
      const when = overlap(mentor.availability, request.availability);
      if (when.length) why.push(`Both free: ${when.join(', ')}`);
      if (mentor.format === request.format || mentor.format === 'either' || request.format === 'either') why.push('Meeting format works for both of you');
      const langs = overlap(mentor.languages, request.languages);
      if (langs.length) why.push(`Shared language: ${langs.join(', ')}`);
      if (request.wantsLivedExperience?.length) {
        const lived = overlap(mentor.livedExperience, request.wantsLivedExperience);
        if (lived.length) why.push(`Offers lived experience you asked for: ${lived.join(', ')}`);
      }
      return { mentor, why };
    })
    .filter((m) => m.why.length > 0)
    .sort((a, b) => b.why.length - a.why.length || a.mentor.name.localeCompare(b.mentor.name))
    .slice(0, limit);
}

// ── A pairing ───────────────────────────────────────────────────────────────

export const PAIRING_STATES = ['proposed', 'accepted', 'active', 'paused', 'closed', 'rematched'] as const;
export type PairingState = (typeof PAIRING_STATES)[number];

export const PAIRING_MOVES: Readonly<Record<PairingState, readonly PairingState[]>> = {
  proposed: ['accepted', 'closed'],
  accepted: ['active', 'closed'],
  active: ['paused', 'closed', 'rematched'],
  paused: ['active', 'closed', 'rematched'],
  closed: [],
  rematched: [],
};

export interface Pairing {
  id: string;
  program: ProgramId;
  mentorId: string;
  menteeId: string;
  state: PairingState;
  startsOn: string;
  /** The end the two agreed, inside the programme's weeks. */
  endsOn: string;
  goal: string;
  /** Kept by the participants; nobody else writes one. */
  actionItems: readonly string[];
}

/** Either party, any time, no reason required and none recorded against them. */
export function move(p: Pairing, to: PairingState, by: 'mentor' | 'mentee' | 'coordinator'): { ok: true; pairing: Pairing } | { ok: false; reason: string } {
  if (!PAIRING_MOVES[p.state].includes(to)) return { ok: false, reason: `a ${p.state} pairing cannot become ${to}` };
  if (to === 'accepted' && by !== 'mentor') return { ok: false, reason: 'only the mentor accepts' };
  return { ok: true, pairing: { ...p, state: to } };
}

/** The agreed end must fall inside the programme's weeks. */
export function lengthProblem(p: Pairing): string | null {
  const prog = PROGRAMS.find((x) => x.id === p.program);
  if (!prog) return 'not a programme';
  const weeks = daysBetween(p.startsOn, p.endsOn) / 7;
  const [lo, hi] = prog.weeks;
  return weeks < lo || weeks > hi ? `${prog.name} runs ${lo} to ${hi} weeks` : null;
}

export interface CheckIn {
  id: 'welcome' | 'first_meeting' | 'midpoint' | 'end';
  name: string;
  on: string;
  prompts: readonly string[];
}

/** The four points of a pairing, dated from its start and end. */
export function checkIns(p: Pairing): CheckIn[] {
  const start = Date.parse(p.startsOn);
  const end = Date.parse(p.endsOn);
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  return [
    { id: 'welcome', name: 'Welcome and boundaries', on: p.startsOn, prompts: ['Read the boundaries together', 'Agree the goal', 'Choose how and when to meet'] },
    { id: 'first_meeting', name: 'First meeting', on: iso(start + 7 * 86_400_000), prompts: ['Did you meet?', 'What is the one next step?'] },
    { id: 'midpoint', name: 'Midpoint', on: iso(start + (end - start) / 2), prompts: ['Is this useful?', 'Rematch, pause or continue?', 'Anything to refer to an official service?'] },
    { id: 'end', name: 'Close and reflect', on: p.endsOn, prompts: ['What changed?', 'What is the next resource or opportunity?', 'Close, rematch or extend through the coordinator'] },
  ];
}

export const FIRST_MEETING_AGENDA = ['Introductions and what brought you here', 'The goal, in the mentee\'s words', 'What a good outcome looks like by the end', 'How often to meet, and where', 'When to refer to an official service', MENTOR_BOUNDARY] as const;

export const PAIRING_NOTICE = [NOT_AN_EMERGENCY_SERVICE, 'Either of you can pause, end or ask for a different match at any time. Nothing is recorded against you for it.'] as const;

// ── What a coordinator sees ─────────────────────────────────────────────────

export interface CoordinatorSummary {
  program: ProgramId;
  applications: number;
  trainedMentors: number;
  waiting: number;
  /** Pairings proposed more than `UNACCEPTED_DAYS` ago and still proposed. */
  unaccepted: number;
  active: number;
  rematches: number;
  /** Shown only when at least `MIN_COHORT` pairings reached the point; otherwise `null`. */
  firstMeetingCompleted: number | null;
  completed: number | null;
}

export const UNACCEPTED_DAYS = 7;

/**
 * Counts, not people. The completion figures pass through the same
 * small-cell suppression the institution's own reports use, so a programme
 * of four pairings reports "not enough to show" rather than who met.
 */
export function coordinatorSummary(
  program: ProgramId,
  mentors: readonly MentorProfile[],
  requests: readonly MenteeRequest[],
  pairings: readonly Pairing[],
  today: string,
  proposedOn: (p: Pairing) => string,
  met: (p: Pairing) => boolean,
): CoordinatorSummary {
  const ours = pairings.filter((p) => p.program === program);
  const paired = new Set(ours.filter((p) => p.state !== 'closed' && p.state !== 'rematched').map((p) => p.menteeId));
  const reached = ours.filter((p) => p.state === 'active' || p.state === 'paused' || p.state === 'closed');
  // Two independent counts, not two parts of a total: each is its own group,
  // so the complementary rule does not hide one because the other is small.
  const cells = suppress([
    { key: 'met', group: `${program}:met`, n: reached.filter(met).length },
    { key: 'completed', group: `${program}:completed`, n: ours.filter((p) => p.state === 'closed' && p.endsOn <= today).length },
  ], MIN_COHORT);
  return {
    program,
    applications: mentors.filter((m) => m.programs.includes(program)).length,
    trainedMentors: mentors.filter((m) => m.programs.includes(program) && eligibilityProblems(m, today).length === 0).length,
    waiting: requests.filter((r) => r.program === program && !paired.has(r.id)).length,
    unaccepted: ours.filter((p) => p.state === 'proposed' && daysBetween(proposedOn(p), today) > UNACCEPTED_DAYS).length,
    active: ours.filter((p) => p.state === 'active').length,
    rematches: ours.filter((p) => p.state === 'rematched').length,
    firstMeetingCompleted: cells[0].shown,
    completed: cells[1].shown,
  };
}
