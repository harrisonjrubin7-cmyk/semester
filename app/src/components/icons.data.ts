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
} as const satisfies Record<string, readonly Shape[]>;

export type IconName = keyof typeof SHAPES;

/** How every one of them is drawn, shared by the components and the files. */
export const STROKE = {
  viewBox: '0 0 24 24',
  width: 1.5,
  cap: 'round',
  join: 'round',
} as const;
