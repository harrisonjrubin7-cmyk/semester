import { Suspense, lazy, useEffect } from 'react';
import { useStore } from './state/store';
import {
  Bell,
  Check,
  ChevronLeft,
  Person,
  Plus,
  Search as SearchIcon,
} from './components/Icons';
import { Onboarding } from './screens/Onboarding';
import { Today } from './screens/Today';
import { scaleOf, tokensFor } from './lib/look';

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
const Costs = lazy(() => import('./screens/Costs').then((m) => ({ default: m.Costs })));
const CourseDetail = lazy(() => import('./screens/Courses').then((m) => ({ default: m.CourseDetail })));
const Courses = lazy(() => import('./screens/Courses').then((m) => ({ default: m.Courses })));
const Deck = lazy(() => import('./screens/Deck').then((m) => ({ default: m.Deck })));
const Draw = lazy(() => import('./screens/Draw').then((m) => ({ default: m.Draw })));
const Drill = lazy(() => import('./screens/Drill').then((m) => ({ default: m.Drill })));
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
const SlideDeck = lazy(() => import('./screens/Slides').then((m) => ({ default: m.SlideDeck })));
const Solve = lazy(() => import('./screens/Solve').then((m) => ({ default: m.Solve })));
const Sources = lazy(() => import('./screens/Sources').then((m) => ({ default: m.Sources })));
const Study = lazy(() => import('./screens/Study').then((m) => ({ default: m.Study })));
const Weekly = lazy(() => import('./screens/Weekly').then((m) => ({ default: m.Weekly })));
const Work = lazy(() => import('./screens/Work').then((m) => ({ default: m.Work })));
const Worked = lazy(() => import('./screens/Worked').then((m) => ({ default: m.Worked })));
const Yes = lazy(() => import('./screens/Yes').then((m) => ({ default: m.Yes })));

import { datedEvents, datedItems, nextExam } from './lib/select';
import { destination, rootOf } from './lib/nav';
import { litTab, tabLabel } from './lib/tabbar';
import { TabGlyph } from './components/TabIcon';
import { Running } from './components/Running';
import { Keys } from './components/Keys';
import { Fresh } from './components/Fresh';
import { DESKTOP, useMedia } from './lib/media';
import { DOW, MONTHS } from './lib/date';
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

/**
 * The screens that keep the whole display.
 *
 * A drill is one card at a time and a tab bar under it invites a mis-tap; a
 * lesson and a deck are playback. Everything else keeps the bar.
 */
const FULLSCREEN: Screen[] = ['drill', 'quiz', 'lesson', 'slides', 'onboarding'];

/** The kicker and title in the header, per screen. */
function useHeader(): { kicker: string; title: string } {
  const { state, now, catalog } = useStore();
  const guide = catalog.guides[state.guideId];
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
      return { kicker: today, title: state.nav === 'feed' ? 'Everything' : 'Today' };
    case 'courses':
      return { kicker: load, title: 'Courses' };
    case 'course':
      return { kicker: 'Course', title: catalog.byId[state.courseId].code };
    case 'item': {
      const item = datedItems(catalog, now).find((i) => i.id === state.itemId);
      return { kicker: item ? catalog.byId[item.c].code : 'Item', title: item?.kind ?? 'Item' };
    }
    case 'study':
      return {
        kicker: exam ? `${exam.days} days to ${exam.code}` : courseCount,
        title: 'Study',
      };
    case 'guide':
      return { kicker: `${guide.code} · study guide`, title: 'Guide' };
    case 'drill':
      return { kicker: guide.code, title: 'Drill' };
    case 'quiz':
      return { kicker: `${guide.code} · multiple choice`, title: 'Quiz' };
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
      return { kicker: load, title: 'Me' };
    case 'search':
      return { kicker: 'Anything in the app', title: 'Search' };
    case 'notifs':
      return { kicker: 'Today', title: 'Alerts' };
    case 'settings':
      return { kicker: 'Preferences', title: 'Settings' };
    case 'mine':
      return { kicker: 'Yours, not the syllabus', title: 'Mine' };
    case 'note':
      return { kicker: 'Note', title: 'Editing' };
    case 'lesson':
      return { kicker: `${guide.code} · lesson`, title: 'Watch' };
    case 'update':
      return { kicker: `${guide.code} · into every study mode`, title: 'Add a reading' };
    case 'connect':
      return { kicker: 'Accounts and calendars', title: 'Connect' };
    case 'ask':
      return { kicker: `${guide.code} · with the guide`, title: 'Ask Claude' };
    case 'work':
      return { kicker: `${guide.code} · assignments`, title: 'Work on it' };
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
      return { kicker: `${guide.code} · as a picture`, title: 'Draw it' };
    case 'solve':
      return { kicker: `${guide.code} · step by step`, title: 'Work the problem' };
    case 'edit':
      return { kicker: 'A syllabus is a first draft', title: 'Edit the course' };
    case 'analyse':
      return { kicker: 'Computed here, not guessed', title: 'Analyse data' };
    case 'classmates':
      return { kicker: 'Confirmed Vanderbilt addresses', title: 'Classmates' };
    case 'activities':
      return { kicker: 'Everything that is not a class', title: 'Activities' };
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
      return { kicker: `${guide.code} · deck`, title: 'Slides' };
    case 'import':
      return { kicker: 'Syllabus in, course out', title: 'New course' };
    default:
      return { kicker: today, title: 'Today' };
  }
}

