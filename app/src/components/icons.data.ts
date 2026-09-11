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

  /*
   * All apps — the nine squares.
   *
   * A grid of small blocks is the one drawing that has come to mean "every
   * app there is", and it means it on a phone's home screen, in a browser's
   * toolbar and at the top right of every Google page. Borrowed because it is
   * understood, not because it is Google's: a glyph nobody has to learn is
   * worth more here than one of our own.
   *
   * Squares rather than the dots the original uses. Every shape in this file
   * is stroked at 1.5 and filled with nothing, so a dot small enough to read
   * as a dot arrives as a smudged ring; a 4px square at the same stroke is
   * crisp at 19px and still reads as a block in a grid.
   */
  apps: [
    { d: 'M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4z' },
    { d: 'M4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4z' },
    { d: 'M4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z' },
  ],
  today: [{ d: 'M4 5.5h16v15H4z' }, { d: 'M8 2v3M16 2v3M3.5 9h17' }, { d: 'm8.5 14.5 2 2 4-4' }],
  courses: [{ d: 'M4 4.5h16v6H4zM4 13.5h16v6H4z' }],
  study: [
    { d: 'M12 6.5C10.5 5.2 8.4 4.5 5 4.5v13c3.4 0 5.5.7 7 2 1.5-1.3 3.6-2 7-2v-13c-3.4 0-5.5.7-7 2z' },
    { d: 'M12 6.5v15' },
  ],
  notes: [{ d: 'M5.5 3.5h13v17h-13z' }, { d: 'M9 8h6M9 12h6M9 16h3' }],
  /** The drive's folder — a tab on the left, as every folder glyph has had. */
  folder: [{ d: 'M3 6.5a1 1 0 0 1 1-1h5l2 2.5h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z' }],
  /**
   * Favourite. Drawn as one closed path so `fill` says whether it is starred —
   * a second outline-versus-solid glyph would be two shapes to keep in step.
   */
  star: [{ d: 'M12 4.2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.9l5.4-.8z' }],
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

  /**
   * Write a document — a page with a heading rule and prose under it.
   *
   * Deliberately not the turned corner `essay` uses. Two writing tools that
   * both draw a page are two tools nobody can tell apart in a grid, and the
   * difference between them is that this one is a document with a structure
   * in it rather than a draft of prose.
   */
  write: [
    { d: 'M5.5 3.5h13v17h-13z' },
    { d: 'M9 7.5h6' },
    { d: 'M9 11.5h6M9 14.5h6M9 17.5h3' },
  ],

  /** Sheet or table — a grid, with the header row ruled off. */
  sheet: [
    { d: 'M3.5 4.5h17v15h-17z' },
    { d: 'M3.5 9h17' },
    { d: 'M9.5 9v10.5M15 9v10.5' },
  ],

  /** Equations — the division sign, which is the one glyph that reads as maths. */
  equations: [
    { d: 'M4.5 12h15' },
    { c: [12, 7, 1.4] },
    { c: [12, 17, 1.4] },
  ],

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

  /*
   * The other twenty-seven, drawn when the header grew a launcher.
   *
   * Twenty-two screens had a glyph and the remaining twenty-seven borrowed
   * their shelf's, which was fine everywhere it was used: a tab bar shows one
   * at a time, and a cluster on a tile is deduplicated before it is drawn.
   * A grid of every screen at once is the first place they all appear
   * together, and there it was five identical pairs of rectangles under five
   * different words — the reader has to read all five, which is a list with
   * decoration rather than a home screen.
   *
   * So the fallback is now what it was meant to be: a safety net for a screen
   * nobody has drawn yet, rather than the answer for half the app. Each of
   * these is the one drawing that says what that screen does, at the same
   * 24×24 and the same 1.5 stroke as the rest.
   */

  /** Reports — a page with the week's bars on it. */
  brief: [{ d: 'M6 3.5h12v17H6z' }, { d: 'M9.5 16.5v-3M12 16.5v-6M14.5 16.5v-4.5' }],

  /** Ahead — the days in front of you. */
  ahead: [{ d: 'M4 12h13' }, { d: 'm12.5 7 5 5-5 5' }],

  /** Behind — the same arrow, turned, against the wall of what has gone. */
  behind: [{ d: 'M4.5 4.5v15' }, { d: 'M20 12H8.5' }, { d: 'm13 7-5 5 5 5' }],

  /** Tonight — a moon. The one screen that is about the hours after dark. */
  tonight: [{ d: 'M20 14.7A8.6 8.6 0 0 1 9.3 4 8.6 8.6 0 1 0 20 14.7z' }],

  /** Degree — the cap. What the four years are for. */
  degree: [
    { d: 'm2.5 9 9.5-4.5L21.5 9 12 13.5z' },
    { d: 'M6.5 11.2V16c0 1.5 2.5 2.5 5.5 2.5s5.5-1 5.5-2.5v-4.8' },
  ],

  /** Import — a syllabus going up into the app. */
  import: [{ d: 'M12 15.5V3.5' }, { d: 'm7.5 8 4.5-4.5L16.5 8' }, { d: 'M4 15v5.5h16V15' }],

  /** Edit — the page, and the pencil at the corner of it. */
  edit: [
    { d: 'M6 3.5h8l4 4v3' },
    { d: 'M6 3.5v17h6' },
    { d: 'M9.5 8.5h4' },
    { d: 'm19.5 13 2 2-6 6H13v-2.5z' },
  ],

  /** Dates — the registrar's seal, not another calendar. */
  registrar: [{ c: [12, 9.5, 5.5] }, { d: 'M8.5 14.5 7 21l5-2.2 5 2.2-1.5-6.5' }],

  /** Changes — a megaphone: something moved and somebody said so. */
  announce: [
    { d: 'M4 10v4h3l7 4.5v-13L7 10z' },
    { d: 'M17.5 9.5a4 4 0 0 1 0 5' },
  ],

  /** Overlap — two courses, and the part that is in both. */
  meet: [{ c: [9.5, 12, 5.5] }, { c: [14.5, 12, 5.5] }],

  /*
   * A call — the camera body and the lens flare beside it.
   *
   * The one glyph in this set that is borrowed rather than drawn: a rectangle
   * with a wedge on its right is what "video call" has meant since the first
   * one, and every app the student already has uses it. A more original
   * drawing would be a worse icon.
   */
  call: [
    { d: 'M3 7.5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 15 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 16.5z' },
    { d: 'm15 10.8 6-3.3v9l-6-3.3z' },
  ],

  /** Group — two people, because it is the one screen about other people’s parts. */
  /*
   * The call's own controls, which are the one set in this app that may not be
   * invented.
   *
   * Every other glyph here can be drawn however it reads best, because nobody
   * arrives at a study screen with an expectation. A call is the opposite: a
   * student has sat in four hundred of them, and the microphone, the crossed
   * microphone, the arrow out of a box and the tipped handset mean exactly one
   * thing each in every app they have ever used. Drawn in this set's line
   * weight and on its grid, and otherwise deliberately unoriginal.
   */
  mic: [
    { d: 'M12 4.5a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-5 0V7A2.5 2.5 0 0 1 12 4.5z' },
    { d: 'M6.5 11.5a5.5 5.5 0 0 0 11 0' },
    { d: 'M12 17v3' },
  ],

  /** Muted — the same microphone with the line every app draws through it. */
  micOff: [
    { d: 'M9.5 6.6A2.5 2.5 0 0 1 14.5 7v3.6' },
    { d: 'M14.5 14.3a2.5 2.5 0 0 1-5-1.3V9.4' },
    { d: 'M6.5 11.5a5.5 5.5 0 0 0 8.9 4.3M17.5 11.5v.6' },
    { d: 'M12 17v3' },
    { d: 'm4 4 16 16' },
  ],

  /** Camera off — the call glyph, struck through. */
  camOff: [
    { d: 'M3 7.5a1.5 1.5 0 0 1 1.5-1.5h6.7M15 10.8l6-3.3v9l-3.4-1.9' },
    { d: 'M15 13.4v3.1a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 16.5v-6' },
    { d: 'm4 4 16 16' },
  ],

  /** Share — a screen with an arrow coming out of it. */
  screenShare: [
    { d: 'M4 5.5h16v10H4z' },
    { d: 'M9 19.5h6' },
    { d: 'M12 12.5V7M9.6 9.4 12 7l2.4 2.4' },
  ],

  /** A hand, up. */
  hand: [
    { d: 'M9 11V5.8a1.4 1.4 0 0 1 2.8 0V11' },
    { d: 'M11.8 10.6V4.6a1.4 1.4 0 0 1 2.8 0V11' },
    { d: 'M14.6 11V7.4a1.4 1.4 0 0 1 2.8 0V15a5 5 0 0 1-5 5h-.6a5 5 0 0 1-4.3-2.5L5 13.4a1.4 1.4 0 0 1 2.3-1.6L9 14' },
  ],

  /** Chat — a speech bubble with its tail. */
  chat: [
    { d: 'M20 12.5a7 7 0 0 1-7 7H7.5L4 22v-9.5a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7z' },
  ],

  /** More — the three dots every app puts the rest behind. */
  more: [{ c: [6, 12, 1.2] }, { c: [12, 12, 1.2] }, { c: [18, 12, 1.2] }],

  /** Leave — the handset, tipped down, which has meant "hang up" for a century. */
  leave: [
    { d: 'M3.2 9.6a14 14 0 0 1 17.6 0l-1.6 3.1a1.5 1.5 0 0 1-1.8.7l-2.6-.9a1.5 1.5 0 0 1-1-1.6l.2-1.3a10 10 0 0 0-4 0l.2 1.3a1.5 1.5 0 0 1-1 1.6l-2.6.9a1.5 1.5 0 0 1-1.8-.7z' },
  ],

  /** Gallery — the even grid of tiles. */
  gallery: [
    { d: 'M4 5.5h7v5.5H4zM13 5.5h7v5.5h-7zM4 13h7v5.5H4zM13 13h7v5.5h-7z' },
  ],

  /** Speaker view — one big tile and the strip beside it. */
  spotlight: [
    { d: 'M4 5.5h11v13H4z' },
    { d: 'M17 5.5h3v4h-3zM17 11h3v4h-3zM17 16.5h3v2h-3z' },
  ],

  groupwork: [
    { c: [9, 8, 3.2] },
    { d: 'M3 20c0-3.3 2.7-5.2 6-5.2s6 1.9 6 5.2' },
    { d: 'M15.8 5.4a3.2 3.2 0 0 1 0 5.9' },
    { d: 'M17.3 14.9c2.2.6 3.7 2.3 3.7 4.7' },
  ],

  /** Meal plan — a fork and a spoon. */
  meals: [
    { d: 'M6 3.5v5.5a2.5 2.5 0 0 0 5 0V3.5' },
    { d: 'M8.5 11.5v9' },
    { d: 'M17 20.5v-7' },
    { d: 'M17 13.5c-2.2 0-2.8-8.9 0-10.9 2.8 2 2.2 10.9 0 10.9z' },
  ],

  /** Housing — a bed, which is what the screen is actually about. */
  housing: [
    { d: 'M3.5 20.5V8' },
    { d: 'M3.5 13.5h17v7' },
    { d: 'M20.5 13.5v-2a2.5 2.5 0 0 0-2.5-2.5h-6v4.5' },
    { c: [7.5, 11, 2] },
  ],

  /** Register — a person, and the plus that puts them on a roll. */
  yes: [
    { c: [10, 8, 3.5] },
    { d: 'M3.5 20c0-3.6 2.9-5.5 6.5-5.5.9 0 1.8.1 2.5.4' },
    { d: 'M17.5 14v6M14.5 17h6' },
  ],

  /** Class — a room, said the way every chat app says one. */
  classmates: [{ d: 'M9 4v16M15 4v16' }, { d: 'M3.5 9h17M3.5 15h17' }],

  /** Costs — a receipt, torn along the bottom. */
  costs: [
    { d: 'M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z' },
    { d: 'M9.5 8h5M9.5 12h5' },
  ],

  /** People — a card with somebody on it: the ones who will write about you. */
  people: [
    { d: 'M4 4.5h16v15H4z' },
    { c: [10, 10, 2.5] },
    { d: 'M6.5 16c.8-1.7 2-2.5 3.5-2.5s2.7.8 3.5 2.5' },
    { d: 'M15.5 9.5h2.5M15.5 13h2.5' },
  ],

  /** Apply — a briefcase. */
  applying: [
    { d: 'M3.5 7.5h17v12h-17z' },
    { d: 'M9 7.5V5h6v2.5' },
    { d: 'M3.5 12.5h17' },
  ],

  /** Timers — a stopwatch, with the button on top. */
  clocks: [
    { c: [12, 13.5, 7 ] },
    { d: 'M12 10v3.5l2.5 1.5' },
    { d: 'M9.5 3h5M12 3v3.5' },
  ],

  /** Links — a chain. */
  links: [
    { d: 'M10.5 13.5a3.8 3.8 0 0 0 5.4 0l2.6-2.6a3.8 3.8 0 0 0-5.4-5.4l-1.3 1.3' },
    { d: 'M13.5 10.5a3.8 3.8 0 0 0-5.4 0l-2.6 2.6a3.8 3.8 0 0 0 5.4 5.4l1.3-1.3' },
  ],

  /** Account — a person inside the ring of an account. */
  account: [
    { c: [12, 12, 8.5] },
    { c: [12, 10, 3] },
    { d: 'M6.6 18.4c1.1-2.3 3-3.4 5.4-3.4s4.3 1.1 5.4 3.4' },
  ],

  /** Connect — a plug, for the accounts that feed the app. */
  connect: [
    { d: 'M9 3v5M15 3v5' },
    { d: 'M6.5 8h11v3a5.5 5.5 0 0 1-11 0z' },
    { d: 'M12 16.5V21' },
  ],

  /** Your data — the cylinder every database has been drawn as. */
  data: [
    { d: 'M4.5 6.5v11c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-11' },
    { d: 'M19.5 6.5c0 1.4-3.4 2.5-7.5 2.5S4.5 7.9 4.5 6.5 7.9 4 12 4s7.5 1.1 7.5 2.5z' },
    { d: 'M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5' },
  ],

  /** Privacy — a shield. */
  privacy: [
    { d: 'M12 3.5 5 6v6c0 4.4 3 7.6 7 8.5 4-.9 7-4.1 7-8.5V6z' },
    { d: 'm9 12 2.2 2.2L15.5 10' },
  ],

  /** Export — the import arrow, turned round: everything back out. */
  export: [{ d: 'M12 3.5V15' }, { d: 'm7.5 10.5 4.5 4.5 4.5-4.5' }, { d: 'M4 15v5.5h16V15' }],

  /** Settings — sliders, which is what the shelf borrowed from it in the first place. */
  settings: [
    { d: 'M4 7h16M4 12h16M4 17h16' },
    { c: [9, 7, 2] },
    { c: [15, 12, 2] },
    { c: [8, 17, 2] },
  ],

  /**
   * Clubs — a trophy. Not the flag on a pole the first attempt used: that is
   * `runway`'s drawing, and two glyphs a shelf apart is exactly the kind of
   * near-collision the grid makes visible.
   */
  activities: [
    { d: 'M7.5 3.5h9V9a4.5 4.5 0 0 1-9 0z' },
    { d: 'M7.5 5H5v1.5A3.5 3.5 0 0 0 8 10' },
    { d: 'M16.5 5H19v1.5a3.5 3.5 0 0 1-3 3.5' },
    { d: 'M12 13.5v3' },
    { d: 'M8.5 20.5h7l-.8-4H9.3z' },
  ],

  /**
   * A paperclip — work filed against a deadline.
   *
   * One stroke, and the bend at the bottom is what makes it read as a clip
   * rather than as a slash: a single diagonal at this size is the "no" glyph.
   * Drawn open rather than as the closed double loop the real object has,
   * because two nested loops at 15px collapse into a blob at stroke 1.5.
   */
  paperclip: [{ d: 'M20 11.5 11 20.5a4.6 4.6 0 0 1-6.5-6.5l8-8a3 3 0 0 1 4.3 4.3l-8 8a1.4 1.4 0 0 1-2-2l7.3-7.3' }],

  /**
   * Profile — the same person as `person`, inside a ring.
   *
   * Two glyphs this close together would normally be the near-collision the
   * grid exists to make visible, and here the collision is the point: the ring
   * is what every phone draws around the little picture of you, and the header
   * button that opens this screen is that picture. `person` stays the plain
   * figure used wherever a *person* is meant — a classmate, a professor — and
   * this is the one that means *you*.
   *
   * The shoulders are cut narrower than `person`'s so the figure sits inside
   * the ring rather than touching it at 19px, where a stroke meeting a stroke
   * reads as a smudge.
   */
  profile: [
    { c: [12, 12, 9] },
    { c: [12, 10, 2.4] },
    { d: 'M6.8 18.7a5.6 5.6 0 0 1 10.4 0' },
  ],

  /** Guide — the question the screen exists to answer. */
  help: [
    { c: [12, 12, 8.5] },
    { d: 'M9.6 9.6a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2-2.5 3.7' },
    { d: 'M12 17.4h.01' },
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
