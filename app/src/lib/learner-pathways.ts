import type { FeatureState } from '../intelligence/contracts';
import type { CatalogCourse } from './registration';

/**
 * Pathways for students the rest of the app quietly assumes are not there:
 * working and returning adults, parents and caregivers, military-connected
 * students, online students, graduate students, certificate learners, and
 * anybody changing program or school.
 *
 * Templates and filters over what already exists, not eight subsystems — see
 * `docs/NONTRADITIONAL-LEARNER-PATHWAYS.md`. Three rules hold the whole file:
 *
 * 1. **Chosen, never inferred.** A pathway is on because the student ticked it.
 *    Nothing here reads age, enrolment, schedule, location, profile or any
 *    record to decide somebody is a parent or a veteran; this file and its
 *    panel import nothing that could (`learner-pathways.test.ts` checks the
 *    imports). A school's own records are a different thing and live
 *    elsewhere.
 * 2. **Kept on the device, shown to nobody.** The choice is stored under its
 *    own key, outside the synced state, and no staff role can read it. It
 *    changes which checklists and filters are *offered* — never a deadline,
 *    a record or what anybody else sees.
 * 3. **Routes, never decides.** Benefits, aid, credit and immigration are
 *    other people's decisions. Every step names who decides; none says
 *    "submit", "approve" or "eligible", in the voice `PATHWAY_TEMPLATES` in
 *    `pathway.ts` already uses.
 */

const STATES: readonly FeatureState[] = ['off', 'preview', 'sandbox', 'production'];

/** `VITE_PATH_LEARNER_PATHWAYS`. Absent is off, and does not follow the institutional preview. */
export function learnerPathwaysFlag(env: Record<string, unknown>): FeatureState {
  const value = env.VITE_PATH_LEARNER_PATHWAYS;
  return STATES.includes(value as FeatureState) ? (value as FeatureState) : 'off';
}

export const LEARNER_PATHWAYS_FLAG: FeatureState = learnerPathwaysFlag(
  (import.meta as { env?: Record<string, unknown> }).env ?? {},
);

export const learnerPathwaysOn = (flag: FeatureState = LEARNER_PATHWAYS_FLAG): boolean => flag !== 'off';

/**
 * The new checklists. Same voice as `PATHWAY_TEMPLATES`: Review, Confirm,
 * Request, Prepare — and where an office decides, the step says which.
 */
export const LEARNER_TEMPLATES: Record<string, string[]> = {
  'Returning or working student': [
    'Review which courses run in the evening, online or in shorter terms',
    'Confirm how many credits fit alongside your work hours',
    'Prepare a weekly time budget for class and study',
    "Review your employer's tuition-benefit rules with their HR office",
    "Confirm payment and reimbursement deadlines with your school's billing office",
    'Request information on credit for prior learning from the registrar',
  ],
  'Parent or caregiver student': [
    'Review which course materials can be done at any time of day',
    'Confirm each course’s attendance and absence policy',
    'Prepare a backup plan for weeks with heavy care commitments',
    'Review the family and childcare resources your school lists',
    'Arrange a conversation with your advisor about flexible options',
  ],
  'Military-connected student': [
    "Review your school's veterans or military services instructions",
    "Request benefit certification through your school's certifying official",
    'Request an evaluation of military training for academic credit',
    'Prepare a plan in case of deployment or another interruption',
    'Confirm the withdrawal and readmission rules before any interruption',
  ],
  'Online or hybrid student': [
    'Confirm which time zone each course sets its deadlines in',
    'Review how to reach advising, tutoring and the library remotely',
    'Arrange remote office-hour times with each instructor',
    'Review online study-group options',
    'Confirm exam and proctoring arrangements for each course',
  ],
  'Graduate funding and committee': [
    'List funding deadlines: fellowships, assistantships and grants',
    "Confirm your program's committee membership rules",
    'Request agreement from each prospective committee member',
    'Prepare the annual progress report your program asks for',
    'Review assistantship terms and renewal dates with your department',
  ],
  'Certificate or stackable credential': [
    'Review which courses count toward the credential',
    'Confirm with the program office whether it stacks into a degree',
    'Record the skills and evidence each course gives you',
    'Review employer or licensing recognition with the program office',
    'Request official completion verification',
  ],
  'Changing program or school': [
    'List the courses you have completed and planned',
    'Request an official evaluation of what counts in the new program',
    'Prepare advisor questions about requirements that change',
    'Confirm the deadline for the change or transfer application',
    'Review any financial-aid effects with the aid office before deciding',
    'Record the decision the institution issues',
  ],
};

