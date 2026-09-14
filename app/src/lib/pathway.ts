import { finite, isoDay, obj, textValue } from './device-library';
import { safeUrl } from './apply';

/**
 * The parts of a degree that are longer than a term.
 *
 * Applying somewhere, arriving, a thesis, graduating, leaving. Each is a
 * project with a shape most people meet once, which is exactly the kind of
 * thing worth having a checklist for — `PATHWAY_TEMPLATES` is eleven of them,
 * in the order the deadlines actually fall.
 *
 * ## A stage is a label on this device
 *
 * `LIFE_STAGES` and `APPLICATION_STAGES` are what the *student* believes is
 * happening. Setting one to "Accepted" changes a word on a card and nothing
 * else: it does not enrol anybody, does not alter a permission, and does not
 * reach an institution. It cannot — see `lib/university.ts` for how little is
 * connected. Coursework is untouched by any of it.
 *
 * That is worth stating because "Submitted" and "Accepted" are in the list,
 * and a status that *looks* like a system-of-record status is the thing
 * somebody will later trust. The screen labels the whole section as planning,
 * and `readPrograms` will happily read a programme marked Accepted that never
 * was, because it is a note, not a claim.
 *
 * ## The costs are estimates the student typed
 *
 * `netProgramCost` adds three numbers and subtracts a fourth. Nothing here
 * fetches a tuition figure or verifies an aid award, so every number in it is
 * as good as what somebody copied off a web page — which is good enough for
 * comparing two programmes and not good enough for anything else.
 */

export const LIFE_STAGES = [
  'Prospective student',
  'Applicant',
  'Accepted student',
  'Undergraduate',
  'Master’s student',
  'Doctoral student',
  'Professional student',
  'Alumnus',
] as const;

export const APPLICATION_STAGES = [
  'Preparing',
  'Ready for review',
  'Submitted',
  'Incomplete',
  'Under review',
  'Interview requested',
  'Waitlisted',
  'Accepted',
  'Deferred',
  'Denied',
  'Withdrawn',
] as const;

/**
 * How ready one required document is.
 *
 * "Ready locally" and "Reported received" are two different claims and the
 * wording keeps them apart: the first is something the student can know, the
 * second is something they were *told*. Neither is "received", because this
 * app has no way to find that out.
 */
export const MATERIAL_STATES = ['Not started', 'Preparing', 'Ready locally', 'Reported received'] as const;

export interface ProgramMaterial {
  id: string;
  title: string;
  status: (typeof MATERIAL_STATES)[number];
  due: string;
}

export interface Program {
  id: string;
  school: string;
  program: string;
  location: string;
  degree: string;
  deadline: string;
  url: string;
  requirements: string;
  tuition: number;
  living: number;
  other: number;
  aid: number;
  currency: string;
  period: string;
  status: (typeof APPLICATION_STAGES)[number];
  notes: string;
  materials: ProgramMaterial[];
}

export interface Milestone {
  id: string;
  title: string;
  owner: string;
  due: string;
  done: boolean;
  notes: string;
}

export interface PathwayProject {
  id: string;
  title: string;
  kind: string;
  notes: string;
  steps: Milestone[];
  history: { at: number; message: string }[];
}

export interface PathwayLibrary {
  version: 1;
  stage: (typeof LIFE_STAGES)[number];
  profile: { name: string; education: string; experience: string; goals: string };
  programs: Program[];
  projects: PathwayProject[];
}

export const EMPTY_PATHWAY: PathwayLibrary = {
  version: 1,
  stage: 'Undergraduate',
  profile: { name: '', education: '', experience: '', goals: '' },
  programs: [],
  projects: [],
};

export const PATHWAY_LIMITS = {
  programs: 150,
  projects: 100,
  steps: 100,
  materials: 60,
  history: 200,
  money: 1e8,
} as const;

export const newProgram = (): Program => ({
  id: crypto.randomUUID(),
  school: '',
  program: '',
  location: '',
  degree: 'Undergraduate',
  deadline: '',
  url: '',
  requirements: '',
  tuition: 0,
  living: 0,
  other: 0,
  aid: 0,
  currency: 'USD',
  period: 'Academic year',
  status: 'Preparing',
  notes: '',
  materials: [],
});

/**
 * Eleven projects, as the steps somebody would actually take.
 *
 * Read the verbs: "Review", "Confirm", "Request", "Prepare". Nothing here says
 * "Submit" or "Approve", because none of those is a thing this app does — and
 * a checklist that ticks "Submitted" would leave somebody believing they had.
 * Where an authority is involved the step names it: an advisor, an official
 * evaluation, an ethics approval that must come *before* the work it gates.
 */
