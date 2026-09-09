/**
 * A home screen: a grid of icons with the name under each one.
 *
 * The Tools tab was thirteen full-width cards, each carrying a label, a
 * sentence and a chevron — about 68px of screen per tool, so four fitted and
 * the other nine were below the fold. Which is the failure the tab was built
 * to fix: it exists because those tools were unreachable, and a list long
 * enough to scroll past is the same problem in a nicer frame.
 *
 * A phone home screen is the shape that solves it. Four to a row, twelve
 * visible at once, and each one has a *position* — Email is bottom-left and
 * stays bottom-left, so the second time you look for it you do not read, you
 * point. That is the whole reason people find apps on their phone faster than
 * they find features in an app.
 *
 * What is given up is the blurb. It is not lost: it is the `title`, so a
 * pointer still gets it, and the tool's own screen opens with it. A sentence
 * you have read once is not worth thirteen rows of scrolling forever after.
 *
 * The tiles are drawn in the app's own materials rather than in a phone's —
 * hairline border, the panel it sits on, the accent for the glyph. The corner
 * radius is the one iOS thing kept, and it still answers to the Corners
 * setting: `min()` against `--r-lg` means a reader who asked for Square
 * corners gets square icons rather than the one place the app ignores them.
 */

import { createElement } from 'react';
import { glyphFor } from '../icons.pick';
import type { Destination } from '../../lib/nav';

export function AppGrid({
  apps,
  says,
  onOpen,
}: {
  apps: Destination[];
  /**
   * What this school calls the screen, when it calls it something of its own.
   *
   * Optional, and the registry's own words are the default — the Tools tab
   * has no school-specific names on it. The launcher does: `saysFor` is why a
   * Vanderbilt student's registrar tile says YES and nobody else's does, and
   * a grid that printed the registry label there would be the one place in
   * the app using somebody else's word for their own university.
   */
  says?: (d: Destination) => { label: string; blurb: string };
  /** What the label says and where it goes — the caller owns both. */
  onOpen: (d: Destination) => void;
}) {
  return (
    <div className="appgrid">
      {apps.map((d) => {
        const said = says?.(d);
        return (
          <button
            key={d.screen}
            type="button"
            className="bare appicon"
            onClick={() => onOpen(d)}
            title={said?.blurb ?? d.blurb}
          >
            <span className="appicon-tile">{createElement(glyphFor(d.screen), { size: 27 })}</span>
            {/* The short name when there is one: this is a 74px column, and
                the label that fits a directory row does not fit here. */}
            <span className="appicon-name">{d.short ?? said?.label ?? d.label}</span>
          </button>
        );
      })}
    </div>
  );
}
