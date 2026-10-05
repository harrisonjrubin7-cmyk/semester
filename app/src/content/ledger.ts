import type { Ledger } from './terms';

/**
 * Retired words still on screen, per file. Generated — do not edit.
 *
 *     npm run lint:terms -- --fix
 *
 * measures the tree and rewrites this. A file that is not here has none, which
 * is the rule new code is held to. Why this is a ledger rather than a rename is
 * written in `terms.ts`; the migration itself is DD-001 and DD-002 in
 * `docs/design/DESIGN-DEBT.md`.
 */

export const LEDGER: Ledger = {
  'community/detectors.ts': { homework: 2 },
  'components/HelpInbox.tsx': { 'something went wrong': 1 },
  'lib/assignment.ts': { deliverable: 2 },
  'lib/connect.ts': { task: 2, 'to-do': 1 },
  'lib/failure.ts': { 'something went wrong': 1 },
  'lib/flight-plan.ts': { task: 1 },
  'lib/governance/charters.ts': { task: 1 },
  'lib/ltilanding.ts': { 'something went wrong': 1 },
  'lib/nav.ts': { deliverable: 1, homework: 1, task: 2, 'to-do': 1 },
  'lib/oneos.ts': { task: 1 },
  'lib/ops/firstyear.ts': { task: 1 },
  'lib/rollout-capabilities.ts': { task: 1 },
  'lib/toolkit/catalog.ts': { deliverable: 1 },
  'lib/trouble.ts': { 'something went wrong': 1 },
  'screens/Opportunities.tsx': { unverified: 1 },
  'screens/Pathway.tsx': { unverified: 1 },
  'state/shape.ts': { task: 1 },
};
