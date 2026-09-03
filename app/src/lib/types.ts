/**
 * A course's short slug — 'econ', 'psci', and so on.
 *
 * Deliberately a plain string rather than a union of the four courses that
 * happen to exist today. Adding a course should mean adding a folder under
 * `data/courses/` and one line in the catalog, never widening a type that a
 * dozen files depend on.
 */
export type CourseId = string;

/** A short code for the filter chips — "ECON", "PSCI". */
export type CourseShort = string;

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
  /**
   * This course's shell in the LMS — the Brightspace page for it. D2L exposes
   * no API a student can use alone, so the app links rather than reads.
   */
  lms?: string;
  /**
   * What the syllabus says about AI, as the student recorded it.
   *
   * Absent means nothing has been recorded, which the drafting tool treats as
   * a no — an unread policy is not a permissive one. Set from Edit the course.
   */
  ai?: CoursePolicy;
  grading: GradeRow[];
}

export interface CoursePolicy {
  stance: 'banned' | 'limited' | 'allowed' | 'unstated';
  /** In the syllabus's own words where possible, so it can be checked later. */
  note: string;
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
  | { type: 'diagram'; title: string; caption: string; kind: DiagramKind }
  /** A picture you added — a slide, a photo of the board. Held in IndexedDB. */
  | { type: 'image'; title: string; caption: string; fileId: string };

/** Figures are keyed by the index of the unit they illustrate. */
export type FigureMap = Partial<Record<number, Figure>>;

export interface Example {
  tag: string;
  t: string;
  d: string;
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

// ── Your own things ───────────────────────────────────────────────────────
// Everything above comes out of a syllabus. Everything below you added
// yourself, and the app keeps the two visibly apart.

/** A task you added — not something a syllabus asked for. */
export interface PersonalTask {
  id: string;
  title: string;
  /** ISO date, YYYY-MM-DD. Undated tasks sit in "someday". */
  date: string | null;
  /** Free text — "6:30 PM", "before work". Never parsed. */
  time: string;
  note: string;
  done: boolean;
  created: number;
  /** Filed against a course, or null when it is nothing to do with school. */
  courseId: CourseId | null;
}

/** Something with a time and a place, on the day's rail alongside classes. */
export interface Appointment {
  id: string;
  title: string;
  /**
   * What it is for — study, work, social, family, health, admin, other.
   *
   * Optional because appointments added before this existed have none, and a
   * missing kind reads as "other" rather than breaking. See `lib/kinds.ts`.
   */
  kind?: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Minutes past midnight, so it sorts into the rail with classes. */
  at: number;
  /** How the time is written — "6:30p". */
  time: string;
  where: string;
  note: string;
  created: number;
}

/** A note you wrote. */
export interface Note {
  id: string;
  title: string;
  body: string;
  created: number;
  updated: number;
  courseId: CourseId | null;
  /** Ids of files attached to this note, held in IndexedDB. */
  fileIds: string[];
}

/**
 * Material you added to a course after it was imported — a reading posted in
 * week 6, a slide deck, a page of notes from a review session.
 *
 * Stored separately from the course module rather than merged into it. The
 * module is what the pipeline produced from the syllabus and stays that way;
 * this is what has happened since. Every study surface reads the two merged
 * together (see `lib/live.ts`), so adding material updates Cards, Read, Quiz,
 * Cram, Figures and Watch at once, and the two stay tellable apart on screen.
 */
export interface CourseUpdate {
  id: string;
  courseId: CourseId;
  /** Unit index this extends, or null when it is a unit of its own. */
  unit: number | null;
  title: string;
  /** Where it came from, in your words — "Reading 7", "Oct 8 lecture". */
  source: string;
  /** Prose that did not parse into cards. Shown in Read and Cram. */
  body: string;
  cards: StudyCard[];
  terms: Term[];
  /** Files in IndexedDB. Images among them become figures. */
  fileIds: string[];
  created: number;
}

/**
 * A campus system the app links out to rather than reads — myVU, YES,
 * AnchorLink. No API, no sign-in here: a shortcut, kept editable because the
 * addresses are the university's to change, not ours.
 */
export interface CampusLink {
  id: string;
  name: string;
  /** Empty when the app does not presume to know it. */
  url: string;
  /** Shown as the input's placeholder — a suggestion, not a claim. */
  hint: string;
  note: string;
  /** Which heading it sits under. Links you add yourself go under "Yours". */
  group?: 'Campus' | 'Books' | 'Tickets' | 'Social' | 'Yours';
}

/** An external calendar the app reads — Brightspace, Outlook, anything .ics. */
export interface FeedSource {
  id: string;
  /** 'brightspace' | 'microsoft' | 'ics' — decides the label and the icon. */
  kind: 'brightspace' | 'microsoft' | 'ics';
  name: string;
  /** Subscribed URL, or '' for a file that was imported once. */
  url: string;
  added: number;
  /** When it last pulled, as an epoch milliseconds stamp. 0 = never. */
  synced: number;
  /** What the last pull said, good or bad. */
  status: string;
  count: number;
}

/** One dated thing out of a feed. Deliberately shaped like an Appointment. */
export interface FeedEvent {
  id: string;
  sourceId: string;
  title: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Minutes past midnight, or null for an all-day entry. */
  at: number | null;
  time: string;
  where: string;
  note: string;
  /** The course it looks like it belongs to, matched on the course code. */
  courseId: CourseId | null;
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
  | 'study'
  | 'guide'
  | 'quiz'
  | 'drill'
  | 'lesson'
  | 'mine'
  | 'note'
  | 'update'
  | 'connect'
  | 'ask'
  | 'work'
  | 'grades'
  | 'maps'
  | 'mail'
  | 'export'
  | 'yes'
  | 'draw'
  | 'solve'
  | 'edit'
  | 'analyse'
  | 'classmates'
  | 'activities'
  | 'brief'
  | 'essay'
  | 'deck'
  | 'exam'
  | 'check'
  | 'ahead'
  | 'slides'
  | 'account'
  | 'cloud';

export type StudyMode =
  | 'cards'
  | 'read'
  | 'field'
  | 'watch'
  | 'slides'
  | 'doc'
  | 'quiz'
  | 'figures'
  | 'cases'
  | 'cram'
  | 'listen';

/** One beat of a narrated lesson: what is on screen from `at` seconds. */
export interface LessonCue {
  /** Seconds into the narration. */
  at: number;
  /** 'title' opens the unit, 'q' poses a card, 'a' answers it, 'close' ends. */
  kind: 'title' | 'q' | 'a' | 'point' | 'close';
  text: string;
}

/** A narrated lesson for one unit of a guide. */
export interface Lesson {
  /** Index of the unit this teaches. */
  unit: number;
  title: string;
  file: string;
  seconds: number;
  len: string;
  cues: LessonCue[];
}

export type NavMode = 'tabs' | 'feed';

/** A class that repeats every week, from the syllabus meeting pattern. */
export interface RecurringBlock {
  /** Days of the week this repeats on, 0 = Sunday. */
  days: number[];
  /** Start time in minutes past midnight. */
  at: number;
  /** How the time is written on screen — "9:05a". */
  time: string;
  title: string;
  meta: string;
  /** Not a class — office hours, a standing group call. Rendered dimmer. */
  optional?: boolean;
}

/** A one-off change to a specific date: a cancellation, a guest speaker. */
export interface ScheduleException {
  month: number;
  day: number;
  /**
   * Which recurring block this applies to, matched on title. Omit to apply to
   * the course's actual classes — never to optional blocks like office hours,
   * which have to be named explicitly so a cancelled lecture does not silently
   * cancel them too.
   */
  title?: string;
  /** Replaces this course's recurring block that day. */
  meta?: string;
  canceled?: boolean;
  /** A line for the next-class card when this course is next up. */
  note?: string;
  /** A block that exists only on this date. */
  extra?: Omit<Block, 'c' | 'canceled'>;
}

export interface Chapter {
  t: string;
  /** Seek position, in seconds. */
  s: number;
  name: string;
}

export interface Episode {
  id: string;
  /** Shown on the edition switcher — "Condensed", "Full", "Podcast". */
  label: string;
  /** Path under /audio, or '' when the episode is not recorded yet. */
  file: string;
  len: string;
  /** Total running time in seconds. */
  seconds: number;
  ready: boolean;
  blurb: string;
  chapters: Chapter[];
}

export interface CoursePodcast {
  blurb: string;
  editions: Episode[];
}

/**
 * Everything the app knows about one course, in one object.
 *
 * This is the unit the pipeline produces. A course lives in its own folder
 * under `data/courses/`, exports one of these as its default, and is picked up
 * by adding a single line to `data/catalog.ts` — no shared file gets edited, so
 * there is no way for one course's data to drift out of step with another's.
 */
export interface CourseModule {
  course: Course;
  /** Dated obligations lifted from the syllabus. */
  items: Item[];
  /** The weekly meeting pattern. */
  schedule: RecurringBlock[];
  /** One-off changes to specific dates. */
  exceptions?: ScheduleException[];
  guide: Guide;
  /** Figures keyed by the index of the unit they illustrate. */
  figures?: FigureMap;
  /** Figures belonging to no single unit — shown only in Figures mode. */
  extraFigures?: Figure[];
  examples?: Example[];
  podcast?: CoursePodcast;
  /** Narrated lessons, one per unit, keyed by unit index. */
  lessons?: Record<number, Lesson>;
  /** Time-box for this course on the Study screen's "tonight" plan. */
  planMinutes: string;
  /** What the Cram screen calls this guide's list of exam frames. */
  frameLabel: string;
}
