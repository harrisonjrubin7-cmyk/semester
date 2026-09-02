export type CourseId = 'econ' | 'psci' | 'core' | 'bus';

export interface GradeRow {
  what: string;
  pct: string;
}

export interface Course {
  id: CourseId;
  code: string;
  name: string;
  prof: string;
  email: string;
  /** How the syllabus states the meeting pattern. */
  meets: string;
  room: string;
  credits: string;
  /** The PDF this course was imported from. */
  source: string;
  grading: GradeRow[];
}

/** A dated obligation lifted from a syllabus. */
export interface Item {
  id: string;
  c: CourseId;
  title: string;
  kind: string;
  /** Month index, 0-based, in {@link SEMESTER_YEAR}. */
  month: number;
  day: number;
  /** Time of day, exactly as the syllabus words it. */
  dueTime: string;
  weight: string;
  where: string;
  detail: string;
  /** Verbatim from the syllabus — shown under "Straight from the syllabus". */
  quote: string;
  source: string;
}

/** An {@link Item} with everything the live date decides folded in. */
export interface DatedItem extends Item {
  date: Date;
  /** "Today", "Tonight", "Tomorrow", "Fri Sep 4" — derived, never stored. */
  dueShort: string;
  dow: string;
  mon: string;
  isToday: boolean;
  isPast: boolean;
  daysAway: number;
}

export interface StudyCard {
  q: string;
  a: string;
}

export interface Unit {
  name: string;
  mastery: number;
  cards: StudyCard[];
}

export interface Term {
  t: string;
  d: string;
}

export interface Frame {
  t: string;
  d: string;
}

/**
 * A "claim → test → verdict" pairing. PSCI's seven debates are the pure form —
 * Trounstine pairs a popular claim with the scholar who tests it — but the same
 * shape fits any reading that argues against a received story.
 */
export interface CaseFile {
  title: string;
  when: string;
  claim: string;
  test: string;
  verdict: string;
  lesson: string;
}

export interface Guide {
  code: string;
  name: string;
  blurb: string;
  source: string;
  mastery: number;
  audio: boolean;
  units: Unit[];
  frames?: Frame[];
  terms: Term[];
  /** The guide's own self-quiz — questions written to be answered out loud. */
  selfTest?: StudyCard[];
  cases?: CaseFile[];
}

export interface BarRow {
  l: string;
  v: number;
}

export interface Step {
  n: string;
  t: string;
  d: string;
}

/**
 * Diagrams that have to be drawn rather than tabulated — the curve pictures the
 * guides reproduce. Each name maps to a hand-drawn SVG in `components/Diagram`.
 */
export type DiagramKind =
  | 'supply-demand'
  | 'price-ceiling'
  | 'cost-curves'
  | 'monopoly'
  | 'externality'
  | 'elasticity-along-demand'
  | 'normal-curve'
  | 'skew'
  | 'validity-reliability'
  | 'causal-diagrams'
  | 'scatter-chocolate'
  | 'perceptual-map'
  | 'funnel'
  | 'brand-pyramid'
  | 'channel-levels'
  | 'product-life-cycle'
  | 'three-v';

export type Figure =
  | { type: 'bars'; title: string; caption: string; unit: string; max: number; rows: BarRow[] }
  | { type: 'steps'; title: string; caption: string; steps: Step[] }
  | { type: 'diagram'; title: string; caption: string; kind: DiagramKind };

/** Figures are keyed by the index of the unit they illustrate. */
export type FigureMap = Partial<Record<number, Figure>>;

export interface Example {
  tag: string;
  t: string;
  d: string;
}

export interface Chapter {
  t: string;
  /** Seek position, in seconds. */
  s: number;
  name: string;
}

export interface Podcast {
  file: string;
  len: string;
  ready: boolean;
  blurb: string;
  chapters: Chapter[];
}

export type EventKind = 'Athletics' | 'Clubs' | 'University';

export interface CampusEvent {
  id: string;
  kind: EventKind;
  sport?: string;
  title: string;
  where: string;
  month: number;
  day: number;
  time: string;
  tag: string;
  detail: string;
  ticket: string;
}

export interface DatedEvent extends CampusEvent {
  date: Date;
  mon: string;
  dow: string;
  isPast: boolean;
}

/** One entry on the day's rail — a class, or something you added. */
export interface Block {
  time: string;
  /** Minutes past midnight, for ordering and for the next-class countdown. */
  at: number;
  title: string;
  meta: string;
  c: CourseId | null;
  canceled?: boolean;
  /** Not a class — office hours, a group call. Rendered dimmer. */
  optional?: boolean;
}

export interface AppNotification {
  id: string;
  code: string;
  when: string;
  title: string;
  body: string;
}

export type Screen =
  | 'onboarding'
  | 'home'
  | 'courses'
  | 'course'
  | 'item'
  | 'calendar'
  | 'event'
  | 'me'
  | 'search'
  | 'notifs'
  | 'settings'
  | 'import'
  | 'importing'
  | 'review'
  | 'study'
  | 'guide'
  | 'quiz'
  | 'drill';

export type StudyMode = 'cards' | 'read' | 'quiz' | 'figures' | 'cases' | 'cram' | 'listen';

export type NavMode = 'tabs' | 'feed';
