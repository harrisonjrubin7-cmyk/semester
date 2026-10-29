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
  /** Executed test that exercises, or mutation-checks, the declared credential boundary. */
  behaviorProof: {
    path: `app/src/${string}.test.ts`;
    evidence: readonly RegExp[];
  };
  /** Required when the guard is `public`. */
  why?: string;
}

const USER = [/\.auth\.getUser\(/] as const;
const proof = (path: `app/src/${string}.test.ts`, ...evidence: RegExp[]): EdgeGuard['behaviorProof'] => ({ path, evidence });

export const EDGE_GUARDS: readonly EdgeGuard[] = [
  { fn: 'billing-cancel', guards: ['user-token'], evidence: USER, behaviorProof: proof('app/src/lib/billing/cancel.test.ts', /handleBillingCancel/, /status\)\.toBe\(401\)/) },
  { fn: 'billing-checkout', guards: ['user-token'], evidence: USER, behaviorProof: proof('app/src/lib/billing/checkout.test.ts', /handleBillingCheckout/, /status\)\.toBe\(401\)/) },
  { fn: 'billing-portal', guards: ['user-token'], evidence: USER, behaviorProof: proof('app/src/lib/billing/portal.test.ts', /handleBillingPortal/, /status\)\.toBe\(401\)/) },
  { fn: 'billing-webhook', guards: ['signature'], evidence: [/STRIPE_WEBHOOK_SECRET/], behaviorProof: proof('app/src/lib/billing/webhook.test.ts', /handleBillingWebhook/, /Stripe-Signature/) },
  { fn: 'calendar', guards: ['link-token'], evidence: [/handleCalendarFeed\(/], behaviorProof: proof('app/src/lib/calendarfeed.test.ts', /handleCalendarFeed/, /rejects malformed link tokens before database work/) },
  { fn: 'canvas', guards: ['user-token'], evidence: [/handleCanvasRequest\(/], behaviorProof: proof('app/src/lib/canvasauth.test.ts', /handleCanvasRequest/, /before protected Canvas fetch/) },
  { fn: 'claude', guards: ['user-token'], evidence: [/handleClaudeRequest\(/], behaviorProof: proof('app/src/lib/claudeauth.test.ts', /handleClaudeRequest/, /before protected generation/) },
  { fn: 'delete-account', guards: ['user-token'], evidence: USER, behaviorProof: proof('app/src/lib/deleteaccount.test.ts', /serveDeleteAccount/, /status\)\.toBe\(401\)/) },
  { fn: 'productivity-sourcecheck', guards: ['user-token'], evidence: [/handleProductivitySourceCheck\(/], behaviorProof: proof('app/src/lib/productivitysourcecheck.test.ts', /handleProductivitySourceCheck/, /rejects a missing, invalid or unreadable session/) },
  { fn: 'fetchcal', guards: ['user-token'], evidence: [/handleFetchcalRequest\(/], behaviorProof: proof('app/src/lib/fetchcalauth.test.ts', /handleFetchcalRequest/, /before protected fetch/) },
  { fn: 'integration-tick', guards: ['scheduler-token'], evidence: [/serveTick\(/], behaviorProof: proof('app/src/lib/integrationtick.test.ts', /serveTick/, /status\)\.toBe\(401\)/) },
  { fn: 'access-saga-tick', guards: ['scheduler-token'], evidence: [/serveTick\(/, /access_saga_tick_authorized/], behaviorProof: proof('app/src/lib/integrationtick.test.ts', /serveTick/, /status\)\.toBe\(401\)/) },
  { fn: 'ops-projector', guards: ['shared-secret'], evidence: [/OPS_PROJECTOR_SECRET/, /serveOpsProjector\(/], behaviorProof: proof('app/src/lib/opsprojector.test.ts', /serveOpsProjector/, /status\)\.toBe\(401\)/) },
  {
    fn: 'lead-intake',
    guards: ['public'],
    evidence: [/rpc\('submit_site_lead'/],
    behaviorProof: proof('app/src/lib/billing/leadintake.test.ts', /handleLeadIntake/, /fails closed on CORS/),
    why: 'A visitor to the public site has no account. The only write is submit_site_lead, which rate-limits and validates in the database (private.site_lead_hits).',
  },
  { fn: 'lti', guards: ['flow-state'], evidence: [/authenticateLtiLaunchRequest\(/, /spend_lti_nonce/, /jwtVerify\(/, /checkHeader\(/], behaviorProof: proof('app/src/lib/ltiauth.test.ts', /authenticateLtiLaunchRequest/, /before protected launch work/) },
  { fn: 'push', guards: ['shared-secret'], evidence: [/CRON_SECRET/, /handlePushRequest\(/], behaviorProof: proof('app/src/lib/pushauth.test.ts', /handlePushRequest/, /before protected work/) },
  { fn: 'support-reply-notify', guards: ['user-token', 'shared-secret'], evidence: [...USER, /CRON_SECRET/, /handleSupportNotice\(/], behaviorProof: proof('app/src/lib/supportnotify.test.ts', /handleSupportNotice/, /status\)\.toBe\(403\)/) },
  { fn: 'trust-room', guards: ['link-token'], evidence: [/handleTrustRoom\(/, /rpc\('trust_room_open'/], behaviorProof: proof('app/src/lib/trust/room-server.test.ts', /handleTrustRoom/, /not-a-token/) },
];
