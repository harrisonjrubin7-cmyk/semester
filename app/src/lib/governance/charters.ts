/**
 * Product charters: the one page every module owes before it ships.
 *
 * A flag says whether something is on. A charter says why it exists, for whom,
 * what it costs, who answers the phone when it breaks, and when somebody will
 * decide whether it should still exist. Every `module.*` and `ops.*` flag in
 * flags.ts has one here — the test enforces it — and connectors are chartered
 * by their data contract instead (data-contracts.ts), because what a connector
 * *is* is the domain it moves.
 *
 * `charterProblems` is the Definition of Ready for the charter itself: a
 * charter with an empty field is not a charter, and one whose review date has
 * passed is a feature nobody has decided to keep.
 *
 * See docs/operating-model/PORTFOLIO-GOVERNANCE.md#product-charter-template.
 */
import type { DataClass } from '../integration/classification';
import type { Route } from './scorecard';

export type Decision = 'build' | 'partner' | 'integrate' | 'defer' | 'decline';

export interface ProductCharter {
  /** The flag this charter governs. */
  flag: string;
  name: string;
  problem: string;
  primaryUser: string;
  /** When [situation], I want to [motivation], so I can [outcome]. */
  jobToBeDone: string;
  buyerAndAdoptionHypothesis: string;
  successMetrics: { behavior: string; workflow: string; institutional: string };
  nonGoals: readonly string[];
  sourceDependency: string;
  fallback: string;
  classification: DataClass;
  accessibilityAcceptance: string;
  costModel: string;
  owners: { product: string; engineering: string; support: string };
  killSwitch: string;
  decision: Decision;
  /** The scorecard route this charter was admitted on. */
  route: Route;
  reviewAt: string;
}

