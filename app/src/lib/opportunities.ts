import type { OfficeId } from './offices';

/**
 * Everything a student does that is not a course and still counts.
 *
 * A campus job, a lab, a term abroad, a certificate, an internship, a
 * scholarship application, an alumni mentor. Seven things universities run from
 * seven offices with seven portals, and a student meets them all in the same
 * week. They share a shape — find it, check you are eligible, apply, do it,
 * show what you did — so they share one tracker, and each kind brings its own
 * checklist in the order its office works.
 *
 * ## What never happens here
 *
 * - **Eligibility is never decided.** Work-study, a scholarship, a visa: the
 *   office decides, and every one of those steps names it. The app can hold
 *   "financial aid says I am eligible" as the student's note; it never computes
 *   it.
 * - **Work-study stays private.** It is a flag on the student's own entry, never
 *   shown in the job's title, never exported in the resume view, never sent.
 * - **Visa and immigration information is informational.** `ABROAD_NOTICE` is
 *   drawn beside every step that touches it, and the app never asks for, stores
 *   or infers citizenship or immigration status.
 * - **Resume lines come only from approved evidence.** A student writes what
 *   they did, ticks it as ready to use, and only then does it reach
 *   `resumeBullets`. Nothing is invented from a title.
 */

export const KINDS = [
  { id: 'job', label: 'Campus job', plural: 'Jobs' },
  { id: 'research', label: 'Research', plural: 'Research' },
  { id: 'abroad', label: 'Study abroad', plural: 'Abroad' },
  { id: 'experience', label: 'Internship or placement', plural: 'Experience' },
  { id: 'credential', label: 'Certificate or badge', plural: 'Credentials' },
  { id: 'funding', label: 'Scholarship or grant', plural: 'Funding' },
  { id: 'alumni', label: 'Alumni mentor', plural: 'Alumni' },
] as const;

export type Kind = (typeof KINDS)[number]['id'];

export const STAGES = ['Interested', 'Preparing', 'Applied', 'Active', 'Done', 'Closed'] as const;
export type OpportunityStage = (typeof STAGES)[number];

export interface Template {
  id: string;
  title: string;
  office?: OfficeId;
  /** Drawn with `ABROAD_NOTICE` beside it. */
  informational?: boolean;
}

export const ABROAD_NOTICE =
  'Visa and immigration rules change and depend on your own situation. This is general information, not legal advice — your international or global education office advises on your case.';

export const IRB_NOTICE =
  'Whether a project needs ethics review is decided by your IRB office. This list is a learning path, not a compliance determination.';

export const TEMPLATES: Record<Kind, readonly Template[]> = {
  job: [
    { id: 'find', title: 'Find an approved posting in the student job board', office: 'employment' },
    { id: 'ws', title: 'Check work-study eligibility with financial aid (private to you)', office: 'financialaid' },
    { id: 'apply', title: 'Apply and interview' },
    { id: 'paperwork', title: 'Complete hiring paperwork: identity, tax and payroll forms', office: 'employment' },
    { id: 'training', title: 'Finish any required job training', office: 'employment' },
    { id: 'schedule', title: 'Put your shifts in your plan, if you want them there' },
    { id: 'evidence', title: 'Write down what you did, for your resume' },
  ],
  research: [
    { id: 'explore', title: 'Find labs and projects with verified openings', office: 'research' },
    { id: 'contact', title: 'Contact a faculty mentor with a short, specific note' },
    { id: 'apply', title: 'Apply — program, credit or paid position', office: 'research' },
    { id: 'training', title: 'Complete required research training (lab safety, responsible conduct)', office: 'research' },
    { id: 'irb', title: 'Learn how ethics review works, and ask the IRB if your project needs it', office: 'irb', informational: true },
    { id: 'onboard', title: 'Lab onboarding: access, notebook, data storage rules' },
    { id: 'data', title: 'Write a data-management plan with your mentor' },
    { id: 'milestones', title: 'Set milestones for the term' },
    { id: 'present', title: 'Poster, conference or publication plan' },
    { id: 'travel', title: 'Apply for travel or research funding', office: 'research' },
  ],
  abroad: [
    { id: 'program', title: 'Choose a program and destination', office: 'abroad' },
    { id: 'equivalency', title: 'Check course equivalencies before you go', office: 'abroad' },
    { id: 'cost', title: 'Compare cost and funding, including what aid carries over', office: 'financialaid' },
    { id: 'approvals', title: 'Get the approvals: advisor, program and school', office: 'abroad' },
    { id: 'passport', title: 'Passport and visa resources for your destination', office: 'abroad', informational: true },
    { id: 'predeparture', title: 'Attend pre-departure orientation', office: 'abroad' },
    { id: 'return', title: 'On return: confirm credit transferred', office: 'registrar' },
  ],
  experience: [
    { id: 'eligibility', title: 'Check eligibility and whether it can earn credit', office: 'career' },
    { id: 'agreement', title: 'Sign a learning agreement with goals and milestones', office: 'career' },
    { id: 'supervisor', title: 'Record your supervisor’s work contact (kept private)' },
    { id: 'training', title: 'Complete required training or clearances' },
    { id: 'hours', title: 'Log hours, if your program requires it' },
    { id: 'journal', title: 'Keep a reflection journal' },
    { id: 'portfolio', title: 'Choose what goes in your portfolio, and who sees it' },
    { id: 'handoff', title: 'Close out with your faculty sponsor or career office', office: 'career' },
  ],
  credential: [
    { id: 'choose', title: 'Choose a certificate, badge or short course', office: 'continuing' },
    { id: 'skills', title: 'List the skills it evidences' },
    { id: 'enroll', title: 'Enroll and note the deadlines', office: 'continuing' },
    { id: 'prior', title: 'Ask whether prior learning counts toward it', office: 'continuing' },
    { id: 'complete', title: 'Complete it and save the record' },
    { id: 'export', title: 'Add it to your portfolio or resume' },
  ],
  funding: [
    { id: 'eligibility', title: 'Read the eligibility rules on the official listing', office: 'financialaid' },
    { id: 'checklist', title: 'List what the application needs' },
    { id: 'essay', title: 'Draft the essay or statement' },
    { id: 'references', title: 'Ask for references, with the deadline' },
    { id: 'submit', title: 'Submit through the official system' },
    { id: 'decide', title: 'Accept or decline the award in the official system', office: 'financialaid' },
  ],
  alumni: [
    { id: 'program', title: 'Join the alumni mentoring program', office: 'alumni' },
    { id: 'ask', title: 'Say what you want to talk about' },
    { id: 'meet', title: 'Meet — through the program, not a personal account' },
    { id: 'thanks', title: 'Follow up with thanks' },
  ],
};

