// Decision register (implementation blueprint §10): inputs the build must not guess. Pure rules, no database access.
// Open → Proposed (an answer with evidence) → Decided (confirmed by a different person). Decided can be reopened with a reason.
export type DecisionStatus = 'open' | 'proposed' | 'decided';
export const DECISION_SEEDS: [key: string, input: string, controls: string][] = [
  ['repo', 'Repository, branch, and current uncommitted work', 'What can safely be changed'],
  ['book2', 'Accessible Book 2 content', 'Detailed product coverage and traceability'],
  ['cohort', 'First customer segment and launch cohort', 'Initial acceptance journeys'],
  ['fields', 'Institution-authorized data fields', 'Integration and storage scope'],
  ['sources', 'Authoritative system for each record type', 'Read models, reconciliation, write-back limits'],
  ['roles', 'Approved roles and delegation policies', 'Authorization matrix'],
  ['ai', 'Approved AI use cases and providers', 'Gateway policy and evaluation'],
  ['envs', 'Supported deployment environments', 'Infrastructure and release process'],
  ['support', 'Contractual support commitments', 'Staffing, alerts, escalation'],
  ['retention', 'Retention and deletion obligations', 'Data lifecycle'],
  ['plans', 'Approved commercial plans', 'Billing and entitlements'],
  ['reviewers', 'Security, legal, accounting, and accessibility reviewers', 'Required human approvals'],
  ['budget', 'Budget and delivery capacity', 'Sequencing and operational sustainability'],
];

export type Act = { kind: 'propose'; answer: string; evidence: string } | { kind: 'confirm' } | { kind: 'reopen'; reason: string };
export type Row = { status: DecisionStatus; proposedBy: string | null };

/** Returns the error a person should see, or null when the transition is allowed. */
export function checkTransition(row: Row, act: Act, me: string): string | null {
  if (act.kind === 'propose') {
    if (row.status === 'decided') return 'This is decided. Reopen it with a reason first.';
    if (act.answer.trim().length < 5) return 'Write the answer.';
    if (act.evidence.trim().length < 10) return 'Say where the answer comes from (document, person, date).';
    return null;
  }
  if (act.kind === 'confirm') {
    if (row.status !== 'proposed') return 'Only a proposed answer can be confirmed.';
    if (row.proposedBy === me) return 'You proposed this answer, so someone else has to confirm it.';
    return null;
  }
  if (row.status !== 'decided') return 'Only a decided item can be reopened.';
  if (act.reason.trim().length < 5) return 'Say why it needs to be reopened.';
  return null;
}

export const nextStatus = (act: Act): DecisionStatus => (act.kind === 'propose' ? 'proposed' : act.kind === 'confirm' ? 'decided' : 'open');