export const CHARTERS: readonly ProductCharter[] = [
  {
    // Written from the flag's own definition in flags.ts (#818): its
    // description, owner, rollout, success criteria and rollback. #813's rule
    // that every module flag has a charter landed alongside it, and the two
    // crossed.
    flag: 'module.institutional_operations', name: 'Operations studio',
    problem: 'Institutional research assembles data dictionaries, lineage and suppressed aggregate exports by hand in spreadsheets, where a per-student figure can slip through.',
    primaryUser: 'Institutional research analyst',
    jobToBeDone: 'When I need to publish or share an aggregate, I want a suppressed, lineage-labelled export straight from the source, so I can hand it on without a spreadsheet step or a privacy review of every cell.',
    buyerAndAdoptionHypothesis: 'Provost and institutional research office; adopted if one pilot school’s IR office produces its termly exports here instead of by hand.',
    successMetrics: {
      behavior: 'Analysts open the studio to prepare an aggregate export.',
      workflow: 'A suppressed, lineage-labelled export is produced without a spreadsheet step.',
      institutional: 'No per-student figure is ever rendered or exported; small cells are suppressed at the source.',
    },
    nonGoals: ['Showing or exporting per-student records', 'Replacing the institution’s data warehouse', 'Storing analyst drafts server-side'],
    sourceDependency: 'Institutional aggregates under outcomes:read, with Semester’s small-cell suppression.',
    fallback: 'The institution’s existing IR reporting process.',
    classification: 'T2', accessibilityAcceptance: 'Keyboard-complete; tables have headers; suppression shown in text, never by colour alone.',
    costModel: 'Read-only aggregate queries; drafts stay on the analyst’s device; no AI or media cost.',
    owners: { product: 'Institutional research', engineering: 'App engineering', support: 'Customer success' },
    killSwitch: 'Tenant policy row off; drafts live on the analyst’s device only, so nothing to undo server-side.',
    decision: 'build', route: 'pilot', reviewAt: '2026-12-15',
  },
  {
    flag: 'module.integration_dashboard', name: 'Integration Dashboard',
    problem: 'Integration staff cannot see which connection is failing, or why, without opening a ticket.',
    primaryUser: 'Institutional integration owner',
    jobToBeDone: 'When a sync fails, I want to see the failing connection and its cause, so I can fix it before students see stale data.',
    buyerAndAdoptionHypothesis: 'CIO office; adopted if it replaces the first support ticket in a pilot term.',
    successMetrics: {
      behavior: 'Integration staff open the dashboard during a sync failure.',
      workflow: 'Failing connection identified without a support ticket.',
      institutional: 'Mean time to resolve connector failures falls term over term.',
    },
    nonGoals: ['Editing source data', 'Showing student records'],
    sourceDependency: 'Semester sync history and connection health tables.', fallback: 'Support runbook and status page.',
    classification: 'T1', accessibilityAcceptance: 'Keyboard-complete; tables have headers; status never by colour alone.',
    costModel: 'Read-only queries; no AI or media cost.',
    owners: { product: 'Integrations product lead', engineering: 'Integrations engineering', support: 'Customer success' },
    killSwitch: 'Tenant policy row off; screen is read-only so nothing to undo.',
    decision: 'build', route: 'core', reviewAt: '2026-12-15',
  },
  {
    flag: 'module.source_freshness_cards', name: 'Source and freshness labels',
    problem: 'A student cannot tell whether an imported fact is current or where it came from.',
    primaryUser: 'Students at a connected school',
    jobToBeDone: 'When I see a deadline or hold, I want to know its source and age, so I can trust it or check it.',
    buyerAndAdoptionHypothesis: 'Registrar and student success; trust survey rises in pilot.',
    successMetrics: {
      behavior: 'Every imported card shows a source and freshness label.',
      workflow: 'Students follow the official link on stale items.',
      institutional: 'Fewer “Semester said…” inquiries to the registrar.',
    },
    nonGoals: ['Correcting source data in Semester'],
    sourceDependency: 'Connector freshness metadata.', fallback: 'Student-entered data, as before.',
    classification: 'T3', accessibilityAcceptance: 'Label is text, read by screen readers with the card.',
    costModel: 'Negligible.',
    owners: { product: 'Student experience lead', engineering: 'App engineering', support: 'Customer success' },
    killSwitch: 'kill.integration_sync, or tenant policy off.',
    decision: 'build', route: 'core', reviewAt: '2026-12-15',
  },
  {
    flag: 'ops.external_ai_generation', name: 'Governed external AI generation',
    problem: 'Institution-connected workflows need generation without T3+ data reaching a provider.',
    primaryUser: 'Students and faculty in courses that allow AI',
    jobToBeDone: 'When my course allows AI, I want source-grounded help, so I can study without breaking policy.',
    buyerAndAdoptionHypothesis: 'Provost and academic technology; adopted where course policy opts in.',
    successMetrics: {
      behavior: 'AI requests stay within the tenant budget.',
      workflow: 'Grounded answers cite course sources.',
      institutional: 'No T3+ datum reaches a provider (audit).',
    },
    nonGoals: ['Unlimited use', 'Consumer model routing for records'],
    sourceDependency: 'Approved provider agreement and the metered gateway.', fallback: 'Source search and templates.',
    classification: 'T2', accessibilityAcceptance: 'Streaming output announced politely; full transcript available.',
    costModel: 'Metered per tenant through the gateway; see AI cost controls.',
    owners: { product: 'AI platform lead', engineering: 'AI platform', support: 'Customer success' },
    killSwitch: 'kill.ai_generation.',
    decision: 'build', route: 'module', reviewAt: '2026-12-15',
  },
  {
    flag: 'ops.data_upload', name: 'Uploads into connected workspaces',
    problem: 'Students need to bring files into institution-connected workspaces safely.',
    primaryUser: 'Students', jobToBeDone: 'When I have a reading or dataset, I want to upload it, so I can work on it alongside course material.',
    buyerAndAdoptionHypothesis: 'Academic technology; adopted once scanning and retention are in place.',
    successMetrics: { behavior: 'Uploads scanned before use.', workflow: 'Uploaded files used in a workspace.', institutional: 'No malware incident.' },
    nonGoals: ['File sharing outside the course'],
    sourceDependency: 'Storage with malware scanning.', fallback: 'Paste text.',
    classification: 'T2', accessibilityAcceptance: 'Upload control labelled; progress announced.',
    costModel: 'Storage per GB and scanning per file; capped per tenant.',
    owners: { product: 'Platform lead', engineering: 'Platform', support: 'Customer success' },
    killSwitch: 'kill.data_upload.', decision: 'build', route: 'module', reviewAt: '2026-12-15',
  },
  {
    flag: 'ops.code_sandbox_enabled', name: 'Code and notebook sandbox',
    problem: 'Data and CS courses need code execution without a campus lab install.',
    primaryUser: 'Students in computational courses',
    jobToBeDone: 'When an assignment needs code, I want to run it in the browser, so I can work without setup.',
    buyerAndAdoptionHypothesis: 'Departments with lab-install burden; pilot in one course.',
    successMetrics: { behavior: 'Runs stay within compute quota.', workflow: 'Assignments completed without local setup.', institutional: 'Lab-install tickets fall.' },
    nonGoals: ['Network egress', 'Persistent servers'],
    sourceDependency: 'Isolated sandbox runtime.', fallback: 'Local instructions.',
    classification: 'T2', accessibilityAcceptance: 'Editor usable by keyboard and screen reader; output as text.',
    costModel: 'Compute seconds per run; quota per course.',
    owners: { product: 'Platform lead', engineering: 'Platform', support: 'Customer success' },
    killSwitch: 'kill.code_execution.', decision: 'build', route: 'pilot', reviewAt: '2026-12-15',
  },
];

/** Structural faults in a charter; empty means it may be admitted. `today` is an ISO date. */
export function charterProblems(c: ProductCharter, today: string): string[] {
  const out: string[] = [];
  const blank = (s: string) => s.trim() === '';
  const text: [string, string][] = [
    ['problem', c.problem], ['primaryUser', c.primaryUser], ['jobToBeDone', c.jobToBeDone],
    ['buyerAndAdoptionHypothesis', c.buyerAndAdoptionHypothesis], ['sourceDependency', c.sourceDependency],
    ['fallback', c.fallback], ['accessibilityAcceptance', c.accessibilityAcceptance], ['costModel', c.costModel],
    ['killSwitch', c.killSwitch], ['owners.product', c.owners.product], ['owners.engineering', c.owners.engineering],
    ['owners.support', c.owners.support], ['metrics.behavior', c.successMetrics.behavior],
    ['metrics.workflow', c.successMetrics.workflow], ['metrics.institutional', c.successMetrics.institutional],
  ];
  for (const [k, v] of text) if (blank(v)) out.push(`${c.flag}: ${k} is empty`);
  if (c.nonGoals.length === 0) out.push(`${c.flag}: no non-goals — a charter that excludes nothing scopes nothing`);
  if (c.decision === 'build' && (c.route === 'partner_or_decline' || c.route === 'reject_or_redesign')) {
    out.push(`${c.flag}: decided build on a scorecard route of ${c.route}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.reviewAt)) out.push(`${c.flag}: reviewAt is not an ISO date`);
  else if (c.reviewAt < today) out.push(`${c.flag}: review date ${c.reviewAt} has passed — renew, revise or sunset`);
  return out;
}
