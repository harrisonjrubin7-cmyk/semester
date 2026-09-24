import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNow, useStore } from './state/store';
import { useBottomChrome } from './lib/bottomchrome.hook';
import { currentLook } from './state/shape';
import {
  AppsIcon,
  Bell,
  Check,
  ChevronLeft,
  Plus,
  Search as SearchIcon,
} from './components/Icons';
import { Avatar } from './components/Avatar';
import { Wordmark } from './components/Brand';
import { headerRow } from './lib/header';
import { creditHoursOr0 } from './lib/credits';
import { useSitting } from './lib/sitting.hook';
import { running } from './lib/session';
import { Onboarding } from './screens/Onboarding';
import { Said } from './components/Said';
import { Replaced } from './components/Replaced';
import { SampleMark } from './components/SampleMark';
import { CALM_ATTR, scrollKindly, usePrefersContrast, usePrefersDark } from './lib/prefers';
import { Today } from './screens/Today';
import { Guides, InstitutionalPreviewBar, SCREENS, Springboard } from './screens';
import { headOf, type Head } from './headers';
import {
  calmOf,
  DRAWN_AT,
  ground,
  resolveGround,
  scaleFrom,
  scaleOf,
  tokensFor,
  type Look,
} from './lib/look';

/**
 * Every screen but the first, fetched when it is opened.
 *
 * All sixty used to be imported statically, which put every one of them
 * — and everything they pull in — into one 1,047 kB chunk that had to arrive
 * before anything painted. Nobody opens sixty screens. They open Today.
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
// The call, and everything it drags in — a peer connection, an audio meter,
// the signalling channel. Nobody opening Today should download any of it.
// The Ask tab *is* the conversation. There is one component for it and one
// destination — see the note at the top of `ai/Chat.tsx`.
// The settings pages. Lazy like every other screen: somebody who never opens
// settings should not download the colour picker.
/* The workspace's own two screens — the search home a new tab opens on, and
   the directory of everything behind it. See `lib/desk.ts`. */

import { datedItems, nextExam } from './lib/select';
import { destination, rootOf } from './lib/nav';
import { chromeFor, homeShape } from './lib/chrome';
import { ScreenTrouble } from './components/Boundary';
import { courseFieldFor, insideCourse } from './lib/parent';
import { ShellBody } from './components/shell/ShellBody';
import { isCanvas } from './components/shell/exempt';
import { ShelfNav } from './components/nav/ShelfNav';
import { InstitutionalNavigation } from './components/nav/InstitutionalPrimaryNav';
import { INSTITUTIONAL_PREVIEW } from './lib/institutional-preview';
import { SoftTop } from './components/soft/SoftTop';
import { barFor, litRailTab, litTab, tabLabel } from './lib/tabbar';
import { TabGlyph } from './components/TabIcon';
import { Running } from './components/Running';
import { Keys } from './components/Keys';
import { Sound } from './components/Sound';
import { Ringing } from './components/Ringing';
import { PushTop } from './components/PushTop';
import { QuickAdd } from './components/QuickAdd';
import { Assistant } from './ai/Assistant';
import { Command } from './components/Command';
import { TabStrip, TabsFollow } from './components/Tabs';
import { BookmarksBar } from './components/Bookmarks';
import { AllApps } from './components/nav/AllApps';
import { TopBar } from './components/desk/TopBar';
import { Sidebar } from './components/desk/Sidebar';
import { AppsPanel } from './components/desk/AppsPanel';
import { Customize } from './components/desk/Customize';
import { SuggestingProvider } from './components/desk/suggesting';
import { FocusBarProvider } from './components/desk/barfocus';
import { Undone } from './components/Undone';
import { ScrollArea } from './components/ScrollArea';
import { Tapped } from './components/Tapped';
import { Adopting } from './components/Adopting';
import { Watching } from './components/Watching';
import { forget } from './lib/scrollback';
import { Fresh } from './components/Fresh';
import { useTier } from './lib/media';
import { DOW, MONTHS } from './lib/date';
import { windowTitle } from './a11y/title';
import type { Screen } from './lib/types';
import { InstitutionalPreviewRoot } from './components/institutional/PreviewRoot';

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
    <div style={{ padding: 'var(--page-pad)' }} aria-hidden="true">
      {[62, 30, 96, 96].map((h, i) => (
        <div
          key={i}
          style={{
            height: h,
            marginTop: i === 0 ? 0 : 12,
            borderRadius: 'var(--r-md)',
            background: 'var(--app-hero)',
            color: 'var(--app-dim)',
          }}
        />
      ))}
    </div>
  );
}

/**
 * The way past the chrome, for a keyboard.
 *
 * One component rather than the markup twice: the phone had it and the wide
 * layout did not, which is the failure mode of anything written out in two
 * return statements. `#main` is the `<main>` in `ScrollArea`, which is the
 * same element in both.
 */
function SkipLink() {
  return (
    <a className="skip-link" href="#main">
      Skip to content
    </a>
  );
}