export const PATHWAY_TEMPLATES: Record<string, string[]> = {
  'College application': [
    'Confirm program requirements and deadlines',
    'Prepare profile and essays',
    'Request transcripts and recommendations',
    'Review required documents and fees',
    'Review the final application',
    'Record the official submission receipt',
  ],
  'Accepted student': [
    'Review offer and enrollment conditions',
    'Confirm deposit and aid deadlines',
    'Prepare final transcript',
    'Arrange housing and meal plan',
    'Review health and accessibility forms in approved services',
    'Complete placement and advising preparation',
    'Arrange student ID and orientation',
    'Review registration and move-in instructions',
  ],
  'Transfer credit': [
    'Gather course descriptions and transcripts',
    'List requested course equivalencies',
    'Prepare advisor questions',
    'Request official evaluation',
    'Review institution-issued decisions',
  ],
  'International arrival': [
    'Review official international-office instructions',
    'Confirm document and travel deadlines',
    'Arrange advisor appointment',
    'Plan arrival and housing',
    'Record required orientation steps',
  ],
  'Thesis or dissertation': [
    'Explore topic and research question',
    'Prepare proposal',
    'Request committee review',
    'Organize literature and evidence',
    'Prepare research and data-management plan',
    'Request required ethics approval',
    // Deliberately after the approval above, and worded as a consequence of it.
    'Plan data collection after authorization',
    'Analyze findings',
    'Draft chapters',
    'Request advisor review',
    'Arrange defense',
    'Address revisions',
    'Review final submission and institutional deposit',
  ],
  'Research publication': [
    'Define research question',
    'Organize original sources',
    'Record methods and contributions',
    'Prepare manuscript and figures',
    'Request coauthor review',
    'Check journal requirements',
    'Review submission package',
    'Track reviewer feedback and revisions',
  ],
  'Clinical or professional placement': [
    'Confirm program requirements',
    'Review placement agreement',
    'Complete required training',
    'Prepare skills and hours checklist',
    'Arrange supervisor review',
    'Request official completion verification',
  ],
  'Graduation and alumni': [
    'Review degree requirements',
    'Resolve outstanding holds',
    'Prepare graduation application',
    'Review ceremony and guest arrangements',
    'Confirm diploma information',
    'Export personal work and portfolio',
    'Review alumni account and retention choices',
  ],
  'Faculty course launch': [
    'Define outcomes and sections',
    'Prepare syllabus and modules',
    'Create assignments and rubrics',
    'Review question bank and assessment policy',
    'Confirm roster and teaching-assistant permissions',
    'Review approved accommodations',
    'Check accessibility and release schedule',
    'Verify grade submission process',
  ],
  'Institution pilot': [
    'Name system owners and initial cohort',
    'Inventory systems and data ownership',
    'Map roles and permissions',
    'Prepare migration and duplicate checks',
    'Validate sample records',
    'Test rollback and recovery',
    'Complete accessibility and security review',
    'Train faculty and students',
    'Operate in parallel',
    'Review pilot outcomes before expanding',
  ],
  'Request or appeal': [
    'State requested change and supporting facts',
    'Identify required documents',
    'Identify authorized reviewers',
    'Confirm deadline and routing',
    'Review request before submission',
    'Record official tracking reference',
    'Review response and next steps',
  ],
};

export function newPathwayProject(kind: string): PathwayProject {
  return {
    id: crypto.randomUUID(),
    title: kind,
    kind,
    notes: '',
    steps: (PATHWAY_TEMPLATES[kind] || []).map((title) => ({
      id: crypto.randomUUID(),
      title,
      owner: '',
      due: '',
      done: false,
      notes: '',
    })),
    history: [],
  };
}

