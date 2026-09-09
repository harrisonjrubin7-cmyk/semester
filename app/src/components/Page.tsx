import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { useFolding } from './Fold';

/**
 * Whether we are already inside one of these.
 *
 * A screen's sub-views open with the same wrapper the screen does —
 * `Calendar.tsx` has `DayView`, `WeekView` and `MonthView`, each starting
 * `<div style={{ padding: 18 }}>` — and converting those to `<Page>` puts a
 * frame inside a frame: doubled padding and doubled trailing space, on a
 * screen that reads almost right. It is easy to do and it type checks, so
 * this says so instead.
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
 * There is no searching in here any more, of any kind.
 *
 * It used to own a search field on every screen, then a field the sixteen
 * screens with lists could open, then a line offering to open one. Each pass
 * took away chrome and left the machinery: an adapter per screen, a debounce,
 * a count, an empty state, a module-level slot so `/` could find the field,
 * and a hand-off so the whole-app search could open a screen with its query
 * already applied — all of it to give a second answer to a question the
 * header's search icon answers on every screen. So the whole of it is gone,
 * and searching this app means the one icon. `screens/Me.tsx` has the screen
 * behind it and `components/Command.tsx` the overlay; `lib/find.ts` is what
 * they both look through.
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
export function Page({
  blurb,
  actions,
  children,
  wide = false,
  bottom = 22,
  className,
  style,
  folds = true,
}: {
  /** What this screen is for, in a sentence or two. Under the heading. */
  blurb?: ReactNode;
  /** Buttons belonging to this screen, above its content. */
  actions?: ReactNode;
  /** The screen's body. */
  children: ReactNode;
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
  /**
   * Whether this screen's sections fold.
   *
   * True everywhere, and the exception is meant to stay theoretical: a screen
   * whose headings do not head anything — a reader, a single form — gains a
   * chevron that does nothing useful. Turn it off there rather than growing
   * a rule about which screens are which.
   */
  folds?: boolean;
}) {
  const nested = useContext(Inside);
  if (nested && import.meta.env.DEV) {
    // Not thrown: a warning is enough to find it, and throwing would take
    // out a screen over a layout mistake.
    console.warn(
      '<Page> inside <Page>. A screen has one frame; its sub-views are parts of it, ' +
        'not screens of their own. See the note in components/Page.tsx.',
    );
  }
  /*
   * The gutter is a token, not an 18.
   *
   * A phone's side padding and a desktop's are different numbers — 18 down
   * each side of a 390px screen is right, and the same 18 beside a reading
   * column on a 27-inch monitor is a page that starts at the very edge of its
   * own column. `--page-pad` is that number per layout, set once in
   * `styles/app.css` and read here, which is the only place fifty-seven
   * screens agree on anything about their frame.
   */
  const side = wide ? { padding: '0 var(--page-pad)' } : undefined;

  /*
   * The screen's own sections, found and made foldable on the way past.
   *
   * This is where it happens for the whole app: `children` here is the markup
   * the screen wrote, headings and all, and this is the last place anybody
   * can see it before React does. `components/Fold.tsx` explains what it
   * looks for and why it is a transform rather than three hundred edits.
   */
  const folded = useFolding(children);
  const body = folds ? folded : children;

  return (
    <Inside.Provider value>
    <div className={className} style={{ padding: wide ? '0' : 'var(--page-pad)', ...style }}>
      {blurb !== undefined && (
        <div
          style={{
            fontSize: 'var(--type-sm)',
            opacity: 0.65,
            lineHeight: 'var(--leading-relaxed)',
            textWrap: 'pretty',
            /*
             * The gap under it used to belong to the search field that sat
             * between the blurb and the screen. With the field gone the blurb
             * holds it open itself. Not when there are `actions`: those carry
             * the same margin on top, and two of them read as a missing
             * section rather than as breathing room.
             */
            marginBottom: actions === undefined ? 'var(--sp-6)' : 0,
            ...side,
          }}
        >
          {blurb}
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

      {body}

      <div style={{ height: bottom }} />
    </div>
    </Inside.Provider>
  );
}
