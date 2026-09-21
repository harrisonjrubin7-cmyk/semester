import type { Repeat } from './repeat';

/**
 * A course's short slug — 'econ', 'psci', and so on.
 *
 * Deliberately a plain string rather than a union of the four courses that
 * happen to exist today. Adding a course should mean adding a folder under
 * `data/courses/` and one line in the catalog, never widening a type that a
 * dozen files depend on.
 */
export type CourseId = string;

/* A `CourseShort = string` stood here for "the filter chips" and nothing
 * declared one. An alias to `string` checks nothing, so it was documentation;
 * `CourseId` above is the alias that is actually used. */

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
  /**
   * Which term this course belongs to — '2026FA'. See `lib/term.ts`.
   *
   * Optional because every course saved before terms existed has none; those
   * fall back to the term the app shipped configured for, which is what their
   * dates actually are.
   */
  term?: string;
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
  /** Month index, 0-based. */
  month: number;
  day: number;
  /**
   * The calendar year this falls in.
   *
   * Stamped on when the catalogue is built, from the course's term — see
   * `lib/term.ts`. Optional because an item saved before terms existed has
   * none, and `decorateItem` falls back to the year the app shipped for.
   */
  year?: number;
  /**
   * Where this was before somebody moved it, when somebody has.
   *
   * The app's whole premise is that a deadline is the syllabus's rather than
   * the app's — every item carries the sentence it came from and the page it
   * was on. A student may still move one: a professor says it in class, an
   * announcement lands, or the syllabus was simply wrong. What must not happen
   * is the app quietly forgetting that it now disagrees with the document it
   * is showing underneath.
   *
   * So a move keeps the old date and says so beside the quote. Optional
   * because every item that has never been moved has none, which is almost all
   * of them, and because a course imported before this existed has none
   * either.
   */
  movedFrom?: { month: number; day: number; year?: number };
  /** Time of day, exactly as the syllabus words it. */
  dueTime: string;
  weight: string;
  where: string;
  detail: string;
  /** Verbatim from the syllabus — shown under "Straight from the syllabus". */
  quote: string;
  /**
   * Whether the quote was found in the file, and on which page.
   *
   * A quote only reaches an item at all if it was confirmed — see
   * `lib/generate.ts` — so `confirmed` is always true where this exists. The
   * page is the part that is new and the part worth showing: it is what turns
   * "the app says the syllabus says this" into something a student can go and
   * check in ten seconds. Absent on every course imported before citations,
   * and on anything built from pasted text rather than a PDF.
   *
   * `doc` is the name of the file that page is in. A page number alone is
   * only an answer where one document went up, and two do often enough — a
   * syllabus and a separately posted schedule — that "p. 4" would otherwise
   * name a page in each. It is what `lib/topage.ts` matches against the drive
   * to decide whether the page can actually be opened.
   */
  checked?: { confirmed: boolean; page?: number; doc?: string };
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
  /**
   * Minutes past midnight, read out of `dueTime` where it holds a clock.
   *
   * `24 * 60` when the wording names no time — "In class" sorts after
   * everything with an hour on it, because it is a thing you have all day to
   * do something about. See `lib/duetime.ts`.
   */
  dueAt: number;
}