/** Programme records out of storage or a file, or an error. */
export function readPrograms(v: unknown): Program[] {
  if (!Array.isArray(v) || v.length > PATHWAY_LIMITS.programs) {
    throw new Error(`Use up to ${PATHWAY_LIMITS.programs} program records.`);
  }
  const ids = new Set<string>();

  return v.map((p: unknown) => {
    const shaped =
      obj(p) &&
      textValue(p.id, 100) &&
      !!p.id &&
      !ids.has(p.id) &&
      (['school', 'program', 'location', 'degree', 'currency', 'period'] as const).every((k) =>
        textValue(p[k], 200),
      ) &&
      !!(p.school as string).trim() &&
      !!(p.program as string).trim() &&
      isoDay(p.deadline) &&
      textValue(p.url, 2000) &&
      (!p.url || safeUrl(p.url as string)) &&
      textValue(p.requirements, 10_000) &&
      textValue(p.notes, 10_000) &&
      (['tuition', 'living', 'other', 'aid'] as const).every((k) => finite(p[k], 0, PATHWAY_LIMITS.money)) &&
      APPLICATION_STAGES.includes(p.status as Program['status']) &&
      Array.isArray(p.materials) &&
      p.materials.length <= PATHWAY_LIMITS.materials;
    if (!shaped) throw new Error('Check the program’s name, costs, dates and source link.');

    const pp = p as unknown as Program;
    ids.add(pp.id);

    const mids = new Set<string>();
    const materials = pp.materials.map((m: unknown) => {
      const good =
        obj(m) &&
        textValue(m.id, 100) &&
        !!m.id &&
        !mids.has(m.id) &&
        textValue(m.title, 250) &&
        !!(m.title as string).trim() &&
        MATERIAL_STATES.includes(m.status as ProgramMaterial['status']) &&
        isoDay(m.due);
      if (!good) throw new Error('Invalid application material.');
      const mm = m as unknown as ProgramMaterial;
      mids.add(mm.id);
      return { id: mm.id, title: mm.title, status: mm.status, due: mm.due };
    });

    return { ...pp, materials };
  });
}

/** A pathway library out of storage or a file, or an error. */
export function readPathway(v: unknown): PathwayLibrary {
  const top =
    obj(v) &&
    v.version === 1 &&
    LIFE_STAGES.includes(v.stage as PathwayLibrary['stage']) &&
    obj(v.profile) &&
    (['name', 'education', 'experience', 'goals'] as const).every((k) =>
      textValue((v.profile as Record<string, unknown>)[k], 10_000),
    ) &&
    Array.isArray(v.projects) &&
    v.projects.length <= PATHWAY_LIMITS.projects;
  if (!top) throw new Error('Invalid pathway backup.');
  const lib = v as unknown as PathwayLibrary;

  const ids = new Set<string>();
  const projects = lib.projects.map((p: unknown) => {
    const shaped =
      obj(p) &&
      textValue(p.id, 100) &&
      !!p.id &&
      !ids.has(p.id) &&
      textValue(p.title, 200) &&
      !!(p.title as string).trim() &&
      textValue(p.kind, 100) &&
      textValue(p.notes, 20_000) &&
      Array.isArray(p.steps) &&
      p.steps.length <= PATHWAY_LIMITS.steps &&
      Array.isArray(p.history) &&
      p.history.length <= PATHWAY_LIMITS.history;
    if (!shaped) throw new Error('Check the milestone project.');
    const pp = p as unknown as PathwayProject;
    ids.add(pp.id);

    const sids = new Set<string>();
    const steps = pp.steps.map((s: unknown) => {
      const good =
        obj(s) &&
        textValue(s.id, 100) &&
        !!s.id &&
        !sids.has(s.id) &&
        textValue(s.title, 300) &&
        !!(s.title as string).trim() &&
        textValue(s.owner, 200) &&
        isoDay(s.due) &&
        typeof s.done === 'boolean' &&
        textValue(s.notes, 5000);
      if (!good) throw new Error('Check milestone dates and details.');
      const ss = s as unknown as Milestone;
      sids.add(ss.id);
      return { id: ss.id, title: ss.title, owner: ss.owner, due: ss.due, done: ss.done, notes: ss.notes };
    });

    const history = pp.history.map((h: unknown) => {
      if (!obj(h) || !finite(h.at, 0, 1e15) || !textValue(h.message, 500)) {
        throw new Error('Invalid milestone history.');
      }
      const hh = h as unknown as PathwayProject['history'][number];
      return { at: hh.at, message: hh.message };
    });

    return { id: pp.id, title: pp.title, kind: pp.kind, notes: pp.notes, steps, history };
  });

  return {
    version: 1,
    stage: lib.stage,
    profile: {
      name: lib.profile.name,
      education: lib.profile.education,
      experience: lib.profile.experience,
      goals: lib.profile.goals,
    },
    programs: readPrograms(lib.programs),
    projects,
  };
}

/** Tuition plus living plus other, less aid. Every figure is the student's estimate. */
export const netProgramCost = (p: Program) => p.tuition + p.living + p.other - p.aid;

/** What is still missing before a programme could be applied to. */
export const programReadiness = (p: Program) => ({
  missing: p.materials.filter((m) => !['Ready locally', 'Reported received'].includes(m.status)).length,
  hasRequirements: !!p.requirements.trim(),
  hasDeadline: !!p.deadline,
});
