import { Suspense, lazy, useEffect, useLayoutEffect, useRef } from 'react';
import { useStore } from './state/store';
import { currentLook } from './state/shape';
import {
  Bell,
  Check,
  ChevronLeft,
  Person,
  Plus,
  Search as SearchIcon,
} from './components/Icons';
import { Onboarding } from './screens/Onboarding';
import { Said } from './components/Said';
import { Replaced } from './components/Replaced';
import { SampleMark } from './components/SampleMark';
import { usePrefersContrast, usePrefersDark } from './lib/prefers';
import { Today } from './screens/Today';
import { ground, homeTitle, resolveGround, scaleOf, tokensFor, type Look } from './lib/look';

/**
 * Every screen but the first, fetched when it is opened.
 *
 * All forty-six used to be imported statically, which put every one of them
 * — and everything they pull in — into one 1,047 kB chunk that had to arrive
 * before anything painted. Nobody opens forty-six screens. They open Today.
 *
 * The heavy leaves are the ones nobody loads on a normal day: Draw brings
 * cytoscape at 435 kB, the guide brings KaTeX at 259 kB, the importer brings
 * a PDF reader at 431 kB. Those now arrive on the tap that needs them, and
 * the service worker keeps them for next time.
 *
 * Today and Onboarding stay eager: one is the default screen and the other is
 * the first thing a new account sees, so making either wait would move the
 * delay rather than remove it.
 */
const AccountScreen = lazy(() => import('./screens/Account').then((m) => ({ default: m.AccountScreen })));
const Activities = lazy(() => import('./screens/Activities').then((m) => ({ default: m.Activities })));
const Clocks = lazy(() => import('./screens/Clocks').then((m) => ({ default: m.Clocks })));
const Proof = lazy(() => import('./screens/Proof').then((m) => ({ default: m.Proof })));
const Applying = lazy(() => import('./screens/Applying').then((m) => ({ default: m.Applying })));
const Tonight = lazy(() => import('./screens/Tonight').then((m) => ({ default: m.Tonight })));
const Behind = lazy(() => import('./screens/Behind').then((m) => ({ default: m.Behind })));
const Degree = lazy(() => import('./screens/Degree').then((m) => ({ default: m.Degree })));
const People = lazy(() => import('./screens/People').then((m) => ({ default: m.People })));
const AddMaterial = lazy(() => import('./screens/Update').then((m) => ({ default: m.AddMaterial })));
const Ahead = lazy(() => import('./screens/Ahead').then((m) => ({ default: m.Ahead })));
const Analyse = lazy(() => import('./screens/Analyse').then((m) => ({ default: m.Analyse })));
const Announce = lazy(() => import('./screens/Announce').then((m) => ({ default: m.Announce })));
const Ask = lazy(() => import('./screens/Ask').then((m) => ({ default: m.Ask })));
const Brief = lazy(() => import('./screens/Brief').then((m) => ({ default: m.Brief })));
const Calendar = lazy(() => import('./screens/Calendar').then((m) => ({ default: m.Calendar })));
const CheckDates = lazy(() => import('./screens/CheckDates').then((m) => ({ default: m.CheckDates })));
const Classmates = lazy(() => import('./screens/Classmates').then((m) => ({ default: m.Classmates })));
const Cloud = lazy(() => import('./screens/Cloud').then((m) => ({ default: m.Cloud })));
const Connect = lazy(() => import('./screens/Connect').then((m) => ({ default: m.Connect })));
const Links = lazy(() => import('./screens/Links').then((m) => ({ default: m.Links })));
const Costs = lazy(() => import('./screens/Costs').then((m) => ({ default: m.Costs })));
const CourseDetail = lazy(() => import('./screens/Courses').then((m) => ({ default: m.CourseDetail })));
const Courses = lazy(() => import('./screens/Courses').then((m) => ({ default: m.Courses })));
const Deck = lazy(() => import('./screens/Deck').then((m) => ({ default: m.Deck })));
const Draw = lazy(() => import('./screens/Draw').then((m) => ({ default: m.Draw })));
const Drill = lazy(() => import('./screens/Drill').then((m) => ({ default: m.Drill })));
const Guess = lazy(() => import('./screens/Guess').then((m) => ({ default: m.Guess })));
const EditCourse = lazy(() => import('./screens/EditCourse').then((m) => ({ default: m.EditCourse })));
const Essay = lazy(() => import('./screens/Essay').then((m) => ({ default: m.Essay })));
const EventDetail = lazy(() => import('./screens/Calendar').then((m) => ({ default: m.EventDetail })));
const Exam = lazy(() => import('./screens/Exam').then((m) => ({ default: m.Exam })));
const Export = lazy(() => import('./screens/Export').then((m) => ({ default: m.Export })));
const Gap = lazy(() => import('./screens/Gap').then((m) => ({ default: m.Gap })));
const Grades = lazy(() => import('./screens/Grades').then((m) => ({ default: m.Grades })));
const Groupwork = lazy(() => import('./screens/Groupwork').then((m) => ({ default: m.Groupwork })));
const Guide = lazy(() => import('./screens/Guide').then((m) => ({ default: m.Guide })));
const Housing = lazy(() => import('./screens/Housing').then((m) => ({ default: m.Housing })));
const Import = lazy(() => import('./screens/Import').then((m) => ({ default: m.Import })));
const ItemDetail = lazy(() => import('./screens/Courses').then((m) => ({ default: m.ItemDetail })));
const LessonPlayer = lazy(() => import('./screens/Lesson').then((m) => ({ default: m.LessonPlayer })));
const Mail = lazy(() => import('./screens/Mail').then((m) => ({ default: m.Mail })));
const Maps = lazy(() => import('./screens/Maps').then((m) => ({ default: m.Maps })));
const Me = lazy(() => import('./screens/Me').then((m) => ({ default: m.Me })));
const Meals = lazy(() => import('./screens/Meals').then((m) => ({ default: m.Meals })));
const Mine = lazy(() => import('./screens/Mine').then((m) => ({ default: m.Mine })));
const NoteEditor = lazy(() => import('./screens/Mine').then((m) => ({ default: m.NoteEditor })));
const Notifications = lazy(() => import('./screens/Me').then((m) => ({ default: m.Notifications })));
const Quiz = lazy(() => import('./screens/Drill').then((m) => ({ default: m.Quiz })));
const Registrar = lazy(() => import('./screens/Registrar').then((m) => ({ default: m.Registrar })));
const Runway = lazy(() => import('./screens/Runway').then((m) => ({ default: m.Runway })));
const Search = lazy(() => import('./screens/Me').then((m) => ({ default: m.Search })));
const Settings = lazy(() => import('./screens/Me').then((m) => ({ default: m.Settings })));
// The settings pages. Lazy like every other screen: somebody who never opens
// settings should not download the colour picker.
const SettingsLook = lazy(() => import('./screens/settings/Look').then((m) => ({ default: m.SettingsLook })));
const SettingsNav = lazy(() => import('./screens/settings/Nav').then((m) => ({ default: m.SettingsNav })));
const SettingsAlerts = lazy(() => import('./screens/settings/Alerts').then((m) => ({ default: m.SettingsAlerts })));
const SettingsCourses = lazy(() => import('./screens/settings/Courses').then((m) => ({ default: m.SettingsCourses })));
const SettingsGrading = lazy(() => import('./screens/settings/Grading').then((m) => ({ default: m.SettingsGrading })));
const SettingsWorkload = lazy(() => import('./screens/settings/Workload').then((m) => ({ default: m.SettingsWorkload })));
const SettingsStorage = lazy(() => import('./screens/settings/Storage').then((m) => ({ default: m.SettingsStorage })));
const SettingsAbout = lazy(() => import('./screens/settings/About').then((m) => ({ default: m.SettingsAbout })));
const SlideDeck = lazy(() => import('./screens/Slides').then((m) => ({ default: m.SlideDeck })));
const Solve = lazy(() => import('./screens/Solve').then((m) => ({ default: m.Solve })));
const Sources = lazy(() => import('./screens/Sources').then((m) => ({ default: m.Sources })));
const Study = lazy(() => import('./screens/Study').then((m) => ({ default: m.Study })));
const Weekly = lazy(() => import('./screens/Weekly').then((m) => ({ default: m.Weekly })));
const Work = lazy(() => import('./screens/Work').then((m) => ({ default: m.Work })));
const Worked = lazy(() => import('./screens/Worked').then((m) => ({ default: m.Worked })));
const Yes = lazy(() => import('./screens/Yes').then((m) => ({ default: m.Yes })));
const Springboard = lazy(() => import('./screens/Springboard').then((m) => ({ default: m.Springboard })));
const Privacy = lazy(() => import('./screens/Privacy').then((m) => ({ default: m.Privacy })));
const DataScreen = lazy(() => import('./screens/Data').then((m) => ({ default: m.DataScreen })));
const Help = lazy(() => import('./screens/Help').then((m) => ({ default: m.Help })));
const Everything = lazy(() => import('./screens/Everything').then((m) => ({ default: m.Everything })));
const Chat = lazy(() => import('./ai/Chat').then((m) => ({ default: m.Chat })));