/**
 * The `<title>`, following the screen. Draws nothing.
 *
 * Mounted beside the other draw-nothing components in both layouts, for the
 * reason they are: a title that followed the screen on a phone and not on a
 * laptop would be the harder half of the bug left in. The rule it writes is
 * `a11y/title.ts`, which is pure and tested; this is the effect.
 *
 * It reads `useHeader()` rather than the screen id, so a screen renamed in
 * the header is renamed in the tab with it and there is no second list to
 * keep in step. The title is left alone on unmount: React unmounts the app
 * only when the page is going away, and setting it back to `Semester` on the
 * way out would be the last thing the tab said.
 */
/** The kicker and title in the header, per screen. */
function useHeader(): Head {
  const { state, catalog, school } = useStore();
  const now = useNow();
  const code = catalog.guides[state.guideId]?.code ?? '';

  // These read off the courses actually loaded. They used to say "Fall 2026 ·
  // 11 credits" and "Across 4 courses" to everyone, which is a lie to every
  // user but one, and the kind that quietly says the app is not really yours.
  const n = catalog.courses.length;
  const courseCount = `${n} ${n === 1 ? 'course' : 'courses'}`;
  const credits = catalog.courses.reduce((sum, c) => sum + creditHoursOr0(c.credits), 0);

  return headOf({
    screen: state.screen,
    state,
    catalog,
    school,
    now,
    code,
    about: (what: string) => (code ? `${code} · ${what}` : what),
    exam: nextExam(catalog, now),
    today: `${DOW[now.getDay()]} · ${MONTHS[now.getMonth()]} ${now.getDate()}`,
    courseCount,
    load: credits > 0 ? `${courseCount} · ${credits} credits` : courseCount,
  });
}

function Titled() {
  const { kicker, title } = useHeader();
  const said = windowTitle(title, kicker);
  useEffect(() => {
    document.title = said;
  }, [said]);
  return null;
}