export type When = 'any' | 'morning' | 'afternoon' | 'evening' | 'weekend';
export type Format = 'any' | 'in_person' | 'online' | 'hybrid';

export const WHENS: readonly { id: When; label: string }[] = [
  { id: 'any', label: 'Any time' },
  { id: 'morning', label: 'Mornings (by noon)' },
  { id: 'afternoon', label: 'Afternoons (noon–5 pm)' },
  { id: 'evening', label: 'Evenings (5 pm on)' },
  { id: 'weekend', label: 'Weekends only' },
];

export const FORMATS: readonly { id: Format; label: string }[] = [
  { id: 'any', label: 'Any format' },
  { id: 'in_person', label: 'In person' },
  { id: 'online', label: 'Online' },
  { id: 'hybrid', label: 'Hybrid' },
];

/** The sentence a pathway's suggested filter gets, so the panel never glues labels together. */
export function suggestLine(s: { when?: When; format?: Format } | undefined): string {
  if (!s) return '';
  const when: Partial<Record<When, string>> = {
    morning: 'morning',
    afternoon: 'afternoon',
    evening: 'evening (starting at 5 pm or later)',
    weekend: 'weekend',
  };
  const format: Partial<Record<Format, string>> = { in_person: 'in-person', online: 'online', hybrid: 'hybrid' };
  const words = [s.format && format[s.format], s.when && when[s.when]].filter(Boolean);
  const [first, ...rest] = words;
  if (!first) return '';
  const kind = rest.length ? `${first} ${rest.join(' ')}` : first;
  return `In Registration, Course search can filter to ${kind} sections.`;
}

export type LearnerPathwayId =
  | 'transfer'
  | 'working'
  | 'caregiver'
  | 'military'
  | 'online'
  | 'graduate'
  | 'credential'
  | 'international'
  | 'changing';

export interface LearnerPathway {
  id: LearnerPathwayId;
  /** In the student's own voice — they are describing themselves, not being classified. */
  label: string;
  blurb: string;
  /** Checklists offered, from `PATHWAY_TEMPLATES` or `LEARNER_TEMPLATES`. */
  templates: string[];
  /** Who decides the things this pathway depends on. Named, never looked up or contacted. */
  ask: string[];
  /** A filter the catalog can offer — offered, never applied on its own. */
  suggest?: { when?: When; format?: Format };
}

export const LEARNER_PATHWAYS: readonly LearnerPathway[] = [
  {
    id: 'transfer',
    label: 'I’m bringing credit from another school',
    blurb: 'Which courses count, what the official evaluation says, and who to ask.',
    templates: ['Transfer credit'],
    ask: ['The registrar or transfer office, for the official credit evaluation', 'Your advisor, for how it fits your plan'],
  },
  {
    id: 'working',
    label: 'I work, or I’m coming back to study',
    blurb: 'Evening and online sections, a time budget, employer benefits and credit for what you already know.',
    templates: ['Returning or working student'],
    ask: ["Your employer's HR office, for tuition benefits", 'The registrar, for credit for prior learning'],
    suggest: { when: 'evening' },
  },
  {
    id: 'caregiver',
    label: 'I care for a child or family member',
    blurb: 'Coursework you can do at any hour, absence policies, and the family resources your school offers.',
    templates: ['Parent or caregiver student'],
    ask: ['Your advisor, for flexible options', 'The dean of students office, for family resources where your school has them'],
  },
  {
    id: 'military',
    label: 'I’m a veteran, service member or military family member',
    blurb: 'Benefit certification, credit for military training, and a plan for interruptions.',
    templates: ['Military-connected student'],
    ask: [
      "Your school's certifying official, for education benefits — Semester never calculates them",
      'The registrar, for credit for military training',
    ],
  },
  {
    id: 'online',
    label: 'I study online or hybrid',
    blurb: 'Deadlines in the right time zone, remote office hours and services you can reach from anywhere.',
    templates: ['Online or hybrid student'],
    ask: ['Each instructor, for remote office hours', 'Your school’s online learning office'],
    suggest: { format: 'online' },
  },
  {
    id: 'graduate',
    label: 'I’m a graduate or professional student',
    blurb: 'Research milestones, committee steps and funding deadlines.',
    templates: ['Thesis or dissertation', 'Graduate funding and committee'],
    ask: ['Your advisor and program director', 'The graduate school, for deadlines and deposit rules'],
  },
  {
    id: 'credential',
    label: 'I’m working toward a certificate',
    blurb: 'Which courses count, whether it stacks into a degree, and the skills you can show for it.',
    templates: ['Certificate or stackable credential'],
    ask: ['The program office, for what counts and what stacks'],
  },
  {
    id: 'international',
    label: 'I’m an international student',
    blurb: 'Official arrival steps and the offices that answer immigration, work and tax questions.',
    templates: ['International arrival'],
    ask: [
      "Your school's international student office — Semester gives no immigration, work or tax advice",
    ],
  },
  {
    id: 'changing',
    label: 'I’m changing program or school',
    blurb: 'What carries over, what changes, and the deadlines for the change.',
    templates: ['Changing program or school'],
    ask: ['Your advisor', 'The registrar, for the official evaluation', 'The financial aid office, before you decide'],
  },
];