import { datedEvents, datedItems, nextExam } from './lib/select';
import { destination, rootOf } from './lib/nav';
import { chromeFor, homeShape } from './lib/chrome';
import { courseFieldFor, insideCourse } from './lib/parent';
import { ShellBody } from './components/shell/ShellBody';
import { ShelfNav } from './components/nav/ShelfNav';
import { SoftBar, SoftTop } from './components/soft/SoftTop';
import { litRailTab, litTab, tabLabel } from './lib/tabbar';
import { TabGlyph } from './components/TabIcon';
import { Running } from './components/Running';
import { Keys } from './components/Keys';
import { Ringing } from './components/Ringing';
import { PushTop } from './components/PushTop';
import { QuickAdd } from './components/QuickAdd';
import { Assistant } from './ai/Assistant';
import { Command } from './components/Command';
import { Undone } from './components/Undone';
import { ScrollArea } from './components/ScrollArea';
import { Tapped } from './components/Tapped';
import { Adopting } from './components/Adopting';
import { Watching } from './components/Watching';
import { forget } from './lib/scrollback';
import { Fresh } from './components/Fresh';
import { DESKTOP, useMedia } from './lib/media';
import { DOW, MONTHS } from './lib/date';
import { provider } from './lib/claude';
import type { Screen } from './lib/types';

/**
 * What fills the column while a screen's chunk is in flight.
 *
 * Not a spinner. A spinner says "something is happening" and nothing else; a
 * skeleton in the shape the screen is about to take means the layout does not
 * jump when it arrives. It is deliberately faint — most of the time it is on
 * screen for under a frame, and something that flashes brightly for 30ms is
 * worse than something that flashes dimly.
 *
 * It appears once per screen per session. React holds the module after the
 * first import, so the second visit to a screen renders straight away.
 */
function Loading() {
  return (
    <div style={{ padding: 18 }} aria-hidden="true">
      {[62, 30, 96, 96].map((h, i) => (
        <div
          key={i}
          style={{
            height: h,
            marginTop: i === 0 ? 0 : 12,
            borderRadius: 'var(--r-md)',
            background: 'var(--app-hero)',
            opacity: 0.55,
          }}
        />
      ))}
    </div>
  );
}

