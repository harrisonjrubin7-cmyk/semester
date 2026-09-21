/**
 * Saying something is wrong, without writing an email about it.
 *
 * `screens/settings/About.tsx` used to answer this with an address and a
 * request: *write to us, and a bug report that names the screen and what you
 * expected is worth ten that say it is broken*. Both halves of that were the
 * app asking the student to do its own job. The screen they were on is
 * something the app knows; the version they are running is something only the
 * app knows; and a student who has just hit a bug is the person least likely
 * to open a mail client and compose a well-formed report about it.
 *
 * So the app composes it. What is left for the person to write is the one
 * thing no machine can supply — what they expected to happen.
 *
 * ## The context is a shape, never an address
 *
 * This is the whole of the careful part, and `supabase/migrations`'
 * `access_log` reached it first for the same reason: it records *which family*
 * of client fetched a calendar, out of a fixed list, and keeps no
 * user-agent string, because "a log of addresses is a log of where a student
 * was, kept by the app that promised on its own privacy page that it holds
 * nothing of the sort."
 *
 * A route is the same problem wearing different clothes. `#/course/econ` is
 * mild; `#/course/greek-orthodox-theology-seminar` is a disclosure, and the
 * app cannot tell the two apart because a course id is whatever the student's
 * syllabus was called. `?room=vanderbilt/ECON 1020` carries a room key. An
 * item route carries a deadline id.
 *
 * `routeShape` therefore never passes a route through. It keeps the screen
 * name, which is drawn from a fixed alphabet, and replaces **every** later
 * segment with `:id` — not the ones that look like ids, all of them. An
 * allowlist that has to recognise the dangerous case is an allowlist that
 * fails the first time somebody adds a route nobody told it about.
 *
 * Same rule for the device: `deviceClass` reads the viewport and answers
 * phone, tablet or desktop. A user-agent string is a fingerprint and there is
 * no version of "which device was this" worth having one for.
 *
 * None of this is trusted on its own. The table these go into carries check
 * constraints in the same shape, so a future caller that tried to write a raw
 * route would be refused by Postgres rather than by a promise about this file.
 */

/** What kind of thing is being said. Fixed, because the column is. */
export type Kind = 'bug' | 'confusing' | 'idea' | 'wrong' | 'other';

/** The kinds, in the order they are offered. */
export const KINDS: { id: Kind; label: string; blurb: string }[] = [
  { id: 'bug', label: 'Something broke', blurb: 'It did the wrong thing, or nothing at all.' },
  { id: 'confusing', label: 'Confusing', blurb: 'It works, and I could not tell how.' },
  { id: 'wrong', label: 'Wrong information', blurb: 'A date, a grade or a reading is not right.' },
  { id: 'idea', label: 'It should do this', blurb: 'Something that is missing.' },
  { id: 'other', label: 'Something else', blurb: '' },
];

/** Whether a string is one of the five. Narrow, so a stored value can be read back. */
export function isKind(value: string): value is Kind {
  return KINDS.some((k) => k.id === value);
}

/** Phone, tablet or desktop. Fixed, because the column is. */
export type Device = 'phone' | 'tablet' | 'desktop';

/**
 * Which class of screen this is, from the viewport.
 *
 * The numbers are `lib/media.ts`'s, not new ones — the app already decides
 * between the tab bar and the rail at those widths, so a report that says
 * "phone" means the layout the student actually had.
 */
export function deviceClass(width: number): Device {
  if (!Number.isFinite(width) || width <= 0) return 'desktop';
  if (width < 600) return 'phone';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

/** A screen name: lower-case letters and dashes, and short. Anything else is not one. */
const SCREEN = /^[a-z][a-z-]{0,23}$/;

/**
 * A route reduced to its shape — the screen, and `:id` for everything after it.
 *
 * `#/course/econ` → `/course/:id`. `#/today` → `/today`. Anything this cannot
 * read at all → `/other`, which is the answer that gives nothing away when the
 * input is something this was not written for.
 *
 * Query and fragment are dropped before anything else: `?room=` carries a room
 * key and is the single most identifying thing in the address bar.
 */
export function routeShape(href: string): string {
  const hash = href.includes('#') ? href.slice(href.indexOf('#') + 1) : href;
  const path = hash.split('?')[0].split('#')[0];
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return '/';

  /*
   * Matched as written, never lower-cased first.
   *
   * The first version of this normalised the case and then checked it, so
   * `#/SECRETPROJECT` became `/secretproject` — arbitrary text, passed
   * through, by a rule written to stop exactly that. Every route this app has
   * is already lower-case, so nothing legitimate needs the normalisation, and
   * the only thing it could ever have admitted is a segment the app never
   * produced. Caught by its own test.
   */
  const screen = parts[0];
  if (!SCREEN.test(screen)) return '/other';

  // Every later segment, not the ones that look like ids. A rule that has to
  // recognise the dangerous case fails on the route nobody told it about.
  return parts.length === 1 ? `/${screen}` : `/${screen}/:id`;
}

/** Everything the app supplies about the report, and nothing the student has to. */
export interface Context {
  /** The shape of where they were. Never a route. */
  route: string;
  /** Which build. Empty when the build did not stamp one. */
  version: string;
  device: Device;
}

/** The context, from the pieces a caller can see. */
export function context(href: string, width: number, version: string): Context {
  return {
    route: routeShape(href),
    version: version.trim().slice(0, 40),
    device: deviceClass(width),
  };
}

/** The longest note the column takes. A report is a paragraph, not an essay. */
export const MOST = 2000;

/**
 * Whether this can be sent, and what to say when it cannot.
 *
 * The floor is deliberately low. "Back button does nothing" is a good report
 * and is twenty-six characters; a minimum that turned it away in favour of
 * something longer would be the form preferring its own tidiness to the
 * information.
 */
export function sayable(note: string): { ok: boolean; why: string } {
  const said = note.trim();
  if (said.length === 0) return { ok: false, why: 'Say what happened first.' };
  if (said.length > MOST) {
    return { ok: false, why: `That is longer than this box takes — ${said.length} of ${MOST}.` };
  }
  return { ok: true, why: '' };
}

/** The line under the box, so nothing about the report is collected unseen. */
export function shownLine(c: Context): string {
  const bits = [c.route, c.device];
  if (c.version) bits.push(c.version);
  return `Sent with this: ${bits.join(' · ')}`;
}

/**
 * Send it.
 *
 * The only thing in this file that is not a pure function of its arguments,
 * and it is kept to one call for that reason — everything a test would want to
 * pin down is decided above, where no database is needed to ask.
 *
 * The context is recomputed here rather than trusted from the caller, because
 * the row that gets written must be the row the shaping rules produced. A
 * caller that had assembled its own `route` would be exactly the future
 * mistake `supabase/feedback.check.sql` refuses at the column — and being
 * refused by Postgres after a student pressed Send is a worse way to find out
 * than not being able to write the code.
 */
export async function send(
  author: string,
  kind: Kind,
  note: string,
  c: Context,
): Promise<void> {
  const said = sayable(note);
  if (!said.ok) throw new Error(said.why);
  const { cloud } = await import('./cloud');
  const { error } = await (await cloud()).from('feedback').insert({
    author,
    kind,
    note: note.trim().slice(0, MOST),
    route: c.route,
    device: c.device,
    version: c.version,
  });
  if (error) throw new Error(error.message);
}