function Header({
  /**
   * Drawn beside chrome that already carries these controls.
   *
   * This was one flag called `slim`, and the list behind it was written
   * against the workspace bar's *tools cluster* — the nine dots, the bell and
   * the avatar — and never checked against the rest of that layout. The bar
   * also draws a permanent search field, and the sidebar draws New, so the
   * header went on repeating both: on Alerts in the workspace you got a
   * magnifier directly under a search box and a `+` directly beside a New
   * button.
   *
   * One fact now rather than a list: is this the workspace, whose bar carries
   * these controls. It was briefly two — the sidebar was the second, because
   * that column drew New and this header's `+` stood down for it. The column
   * no longer draws New, so the `+` is unconditional again; `headerRow` in
   * `lib/header.ts` has that argument. What always stays is what no other
   * chrome has: the way back, the screen's own name, and a running timer.
   */
  desk = false,
}: { desk?: boolean } = {}) {
  const { state, dispatch, catalog } = useStore();
  const now = useNow();
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
  const atRoot = rootOf(state.screen) === state.screen;
  /*
   * The two things the action row's width depends on.
   *
   * `useSitting` rather than a prop: `components/Running.tsx` reads the same
   * hook to decide whether to draw the pill at all, so the row and the rule
   * about the row cannot disagree about whether a timer is counting.
   */
  const phone = useTier() === 'phone';
  const counting = running(useSitting()[0]);
  /*
   * Which of the five the row draws, decided in one place.
   *
   * There was a `const showActions = true` here, with a paragraph explaining
   * that search no longer has a screen to hide on. True, and it had stopped
   * being the question: a constant `true` is not a rule, and while it sat
   * there the five controls under it each carried a condition of their own —
   * which is how two of them came to be drawn on top of the workspace's copy
   * of the same control. `lib/header.ts` answers for all five now, and the
   * markup below asks rather than decides.
   */
  const row = headerRow({ atRoot, phone, counting, desk });

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
          className="btn btn-ghost btn-icon tap"
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
            /* The way up to the course, and the only one on screens opened
               from a deadline. Measured 115×23 — a caps kicker's height, not
               a thumb's. `tap-y`: the header is a row, with the Back button
               and the action icons beside it and nothing tappable above or
               below. */
            className="bare kicker tap-y"
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
            fontSize: 'var(--type-display-lg)',
            lineHeight: 'var(--leading-display)',
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

      {/*
        Always drawn, because the timer pill lives in it and a running timer is
        the one thing in this row that is *counting*. In the wide workspace
        every one of the five icons below is off — the bar and the sidebar have
        them all — so this is the pill's row and nothing else, and it collapses
        to nothing when no timer is going.

        The gap is load-bearing, not taste. `.btn-icon` draws 36px, and the
        `.tap` overlay on each of these grows the *hit* area to 44px — 4px past
        the button on each side. At the 2px gap this row used to have, the
        pitch was 38px and those overlays ran into each other: the later button
        won the overlap, so a thumb landing on the right of Search pressed
        Alerts. Eight puts the pitch at 44 and the overlays exactly meet.
        Tightening this re-breaks the targets without changing anything you can
        see, so `lib/header.test.ts` holds it.
      */}
      <div style={{ display: 'flex', gap: 'var(--sp-4)', flex: 'none', alignItems: 'center' }}>
        {/* Before the icons, because it is the only thing here that is
            counting. Renders nothing at all unless a timer is running. */}
        <Running />
        {/* One line, from anywhere. The alternative to this button is four
            taps through two pickers, which is why nobody adds the thing they
            were told about walking out of a lecture.

            The same thing on every screen it is drawn on, deliberately. It
            briefly opened the importer on the courses list — the + adding what
            the screen lists — and that made the one control whose meaning you
            can rely on into one you have to check. Adding a course has its own
            routes: by name in search, `n`, and the soft layout's bar.

            Off where the workspace's sidebar is drawn, because that column's
            New button is this button, at the top of it. `headerRow` has the
            argument, and the narrow workspace — no sidebar, and no + in the
            bar — is why the question it asks is about the sidebar rather than
            about the workspace. */}
        {row.add && (
          <button
            type="button"
            className="btn btn-ghost btn-icon tap"
            onClick={() => dispatch({ type: 'quickAdd', open: true })}
            aria-label="Add something in one line"
          >
            <Plus size={19} />
          </button>
        )}
        {/*
          The one search, opened over whatever you were reading.

          This used to navigate to a `search` screen that ran the same
          `findEverything` over the same `openHit` and drew the same tagged
          rows as `components/Command.tsx` — one search behind two doors, and
          which one you got depended on the width of your window. `/` opened
          the overlay, and `Keys` is mounted only on the wide layout, so a
          phone could reach the screen and never the overlay.

          The overlay is the one that survives, for the reason its own file
          gives: looking something up should not cost you the page you were
          reading, and a lookup you can abandon is one people actually make.
          The screen it replaced could only be left by going back.

          And the same argument, a second time, against this magnifier: in the
          workspace the palette is already behind a search field drawn across
          the whole top of the window, at every width, on every screen. Two
          doors again — one of them a box you can type into and one of them an
          icon one row below it — so the icon goes and the box stays, which is
          the direction the first paragraph settled. `/` and ⌘K are unchanged.
        */}
        {row.search && (
          <button
            type="button"
            className="btn btn-ghost btn-icon tap"
            onClick={() => dispatch({ type: 'finder', open: true })}
            aria-label="Search everything"
            aria-keyshortcuts="/"
          >
            <SearchIcon size={19} />
          </button>
        )}
          {/*
            All apps: the nine squares, and the other half of the button
            beside it.

            Search finds a screen if you can name it. Half the app's fifty-odd
            screens are things somebody has seen once — the practice paper,
            the deck builder, the diagram drawer — and "the thing that makes
            flashcards" is not a word you can type. This is the answer to
            that: every screen there is, drawn as its own icon under its own
            shelf, in the order the tiles were arranged.

            The two sit together deliberately, and this one is second: naming
            a thing is faster when you can, so the control that takes a name
            comes first.

            On every screen, with no `atRoot` gate — the whole point is the
            screen you are three levels into, where the directory on Progress
            is four taps and a lost place away. See `components/nav/AllApps.tsx`.

            What it costs, measured rather than guessed: a fourth icon takes
            44px off the title at 390px, and two of the app's fifty titles
            that used to fit now end in an ellipsis — "A change to a date" by
            17px and "Timers and alarms" by 9. The header has always
            truncated, so this is two more titles over a line rather than a
            new kind of failure, and the row's tap targets still measure 44
            and still do not overlap. `lib/header.test.ts` holds the second
            half of that.
          */}
        {row.apps && (
          <button
            type="button"
            className="btn btn-ghost btn-icon tap"
            onClick={() => dispatch({ type: 'apps', open: true })}
            aria-label="All apps"
            aria-haspopup="dialog"
            aria-expanded={state.apps}
          >
            <AppsIcon size={19} />
          </button>
        )}
        {row.alerts && (
          <button
            type="button"
            className="btn btn-ghost btn-icon tap"
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
        {/*
            You, last in the row, on every navigation.

            This was the feed layout's own button and it went to Progress — a
            person glyph opening a report, because there was no screen it could
            honestly open. There is one now, and the button is the thing every
            phone puts at this exact corner: your picture, opening you.

            When it is drawn is `lib/header.ts`, measured rather than
            guessed: at a root, on a phone only while the timer pill is not
            also in the row, and never in the workspace, whose bar draws this
            same avatar across the top of the window. Six controls and an 83px pill do not fit across
            320px — the row was overflowing and clipping this very button — and
            the avatar is the one of the six with another route from a root
            screen, through the Progress tab, the All apps grid and the search
            beside it. That file has the measurement and the argument.

            The label carries the name when there is one. A screen reader
            saying "Profile, Harrison" is the same information the letters in
            the box carry, and "HR" read out as letters is not.
          */}
        {row.avatar && (
          <button
            type="button"
            className="btn btn-ghost btn-icon tap"
            onClick={() => dispatch({ type: 'go', screen: 'profile' })}
            aria-label={state.myName.trim() ? `Profile — ${state.myName.trim()}` : 'Profile'}
          >
            <Avatar name={state.myName} size={22} />
          </button>
        )}
      </div>
    </header>
  );
}

function TabBar() {
  const { state, dispatch, school } = useStore();
  const bar = useRef<HTMLElement>(null);
  useBottomChrome(bar);
  // The seven that shipped are still the default; this is whichever seven the
  // student arranged, minus anything the school or the role has since taken
  // off the table — see `barFor`. `litTab` rather than `rootOf` because a
  // chosen bar can hold a screen and the tab it files under at the same time.
  const tabs = barFor(state.tabs, school.capabilities, state.role);
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
                scrollKindly(document.querySelector('.scrollarea'), { top: 0 });
                return;
              }
              dispatch({ type: 'go', screen: id });
            }}
            aria-current={on ? 'page' : undefined}
            style={{
              flex: 1,
              borderTop: `2px solid ${on ? 'var(--app-accent)' : 'transparent'}`,
              paddingTop: 'calc(9px * var(--density, 1))', paddingInline: '0', paddingBottom: 'calc(4px * var(--density, 1))',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'calc(3px * var(--density, 1))',
              /*
               * The tab that is not current still names a destination, so it
               * is text and takes `--app-dim`. At `--app-faint` — the
               * hairline strength, held to 3:1 — "Courses" read 3.64:1 on Ink
               * and 2.98:1 on Parchment, which made the six places you are
               * not the hardest words on the screen to read.
               */
              color: on ? 'var(--app-accent)' : 'var(--app-dim)',
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
                  fontSize: 'var(--type-3xs)',
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
  /*
   * Home first, because it is the one screen whose component is a function of
   * the navigation rather than of `state.screen`.
   *
   * The springboard is a way in rather than a different app: every icon goes
   * to the same screen the tab bar would have. `Today` reads the same
   * `homeShape` to decide between its two readings of the day, so the three
   * cannot disagree. The workspace is deliberately not a case — its home is
   * Today like everyone else's, and what it does differently is where the app
   * *lands*, which is `firstScreen` in `lib/chrome.ts`. The guides are the one
   * home that is not a reading of the day at all: the courses themselves,
   * because opening one is what that navigation is for.
   */
  if (state.screen === 'home') {
    switch (homeShape(state.nav)) {
      case 'springboard':
        return <Springboard />;
      case 'guides':
        return <Guides />;
      default:
        return <Today />;
    }
  }
  /*
   * And everything else by lookup rather than by eighty cases.
   *
   * `onboarding` never reaches here — it is drawn above the router — so the
   * table does not carry it and this narrows past it. The switch this replaced
   * ended `default: return <Today />`, which meant a screen added to the union
   * and forgotten rendered Today with nothing failing anywhere. `SCREENS` is
   * exhaustive over the union, so that mistake is a type error now. See
   * `screens.tsx`.
   */
  // `?? Today` for the same reason `headOf` has a fallback, and for that
  // reason only: `state.screen` can hold a name that was never in the union —
  // `fromHash` passes an unknown one through, so a bookmark to a deleted
  // screen arrives as `{ screen: 'cloud' }`. A screen that *is* in the union
  // and missing from `SCREENS` remains a build error; this catches the string
  // that is not a screen at all, which used to land on Today and does again.
  const Screen = SCREENS[state.screen as Exclude<typeof state.screen, 'home' | 'onboarding'>] ?? Today;
  return <Screen />;
}

/**
 * The workspace: tabs across the top, one search bar under them, and — where
 * there is room — a column of shortcuts down the side.
 *
 * The third layout in this file rather than a fourth condition inside the
 * other two, and for the reason `lib/chrome.ts` gives at length: the chrome
 * here is at the *top* of the window, so nothing about the phone layout's
 * bottom bar or the desktop layout's rail applies to it. Trying to express it
 * as flags on those would be two layouts wearing a third.
 *
 * ## What is the same as the other two, deliberately
 *
 * Everything inside the pane. The header, the change strip, the sample
 * banner, the save-trouble banner, the scroller, the error boundary, the
 * shell body and the screen itself are the same elements in the same order —
 * so a screen is one screen, drawn in a different frame, rather than a second
 * implementation that will drift. The overlays are the same objects too: the
 * command palette, the capture box, the undo toast and the assistant are the
 * ones the other layouts open. The three that cover the window hang off this
 * layout's root rather than off its pane, which is a place and not a
 * difference in what they are — see the note over them below.
 *
 * Two things are this layout's own: the launcher is a panel hanging off the
 * nine dots rather than a sheet over the window (`AppsPanel`), and Customize
 * Semester exists at all.
 *
 * ## The header goes away on the shell's own two screens
 *
 * The search home is a wordmark and a field, and the directory opens with
 * "Welcome to Semester". A chrome header saying "the search home" above
 * either is the app narrating itself — the one place a title adds nothing,
 * because the screen is already its own title.
 */
function Workspace({
  chrome,
  trouble,
}: {
  chrome: ReturnType<typeof chromeFor>;
  trouble: React.ReactNode;
}) {
  const { state, dispatch, asking, settle } = useStore();
  const tier = useTier();
  /*
   * Whether the bar's suggestions are down, held here because two children
   * need the answer and neither is the other's parent — the bar raises it and
   * the search home hides its centre for it. See `components/desk/suggesting.ts`.
   */
  const [suggesting, setSuggesting] = useState(false);
  // Stable, or the effect in `TopBar` that reports the state would re-run on
  // every render of this component and report it again.
  const onSuggesting = useCallback((open: boolean) => setSuggesting(open), []);
  /*
   * The bar's search field, held here so the search home's centre box can put
   * the cursor in it.
   *
   * The same shape as `suggesting` above and for the same reason: the bar and
   * the screen are siblings, so anything that passes between them passes
   * through here. See `components/desk/barfocus.ts` for why the centre box
   * focuses this field rather than opening a search of its own.
   */
  const barBox = useRef<HTMLInputElement>(null);
  const focusBar = useCallback(() => barBox.current?.focus(), []);
  /** The shell's own two screens, which are their own titles. See above. */
  const ownTitle = state.screen === 'search' || state.screen === 'directory';

  return (
    <SuggestingProvider value={suggesting}>
      <FocusBarProvider value={focusBar}>
      {/*
        `.device` as well as `.deskwork`, and it is load-bearing rather than
        tidy. Every control primitive in `app.css` is scoped `.device .btn`,
        `.device .input`, `.device .bare` — so a tab strip or a search bar
        mounted outside it is the one part of the app not drawn in the app's
        own materials, which is exactly what happened to the assistant panel
        before its own note was written. `.deskwork` undoes the two things
        `.device` says that are about being a phone: the 402px cap and the
        column. Portals that look for `.device` find this, and it is
        positioned, so they land over the whole workspace.
      */}
      <div className="device deskwork" data-tier={tier} data-semester-root>
        <SkipLink />
        <Titled />
        <Fresh />
        <Keys />
        <Ringing />
        <PushTop />
        <Tapped />
        <Watching />
        {/* The one question a first sign-in asks, on this layout too. */}
        {asking && <Adopting sides={asking.sides} say={asking.say} onChoose={settle} />}
        <TabsFollow />
        {/* Always drawn here, from the first tab — unlike the other two
            layouts, where it earns its forty pixels only once there is
            somewhere to switch to. In a workspace the strip is the
            navigation's top edge: a bar that appeared on the second tab would
            push the whole app down a row the first time you opened one. */}
        <TabStrip alwaysOn onBlank={() => dispatch({ type: 'go', screen: 'search' })} />
        <TopBar onSuggesting={onSuggesting} boxRef={barBox} />
        {/* And the bookmarks under the field, which is where the browser this
            layout is shaped like keeps them. It draws nothing at all until
            something has been starred. */}
        <BookmarksBar />
        <InstitutionalNavigation />

        <div className={chrome.sidebar && !INSTITUTIONAL_PREVIEW ? 'deskwork-body' : 'deskwork-body deskwork-one'}>
          {chrome.sidebar && !INSTITUTIONAL_PREVIEW && <Sidebar />}
          <div
            className={
              isCanvas(state.screen)
                ? 'device-pane deskwork-pane has-canvas'
                : 'device-pane deskwork-pane'
            }
          >
            {!ownTitle && <Header desk />}
            <Said />
            {/* The sample banner belongs over records, which is what it is
                about. The search home says the same thing in its own foot
                line — "Sample semester · 4 courses" — so the labelling is
                kept where the reference keeps it rather than dropped, and the
                front door is not a banner and a wordmark. */}
            {!ownTitle && <SampleMark />}
            <Replaced />
            <Undone />
            {trouble}
            <ScrollArea screen={state.screen} key={state.screen}>
              <SoftTop />
              <Suspense fallback={<Loading />}>
                <ScreenTrouble
                  key={state.screen}
                  onLeave={() => dispatch({ type: 'go', screen: 'search' })}
                >
                  <ShellBody screen={state.screen}>
                    <CurrentScreen />
                  </ShellBody>
                </ScreenTrouble>
              </Suspense>
            </ScrollArea>
          </div>
        </div>

        {/*
          The three that cover the window: beside the body, not inside the pane.

          They are mounted in the pane on both other layouts, for the reason
          written over them there — `.device .input`, `.device .btn` and
          `.device .bare` are where this app's controls are drawn, and an
          overlay outside `.device` is the one part of the app not drawn in
          the app's own materials. That reason is satisfied here by the root
          itself: the workspace's outer box *is* `.device`, so a child of it
          is inside that scope wherever it sits in this subtree.

          What is not satisfied inside the pane is the stacking. This layout
          is the only one with chrome painted over the body — `.deskwork >
          .deskstrip` at 21 and `.desktop-bar` at 20, so the bar's
          suggestions are not covered by the pane the moment they open — and
          `.device > *` puts every direct child, the body included, at 1. An
          overlay in the pane is inside that 1: its own `z-index: 80` is
          spent against its siblings and cannot lift its parent, so the tab
          strip and the search bar painted straight over the top of it. The
          capture box lost its field and its Close button to them — you
          pressed +, saw the explanation with nothing to type into, and a
          click where the field should be landed in the bar's search box
          instead — and the palette opened under the bar with two search
          fields on screen at once.

          Out here each one is a sibling of those strips rather than a
          grandchild of the body, so the number it already carries is
          compared with theirs and wins. Nothing else changes: all three are
          `position: fixed` above 1180px and laid out against the window
          wherever they are mounted.
        */}
        <Assistant />
        {state.finder && <Command onClose={() => dispatch({ type: 'finder', open: false })} />}
        {state.quickAdd && <QuickAdd onClose={() => dispatch({ type: 'quickAdd', open: false })} />}
        {/* The launcher and Customize, last so they stack over the body
            without a z-index of their own to keep in step with anything. */}
        {state.apps && <AppsPanel onClose={() => dispatch({ type: 'apps', open: false })} />}
        {state.customize && (
          <Customize onClose={() => dispatch({ type: 'customize', open: false })} />
        )}
      </div>
      </FocusBarProvider>
    </SuggestingProvider>
  );
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
  const { state, dispatch, school } = useStore();
  // Through the same gate as the bar: the rail is the same list on a wider
  // screen, and a screen hidden from this role must not survive by being on
  // a laptop.
  const tabs = barFor(state.tabs, school.capabilities, state.role);
  // The rail keeps its labels whatever the tab bar does: it is a wide-screen
  // sidebar with room for words, and the setting exists to buy height back on
  // a phone, which the rail is not on.
  // Taken from the one list of places, so the rail cannot drift out of step
  // with what Me and search know about.
  const extras = ['ask', 'import', 'account', 'connect', 'settings']
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
      <Wordmark className="rail-mark" />
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
                scrollKindly(document.querySelector('.scrollarea'), { top: 0 });
                return;
              }
              dispatch({ type: 'go', screen: id });
            }}
            aria-current={on ? 'page' : undefined}
            style={{
              // The rail is the tab bar's wide-screen counterpart and its
              // labels are the same words, so they take the same strength —
              // `--app-dim`, not the hairline one. Measured at `--app-faint`:
              // 3.64:1 on Ink, 2.98:1 on Parchment.
              color: on ? 'var(--app-accent-bright)' : 'var(--app-dim)',
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
              // The rail is the tab bar's wide-screen counterpart and its
              // labels are the same words, so they take the same strength —
              // `--app-dim`, not the hairline one. Measured at `--app-faint`:
              // 3.64:1 on Ink, 2.98:1 on Parchment.
              color: on ? 'var(--app-accent-bright)' : 'var(--app-dim)',
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
  if (INSTITUTIONAL_PREVIEW) {
    return (
      <InstitutionalPreviewRoot>
        <AppFrame />
      </InstitutionalPreviewRoot>
    );
  }
  return <AppFrame />;
}

function AppFrame() {
  const { state, dispatch, saveTrouble, asking, settle } = useStore();
  /*
   * Which of the three layouts this window is in — see `lib/media.ts`.
   *
   * `wide` is the old question ("is there room for the rail?") and is still
   * what the chrome rule asks, because a tablet and a desktop answer it the
   * same way. The tier itself goes onto the layout's root element as
   * `data-tier`, so anything that needs to know which of the two wide layouts
   * it is in can ask the DOM rather than re-running a media query of its own,
   * and so a screenshot of a bug says which layout it was taken in.
   */
  const tier = useTier();
  const wide = tier !== 'phone';
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
    /*
     * A percentage of the font size the browser was already using, not a
     * pixel count of our own.
     *
     * `${16 * scale}px` did not ignore somebody's browser font size — it
     * overwrote it. Driven against Chromium with its default raised from 16
     * to 24, the app came out pixel for pixel identical: root forced back to
     * 16, body text 12px either way. Raising the default font size is how a
     * great many people with low vision read the web, more often than zoom,
     * and this app was the one that undid it.
     *
     * A percentage multiplies what was inherited instead of replacing it, so
     * 24px at Largest is 28.3 rather than 18.9.
     */
    root.style.fontSize = `${scale * 100}%`;
    /*
     * And the px sizes follow it.
     *
     * The root font size only reaches what is written in `rem`, and this app
     * writes `fontSize: 14` inline, in px, in about twelve hundred places —
     * so on its own the line above would move the handful of sizes that come
     * from the stylesheet and leave every screen the same. Rewriting twelve
     * hundred sites as rem would rewrite twelve hundred layouts; reading back
     * what the percentage actually produced and multiplying it through the
     * one variable they all share moves the type and nothing else.
     *
     * Read rather than computed, because the percentage resolves against the
     * browser's setting, which is the number this needs and cannot know.
     */
    const rootPx = parseFloat(getComputedStyle(root).fontSize) || DRAWN_AT * scale;
    root.style.setProperty('--text-scale', String(scaleFrom(rootPx)));
    // The browser paints its own chrome — the scrollbar, the overscroll edge,
    // form controls — from this, and a light theme with a dark scrollbar is
    // the tell that a theme was only half done.
    //
    // Read from the ground itself rather than from a hardcoded name: it said
    // `=== 'parchment'`, so Paper and Fog — both light — got a dark scrollbar
    // and a dark overscroll edge.
    root.style.colorScheme = ground(JSON.parse(lookKey).ground).light ? 'light' : 'dark';

    /*
     * How much the app may move and decorate itself, as one attribute.
     *
     * An attribute rather than a custom property because both readers need it
     * and only one of them can read a variable: `styles/app.css` selects on
     * `[data-calm="calm"]`, and `lib/prefers.ts` reads it with
     * `getAttribute` from plain functions that have no hooks in scope. A
     * custom property would have served the stylesheet and left `scrollKindly`
     * with no way to ask.
     */
    root.setAttribute(CALM_ATTR, calmOf((JSON.parse(lookKey) as Look).calm));

    /*
     * And the other half of the browser's chrome.
     *
     * `theme-color` is what paints the title bar of an installed window and
     * the bar behind the status text on Android — and it was a fixed
     * `#0a0b0e` in `index.html`, chosen when every ground was dark. There are
     * five light ones now, so Paper, Parchment, Bone, Industry and Fog each
     * installed as a white app under a near-black bar. Exactly the fault the
     * comment above is about, in the one place that is markup rather than a
     * style property.
     *
     * `--app-void` rather than `--app-bg`: void is what `body` actually
     * paints, so the bar matches the pixel beside it instead of the panel
     * colour a shade off it.
     */
    const painted = getComputedStyle(root).getPropertyValue('--app-void').trim();
    if (painted) {
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', painted);
    }
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
        paddingTop: 'calc(10px * var(--density, 1))', paddingInline: 'calc(18px * var(--density, 1))', paddingBottom: 'calc(11px * var(--density, 1))',
        background: 'var(--app-warn-wash)',
        borderBottom: '1px solid var(--app-warn-line)',
        color: 'var(--app-fg)',
        fontSize: 'var(--type-sm-plus)',
        lineHeight: 'var(--leading-normal)',
        textWrap: 'pretty',
      }}
    >
      {saveTrouble}
    </div>
  ) : null;

  /*
   * The workspace, at every width.
   *
   * Before the `wide` branch rather than inside it: this layout is not the
   * desktop one with a different navigation bolted on, it is its own frame —
   * chrome at the top, the sidebar where there is room — and `chromeFor` has
   * already decided which. See `Workspace` above.
   */
  /*
   * The layouts, and the one thing that must not be inside any of them.
   *
   * `Sound` holds the app's only `<audio>` element and is mounted here,
   * outside the three frames below, because *which* frame renders is not
   * fixed for a session: `chromeFor` reads the screen, so opening a new tab
   * can move the app from the workspace frame to the wide one. A component
   * mounted in each of them is unmounted and remounted by that move — which
   * is exactly what an element holding forty minutes of narration must never
   * do, and what it was mounted high up to avoid in the first place.
   *
   * Measured before it was moved: pressing Play and then opening a tab
   * replaced the element and the lesson started again from zero, paused. The
   * element survived the tab *switch* it was written for and died on the
   * frame change nobody had thought about. Here it survives both.
   */
  const frame = () => {
    if (chrome.desk) return <Workspace chrome={chrome} trouble={trouble} />;
    return wide ? wideFrame() : phoneFrame();
  };
  return (
    <>
      <Sound />
      {frame()}
      {INSTITUTIONAL_PREVIEW && (
        <Suspense fallback={null}>
          <InstitutionalPreviewBar />
        </Suspense>
      )}
    </>
  );

  function wideFrame() {
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
      <div className={chrome.rail && !INSTITUTIONAL_PREVIEW ? 'desk' : 'desk desk-one'} data-tier={tier} data-semester-root>
        {/* First in the tree, so it is the first tab stop. See the note in
            the phone layout below. */}
        <SkipLink />
        <Titled />
        <Fresh />
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
        {/* The one question a first sign-in asks, and only when it is real. */}
        {asking && <Adopting sides={asking.sides} say={asking.say} onChoose={settle} />}
        {chrome.rail && !INSTITUTIONAL_PREVIEW && <Rail />}
        {/* `has-canvas` widens the header's gutter to match a screen whose
            body is a grid rather than a column — see `.pane-body.is-canvas`
            in `styles/app.css`. Both answers come from the same list in
            `shell/exempt.ts`, so the header and the body cannot disagree
            about which one this screen is. */}
        <div className={isCanvas(state.screen) ? 'device device-pane has-canvas' : 'device device-pane'}>
          {/*
            One assistant, in the shell rather than on a screen — but inside
            the pane, not beside it.

            Every control primitive in `app.css` is scoped `.device .btn`,
            `.device .input`, `.device .bare`. Mounted as a sibling of the pane
            the panel was outside all of them, so on a wide window its
            suggestion chips had no border and its composer was a white browser
            textarea with a blue focus ring — the one place in the app that did
            not look like the app. Nothing else changes: the panel and the
            button are `position: fixed`, so they are laid out against the
            viewport wherever they are mounted, and the pane's `overflow:
            hidden` does not reach them.
          */}
          <Assistant />
          {/*
            The whole-app search, inside the pane for the same reason the
            assistant is: `.device .input`, `.device .tag` and `.device .bare`
            are where this app's controls are drawn, and beside the pane it
            reached none of them. Its field was a white browser textbox with a
            blue focus ring and its course tags were pale rectangles — on the
            one overlay whose entire content is a field and a list of tagged
            rows. What it covers is decided in the component, which is not the
            same box on both layouts — see the note on its own `position` in
            `components/Command.tsx`.
          */}
          {state.finder && <Command onClose={() => dispatch({ type: 'finder', open: false })} />}
          {/* And the launcher, which is inside the pane because `TileSheet`
              portals it into `.device` regardless — mounted here so the two
              overlays are read in one place rather than found separately. */}
          {state.apps && <AllApps onClose={() => dispatch({ type: 'apps', open: false })} />}
          {/* And the piece that keeps the tab strip honest: a tab records the
              place you navigated to, however you got there — from the strip,
              the tab bar, a link in an answer, or the browser's own Back. See
              `components/Tabs.tsx`. */}
          <TabsFollow />
          {/* And the capture box, for the same reason and with the same
              answer: its one field was a white browser textbox out here, and
              with nothing capping it its explanation ran the full width of a
              laptop in a single line. See its own `position`. */}
          {state.quickAdd && <QuickAdd onClose={() => dispatch({ type: 'quickAdd', open: false })} />}
          {/*
            The tabs, on the window rather than only inside the search
            overlay.

            This is what makes them worth having: the places you have open
            are one click away from wherever you are, with nothing opened and
            nothing dismissed on the way. It draws itself from the second tab
            onwards — a row of chrome that can never do anything is a row
            people learn to look past — and it is above the header because a
            strip that sat under the title of the screen it switches would
            read as part of that screen.

            The phone reaches the same strip through the search overlay.
            Forty pixels of permanent chrome is a different trade on a screen
            that is 800 tall and mostly thumb.
          */}
          <TabStrip />
          <Header />
          {/* Under the header, not above it: the change strip covers the
              screen's own name otherwise, and "moved to Friday" means a
              different thing on Calendar than it does on Today. Inside the
              pane rather than beside it for the same reason `SampleMark` is —
              `.desk` is a two-column grid and a bare child takes the rail's
              column. */}
          <Said />
          {/* Under the header rather than above it, and inside the pane rather
              than beside it: `.desk` is a two-column grid, and a bare element
              at its root takes the rail's column. */}
          <SampleMark />
          {/*
            The sync banner and the undo toast, in the pane for that same
            reason — and they were the two that were still outside it.

            `Replaced` is an ordinary block in the flow, so as a child of
            `.desk` it was a grid item: it took the rail's column, pushed the
            rail into the second one and the whole pane onto a second row.
            Every launch after a sync from another device therefore opened on
            a window with the navigation across the top right, the banner in a
            column of its own, and the feed folded into the bottom-left
            corner — which is what people were seeing instead of the app.

            `Undone` never broke the grid, since an absolutely positioned
            child is not a grid item, but it had no positioned ancestor out
            there and so measured its `left: 12` and `right: 12` against the
            whole window rather than the pane. In here `.device-pane` is
            `position: relative` and the toast lands over the content it is
            about, on both layouts.
          */}
          <Replaced />
          <Undone />
          {trouble}
          <InstitutionalNavigation />
          {!INSTITUTIONAL_PREVIEW && chrome.shelves && <ShelfNav />}
          <ScrollArea screen={state.screen} key={state.screen}>
            <SoftTop />
            <Suspense fallback={<Loading />}>
              {/* Keyed on the screen so moving on clears a failure. Inside
                  the chrome, so a screen that falls over leaves you
                  somewhere you can leave from. See `Boundary.tsx`. */}
              <ScreenTrouble key={state.screen} onLeave={() => dispatch({ type: 'go', screen: 'home' })}>
                <ShellBody screen={state.screen}>
                  <CurrentScreen />
                </ShellBody>
              </ScreenTrouble>
            </Suspense>
          </ScrollArea>
        </div>
      </div>
    );
  }

  function phoneFrame() {
  return (
    <div className="device" data-tier={tier} data-semester-root>
      {/*
        The first focusable thing on the page, and invisible until it has
        focus. With sixty screens behind a header and a tab bar, a keyboard
        user's only route into the content was to tab through the whole of
        both, on every screen, every time.

        In both layouts, which it was not: this was in the phone's return
        statement only, so the wide one — a laptop, where a keyboard is the
        primary input rather than an accessibility route — had no skip link
        at all. Tabbing into a screen there meant eleven stops through the
        rail and the header first, every time, which is exactly the problem
        this element exists to solve.
      */}
      <SkipLink />
      <Titled />
      <Fresh />
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
      {/* The launcher, on this layout too. See the wide layout's copy. */}
      {state.apps && <AllApps onClose={() => dispatch({ type: 'apps', open: false })} />}
      {/* And the follower, on this layout too. See the wide layout's copy. */}
      <TabsFollow />
      {/*
        The tabs on this layout too, from the second one onwards.

        A phone has no room for permanent chrome, and this is not permanent:
        with one tab open it is not drawn at all. It appears the moment there
        is somewhere to switch to — which is the point at which a row of tabs
        is worth forty pixels, and the moment a result opened from search
        stops being a place you could only get back to by searching for it
        again.
      */}
      <TabStrip />
      <Header />
      {/* Under the header. See the note at the wide layout's copy. */}
      <Said />
      <SampleMark />
      {trouble}
      <InstitutionalNavigation />
      {!INSTITUTIONAL_PREVIEW && chrome.shelves && <ShelfNav />}
      <ScrollArea screen={state.screen} key={state.screen}>
        <SoftTop />
        <Suspense fallback={<Loading />}>
          {/* The same boundary as the wide layout above. Both, or a screen
              that fails on a phone still takes the whole app with it. */}
          <ScreenTrouble key={state.screen} onLeave={() => dispatch({ type: 'go', screen: 'home' })}>
            <ShellBody screen={state.screen}>
              <CurrentScreen />
            </ShellBody>
          </ScreenTrouble>
        </Suspense>
      </ScrollArea>
      {!INSTITUTIONAL_PREVIEW && chrome.tabs && <TabBar />}
    </div>
  );
  }
}

/** Re-exported so screens can render a tick without importing the icon set. */
export { Check };