export interface Evidence {
  id: string;
  text: string;
  /** Ticked by the student. Only approved evidence reaches a resume line. */
  approved: boolean;
}

export interface Reference {
  id: string;
  name: string;
  asked: string;
  received: boolean;
}

export interface Opportunity {
  id: string;
  kind: Kind;
  title: string;
  org: string;
  stage: OpportunityStage;
  deadline: string;
  /** Where the student found it. Funding without one is labelled unverified. */
  source: string;
  steps: Record<string, boolean>;
  notes: string;
  hoursPerWeek: number;
  /** Private: never drawn in a title, never in the resume view. */
  workStudy: boolean;
  evidence: Evidence[];
  references: Reference[];
  skills: string[];
}

export interface OpportunityLibrary {
  items: Opportunity[];
  budget: TimeBudget;
}

export interface TimeBudget {
  classes: number;
  study: number;
  work: number;
  commute: number;
  caregiving: number;
  sleep: number;
  other: number;
}

export const EMPTY_BUDGET: TimeBudget = { classes: 15, study: 30, work: 0, commute: 0, caregiving: 0, sleep: 56, other: 0 };
export const EMPTY_OPPORTUNITIES: OpportunityLibrary = { items: [], budget: EMPTY_BUDGET };

export const LIMITS = { items: 200, evidence: 30, references: 10, text: 2000, title: 160 } as const;

let seq = 0;
function uid(prefix: string) {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}

export function newOpportunity(kind: Kind): Opportunity {
  return {
    id: uid('op'),
    kind,
    title: '',
    org: '',
    stage: 'Interested',
    deadline: '',
    source: '',
    steps: {},
    notes: '',
    hoursPerWeek: 0,
    workStudy: false,
    evidence: [],
    references: [],
    skills: [],
  };
}

export function newEvidence(text: string): Evidence {
  return { id: uid('ev'), text: text.slice(0, LIMITS.text), approved: false };
}

export function newReference(name: string): Reference {
  return { id: uid('ref'), name: name.slice(0, LIMITS.title), asked: '', received: false };
}

/** Checklist progress for one entry. */
export function stepProgress(o: Opportunity) {
  const t = TEMPLATES[o.kind];
  return { done: t.filter((s) => o.steps[s.id]).length, of: t.length };
}

/**
 * The week in hours, and what is left of it.
 *
 * 168 is the only fixed number. Everything else is the student's own estimate,
 * and the result is said as "left for everything else", never as a verdict — a
 * negative number means the plan does not fit, which is worth knowing before
 * accepting twenty hours of shifts, and says nothing about the student.
 */
