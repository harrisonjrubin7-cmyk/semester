/**
 * What kind of failure this was — platform §337 of `docs/PLATFORM_REQUIREMENTS.md`.
 *
 * Eight codes, and the point of them is that they are decided from a
 * structured field rather than from a sentence.
 *
 * ## The thing this is for
 *
 * `explainSyncError` in `lib/cloud.ts` classifies by matching English prose
 * out of a database — `/schema cache/`, `/JWT/`, `/row-level security/`. The
 * advice it then gives is good and specific and is kept exactly as it is. What
 * is fragile is the matching: PostgREST wording changes between versions, a
 * proxy can reword an error, and none of those regexes survive a deployment
 * whose database speaks anything but English.
 *
 * And it never had the choice. `state/store.tsx` calls it as
 * `explainSyncError(e instanceof Error ? e.message : String(e))` — the error
 * object is in scope at both call sites and everything but the message is
 * dropped one line before classification. PostgREST returns `code`, Supabase
 * returns `status`; both were thrown away and then guessed at from prose.
 *
 * So this reads the structured field first and falls back to the prose it was
 * already falling back to. It does not replace anybody's advice — see
 * `explainSync`, which adds a code and a reference to the sentence
 * `explainSyncError` already produced.
 *
 * ## What each code carries, and why `kept` is not optional
 *
 * Platform §337 gives the names. Experience §386 and platform §998 give the
 * shape of what to say: **what happened, what was preserved, what the user can
 * do.** The middle one is the part every error message leaves out and the one
 * that decides whether somebody retypes an hour of work, so it is a required
 * field here rather than a sentence somebody remembers to write.
 */

export type Code =
  | 'AUTH_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTEGRATION_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface Failure {
  /** What happened, in a sentence somebody who is not an engineer can read. */
  said: string;
  /** What survived. Platform §998's middle line, and never left blank. */
  kept: string;
  /** What to do about it. */
  next: string;
  /** Whether repeating the same request could succeed without changing anything. */
  retry: boolean;
  /**
   * Whether the server's own words may be shown.
   *
   * Platform §337: do not leak sensitive server details. A validation message
   * names a field the person just typed into and is the most useful thing on
   * the screen; an internal error's message is a stack frame, a table name or
   * a connection string, and is the one case where the raw text is both
   * useless to them and worth not printing.
   */
  verbatim: boolean;
}

export const FAILURES: Record<Code, Failure> = {
  AUTH_REQUIRED: {
    said: 'You are not signed in any more.',
    kept: 'Everything on this device is still here.',
    next: 'Sign in again and this will carry on.',
    retry: false,
    verbatim: false,
  },
  PERMISSION_DENIED: {
    said: 'You do not have access to this.',
    kept: 'Nothing was changed.',
    next: 'If you think you should, ask whoever administers it.',
    retry: false,
    verbatim: false,
  },
  NOT_FOUND: {
    said: 'That is not there.',
    kept: 'Nothing was changed.',
    next: 'It may have been removed. Go back and try from the list.',
    retry: false,
    verbatim: false,
  },
  VALIDATION_ERROR: {
    said: 'Something in that was not accepted.',
    kept: 'Your changes are still on this screen.',
    next: 'Fix what is named below and try again.',
    retry: true,
    verbatim: true,
  },
  CONFLICT: {
    said: 'Something else changed this first.',
    kept: 'Your changes are still on this screen.',
    next: 'Reload to see the current version, then apply your change again.',
    retry: false,
    verbatim: false,
  },
  RATE_LIMITED: {
    said: 'That is happening too quickly.',
    kept: 'Nothing was changed.',
    next: 'Wait a moment and try again.',
    retry: true,
    verbatim: false,
  },
  INTEGRATION_UNAVAILABLE: {
    said: 'A service this needs is not answering.',
    kept: 'Everything already in Semester is still available.',
    next: 'This usually clears on its own. Try again shortly.',
    retry: true,
    verbatim: false,
  },
  INTERNAL_ERROR: {
    /*
     * The one that must not claim anything it cannot check. Platform §1210:
     * never tell somebody something happened unless it can be verified — and
     * the symmetric case is not telling them nothing happened either. An
     * internal error is precisely the case where the write may or may not have
     * landed, so `kept` says that rather than reassuring.
     */
    said: 'Something went wrong at our end.',
    kept: 'Your changes are still on this screen. Whether the last one saved is not certain.',
    next: 'Reload to see what actually saved before changing it again.',
    retry: true,
    verbatim: false,
  },
};

