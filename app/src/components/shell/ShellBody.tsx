import type { ReactNode } from 'react';
import type { Screen } from '../../lib/types';
import { FullBleed } from './Rows';
import { isExempt } from './exempt';
import { FoldAll, FoldScope } from '../Fold';

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
 * It is also where a folded section learns which screen it is on. The name
 * has to come from outside the screen — a fold is remembered across reloads,
 * so "What's coming" on Today and "What's coming" on a course have to be two
 * different memories — and this already knows. See `components/Fold.tsx`.
 *
 * And it is where "collapse all" goes, for the same reason `FullBleed` is
 * here: it belongs to the screen rather than to any part of one. `<Page>`
 * would have been the obvious home and is the wrong one — a course, an event
 * and a deadline are sub-views that keep their own frame rather than opening
 * a `Page`, and every one of them has sections. A control that appeared on
 * most screens would be worse than none.
 */
export function ShellBody({ screen, children }: { screen: Screen; children: ReactNode }) {
  const body = isExempt(screen) ? <FullBleed>{children}</FullBleed> : children;
  return (
    <FoldScope value={screen}>
      {/* The screen's own gutter, so it lines up with the headings it folds.
          It draws nothing at all until there are two sections to fold. */}
      <FoldAll style={{ paddingTop: 'var(--sp-5)', paddingLeft: '18px', paddingRight: '18px' }} />
      {body}
    </FoldScope>
  );
}
