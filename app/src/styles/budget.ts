import type { Budget } from './rules';

/**
 * What each file is still owed, off the three scales. Generated — do not edit.
 *
 *     npm run lint:styles -- --fix
 *
 * measures the tree and rewrites this. It is a list of debts: a file that is
 * not here may have none at all, which is the rule new code is held to.
 *
 * Why it is a file per line rather than four numbers for the app, and why
 * that is stricter rather than looser, is written where the rule is —
 * `rules.ts`, under "Why it is counted per file". The short version is that
 * four shared numbers meant every branch in the repository wrote to the same
 * four lines, so every pair of branches conflicted here over a disagreement
 * neither of them had.
 */

export const BUDGET: Budget = {
  'App.tsx': { type: 1 },
  'ai/Turns.tsx': { dim: 1 },
  'components/Attendance.tsx': { type: 1 },
  'components/Capture.tsx': { type: 1 },
  'components/HomeWalk.tsx': { type: 1 },
  'components/LiveMap.tsx': { dim: 1 },
  'components/Ringing.tsx': { type: 2 },
  'components/TabChooser.tsx': { type: 1 },
  'components/WeekGrid.tsx': { type: 3 },
  'screens/Account.tsx': { type: 1 },
  'screens/Activities.tsx': { type: 1 },
  'screens/Applying.tsx': { type: 1 },
  'screens/Calendar.tsx': { type: 1, leading: 1 },
  'screens/Clocks.tsx': { type: 1 },
  'screens/Courses.tsx': { type: 1 },
  'screens/Drill.tsx': { type: 2, leading: 2 },
  'screens/Exam.tsx': { type: 1 },
  'screens/Export.tsx': { type: 1 },
  'screens/Field.tsx': { type: 1, leading: 1 },
  'screens/FirstRun.tsx': { type: 1 },
  'screens/Gap.tsx': { type: 1 },
  'screens/Grades.tsx': { type: 1 },
  'screens/Guess.tsx': { type: 1, leading: 1 },
  'screens/Guide.tsx': { type: 1, leading: 1 },
  'screens/Import.tsx': { type: 1 },
  'screens/Lesson.tsx': { type: 2 },
  'screens/Links.tsx': { type: 2 },
  'screens/Onboarding.tsx': { type: 1, leading: 1 },
  'screens/People.tsx': { type: 1 },
  'screens/Slides.tsx': { type: 2, leading: 1 },
  'screens/Study.tsx': { type: 1 },
  'screens/Today.tsx': { type: 3, leading: 1 },
};