/** The kicker and title in the header, per screen. */
function useHeader(): { kicker: string; title: string } {
  const { state, now, catalog } = useStore();
  // Not `guide.code`. Opening a study screen by its own URL — which is the
  // point of having URLs — arrives with no course chosen, and the four study
  // kickers below then read a field off `undefined` and take the whole app
  // down before the screen renders. The screens themselves already survive
  // this: `useLive` falls back to an empty guide. The header did not.
  const code = catalog.guides[state.guideId]?.code ?? '';
  // A kicker of " · study guide" is a bug on show. Drop the empty half.
  const about = (what: string) => (code ? `${code} · ${what}` : what);
  const exam = nextExam(catalog, now);

  const today = `${DOW[now.getDay()]} · ${MONTHS[now.getMonth()]} ${now.getDate()}`;

  // These read off the courses actually loaded. They used to say "Fall 2026 ·
  // 11 credits" and "Across 4 courses" to everyone, which is a lie to every
  // user but one, and the kind that quietly says the app is not really yours.
  const n = catalog.courses.length;
  const courseCount = `${n} ${n === 1 ? 'course' : 'courses'}`;
  const credits = catalog.courses.reduce((sum, c) => sum + (parseFloat(c.credits) || 0), 0);
  const load = credits > 0 ? `${courseCount} · ${credits} credits` : courseCount;

  switch (state.screen) {
    case 'home':
      return { kicker: today, title: homeTitle(state.nav) };
    case 'courses':
      return { kicker: load, title: 'Courses' };
    case 'course': {
      // Optional, for the same reason `code` above is. A course id can outlive
      // the course: a link somebody shared, a bookmark to a course since
      // deleted, an id from an archived term. Every one of those rendered a
      // blank white screen, because the header threw before the screen it sits
      // above ever ran — and a header that can take the app down is a header
      // that must not assume anything is loaded.
      const open = catalog.byId[state.courseId];
      return { kicker: 'Course', title: open?.code ?? 'Not found' };
    }
    case 'item': {
      const item = datedItems(catalog, now).find((i) => i.id === state.itemId);
      return { kicker: item ? (catalog.byId[item.c]?.code ?? 'Item') : 'Item', title: item?.kind ?? 'Item' };
    }
    case 'study':
      return {
        kicker: exam ? `${exam.days} days to ${exam.code}` : courseCount,
        title: 'Study',
      };
    case 'guide':
      return { kicker: about('study guide'), title: 'Guide' };
    case 'drill':
      return { kicker: code, title: 'Drill' };
    case 'guess':
      return { kicker: about('before you read'), title: 'Guess first' };
    case 'quiz':
      return { kicker: about('multiple choice'), title: 'Quiz' };
    case 'calendar': {
      const source =
        state.calSource === 'all'
          ? 'Everything'
          : state.calSource === 'classes'
            ? 'Classes only'
            : state.calSource === 'deadlines'
              ? 'Deadlines only'
              : 'Campus only';
      if (state.calView === 'semester') return { kicker: source, title: 'Semester' };
      if (state.calView === 'day') return { kicker: source, title: 'Day' };
      return { kicker: `${source} · ${MONTHS[state.calMonth]}`, title: 'Calendar' };
    }
    case 'event': {
      const event = datedEvents(now).find((e) => e.id === state.eventId);
      return {
        kicker: event?.kind ?? 'Event',
        title: event ? `${event.mon} ${event.day}` : 'Event',
      };
    }
    case 'me':
      return { kicker: load, title: 'Progress' };
    case 'search':
      return { kicker: 'Anything in the app', title: 'Search' };
    case 'notifs':
      return { kicker: 'Today', title: 'Alerts' };
    case 'settings':
      return { kicker: 'Preferences', title: 'Settings' };
    // The settings pages carry their own heading inside the page, so the bar
    // above says where they sit rather than repeating the title underneath.
    case 'setLook':
      return { kicker: 'Settings', title: 'Appearance' };
    case 'setNav':
      return { kicker: 'Settings', title: 'Navigation' };
    case 'setAlerts':
      return { kicker: 'Settings', title: 'Alerts' };
    case 'setCourses':
      return { kicker: 'Settings', title: 'Courses' };
    case 'setGrading':
      return { kicker: 'Settings', title: 'Grading' };
    case 'setWorkload':
      return { kicker: 'Settings', title: 'Workload' };
    case 'setStorage':
      return { kicker: 'Settings', title: 'Storage' };
    case 'setAbout':
      return { kicker: 'Settings', title: 'About' };
    case 'mine':
      return { kicker: 'Yours, not the syllabus', title: 'Personal' };
    case 'note':
      return { kicker: 'Note', title: 'Editing' };
    case 'lesson':
      return { kicker: about('lesson'), title: 'Watch' };
    case 'update':
      return { kicker: about('into every study mode'), title: 'Add a reading' };
    case 'connect':
      return { kicker: 'Accounts and calendars', title: 'Connect' };
    case 'links':
      return { kicker: 'Everywhere you go', title: 'Links' };
    case 'ask':
      return { kicker: about('with the guide'), title: 'Ask Claude' };
    case 'work':
      return { kicker: about('assignments'), title: 'Work on it' };
    case 'grades':
      return { kicker: 'Weights from your syllabi', title: 'Grades' };
    case 'maps':
      return { kicker: 'Campus, city, and how to get there', title: 'Getting there' };
    case 'mail':
      return { kicker: 'Drafted here, sent by you', title: 'Email' };
    case 'export':
      return { kicker: 'Formats other software reads', title: 'Take it with you' };
    case 'yes':
      return { kicker: 'Registration, and the road back', title: 'YES' };
    case 'draw':
      return { kicker: about('as a picture'), title: 'Draw it' };
    case 'solve':
      return { kicker: about('step by step'), title: 'Work the problem' };
    case 'edit':
      return { kicker: 'A syllabus is a first draft', title: 'Edit the course' };
    case 'analyse':
      return { kicker: 'Computed here, not guessed', title: 'Analyse data' };
    case 'classmates':
      return { kicker: 'Confirmed Vanderbilt addresses', title: 'Classmates' };
    case 'activities':
      return { kicker: 'Everything that is not a class', title: 'Activities' };
    case 'clocks':
      return { kicker: 'Counting, and ringing', title: 'Timers and alarms' };
    case 'proof':
      return { kicker: 'Rules, not a judgement', title: 'Check the writing' };
    case 'applying':
      return { kicker: 'The other deadline set', title: 'Applications' };
    case 'tonight':
      return { kicker: 'Where the hours go', title: 'Tonight' };
    case 'behind':
      return { kicker: 'Counted, not felt', title: 'When you are behind' };
    case 'degree':
      return { kicker: 'Four years, not four months', title: 'The degree' };
    case 'people':
      return { kicker: 'Started late, invisibly', title: 'People and letters' };
    case 'brief':
      return { kicker: 'Counted, then read', title: 'Your day' };
    case 'essay':
      return { kicker: 'Everything but coursework', title: 'Draft it' };
    case 'deck':
      return { kicker: 'A real PowerPoint file', title: 'Make a deck' };
    case 'exam':
      return { kicker: 'Sat against a clock, marked', title: 'Practice paper' };
    case 'check':
      return { kicker: 'Syllabus against calendar', title: 'Check the dates' };
    case 'ahead':
      return { kicker: 'Counted, before it happens', title: 'The week ahead' };
    case 'announce':
      return { kicker: 'The email that moves a date', title: 'An announcement' };
    case 'costs':
      return { kicker: 'Books, fees and what came back', title: 'What this term cost' };
    case 'worked':
      return { kicker: 'Four months of your own evidence', title: 'What worked' };
    case 'gap':
      return { kicker: 'One thumb, and the walk taken off', title: 'Between classes' };
    case 'groupwork':
      return { kicker: 'Who has what, and by when', title: 'Group work' };
    case 'meals':
      return { kicker: 'Swipes, cash, and the week they run out', title: 'Meal plan' };
    case 'housing':
      return { kicker: 'The room, and the day you are out of it', title: 'Housing' };
    case 'runway':
      return { kicker: 'Counted backwards from the exam', title: 'Exam runway' };
    case 'weekly':
      return { kicker: 'What happened, and what is next', title: 'This week' };
    case 'registrar':
      return { kicker: 'The dates the university sets', title: 'Term deadlines' };
    case 'sources':
      return { kicker: 'Yours, never invented', title: 'Sources' };
    case 'account':
      return { kicker: 'Your semester, everywhere', title: 'Account' };
    case 'cloud':
      return { kicker: 'Files, mail and your calendar', title: 'Your accounts' };
    case 'slides':
      return { kicker: about('deck'), title: 'Slides' };
    case 'import':
      return { kicker: 'Syllabus in, course out', title: 'New course' };
    /*
     * Named, because the fallthrough below is not a default — it is a wrong
     * answer given confidently. A screen missing from this switch gets
     * "Today" and the date, so the full chat sat under a header announcing a
     * screen the reader was not on. The kicker names what is answering
     * rather than repeating the title, which is the one thing about this
     * screen worth saying before you have asked anything.
     */
    case 'chat':
      return { kicker: `${provider()} · this term`, title: 'Chat' };
    default:
      return { kicker: today, title: 'Today' };
  }
}