export function timeBudget(b: TimeBudget) {
  const parts = Object.entries(b) as [keyof TimeBudget, number][];
  const used = parts.reduce((a, [, n]) => a + (Number.isFinite(n) && n > 0 ? n : 0), 0);
  return { used, left: 168 - used, fits: used <= 168 };
}

/** Upcoming deadlines across every entry, soonest first. Closed and done are skipped. */
export function deadlines(items: readonly Opportunity[], today: string) {
  return items
    .filter((o) => o.deadline && o.deadline >= today && o.stage !== 'Done' && o.stage !== 'Closed')
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
}

/**
 * Resume lines from what the student approved, and nothing else.
 *
 * Trimmed, first letter raised, trailing full stop dropped — resume
 * convention — and grouped under the entry's title and organization. The
 * work-study flag is deliberately not read here.
 */
export function resumeBullets(items: readonly Opportunity[]): { heading: string; bullets: string[] }[] {
  return items
    .map((o) => ({
      heading: [o.title.trim(), o.org.trim()].filter(Boolean).join(' — ') || KINDS.find((k) => k.id === o.kind)!.label,
      bullets: o.evidence
        .filter((e) => e.approved && e.text.trim())
        .map((e) => {
          const t = e.text.trim().replace(/\.+$/, '');
          return t.charAt(0).toUpperCase() + t.slice(1);
        }),
    }))
    .filter((g) => g.bullets.length > 0);
}

/** Every skill, and which entries evidence it — the credential-to-career map. */
export function skillMap(items: readonly Opportunity[]): { skill: string; from: string[] }[] {
  const map = new Map<string, { skill: string; from: string[] }>();
  for (const o of items) {
    for (const raw of o.skills) {
      const skill = raw.trim();
      if (!skill) continue;
      const key = skill.toLowerCase();
      const row = map.get(key) ?? { skill, from: [] };
      row.from.push(o.title || KINDS.find((k) => k.id === o.kind)!.label);
      map.set(key, row);
    }
  }
  return [...map.values()].sort((a, b) => b.from.length - a.from.length || a.skill.localeCompare(b.skill));
}

const KIND_IDS = new Set<string>(KINDS.map((k) => k.id));
const STAGE_SET = new Set<string>(STAGES);

function str(v: unknown, max: number = LIMITS.text): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function num(v: unknown, max = 168): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : 0;
}

function readOne(v: unknown): Opportunity | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.kind !== 'string' || !KIND_IDS.has(o.kind)) return null;
  const kind = o.kind as Kind;
  const ids = new Set(TEMPLATES[kind].map((t) => t.id));
  const steps: Record<string, boolean> = {};
  if (o.steps && typeof o.steps === 'object') {
    for (const [k, x] of Object.entries(o.steps)) if (ids.has(k) && x === true) steps[k] = true;
  }
  return {
    id: o.id.slice(0, 80),
    kind,
    title: str(o.title, LIMITS.title),
    org: str(o.org, LIMITS.title),
    stage: typeof o.stage === 'string' && STAGE_SET.has(o.stage) ? (o.stage as OpportunityStage) : 'Interested',
    deadline: typeof o.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.deadline) ? o.deadline : '',
    source: str(o.source, 500),
    steps,
    notes: str(o.notes),
    hoursPerWeek: num(o.hoursPerWeek),
    workStudy: o.workStudy === true,
    evidence: (Array.isArray(o.evidence) ? o.evidence : [])
      .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object' && typeof (e as Evidence).id === 'string')
      .slice(0, LIMITS.evidence)
      .map((e) => ({ id: String(e.id), text: str(e.text), approved: e.approved === true })),
    references: (Array.isArray(o.references) ? o.references : [])
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && typeof (r as Reference).id === 'string')
      .slice(0, LIMITS.references)
      .map((r) => ({ id: String(r.id), name: str(r.name, LIMITS.title), asked: str(r.asked, 10), received: r.received === true })),
    skills: (Array.isArray(o.skills) ? o.skills : []).filter((s): s is string => typeof s === 'string').slice(0, 30).map((s) => s.slice(0, 80)),
  };
}

export function readOpportunities(v: unknown): OpportunityLibrary {
  if (!v || typeof v !== 'object') return EMPTY_OPPORTUNITIES;
  const o = v as Record<string, unknown>;
  const b = (o.budget && typeof o.budget === 'object' ? o.budget : {}) as Record<string, unknown>;
  const budget = Object.fromEntries(
    (Object.keys(EMPTY_BUDGET) as (keyof TimeBudget)[]).map((k) => [k, k in b ? num(b[k]) : EMPTY_BUDGET[k]]),
  ) as unknown as TimeBudget;
  return {
    items: (Array.isArray(o.items) ? o.items : []).map(readOne).filter((x): x is Opportunity => x !== null).slice(0, LIMITS.items),
    budget,
  };
}
