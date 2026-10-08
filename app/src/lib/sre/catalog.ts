/**
 * The service catalog: every unit that can be down, with who answers for it,
 * what it depends on, what a student sees when it fails, and where the
 * procedure for that lives.
 *
 * "Treat every production service, connector, queue, job, database, AI route
 * and user-critical workflow as an operable system" is only checkable if
 * "every" is a list. This is the list, and `sre.test.ts` holds it to the
 * repository rather than to somebody's memory of the repository: a new edge
 * function, a new `cron.schedule` job or a new workflow with no catalog row
 * fails the suite.
 *
 * Three honesty rules, inherited from the SLO drafts.
 *
 * **Ownership is a role, and a role is held by a person or by nobody.**
 * `ROLE_HOLDERS` says who holds each role today and whether anyone backs them
 * up. Every role is held by one person with no backup, which is the largest
 * reliability risk in the repository (DEGRADED-MODE-MAP.md, "The one
 * operator"). The catalog records that as data so the scorecard can count it
 * instead of a document sighing about it.
 *
 * **Criticality is about the student, not the server.** A class is chosen by
 * what an hour of outage costs the person, and a component may not be less
 * critical than something that depends on it. That second sentence is a test.
 *
 * **Nothing here claims a component is healthy, drilled or covered.** Where a
 * property is not true yet the field says so (`null`, `'defined'`), and the
 * scorecard reports the gap.
 */

export type Kind =
  | 'edge_function'
  | 'gateway'
  | 'database'
  | 'static_hosting'
  | 'client'
  | 'external'
  | 'job'
  | 'queue'
  | 'pipeline'
  | 'ai_route';

/**
 * C0 — loss or exposure of student data, or being unable to reach them in an
 *      emergency. C1 — a core daily journey or the only way we would know.
 * C2 — important, can wait hours. C3 — internal, batch or deferrable.
 */
export type Criticality = 'C0' | 'C1' | 'C2' | 'C3';
export const CRITICALITY_ORDER: readonly Criticality[] = ['C0', 'C1', 'C2', 'C3'];

export type Role = 'platform' | 'data' | 'security' | 'billing' | 'ai' | 'integrations' | 'support';
export const ROLES: readonly Role[] = ['platform', 'data', 'security', 'billing', 'ai', 'integrations', 'support'];

export interface RoleHolder {
  role: Role;
  /** Who answers for it today. */
  primary: string;
  /** A trained second person, or null. Null is the honest value for all of them. */
  backup: string | null;
}

export const ROLE_HOLDERS: readonly RoleHolder[] = ROLES.map((role) => ({ role, primary: 'Harrison Rubin', backup: null }));

export interface Component {
  /** `fn:<dir>`, `job:<cron name>`, `queue:<table>`, `pipeline:<workflow>`, or a plain name. */
  id: string;
  name: string;
  kind: Kind;
  criticality: Criticality;
  role: Role;
  /** Journey ids from governance/error-budgets.ts that this component can break. */
  journeys: readonly string[];
  /** Component ids that must be up for this one to work. */
  dependsOn: readonly string[];
  /** What a student experiences when it fails, in their words; and what still works. */
  degraded: string;
  /** The `feature_kill_switch` row or deploy flag that sheds it, if one exists. */
  killSwitch: string | null;
  /** Runbook id in runbooks.ts. */
  runbook: string;
  /** A path from the repository root that proves the component exists. */
  path: string;
}

type Row = [
  id: string, name: string, kind: Kind, crit: Criticality, role: Role, journeys: string, dependsOn: string,
  degraded: string, killSwitch: string | null, runbook: string, path: string,
];

const list = (s: string): string[] => (s ? s.split(' ') : []);

