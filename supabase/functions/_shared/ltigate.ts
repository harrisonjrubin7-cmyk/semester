/**
 * What the database's passback gate said, as a verdict the `/score` route can
 * act on.
 *
 * `public.lti_passback_decision` (20260927180000_lti_integration_binding.sql)
 * does the deciding — kill switches, tenant flags, the connection, the scope —
 * and answers with a word. This file only reads that word, so there is one
 * place the rule lives and it is the one with a check suite on it.
 *
 * The gate is fail-closed. A missing decision function and an unbound
 * registration both refuse passback: deployment order cannot grant access
 * that the current database policy has not positively approved.
 */

export type GateVerdict =
  | { ok: true; bound: boolean }
  | { ok: false; reason: string; detail: string };

export function passbackVerdict(
  data: unknown,
  error: { message?: string } | null,
): GateVerdict {
  if (error) {
    const message = error.message ?? '';
    return { ok: false, reason: 'gate-failed', detail: message || 'The passback gate could not be read.' };
  }
  if (data === 'allowed') return { ok: true, bound: true };
  const word = typeof data === 'string' && /^[a-z-]{1,60}$/.test(data) ? data : 'gate-unreadable';
  return { ok: false, reason: 'passback-off', detail: word };
}
