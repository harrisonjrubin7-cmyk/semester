/**
 * Grade passback: the rules for telling Brightspace a number.
 *
 * The third and last LTI direction, and the only one that starts here. A
 * launch is the platform calling us. Deep linking is the platform asking a
 * question and waiting. This is Semester, later, with no launch in progress
 * and no session from the platform, saying "this student scored 8 of 10" to
 * a gradebook column — which is why it needed the key before it could exist,
 * and why `_shared/ltikey.ts` carries the token exchange it uses.
 *
 * ## What is sent, and what decides whether anything is
 *
 * **The instructor decides.** When a link is placed in a course as a graded
 * activity, the launch's Assignment and Grade Services claim names a *line
 * item*: the column that link owns. Placed as an ordinary link, the claim
 * names none, and `readEndpoint` below refuses with `not-graded`. This tool
 * never creates a column and never writes to a course whose instructor did
 * not ask — the whole feature is gated on a decision made in Brightspace.
 *
 * **The number is the quiz.** Of everything a student does in this app, the
 * quiz is the one thing that produces a score they would recognise as one:
 * ten questions, a count right. Reading progress is deliberately not a grade
 * (`lib/progress.ts` refuses to say whether anyone is behind), and neither is
 * a drill. So `scoreBody` takes a given and a maximum, and the app hands it
 * the quiz's.
 *
 * **The course is matched, not configured.** The app knows course codes and
 * the platform knows course titles, and nobody has typed the mapping between
 * them anywhere. `matchLineItem` finds the one line item whose context title
 * contains the code, and refuses — rather than guessing — when there are
 * none or several. A guess here is a grade in the wrong column.
 *
 * ## Everything here is pure
 *
 * Same rule as the other `_shared/lti*.ts` files: arguments in, values out,
 * no `Deno.env` and no fetch, so `app/src/lib/ltiags.test.ts` walks every
 * branch. The two network calls — the token exchange and the score POST —
 * live in the function, and take what these return.
 */

import { SCOPE } from './ltikey.ts';

const AGS = 'https://purl.imsglobal.org/spec/lti-ags';

export const AGS_CLAIM = {
  endpoint: `${AGS}/claim/endpoint`,
} as const;

/** What a score is posted as. The platform refuses anything else with a 415. */
export const SCORE_MEDIA = 'application/vnd.ims.lis.v1.score+json';

/** What a refusal carries. Mirrors `_shared/lti.ts`, deliberately. */
export interface Refused {
  ok: false;
  reason: string;
  detail: string;
}
export type Verdict<T> = { ok: true; value: T } | Refused;

const no = (reason: string, detail: string): Refused => ({ ok: false, reason, detail });

/** Where a launch said its grades go. */
export interface AgsEndpoint {
  /** The column this link owns. Present only when the link is graded. */
  lineitem: string;
  /** The course's container of columns, when the platform sent one. */
  lineitems: string | null;
  /** What the platform will let a token do. */
  scopes: string[];
}

/**
 * The AGS claim, read strictly, and the one rule that makes this a feature
 * rather than a hazard.
 *
 * Absent claim: the platform does not do grades for this tool, or was not
 * asked to. Absent `lineitem`: the link is placed but not graded. Both are
 * ordinary and both are refusals here, because the caller's next step is to
 * *store an address it will later post a grade to*, and there is no such
 * address. Refusing by name keeps the log honest about which it was.
 *
 * `score` must be among the granted scopes. A token without it can read the
 * column and not write it, and finding that out at post time is a 403 several
 * requests away from the launch that could have said so.
 */
export function readEndpoint(claims: Record<string, unknown>): Verdict<AgsEndpoint> {
  const raw = claims[AGS_CLAIM.endpoint];
  const ep = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
  if (!ep) return no('no-endpoint', 'The launch carried no grade services claim.');

  const lineitem = typeof ep.lineitem === 'string' ? ep.lineitem.trim() : '';
  if (!lineitem) {
    return no('not-graded', 'The link is placed in the course but not as a graded activity.');
  }
  if (!lineitem.startsWith('https://')) {
    return no('insecure-lineitem', `Line item ${lineitem} is not https.`);
  }

  const lineitems = typeof ep.lineitems === 'string' && ep.lineitems.trim()
    ? ep.lineitems.trim()
    : null;
  if (lineitems && !lineitems.startsWith('https://')) {
    return no('insecure-lineitems', `Line items container ${lineitems} is not https.`);
  }

  const scopes = Array.isArray(ep.scope)
    ? ep.scope.filter((s): s is string => typeof s === 'string')
    : [];
  if (!scopes.includes(SCOPE.score)) {
    return no('no-score-scope', 'The platform granted no scope that can write a score.');
  }

  return { ok: true, value: { lineitem, lineitems, scopes } };
}

