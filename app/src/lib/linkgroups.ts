import type { CampusLink } from './types';

/**
 * The headings on the Links screen, and where they come from.
 *
 * Four are the app's: `Campus` is what a row falls back to when it names no
 * group, and `Books`, `Tickets` and `Social` are the bundled addresses'
 * own. Those stay fixed and stay in this order, because they are the app's
 * furniture and a bookstore does not move to the top because of something a
 * student typed on Tuesday.
 *
 * The fifth used to be `Yours`, fixed alongside them, and everything somebody
 * added went under it. That is one heading for the whole of a person's own
 * addresses — a club, a landlord, three group chats, the gym — which is the
 * flat list this screen was grouped to stop being, arrived at from the other
 * side. So `Yours` is now what a link is called when it is called nothing,
 * and any other name a student gives becomes a heading of its own.
 *
 * ## Why the app's four are not simply merged in
 *
 * A student who names a group `Tickets` gets their row under the bundled
 * Tickets heading rather than a second one, which is the answer somebody
 * typing that word wants. It follows from the fold below rather than being
 * special-cased: a name is matched case-insensitively against what is already
 * there, and the app's four are already there.
 */
export const BUILT_IN_GROUPS = ['Campus', 'Books', 'Tickets', 'Social'] as const;

/** What a row with no group of its own is filed under. */
export const DEFAULT_GROUP = 'Campus';

/** What a link the student added is filed under when they name no group. */
export const OWN_GROUP = 'Yours';

/**
 * The heading one added link belongs under.
 *
 * Trimmed, and `Yours` when nothing was given — a name of spaces is a name
 * nobody typed.
 */
export const groupName = (link: CampusLink): string => link.group?.trim() || OWN_GROUP;

/**
 * Every heading to draw, in order.
 *
 * The app's four first and always in their order, then the student's own in
 * the order they first named them, which is the only ordering that is theirs
 * rather than the app's opinion. Names are folded case-insensitively and the
 * first spelling wins, so `Landlord` and `landlord` are one heading and not
 * two that look identical on a phone.
 */
export function linkGroups(added: CampusLink[]): string[] {
  const out = [...BUILT_IN_GROUPS] as string[];
  const seen = new Set(out.map((g) => g.toLowerCase()));
  for (const link of added) {
    const name = groupName(link);
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

/**
 * Which rows sit under one heading.
 *
 * A row that names no group is a bundled one and answers to `Campus`; an added
 * row has had `groupName` applied to it before it gets here, so it names
 * `Yours` where the student named nothing. The comparison is the same
 * case-insensitive one `linkGroups` folds with, so a row cannot end up under a
 * heading that was never drawn.
 */
export const inGroup = (links: CampusLink[], group: string): CampusLink[] =>
  links.filter((l) => (l.group?.trim() || DEFAULT_GROUP).toLowerCase() === group.toLowerCase());
