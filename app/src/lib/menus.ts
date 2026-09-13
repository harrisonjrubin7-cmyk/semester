/**
 * A menu bar, held as a list rather than written as markup.
 *
 * The three screens that make a file — `screens/Write.tsx`, `screens/Sheet.tsx`
 * and `screens/deck/Edit.tsx` — each grew their own chrome, and each grew it
 * differently. Write put its exports under a "Take it away" heading two
 * screens down; Sheet put the same idea under the same words but with three
 * buttons instead of three; the deck editor had no exports on the editor at
 * all, only on the builder behind it. Three editors, three vocabularies, and
 * the thing every other editor on earth has — one bar across the top saying
 * **File Edit View Insert Format Tools Help** — was in none of them.
 *
 * So the bar is a value. A screen declares what it can do and in which menu
 * it belongs; `components/Bench.tsx` draws it, the same way, every time. That
 * split is what lets the rules below be tested at all, and the rules are the
 * point: a menu is the one part of an interface where a wrong item is
 * invisible until somebody presses it.
 *
 * ## A command with nothing behind it is not live
 *
 * `tidy` greys every command with no `run`. A menu item that does nothing when
 * pressed is the worst control in any application — indistinguishable from a
 * broken one — and the way it happens is never deliberate: a handler is
 * renamed, a prop stops being passed, and the item is still there looking
 * exactly as it did. Greying is not a cosmetic default, it is the only honest
 * drawing of "there is nothing here".
 *
 * ## The order is fixed, and not by taste
 *
 * File, Edit, View, Insert, Format, then whatever this editor alone has, then
 * Tools and Help. That is the order in Word, in Google Docs, in Excel, in
 * Sheets, in PowerPoint and in Keynote, which means it is the order in the
 * muscle memory of anybody who has used any of them. Three screens each
 * picking their own would cost a beat of reading on every screen, for ever, to
 * save one line here — so `misordered` fails the suite instead.
 *
 * ## No keystrokes
 *
 * Google's menus print ⌘B beside Bold. This one does not, and the reason is
 * `lib/keys.ts`'s rule, stated there at length: a shortcut carrying Meta or
 * Control belongs to the browser or the operating system, and an app that
 * takes one wins an argument nobody asked to have. Printing a keystroke the
 * app has not bound would be worse than both — a label that lies. If the
 * bindings are ever made, they belong here beside the commands they fire, and
 * the labels come with them.
 */

/** One item on a menu. */
export interface Command {
  /** Unique across the whole bar. `clashes` holds that true. */
  id: string;
  /** What it says. Sentence case, a verb where there is one. */
  label: string;
  /** What pressing it does. Absent means there is nothing behind it. */
  run?: () => void;
  /** True where the thing exists but cannot be done from here, yet. */
  disabled?: boolean;
  /**
   * Drawn with a tick, for the items that are settings rather than actions —
   * View's "Outline", the deck editor's "Speaker notes".
   */
  on?: boolean;
  /** A second line, where the label alone would not say enough. */
  hint?: string;
}

/** One menu: a name, and its items in groups that are drawn with a rule between. */
export interface Menu {
  id: string;
  label: string;
  groups: Command[][];
}

/**
 * The order a menu bar is read in, left to right.
 *
 * `slide` and `data` are the per-editor ones — PowerPoint has a Slide menu,
 * Excel has Data — and they sit where those applications put them, between
 * Format and Tools.
 */
export const ORDER = [
  'file',
  'edit',
  'view',
  'insert',
  'format',
  'slide',
  'data',
  'tools',
  'help',
] as const;

export type MenuId = (typeof ORDER)[number];

/**
 * The bar as it should be drawn.
 *
 * Empty groups, empty menus and unlabelled items are dropped, so a screen can
 * build its menus with a `...(condition ? [item] : [])` in them and not have
 * to think about whether that leaves a rule floating above nothing. Every
 * command with no `run` comes back disabled, for the reason in the note above.
 */
export function tidy(menus: Menu[]): Menu[] {
  return menus
    .map((menu) => ({
      ...menu,
      groups: menu.groups
        .map((group) =>
          group
            .filter((c) => c.label.trim() !== '')
            .map((c) => (c.run ? c : { ...c, disabled: true })),
        )
        .filter((group) => group.length > 0),
    }))
    .filter((menu) => menu.groups.length > 0);
}

/** Every command on the bar, in the order it is drawn. */
export function commands(menus: Menu[]): Command[] {
  return menus.flatMap((menu) => menu.groups.flat());
}

/** The ones somebody can actually press right now. */
export function live(menus: Menu[]): Command[] {
  return commands(tidy(menus)).filter((c) => !c.disabled);
}

/**
 * Ids used more than once.
 *
 * Empty is the only passing answer. Two commands sharing an id is not a
 * cosmetic problem: React keys by it, so the second one silently replaces the
 * first and a menu quietly loses an item.
 */
export function clashes(menus: Menu[]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const c of commands(menus)) {
    if (seen.has(c.id)) twice.add(c.id);
    seen.add(c.id);
  }
  return [...twice].sort();
}

/**
 * The first menu that is out of place, or null when the bar reads correctly.
 *
 * A bar need not have every menu — Sheet has no Format menu — but the ones it
 * has must be a subsequence of `ORDER`. A menu whose id is not in `ORDER` at
 * all is named too, because that is the other way this goes wrong.
 */
export function misordered(menus: Menu[]): string | null {
  let at = -1;
  for (const menu of menus) {
    const rank = (ORDER as readonly string[]).indexOf(menu.id);
    if (rank < 0) return menu.id;
    if (rank <= at) return menu.id;
    at = rank;
  }
  return null;
}
