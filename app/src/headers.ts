import type { State } from './state/shape';
import type { Catalog } from './data/catalog';
import type { School } from './lib/school';
import type { Screen } from './lib/types';
import { MONTHS } from './lib/date';
import { homeTitle } from './lib/look';
import { datedEvents, datedItems, nextExam } from './lib/select';
import { destination } from './lib/nav';
import { settingsTitle } from './lib/settings';
import { provider } from './lib/assistant';
import { isoToDate } from './lib/date';

/** The two lines the header draws: the small one over the big one. */
export type Head = { kicker: string; title: string };

/**
 * What a header line is allowed to read.
 *
 * Everything here is computed once per render by `useHeader` below and handed
 * to exactly one entry in the table — the one for the screen you are on. It
 * is a parameter rather than a closure because that is what turns eighty-two
 * cases into eighty-two values: a `case` arm can see whatever happens to be
 * in scope around it, and a function in a table can see only what it is
 * given, which is what makes the table movable at all.
 */
export interface HeaderCtx {
  /** The screen being named. Always `state.screen`; carried for the two
   *  entries that look their own name up rather than writing it out. */
  screen: Screen;
  state: State;
  catalog: Catalog;
  school: School;
  now: Date;
  /**
   * The open guide's course code, or `''`.
   *
   * Not `guide.code`. Opening a study screen by its own URL — which is the
   * point of having URLs — arrives with no course chosen, and the four study
   * kickers below then read a field off `undefined` and take the whole app
   * down before the screen renders. The screens themselves already survive
   * this: `useLive` falls back to an empty guide. The header did not.
   */
  code: string;
  /** `CODE · what`, or just `what` where no course is open — a kicker of
   *  " · study guide" is a bug on show, so the empty half is dropped. */
  about: (what: string) => string;
  /** The next exam across the term's courses, if there is one. */
  exam: ReturnType<typeof nextExam>;
  /** `Mon · Sep 15`. */
  today: string;
  /** `4 courses`. */
  courseCount: string;
  /** `4 courses · 11 credits`, or just the count where no credits are known. */
  load: string;
}

/**
 * The title for a screen the table names by registry rather than by hand.
 *
 * It used to be `{ kicker: today, title: 'Today' }` — flatly, for anything
 * unnamed above — and four screens were quietly wearing it: **Everything**,
 * **How this works**, **Your data** and **Privacy**. Each said "Today", with
 * today's date over it, above content that was plainly not today. A screen
 * that lies about which screen it is is worse than one with no title, and
 * nothing failed, because a default that always returns something can never
 * be missing a case.
 *
 * So the fallback asks the registry, which already holds a label and a
 * sentence for every screen and is what the directory, the shelves and search
 * all read. A screen added to `DESTINATIONS` is now named in the header for
 * free, and `header.test.ts` fails if one ever is not.
 *
 * `Today` remains the answer for anything genuinely unlisted — the two shell
 * screens and onboarding — which is the honest last resort rather than the
 * first one.
 */
export function fallbackHeader(screen: Screen, today: string): Head {
  const known = destination(screen);
  if (!known) return { kicker: today, title: 'Today' };
  return { kicker: 'In the app', title: known.short ?? known.label };
}

/** The six screens that take their name from `DESTINATIONS`, or wear the last
 *  resort. Shared, so the six are provably one rule and not six copies. */
const fromRegistry = (c: HeaderCtx): Head => fallbackHeader(c.screen, c.today);

/*
 * The settings pages, named from the one list that names them.
 *
 * This was eight `case`s with the titles written out again, and they had
 * already drifted: the bar said "Appearance" and "Navigation" over pages
 * that call themselves "Colour and type" and "Layout and navigation",
 * because renaming a page meant editing `lib/settings.ts`, the page
 * itself, and this — and two out of three is what actually happens.
 * `settingsTitle` reads the registry, so there is one name and a rename
 * is one edit.
 *
 * The assistant's page was the one of the eight the old arm never listed, so
 * it fell past the switch to `fallbackHeader` — and it is not in
 * `DESTINATIONS` either, being a settings page rather than a destination, so
 * it wore the last resort: "Today", with today's date over it, above the API
 * key and the model picker. That is the failure this table makes
 * unrepresentable: `Record<Screen, …>` has no way to be missing a key.
 */
