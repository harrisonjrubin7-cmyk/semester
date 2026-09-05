import type { ReactNode } from 'react';
import type { Screen } from '../../lib/types';
import { FullBleed } from './Rows';
import { isExempt } from './exempt';

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
 */
export function ShellBody({ screen, children }: { screen: Screen; children: ReactNode }) {
  if (!isExempt(screen)) return <>{children}</>;
  return <FullBleed>{children}</FullBleed>;
}