function Header() {
  const { state, dispatch, now, catalog } = useStore();
  const { kicker, title } = useHeader();
  /*
   * The course this screen sits inside, when it sits inside one.
   *
   * The header has always printed it — standing on Midterm 2 the kicker reads
   * ECON 1020 — and it was not pressable, so the only way up was Back, which
   * retraces how you arrived rather than going up. Somebody who opened a
   * deadline from Today and then wanted the course had to return to Today and
   * start again. See `lib/parent.ts` for why this is one level and not a
   * breadcrumb trail.
   *
   * The link says the course code rather than the kicker. The kicker describes
   * the screen you are standing on — "Weights from your syllabi", "PSCI 1104 ·
   * study guide" — so labelling a link to the course with it was a link whose
   * words did not match where it went.
   */
  const upTo = (() => {
    if (state.screen === 'course' || !insideCourse(state.screen)) return null;
    if (state.screen === 'item') {
      const item = datedItems(catalog, now).find((i) => i.id === state.itemId);
      return catalog.byId[item?.c ?? ''] ?? null;
    }
    const field = courseFieldFor(state.screen);
    return catalog.byId[field === 'guideId' ? state.guideId : state.courseId] ?? null;
  })();
  // Back appears whenever there is somewhere to go back to, which in feed mode
  // includes the root screens the tab bar would otherwise have covered.
  const canGoBack = state.history.length > 0;
  // Search used to appear on two screens out of twenty-five, so the one tool
  // that finds anything was itself the hardest thing to find. It is now on
  // every screen except the one it opens. Alerts stay at the top level, where
  // a header is not already competing with a Back button and a long title.
  const showActions = state.screen !== 'search';
  const atRoot = rootOf(state.screen) === state.screen;

  /*
   * Move focus into the new screen's heading whenever the screen changes.
   *
   * Not on the first render — focusing a heading on load steals the focus a
   * browser gives the document and scrolls a restored position back to the
   * top. Only on a change, which is the case that strands somebody.
   */
  const heading = useRef<HTMLHeadingElement>(null);
  const wasOn = useRef(state.screen);
  useEffect(() => {
    if (wasOn.current === state.screen) return;
    wasOn.current = state.screen;
    heading.current?.focus({ preventScroll: true });
  }, [state.screen]);

  return (
    // A real <header>, and the screen's name is the page's <h1>. Both were
    // styled divs, so a screen reader had no landmarks past <main> and no
    // heading to jump to — the whole app was one undifferentiated run of
    // buttons. Nothing about how it looks changes.
    <header className="safe-top app-header">
      {canGoBack && (
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => {
            // The browser's history, not the app's. Every navigation now
            // writes an entry, so going back any other way would leave the
            // address bar pointing at a screen nobody is on — and pressing
            // the browser's own Back afterwards would return to the screen
            // this button had just left. One stack, two buttons.
            try {
              window.history.back();
            } catch {
              dispatch({ type: 'back' });
            }
          }}
          aria-label="Back"
          style={{ marginLeft: -8, flex: 'none' }}
        >
          <ChevronLeft size={20} />
        </button>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {upTo ? (
          <button
            type="button"
            className="bare kicker"
            onClick={() => dispatch({ type: 'openCourse', id: upTo.id })}
            aria-label={`Up to ${upTo.code}`}
            style={{
              width: 'auto',
              padding: 0,
              textAlign: 'left',
              // A dotted underline in the text's own colour, rather than an
              // accent. The kicker is the quietest thing in the header and
              // recolouring it would make a navigation aid louder than the
              // screen's own name — but the first attempt used the hairline
              // colour, which on a phone is invisible, and an affordance
              // nobody can see is not an affordance.
              textDecoration: 'underline dotted',
              textUnderlineOffset: 3,
              textDecorationColor: 'currentColor',
            }}
          >
            {upTo.code}
          </button>
        ) : (
          <div className="kicker">{kicker}</div>
        )}
        {/*
          Focus lands here when the screen changes.

          Without it, pressing a tab button leaves focus on the button: a
          screen reader goes on describing the nav while the whole page behind
          it has been replaced, and a keyboard user's next Tab continues
          through the bar rather than into what they just opened. `tabIndex={-1}`
          makes it focusable by script without adding it to the tab order.
        */}
        <h1
          ref={heading}
          tabIndex={-1}
          className="chrome-text"
          style={{
            outline: 'none',
            fontSize: 'calc(23px * var(--text-scale, 1))',
            lineHeight: 1.15,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            margin: 0,
            fontWeight: 'inherit',
            letterSpacing: 'inherit',
          }}
        >
          {title}
        </h1>
      </div>

      {showActions && (
        <div style={{ display: 'flex', gap: 'var(--sp-1)', flex: 'none', alignItems: 'center' }}>
          {/* Before the icons, because it is the only thing here that is
              counting. Renders nothing at all unless a timer is running. */}
          <Running />
          {/* One line, from anywhere. The alternative to this button is four
              taps through two pickers, which is why nobody adds the thing
              they were told about walking out of a lecture. */}
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => dispatch({ type: 'quickAdd', open: true })}
            aria-label="Add something in one line"
          >
            <Plus size={19} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => dispatch({ type: 'go', screen: 'search' })}
            aria-label="Search"
          >
            <SearchIcon size={19} />
          </button>
          {atRoot && (
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => dispatch({ type: 'go', screen: 'notifs' })}
            aria-label="Alerts"
            style={{ position: 'relative' }}
          >
            <Bell size={19} />
            {!state.cleared && (
              <span
                style={{
                  position: 'absolute',
                  top: 5,
                  right: 6,
                  width: 7,
                  height: 7,
                  background: 'var(--app-accent)',
                }}
              />
            )}
          </button>
          )}
          {state.nav === 'feed' && atRoot && (
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={() => dispatch({ type: 'go', screen: 'me' })}
              aria-label="Me"
            >
              <Person size={19} />
            </button>
          )}
        </div>
      )}
    </header>
  );
}

