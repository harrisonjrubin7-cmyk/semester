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
  'components/Command.tsx': { task: 1 },
  'components/HelpInbox.tsx': { 'something went wrong': 1 },
  'components/StudyJournal.tsx': { task: 3 },
  'components/TodayActionCenter.tsx': { task: 1 },
  'components/TodayDecisionSurface.tsx': { task: 1 },
  'components/institutional/FlightPlanCalendar.tsx': { task: 2 },
  'components/mail/Reader.tsx': { task: 1 },
  'components/nav/ByTask.tsx': { task: 1 },
  'screens/Account.tsx': { task: 2 },
  'screens/Career.tsx': { task: 3 },
  'screens/Connect.tsx': { task: 3 },
  'screens/Export.tsx': { task: 1, 'to-do': 1 },
  'screens/Mail.tsx': { task: 1 },
  'screens/Me.tsx': { task: 1 },
  'screens/Mine.tsx': { task: 4 },
  'screens/Nil.tsx': { task: 2 },
  'screens/Onboarding.tsx': { task: 1 },
  'screens/Opportunities.tsx': { unverified: 1 },
  'screens/Pathway.tsx': { unverified: 1 },
  'screens/Privacy.tsx': { task: 1 },
  'screens/Work.tsx': { task: 2 },
  'screens/report/Day.tsx': { task: 2 },
  'screens/report/Week.tsx': { task: 1 },
  'screens/settings/Assistant.tsx': { task: 1 },
};