function Header() {
  const { state, dispatch } = useStore();
  const { kicker, title } = useHeader();
  // Back appears whenever there is somewhere to go back to, which in feed mode
  // includes the root screens the tab bar would otherwise have covered.
  const canGoBack = state.history.length > 0;
  // Search used to appear on two screens out of twenty-five, so the one tool
  // that finds anything was itself the hardest thing to find. It is now on
  // every screen except the one it opens. Alerts stay at the top level, where
  // a header is not already competing with a Back button and a long title.
  const showActions = state.screen !== 'search';
  const atRoot = rootOf(state.screen) === state.screen;

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
          onClick={() => dispatch({ type: 'back' })}
          aria-label="Back"
          style={{ marginLeft: -8, flex: 'none' }}
        >
          <ChevronLeft size={20} />
        </button>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="kicker">{kicker}</div>
        <h1
          className="chrome-text"
          style={{
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
        <div style={{ display: 'flex', gap: 2, flex: 'none', alignItems: 'center' }}>
          {/* Before the icons, because it is the only thing here that is
              counting. Renders nothing at all unless a timer is running. */}
          <Running />
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

function TabBar() {
  const { state, dispatch } = useStore();
  // The seven that shipped are still the default; this is whichever seven the
  // student arranged. `litTab` rather than `rootOf` because a chosen bar can
  // hold a screen and the tab it files under at the same time.
  const tabs = state.tabs;
  const here = litTab(state.screen, tabs);

  return (
    <nav className="safe-bottom app-tabs">
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
            onClick={() => dispatch({ type: 'go', screen: id })}
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
            <TabGlyph screen={id} size={19} />
            {/* Seven tabs across 402px leaves about 57px each, and "CALENDAR"
                at the old tracking was wider than that — it would have wrapped
                to two lines and made the bar taller on every screen. Tighter
                and a shade smaller keeps real words rather than abbreviating
                them, and nowrap makes a future overflow visible rather than
                silently restacking. `tabLabel` is what keeps a chosen screen
                inside that budget: the directory's own "Fold in an
                announcement" would not go here, so it has a short name. */}
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
      return <Today />;
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
    case 'quiz':
      return <Quiz />;
    case 'lesson':
      return <LessonPlayer />;
    case 'update':
      return <AddMaterial />;
    case 'connect':
      return <Connect />;
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
  const here = litTab(state.screen, tabs);
  // Taken from the one list of places, so the rail cannot drift out of step
  // with what Me and search know about.
  const extras = ['ask', 'import', 'account', 'connect', 'cloud', 'settings']
    .map((s) => destination(s as Screen))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    // Not twice. Four of these six can now be put in the bar, and the rail
    // draws the bar above this list — so without the filter, a student who
    // put Ask Claude in their bar would find it in the rail twice.
    .filter((d) => !tabs.includes(d.screen));

  return (
    <nav className="rail">
      <div className="rail-mark chrome-text">Semester</div>
      {tabs.map((id) => {
        const label = tabLabel(id);
        const on = here === id;
        return (
          <button
            key={id}
            type="button"
            className="bare rail-item"
            onClick={() => dispatch({ type: 'go', screen: id })}
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
      {extras.map(({ screen, label, blurb }) => (
        <button
          key={screen}
          type="button"
          className="bare rail-item rail-quiet"
          onClick={() => dispatch({ type: 'go', screen })}
          title={blurb}
          style={{ color: state.screen === screen ? 'var(--app-accent)' : 'var(--app-faint)' }}
        >
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export default function App() {
  const { state, dispatch, saveTrouble } = useStore();
  const wide = useMedia(DESKTOP);

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
  useEffect(() => {
    const root = document.documentElement;
    const tokens = tokensFor({
      accent: state.accent,
      ground: state.ground,
      corners: state.corners,
      typeface: state.typeface,
      density: state.density,
    });
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
    root.style.colorScheme = state.ground === 'parchment' ? 'light' : 'dark';
  }, [state.accent, state.textSize, state.ground, state.corners, state.typeface, state.density]);

  if (state.screen === 'onboarding') {
    return (
      <div className="device">
        <Onboarding />
      </div>
    );
  }

  // The tab bar used to hide on every screen that was not itself a tab, so
  // opening a course guide left Back as the only exit — five taps from a
  // flashcard to the calendar. It now stays put everywhere except the screens
  // that genuinely need the whole display: a running drill, a lesson, a deck.
  const showTabs = state.nav === 'tabs' && !FULLSCREEN.includes(state.screen) && !wide;
  const showFab = state.nav === 'feed' && state.screen === 'home' && !wide;

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
        lineHeight: 1.45,
        textWrap: 'pretty',
      }}
    >
      {saveTrouble}
    </div>
  ) : null;

  if (wide) {
    return (
      <div className="desk">
        <Fresh />
        {/* Mounted once, at the top, so a shortcut cannot work on one screen
            and not another. Renders nothing unless the sheet is open. */}
        <Keys />
        <Rail />
        <div className="device device-pane">
          <Header />
          {trouble}
          <main className="scrollarea" key={state.screen}>
            <Suspense fallback={<Loading />}>
              <CurrentScreen />
            </Suspense>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="device">
      <Fresh />
      <Header />
      {trouble}
      <main className="scrollarea" key={state.screen}>
        <Suspense fallback={<Loading />}>
          <CurrentScreen />
        </Suspense>
      </main>
      {showTabs && <TabBar />}
      {showFab && (
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
