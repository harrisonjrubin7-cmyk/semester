/**
 * The runbook index. Each id is a file in `docs/sre/runbooks/`, and every
 * alert and every catalog row names one. `sre.test.ts` checks that the file
 * exists, that it has the headings a person at 3 a.m. needs in the order they
 * need them, and that nothing refers to a runbook that is not here.
 */

export interface Runbook {
  id: string;
  title: string;
  /** File name inside docs/sre/runbooks/. */
  file: string;
}

export const RUNBOOK_DIR = 'docs/sre/runbooks';

/** The sections every runbook has, in reading order. A runbook missing one is incomplete, not short. */
export const RUNBOOK_SECTIONS = ['Symptom', 'Impact', 'Diagnose', 'Mitigate', 'Escalate', 'Verify', 'After'] as const;

export const RUNBOOKS: readonly Runbook[] = [
  { id: 'RB-01', title: 'App unreachable or serving the wrong build', file: 'RB-01-app-unreachable.md' },
  { id: 'RB-02', title: 'Sign-in failing', file: 'RB-02-sign-in-failing.md' },
  { id: 'RB-03', title: 'Database degraded, writes failing, or a policy gap', file: 'RB-03-database-degraded.md' },
  { id: 'RB-04', title: 'An edge function is erroring', file: 'RB-04-edge-function-erroring.md' },
  { id: 'RB-05', title: 'AI provider failing, or spend running away', file: 'RB-05-ai-provider-or-spend.md' },
  { id: 'RB-06', title: 'Billing webhook or checkout failing', file: 'RB-06-billing.md' },
  { id: 'RB-07', title: 'Queue backlog or dead letters', file: 'RB-07-queue-backlog.md' },
  { id: 'RB-08', title: 'Bad deploy, or a deploy that will not go', file: 'RB-08-bad-deploy-rollback.md' },
  { id: 'RB-09', title: 'Schema deploy failed', file: 'RB-09-schema-deploy-failed.md' },
  { id: 'RB-10', title: 'A scheduled job is not running', file: 'RB-10-scheduled-job.md' },
  { id: 'RB-11', title: 'Campus emergency notification path', file: 'RB-11-emergency-notification.md' },
  { id: 'RB-12', title: 'Restore from backup', file: 'RB-12-restore.md' },
  { id: 'RB-13', title: 'Secret exposed or provider key compromised', file: 'RB-13-secret-exposed.md' },
  { id: 'RB-14', title: 'Connector or integration stale or failing', file: 'RB-14-connector-failing.md' },
  { id: 'RB-15', title: 'Capacity peak or cost spike', file: 'RB-15-capacity-or-cost.md' },
];

export const runbook = (id: string): Runbook | undefined => RUNBOOKS.find((r) => r.id === id);
