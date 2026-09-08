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
import { Search as SearchIcon } from './Icons';
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
 * It is also where a screen's own filter appears when one is asked for — and
 * no longer as a box standing on top of all fifty-nine screens. The header
 * carries a search icon on every screen already, so a field under it was the
 * same tool drawn twice, and on the forty-three screens with nothing of their
 * own to filter it was a field whose only use was to forward what you typed to
 * the icon beside it. The screens that do filter still filter; the field for
 * it arrives when somebody asks. See `search` below and `lib/search.ts`.
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
   * With one, `children` is called with the rows that survived the filter, and
   * the field itself is off screen until somebody asks for it: `/`, or taking
   * the whole-app search's offer to "search “trounstine” in Sources". Without
   * one there is no field here at all — the header's search icon is what a
   * screen that is a form, a report or a player has, and it is enough.
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
  /*
   * Whether the filter field is on screen.
   *
   * Closed to start, on every screen, every time. It opens two ways and both
   * are somebody asking to filter this list: `/`, and arriving here from the
   * whole-app search's "12 sources match" offer, which hands over the query.
   */
  const [open, setOpen] = useState(false);
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
    // With a seed the field has to be visible: a screen that came up showing
    // eleven of forty rows, with nothing on it saying why, is the missing rows
    // unexplained. Without one it stays shut — see `open` above.
    setOpen(Boolean(seed));
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
  /*
   * The caret goes in the field when `/` opened it, and not when a seed did.
   *
   * `App.tsx` moves focus to the new screen's heading on every navigation, so
   * grabbing it back on arrival would talk over the screen's own name for a
   * screen reader and raise a keyboard on a phone — for a filter that has
   * already been applied and needs nothing typed into it. The key is a
   * different matter: somebody pressed it to type.
   */
  const wantsCaret = useRef(false);
  useEffect(() => {
    if (!open || !wantsCaret.current) return;
    wantsCaret.current = false;
    box.current?.focus();
    box.current?.select();
  }, [open]);

  /*
   * Open the field and put the caret in it — the one way in, for both the key
   * and the button, so they cannot drift into two behaviours.
   */
  const reveal = () => {
    wantsCaret.current = true;
    setOpen(true);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => holdBox({ input: box, filters, reveal }), [filters]);

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
            /*
             * The gap under it used to belong to the search field, which sat
             * between the blurb and the screen. With the field gone the blurb
             * ran straight into the first row — so the space it was relying on
             * is now its own. Not when there are `actions`: those carry the
             * same margin on top and two of them read as a missing section.
             */
            marginBottom: actions === undefined ? 'var(--sp-6)' : 0,
            ...side,
          }}
        >
          {blurb}
        </div>
      )}

      {/*
        Only where searching this screen means something, and only once asked
        for. A field that forwards what you typed to the search icon two
        centimetres above it is that icon with extra steps; a field on a screen
        with no list is one that filters nothing. What is left is the case the
        field is actually for: a list of sixty rows, and the one row you want.
      */}
      {/*
        The way in on a phone.

        `/` opens the field on a laptop, and the whole-app search offers to look
        inside a few of these screens — but neither reaches People or Help from
        a phone, and a filter nobody can open is a filter that has been deleted.
        So: one quiet line, on the sixteen screens that have rows of their own,
        rather than a field on all fifty-nine.
      */}
      {search && !open && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: blurb !== undefined && actions !== undefined ? 'var(--sp-6)' : 0,
            ...side,
          }}
        >
          <button
            type="button"
            className="bare tappable tap-y"
            onClick={reveal}
            aria-label={search.placeholder}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-2)',
              width: 'auto',
              flex: 'none',
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--type-xs)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              opacity: 0.55,
            }}
          >
            <SearchIcon size={13} />
            Filter
          </button>
        </div>
      )}

      {search && open && (
        <div
          style={{
            display: 'flex',
            gap: 'var(--sp-3)',
            alignItems: 'center',
            // Only where the blurb is not already holding the gap open: it
            // gives up its bottom margin to `actions`, and on those screens
            // the field between the two has to hold its own.
            marginTop: blurb !== undefined && actions !== undefined ? 'var(--sp-6)' : 0,
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
              // Escape empties it, and empties it again by closing it. Blurring
              // instead would leave the list filtered with the caret gone,
              // which is the state people get stuck in; leaving an empty field
              // on screen would put back the box this pass took away.
              if (e.key === 'Escape') {
                e.preventDefault();
                if (typed) {
                  setTyped('');
                  return;
                }
                setOpen(false);
                return;
              }
              // Enter is still the way out to the whole app when the answer
              // turns out not to be on this screen after all.
              if (e.key === 'Enter' && typed.trim()) {
                e.preventDefault();
                toEverything();
              }
            }}
            placeholder={search.placeholder}
            aria-label={search.placeholder}
            // `flex: 1, minWidth: 0` and not the `.input` default: the class
            // is written for a block field, so inside this row it shrank to the
            // width of the browser's own clear button and the text you had
            // typed was not on screen at all.
            style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 'var(--type-md)' }}
          />
          <button
            type="button"
            className="bare tappable"
            onClick={() => {
              setTyped('');
              setOpen(false);
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
            {typed ? 'CLEAR' : 'DONE'}
          </button>
        </div>
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
