import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useStore } from '../state/store';
import type { SearchAdapter } from '../lib/search';
import { holdBox, takeSeed } from '../lib/screenbox';

/**
 * Whether we are already inside one of these.
 *
 * A screen's sub-views open with the same wrapper the screen does —
 * `Calendar.tsx` has `DayView`, `WeekView` and `MonthView`, each starting
 * `<div style={{ padding: 18 }}>` — and converting those to `<Page>` puts a
 * frame inside a frame: doubled padding, four search boxes on one screen,
 * and two of them filtering lists nobody can see. It is easy to do, it type
 * checks, and it looks almost right, so it says so instead.
 */
const Inside = createContext(false);

/**
 * The frame every screen sits in.
 *
 * Fifty-nine screens each opened with `<div style={{ padding: 18 }}>` and
 * most closed with a hand-written spacer — 22px on some, 26 on others, absent
 * on twelve. That is the whole of the shared layout, repeated by hand, which
 * is why the gap above the tab bar is different depending on where you are.
 *
 * It is also where the search box lives, so that adding it once puts it on
 * every screen rather than on the eight somebody remembered. See `search`
 * below and `lib/search.ts`.
 *
 * ## What this does not do
 *
 * It does not render a title or a kicker, and it takes no `title` prop.
 *
 * The brief for this pass asked for `<Page title kicker blurb actions>`, on
 * the reasonable assumption that each screen draws its own heading. They do
 * not. `App.tsx` has a real `<header>` that reads the screen's kicker and
 * title out of `useHeader()` and prints the title as the page's `<h1>` —
 * every screen, including the ones nobody has touched in months. A `title`
 * prop here would print a second heading under the first on all fifty-nine.
 * `Clocks.tsx` carries a comment saying exactly that, left by whoever tried
 * it: "No heading here: the app's own header already carries the kicker and
 * the title for every screen, and a second copy read as a bug."
 *
 * So the shell owns the frame and the header keeps the name. A screen that
 * wants a different title changes the registry, which is the one place that
 * decides it — the same rule the Everything screen depends on.
 *
 * ## What it does own
 *
 * The padding, the trailing space above the tab bar, and the blurb: the
 * sentence under the heading that says what a screen is for. Forty-six
 * screens have one and each set its own size and opacity, which is why the
 * same sentence reads as a different weight on different screens.
 *
 * `actions` is the row of buttons that belongs to the screen rather than to
 * the app — Export's "Everything at once", Connect's "Add a feed". The
 * header's own actions (back, search, alerts) are not these and stay there.
 */