const settingsPage = (c: HeaderCtx): Head => ({ kicker: 'Settings', title: settingsTitle(c.screen) });

/**
 * Every screen's header line, in one place.
 *
 * This was a switch of eighty-two arms in the middle of `App.tsx`, and it
 * ended in a `default`. A default that always returns something can never be
 * *missing* a case, so a screen added to the union and not to the switch got
 * "Today" and the date over content that was plainly not today — silently,
 * forever, because nothing about it is an error. Four screens shipped that
 * way and a fifth, the assistant's settings page, shipped it again after the
 * first four were fixed.
 *
 * `Record<Screen, …>` is the same list with the hole closed: there is no
 * default to fall into, so a screen added to `Screen` and not to this table
 * fails to compile. Where a screen genuinely wants the registry's name it
 * says so by pointing at `fromRegistry`, which is a decision written down
 * rather than a gap nobody noticed.
 *
 * Kept in the order the switch had, which is roughly the order the app grew
 * in — the term's own screens, then study, then the tools. See
 * `ENGINEERING-AUDIT.md` §4.
 */
export const HEADERS: Record<Screen, (c: HeaderCtx) => Head> = {
  home: (c) => ({ kicker: c.today, title: homeTitle(c.state.nav) }),
  courses: (c) => ({ kicker: c.load, title: 'Courses' }),
  course: (c) => {
    // Optional, for the same reason `code` above is. A course id can outlive
    // the course: a link somebody shared, a bookmark to a course since
    // deleted, an id from an archived term. Every one of those rendered a
    // blank white screen, because the header threw before the screen it sits
    // above ever ran — and a header that can take the app down is a header
    // that must not assume anything is loaded.
    const open = c.catalog.byId[c.state.courseId];
    return { kicker: 'Course', title: open?.code ?? 'Not found' };
  },
  item: (c) => {
    const item = datedItems(c.catalog, c.now).find((i) => i.id === c.state.itemId);
    return { kicker: item ? (c.catalog.byId[item.c]?.code ?? 'Item') : 'Item', title: item?.kind ?? 'Item' };
  },
  study: (c) => ({
    kicker: c.exam ? `${c.exam.days} days to ${c.exam.code}` : c.courseCount,
    title: 'Study',
  }),
  guide: (c) => ({ kicker: c.about('study guide'), title: 'Guide' }),
  drill: (c) => ({ kicker: c.code, title: 'Drill' }),
  guess: (c) => ({ kicker: c.about('before you read'), title: 'Guess first' }),
  quiz: (c) => ({ kicker: c.about('multiple choice'), title: 'Quiz' }),
  calendar: (c) => {
    const source =
      c.state.calSource === 'all'
        ? 'Everything'
        : c.state.calSource === 'classes'
          ? 'Classes only'
          : c.state.calSource === 'deadlines'
            ? 'Deadlines only'
            : 'Campus only';
    if (c.state.calView === 'semester') return { kicker: source, title: 'Semester' };
    if (c.state.calView === 'day') return { kicker: source, title: 'Day' };
    // The month of `calDay`, not a `calMonth` of its own. The header used to
    // read a second field, so it could name a different month from the grid
    // under it once the two drifted apart. See `calDay` in `state/shape.ts`.
    const on = c.state.calDay ? isoToDate(c.state.calDay) : c.now;
    return { kicker: `${source} · ${MONTHS[on.getMonth()]}`, title: 'Calendar' };
  },
  event: (c) => {
    const event = datedEvents(c.now, c.state.schoolId, c.state.sample).find((e) => e.id === c.state.eventId);
    return {
      kicker: event?.kind ?? 'Event',
      title: event ? `${event.mon} ${event.day}` : 'Event',
    };
  },
  me: (c) => ({ kicker: c.load, title: 'Progress' }),
  /*
   * The one screen whose kicker is not about the semester.
   *
   * `load` — "4 courses · 11 credits" — is right above every screen that is
   * about the term and wrong above this one, which is about the person
   * holding it. The school is the context that belongs here, and where
   * nobody has said which school it falls back to the app's own name rather
   * than to an empty kicker, which draws as a gap where a line should be.
   */
  profile: (c) => ({ kicker: c.school.name || 'Semester', title: 'Profile' }),
  notifs: () => ({ kicker: 'Today', title: 'Alerts' }),
  settings: () => ({ kicker: 'Preferences', title: 'Settings' }),
  setLook: settingsPage,
  setNav: settingsPage,
  setAlerts: settingsPage,
  setCourses: settingsPage,
  setGrading: settingsPage,
  setWorkload: settingsPage,
  setAbout: settingsPage,
  setAssistant: settingsPage,
  mine: () => ({ kicker: 'Yours, not the syllabus', title: 'Personal' }),
  note: () => ({ kicker: 'Note', title: 'Editing' }),
  lesson: (c) => ({ kicker: c.about('lesson'), title: 'Watch' }),
  update: (c) => ({ kicker: c.about('into every study mode'), title: 'Add a reading' }),
  connect: () => ({ kicker: 'Accounts and calendars', title: 'Connect' }),
  links: () => ({ kicker: 'Everywhere you go', title: 'Links' }),
  /*
   * Named rather than left to the registry, which is not a default so much as
   * a wrong answer given confidently: the full chat sat under a header
   * announcing a screen the reader was not on. The kicker names what is
   * answering rather than repeating the title, which is the one thing about
   * this screen worth saying before you have asked anything.
   */
  ask: () => ({ kicker: `${provider()} · this term`, title: 'Ask Claude' }),
  work: (c) => ({ kicker: c.about('assignments'), title: 'Work on it' }),
  maps: () => ({ kicker: 'Campus, city, and how to get there', title: 'Getting there' }),
  mail: () => ({ kicker: 'Read here, sent by you', title: 'Email' }),
  export: () => ({ kicker: 'Formats other software reads', title: 'Take it with you' }),
  yes: () => ({ kicker: 'Registration, and the road back', title: 'YES' }),
  draw: (c) => ({ kicker: c.about('as a picture'), title: 'Draw it' }),
  solve: (c) => ({ kicker: c.about('step by step'), title: 'Work the problem' }),
  edit: () => ({ kicker: 'A syllabus is a first draft', title: 'Edit the course' }),
  analyse: () => ({ kicker: 'Computed here, not guessed', title: 'Analyse data' }),
  classmates: () => ({ kicker: 'Confirmed Vanderbilt addresses', title: 'Classmates' }),
  activities: () => ({ kicker: 'Everything that is not a class', title: 'Activities' }),
  clocks: () => ({ kicker: 'Counting, and ringing', title: 'Timers and alarms' }),
  proof: () => ({ kicker: 'Rules, not a judgement', title: 'Check the writing' }),
  applying: () => ({ kicker: 'The other deadline set', title: 'Applications' }),
  behind: () => ({ kicker: 'Counted, not felt', title: 'When you are behind' }),
  degree: () => ({ kicker: 'Four years, not four months', title: 'The degree' }),
  meet: () => ({ kicker: 'Words in common, not ideas', title: 'Where courses meet' }),
  people: () => ({ kicker: 'Started late, invisibly', title: 'People and letters' }),
  brief: () => ({ kicker: 'Counted, then read', title: 'Reports' }),
  essay: () => ({ kicker: 'Everything but coursework', title: 'Draft it' }),
  deck: () => ({ kicker: 'A real PowerPoint file', title: 'Make a deck' }),
  write: () => ({ kicker: 'A real Word file', title: 'Write a document' }),
  sheet: () => ({ kicker: 'Added up here, not guessed', title: 'Sheet or table' }),
  equations: () => ({ kicker: 'Written, worked out, drawn', title: 'Equations' }),
  exam: () => ({ kicker: 'Sat against a clock, marked', title: 'Practice paper' }),
  announce: () => ({ kicker: 'What moved, and what said so', title: 'A change to a date' }),
  costs: () => ({ kicker: 'The bill, the aid, and what you paid', title: 'Money' }),
  gap: () => ({ kicker: 'One thumb, and the walk taken off', title: 'Between classes' }),
  groupwork: () => ({ kicker: 'Who has what, and by when', title: 'Group work' }),
  call: () => ({ kicker: 'A code, a link, and who is in it', title: 'Video call' }),
  meals: () => ({ kicker: 'Swipes, cash, and the week they run out', title: 'Meal plan' }),
  housing: () => ({ kicker: 'The room, and the day you are out of it', title: 'Housing' }),
  runway: () => ({ kicker: 'Counted backwards from the exam', title: 'Exam runway' }),
  registrar: () => ({ kicker: 'The dates the university sets', title: 'Term deadlines' }),
  /*
   * Its own entry rather than `fromRegistry`, which would print the tab bar's
   * nine-character `short` — "Uni" — as the page's heading. The kicker is the
   * screen's whole argument in six words.
   */
  university: () => ({ kicker: 'What it does, and what it cannot', title: 'University' }),
  /*
   * The four that outlast the term get their own entries for the reason
   * University does: the registry would print the tab bar's nine-character
   * `short`, so Athletics would be headed "Sport".
   */
  athletics: () => ({ kicker: 'The season, against the term', title: 'Athletics' }),
  nil: () => ({ kicker: 'Yours, on this device', title: 'NIL deals' }),
  career: () => ({ kicker: 'What is open, and what you have done', title: 'Career' }),
  family: () => ({ kicker: 'What somebody else would see', title: 'Family' }),
  pathway: () => ({ kicker: 'The part that outlasts this term', title: 'Pathway' }),
  create: () => ({ kicker: 'Whatever it is you have to hand in', title: 'Create' }),
  sources: () => ({ kicker: 'Yours, never invented', title: 'Sources' }),
  account: () => ({ kicker: 'Your semester, everywhere', title: 'Account' }),
  slides: (c) => ({ kicker: c.about('deck'), title: 'Slides' }),
  import: () => ({ kicker: 'Syllabus in, course out', title: 'New course' }),
  // The six with no line of their own: four that the registry names —
  // Everything, How this works, Your data, Privacy — and the two shell
  // screens, which are the workspace looking at itself and are deliberately
  // not destinations. Onboarding is the seventh: it draws no header at all.
  data: fromRegistry,
  help: fromRegistry,
  privacy: fromRegistry,
  directory: fromRegistry,
  search: fromRegistry,
  onboarding: fromRegistry,
  // School administration console
  schoolAdmin: () => ({ kicker: 'School settings', title: 'AI Assistant Configuration' }),
};

/**
 * The line above the screen you are on.
 *
 * `HEADERS` is exhaustive over `Screen`, so the lookup cannot miss for a
 * screen that exists — but `state.screen` is not always one. `fromHash`
 * deliberately passes an unknown name through (see "the rename table is not a
 * licence to guess" in its own test), so a stale bookmark to `#/cloud`, a
 * screen `/simplify` deleted, arrives as `{ screen: 'cloud' }` and reaches
 * this table as a key it has never had.
 *
 * The switch this replaced absorbed that in its `default`. A bare
 * `HEADERS[screen](c)` does not: it throws `is not a function`, from a hook
 * that runs above the router and therefore outside `ScreenTrouble`, so the
 * whole app renders as a blank white page. Measured, on the built bundle —
 * `TypeError: su[e.screen] is not a function`, empty body, title "Semester".
 *
 * So the miss is handled, and only the miss. This is not the old default
 * coming back: a screen *in* the union that is missing from the table is
 * still a build error, because `Record<Screen, …>` has no room for one. What
 * `??` catches is a string that was never in the union at all, and the honest
 * answer for that is the same one the app has always given — today.
 */
export function headOf(c: HeaderCtx): Head {
  return (HEADERS[c.screen] ?? fromRegistry)(c);
}