/**
 * Where scores are posted for a line item.
 *
 * The standard says append `/scores` to the line item URL, and the part that
 * catches people is that line item URLs carry query strings — Brightspace's
 * do — so the path segment has to go *before* the `?`, not on the end of the
 * string. Appending to the string produces a URL the platform answers 404 to,
 * with no hint that the query was the problem.
 */
export function scoresUrl(lineitem: string): string {
  const url = new URL(lineitem);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/scores`;
  return url.toString();
}

export interface ScoreInput {
  /** The platform's id for the student — `sub` from their launch. */
  userId: string;
  given: number;
  max: number;
  /** Epoch milliseconds. Passed in so a test can fix it. */
  at: number;
}

/**
 * The score document.
 *
 * `activityProgress` and `gradingProgress` are the two fields that are easy
 * to leave at defaults and wrong to. A score with progress `Initialized` is
 * a column showing nothing; with `gradingProgress` anything but
 * `FullyGraded` it is a number the gradebook holds but does not show. A quiz
 * that has ended is complete and its mark is final, so both say so.
 *
 * Refuses a score it cannot stand behind: a non-finite number, a negative,
 * a maximum of zero (which makes every score a division by it), or more
 * given than there was to give.
 */
export function scoreBody(input: ScoreInput): Verdict<Record<string, unknown>> {
  const { userId, given, max, at } = input;
  if (!userId.trim()) return no('no-user', 'A score needs the platform’s id for the student.');
  if (!Number.isFinite(given) || !Number.isFinite(max)) {
    return no('bad-score', `Score ${given} of ${max} is not a number.`);
  }
  if (max <= 0) return no('bad-score', `A maximum of ${max} makes every score meaningless.`);
  if (given < 0 || given > max) {
    return no('bad-score', `Score ${given} is outside 0 to ${max}.`);
  }
  if (!Number.isFinite(at)) return no('bad-time', 'A score needs a timestamp.');

  return {
    ok: true,
    value: {
      userId: userId.trim(),
      scoreGiven: given,
      scoreMaximum: max,
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      timestamp: new Date(at).toISOString(),
    },
  };
}

/** One remembered column, as `lti_line_item` holds it. */
export interface LineItemRow {
  issuer: string;
  subject: string;
  client_id: string;
  context_id: string;
  context_title: string | null;
  lineitem_url: string;
  scopes: string[];
}

/** Letters and digits, upper-cased. "PSCI-2100", "psci 2100" and "PSCI2100" agree. */
export function normalise(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * The column a course's score goes to, or exactly why not.
 *
 * Three refusals, and the middle one is the point of the function:
 *
 *  - a code too short to mean anything. "PS" is in every political science
 *    course a school has, and a rule that matched on it would report every
 *    student's every quiz to whichever column sorted first;
 *  - **several columns match.** Two graded Semester links in two courses
 *    whose titles both contain the code — cross-listed courses do this — and
 *    the right answer is not "the first one", it is "not without asking".
 *    The detail names them so the log says which;
 *  - none. The ordinary case: this course is not graded in Brightspace, or
 *    was never launched from it.
 */
export function matchLineItem(rows: LineItemRow[], code: string): Verdict<LineItemRow> {
  const want = normalise(code);
  if (want.length < 4) {
    return no('code-too-short', `Course code "${code}" is too short to match a course title safely.`);
  }
  const hits = rows.filter((r) => normalise(r.context_title ?? '').includes(want));
  if (hits.length === 0) return no('no-match', `No graded Brightspace course matches ${code}.`);
  if (hits.length > 1) {
    const titles = hits.map((h) => h.context_title ?? h.context_id).join('; ');
    return no('ambiguous', `${hits.length} graded Brightspace courses match ${code}: ${titles}.`);
  }
  return { ok: true, value: hits[0] };
}

/**
 * The bearer token out of a token-endpoint reply, or why there is none.
 *
 * Strict about `token_type`, because a platform that answers with something
 * other than a bearer token is telling us the exchange did not go the way we
 * think it did, and sending whatever it returned as `Authorization: Bearer`
 * is how a debugging session starts with the wrong assumption.
 */
export function tokenResponse(json: unknown): Verdict<string> {
  const body = json && typeof json === 'object' && !Array.isArray(json)
    ? (json as Record<string, unknown>)
    : null;
  if (!body) return no('no-token', 'The token endpoint did not answer with an object.');
  const token = typeof body.access_token === 'string' ? body.access_token.trim() : '';
  if (!token) return no('no-token', 'The token endpoint answered without an access token.');
  const type = typeof body.token_type === 'string' ? body.token_type.toLowerCase() : '';
  if (type !== 'bearer') return no('not-bearer', `Token type ${type || '(absent)'} is not bearer.`);
  return { ok: true, value: token };
}
