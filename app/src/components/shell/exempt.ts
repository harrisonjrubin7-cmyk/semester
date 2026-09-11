import type { Screen } from '../../lib/types';

/**
 * Screens whose body must not become an inset list.
 *
 * Three kinds, and the reason is the same each time: the body is one object
 * rather than a run of rows, so a panel around it makes it narrower and harder
 * to read and buys nothing.
 *
 *   **Long-form reading.** A field guide, a lesson, a report, a draft. These
 *   already respect the `readingWidth` setting, and a grouped panel would
 *   fight it.
 *
 *   **Drawn output.** The month and week grids, the flashcard, a chart, a map.
 *   A grid is not a list; a flashcard is one card.
 *
 *   The springboard is not here: it is a nav mode rather than a screen, and
 *   renders as `home`. Its icon grid is drawn by `Springboard.tsx`, which
 *   wraps itself.
 *
 * Applied at the render site rather than inside fifteen screens, so the list
 * is one thing to read and no screen ends up half-converted.
 *
 * Their surrounding chrome — the header, the tab bar, the action rows — is
 * still grouped. Only the body is exempt.
 */
export const EXEMPT: Screen[] = [
  // Long-form reading.
  'guide',
  'lesson',
  'slides',
  'update',
  'brief',
  'essay',
  'work',
  'solve',
  'analyse',
  'ask',
  'mail',
  'proof',
  'classmates',
  // Drawn output, and one large object rather than a list.
  'calendar',
  'drill',
  'quiz',
  'guess',
  'maps',
  'draw',
];

export function isExempt(screen: Screen): boolean {
  return EXEMPT.includes(screen);
}

/**
 * Screens whose body is a drawing, and wants the room to be one.
 *
 * A subset of the exempt list, and a different question from it. Exempt asks
 * "is this a list?"; this asks "does it get better the wider it is?". A month
 * grid, a week grid and a map all do — seven columns and a fortnight of
 * evenings need width, and on a 1440px screen there is width going spare.
 * A field guide does not: it is prose, and prose past about ninety characters
 * is harder to read, not easier, which is what `.prose` and the reading-width
 * setting are already about. A flashcard does not either — it is one card, and
 * a card the width of a monitor is a poster.
 *
 * The mailbox is here for the same reason as the month grid rather than by
 * analogy: it is three columns — folders, the list, the message — and the
 * narrower the window the sooner the middle one stops fitting a subject and
 * its first line on one row. Its own reading column is set inside it, on the
 * message, where the prose actually is.
 *
 * So the drawn screens take `--canvas` on a desktop and everything else takes
 * `--measure`. Below 1180px the two are both `100%` and this changes nothing.
 */
export const CANVAS: Screen[] = ['calendar', 'maps', 'draw', 'mail'];

export function isCanvas(screen: Screen): boolean {
  return CANVAS.includes(screen);
}

/**
 * Screens whose body is the whole box, and does its own scrolling.
 *
 * A third question about a screen's body, kept beside the other two because
 * it is asked about the same thing and the three must agree. Exempt asks "is
 * this a list?"; canvas asks "does it want the room?"; this asks "does it end
 * at the bottom edge?".
 *
 * Nearly every screen is a column of content that stops somewhere and lets
 * `.scrollarea` scroll it. The chat is not: it is a log that scrolls and a
 * composer pinned under it, and the composer belongs on the bottom edge the
 * way it does in every other chat anybody has used. So the shell must not
 * reserve space beneath it — see `.scrollarea.is-filled` in `styles/app.css`
 * for what that reservation was doing there and why it is wrong here.
 *
 * There are three of them now, and the third is the reason to state the test
 * rather than the name. Classmates is a class conversation with a list of
 * rooms beside it: a scrolling transcript, a composer on the bottom edge, its
 * own scroller inside. The mailbox is the same shape from the other side — a
 * rail that does not move, a list that scrolls, a message that scrolls
 * separately beside it, and a toolbar across the top of all three; every mail
 * client anybody has used is built that way, and none of it works inside a
 * page that scrolls as one, where the folders would scroll off the top and
 * the list and the reading pane would be one long column.
 *
 * Whatever is added here has to answer the same question, and the answer is
 * about the screen's own layout rather than about what it holds.
 */
export const FILLS: Screen[] = ['ask', 'classmates', 'mail'];

export function fills(screen: Screen): boolean {
  return FILLS.includes(screen);
}
