import { useEffect } from 'react';
import { useStore } from './state/store';
import {
  Bell,
  CalendarIcon,
  MapIcon,
  Check,
  ChevronLeft,
  CoursesIcon,
  Person,
  Plus,
  Search as SearchIcon,
  StudyIcon,
  TodayIcon,
  NotesIcon,
} from './components/Icons';
import { Onboarding } from './screens/Onboarding';
import { Today } from './screens/Today';
import { CourseDetail, Courses, ItemDetail } from './screens/Courses';
import { Calendar, EventDetail } from './screens/Calendar';
import { Me, Notifications, Search, Settings } from './screens/Me';
import { Import } from './screens/Import';
import { Study } from './screens/Study';
import { Guide } from './screens/Guide';
import { Drill, Quiz } from './screens/Drill';
import { Mine, NoteEditor } from './screens/Mine';
import { LessonPlayer } from './screens/Lesson';
import { AddMaterial } from './screens/Update';
import { Connect } from './screens/Connect';
import { Ask } from './screens/Ask';
import { Work } from './screens/Work';
import { Grades } from './screens/Grades';
import { Maps } from './screens/Maps';
import { Mail } from './screens/Mail';
import { Export } from './screens/Export';
import { Yes } from './screens/Yes';
import { Draw } from './screens/Draw';
import { Solve } from './screens/Solve';
import { EditCourse } from './screens/EditCourse';
import { Analyse } from './screens/Analyse';
import { Classmates } from './screens/Classmates';
import { Activities } from './screens/Activities';
import { Brief } from './screens/Brief';
import { Essay } from './screens/Essay';
import { Deck } from './screens/Deck';
import { Exam } from './screens/Exam';
import { CheckDates } from './screens/CheckDates';
import { Ahead } from './screens/Ahead';
import { Weekly } from './screens/Weekly';
import { scaleOf, tokensFor } from './lib/look';
import { AccountScreen } from './screens/Account';
import { Cloud } from './screens/Cloud';
import { SlideDeck } from './screens/Slides';
import { datedEvents, datedItems, nextExam } from './lib/select';
import { destination, rootOf } from './lib/nav';
import { DESKTOP, useMedia } from './lib/media';
import { DOW, MONTHS } from './lib/date';
import type { Screen } from './lib/types';

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
    case 'weekly':
      return { kicker: 'What happened, and what is next', title: 'This week' };
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
            fontSize: 23,
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
        <div style={{ display: 'flex', gap: 2, flex: 'none' }}>
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

const TABS: { id: Screen; label: string; Icon: typeof TodayIcon }[] = [
  { id: 'home', label: 'Today', Icon: TodayIcon },
  { id: 'courses', label: 'Courses', Icon: CoursesIcon },
  { id: 'study', label: 'Study', Icon: StudyIcon },
  { id: 'calendar', label: 'Calendar', Icon: CalendarIcon },
  // Seven fits at 402px, and a map is one of the two or three things a person
  // opens the app for while walking. It was two taps down under Calendar.
  { id: 'maps', label: 'Map', Icon: MapIcon },
  { id: 'mine', label: 'Mine', Icon: NotesIcon },
  { id: 'me', label: 'Me', Icon: Person },
];

function TabBar() {
  const { state, dispatch } = useStore();
  const here = rootOf(state.screen);

  return (
    <nav className="safe-bottom app-tabs">
      {TABS.map(({ id, label, Icon }) => {
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
            <Icon size={19} />
            {/* Seven tabs across 402px leaves about 57px each, and "CALENDAR"
                at the old tracking was wider than that — it would have wrapped
                to two lines and made the bar taller on every screen. Tighter
                and a shade smaller keeps real words rather than abbreviating
                them, and nowrap makes a future overflow visible rather than
                silently restacking. */}
            <span
              style={{
                fontSize: 9,
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
    case 'weekly':
      return <Weekly />;
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
  const here = rootOf(state.screen);
  // Taken from the one list of places, so the rail cannot drift out of step
  // with what Me and search know about.
  const extras = ['ask', 'import', 'account', 'connect', 'cloud', 'settings']
    .map((s) => destination(s as Screen))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  return (
    <nav className="rail">
      <div className="rail-mark chrome-text">Semester</div>
      {TABS.map(({ id, label, Icon }) => {
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
            <Icon size={18} />
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
  const { state, dispatch } = useStore();
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
    root.style.fontSize = `${16 * scaleOf(state.textSize)}px`;
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

  if (wide) {
    return (
      <div className="desk">
        <Rail />
        <div className="device device-pane">
          <Header />
          <main className="scrollarea" key={state.screen}>
            <CurrentScreen />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="device">
      <Header />
      <main className="scrollarea" key={state.screen}>
        <CurrentScreen />
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
