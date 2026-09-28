/**
 * The launch war room: the board for the final weeks before a cohort goes
 * live, with daily ownership.
 *
 * Thirteen items, each with a seat that reports it every day and the document
 * it is read from. The point of the board is the rule under it: **no launch
 * happens through informal messaging and memory.** A line on the board names
 * the document it came from; a decision exists only once it is in the
 * go/no-go record that `launchreadiness.ts#decide` reads; a message is
 * neither. What the repository can read for itself — the verdict, the open
 * blockers, the register counts, the seats held — the rendered page prints,
 * so the board starts each day from the tree and not from recollection.
 */

import type { Seat } from '../launchreadiness';

export interface BoardItem {
  id: string;
  /** As the brief names it. */
  item: string;
  /** The seat that reports it, daily. */
  owner: Seat;
  /** The document the line is read from. */
  source: string;
  /** What the owner’s daily line says. */
  daily: string;
}

export const BOARD: readonly BoardItem[] = [
  { id: 'status', item: 'Launch status', owner: 'founder', source: 'docs/GO-NO-GO-CHECKLIST.md', daily: 'The council verdict, and which gate moved since yesterday' },
  { id: 'blockers', item: 'P0/P1 blockers', owner: 'engineering', source: 'app/src/lib/launchreadiness.ts', daily: 'Each open P0 and P1 with its owner and age; none closed without the test that proves it' },
  { id: 'register', item: 'Readiness register', owner: 'founder', source: 'docs/MASTER-LAUNCH-READINESS-REGISTER.md', daily: 'Rows that moved, and the count per gate' },
  { id: 'roles', item: 'Role launch register', owner: 'security', source: 'docs/ROLE-LAUNCH-REGISTER.md', daily: 'The roles the cohort needs switched on, and the rung each has reached' },
  { id: 'findings', item: 'Security/accessibility findings', owner: 'security', source: 'docs/SECURITY-ACCESSIBILITY-READINESS.md', daily: 'Open findings by severity; the accessibility seat reads its half from the WCAG scorecard' },
  { id: 'integrations', item: 'Integration test status', owner: 'data', source: 'docs/UNIVERSITY_CONNECTIONS.md', daily: 'Each connector the cohort depends on: tested, syncing, or not' },
  { id: 'contracts', item: 'Billing/contract status', owner: 'founder', source: 'ops/customer-commitments/README.md', daily: 'The agreement’s state, and every commitment it carries with its due date' },
  { id: 'support', item: 'Support staffing', owner: 'success', source: 'docs/market-readiness/SUPPORT_PLAYBOOK.md', daily: 'Who is on the queue, the hours covered, and yesterday’s volume' },
  { id: 'comms', item: 'Customer communications', owner: 'champion', source: 'docs/launch/ANNOUNCEMENT-TEMPLATES.md', daily: 'What the school has been told, what goes out next, and who approved it' },
  { id: 'approvals', item: 'Go-live approvals', owner: 'founder', source: 'docs/LAUNCH-READINESS-COUNCIL.md', daily: 'Seats signed for this decision, and seats still to sign' },
  { id: 'rollback', item: 'Rollback readiness', owner: 'engineering', source: 'ROLLBACK.md', daily: 'The last rehearsed rollback, its duration, and whether today’s deploy changed the plan' },
  { id: 'contacts', item: 'Incident contacts', owner: 'engineering', source: 'docs/vanderbilt/incident-routing.md', daily: 'That the routing was tested today, and reached a person' },
  { id: 'critical-period', item: 'Academic critical-period plan', owner: 'product', source: 'docs/operating-model/PILOT-TO-PRODUCTION.md', daily: 'Days to the next registration or finals window, and what is frozen until it passes' },
];

/** The rules the board runs under. */
export const RULES: readonly string[] = [
  'Every line on the board names the document it was read from. A line with no document is a rumour.',
  'A decision exists only once it is in the go/no-go record that `decide()` reads. A message, a call or a memory is not a decision.',
  'A seat that is vacant is an item nobody reports. The board shows it as unowned rather than letting the founder report everything.',
  'The board is read from the tree each morning: verdict, blockers, register counts and seats come from the code, not from yesterday’s recollection.',
  'The war room closes when the cohort has launched and hypercare has ended (docs/90-DAY-LAUNCH-PROGRAM.md, `hypercare`), and the daily lines become the weekly operations review.',
];
