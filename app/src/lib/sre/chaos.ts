/**
 * Failure experiments: what we believe happens when a dependency breaks, and
 * whether anyone has ever checked.
 *
 * DEGRADED-MODE-MAP.md is "written from the repository, not from a drill" and
 * says so. A belief about failure is a hypothesis. This register turns each
 * row of that map into an experiment with a safe place to run it and an abort
 * condition, and records which have been run. Two have; the rest are
 * `planned`, and a `planned` row is not evidence of anything.
 *
 * Rules the test enforces:
 *   - an `executed` experiment cites evidence, and the file exists;
 *   - nothing is `production` unless it names who approved it and what stops it;
 *   - every experiment names a component that is in the catalog;
 *   - every C0 component is the target of at least one experiment.
 */

export type Environment = 'local' | 'staging' | 'production_with_approval';
export type ExperimentStatus = 'planned' | 'executed';

export interface Experiment {
  id: string;
  component: string;
  /** What we expect, stated so it can be wrong. */
  hypothesis: string;
  /** What is done to the system. */
  injection: string;
  environment: Environment;
  /** The condition that ends the experiment at once. */
  abort: string;
  status: ExperimentStatus;
  /** Dated evidence file for an executed experiment. */
  evidence: string | null;
  /** The runbook the responder should reach for, which the experiment also tests. */
  runbook: string;
}

const X = (
  id: string, component: string, runbook: string, environment: Environment, hypothesis: string, injection: string, abort: string,
  status: ExperimentStatus = 'planned', evidence: string | null = null,
): Experiment => ({ id, component, runbook, environment, hypothesis, injection, abort, status, evidence });

export const EXPERIMENTS: readonly Experiment[] = [
  X('CX-01', 'fn:claude', 'RB-05', 'staging',
    'Engaging kill.ai_generation stops model calls within one request, and the student sees the stated sentence; an unreadable switch table counts as engaged.',
    'Engage the global switch row, then revoke read on the table for the function role.',
    'Any non-AI function begins failing.', 'executed', 'docs/evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json'),
  X('CX-02', 'supabase-db', 'RB-12', 'staging',
    'A logical dump restores into an empty project with schema, rows, event trigger and RLS identical.',
    'Dump, restore into a scratch database, compare fingerprints.',
    'The target resolves to any non-scratch host.', 'executed', 'docs/evidence/restore/2026-09-30-logical-rehearsal.md'),
  X('CX-03', 'supabase-db', 'RB-12', 'staging',
    'A provider-backed point-in-time restore into an isolated project returns the pre-marker state in under the C0 RTO of 60 minutes, with RPO under 5.',
    'Write synthetic markers, select a recovery point between two of them, restore to a new project, run the check suites and the critical flows.',
    'The restore target is the production project, or any integration or notification fires from the target.'),
  X('CX-04', 'supabase-db', 'RB-03', 'staging',
    'With the database unreachable the installed app keeps every local edit, shows queued-change state, and syncs on reconnect without duplication.',
    'Block the REST host at the network layer for 20 minutes during a scripted editing session.',
    'The test device holds data that is not synthetic.'),
  X('CX-05', 'supabase-auth', 'RB-02', 'staging',
    'When auth is down, open sessions continue, new sign-ins fail with the stated message, and no flow falls back to a weaker check.',
    'Return 503 from the auth host for the staging project.',
    'Any request is accepted without a valid session.'),
  X('CX-06', 'supabase-edge-runtime', 'RB-04', 'staging',
    'When the function runtime errors, each function fails closed with a reference, the cron callers retry without duplicating work, and queues hold their rows.',
    'Deploy a version of the shared helper that throws on import to staging only.',
    'A queue row is lost, or a retry sends a duplicate.'),
  X('CX-07', 'fn:billing-webhook', 'RB-06', 'staging',
    'A delayed, duplicated and out-of-order Stripe event stream leaves entitlement correct and every payment applied exactly once.',
    'Replay a recorded event sequence three times, shuffled, with the first delivery delayed 20 minutes.',
    'Any live-mode key is configured on the target.'),
  X('CX-08', 'queue:push_queue', 'RB-07', 'staging',
    'A push provider outage grows the queue without loss, and draining it after recovery sends each reminder once, oldest first, without a burst that trips the provider limit.',
    'Fail the push provider for an hour with 1,000 queued rows, then restore it.',
    'Real subscriptions exist in the target.'),
  X('CX-09', 'pipeline:schema-deploy', 'RB-09', 'staging',
    'A failing migration is visible within one hour to the owner and does not leave production half-migrated.',
    'Merge a migration that fails on a staging branch, and time how long until a human is told.',
    'The target branch is production.'),
  X('CX-10', 'pipeline:production-smoke', 'RB-01', 'staging',
    'Taking the staging app down produces a failed probe and a recorded outage in the next hourly run, and the status page shows it from a clean browser.',
    'Disable the staging deployment and wait one probe period.',
    'The status page reads production.'),
  X('CX-11', 'web-app', 'RB-01', 'staging',
    'With every adapter stubbed to fail, every native journey still passes (the native-first rule from the target architecture).',
    'Run the golden-path suite with the adapter registry replaced by failing adapters.',
    'Any journey that needs a provider is not marked as such.'),
  X('CX-12', 'fn:push', 'RB-11', 'staging',
    'An emergency broadcast to the full staging cohort reaches 95% of recipients within 60 seconds while every other queue is saturated.',
    'Saturate the other queues with synthetic rows, then dispatch an emergency message at cohort scale.',
    'Any message goes to a real device.'),
  X('CX-13', 'fn:integration-tick', 'RB-14', 'staging',
    'A connector returning errors for a day marks its connection stale with a freshness label, opens no write-back, and recovers without replaying dead letters blindly.',
    'Return 500s from a stub connector for 24 simulated hours.',
    'A write-back is attempted.'),
  X('CX-14', 'fn:delete-account', 'RB-04', 'staging',
    'A deletion interrupted midway fails closed, is retryable, and a restore afterwards does not resurrect the erased account.',
    'Kill the function after the erase transaction and before the auth-user delete; then restore a backup taken earlier.',
    'The target holds non-synthetic accounts.'),
];

export const experimentsFor = (component: string): Experiment[] => EXPERIMENTS.filter((e) => e.component === component);
