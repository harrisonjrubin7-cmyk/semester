/**
 * Canvas, read with a token the student issued themselves.
 *
 * `lib/feedlink.ts` already takes a Canvas *calendar* link, and for a year that
 * was the whole of what this app could see of an LMS. A calendar feed is a good
 * deal for what it costs — no key, no registration, no institutional deal — and
 * it has one hard limit that no amount of parsing gets round: **an .ics says
 * when a thing is due and nothing whatever about whether you did it.** Every
 * entry looks identical on the ninth of never and the morning after you
 * submitted it, so the app has been drawing "Essay 2 · Friday" at a student who
 * handed Essay 2 in on Tuesday.
 *
 * Canvas's REST API knows. `/api/v1/courses/:id/assignments?include[]=submission`
 * answers with the assignment *and* that student's own submission on it —
 * submitted or not, when, the score if it has been marked. That is the half the
 * calendar cannot carry, and it is the half that decides whether a deadline is
 * something to do tonight or something already behind you.
 *
 * ## Why a token the student makes, and not an OAuth app
 *
 * Canvas has a proper OAuth flow, and it needs a developer key issued by
 * whoever administers the instance — which is the institutional deal this file
 * exists to avoid. A personal access token needs nobody: Account → Settings →
 * **+ New Access Token**, and it is on the clipboard in about forty seconds.
 * `lib/connect.ts` makes the same argument for the Brightspace feed, for the
 * same reason, and lands on the same answer: the route that works today without
 * asking anybody's permission beats the better-designed one that needs a
 * meeting first.
 *
 * ## The token is not a feed URL, and it is treated as the stronger thing
 *
 * A Brightspace feed token reads one calendar. A Canvas access token **is the
 * account** — it can read the student's messages and grades, and it can write.
 * This module only ever issues `GET`s to `/api/v1/`, but that is a promise this
 * file makes, not a limit Canvas imposes, so two things follow and both are
 * enforced elsewhere as well as here:
 *
 *  - It goes in a request **body**, never a query string. `fetchIcsVia` in
 *    `lib/cloud.ts` already says why, about a weaker secret: a query string is
 *    the part of a request that lands in every log on the way.
 *  - The forwarder refuses anything that is not a GET under `/api/v1/`, so a
 *    bug here cannot become a write.
 *
 * ## There is no direct route, and that is not a build problem
 *
 * `fetchCalendar` tries the browser first because a minority of calendar hosts
 * do allow it. Canvas allows nobody: it sends no `Access-Control-Allow-Origin`
 * on any API response, by design and on every instance, self-hosted or not.
 * Asking anyway would spend a round trip to be refused, so this does not ask —
 * which leaves the dev server's forwarder while developing, and the account's
 * Edge Function on a deployed build. Where neither is there, the failure says
 * so and points at the calendar link, which needs no server at all.
 */

import { dateToIso, clock } from './date';
import { matchCourse } from './ics';
import type { Course, FeedEvent } from './types';

/** Where the instance lives and what opens it. */
export interface CanvasKey {
  /** Bare hostname — `vanderbilt.instructure.com`, `canvas.school.edu`. */
  host: string;
  token: string;
}

/**
 * A pasted host and token, repaired where the repair is certain.
 *
 * What people paste into the host field is the address bar, because that is
 * where they were when they read the instructions: a whole URL, with a scheme
 * and a path and often the course they happened to have open. The hostname is
 * right there and unambiguous, so it is taken rather than refused.
 *
 * The token is not repaired at all beyond trimming. It is an opaque string and
 * there is no edit to it that is certainly right — a token with a character
 * missing should fail as a token, at Canvas, with Canvas's own message, rather
 * than be guessed at here.
 */
