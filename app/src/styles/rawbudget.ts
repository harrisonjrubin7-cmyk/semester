import type { Ledger } from './designsystem.ts';

/**
 * The raw design values each file still carries. Generated — do not edit.
 *
 *     npm run design-system:audit -- --fix
 *
 * measures the tree and rewrites this. A list of debts: a file that is not here
 * owes nothing, which is the rule new code is held to. It may shrink and may not
 * grow, and what it does and does not count is written in `designsystem.ts`.
 * Sorted by path so a branch changes only its own lines.
 */
export const RAW_BUDGET: Ledger = {
  'ai/AskAbout.tsx': { color: 1, layer: 1 },
  'ai/Assistant.tsx': { color: 1, layer: 2 },
  'ai/Chat.tsx': { layer: 1 },
  'ai/Panel.tsx': { layer: 3, elevation: 1 },
  'ai/Threads.tsx': { layer: 1 },
  'ai/Turns.tsx': { motion: 1 },
  'components/Adopting.tsx': { layer: 1 },
  'components/AiHandoffReview.tsx': { layer: 1 },
  'components/Appearance.tsx': { elevation: 2, radius: 2 },
  'components/Capture.tsx': { color: 1 },
  'components/Command.tsx': { layer: 2, elevation: 1 },
  'components/CoursePicker.tsx': { color: 1 },
  'components/Fresh.tsx': { layer: 1, elevation: 1 },
  'components/GridCard.tsx': { color: 2 },
  'components/HourGrid.tsx': { elevation: 1 },
  'components/InstitutionalPreviewBar.tsx': { layer: 1 },
  'components/Keys.tsx': { layer: 1, elevation: 1 },
  'components/LiveMap.tsx': { color: 5, layer: 1 },
  'components/Popover.tsx': { layer: 1, elevation: 1 },
  'components/QuickAdd.tsx': { layer: 1 },
  'components/ReadingProgress.tsx': { radius: 1 },
  'components/ReferralLink.tsx': { radius: 1 },
  'components/Ringing.tsx': { layer: 1 },
  'components/Running.tsx': { radius: 1 },
  'components/SayIt.tsx': { radius: 1 },
  'components/TabPeek.tsx': { layer: 1, elevation: 1 },
  'components/TypeToConfirm.tsx': { layer: 1 },
  'components/Undone.tsx': { layer: 1, elevation: 1, radius: 1 },
  'components/Waiting.tsx': { radius: 1 },
  'components/YourCourses.tsx': { radius: 2 },
  'components/creation/VideoEditor.tsx': { color: 1 },
  'components/ui.tsx': { color: 1 },
  'screens/Drill.tsx': { color: 2 },
  'screens/Exam.tsx': { layer: 1 },
  'screens/Gap.tsx': { motion: 1 },
  'screens/Import.tsx': { color: 1 },
  'screens/Mail.tsx': { layer: 1 },
  'screens/Today.tsx': { layer: 1, radius: 1 },
  'screens/Update.tsx': { color: 1 },
  'screens/call/Green.tsx': { motion: 1 },
  'screens/call/Tile.tsx': { color: 1 },
  'screens/me/You.tsx': { elevation: 1 },
  'screens/settings/Assistant.tsx': { color: 1 },
  'screens/settings/Look.tsx': { radius: 1 },
  'site/site.css': { color: 2, layer: 2, space: 75, type: 3 },
  'styles/app.css': { color: 55, layer: 28, elevation: 27, motion: 6, space: 6, type: 30 },
  'styles/features.css': { elevation: 3, type: 16 },
  'styles/industry.css': { elevation: 1, type: 4 },
  'styles/operating-rhythm.css': { color: 1 },
  'styles/unity.css': { color: 1 },
};