export interface StudyCard {
  /**
   * A stable identity that survives the question being reworded.
   *
   * Optional, because a card's identity used to be its question and for a card
   * with no id here it still is — `cardIdentity` in `lib/review` falls back
   * to hashing `q`, which is exactly what every card did before this field
   * existed. So a card written without one is no worse off than it was; it
   * simply keeps the old failure, where an edit to the wording starts the
   * review history over.
   *
   * The four shipped guides carry one on all 324 of their cards. Those ids
   * were minted as the hash `cardKey` already produced for the question, so
   * adding them moved no review row that was already stored.
   */
  id?: string;
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
export const DIAGRAM_KINDS = [
  'supply-demand',
  'price-ceiling',
  'cost-curves',
  'monopoly',
  'externality',
  'elasticity-along-demand',
  'normal-curve',
  'skew',
  'validity-reliability',
  'causal-diagrams',
  'scatter-chocolate',
  'perceptual-map',
  'funnel',
  'brand-pyramid',
  'channel-levels',
  'product-life-cycle',
  'three-v',
  /*
   * And the shapes a quantitative course is taught from.
   *
   * The seventeen above are economics, statistics and marketing, which is what
   * the four shipped courses needed and is not what "the figures you should be
   * able to sketch from memory" means to somebody taking physics or chemistry.
   * §3.1 of the completion plan names the gap and the rule for closing it: add
   * a kind here "where a shape is stable and worth drawing by hand", and let
   * the `drawn` arm carry everything else.
   *
   * Stable is the operative word. These four are drawn the same way in every
   * introductory text — the block with four arrows, the S-curve with its
   * equivalence point, the two circuit topologies side by side, the three
   * regions meeting at a triple point. A shape that varies by course belongs
   * in the generated arm, where it is labelled as written-to-a-description
   * rather than checked by a person.
   */
  'free-body',
  'titration-curve',
  'series-parallel',
  'phase-diagram',
] as const;

/*
 * A list first, then the type from it — rather than a union anything checking
 * a value at runtime has to restate. `lib/figure.ts` has to reject a diagram
 * name a model made up, and a hand-kept copy of these seventeen strings would
 * be wrong the first time an eighteenth diagram is drawn.
 */
export type DiagramKind = (typeof DIAGRAM_KINDS)[number];

/**
 * The two languages a drawn diagram is written in.
 *
 * A list first and the type from it, for the same reason `DIAGRAM_KINDS` is
 * one: `lib/figure.ts` has to reject a language a reply made up, and a
 * hand-kept copy of these two strings would be wrong the first time a third
 * is added. `lib/diagram.ts` takes its `Language` from here rather than
 * declaring its own — the drawing and the figure it is kept as must agree
 * about what they are, and two unions cannot be made to.
 */
export const DRAWING_LANGUAGES = ['mermaid', 'svg'] as const;

export type DrawingLanguage = (typeof DRAWING_LANGUAGES)[number];

export type Figure =
  | { type: 'bars'; title: string; caption: string; unit: string; max: number; rows: BarRow[] }
  | { type: 'steps'; title: string; caption: string; steps: Step[] }
  | { type: 'diagram'; title: string; caption: string; kind: DiagramKind }
  /** A picture you added — a slide, a photo of the board. Held in IndexedDB. */
  | { type: 'image'; title: string; caption: string; fileId: string }
  /**
   * A diagram drawn from a description, rather than chosen from the seventeen.
   *
   * `diagram` above names a picture this app already knows how to draw, which
   * is why it is safe and why it is narrow: a course whose figure is a
   * titration curve or a free-body diagram gets no figure at all, because
   * there is no arm of this union for one. This is that arm. The drawing is
   * kept as the **code it was written as** — Mermaid or SVG — and not as
   * rendered markup, for two reasons that both matter more than the saving.
   *
   * The code is editable, which is the property the Draw screen is built on:
   * a picture you can retitle and relabel is worth more than one you can only
   * look at, and a wrong label is fixed rather than regenerated.
   *
   * And rendered markup kept in storage is markup nothing sanitises twice.
   * `components/Drawing.tsx` puts every drawing through `cleanSvg` or through
   * Mermaid's strict mode on the way to the screen; storing the output of
   * that would move the one place the guarantee is made from the render to a
   * write that happened once, months ago, under whichever version of the
   * sanitiser was current. Keeping the source means the sanitiser that runs is
   * always today's.
   */
  | { type: 'drawn'; title: string; caption: string; language: DrawingLanguage; code: string };

/** Figures are keyed by the index of the unit they illustrate. */
export type FigureMap = Partial<Record<number, Figure>>;

/**
 * A concept pointed at something you can see.
 *
 * Three shapes, and the first is the one the four shipped courses are made of:
 * thirty-two short applied scenarios, a tag and a title and a paragraph.
 * `lib/casework.ts` has the argument for the other two and for why the
 * discriminator is optional — the short version is that `kind` absent means
 * `applied`, so every example written before the union existed is still a
 * valid one and nothing has to be migrated.
 */
export type Example =
  /** The existing shape: a tag, a title, and a paragraph applying the idea. */
  | { kind?: 'applied'; tag: string; t: string; d: string }
  /**
   * A problem carried through its steps, with the arithmetic shown.
   *
   * What "worked example" means in a quantitative course and what the shape
   * above cannot hold: a statement, the steps in order, and the result. A
   * problem set is read this way and a paragraph about a problem is not.
   */
  | { kind: 'worked'; tag: string; t: string; statement: string; steps: string[]; result: string }
  /**
   * A situation, the question it poses, and what the answer turned on.
   *
   * The shape a case-method course grades on. `CaseFile` below is the
   * neighbouring idea — a claim somebody made and the study that tested it —
   * and is not the same thing: that is about a debate in the literature, this
   * is about a decision somebody had to make.
   */
  | { kind: 'study'; tag: string; t: string; situation: string; question: string; analysis: string; turned: string };

/** The shapes an example can take, for a picker and for a prompt. */
export const EXAMPLE_KINDS = ['applied', 'worked', 'study'] as const;

export type ExampleKind = (typeof EXAMPLE_KINDS)[number];

/** Which shape an example is, reading an absent discriminator as the old one. */
export function exampleKind(e: Example): ExampleKind {
  return e.kind ?? 'applied';
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
/**
 * One piece of a task.
 *
 * `TaskStep` rather than `Step`, which this file already uses for a worked
 * example's line in a study guide — a different thing in a different domain,
 * and the collision is only in the word.
 */
export interface TaskStep {
  id: string;
  text: string;
  done: boolean;
}

export interface PersonalTask {
  id: string;
  title: string;
  /** ISO date, YYYY-MM-DD. Undated tasks sit in "someday". */
  date: string | null;
  /** Free text — "6:30 PM", "before work". Never parsed. */
  time: string;
  note: string;
  /**
   * Whether it is finished.
   *
   * On a repeating task this means the *series* is finished, which happens
   * only when the rule runs out — ticking one off before then moves `date` to
   * the next occurrence and leaves this false. See `tick` in `lib/chores.ts`
   * for why that is the model rather than a list of completed dates.
   */
  done: boolean;
  /**
   * The rule that brings it back — a weekly reading, a Sunday reset, laundry
   * every fortnight. Absent is once. See `lib/repeat.ts`.
   *
   * The same `Repeat` an appointment carries, deliberately: "every weekday
   * until the end of term" is one idea, and a second rule engine for tasks
   * would be the same five cases written twice and diverging on the sixth.
   */
  repeat?: Repeat;
  /**
   * The pieces it breaks into, in order. Absent or empty is a task with none.
   *
   * To Do calls these Steps and Google Tasks calls them subtasks; both stop
   * at one level, and so does this. A step that could itself have steps is an
   * outline, and an outline of work is a document — which this app already
   * has a better editor for than a list row could ever be.
   */
  steps?: TaskStep[];
  created: number;
  /** Filed against a course, or null when it is nothing to do with school. */
  courseId: CourseId | null;
  /**
   * The deadline this task was made in service of, when something made it.
   *
   * Only set by the plan-a-deadline panel — see `components/BreakItUp.tsx` —
   * and only so that panel can tell whether it has already been used. Matching
   * on the title instead was the first attempt and it was wrong the moment
   * tasks became editable: renaming a step made the panel forget it had made
   * one, and offer to make five more.
   *
   * Optional because every task written before this existed has none.
   */
  from?: string;
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
  /**
   * ISO date, YYYY-MM-DD.
   *
   * On a repeating appointment this is the first occurrence. `appointmentsOn`
   * in `lib/select.ts` hands back a copy with `date` set to the day being
   * drawn, so everything downstream reads the occurrence rather than having
   * to know about the rule.
   */
  date: string;
  /**
   * Minutes past midnight, so it sorts into the rail with classes — or `null`
   * when it is an all-day entry.
   *
   * `null` rather than a separate `allDay` flag, because that is already what
   * "no hour" means everywhere else in this app: `FeedEvent.at` is nullable
   * for exactly this, `campusHours` reads `at !== null` to decide whether a
   * thing can be drawn on a grid at all, and a listing whose time is "TBD"
   * takes the same route. A boolean beside a number would be a second way to
   * say one thing, and the two would disagree the first time something wrote
   * one without the other.
   */
  at: number | null;
  /**
   * How many days it covers, counting the first. Absent is one.
   *
   * Only meaningful when `at` is null. A timed entry that ran past midnight
   * would have to be drawn as a block in two different hour columns, and
   * neither Google Calendar nor Outlook does that either — both move anything
   * spanning days up into the all-day banner, which is where this puts it too.
   * So the rule is the one those clients already taught everybody: **a span is
   * an all-day span.**
   */
  days?: number;
  /** How the time is written — "6:30p", or "All day". */
  time: string;
  /**
   * How long it runs, in minutes.
   *
   * Absent on everything added before this existed, and read as an hour where
   * it is — see `LONG_ENOUGH` in `lib/select.ts`. Before this, every
   * appointment was drawn as fifty minutes: a four-hour shift and a coffee
   * were the same block, which is the one thing an hour grid exists to tell
   * apart.
   */
  minutes?: number;
  /**
   * The rule that makes this happen again — a shift, a society, a standing
   * hour with a tutor. Absent is once. See `lib/repeat.ts`.
   */
  repeat?: Repeat;
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
  /**
   * The deadline it is for, where it is for one. See `Doc.itemId` in
   * `lib/document.ts` for why every made thing carries this and why it is
   * optional. Read through `lib/forwork.ts`.
   */
  itemId?: string | null;
  /** Ids of files attached to this note, held in IndexedDB. */
  fileIds: string[];
  /**
   * Kept at the top of the list.
   *
   * The list is ordered by when a note was last touched, which is the right
   * default and is exactly wrong for the one note somebody is living in for a
   * fortnight: every other note they open pushes it down. Keep, OneNote and
   * Apple Notes all answer this the same way, with a pin.
   */
  pinned?: boolean;
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
  /**
   * Figures read out of the material — a table of numbers, a process, or one
   * of the drawn diagrams.
   *
   * Not images: those come from `fileIds` below. These are the app's own
   * figure formats, so a chart that arrives in a reading is displayed the way
   * the guide's own charts are rather than as prose nobody looks at twice.
   * Optional because everything added before this existed has none.
   */
  figures?: Figure[];
  /**
   * The long-form parts of a guide: the cram sheet's exam frames, the
   * out-loud questions at the end of the field guide, and any claim-and-test
   * pairing the material contains.
   *
   * Separate from `cards` because they are read as the guide's own voice
   * rather than drilled — see `lib/study.ts`. Optional for the same reason
   * `figures` is: everything added before they existed has none.
   */
  frames?: Frame[];
  selfTest?: StudyCard[];
  cases?: CaseFile[];
  /**
   * Worked examples — the concept pointed at something you can see.
   *
   * The Cases tab renders these beside the guide's claim-and-test pairings,
   * and it read only the module's, so an example a reading brought was the one
   * study format that still could not receive anything.
   */
  examples?: Example[];
  /** Files in IndexedDB. Images among them become figures. */
  fileIds: string[];
  created: number;
  /**
   * Where this came from, when it came through the import pipeline.
   *
   * `sourceHash` is what makes re-importing the same file produce nothing:
   * `source` is a filename, and a professor re-posting the same deck as
   * "Session 7 (updated).pptx" changes the filename and not a word of the
   * material. Hashing the text is the only comparison that holds.
   *
   * `as` is what the classifier decided, kept so a piece can say why it has
   * the shape it has. All three are absent on anything added by hand, which
   * is most of what is here.
   */
  sourceHash?: string;
  as?: string;
  /** Ids of course items this same import added, so it can be undone whole. */
  addedItems?: string[];
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
  /**
   * Which heading it sits under.
   *
   * The bundled rows name one of the app's own four, or none, which means
   * Campus. A link the student added carries whatever they called its group,
   * or nothing, which means "Yours" — so this is a string rather than the
   * five-name union it used to be. `lib/linkgroups.ts` holds the fold and the
   * order; nothing should compare this field by hand.
   */
  group?: string;
}

/** An external calendar the app reads — Brightspace, Outlook, anything .ics. */
export interface FeedSource {
  id: string;
  /**
   * Decides the label and the icon.
   *
   * `canvas` is the one that is not a calendar: it is an API pull carrying
   * submission state as well as dates, and it is a separate kind so the
   * connected list can say which rows know whether you handed the work in.
   * See `lib/canvas.ts`.
   */
  kind: 'brightspace' | 'microsoft' | 'ics' | 'canvas';
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
  // The two screens the workspace shell is made of. `search` is what a new
  // tab opens on — the wordmark, the one field, the shortcuts — and
  // `directory` is every app the student has, as a list or a grid, with the
  // categories down the side of it. Neither is a destination in the registry:
  // they are the shell looking at itself, the way a browser's new-tab page is
  // not a bookmark. See `lib/desk.ts`.
  | 'search'
  | 'directory'
  | 'data'
  | 'help'
  | 'onboarding'
  | 'home'
  | 'courses'
  | 'course'
  | 'item'
  | 'calendar'
  | 'event'
  | 'me'
  // You: the name, the account, and what the app holds about you. `me` is the
  // progress report and the directory — it was called Me once, and the note in
  // `lib/nav.ts` beside its label says why that name never fitted it.
  | 'profile'
  | 'notifs'
  | 'settings'
  | 'import'
  | 'study'
  | 'guide'
  | 'quiz'
  | 'drill'
  | 'guess'
  | 'gap'
  | 'lesson'
  | 'mine'
  | 'note'
  | 'update'
  | 'connect'
  | 'links'
  | 'ask'
  | 'work'
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
  | 'write'
  | 'sheet'
  | 'equations'
  | 'exam'
  | 'announce'
  | 'costs'
  | 'groupwork'
  | 'meals'
  | 'housing'
  | 'runway'
  | 'privacy'
  | 'registrar'
  | 'sources'
  | 'slides'
  | 'account'
  | 'clocks'
  | 'proof'
  | 'applying'
  | 'behind'
  | 'degree'
  | 'people'
  | 'meet'
  | 'call'
  /*
   * The university itself: thirty-seven service areas, and an honest account
   * of which this app can reach. Nearly none, today — see
   * `screens/University.tsx` and `docs/UNIVERSITY_CONNECTIONS.md`.
   */
  | 'university'
  /*
   * The four workspaces that are not this term.
   *
   * Each holds a body of work that is the student's own and is not academic
   * record — a season's travel, a résumé, a plan for what a parent may see,
   * an application to somewhere else. They keep their data in their own
   * device libraries rather than in `state/shape.ts`, for the reasons in
   * `lib/device-library.ts`, and `pathway` is the one that is not scoped to a
   * term at all because applying to graduate school spans several.
   */
  | 'athletics'
  | 'nil'
  | 'career'
  | 'family'
  | 'pathway'
  /*
   * One door to everything that makes something. Six of its nine tiles open
   * a maker this app already had; the three that are its own — a form, a
   * design, a video — had nowhere to live. See `screens/Create.tsx`.
   */
  | 'create'
  // The settings pages. Real screens rather than a sub-mode of one, so Back,
  // the recent list and a deep link all work the way they do everywhere else.
  | 'setLook'
  | 'setNav'
  | 'setAlerts'
  | 'setCourses'
  | 'setGrading'
  | 'setWorkload'
  | 'setAbout'
  | 'setAssistant';

/**
 * The report's grain, the post a changed date arrived in, and the grain of
 * Courses.
 *
 * Here rather than in `state/shape.ts` because they are not only state: a URL
 * names one. Three screens merged into the report, two into the changes
 * screen and one — the grade table — into Courses, and a link to a retired one
 * has to say *which part* of its survivor it meant: `#/weekly` landing on
 * today's report, or `#/grades` on the course list, is the link not kept.
 */
export type ReportGrain = 'day' | 'week' | 'term';
export type ChangeSource = 'told' | 'feed';
export type CoursesTab = 'courses' | 'due' | 'grades';
/**
 * Today's four tabs, named here rather than written inline in `state/shape.ts`.
 *
 * It was an inline union on the field, which was fine while nothing else had
 * to say one — and then two screens merged into these tabs. `#/ahead` and
 * `#/tonight` are addresses somebody bookmarked, so `RETIRED` in `lib/route.ts`
 * has to be able to name *which tab* each of them meant, the way `#/weekly`
 * names a report grain. A union in two places is the drift this file exists to
 * prevent.
 */
export type HomeTab = 'today' | 'hours' | 'week' | 'done';
/**
 * The two halves of what a term costs.
 *
 * `bill` is the university's statement and the aid against it — large, dated,
 * and somebody else's arithmetic to check. `out` is what you chose to spend:
 * books, access codes, a lab fee. They are one screen because they are one
 * question, and two tabs because confusing a $32,000 charge with a $64.99
 * textbook in one list helps nobody.
 */
export type CostsTab = 'bill' | 'out';

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

/**
 * How the app is entered — and the only thing that decides which navigation
 * is on screen.
 *
 * `tabs` is the bar; `feed` is one scrolling day; `springboard` is a home
 * screen of icons; `shelves` is the two rows of pills, the shelf you are on
 * and the screens on it. Four genuinely different habits rather than four
 * skins — the bar suits somebody who lives in four screens, the springboard
 * somebody who has sixty and would rather see them than remember which
 * shelf they are on, the shelves somebody who wants both at once.
 *
 * ## One navigation, always
 *
 * `shelves` used to arrive a different way: it was drawn by the soft *layout*
 * rather than chosen as a navigation, so picking soft put its two rows of
 * pills on top of the tab bar or the rail that was already there. Two
 * navigations, both live, neither aware of the other — the app looked like
 * two apps running in one window.
 *
 * So the two axes are now genuinely separate and each answers one question.
 * This one answers *how you move*, and exactly one of those below is ever
 * drawn. `Shell` (in `components/shell/useShell.ts`) answers *how a screen is
 * drawn*, and never adds navigation of its own. Every combination of the two
 * is a valid app, which is what makes them settings rather than forks.
 *
 * `workspace` is the one whose chrome is at the *top* of the window — a strip
 * of tabs and a search field — which is why it is the one that trades nothing
 * against the bar or the rail. It was two for a while, beside a browser-shaped
 * port of the same idea; SIMPLIFY-AUDIT.md E4 removed the second. See
 * `lib/chrome.ts`.
 *
 * `guides` is the last of them and the one the app now opens as. It is the
 * only one that treats a *course* as the top level rather than a screen: home
 * is the courses you have, and opening one hands the whole display to its
 * guide, whose eleven ways of studying are the navigation.
 */
export type NavMode =
  | 'tabs'
  | 'feed'
  | 'springboard'
  | 'shelves'
  | 'workspace'
  | 'guides';

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