export function readKey(host: string, token: string): { ok: true; key: CanvasKey } | { ok: false; why: string } {
  const key = token.trim();
  let name = host.trim().replace(/^<|>$/g, '');
  if (!name) return { ok: false, why: 'Which Canvas? Paste the address you use to open it.' };

  // The address bar, in whatever state it was copied in.
  if (/^https?:\/\//i.test(name) || name.includes('/')) {
    try {
      name = new URL(/^https?:\/\//i.test(name) ? name : `https://${name}`).hostname;
    } catch {
      return { ok: false, why: `"${host.trim()}" is not an address this can read.` };
    }
  }
  name = name.replace(/^www\./i, '').toLowerCase();

  // A hostname, not a word somebody typed hoping it would be looked up.
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(name)) {
    return { ok: false, why: `"${name}" does not look like a web address.` };
  }
  if (!key) return { ok: false, why: 'The access token is missing — Canvas shows it once, when you make it.' };
  // Canvas writes these as `<instance id>~<secret>` and has for years, but a
  // self-hosted instance on an older build issues a bare string. Refusing one
  // of those would be this file being confident about somebody else's
  // deployment, so the shape is not checked. A wrong token fails at Canvas.
  return { ok: true, key: { host: name, token: key } };
}

/** How the app reaches an API that will not talk to a browser. */
export interface CanvasRoutes {
  /** Swapped in tests. Everything else uses the browser's own. */
  fetcher?: typeof fetch;
  /**
   * The account's forwarder — `fetchCanvasVia` in `lib/cloud.ts`, passed in
   * rather than imported so this module stays clear of the Supabase client and
   * its whole dependency tree. Exactly the arrangement `lib/feedlink.ts` has.
   */
  account?: (key: CanvasKey, path: string) => Promise<string>;
}

/** Optional path that forwards to Canvas while developing — see vite.config.ts. */
export const PROXY_PATH = '/canvas';

/**
 * What Canvas answered for one path, by whichever route this build has.
 *
 * Both routes take the token in a POST body rather than a header, because the
 * dev server and the Edge Function are the ones holding it and the body is the
 * part that stays out of the logs.
 *
 * Throws the most useful failure rather than the last one — a forwarder that is
 * not deployed answers 404 with nothing worth reading, while Canvas itself says
 * whether the token was refused.
 */
async function ask(key: CanvasKey, path: string, routes: CanvasRoutes): Promise<unknown> {
  const fetcher = routes.fetcher ?? fetch;
  let best = '';

  try {
    const res = await fetcher(PROXY_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: key.host, path, token: key.token }),
    });
    const text = await res.text();
    if (res.ok) return JSON.parse(text) as unknown;
    // 404 on the forwarder's own path is a build without one, which says
    // nothing about Canvas and should not be what anybody reads.
    if (res.status !== 404) best = said(text) || `Canvas answered ${res.status}.`;
  } catch {
    best ||= '';
  }

  if (routes.account) {
    try {
      return JSON.parse(await routes.account(key, path)) as unknown;
    } catch (e) {
      const why = e instanceof Error ? e.message : '';
      // The function knows whether the token was refused, the session was
      // stale or the host does not answer, so its message beats what came
      // before it.
      if (why && why !== 'Signed out.') best = why;
    }
  }

  throw new Error(
    best ||
      'Nothing here can reach Canvas — a web page is not allowed to call it directly, and this copy has no forwarder deployed. The calendar link under Calendars needs one.',
  );
}

/** Canvas's own error text, where it sent one. */
function said(text: string): string {
  try {
    const body = JSON.parse(text) as { errors?: { message?: string }[]; error?: string; message?: string };
    const first = body.errors?.[0]?.message;
    return String(first ?? body.error ?? body.message ?? '');
  } catch {
    return '';
  }
}

/** One course, as much of it as this needs. */
interface RawCourse {
  id: number;
  name?: string;
  course_code?: string;
}

/** One assignment with this student's own submission on it. */
interface RawAssignment {
  id: number;
  name?: string;
  due_at?: string | null;
  html_url?: string;
  points_possible?: number | null;
  submission?: {
    submitted_at?: string | null;
    workflow_state?: string;
    score?: number | null;
    graded_at?: string | null;
    missing?: boolean;
  } | null;
}