const ROWS: Row[] = [
  // ── Platform dependencies we do not run ───────────────────────────────────
  ['supabase-auth', 'Supabase Auth', 'external', 'C0', 'platform', 'sign_in', '', 'Nobody new can sign in; sessions already open and everything on the device keep working.', null, 'RB-02', 'supabase/config.toml'],
  ['supabase-db', 'Postgres and the REST API', 'database', 'C0', 'data', 'plan_save advisor_agenda_save assignment_draft_save privacy_request_intake today_load', '', 'Sync and shared features stop; the student\'s own week, held on the device, still works and queues its writes.', 'SEMESTER_READ_ONLY', 'RB-03', 'supabase/migrations'],
  ['supabase-edge-runtime', 'Supabase Edge Functions runtime', 'external', 'C0', 'platform', '', '', 'Every server function below answers with an error; the app shows the failure reference and keeps local work.', null, 'RB-04', 'supabase/functions'],
  ['github-pages', 'GitHub Pages (serves the app)', 'static_hosting', 'C1', 'platform', 'today_load', '', 'First visits and updates fail; anyone with the app installed or cached keeps working offline.', null, 'RB-01', '.github/workflows/pages.yml'],
  ['vercel', 'Vercel (previews and institution gateway)', 'external', 'C3', 'platform', '', '', 'No previews. Nothing in production depends on it yet.', null, 'RB-01', 'app/vercel.json'],
  ['stripe', 'Stripe', 'external', 'C1', 'billing', '', '', 'No new checkout; entitlement stays as last verified; payments already made are unaffected.', null, 'RB-06', 'supabase/functions/_shared/stripe.ts'],
  ['anthropic', 'Anthropic API', 'external', 'C2', 'ai', 'ask_semester', '', 'AI features refuse with a plain sentence; every deterministic feature is unaffected.', 'kill.ai_generation', 'RB-05', 'supabase/functions/_shared/clamp.ts'],
  ['openai', 'OpenAI API (institution gateway)', 'external', 'C2', 'ai', 'ask_semester', '', 'Gateway AI answers fail closed; nothing is written on the model\'s behalf.', 'kill.ai_generation', 'RB-05', 'app/server/institution/providers/openai.ts'],
  ['resend', 'Resend (email)', 'external', 'C2', 'support', '', '', 'Support-reply and lead notifications queue and retry; sign-in mail is Supabase\'s own.', null, 'RB-07', 'supabase/functions/support-reply-notify/index.ts'],
  ['web-push', 'Web Push (VAPID)', 'external', 'C1', 'platform', '', '', 'Reminders do not arrive on the lock screen; the in-app views still show the same deadlines.', null, 'RB-07', 'supabase/functions/push/index.ts'],

  // ── What students touch ───────────────────────────────────────────────────
  ['web-app', 'The Semester web app', 'client', 'C1', 'platform', 'sign_in today_load search plan_save assignment_draft_save ask_semester', 'github-pages supabase-auth supabase-db', 'Installed app works offline from the device store; a failed route shows a reference the student can quote.', 'VITE_READ_ONLY', 'RB-01', 'app/src'],
  ['status-page', 'Public status page', 'static_hosting', 'C1', 'support', '', 'github-pages', 'Reads the probes in the visitor\'s own browser, so it can say the app is down while the app is down.', null, 'RB-01', 'app/public/status.html'],
  ['institution-gateway', 'Institution gateway', 'gateway', 'C2', 'integrations', 'advisor_agenda_save', 'supabase-db supabase-auth', 'Gateway answers 503 and records nothing; no production adapter is registered, so no school is affected yet.', 'SEMESTER_READ_ONLY', 'RB-14', 'app/api/institution/[...path].ts'],

  // ── Edge functions (one row per supabase/functions directory) ─────────────
  ['fn:claude', 'AI proxy (shared key, metered)', 'ai_route', 'C2', 'ai', 'ask_semester', 'supabase-edge-runtime supabase-db anthropic', 'The assistant says it is unavailable; study tools that do not call a model keep working.', 'kill.ai_generation', 'RB-05', 'supabase/functions/claude/index.ts'],
  ['fn:billing-checkout', 'Start checkout', 'edge_function', 'C2', 'billing', '', 'supabase-edge-runtime supabase-db stripe', 'Cannot start a purchase; code-held off until live billing is enabled.', null, 'RB-06', 'supabase/functions/billing-checkout/index.ts'],
  ['fn:billing-cancel', 'Cancel at period end', 'edge_function', 'C2', 'billing', '', 'supabase-edge-runtime supabase-db stripe', 'Cancel answers 503; the subscription continues until it can be cancelled.', null, 'RB-06', 'supabase/functions/billing-cancel/index.ts'],
  ['fn:billing-portal', 'Receipts and payment methods', 'edge_function', 'C2', 'billing', '', 'supabase-edge-runtime supabase-db stripe', 'The portal link fails; receipts remain in the provider.', null, 'RB-06', 'supabase/functions/billing-portal/index.ts'],
  ['fn:billing-webhook', 'Stripe webhook receiver', 'edge_function', 'C1', 'billing', '', 'supabase-edge-runtime supabase-db stripe', 'Entitlement stays as last verified; the provider retries, so events arrive late and possibly twice.', null, 'RB-06', 'supabase/functions/billing-webhook/index.ts'],
  ['fn:calendar', 'Published calendar feed', 'edge_function', 'C2', 'platform', '', 'supabase-edge-runtime supabase-db', 'Subscribed calendar apps keep their last copy and stop updating.', null, 'RB-04', 'supabase/functions/calendar/index.ts'],
  ['fn:fetchcal', 'Calendar feed fetch', 'edge_function', 'C3', 'platform', '', 'supabase-edge-runtime', 'Pasting a feed URL fails; existing events are untouched.', null, 'RB-04', 'supabase/functions/fetchcal/index.ts'],
  ['fn:canvas', 'Canvas read proxy', 'edge_function', 'C2', 'integrations', '', 'supabase-edge-runtime', 'The assignment reader says Canvas could not be reached; the student can paste instead.', 'kill.integration_sync', 'RB-14', 'supabase/functions/canvas/index.ts'],
  ['fn:lti', 'LTI 1.3 launch', 'edge_function', 'C2', 'integrations', '', 'supabase-edge-runtime supabase-db supabase-auth', 'Launch from the LMS fails; the student opens Semester directly.', 'kill.integration_sync', 'RB-14', 'supabase/functions/lti/index.ts'],
  ['fn:push', 'Web Push sender', 'edge_function', 'C1', 'platform', '', 'supabase-edge-runtime supabase-db web-push queue:push_queue', 'Reminders queue and are sent late; nothing is dropped while the queue holds.', null, 'RB-07', 'supabase/functions/push/index.ts'],
  ['fn:support-reply-notify', 'Support reply email', 'edge_function', 'C2', 'support', '', 'supabase-edge-runtime supabase-db resend queue:support_notification_outbox', 'Replies still appear in the app; the email nudge is delayed, retried eight times, then dead-lettered.', null, 'RB-07', 'supabase/functions/support-reply-notify/index.ts'],
  ['fn:integration-tick', 'Integration sync tick', 'edge_function', 'C2', 'integrations', '', 'supabase-edge-runtime supabase-db', 'Connections report stale with a freshness label; nothing writes back.', 'kill.integration_sync', 'RB-14', 'supabase/functions/integration-tick/index.ts'],
  ['fn:ops-projector', 'Operations projector batch', 'edge_function', 'C3', 'data', '', 'supabase-edge-runtime supabase-db', 'Private operations projections become stale; authoritative command tables and live reads remain available.', null, 'RB-10', 'supabase/functions/ops-projector/index.ts'],
  ['fn:lead-intake', 'Company-site lead intake', 'edge_function', 'C3', 'support', '', 'supabase-edge-runtime supabase-db', 'The company site form errors; the product is unaffected.', null, 'RB-04', 'supabase/functions/lead-intake/index.ts'],
  ['fn:trust-room', 'Procurement trust-room links', 'edge_function', 'C3', 'security', '', 'supabase-edge-runtime supabase-db', 'A reviewer cannot open the packet; no student is affected.', null, 'RB-04', 'supabase/functions/trust-room/index.ts'],
  ['fn:delete-account', 'Account erasure', 'edge_function', 'C0', 'data', 'privacy_request_intake', 'supabase-edge-runtime supabase-db supabase-auth', 'Deletion fails closed and says so; the request must be retried, never silently dropped.', null, 'RB-04', 'supabase/functions/delete-account/index.ts'],
  ['fn:productivity-sourcecheck', 'Source availability check', 'edge_function', 'C3', 'platform', '', 'supabase-edge-runtime', 'A source shows as unchecked; nothing else changes.', null, 'RB-04', 'supabase/functions/productivity-sourcecheck/index.ts'],

  // ── Queues and outboxes ───────────────────────────────────────────────────
  ['queue:push_queue', 'Push queue', 'queue', 'C1', 'platform', '', 'supabase-db', 'Rows wait; a backlog means reminders arrive late, never that they vanish.', null, 'RB-07', 'supabase/migrations'],
  ['queue:support_notification_outbox', 'Support notification outbox', 'queue', 'C2', 'support', '', 'supabase-db', 'Rows retry with backoff and dead-letter after eight attempts.', null, 'RB-07', 'supabase/migrations'],
  ['queue:integration_dead_letter_events', 'Integration dead letters', 'queue', 'C2', 'integrations', '', 'supabase-db', 'Failed sync events are held for a person; nothing is replayed blindly.', null, 'RB-14', 'supabase/migrations'],
  ['queue:community_escalation_deliveries', 'Community escalation deliveries', 'queue', 'C2', 'support', '', 'supabase-db', 'Escalations wait in the table; delivery is parked until its adapter is deployed.', null, 'RB-07', 'supabase/migrations'],

  // ── Scheduled jobs (one row per cron.schedule in supabase/scheduler.sql) ──
  ['job:push', 'Send due reminders (every 15 min)', 'job', 'C1', 'platform', '', 'fn:push', 'Reminders stop being sent until it runs again.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:support-reply-notify', 'Drain support outbox (every minute)', 'job', 'C2', 'support', '', 'fn:support-reply-notify', 'Support email nudges are delayed.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:escalation-delivery', 'Community escalation delivery (parked)', 'job', 'C2', 'support', '', 'queue:community_escalation_deliveries', 'Parked until its function exists; the table keeps the rows.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:media-scan', 'Community media scan (parked)', 'job', 'C2', 'security', '', 'supabase-db', 'Parked until its function exists.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:integration-sync', 'Integration tick (four times an hour)', 'job', 'C2', 'integrations', '', 'fn:integration-tick', 'Connections go stale and say so.', 'kill.integration_sync', 'RB-10', 'supabase/scheduler.sql'],
  ['job:tombstones', 'Sweep tombstones (weekly)', 'job', 'C3', 'data', '', 'supabase-db', 'Deleted-record markers accumulate; no student-visible effect.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:handoffs', 'Sweep spent hand-offs (daily)', 'job', 'C3', 'security', '', 'supabase-db', 'Finished hand-off rows linger; an unused one still expires at fifteen minutes on its own.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:ai-runtime-metadata', 'AI runtime metadata refresh (daily)', 'job', 'C3', 'ai', '', 'supabase-db', 'Gateway AI status can read stale.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:institution-gateway-retention', 'Purge gateway journal (hourly)', 'job', 'C1', 'data', '', 'supabase-db', 'Journal grows past its retention promise; a legal-hold-aware sweep must not be skipped.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:community-retention', 'Community retention (daily)', 'job', 'C1', 'data', '', 'supabase-db', 'Content outlives its stated retention.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:integration-retention', 'Integration retention (daily)', 'job', 'C1', 'data', '', 'supabase-db', 'Integration history outlives its stated retention.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:lti-nonce', 'Sweep LTI nonces (hourly)', 'job', 'C2', 'security', '', 'supabase-db', 'Nonce table grows; replay protection is unaffected.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:lti-link-ticket', 'Sweep LTI link tickets (hourly)', 'job', 'C2', 'security', '', 'supabase-db', 'Expired link tickets linger.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:capture-expiry', 'Expire captures (hourly)', 'job', 'C2', 'data', '', 'supabase-db', 'Expired captures stay visible past their time.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:invite-retention', 'Invite retention (daily)', 'job', 'C3', 'data', '', 'supabase-db', 'Old invites linger.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:abandoned-signups', 'Remove abandoned sign-ups (daily)', 'job', 'C3', 'data', '', 'supabase-db', 'Unfinished sign-ups linger.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:audit-retention', 'Audit retention (daily)', 'job', 'C1', 'security', '', 'supabase-db', 'Audit records outlive or undershoot their retention rule.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:console-audit-integrity', 'Seal and verify console audit chain (daily)', 'job', 'C1', 'security', '', 'supabase-db', 'A broken audit chain would go unnoticed for longer.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:ledger-chain-integrity', 'Verify ledger chains (daily)', 'job', 'C1', 'security', '', 'supabase-db', 'A broken ledger chain would go unnoticed for longer.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:commercial-dunning', 'Run dunning (hourly)', 'job', 'C2', 'billing', '', 'supabase-db', 'Failed-payment follow-ups are delayed.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:commercial-financial-retention', 'Financial retention (monthly)', 'job', 'C2', 'billing', '', 'supabase-db', 'Financial records are not swept on schedule.', null, 'RB-10', 'supabase/scheduler.sql'],
  ['job:account-health', 'Compute account health (daily)', 'job', 'C3', 'support', '', 'supabase-db', 'Support health scores go stale.', null, 'RB-10', 'supabase/scheduler.sql'],

  // ── Delivery pipelines and monitors ───────────────────────────────────────
  ['pipeline:ci', 'CI (the merge gate)', 'pipeline', 'C2', 'platform', '', 'github-pages', 'Nothing ships; production keeps running what it has.', null, 'RB-08', '.github/workflows/ci.yml'],
  ['pipeline:pages', 'Deploy to Pages', 'pipeline', 'C2', 'platform', '', 'github-pages', 'A fix cannot ship by the normal route.', null, 'RB-08', '.github/workflows/pages.yml'],
  ['pipeline:functions', 'Deploy Edge Functions', 'pipeline', 'C2', 'platform', '', 'supabase-edge-runtime', 'A function fix cannot ship by the normal route.', null, 'RB-08', '.github/workflows/functions.yml'],
  ['pipeline:schema-deploy', 'Schema deploy (Supabase Branching, db push)', 'pipeline', 'C1', 'data', '', 'supabase-db', 'Production silently stops receiving migrations; the repository stays green. This failed unseen for three days on 18 September.', null, 'RB-09', 'supabase/DEPLOY.md'],
  ['pipeline:production-smoke', 'Hourly production probe (the only automated monitor)', 'pipeline', 'C1', 'platform', '', 'github-pages supabase-db', 'Nobody is told the app is down; the next signal is a student message.', null, 'RB-01', '.github/workflows/production-smoke.yml'],
  ['pipeline:drift', 'Daily infrastructure drift check', 'pipeline', 'C1', 'security', '', '', 'Nobody is told that production was changed outside the repository; the next signal is an incident.', null, 'RB-16', '.github/workflows/drift.yml'],
  ['pipeline:infra-apply', 'Infrastructure apply (the one governed way to change production infrastructure)', 'pipeline', 'C2', 'platform', '', '', 'Infrastructure cannot be changed by the governed route; the emergency path in docs/infrastructure/CHANGE-CONTROL.md still exists, and leaves drift to reconcile.', null, 'RB-16', '.github/workflows/infra-apply.yml'],
  ['pipeline:infra', 'Infrastructure pull-request checks (read-only)', 'pipeline', 'C3', 'platform', '', '', 'Infrastructure pull requests lose their format, validate and policy checks.', null, 'RB-08', '.github/workflows/infra.yml'],
  ['pipeline:supply-chain', 'Signed, reproducible build with provenance and SBOM', 'pipeline', 'C3', 'security', '', '', 'Main builds stop being attested; the app itself is unaffected.', null, 'RB-08', '.github/workflows/supply-chain.yml'],
  ['pipeline:docs', 'Documentation impact check (pull requests)', 'pipeline', 'C3', 'platform', '', '', 'A change to a gateway, edge function, screen or script can merge without the page that describes it; the docs tests in npm test still hold the generated and held pages.', null, 'RB-08', '.github/workflows/docs.yml'],
  ['pipeline:contrast', 'Daily contrast sweep', 'pipeline', 'C3', 'platform', '', '', 'A colour regression ships a day later than it could be found.', null, 'RB-08', '.github/workflows/contrast.yml'],
  ['pipeline:hawkscan', 'Dynamic security scan', 'pipeline', 'C3', 'security', '', '', 'Scans pause; no runtime effect.', null, 'RB-08', '.github/workflows/hawkscan.yml'],
  ['pipeline:workflow-lab', 'Workflow Lab checks (standalone Next.js app)', 'pipeline', 'C3', 'platform', '', '', 'The Workflow Lab app loses its automated typecheck, lint, test and build; the Semester app is unaffected.', null, 'RB-08', '.github/workflows/workflow-lab.yml'],
  ['pipeline:codeql', 'Static analysis of the source (CodeQL)', 'pipeline', 'C3', 'security', '', '', 'Source analysis pauses; no runtime effect. Skipped, not red, where code scanning is unavailable.', null, 'RB-08', '.github/workflows/codeql.yml'],
];

