/**
 * What the database's passback gate said, as a verdict the `/score` route can
 * act on.
 *
 * `public.lti_passback_decision` (20260927180000_lti_integration_binding.sql)
 * does the deciding — kill switches, tenant flags, the connection, the scope —
 * and answers with a word. This file only reads that word, so there is one
 * place the rule lives and it is the one with a check suite on it.
 *
 * ## The one case that is allowed through on an error
 *
 * Edge Functions deploy after CI on main; migrations are applied separately.
 * For the minutes between the two, this code can run against a database that
 * does not have the function yet. Refusing then would switch off the grade
 * passback that has worked since 22 September for every school, for a reason
 * no instructor could see. So a *missing function* answers as the database
 * would have answered for every registration before binding existed:
 * `allowed-unbound`. Any other error refuses — a gate that cannot be read is
 * closed.
 */

export type GateVerdict =
  | { ok: true; bound: boolean }
  | { ok: false; reason: string; detail: string };

const MISSING = /does not exist|schema cache|could not find the function/i;

export function passbackVerdict(
  data: unknown,
  error: { message?: string } | null,
): GateVerdict {
  if (error) {
    const message = error.message ?? '';
    if (MISSING.test(message)) return { ok: true, bound: false };
    return { ok: false, reason: 'gate-failed', detail: message || 'The passback gate could not be read.' };
  }
  if (data === 'allowed') return { ok: true, bound: true };
  if (data === 'allowed-unbound') return { ok: true, bound: false };
  const word = typeof data === 'string' && /^[a-z-]{1,60}$/.test(data) ? data : 'gate-unreadable';
  return { ok: false, reason: 'passback-off', detail: word };
}
