/**
 * What the browser calls the page, which until now was "Semester" forever.
 *
 * The app changes screen fifty ways and the `<title>` never moved. That is
 * invisible while you are looking at the app and costly everywhere else the
 * title is the only thing you get:
 *
 *   - **Tabs.** Two guides and the calendar open on a laptop are three tabs
 *     reading "Semester", "Semester", "Semester". Picking the right one means
 *     opening the wrong ones.
 *   - **History and bookmarks.** Every navigation writes a history entry —
 *     `App.tsx` pushes one per screen — and every entry was named after the
 *     app rather than after where it went. A back-button menu of fifty
 *     identical lines is a list you cannot use.
 *   - **The installed app.** Standalone windows and the task switcher print
 *     the title, so an app added to a home screen said nothing about which
 *     of its screens was on.
 *   - **A screen reader.** The title is what is read when a window is
 *     switched to, and on many setups when the page changes underneath. It
 *     was answering "which app" to somebody who already knew, instead of
 *     "which screen" — the one question the rest of the page does not answer
 *     until you go looking for the heading.
 *
 * The heading is already right: `Header` prints the screen's name as the
 * `<h1>` and moves focus to it on every change. This is the same fact said in
 * the one other place the platform reads it from.
 *
 * ## The screen first, the app last
 *
 * Tabs truncate from the right, and the half that survives should be the half
 * that differs. "Semester — Cards" collapses to "Semester —" on a crowded
 * window, which is the shape of the bug this file exists to fix. So the
 * screen's name leads and `Semester` trails it.
 *
 * ## And the course code, when there is one
 *
 * Eleven study screens are named for a mode rather than a subject — Cards,
 * Quiz, Slides, Watch — and are the screens somebody is most likely to have
 * two of open at once. Their name alone does not tell the two apart; the
 * course does. The header already prints it, as the kicker, so the code is
 * taken from there rather than threaded through a second time.
 *
 * Only when the kicker actually starts with a course code. Most kickers are
 * sentences — "The dates the university sets", "Everything but coursework" —
 * and a title of "The dates the university sets · Check the dates · Semester"
 * is the truncation problem again, wearing the fix's clothes.
 */

/** The app, as it is written in `index.html` and the manifest. */
export const APP = 'Semester';

/**
 * A course code at the front of a kicker: `ECON 1020`, `PSCI 1104`, `HIST 1000`.
 *
 * Anchored, so a sentence that happens to contain a code later on — "Counted
 * backwards from the exam" cannot, but a note title could — is left alone. The
 * space is optional and the trailing letter is for the sections some schools
 * letter (`MATH 1300A`), neither of which this term has and both of which cost
 * nothing to accept.
 */
const CODE = /^[A-Z]{2,5} ?\d{3,4}[A-Z]?(?=$| |·)/;

/**
 * The `<title>` for a screen, from the two strings the header already has.
 *
 * `windowTitle` rather than `pageTitle`, which `lib/settings.ts` already has
 * and which means a different thing — the heading a settings page prints on
 * itself. Two functions named for the same idea and answering different
 * questions is how one gets called in the other's place.
 *
 * Pure, so the rule can be read and tested without a document. `Titled` in
 * `App.tsx` is the one caller and does nothing but write this to
 * `document.title` when it changes.
 */
export function windowTitle(title: string, kicker = ''): string {
  const name = title.trim();
  // A screen with no name of its own is the app, not an empty separator.
  if (!name) return APP;
  const code = CODE.exec(kicker.trim())?.[0];
  // `code === name` is the course screen itself, whose title is already the
  // code: "ECON 1020 · ECON 1020 · Semester" says it twice.
  const lead = code && code !== name ? `${code} · ${name}` : name;
  return `${lead} · ${APP}`;
}
