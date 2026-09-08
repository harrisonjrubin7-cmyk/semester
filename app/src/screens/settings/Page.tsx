import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HIGHLIGHT_MS, sectionOf, takeLooking } from '../../lib/settings';
import type { Screen } from '../../lib/types';

/**
 * The shell every settings page sits in.
 *
 * Three things, and each of them is the kind that gets forgotten once per
 * page rather than once per app if it is not written down here.
 *
 * **Focus lands on the heading.** Pushing a page moves what is on screen and
 * nothing else; a screen reader stays where it was and reads the old page. The
 * heading takes `tabIndex={-1}` and is focused on arrival, so the first thing
 * announced is where you now are.
 *
 * **The group search was after lights up.** The word that matched travels from
 * the index in `lib/settings.ts`, and is taken here — read once, then gone.
 * The light fades after a couple of seconds because it is an answer to a
 * question already asked, not a state.
 *
 * **It is a `<main>`.** The index is a `<nav>`. Together those are what let
 * somebody skip straight to the controls instead of through the list that got
 * them here.
 */
export function SettingsPage({
  screen,
  title,
  blurb,
  children,
}: {
  screen: Screen;
  title: string;
  blurb?: string;
  children: (lit: string) => ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Taken during the first render rather than in an effect, so the group is
  // already lit on the frame the page appears on instead of flashing plain
  // and then highlighting.
  const [lit, setLit] = useState(takeLooking);

  useEffect(() => {
    heading.current?.focus();
    if (!lit) return;
    const id = setTimeout(() => setLit(''), HIGHLIGHT_MS);
    return () => clearTimeout(id);
    // Once, on arrival. The light is an answer to a question already asked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    /*
     * Drawn in whichever layout the app is set to, like every other screen.
     *
     * This used to force `grouped` on itself, whatever anybody had chosen.
     * The argument was that an index is findable because every row looks like
     * every other row — which is true, and is a fact about the row primitives
     * rather than about the grouped layout: `ItemRow`, `NavRow`, `ToggleRow`
     * and the rest are the same rows in all three, and every one of them
     * already knows how to draw itself in each.
     *
     * What forcing it actually bought was a settings screen that did not look
     * like the app it configured. Somebody who chose the drawn layout and
     * opened Settings to change something about the drawn layout was looking
     * at the grouped one, on the very screen where the choice is made and the
     * previews are drawn. One layout, everywhere, including here.
     */
    <main style={{ paddingBottom: 'calc(24px * var(--density, 1))' }}>
      <div style={{ padding: '0 16px calc(12px * var(--density, 1))' }}>
        <div
          style={{
            fontSize: 'calc(10.5px * var(--text-scale, 1))',
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            opacity: 0.45,
          }}
        >
          {sectionOf(screen) || 'Settings'}
        </div>
        <h1
          ref={heading}
          tabIndex={-1}
          style={{
            margin: '4px 0 0',
            fontSize: 'calc(21px * var(--text-scale, 1))',
            fontFamily: 'var(--font-heading)',
            fontWeight: 'var(--font-heading-weight)' as never,
            lineHeight: 1.2,
            // No ring. The app's focus style is right for something somebody
            // tabbed to; this is a landing point moved to on arrival, is not
            // in the tab order, and drawn around a heading the ring reads as
            // an empty text field. A screen reader still announces it.
            outline: 'none',
            boxShadow: 'none',
          }}
        >
          {title}
        </h1>
        {blurb ? (
          <p
            style={{
              margin: 'calc(7px * var(--density, 1)) 0 0',
              fontSize: 'calc(12.5px * var(--text-scale, 1))',
              opacity: 0.62,
              lineHeight: 'var(--leading-relaxed)',
              textWrap: 'pretty',
            }}
          >
            {blurb}
          </p>
        ) : null}
      </div>
      {/* The gutter the groups inset within. `Group` has no margin of its
          own — every screen supplies its own page padding, and this is
          settings' — so this is what makes the panels read as inset. */}
      <div style={{ padding: '0 16px' }}>{children(lit)}</div>
    </main>
  );
}
