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
  'App.tsx': { type: 2, leading: 1 },
  'ai/Assistant.tsx': { type: 1 },
  'ai/Turns.tsx': { dim: 1 },
  'components/Adopting.tsx': { type: 1 },
  'components/Attendance.tsx': { type: 1, leading: 1 },
  'components/Avatar.tsx': { leading: 1 },
  'components/Capture.tsx': { type: 1 },
  'components/Diagram.tsx': { type: 1 },
  'components/FigureCard.tsx': { type: 2, leading: 2 },
  'components/HomeWalk.tsx': { type: 1 },
  'components/HourGrid.tsx': { type: 2, leading: 1 },
  'components/KindKey.tsx': { type: 1 },
  'components/LiveMap.tsx': { dim: 1 },
  'components/PostMortem.tsx': { type: 1 },
  'components/QuickAdd.tsx': { type: 1 },
  'components/RecordButton.tsx': { type: 1, leading: 1 },
  'components/Ringing.tsx': { type: 2 },
  'components/SampleMark.tsx': { type: 1 },
  'components/SayIt.tsx': { type: 1 },
  'components/SchoolPicker.tsx': { type: 1 },
  'components/ScoreField.tsx': { type: 1 },
  'components/TabChooser.tsx': { type: 1 },
  'components/Timer.tsx': { type: 1 },
  'components/TimerLine.tsx': { type: 1 },
  'components/TypeToConfirm.tsx': { type: 1 },
  'components/WeekGrid.tsx': { type: 3, leading: 1 },
  'components/ui.tsx': { type: 1 },
  'screens/Account.tsx': { type: 2, leading: 2 },
  'screens/Activities.tsx': { type: 1 },
  'screens/Analyse.tsx': { type: 1 },
  'screens/Applying.tsx': { type: 1 },
  'screens/Bill.tsx': { type: 1, leading: 1 },
  'screens/Calendar.tsx': { type: 15, leading: 8 },
  'screens/Clocks.tsx': { type: 2 },
  'screens/Connect.tsx': { type: 2, leading: 1 },
  'screens/Costs.tsx': { type: 1, leading: 1 },
  'screens/Courses.tsx': { type: 6, leading: 1 },
  'screens/Drill.tsx': { type: 8, leading: 4 },
  'screens/Exam.tsx': { type: 3, leading: 1 },
  'screens/Export.tsx': { type: 1 },
  'screens/Field.tsx': { type: 9, leading: 7 },
  'screens/FirstRun.tsx': { type: 2, leading: 1 },
  'screens/Gap.tsx': { type: 3, leading: 2 },
  'screens/GapOffer.tsx': { type: 1 },
  'screens/Grades.tsx': { type: 2, leading: 1 },
  'screens/Groupwork.tsx': { type: 1, leading: 1 },
  'screens/Guess.tsx': { type: 2, leading: 2 },
  'screens/Guide.tsx': { type: 17, leading: 14 },
  'screens/Housing.tsx': { type: 1, leading: 1 },
  'screens/Import.tsx': { type: 4, leading: 3 },
  'screens/Lesson.tsx': { type: 4, leading: 3 },
  'screens/Links.tsx': { type: 2 },
  'screens/Me.tsx': { type: 1, leading: 1 },
  'screens/Meals.tsx': { type: 1, leading: 1 },
  'screens/Mine.tsx': { type: 4, leading: 3 },
  'screens/Onboarding.tsx': { type: 4, leading: 1 },
  'screens/People.tsx': { type: 1 },
  'screens/Privacy.tsx': { type: 1, leading: 1 },
  'screens/Profile.tsx': { type: 2, leading: 2 },
  'screens/Runway.tsx': { type: 1, leading: 1 },
  'screens/Slides.tsx': { type: 6, leading: 4 },
  'screens/Sources.tsx': { type: 1 },
  'screens/Springboard.tsx': { type: 5, leading: 2 },
  'screens/Study.tsx': { type: 3, leading: 3 },
  'screens/Today.tsx': { type: 9, leading: 8 },
  'screens/Update.tsx': { leading: 1 },
  'screens/Work.tsx': { type: 3, leading: 1 },
  'screens/changes/AgainstCalendar.tsx': { type: 1, leading: 1 },
  'screens/report/Day.tsx': { type: 1, leading: 1 },
  'screens/report/Term.tsx': { type: 1, leading: 1 },
  'screens/report/Week.tsx': { type: 1, leading: 1 },
  'screens/settings/Page.tsx': { type: 2, leading: 1 },
};
