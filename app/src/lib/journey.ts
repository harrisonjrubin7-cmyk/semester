import { DESTINATIONS, rootOf } from './nav';
import type { Screen } from './types';

/**
 * The student journey: seven areas, each the answer to one question.
 *
 * The registry already files every screen twice. `group` is its shelf — where
 * it physically sits in the launcher, eight rows of at most eight — and
 * `taskTags` is every intention it serves, which is the index Progress draws
 * under "By task". Neither answers the question the UI constitution
 * (`docs/design/SEMESTER-UI-CONSTITUTION.md`) starts from: *which part of a
 * student's week is this?* A shelf called "Beyond" or "Data" is a filing
 * decision; a student does not think "I am in Data now".
 *
 * This is that third reading, and it is deliberately a map beside the
 * registry rather than a field in it. `lib/nav.ts` is edited by nearly every
 * branch in this repository, and adding a required field to sixty-four rows
 * there would make every one of them conflict. The completeness a required
 * field would have bought is held by `journey.test.ts` instead: a destination
 * with no area, or an area entry for a screen that no longer exists, fails
 * there with the id in the message.
 *
 * ## What it is for, and what it does not do yet
 *
 * It is the vocabulary the screen audit (`scripts/screen-audit.mjs`) and the
 * constitution use, and the one a later pass will draw — the launcher by area
 * rather than by shelf, the bottom bar as one tab per area. Neither of those
 * is done here, because both change what every student sees and need
 * screenshots and a yes first; the constitution lists them under "Decisions
 * awaiting sign-off". What this does do is make the question answerable in
 * code, so that decision is about drawing, not about filing.
 */
export type Area = 'today' | 'plan' | 'learn' | 'help' | 'campus' | 'progress' | 'you';

export interface AreaInfo {
  id: Area;
  /** What a tab or a heading says. One word. */
  label: string;
  /** The question a student is asking when they are here, in their words. */
  question: string;
  /**
   * The one screen that is this area's front door — where a tab for the area
   * would go. Held by the test to be in the area it opens.
   */
  home: Screen;
  /** The one primary action a screen in this area leads with. */
  primary: string;
}

/**
 * In the order a student meets them: now, next, the work, the help, the
 * place, the result — and the account last, because it is where you go to
 * change the app rather than to use it.
 */
export const AREAS: readonly AreaInfo[] = [
  {
    id: 'today',
    label: 'Today',
    question: 'What do I need to do now?',
    home: 'home',
    primary: 'Complete the next action',
  },
  {
    id: 'plan',
    label: 'Plan',
    question: 'What is coming up, and how do I organise it?',
    home: 'calendar',
    primary: 'Add or schedule something',
  },
  {
    id: 'learn',
    label: 'Learn',
    question: 'How do I get this academic work done?',
    home: 'study',
    primary: 'Start a study session',
  },
  {
    id: 'help',
    label: 'Help',
    question: 'Who or what can help me?',
    home: 'support',
    primary: 'Connect to a service',
  },
  {
    id: 'campus',
    label: 'Campus',
    question: 'What is happening, and where do I go?',
    home: 'maps',
    primary: 'Get directions or save an event',
  },
  {
    id: 'progress',
    label: 'Progress',
    question: 'How am I doing?',
    home: 'me',
    primary: 'Review the recommended next step',
  },
  {
    id: 'you',
    label: 'You',
    question: 'What are my settings and preferences?',
    home: 'settings',
    primary: 'Change a setting',
  },
];

/**
 * Every destination in `lib/nav.ts`, and its area.
 *
 * One area each. Where a screen could argue for two, the rule used is the
 * question the student is asking *when they open it*, not what the screen
 * happens to contain: Registration is about next term, so it is Plan, even
 * though it lists courses; "When you are behind" is somebody asking for help,
 * so it is Help, even though it re-plans the week.
 *
 * Learn is the largest by a distance — twenty-two screens — and that is a
 * finding rather than a mistake. It is the "Study Studio" consolidation the
 * constitution calls Phase 3: one front door (`study`) with the specialist
 * tools behind it, instead of twenty-two peers.
 */
export const AREA_OF: Readonly<Partial<Record<Screen, Area>>> = {
  // Today — what needs doing now, and what just changed.
  home: 'today',
  hub: 'today',
  notifs: 'today',

  // Plan — the calendar, next term, and the years after it.
  calendar: 'plan',
  registrar: 'plan',
  announce: 'plan',
  yes: 'plan',
  runway: 'plan',
  pathway: 'plan',
  applying: 'plan',
  launchpad: 'plan',
  career: 'plan',
  opportunities: 'plan',
  costs: 'plan',
  // Your own tasks, appointments and notes: things you are organising.
  mine: 'plan',

  // Learn — courses and the work in them.
  courses: 'learn',
  import: 'learn',
  edit: 'learn',
  sources: 'learn',
  study: 'learn',
  meet: 'learn',
  ask: 'learn',
  update: 'learn',
  analyse: 'learn',
  solve: 'learn',
  exam: 'learn',
  work: 'learn',
  clocks: 'learn',
  groupwork: 'learn',
  draw: 'learn',
  deck: 'learn',
  write: 'learn',
  sheet: 'learn',
  equations: 'learn',
  create: 'learn',
  essay: 'learn',
  proof: 'learn',

  // Help — a person, an office, or the app explaining itself.
  support: 'help',
  behind: 'help',
  people: 'help',
  family: 'help',
  help: 'help',

  // Campus — places, people nearby, and life around the classes.
  maps: 'campus',
  university: 'campus',
  activities: 'campus',
  classmates: 'campus',
  meals: 'campus',
  housing: 'campus',
  links: 'campus',
  mail: 'campus',
  call: 'campus',
  athletics: 'campus',
  nil: 'campus',

  // Progress — where things stand.
  me: 'progress',
  brief: 'progress',
  degree: 'progress',

  // You — the account, the data, and the app's own settings.
  profile: 'you',
  account: 'you',
  settings: 'you',
  connect: 'you',
  data: 'you',
  privacy: 'you',
  export: 'you',
};

/**
 * The area a screen belongs to, including screens that are not destinations.
 *
 * A course, a deadline or a flashcard is not in the registry; it nests under a
 * root that is, and it takes that root's area — the same rule `shelfOf` uses
 * for shelves. The eight settings pages nest under Settings and so answer
 * You. The last fallback is Today, which is also where `rootOf` sends a
 * screen it does not know.
 */
export function areaOf(screen: Screen): Area {
  if (/^set[A-Z]/.test(screen)) return 'you';
  return AREA_OF[screen] ?? UNROOTED[screen] ?? AREA_OF[rootOf(screen)] ?? 'today';
}

/**
 * Screens that are neither destinations nor nested under one, so `rootOf`
 * sends them to Today by default. Two of them are not Today: predictions are
 * study, and saying so here is cheaper than moving them in `lib/nav.ts`, where
 * it would also change which tab lights up.
 */
const UNROOTED: Partial<Record<Screen, Area>> = {
  gap: 'today',
  guess: 'learn',
};

export function areaInfo(area: Area): AreaInfo {
  // AREAS is total over Area, which the test holds; the `!` is that fact.
  return AREAS.find((a) => a.id === area)!;
}

/** The registry's destinations in one area, in registry order. */
export function destinationsInArea(area: Area) {
  return DESTINATIONS.filter((d) => AREA_OF[d.screen] === area);
}