/**
 * The tab bar's real height, written to the root as `--tabbar-h`.
 *
 * Nothing else in the app needed to know it — the bar is a flex child and
 * everything above it just takes the remaining space. The assistant's button
 * is fixed to the viewport, so it does need to know, and the height is not a
 * constant: the bar grows with the text-size and density settings, and a
 * hard-coded number sits on top of it at the largest one.
 */
function useTabBarHeight(ref: React.RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const write = () => {
      document.documentElement.style.setProperty('--tabbar-h', `${Math.round(node.getBoundingClientRect().height)}px`);
    };
    write();
    const watch = new ResizeObserver(write);
    watch.observe(node);
    return () => {
      watch.disconnect();
      // Left set would strand the button above a bar that is no longer there
      // — the fullscreen screens hide it entirely.
      document.documentElement.style.removeProperty('--tabbar-h');
    };
  }, [ref]);
}

function TabBar() {
  const { state, dispatch } = useStore();
  const bar = useRef<HTMLElement>(null);
  useTabBarHeight(bar);
  // The seven that shipped are still the default; this is whichever seven the
  // student arranged. `litTab` rather than `rootOf` because a chosen bar can
  // hold a screen and the tab it files under at the same time.
  const tabs = state.tabs;
  const here = litTab(state.screen, tabs);
  const labelled = state.labels !== 'off';

  return (
    <nav ref={bar} className="safe-bottom app-tabs" aria-label="Sections">
      {tabs.map((id) => {
        const label = tabLabel(id);
        // Lit for the screen itself and for everything nested under it, so a
        // flashcard three levels deep still shows you are inside Study.
        const on = here === id;
        return (
          <button
            key={id}
            type="button"
            className="bare"
            aria-label={labelled ? undefined : label}
            onClick={() => {
              // Tapping the tab you are already on goes to the top. That is
              // what every phone does, and it is the only way back up a long
              // list without flicking — `go` to the current screen is a no-op
              // in the reducer, so nothing else would happen at all.
              if (state.screen === id) {
                forget(id);
                document.querySelector('.scrollarea')?.scrollTo({ top: 0, behavior: 'smooth' });
                return;
              }
              dispatch({ type: 'go', screen: id });
            }}
            aria-current={on ? 'page' : undefined}
            style={{
              flex: 1,
              borderTop: `2px solid ${on ? 'var(--app-accent)' : 'transparent'}`,
              padding: '9px 0 4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              color: on ? 'var(--app-accent)' : 'var(--app-faint)',
              fontFamily: 'var(--font-heading)',
            }}
          >
            <TabGlyph screen={id} size={labelled ? 19 : 23} />
            {/* Seven tabs across 402px leaves about 57px each, and "CALENDAR"
                at the old tracking was wider than that — it would have wrapped
                to two lines and made the bar taller on every screen. Tighter
                and a shade smaller keeps real words rather than abbreviating
                them, and nowrap makes a future overflow visible rather than
                silently restacking. `tabLabel` is what keeps a chosen screen
                inside that budget: the directory's own "Fold in an
                announcement" would not go here, so it has a short name.

                With labels off the glyph grows to take some of the room back
                and the name moves to `aria-label`, so the bar is quieter on
                screen and unchanged to a screen reader. */}
            {labelled ? (
              <span
                style={{
                  fontSize: 'calc(9px * var(--text-scale, 1))',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

function CurrentScreen() {
  const { state } = useStore();
  switch (state.screen) {
    case 'home':
      // The home screen the chosen navigation calls for. The springboard is a
      // way in rather than a different app: every icon goes to the same screen
      // the tab bar would have. `Today` reads the same `homeShape` to decide
      // between its two readings of the day, so the three cannot disagree.
      return homeShape(state.nav) === 'springboard' ? <Springboard /> : <Today />;
    case 'privacy':
      return <Privacy />;
    case 'data':
      return <DataScreen />;
    case 'help':
      return <Help />;
    case 'everything':
      return <Everything />;
    case 'chat':
      return <Chat />;
    case 'courses':
      return <Courses />;
    case 'course':
      return <CourseDetail />;
    case 'item':
      return <ItemDetail />;
    case 'calendar':
      return <Calendar />;
    case 'event':
      return <EventDetail />;
    case 'me':
      return <Me />;
    case 'search':
      return <Search />;
    case 'notifs':
      return <Notifications />;
    case 'settings':
      return <Settings />;
    case 'setLook':
      return <SettingsLook />;
    case 'setNav':
      return <SettingsNav />;
    case 'setAlerts':
      return <SettingsAlerts />;
    case 'setCourses':
      return <SettingsCourses />;
    case 'setGrading':
      return <SettingsGrading />;
    case 'setWorkload':
      return <SettingsWorkload />;
    case 'setStorage':
      return <SettingsStorage />;
    case 'setAbout':
      return <SettingsAbout />;
    case 'mine':
      return <Mine />;
    case 'note':
      return <NoteEditor />;
    case 'import':
      return <Import />;
    case 'study':
      return <Study />;
    case 'guide':
      return <Guide />;
    case 'drill':
      return <Drill />;
    case 'guess':
      return <Guess />;
    case 'quiz':
      return <Quiz />;
    case 'lesson':
      return <LessonPlayer />;
    case 'update':
      return <AddMaterial />;
    case 'connect':
      return <Connect />;
    case 'links':
      return <Links />;
    case 'ask':
      return <Ask />;
    case 'work':
      return <Work />;
    case 'grades':
      return <Grades />;
    case 'maps':
      return <Maps />;
    case 'mail':
      return <Mail />;
    case 'export':
      return <Export />;
    case 'yes':
      return <Yes />;
    case 'draw':
      return <Draw />;
    case 'solve':
      return <Solve />;
    case 'edit':
      return <EditCourse />;
    case 'analyse':
      return <Analyse />;
    case 'classmates':
      return <Classmates />;
    case 'activities':
      return <Activities />;
    case 'clocks':
      return <Clocks />;
    case 'proof':
      return <Proof />;
    case 'applying':
      return <Applying />;
    case 'tonight':
      return <Tonight />;
    case 'behind':
      return <Behind />;
    case 'degree':
      return <Degree />;
    case 'people':
      return <People />;
    case 'brief':
      return <Brief />;
    case 'essay':
      return <Essay />;
    case 'deck':
      return <Deck />;
    case 'exam':
      return <Exam />;
    case 'check':
      return <CheckDates />;
    case 'ahead':
      return <Ahead />;
    case 'announce':
      return <Announce />;
    case 'costs':
      return <Costs />;
    case 'worked':
      return <Worked />;
    case 'gap':
      return <Gap />;
    case 'groupwork':
      return <Groupwork />;
    case 'meals':
      return <Meals />;
    case 'housing':
      return <Housing />;
    case 'runway':
      return <Runway />;
    case 'weekly':
      return <Weekly />;
    case 'registrar':
      return <Registrar />;
    case 'sources':
      return <Sources />;
    case 'account':
      return <AccountScreen />;
    case 'cloud':
      return <Cloud />;
    case 'slides':
      return <SlideDeck />;
    default:
      return <Today />;
  }
}

/**
 * The same tabs, unrolled down the side.
 *
 * A laptop has room for the navigation to stay visible, and hiding it behind
 * the phone's tab-bar rules would make the wide layout worse than the narrow
 * one. So on a wide screen the rail is always there, whichever nav mode the
 * phone is set to, and it carries the things the phone keeps under Me.
 */
function Rail() {
  const { state, dispatch } = useStore();
  const tabs = state.tabs;
  // The rail keeps its labels whatever the tab bar does: it is a wide-screen
  // sidebar with room for words, and the setting exists to buy height back on
  // a phone, which the rail is not on.
  // Taken from the one list of places, so the rail cannot drift out of step
  // with what Me and search know about.
  const extras = ['ask', 'import', 'account', 'connect', 'cloud', 'settings']
    .map((s) => destination(s as Screen))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    // Not twice. Four of these six can now be put in the bar, and the rail
    // draws the bar above this list — so without the filter, a student who
    // put Ask Claude in their bar would find it in the rail twice.
    .filter((d) => !tabs.includes(d.screen));
  // Whichever of those the rail ended up drawing, so `litRailTab` knows which
  // screens this nav already has a row of its own for.
  const here = litRailTab(
    state.screen,
    tabs,
    extras.map((d) => d.screen),
  );

  return (
    <nav className="rail" aria-label="Sections">
      <div className="rail-mark chrome-text">Semester</div>
      {tabs.map((id) => {
        const label = tabLabel(id);
        const on = here === id;
        return (
          <button
            key={id}
            type="button"
            className="bare rail-item"
            onClick={() => {
              // Tapping the tab you are already on goes to the top. That is
              // what every phone does, and it is the only way back up a long
              // list without flicking — `go` to the current screen is a no-op
              // in the reducer, so nothing else would happen at all.
              if (state.screen === id) {
                forget(id);
                document.querySelector('.scrollarea')?.scrollTo({ top: 0, behavior: 'smooth' });
                return;
              }
              dispatch({ type: 'go', screen: id });
            }}
            aria-current={on ? 'page' : undefined}
            style={{
              color: on ? 'var(--app-accent-bright)' : 'var(--app-faint)',
              background: on ? 'var(--app-hero)' : 'transparent',
              boxShadow: on ? '0 1px 0 var(--app-line-top) inset' : 'none',
            }}
          >
            <TabGlyph screen={id} size={18} />
            <span>{label}</span>
          </button>
        );
      })}
      <div className="rail-gap" />
      {extras.map(({ screen, label, blurb }) => {
        // The same treatment a tab gets, because it means the same thing: this
        // is the screen you are on. A colour shift alone lost that argument to
        // the lit pill `litTab` used to put on the tab above.
        const on = state.screen === screen;
        return (
          <button
            key={screen}
            type="button"
            className="bare rail-item rail-quiet"
            onClick={() => dispatch({ type: 'go', screen })}
            title={blurb}
            aria-current={on ? 'page' : undefined}
            style={{
              color: on ? 'var(--app-accent-bright)' : 'var(--app-faint)',
              background: on ? 'var(--app-hero)' : 'transparent',
              boxShadow: on ? '0 1px 0 var(--app-line-top) inset' : 'none',
            }}
          >
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default function App() {
  const { state, dispatch, saveTrouble, asking, settle } = useStore();
  const wide = useMedia(DESKTOP);
  /*
   * Which navigation is drawn — and it is one, always.
   *
   * This used to be four conditions in four places, and more than one of them
   * could be yes. `shell === 'soft'` drew its own two rows of pills while
   * `nav` drew a tab bar or a rail underneath them, so the soft layout was
   * the same app with two navigations stacked in it. Anybody who chose it saw
   * two systems running at once, because that is what it was.
   *
   * The whole rule is `lib/chrome.ts` now, and `chrome.test.ts` runs every
   * combination of navigation, screen and width to prove no two are ever
   * drawn together. Here there is one call and no conditions of its own.
   */
  const chrome = chromeFor(state.nav, state.screen, wide);

  /**
   * The whole look, written onto the document root.
   *
   * On :root rather than on a wrapper so it reaches the tab bar, the rail and
   * anything that renders outside the app's own column, and so a token defined
   * in app.css is genuinely overridden rather than shadowed for part of the
   * tree. Type scales by the root font size, which every rem in the sheet then
   * follows; the px sizes written inline do not move, which is deliberate —
   * a tap target that grew with the text would push the tab bar off screen.
   *
   * The full token set is written every time rather than only what changed.
   * That is what makes switching ground atomic: there is no frame in which the
   * new panel colour has landed and the new text colour has not, which on a
   * light ground would be a flash of white text on white.
   */
  /*
   * The look, serialised, as the dependency.
   *
   * This effect used to name five fields in its body and six in its dependency
   * array, which is the same bug the localStorage save had and for the same
   * reason: adding a control means editing two lists, and forgetting one gives
   * you a setting that changes on screen, does nothing, and offers no clue why.
   * Body face, line spacing, reading width, icon shape and the accent hue were
   * all added and all silently did nothing until this was driven in a browser.
   *
   * `currentLook` is the one list. Depending on its serialised form means the
   * effect runs when the look changes and not on every unrelated dispatch.
   */
  // "Match my device" is not a palette, it is an instruction — resolved here,
  // once, so everything downstream sees a ground that names real colours. See
  // `lib/look.ts`.
  const prefersDark = usePrefersDark();
  const moreContrast = usePrefersContrast();
  const lookKey = JSON.stringify({
    ...currentLook(state),
    ground: resolveGround(state.ground, prefersDark),
  });

  useEffect(() => {
    const root = document.documentElement;
    const tokens = tokensFor(JSON.parse(lookKey) as Look, moreContrast);
    for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
    const scale = scaleOf(state.textSize);
    root.style.fontSize = `${16 * scale}px`;
    // The setting used to reach almost nothing. The root font size scales
    // anything in `rem`, and this app writes `fontSize: 14` inline, in px, in
    // about twelve hundred places — so "Largest" moved the handful of sizes
    // that came from the stylesheet and left every screen the same. Rewriting
    // twelve hundred sites as rem would also rewrite twelve hundred layouts;
    // multiplying them through one variable moves the type and nothing else.
    root.style.setProperty('--text-scale', String(scale));
    // The browser paints its own chrome — the scrollbar, the overscroll edge,
    // form controls — from this, and a light theme with a dark scrollbar is
    // the tell that a theme was only half done.
    //
    // Read from the ground itself rather than from a hardcoded name: it said
    // `=== 'parchment'`, so Paper and Fog — both light — got a dark scrollbar
    // and a dark overscroll edge.
    root.style.colorScheme = ground(JSON.parse(lookKey).ground).light ? 'light' : 'dark';
  }, [lookKey, state.textSize, moreContrast]);

  if (state.screen === 'onboarding') {
    return (
      <div className="device">
        <Onboarding />
      </div>
    );
  }

  /**
   * A banner for a device that has stopped saving.
   *
   * Under the header rather than as a toast: this is a standing condition, not
   * an event. Until it is fixed, everything the person does is being lost on
   * the next reload, and a message that fades after four seconds is worse than
   * none because it makes them think they imagined it.
   */
  const trouble = saveTrouble ? (
    <div
      role="status"
      style={{
        flex: 'none',
        padding: '10px 18px 11px',
        background: 'var(--app-warn-wash)',
        borderBottom: '1px solid var(--app-warn-line)',
        color: 'var(--app-fg)',
        fontSize: 'calc(12.5px * var(--text-scale, 1))',
        lineHeight: 'var(--leading-normal)',
        textWrap: 'pretty',
      }}
    >
      {saveTrouble}
    </div>
  ) : null;

  if (wide) {
    return (
      /*
       * One column when the shelves are the navigation, two when the rail is.
       *
       * The rail is how the tab bar, the feed and the springboard all express
       * themselves on a wide screen — a laptop has room to keep the
       * navigation visible, and hiding it behind the phone's rules would make
       * the wide layout worse than the narrow one. The shelves are already a
       * navigation that shows both the shelf and its screens, so drawing the
       * rail beside them is the same doubling this release exists to remove.
       * `.desk-one` drops the rail's column so the pane does not sit in the
       * second half of an empty grid.
       */
      <div className={chrome.rail ? 'desk' : 'desk desk-one'}>
        <Fresh />
        <Said />
        {/* Mounted once, at the top, so a shortcut cannot work on one screen
            and not another. Renders nothing unless the sheet is open. */}
        <Keys />
        {/* Like Keys: mounted once so a timer set on one screen still
            rings on another. Renders nothing until something goes off. */}
        <Ringing />
        {/* Keeps the reminder queue fed. Draws nothing. */}
        <PushTop />
        {/* Takes a tapped notification to the thing it was about. Draws
            nothing. */}
        <Tapped />
        {/* Notices what goes wrong, on this device only. Draws nothing. */}
        <Watching />
        {/* Offers the last removal back, from wherever it happened. */}
        <Replaced />
      <Undone />
        {/* One assistant, in the shell rather than on a screen. See `ai/`. */}
        <Assistant />
        {/* The one question a first sign-in asks, and only when it is real. */}
        {asking && <Adopting sides={asking.sides} say={asking.say} onChoose={settle} />}
        {state.quickAdd && <QuickAdd onClose={() => dispatch({ type: 'quickAdd', open: false })} />}
      {state.finder && <Command onClose={() => dispatch({ type: 'finder', open: false })} />}
        {chrome.rail && <Rail />}
        <div className="device device-pane">
          <Header />
          {/* Under the header rather than above it, and inside the pane rather
              than beside it: `.desk` is a two-column grid, and a bare element
              at its root takes the rail's column. */}
          <SampleMark />
          {trouble}
          {chrome.shelves && <ShelfNav />}
          <ScrollArea screen={state.screen} key={state.screen}>
            <SoftTop />
            <Suspense fallback={<Loading />}>
              <ShellBody screen={state.screen}>
                <CurrentScreen />
              </ShellBody>
            </Suspense>
            <SoftBar />
          </ScrollArea>
        </div>
      </div>
    );
  }

  return (
    <div className="device">
      {/*
        The first focusable thing on the page, and invisible until it has
        focus. With fifty screens behind a header and a tab bar, a keyboard
        user's only route into the content was to tab through the whole of
        both, on every screen, every time.
      */}
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Fresh />
      <Said />
      <Ringing />
      <PushTop />
      <Tapped />
      <Watching />
      <Replaced />
      <Undone />
      {/* One assistant, in the shell rather than on a screen. See `ai/`. */}
      <Assistant />
      {asking && <Adopting sides={asking.sides} say={asking.say} onChoose={settle} />}
      {state.quickAdd && <QuickAdd onClose={() => dispatch({ type: 'quickAdd', open: false })} />}
        {state.finder && <Command onClose={() => dispatch({ type: 'finder', open: false })} />}
      <Header />
      <SampleMark />
      {trouble}
      {chrome.shelves && <ShelfNav />}
      <ScrollArea screen={state.screen} key={state.screen}>
        <SoftTop />
        <Suspense fallback={<Loading />}>
          <ShellBody screen={state.screen}>
            <CurrentScreen />
          </ShellBody>
        </Suspense>
        <SoftBar />
      </ScrollArea>
      {chrome.tabs && <TabBar />}
      {chrome.fab && (
        <button
          type="button"
          className="bare"
          onClick={() => dispatch({ type: 'go', screen: 'import' })}
          aria-label="Import a syllabus"
          style={{
            position: 'absolute',
            right: 20,
            bottom: 48,
            width: 56,
            height: 56,
            background: 'var(--chrome)',
            border: '1px solid rgba(255,255,255,.5)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--chrome-ink)',
            boxShadow: 'var(--glow)',
          }}
        >
          <Plus size={24} />
        </button>
      )}
    </div>
  );
}

/** Re-exported so screens can render a tick without importing the icon set. */
export { Check };
