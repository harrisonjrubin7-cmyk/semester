import { useEffect, useState, type ReactNode } from 'react';
import { HIGHLIGHT_MS, pageTitle, sectionOf, takeLooking } from '../../lib/settings';
import type { Screen } from '../../lib/types';

/**
 * The shell every settings page sits in.
 *
 * Three things, and each of them is the kind that gets forgotten once per
 * page rather than once per app if it is not written down here.
 *
 * **Focus lands on the heading — the shell's, not this page's.** Pushing a
 * page moves what is on screen and nothing else, so a screen reader would
 * stay where it was and read the old page. `Header` in `App.tsx` moves focus
 * to the screen's `<h1>` on every navigation, this one included; this page
 * used to do it a second time, to a second `<h1>` of its own, and the two
 * effects raced on the only screens in the app where that could happen.
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
/**
 * @param screen Which page this is. Its *name* comes from `lib/settings.ts`
 *   rather than from a prop, because a page's name was in three places —
 *   that registry, a `title` each page passed here, and a switch in
 *   `App.tsx` — and had already drifted: the index and the header bar
 *   disagreed with the heading on the page they opened. One list names it,
 *   and renaming a page is one edit.
 * @param blurb The sentence under the heading. Stays a prop: it is prose
 *   written for this page and read only here, unlike the name, which four
 *   other things need.
 */
export function SettingsPage({
  screen,
  blurb,
  children,
}: {
  screen: Screen;
  blurb?: string;
  children: (lit: string) => ReactNode;
}) {
  const title = pageTitle(screen);
  // Taken during the first render rather than in an effect, so the group is
  // already lit on the frame the page appears on instead of flashing plain
  // and then highlighting.
  const [lit, setLit] = useState(takeLooking);

  useEffect(() => {
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
    /*
     * A `<div>`, not a `<main>`.
     *
     * This was written as a standalone document and then mounted inside a
     * shell that already is one: `ScrollArea` renders `<main id="main">`
     * around every screen, so each settings page put a second `<main>` inside
     * the first. That is invalid — a `<main>` may not descend from a `<main>`
     * — and it gave a reader two main landmarks on the eight pages where the
     * skip link's target is least ambiguous elsewhere.
     */
    <div style={{ paddingBottom: 'calc(24px * var(--density, 1))' }}>
      <div style={{ padding: '0 var(--page-pad) calc(12px * var(--density, 1))' }}>
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
        {/*
          An `<h2>`, and no longer a landing point.

          Both halves were this page being a document rather than a screen.
          The shell's header already prints the page's name as the `<h1>` —
          from `settingsTitle`, the same registry this reads — so every
          settings page carried two, saying nearly the same thing twice:
          "About" over "About", "Colour" over "Colour and type". And both were
          `tabIndex={-1}` and both were focused on arrival, by two effects
          that raced, on the only screens in the app where that happened.

          Drawn exactly as it was: the styles are inline, so the tag is the
          whole of the change.
        */}
        <h2
          style={{
            margin: '4px 0 0',
            fontSize: 'calc(21px * var(--text-scale, 1))',
            fontFamily: 'var(--font-heading)',
            fontWeight: 'var(--font-heading-weight)' as never,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h2>
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
      <div style={{ padding: '0 var(--page-pad)' }}>{children(lit)}</div>
    </div>
  );
}
