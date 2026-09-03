import { COURSE_BY_ID, GUIDES } from './data/catalog';
import { useStore } from './state/store';
import {
  Bell,
  CalendarIcon,
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
import { Import, Importing, Review } from './screens/Import';
import { Study } from './screens/Study';
import { Guide } from './screens/Guide';
import { Drill, Quiz } from './screens/Drill';
import { Mine, NoteEditor } from './screens/Mine';
import { LessonPlayer } from './screens/Lesson';
import { AddMaterial } from './screens/Update';
import { Connect } from './screens/Connect';
import { Ask } from './screens/Ask';
import { SlideDeck } from './screens/Slides';
import { datedEvents, datedItems, nextExam } from './lib/select';
import { DESKTOP, useMedia } from './lib/media';
import { DOW, MONTHS } from './lib/date';
import type { Screen } from './lib/types';

const ROOTS: Screen[] = ['home', 'courses', 'study', 'calendar', 'mine', 'me'];

/** The kicker and title in the header, per screen. */
function useHeader(): { kicker: string; title: string } {
  const { state, now } = useStore();
  const guide = GUIDES[state.guideId];
  const exam = nextExam(now);

  const today = `${DOW[now.getDay()]} · ${MONTHS[now.getMonth()]} ${now.getDate()}`;

  switch (state.screen) {
    case 'home':
      return { kicker: today, title: state.nav === 'feed' ? 'Everything' : 'Today' };
    case 'courses':
      return { kicker: 'Fall 2026 · 11 credits', title: 'Courses' };
    case 'course':
      return { kicker: 'Course', title: COURSE_BY_ID[state.courseId].code };
    case 'item': {
      const item = datedItems(now).find((i) => i.id === state.itemId);
      return { kicker: item ? COURSE_BY_ID[item.c].code : 'Item', title: item?.kind ?? 'Item' };
    }
    case 'study':
      return {
        kicker: exam ? `${exam.days} days to ${exam.code}` : 'Fall 2026',
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
      return { kicker: 'Vanderbilt · Fall 2026', title: 'Me' };
    case 'search':
      return { kicker: 'Across 4 courses', title: 'Search' };
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
      return { kicker: `${guide.code} · new material`, title: 'Add' };
    case 'connect':
      return { kicker: 'Accounts and calendars', title: 'Connect' };
    case 'ask':
      return { kicker: `${guide.code} · with the guide`, title: 'Ask Claude' };
    case 'slides':
      return { kicker: `${guide.code} · deck`, title: 'Slides' };
    case 'import':
      return { kicker: 'New source', title: 'Import syllabus' };
    case 'importing':
      return { kicker: 'Working', title: 'Import syllabus' };
    case 'review':
      return { kicker: 'Step 2 of 2', title: 'Review' };
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
  const showActions = state.screen === 'home' || state.screen === 'courses';

  return (
    <div
      className="safe-top"
      style={{
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '58px 18px 10px',
        borderBottom: '1px solid var(--app-line)',
        background: 'var(--app-bg)',
      }}
    >
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
        <div
          className="chrome-text"
          style={{
            fontSize: 23,
            lineHeight: 1.15,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
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
          {state.nav === 'feed' && (
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
    </div>
  );
}

const TABS: { id: Screen; label: string; Icon: typeof TodayIcon }[] = [
  { id: 'home', label: 'Today', Icon: TodayIcon },
  { id: 'courses', label: 'Courses', Icon: CoursesIcon },
  { id: 'study', label: 'Study', Icon: StudyIcon },
  { id: 'calendar', label: 'Calendar', Icon: CalendarIcon },
  { id: 'mine', label: 'Mine', Icon: NotesIcon },
  { id: 'me', label: 'Me', Icon: Person },
];

function TabBar() {
  const { state, dispatch } = useStore();

  return (
    <nav
      className="safe-bottom"
      style={{
        flex: 'none',
        display: 'flex',
        borderTop: '1px solid var(--app-line)',
        background: 'var(--app-bg)',
      }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const on = state.screen === id;
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
            <span style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
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
    case 'importing':
      return <Importing />;
    case 'review':
      return <Review />;
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
  const extras: { id: Screen; label: string }[] = [
    { id: 'ask', label: 'Ask Claude' },
    { id: 'connect', label: 'Connect' },
    { id: 'import', label: 'Import' },
  ];

  return (
    <nav className="rail">
      <div className="rail-mark chrome-text">Semester</div>
      {TABS.map(({ id, label, Icon }) => {
        const on = state.screen === id;
        return (
          <button
            key={id}
            type="button"
            className="bare rail-item"
            onClick={() => dispatch({ type: 'go', screen: id })}
            aria-current={on ? 'page' : undefined}
            style={{
              color: on ? 'var(--app-accent)' : 'var(--app-faint)',
              borderLeft: `2px solid ${on ? 'var(--app-accent)' : 'transparent'}`,
            }}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        );
      })}
      <div className="rail-gap" />
      {extras.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className="bare rail-item rail-quiet"
          onClick={() => dispatch({ type: 'go', screen: id })}
          style={{ color: state.screen === id ? 'var(--app-accent)' : 'var(--app-faint)' }}
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

  if (state.screen === 'onboarding') {
    return (
      <div className="device">
        <Onboarding />
      </div>
    );
  }

  const isRoot = ROOTS.includes(state.screen);
  const showTabs = state.nav === 'tabs' && isRoot && !wide;
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
            color: '#0a0b0e',
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
