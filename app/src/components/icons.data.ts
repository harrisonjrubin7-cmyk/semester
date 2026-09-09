/**
 * The icon shapes, as data rather than markup.
 *
 * They were JSX inside `Icons.tsx`, which was fine until something outside
 * React wanted the same glyphs and got its own hand-drawn copies of them.
 * Shapes as data, rendered by `Icons.tsx`, is what stops that: there is one
 * path per glyph and redrawing it redraws every place it appears.
 *
 * (The second consumer was the separate static website that used to ship
 * under `/web/`, which drew these as CSS masks from twelve generated `.svg`
 * files. That site is gone — it was a second version of this app — and the
 * generator with it. The shapes stay here regardless: one definition per
 * glyph is right with one consumer as well as two, and it is what the icon
 * shape setting in Appearance is able to restyle in one place.)
 *
 * The style is unchanged and worth keeping: Lucide-like, on a 24×24 grid, at
 * stroke-width 1.5 — the Industry system's rule.
 */

/** A stroked path, or a circle, which is the only primitive `d` reads badly. */
export type Shape = { d: string } | { c: readonly [number, number, number] };

export const SHAPES = {
  chevronRight: [{ d: 'm9 18 6-6-6-6' }],
  chevronLeft: [{ d: 'm15 18-6-6 6-6' }],
  search: [{ c: [11, 11, 7] }, { d: 'm20 20-3.2-3.2' }],
  bell: [
    { d: 'M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7' },
    { d: 'M10.5 20a2 2 0 0 0 3 0' },
  ],
  person: [{ c: [12, 8, 3.5] }, { d: 'M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5' }],
  check: [{ d: 'M20 6 9 17l-5-5' }],
  plus: [{ d: 'M12 5v14M5 12h14' }],
  today: [{ d: 'M4 5.5h16v15H4z' }, { d: 'M8 2v3M16 2v3M3.5 9h17' }, { d: 'm8.5 14.5 2 2 4-4' }],
  courses: [{ d: 'M4 4.5h16v6H4zM4 13.5h16v6H4z' }],
  study: [
    { d: 'M12 6.5C10.5 5.2 8.4 4.5 5 4.5v13c3.4 0 5.5.7 7 2 1.5-1.3 3.6-2 7-2v-13c-3.4 0-5.5.7-7 2z' },
    { d: 'M12 6.5v15' },
  ],
  notes: [{ d: 'M5.5 3.5h13v17h-13z' }, { d: 'M9 8h6M9 12h6M9 16h3' }],
  play: [{ d: 'M8 5.5v13l11-6.5z' }],
  pause: [{ d: 'M9 5v14M15 5v14' }],
  /** A folded map, not a pin — the tab is a map, and a pin is a saved place. */
  map: [{ d: 'M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3Z' }, { d: 'M9 3v15' }, { d: 'M15 6v15' }],
  calendar: [{ d: 'M4 5.5h16v15H4z' }, { d: 'M8 2v3M16 2v3M3.5 9h17' }, { d: 'M8 13h3v3H8z' }],

  /*
   * The next three exist for the tab bar a student arranges themselves.
   *
   * Forty-two screens can go in that bar and fourteen of them have an icon of
   * their own. The rest borrow one of these — one per shelf in `lib/nav.ts` —
   * so a chosen tab shows which part of the app it came from rather than a
   * placeholder square. The label underneath still says which screen it is;
   * the glyph is only there to make the bar readable at a glance.
   */

  /** Make — a pen nib. Everything on that shelf produces something. */
  make: [{ d: 'M4 20.5 5 16 16.5 4.5l3 3L8 19z' }, { d: 'm14.5 6.5 3 3' }],

  /** Upkeep — sliders. The shelf you go to when something needs correcting. */
  upkeep: [
    { d: 'M4 7h16M4 12h16M4 17h16' },
    { c: [9, 7, 2] },
    { c: [15, 12, 2] },
    { c: [8, 17, 2] },
  ],

  /** Campus — a building with windows. */
  campus: [
    { d: 'M4 21V9l8-5 8 5v12' },
    { d: 'M3 21h18' },
    { d: 'M9 21v-5h6v5' },
    { d: 'M9 11.5h2M13 11.5h2' },
  ],

  /*
   * The tools, one glyph each.
   *
   * The Tools tab draws them as a home screen — a grid of icons with the name
   * underneath — and a home screen where thirteen apps share two pictures is
   * not a home screen, it is a list with decoration. So each of these is the
   * one drawing that says what that tool does, and the shelf fallbacks in
   * `icons.pick.ts` stay for the screens nobody has drawn yet.
   *
   * They are here rather than in the tab because a glyph belongs to a screen,
   * not to a place a screen is listed: the bar and the launcher pick these up
   * as well, which is the whole reason the shapes live in one file.
   */

  /** Ask Claude — a speech bubble with the tail cut square, like the frames. */
  ask: [{ d: 'M4 4.5h16v11h-9.5l-4.5 4v-4H4z' }],

  /** Work on it — a clipboard, ticked: an assignment broken into a plan. */
  work: [
    { d: 'M6 5.5h12v15H6z' },
    { d: 'M9.5 3.5h5v3h-5z' },
    { d: 'm9 13.5 2 2 4-4' },
  ],

  /** Add a reading — a page with a plus, not a page with more lines on it. */
  update: [{ d: 'M5.5 3.5h13v17h-13z' }, { d: 'M12 9v6M9 12h6' }],

  /** Analyse data — an axis and three bars. */
  analyse: [{ d: 'M4 3.5v17h16' }, { d: 'M8.5 20.5v-5M13 20.5v-9M17.5 20.5v-3' }],

  /** Draw it — two nodes and the line between them. */
  draw: [{ d: 'M3.5 4.5h7v5h-7z' }, { d: 'M13.5 14.5h7v5h-7z' }, { d: 'M7 9.5V17h6.5' }],

  /** Work the problem — a calculator: a method you run on other numbers. */
  solve: [
    { d: 'M5.5 3.5h13v17h-13z' },
    { d: 'M8.5 7h7v3h-7z' },
    { d: 'M9 13.5h.01M12 13.5h.01M15 13.5h.01M9 17h.01M12 17h.01M15 17h.01' },
  ],

  /** Practice paper — a sheet with a clock on it: the shape and the time. */
  exam: [{ d: 'M5.5 3.5h13v17h-13z' }, { d: 'M9 7.5h6' }, { c: [12, 14.5, 3.5] }, { d: 'M12 12.5v2l1.5 1' }],

  /** Make a deck — a screen on a stand. */
  deck: [{ d: 'M3.5 4.5h17v11h-17z' }, { d: 'M12 15.5v3' }, { d: 'm8.5 20.5 3.5-2 3.5 2' }],

  /** Sources — a book with the ribbon in it, not a shelf of two rectangles. */
  sources: [{ d: 'M5.5 3.5h13v17h-13z' }, { d: 'M9.5 3.5v7l2.5-2 2.5 2v-7' }],

  /** Draft it — a page with the corner turned, and writing on it. */
  essay: [
    { d: 'M6 3.5h7l5 5v12H6z' },
    { d: 'M13 3.5v5h5' },
    { d: 'M9 13h6M9 16.5h4' },
  ],

  /** Exam runway — the flag, and the ground the weeks are counted along. */
  runway: [{ d: 'M4 20.5h16' }, { d: 'M8 20.5V4' }, { d: 'M8 4.5h9l-2.5 3 2.5 3H8z' }],

  /** Email — an envelope. */
  mail: [{ d: 'M3.5 5.5h17v13h-17z' }, { d: 'm3.5 7 8.5 6 8.5-6' }],

  /** Check the writing — lines read back, and the tick at the end of them. */
  proof: [{ d: 'M4 6.5h16M4 11h13M4 15.5h6' }, { d: 'm12 18 2.5 2.5L20 15' }],
} as const satisfies Record<string, readonly Shape[]>;

export type IconName = keyof typeof SHAPES;

/** How every one of them is drawn, shared by the components and the files. */
export const STROKE = {
  viewBox: '0 0 24 24',
  width: 1.5,
  cap: 'round',
  join: 'round',
} as const;
