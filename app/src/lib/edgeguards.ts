/**
 * How every edge function decides who is asking.
 *
 * `supabase/config.toml` sets `verify_jwt = false` on every function, for the
 * reason it gives at the top of that block: the platform check would reject a
 * CORS preflight, so each function checks its caller itself. That is a sound
 * design with one weakness. A new function that is added to `config.toml`,
 * copied from the nearest neighbour and never given a check of its own is
 * *open*, and nothing fails: the platform's check is already off, and the
 * function answers.
 *
 * This is the default-deny for it. A function is not deployable until it is
 * listed here with the kind of credential it answers to, and the source must
 * carry the evidence for that kind. `edgeguards.test.ts` holds the list to the
 * directory both ways and each function to its evidence. A function that
 * answers anyone is a legitimate thing to write; it has to say `public` and
 * say why, in a place a reviewer will see the diff.
 *
 * What this proves is *presence*. It cannot prove the check is correct: that
 * is each function's own test. It stops the check from being absent without
 * anyone having said so.
 */

export type Guard =
  /** The caller's Supabase session token, resolved with `auth.getUser`. */
  | 'user-token'
  /** A shared secret in the Authorization header, set by the scheduler. */
  | 'shared-secret'
  /** A signature over the request body, made with a secret only the sender holds. */
  | 'signature'
  /** A credential the request carries in its URL or body, resolved by the database. */
  | 'link-token'
  /** A single-use flow state, plus a signed token verified against a registered key set. */
  | 'flow-state'
  /** A token the database checks against Vault. */
  | 'scheduler-token'
  /** Answers anyone. Must carry a reason. */
  | 'public';

export interface EdgeGuard {
  fn: string;
  guards: readonly Guard[];
  /** Source patterns that must all appear in `supabase/functions/<fn>/index.ts`. */
  evidence: readonly RegExp[];
  /** Required when the guard is `public`. */
  why?: string;
}

const USER = [/\.auth\.getUser\(/] as const;

export const EDGE_GUARDS: readonly EdgeGuard[] = [
  { fn: 'billing-cancel', guards: ['user-token'], evidence: USER },
  { fn: 'billing-checkout', guards: ['user-token'], evidence: USER },
  { fn: 'billing-portal', guards: ['user-token'], evidence: USER },
  { fn: 'billing-webhook', guards: ['signature'], evidence: [/STRIPE_WEBHOOK_SECRET/] },
  { fn: 'calendar', guards: ['link-token'], evidence: [/TOKEN\.test\(/, /rpc\('read_feed'/] },
  { fn: 'canvas', guards: ['user-token'], evidence: USER },
  { fn: 'claude', guards: ['user-token'], evidence: USER },
  { fn: 'delete-account', guards: ['user-token'], evidence: USER },
  { fn: 'productivity-sourcecheck', guards: ['user-token'], evidence: USER },
  { fn: 'fetchcal', guards: ['user-token'], evidence: USER },
  { fn: 'integration-tick', guards: ['scheduler-token'], evidence: [/serveTick\(/] },
  {
    fn: 'lead-intake',
    guards: ['public'],
    evidence: [/rpc\('submit_site_lead'/],
    why: 'A visitor to the public site has no account. The only write is submit_site_lead, which rate-limits and validates in the database (private.site_lead_hits).',
  },
  { fn: 'lti', guards: ['flow-state'], evidence: [/spend_lti_nonce/, /jwtVerify\(/, /checkHeader\(/] },
  { fn: 'push', guards: ['shared-secret'], evidence: [/CRON_SECRET/, /Bearer \$\{CRON_SECRET\}/] },
  { fn: 'support-reply-notify', guards: ['user-token', 'shared-secret'], evidence: [...USER, /CRON_SECRET/, /handleSupportNotice\(/] },
  { fn: 'trust-room', guards: ['link-token'], evidence: [/handleTrustRoom\(/, /rpc\('trust_room_open'/] },
];
