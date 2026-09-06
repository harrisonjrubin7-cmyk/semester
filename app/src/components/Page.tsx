import type { ReactNode } from 'react';

/**
 * The frame every screen sits in.
 *
 * Fifty-nine screens each opened with `<div style={{ padding: 18 }}>` and
 * most closed with a hand-written spacer — 22px on some, 26 on others, absent
 * on twelve. That is the whole of the shared layout, repeated by hand, which
 * is why the gap above the tab bar is different depending on where you are.
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
}: {
  /** What this screen is for, in a sentence or two. Under the heading. */
  blurb?: ReactNode;
  /** Buttons belonging to this screen, above its content. */
  actions?: ReactNode;
  children: ReactNode;
  /**
   * Drop the side padding — for a screen that draws to its own edges: a
   * calendar grid, a map, a full-bleed reader.
   */
  wide?: boolean;
  /**
   * Space under the last thing on the screen.
   *
   * Not zero by default. The tab bar floats over the content, so a list that
   * ends flush has its last row half-covered — which is what the hand-written
   * spacers were all working around.
   */
  bottom?: number;
}) {
  return (
    <div style={{ padding: wide ? '0 0 0' : 18 }}>
      {blurb !== undefined && (
        <div
          style={{
            fontSize: 'var(--type-sm)',
            opacity: 0.65,
            lineHeight: 'var(--leading-relaxed)',
            textWrap: 'pretty',
            padding: wide ? '0 18px' : undefined,
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
            marginTop: blurb !== undefined ? 'var(--sp-6)' : 0,
            padding: wide ? '0 18px' : undefined,
          }}
        >
          {actions}
        </div>
      )}
      {children}
      <div style={{ height: bottom }} />
    </div>
  );
}