export const COMPONENTS: readonly Component[] = ROWS.map(
  ([id, name, kind, criticality, role, journeys, dependsOn, degraded, killSwitch, runbook, path]) => ({
    id, name, kind, criticality, role, journeys: list(journeys), dependsOn: list(dependsOn), degraded, killSwitch, runbook, path,
  }),
);

export const byId = (id: string): Component | undefined => COMPONENTS.find((c) => c.id === id);

/**
 * Objectives by class. **Proposed targets**, written so a recovery drill has
 * something to be measured against; `measured` stays null until one is. The
 * existing `RECOVERY_OBJECTIVES` in `lib/incident-recovery.ts` classifies by
 * data sensitivity and leaves its numbers null for the same reason; these are
 * keyed by *operational* criticality, which is a different question.
 */
export interface ClassTarget {
  rtoMinutes: number;
  rpoMinutes: number;
  /** Scheduled drill cadence, in days, that keeps the number honest. */
  drillEveryDays: number;
  measured: { rtoMinutes: number | null; rpoMinutes: number | null };
}

export const CLASS_TARGETS: Record<Criticality, ClassTarget> = {
  C0: { rtoMinutes: 60, rpoMinutes: 5, drillEveryDays: 90, measured: { rtoMinutes: null, rpoMinutes: null } },
  C1: { rtoMinutes: 240, rpoMinutes: 15, drillEveryDays: 180, measured: { rtoMinutes: null, rpoMinutes: null } },
  C2: { rtoMinutes: 1_440, rpoMinutes: 60, drillEveryDays: 365, measured: { rtoMinutes: null, rpoMinutes: null } },
  C3: { rtoMinutes: 4_320, rpoMinutes: 1_440, drillEveryDays: 365, measured: { rtoMinutes: null, rpoMinutes: null } },
};

