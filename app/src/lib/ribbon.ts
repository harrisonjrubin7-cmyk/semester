/**
 * The ribbon: a toolbar with tabs and named groups, held as a list.
 *
 * `lib/menus.ts` is the bar across the top of every editor — File, Edit, View,
 * Insert, Format, Help — and it stays exactly what it is. This is the row
 * underneath it on the spreadsheet, and it is a different thing doing a
 * different job:
 *
 *   - a **menu** is a list of everything, read once, when you are looking for
 *     something by name;
 *   - a **ribbon** is the dozen controls you press over and over while the
 *     cursor is in a cell, laid out so the hand finds them without reading.
 *
 * The Sheet screen had the second one as a single flat row: undo, five
 * pictures, two decimal buttons, three weights, three alignments — fifteen
 * buttons in a line that wrapped into three on a phone and had no structure
 * at any width. Nothing said which two belonged together, and there was
 * nowhere to put the next one, so everything that arrived afterwards went
 * into a stack of full-width buttons two screens below the grid instead:
 * "The grid's size", "A sum, written for you", "Take it away".
 *
 * So: tabs, and inside each tab, groups with their names under them. It is
 * Excel's shape and Google Sheets' shape and it is the shape for a reason —
 * **Font**, **Alignment** and **Number** are how people already think about
 * what they are doing to a cell, and a name under a group of four buttons is
 * the cheapest documentation an interface can carry.
 *
 * ## What is here and what is on the menu bar
 *
 * The ribbon holds what you do *to the sheet in front of you* and the menu
 * bar holds what you do *to the file*: new, copy, download, print, delete.
 * That is the same split Excel makes with its File tab, and it is why there
 * is no File tab here — the app already has one bar across the top of all
 * three of its editors, and a second File a centimetre below the first would
 * be two doors into one room.
 *
 * ## Why this is a value and not markup
 *
 * The same reason the menus are: the rules below can then be run. A control
 * with nothing behind it is greyed rather than drawn live, ids are unique so
 * React cannot silently drop one, the tab order is fixed rather than a matter
 * of taste, and every one of those is checked in `ribbon.test.ts` instead of
 * being noticed by somebody pressing a dead button.
 */

/** A glyph and a word. The word is what a screen reader says. */
interface Named {
  id: string;
  /** What it says to anybody listening: "Bold", "More decimal places". */
  label: string;
  /**
   * The one or two characters drawn on it — `B`, `Σ`, `.00`.
   *
   * Text rather than an icon, and the toolbar this replaces made the argument:
   * an icon nobody recognises is a button nobody presses, and `B`, `I`, `%`
   * and `$` are the ones everybody does. Absent draws the label instead,
   * which is what the wider buttons do.
   */
  glyph?: string;
}

/** One thing on the ribbon. */
export type Control =
  | (Named & {
      kind: 'button';
      /** What pressing it does. Absent means there is nothing behind it. */
      run?: () => void;
      /** Drawn pressed, for the buttons that are states: Bold on, Percent on. */
      on?: boolean;
      /** Drawn with its words rather than a glyph, for the ones nobody has a symbol for. */
      wide?: boolean;
    })
  | (Named & {
      kind: 'pick';
      value: string;
      options: readonly { id: string; label: string }[];
      onPick?: (id: string) => void;
    })
  | (Named & {
      kind: 'swatches';
      /** The colour now on the selection, or nothing for "no colour". */
      value?: string;
      /** The colours offered, each an id and the name it is called by. */
      options: readonly { id: string; label: string }[];
      onPick?: (id: string | null) => void;
    })
  | (Named & {
      kind: 'slider';
      value: number;
      min: number;
      max: number;
      step: number;
      onSlide?: (value: number) => void;
    });

/** A run of controls under one name: Font, Alignment, Number. */
export interface Group {
  id: string;
  /** The word under the group. This is the whole reason a ribbon beats a row. */
  label: string;
  controls: Control[];
}

/** One tab of the ribbon. */
export interface Tab {
  id: string;
  label: string;
  groups: Group[];
}

