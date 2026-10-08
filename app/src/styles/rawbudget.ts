import type { Ledger } from './rawvalues.ts';

/**
 * The raw design values each file still carries. Generated — do not edit.
 *
 *     npm run design-system:css -- --fix
 *
 * measures the tree and rewrites this. A list of debts: a file that is not here
 * owes nothing, which is the rule new code is held to. It may shrink and may not
 * grow, and what it does and does not count is written in `rawvalues.ts`.
 * Sorted by path so a branch changes only its own lines.
 */
export const RAW_BUDGET: Ledger = {
  'ai/AskAbout.tsx': { color: 1 },
  'ai/Assistant.tsx': { color: 1 },
  'components/Capture.tsx': { color: 1 },
  'components/CoursePicker.tsx': { color: 1 },
  'components/GridCard.tsx': { color: 2 },
  'components/LiveMap.tsx': { color: 5 },
  'components/creation/VideoEditor.tsx': { color: 1 },
  'components/ui.tsx': { color: 1 },
  'screens/Drill.tsx': { color: 2 },
  'screens/Import.tsx': { color: 1 },
  'screens/Update.tsx': { color: 1 },
  'screens/call/Tile.tsx': { color: 1 },
  'screens/settings/Assistant.tsx': { color: 1 },
  'site/site.css': { color: 2, layer: 2, space: 75, type: 3 },
  'styles/app.css': { color: 55, layer: 28, elevation: 27, motion: 6, space: 6, type: 30 },
  'styles/features.css': { elevation: 3, type: 16 },
  'styles/industry.css': { elevation: 1, type: 4 },
  'styles/operating-rhythm.css': { color: 1 },
  'styles/unity.css': { color: 1 },
};
