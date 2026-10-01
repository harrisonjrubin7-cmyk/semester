/**
 * "What would help most today?" — the first-session goal.
 *
 * Progressive setup instead of a long form: the first question a student is
 * asked is what they came for, and the answer takes them straight into the
 * workflow that serves it. Connecting accounts, adding courses and choosing
 * preferences come later, when a workflow needs them.
 *
 * Stored as the `goal` look key and changeable any time — Today shows the
 * choice with a "Change" beside it, and it never unlocks or hides anything.
 * It decides what is suggested first; everything else is where it was.
 */

import type { Screen } from './types';

export interface Goal {
  id: string;
  label: string;
  /** Where choosing it takes you. */
  screen: Screen;
  /** The suggested first step, in the words Today will show. */
  first: string;
}

export const GOALS: Goal[] = [
  { id: 'semester', label: 'Build my semester', screen: 'import', first: 'Add a syllabus to put its deadlines on your calendar' },
  { id: 'degree', label: 'Understand my degree path', screen: 'pathway', first: 'Review what your degree still needs' },
  { id: 'registration', label: 'Prepare for registration', screen: 'registrar', first: 'Check your registration readiness' },
  { id: 'week', label: 'Organize my week', screen: 'calendar', first: 'Review your week and add a study block' },
  { id: 'meeting', label: 'Prepare for a meeting', screen: 'meet', first: 'Build your advisor agenda and questions' },
  { id: 'privacy', label: 'Manage my data and settings', screen: 'privacy', first: 'Review your data and sharing controls' },
  { id: 'study', label: 'Study for a course', screen: 'study', first: 'Pick a course and a way to study it' },
  { id: 'support', label: 'Find campus support', screen: 'university', first: 'See the campus services you can reach' },
  { id: 'career', label: 'Explore careers', screen: 'career', first: 'Look at what is due for applications' },
];

export function goalOf(id: string | undefined): Goal | null {
  return GOALS.find((g) => g.id === id) ?? null;
}