export function Page<T>({
  blurb,
  actions,
  search,
  children,
  wide = false,
  bottom = 22,
  className,
  style,
}: {
  /** What this screen is for, in a sentence or two. Under the heading. */
  blurb?: ReactNode;
  /** Buttons belonging to this screen, above its content. */
  actions?: ReactNode;
  /**
   * What searching this screen means. See `lib/search.ts`.
   *
   * With one, the box filters in place and `children` is called with the rows
   * that survived. Without one, the box is still there and what is typed goes
   * to the global search — a screen that is a form, a report or a player has
   * nothing of its own to filter, and a box that pretends otherwise is worse
   * than one that says plainly where it is about to take you.
   */
  search?: SearchAdapter<T>;
  /**
   * The screen's body, or a function of what survived the filter.
   *
   * The second argument is the settled query — empty while nobody is
   * searching. Most screens do not need it: they render `shown` and the
   * frame's own count and empty state say the rest. The Everything directory
   * does, because it is four lists rather than one, and "nothing typed" and
   * "typed something that matched everything" are different screens there.
   */
  children: ReactNode | ((shown: T[], query: string) => ReactNode);
  /**
   * Drop the side padding — for a screen that draws to its own edges: a
   * calendar grid, a map, a full-bleed reader.
   */
  wide?: boolean;
  /**
   * Added to the frame — the escape hatch, and a deliberately small one.
   *
   * Two real cases, not a general passthrough: `prose`, which caps the
   * measure at the reader's "Reading width" setting and is why the guide is
   * readable at all, and a body that has to be a flex column so its children
   * space themselves. Anything else belongs in the screen's own markup.
   */
  className?: string;
  /** For the same two cases. Merged over the frame's padding, never under it. */
  style?: CSSProperties;
  /**
   * Space under the last thing on the screen.
   *
   * Not zero by default. The tab bar floats over the content, so a list that
   * ends flush has its last row half-covered — which is what the hand-written
   * spacers were all working around.
   */
  bottom?: number;
}) {
  const { state, dispatch } = useStore();
  const nested = useContext(Inside);
  if (nested && import.meta.env.DEV) {
    // Not thrown: a warning is enough to find it, and throwing would take
    // out a screen over a layout mistake.
    console.warn(
      '<Page> inside <Page>. A screen has one frame; its sub-views are parts of it, ' +
        'not screens of their own. See the note in components/Page.tsx.',
    );
  }
  const [typed, setTyped] = useState('');
  const [query, setQuery] = useState('');
  const box = useRef<HTMLInputElement>(null);

  /*
   * Two states, one box.
   *
   * `typed` is what is on screen and updates on every keystroke, because a
   * box that lags behind the keyboard is the one thing people will not
   * forgive. `query` is what the list is filtered by and settles 150ms later,
   * so a screen with six hundred rows filters once per pause rather than once
   * per letter.
   */
  useEffect(() => {
    const id = setTimeout(() => setQuery(typed.trim().toLowerCase()), 150);
    return () => clearTimeout(id);
  }, [typed]);

  /*
   * The query does not survive the screen.
   *
   * Leaving a screen filtered and coming back to it later, still filtered,
   * with a box you have to notice before the missing rows make sense, is how
   * a filter becomes a bug report. It is not persisted either — see
   * `finderSeed` in `state/shape.ts` for why a search query is the last thing
   * that should sync between somebody's devices.
   */
  useEffect(() => {
    // Unless the screen you just arrived on was handed one. The whole-app
    // search offers "12 sources match — search in Sources", and arriving on
    // Sources with an empty box would be the offer not kept. See `takeSeed`
    // in `lib/screenbox.ts` for why this is a hand-off and not state.
    const seed = takeSeed();
    setTyped(seed ?? '');
    setQuery(seed ? seed.toLowerCase() : '');
  }, [state.screen]);

  /*
   * `/` reaches the box in front of you rather than the overlay — but this is
   * not where that is decided.
   *
   * It used to be: a `keydown` listener here, alongside the one in `lib/keys.ts`
   * that opens the whole-app search on the same key. Neither stopped the other,
   * so both ran, and what `/` did depended on which listener had been added
   * first — on Grades it opened the overlay *and* navigated, on Courses it left
   * the caret on `<body>`. One key with two owners has no correct behaviour.
   *
   * So the key stays bound in one place, and this hands that place the two
   * things it cannot know: which box is on screen, and whether typing into it
   * filters anything. See `lib/screenbox.ts`.
   */
  // `Boolean(search)` and not `search`: the adapter is a fresh object literal
  // on every render of the screen above, so depending on it would release and
  // re-claim the slot on every keystroke. Whether there is one is the only
  // part that changes.
  const filters = Boolean(search);
  useEffect(() => holdBox({ input: box, filters }), [filters]);

  const all = search?.select();
  const shown = useMemo(
    () => (all && query ? all.filter((item) => search!.match(item, query)) : (all ?? [])),
    // `search` is a fresh object literal on every render of the screen above,
    // so depending on it would defeat the memo entirely. The array and the
    // query are what actually decide the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, query],
  );

  const searching = query.length > 0;
  const nothing = Boolean(search) && searching && shown.length === 0;

  const toEverything = () => dispatch({ type: 'finder', open: true, seed: typed.trim() });

  const side = wide ? { padding: '0 18px' } : undefined;

  return (
    <Inside.Provider value>
    <div className={className} style={{ padding: wide ? '0 0 0' : 18, ...style }}>
      {blurb !== undefined && (
        <div
          style={{
            fontSize: 'var(--type-sm)',
            opacity: 0.65,
            lineHeight: 'var(--leading-relaxed)',
            textWrap: 'pretty',
            ...side,
          }}
        >
          {blurb}
        </div>
      )}

      {/*
        On every screen, adapter or not. That is the point of putting it here
        rather than adding it screen by screen: a box that appears on the
        eight screens somebody got to is a box people learn not to look for.
        Where the screen has nothing of its own to filter, the placeholder
        says so and Enter goes to the whole app.
      */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--sp-3)',
          alignItems: 'center',
          marginTop: blurb !== undefined ? 'var(--sp-6)' : 0,
          ...side,
        }}
      >
        <input
          ref={box}
          className="input"
          type="search"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            // Escape clears rather than blurs. Blurring leaves the list
            // filtered with the box no longer under the cursor, which is
            // the state people get stuck in.
            if (e.key === 'Escape' && typed) {
              e.preventDefault();
              setTyped('');
              return;
            }
            // Enter is the way out to the whole app from anywhere — the only
            // way on a screen with no list of its own, and the second answer
            // on one that has.
            if (e.key === 'Enter' && typed.trim()) {
              e.preventDefault();
              toEverything();
            }
          }}
          placeholder={search ? search.placeholder : 'Search all of Semester'}
          aria-label={search ? search.placeholder : 'Search all of Semester'}
          // `flex: 1, minWidth: 0` and not the `.input` default: the class
          // is written for a block field, so inside this row it shrank to the
          // width of the browser's own clear button and the text you had
          // typed was not on screen at all.
          style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 'var(--type-md)' }}
        />
        {typed && (
          <button
            type="button"
            className="bare tappable"
            onClick={() => {
              setTyped('');
              box.current?.focus();
            }}
            // `width: auto` matters: `.bare` sets `width: 100%` for the rows
            // it was written for, and in a flex line that made this button ask
            // for the whole width and squeeze the field beside it to twenty
            // pixels — with the text you had typed scrolled out of sight.
            style={{
              flex: 'none',
              width: 'auto',
              fontSize: 'var(--type-xs)',
              opacity: 0.6,
              padding: '0 2px',
            }}
          >
            CLEAR
          </button>
        )}
      </div>

      {/* The screen has no list of its own, so there is one place to go and
          the box says so rather than sitting there doing nothing. */}
      {!search && searching && (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={toEverything}
          style={{
            height: 40,
            marginTop: 'var(--sp-4)',
            fontSize: 'var(--type-sm)',
            ...side,
          }}
        >
          Look through the whole app for “{typed.trim()}”
        </button>
      )}

      {actions !== undefined && (
        <div
          style={{
            display: 'flex',
            gap: 'var(--sp-4)',
            flexWrap: 'wrap',
            marginTop: 'var(--sp-6)',
            ...side,
          }}
        >
          {actions}
        </div>
      )}

      {/*
        Counted, because a filtered list that happens to be short looks
        exactly like a screen that has nothing on it. Live, so a screen reader
        hears the count settle rather than nothing at all.
      */}
      {search !== undefined && searching && !nothing && (
        <div
          role="status"
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'var(--type-xs)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            opacity: 0.55,
            marginTop: 'var(--sp-4)',
            ...side,
          }}
        >
          {shown.length} of {all?.length ?? 0}
        </div>
      )}

      {typeof children === 'function' ? children(shown, query) : children}

      {/*
        After the screen, not instead of it.

        Replacing the children on an empty result was the first shape and it
        was wrong: Sources filtered to nothing would have taken the "add a
        source" form away with the list, so the one thing to do about an empty
        list — put something in it — disappeared exactly when it was needed.
        The screen's own `shown.map()` already renders nothing; this says why.
      */}
      {nothing && (
        <div role="status" style={{ marginTop: 'var(--sp-7)', ...side }}>
          <div style={{ fontSize: 'var(--type-md)', lineHeight: 'var(--leading-tight)' }}>
            {search?.empty ? search.empty(query) : `Nothing here matches “${typed.trim()}”.`}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={toEverything}
            style={{
              height: 42,
              marginTop: 'var(--sp-6)',
              fontSize: 'var(--type-sm)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Look through the whole app
          </button>
        </div>
      )}

      <div style={{ height: bottom }} />
    </div>
    </Inside.Provider>
  );
}