/** Transitive dependencies of a component, nearest first. Throws on a cycle. */
export function closure(id: string, seen: string[] = []): string[] {
  const c = byId(id);
  if (!c) throw new Error(`No component called ${id}`);
  if (seen.includes(id)) throw new Error(`Dependency cycle: ${[...seen, id].join(' → ')}`);
  const out: string[] = [];
  for (const d of c.dependsOn) {
    for (const x of [d, ...closure(d, [...seen, id])]) if (!out.includes(x)) out.push(x);
  }
  return out;
}

/** Dependencies less critical than the thing that needs them: the failure the class rule exists to prevent. */
export function inversions(components: readonly Component[] = COMPONENTS): Array<{ component: string; dependency: string }> {
  const rank = (c: Criticality) => CRITICALITY_ORDER.indexOf(c);
  const out: Array<{ component: string; dependency: string }> = [];
  for (const c of components) {
    for (const d of c.dependsOn) {
      const dep = components.find((x) => x.id === d);
      if (dep && rank(dep.criticality) > rank(c.criticality)) out.push({ component: c.id, dependency: d });
    }
  }
  return out;
}

/** Every component that can break a journey: the set an outcome's reliability is really the product of. */
export function journeyComponents(journey: string): Component[] {
  return COMPONENTS.filter((c) => c.journeys.includes(journey));
}