/** PostgreSQL SQLSTATEs and PostgREST codes, which are stable in a way prose is not. */
const BY_CODE: Record<string, Code> = {
  // PostgreSQL
  '28000': 'AUTH_REQUIRED', // invalid_authorization_specification
  '28P01': 'AUTH_REQUIRED', // invalid_password
  '42501': 'PERMISSION_DENIED', // insufficient_privilege — also an RLS refusal
  '23505': 'CONFLICT', // unique_violation
  '23503': 'VALIDATION_ERROR', // foreign_key_violation
  '23502': 'VALIDATION_ERROR', // not_null_violation
  '23514': 'VALIDATION_ERROR', // check_violation
  '22P02': 'VALIDATION_ERROR', // invalid_text_representation
  '40001': 'CONFLICT', // serialization_failure
  '53300': 'RATE_LIMITED', // too_many_connections
  '57014': 'INTEGRATION_UNAVAILABLE', // query_canceled
  // PostgREST
  PGRST301: 'AUTH_REQUIRED', // JWT expired or invalid
  PGRST302: 'AUTH_REQUIRED',
  PGRST116: 'NOT_FOUND', // no rows where one was required
};

/** HTTP status, for anything that answers with one. */
function byStatus(status: number): Code | undefined {
  if (status === 401) return 'AUTH_REQUIRED';
  if (status === 403) return 'PERMISSION_DENIED';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 422 || status === 400) return 'VALIDATION_ERROR';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 502 || status === 503 || status === 504) return 'INTEGRATION_UNAVAILABLE';
  if (status >= 500) return 'INTERNAL_ERROR';
  return undefined;
}

/**
 * The prose fallback, which is what the app had and is kept as the last resort.
 *
 * Deliberately narrower than `explainSyncError`'s patterns: this decides a
 * category, and that decides advice. Where both have an opinion the structured
 * code wins, which is the whole point.
 */
function byWords(text: string): Code | undefined {
  if (/JWT|not authenticated|invalid claim|token .*expired/i.test(text)) return 'AUTH_REQUIRED';
  if (/row-level security|violates policy|permission denied/i.test(text)) return 'PERMISSION_DENIED';
  if (/duplicate key|already exists/i.test(text)) return 'CONFLICT';
  if (/rate limit|too many requests/i.test(text)) return 'RATE_LIMITED';
  if (/fetch failed|network|timed out|unavailable/i.test(text)) return 'INTEGRATION_UNAVAILABLE';
  return undefined;
}

/**
 * Which of the eight this is.
 *
 * Structured first, prose second, `INTERNAL_ERROR` last — and that ordering is
 * the reason this module exists rather than a tidier version of the regexes.
 *
 * Unknown falls to `INTERNAL_ERROR` rather than to a guess, because every
 * other code makes a claim about the cause and a wrong one sends somebody to
 * the wrong remedy. "Something went wrong at our end, and we are not sure the
 * last write landed" is the only honest thing to say about an error nothing
 * recognised.
 */
export function classify(e: unknown): Code {
  if (typeof e === 'object' && e !== null) {
    const o = e as { code?: unknown; status?: unknown; statusCode?: unknown; message?: unknown };
    const code = typeof o.code === 'string' ? o.code : undefined;
    if (code && BY_CODE[code]) return BY_CODE[code];
    const status = typeof o.status === 'number' ? o.status
      : typeof o.statusCode === 'number' ? o.statusCode
      : undefined;
    if (status !== undefined) {
      const found = byStatus(status);
      if (found) return found;
    }
  }
  const text = e instanceof Error ? `${e.name} ${e.message}` : String(e ?? '');
  return byWords(text) ?? 'INTERNAL_ERROR';
}

/**
 * A short reference somebody can read down a phone — platform §503.
 *
 * Four hex digits is sixty-five thousand, which is not an identifier and is
 * not trying to be: it narrows a log search that is already bounded by an
 * account and a minute. Longer would be harder to read aloud and no more
 * useful, and it deliberately carries nothing about the account or the error,
 * so quoting it in a public channel gives nothing away.
 */
export function reference(random: () => number = Math.random): string {
  const n = Math.floor(random() * 0x10000);
  return `SEM-${n.toString(16).toUpperCase().padStart(4, '0')}`;
}

/**
 * The three lines, in the order platform §998 asks for them.
 *
 * `detail` is the server's own words and is included only where the failure
 * says they may be — see `verbatim`.
 */
export function say(code: Code, opts: { ref?: string; detail?: string } = {}): string {
  const f = FAILURES[code];
  const lines = [f.said, f.kept, f.next];
  if (f.verbatim && opts.detail) lines.splice(1, 0, opts.detail);
  if (opts.ref) lines.push(`Reference: ${opts.ref}`);
  return lines.join('\n\n');
}