/**
 * Where a piece of work actually stands, in the words a student would use.
 *
 * This is the whole reason the file exists, so it is worth being exact about
 * what each state is evidence of:
 *
 * - **Graded** is the only one that is certain, and it carries the number.
 * - **Submitted** means Canvas has it and nobody has marked it. It is not
 *   "done well", and the sentence does not imply it.
 * - **Missing** is Canvas's own flag, set when the due date has gone by with
 *   nothing submitted. It is Canvas's claim rather than this app's arithmetic,
 *   which matters: the app does not know about the extension you were granted
 *   by email, and neither does Canvas, but at least the flag is the thing the
 *   professor is also looking at.
 * - **Nothing at all** — no submission record — is left blank rather than
 *   called "not submitted", because an assignment with no submission type
 *   (an in-class presentation, a paper handed over on paper) never gets one
 *   and is not late.
 */
export function standing(sub: RawAssignment['submission'], points: number | null | undefined): string {
  if (!sub) return '';
  if (sub.workflow_state === 'graded' && sub.score != null) {
    const outOf = points != null && points > 0 ? ` / ${points}` : '';
    return `Graded ${sub.score}${outOf}`;
  }
  if (sub.submitted_at) {
    const on = new Date(sub.submitted_at);
    return Number.isNaN(on.getTime()) ? 'Submitted' : `Submitted ${dateToIso(on)}`;
  }
  if (sub.missing) return 'Missing — Canvas has nothing submitted';
  return '';
}

export interface Pulled {
  events: FeedEvent[];
  /** Courses seen, for the line that says what was read. */
  courses: number;
  /** How many carried a submission state — the part an .ics cannot do. */
  known: number;
}

/**
 * Every dated assignment in the student's active courses, as ordinary
 * `FeedEvent`s.
 *
 * Deliberately the same shape the .ics path produces and nothing more, so
 * `lib/reconcile.ts`, the feed screens and everything downstream treat a Canvas
 * pull exactly as they treat a pasted calendar and had nothing to learn. The
 * camera door on `screens/Import.tsx` is the same move for the same reason.
 *
 * What is *not* the same is the note: an .ics leaves it empty and this fills it
 * with where the work stands. That is carried in the existing field rather than
 * a new one precisely so nothing downstream has to know Canvas exists.
 *
 * An assignment with no due date is skipped. It is real work and it belongs to
 * the course, but this is a *calendar* pull and an undated row on a calendar
 * has nowhere to go.
 */
export async function pull(key: CanvasKey, courses: Course[], sourceId: string, routes: CanvasRoutes = {}): Promise<Pulled> {
  const enrolled = (await ask(key, '/api/v1/courses?enrollment_state=active&per_page=50', routes)) as RawCourse[];
  if (!Array.isArray(enrolled)) throw new Error('Canvas answered with something that is not a course list.');

  const events: FeedEvent[] = [];
  let known = 0;

  for (const c of enrolled) {
    if (typeof c?.id !== 'number') continue;
    const label = (c.course_code || c.name || '').trim();
    let work: RawAssignment[];
    try {
      work = (await ask(
        key,
        `/api/v1/courses/${c.id}/assignments?include[]=submission&per_page=100`,
        routes,
      )) as RawAssignment[];
    } catch {
      // One course refusing — a concluded enrolment, a course whose assignments
      // are hidden — is not the pull failing. The rest are still worth having,
      // and a partial answer with the others in it beats an error card.
      continue;
    }
    if (!Array.isArray(work)) continue;

    for (const a of work) {
      if (typeof a?.id !== 'number' || !a.due_at) continue;
      const due = new Date(a.due_at);
      if (Number.isNaN(due.getTime())) continue;
      const title = (a.name || 'Untitled assignment').trim();
      const note = standing(a.submission, a.points_possible);
      if (note) known += 1;
      // Canvas's own end-of-day is 23:59, which is a deadline rather than an
      // appointment: drawn as a time it reads like something starting at
      // midnight. Everything else keeps its clock.
      const minutes = due.getHours() * 60 + due.getMinutes();
      const allDay = minutes >= 23 * 60 + 55;
      events.push({
        id: `canvas-${c.id}-${a.id}`,
        sourceId,
        title,
        date: dateToIso(due),
        at: allDay ? null : minutes,
        time: allDay ? 'All day' : clock(minutes),
        where: label,
        note,
        courseId: matchCourse(courses, `${title} ${label}`),
      });
    }
  }

  return { events, courses: enrolled.length, known };
}
