import type { ReactNode } from 'react';
import type { Screen } from '../../lib/types';
import { FullBleed } from './Rows';
import { isCanvas, isExempt } from './exempt';

/**
 * The body of whichever screen is open, in the right layout for it.
 *
 * One place, rather than a wrapper inside each of fifteen screens. That is
 * partly for the obvious reason — a list is easier to read and to change than
 * fifteen edits — and partly because a screen half-wrapped is worse than one
 * not wrapped at all, and this cannot be half done.
 *
 * The chrome around it is untouched: the header and the tab bar are outside
 * this and stay in whichever layout is on.
 *
 * ## And how wide it runs
 *
 * The same wrapper carries the desktop measure. On a phone or a tablet
 * `.pane-body` is `max-width: 100%` and does nothing; on a desktop it is what
 * stops a settings row being a metre of hairline with a chevron at the far
 * end of it, and `.is-canvas` is what lets the month grid be wider than that.
 *
 * Here rather than in `<Page>` because eighteen screens — every settings page
 * among them — draw their own frame and never mount `<Page>` at all, and a
 * measure that half the app opts out of by accident is worse than none. This
 * is the one wrapper every screen goes through.
 */
export function ShellBody({ screen, children }: { screen: Screen; children: ReactNode }) {
  const cls = isCanvas(screen) ? 'pane-body is-canvas' : 'pane-body';
  if (!isExempt(screen)) return <div className={cls}>{children}</div>;
  return (
    <div className={cls}>
      <FullBleed>{children}</FullBleed>
    </div>
  );
}
