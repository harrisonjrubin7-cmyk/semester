/**
 * What a tab says about itself when you hover it.
 *
 * ## Why there is no picture in it
 *
 * Every browser puts a thumbnail of the page in this card, and this one
 * cannot, for the reason written across `lib/sound.ts`: a tab here is a saved
 * place rather than a running document. `App.tsx` renders one screen under a
 * `key={state.screen}`, so the tab you are hovering has no DOM anywhere to
 * take a picture of — and rendering one to photograph would mean dispatching
 * its actions, which is *going there*, which is the thing hovering must not
 * do.
 *
 * So the card says what the tab is instead of showing it, and that turns out
 * to be the half people actually use a hover card for: the strip cuts a name
 * at 190 pixels and a pinned tab is a glyph with no name at all, so the full
 * name is information the strip is genuinely withholding. The rest — which
 * work it belongs to, whether it is the one making a noise, what it last
 * searched for — is the context a thumbnail would not have given anyway.
 *
 * ## It is lines, not a component
 *
 * Here rather than in the card so that what it says can be checked without
 * rendering anything, and so the strip and the tab list could both draw it
 * from one description if the list ever wants one.
 */

import { screenName } from './nav';
import { NEW_TAB, type AppTab, type TabGroup } from './browser';

export interface Peek {
  /** The tab's own name, in full — the thing the strip may have cut. */
  title: string;
  /**
   * What kind of place it is: "Calendar", "Study guide".
   *
   * Absent when it would only repeat the title. A tab called "Calendar" on
   * the calendar screen does not need a second line saying Calendar, and a
   * card whose two lines are the same word reads as a bug.
   */
  kind?: string;
  /** The group it is in, if it is in one. */
  group?: string;
  /** Playing, or playing while muted. Absent when it is making no sound. */
  sound?: 'playing' | 'muted';
  /** What this tab last searched for, if it searched. */
  query?: string;
  /**
   * That Alt and the arrows move it, when there is anywhere to move it to.
   *
   * A hint rather than a fact about the tab, and the only line here that is
   * about the card's reader rather than its subject. It earns the room
   * because the shortcut has existed since the strip became draggable and
   * nothing in the app has ever said so: it is not one of the twelve global
   * keys `keys.ts` lists, and a key you can only learn by reading the
   * repository is a key nobody has.
   */
  moves?: boolean;
}

/** Everything the card can say about one tab. */
export function peekAt(
  tab: AppTab,
  group: TabGroup | null | undefined,
  sound: { talking: boolean } = { talking: false },
  /** How many tabs the strip has. One has nowhere to be moved to. */
  among = 0,
): Peek {
  const title = tab.title || NEW_TAB;
  const kind = tab.screen ? plainly(screenName(tab.screen)) : undefined;
  return {
    title,
    ...(kind && !alreadySaid(title, kind) ? { kind } : {}),
    ...(group ? { group: group.name || 'Group' } : {}),
    ...(sound.talking ? { sound: tab.muted ? ('muted' as const) : ('playing' as const) } : {}),
    ...(tab.query ? { query: tab.query } : {}),
    ...(among > 1 ? { moves: true } : {}),
  };
}

/**
 * Would the kind line only repeat the name above it?
 *
 * Two ways, and the second was found by looking at the card rather than by
 * thinking about it. A tab called "Calendar" on the calendar screen is the
 * obvious one. The other is a tab the app named itself: the lesson screen
 * writes "ECON 1020 · Lesson", so the card read
 *
 *     ECON 1020 · Lesson
 *     Lesson · playing
 *
 * — the word twice, three lines apart, which is what the kind line exists
 * *not* to do. So the last segment of the name counts as having said it,
 * since that is how this app builds a name that carries its screen.
 */
function alreadySaid(title: string, kind: string): boolean {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  if (same(title, kind)) return true;
  const parts = title.split('·');
  return parts.length > 1 && same(parts[parts.length - 1], kind);
}

/**
 * A screen's name as a label rather than as the end of a sentence.
 *
 * `screenName` is written to be read as "go to **this course**", because that
 * is what the rest of the app does with it — and "ECON 1020 · this course" is
 * not a line anybody wants on a card. So the leading article comes off and
 * the first letter goes up.
 *
 * Derived rather than duplicated. A second table of screen names would be a
 * second place to add a screen to and one place to forget, which is the fault
 * `nav.test.ts` exists to catch and not one to introduce on purpose.
 */
function plainly(name: string): string {
  const bare = name.replace(/^(these|this|the)\s+/i, '');
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

/**
 * The card as one sentence, for a screen reader.
 *
 * The visible card is several lines of small type in a corner, which is a
 * shape that reads well and announces badly. This is the same facts as one
 * string, hung on the tab with `aria-describedby` — so the keyboard gets what
 * the pointer gets, which is the whole reason this is not a `:hover` rule in
 * the stylesheet.
 */
export function peekSaid(peek: Peek): string {
  return [
    peek.title,
    peek.kind,
    peek.group ? `in ${peek.group}` : '',
    peek.sound === 'playing' ? 'playing' : peek.sound === 'muted' ? 'playing, muted' : '',
    peek.query ? `searched for ${peek.query}` : '',
    /*
     * The shortcut is deliberately absent. It goes on the tab as
     * `aria-keyshortcuts`, which is the attribute for exactly this and is
     * announced once in the way a reader's own settings decide — where a
     * line in the description would be read out on every tab you moved to,
     * which is the noise this card was careful to avoid in the first place.
     */
  ]
    .filter(Boolean)
    .join(' · ');
}