const IDS = new Set<string>(LEARNER_PATHWAYS.map((p) => p.id));

// ── The choice, on this device ───────────────────────────────────────────────

export const LEARNER_KEY = 'semester.learner-pathways.v1';

/** Only known ids, each once, in the order `LEARNER_PATHWAYS` lists them. */
export function readChosen(raw: unknown): LearnerPathwayId[] {
  if (!Array.isArray(raw)) return [];
  const picked = new Set(raw.filter((x): x is string => typeof x === 'string' && IDS.has(x)));
  return LEARNER_PATHWAYS.map((p) => p.id).filter((id) => picked.has(id));
}

export function loadChosen(key: string): LearnerPathwayId[] {
  try {
    const text = globalThis.localStorage?.getItem(key);
    return text ? readChosen(JSON.parse(text)) : [];
  } catch {
    return [];
  }
}

/** False when the browser would not store it; the choice then lasts this visit only. */
export function saveChosen(key: string, chosen: LearnerPathwayId[]): boolean {
  try {
    const clean = readChosen(chosen);
    if (clean.length) globalThis.localStorage?.setItem(key, JSON.stringify(clean));
    else globalThis.localStorage?.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

// ── Catalog filters ─────────────────────────────────────────────────────────

/**
 * A section's format, read from what the catalog itself says.
 *
 * The catalog has no format field, so this reads the school's location text —
 * "Online", "Remote", "Hybrid" — and treats a section with no meeting times as
 * online. It is a reading of the school's data, not of the student, and the
 * filter says so on screen.
 */
export function sectionFormat(c: Pick<CatalogCourse, 'location' | 'meetings'>): Exclude<Format, 'any'> {
  const where = c.location || '';
  if (/\b(hybrid|blended)\b/i.test(where)) return 'hybrid';
  if (/\b(online|remote|virtual|zoom|asynchronous|distance)\b/i.test(where) || c.meetings.length === 0) return 'online';
  return 'in_person';
}

const NOON = 12 * 60;
const FIVE_PM = 17 * 60;

/** Whether every meeting falls in the window. A section with no set meetings fits any window. */
export function fitsWhen(c: Pick<CatalogCourse, 'meetings'>, when: When): boolean {
  if (when === 'any' || c.meetings.length === 0) return true;
  return c.meetings.every((m) => {
    switch (when) {
      case 'morning':
        return m.end <= NOON;
      case 'afternoon':
        return m.start >= NOON && m.end <= FIVE_PM;
      case 'evening':
        return m.start >= FIVE_PM;
      case 'weekend':
        return m.days.every((d) => d === 0 || d === 6);
    }
  });
}

export function fitsFormat(c: Pick<CatalogCourse, 'location' | 'meetings'>, format: Format): boolean {
  return format === 'any' || sectionFormat(c) === format;
}

export function fitsSection(
  c: Pick<CatalogCourse, 'location' | 'meetings'>,
  filter: { when: When; format: Format },
): boolean {
  return fitsWhen(c, filter.when) && fitsFormat(c, filter.format);
}