/**
 * The tabs, left to right.
 *
 * Excel's own order, minus the three tabs this app has nothing to put in
 * (Page Layout, Review, Developer) and minus File, which is the menu bar's.
 * Fixed rather than chosen per screen for the same reason `ORDER` is fixed in
 * `lib/menus.ts`: it is already in the muscle memory of anybody who has
 * opened a spreadsheet, and the reading is free.
 */
export const TABS = ['home', 'insert', 'formulas', 'data', 'view'] as const;

export type TabId = (typeof TABS)[number];

/**
 * The ribbon as it should be drawn.
 *
 * Empty groups and empty tabs are dropped, so a screen can build a group with
 * a `...(condition ? [control] : [])` in it without having to think about
 * whether that leaves a name floating over nothing. Every control with no
 * handler comes back dead, which is the ribbon's version of the greying rule:
 * a button that does nothing when pressed is indistinguishable from a broken
 * one.
 */
export function tidy(tabs: Tab[]): Tab[] {
  return tabs
    .map((tab) => ({
      ...tab,
      groups: tab.groups
        .map((group) => ({ ...group, controls: group.controls.filter(hasLabel) }))
        .filter((group) => group.controls.length > 0),
    }))
    .filter((tab) => tab.groups.length > 0);
}

function hasLabel(control: Control): boolean {
  return control.label.trim() !== '';
}

/** Whether a control can be pressed at all — what decides the greying. */
export function live(control: Control): boolean {
  if (control.kind === 'button') return control.run !== undefined;
  if (control.kind === 'slider') return control.onSlide !== undefined;
  return control.onPick !== undefined;
}

/** Every control on the ribbon, in the order it is drawn. */
export function controls(tabs: Tab[]): Control[] {
  return tabs.flatMap((tab) => tab.groups.flatMap((group) => group.controls));
}

/**
 * Ids used more than once. Empty is the only passing answer.
 *
 * React keys by the id, so two controls sharing one means the second silently
 * replaces the first and the ribbon quietly loses a button.
 */
export function clashes(tabs: Tab[]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const id of [...tabs.map((t) => t.id), ...tabs.flatMap((t) => t.groups.map((g) => g.id))]) {
    if (seen.has(id)) twice.add(id);
    seen.add(id);
  }
  for (const control of controls(tabs)) {
    if (seen.has(control.id)) twice.add(control.id);
    seen.add(control.id);
  }
  return [...twice].sort();
}

/**
 * The first tab that is out of place, or null when the ribbon reads correctly.
 *
 * A ribbon need not carry every tab, but the ones it carries must be a
 * subsequence of {@link TABS}. A tab whose id is not in the list at all is
 * named too, because that is the other way this goes wrong.
 */
export function misordered(tabs: Tab[]): string | null {
  let at = -1;
  for (const tab of tabs) {
    const rank = (TABS as readonly string[]).indexOf(tab.id);
    if (rank < 0) return tab.id;
    if (rank <= at) return tab.id;
    at = rank;
  }
  return null;
}

/**
 * The tab to draw, given the one that was chosen.
 *
 * A chosen tab that is no longer on the ribbon — Data has nothing in it until
 * a block is selected — falls back to the first rather than drawing nothing.
 * An empty ribbon body under a row of tabs reads as broken; a Home tab reads
 * as Home.
 */
export function showing(tabs: Tab[], chosen: string): Tab | null {
  const drawn = tidy(tabs);
  return drawn.find((t) => t.id === chosen) ?? drawn[0] ?? null;
}

/**
 * The zoom steps, as percentages.
 *
 * The ones on Excel's own status bar. A slider that could land on 87% would
 * be a slider whose value nobody could return to, and the whole use of zoom
 * on a phone is getting back to 100% afterwards.
 */
export const ZOOMS = [50, 75, 90, 100, 125, 150, 200] as const;

/** The next step up or down from wherever the slider is now. */
export function stepZoom(now: number, by: 1 | -1): number {
  const at = ZOOMS.findIndex((z) => z >= now);
  const here = at < 0 ? ZOOMS.length - 1 : at;
  return ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, here + by))];
}
