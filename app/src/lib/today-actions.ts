import type { Action } from './actions';
import { toHash } from './route';
import type { PathSnapshot } from './today-decision';
import type { DatedItem } from './types';

/**
 * The actions Today proposes, worked out from what Today already reads.
 *
 * `nextTodayDecision` picks *one* thing from these same inputs, in a fixed
 * order. The Action Center needs all of them — the most important and the
 * next few — ranked by `lib/actions.ts` rather than by the order of the ifs.
 * So this returns every candidate that function considers, each with the
 * source, explanation and primary action the explanation sheet shows.
 *
 * Ids are stable across renders and days (`deadline:<item id>`, `path:…`),
 * because a student's snooze or dismissal is stored against the id; an id
 * that changed with the clock would forget what they chose.
 *
 * ## Source labels
 *
 * - A deadline checked against its syllabus is **imported**; one that is not
 *   is **needs review**, the same "verify source" the 72-hour rail says.
 * - The path is an **estimate**: arithmetic over requirements the student
 *   entered, never the registrar's audit.
 * - Due reviews are an **estimate** from the spacing schedule.
 * - An empty workspace is simply what the student has entered.
 */

/** Deadlines further out than this are left to the calendar. */
export const DEADLINE_HORIZON_DAYS = 14;

export interface TodayActionInput {
  path: PathSnapshot;
  upcoming: DatedItem[];
  done: Record<string, boolean>;
  reviewDue: number;
  catalogEmpty: boolean;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function todayActions(input: TodayActionInput): Action[] {
  const out: Action[] = [];

  for (const item of input.upcoming) {
    if (input.done[item.id] || item.daysAway > DEADLINE_HORIZON_DAYS || item.daysAway < 0) continue;
    const confirmed = item.checked?.confirmed === true;
    const dueAt = item.date.getTime() + Math.min(item.dueAt ?? 24 * 60 - 1, 24 * 60 - 1) * 60_000;
    out.push({
      id: `deadline:${item.id}`,
      type: 'deadline',
      title: `Prepare ${item.title}`,
      whyItMatters: 'Open it to review the instructions and source before it is due.',
      priority: item.daysAway <= 3 ? 'high' : 'normal',
      dueAt,
      expiresAt: dueAt + 86_400_000,
      source: {
        label: confirmed ? 'imported' : 'needs_review',
        system: confirmed ? 'Checked against your syllabus' : 'A course date recorded in Semester',
        authority: 'Your instructor and the course’s official systems',
        dataOwner: confirmed ? 'The source file you imported' : 'You, until an official source is checked',
        correctionRoute: 'Open the assignment and check or correct its source date.',
        officialFallback: 'Use the syllabus or learning management system before acting on the deadline.',
      },
      explanation: {
        trigger: `It is due ${item.daysAway === 0 ? 'today' : `in ${plural(item.daysAway, 'day')}`} and is not marked done.`,
        factors: [`Due ${item.dueShort}`, confirmed ? 'The date was confirmed against the syllabus' : 'The date has not been confirmed against the syllabus'],
        expectedImpact: 'Starting now leaves time to read the instructions and ask questions before it is due.',
        limitations: [
          'Semester cannot see your learning management system, so it does not know if you already submitted.',
          ...(confirmed ? [] : ['The date may be wrong. Check it against the course source.']),
        ],
        alternatives: ['Mark it done if you already finished it.', 'Snooze it if another deadline is more pressing.'],
      },
      primary: { label: 'Open assignment', kind: 'navigate', target: toHash({ screen: 'item', id: item.id }), requiresConfirmation: false },
    });
  }

  if (input.path.state === 'incomplete') {
    out.push({
      id: 'path:complete',
      type: 'path',
      title: 'Complete your path details',
      whyItMatters: 'Add the requirements and courses you already know so Semester can give a qualified next step.',
      priority: 'normal',
      group: 'My Path',
      source: {
        label: 'estimated',
        system: 'My Path, from what you entered',
        authority: 'Your registrar and academic program',
        dataOwner: 'You maintain this planning copy',
        correctionRoute: 'Update My Path with the requirements and courses shown on your official audit.',
        officialFallback: 'Use your degree audit and confirm unresolved choices with an advisor.',
      },
      explanation: {
        trigger: 'Your path record does not have enough information to estimate requirement coverage.',
        factors: ['No requirements or courses recorded yet'],
        expectedImpact: 'A Path Snapshot you can take to your advisor.',
        limitations: ['Semester does not know your official requirements. This is never a degree audit.'],
        alternatives: ['Ask your advisor for your degree audit and enter it from there.'],
      },
      primary: { label: 'Build My Path', kind: 'navigate', target: toHash({ screen: 'degree', id: '' }), requiresConfirmation: false },
    });
  } else if (input.path.state === 'review') {
    out.push({
      id: `path:${input.path.firstUnresolved ?? 'review'}`,
      type: 'path',
      title: input.path.firstUnresolved ? `Review ${input.path.firstUnresolved}` : 'Review your next degree choice',
      whyItMatters: `${plural(input.path.unresolved, 'recorded requirement')} still ${input.path.unresolved === 1 ? 'needs' : 'need'} a course choice.`,
      priority: 'normal',
      group: 'My Path',
      source: {
        label: 'estimated',
        system: 'My Path, from what you entered',
        authority: 'Your registrar and academic program',
        dataOwner: 'You maintain this planning copy',
        correctionRoute: 'Update the requirement or course choice in My Path.',
        officialFallback: 'Use your degree audit and confirm the choice with an advisor.',
      },
      explanation: {
        trigger: 'Finished and current courses do not yet cover every requirement you recorded.',
        factors: [`${plural(input.path.unresolved, 'requirement')} without a course`],
        expectedImpact: 'Registration goes faster when each requirement already has a candidate course.',
        limitations: [input.path.source],
        alternatives: ['Bring it to your next advisor meeting instead.'],
      },
      primary: { label: 'Review My Path', kind: 'navigate', target: toHash({ screen: 'degree', id: '' }), requiresConfirmation: false },
    });
  }

  if (input.reviewDue > 0) {
    out.push({
      id: 'study:review',
      type: 'study',
      title: 'Bring due material back into view',
      whyItMatters: `${plural(input.reviewDue, 'review')} ${input.reviewDue === 1 ? 'is' : 'are'} ready for retrieval practice.`,
      priority: 'low',
      estimatedMinutes: Math.min(30, Math.max(5, Math.round(input.reviewDue / 2))),
      source: {
        label: 'estimated',
        system: 'Your review schedule on this device',
        authority: 'Your own study record',
        dataOwner: 'You',
        correctionRoute: 'Complete, reschedule, or remove the review in Study.',
        officialFallback: 'Use the course study guidance or ask your instructor what to prioritize.',
      },
      explanation: {
        trigger: 'These cards have reached the review time the spacing schedule set.',
        factors: [plural(input.reviewDue, 'card') + ' due'],
        expectedImpact: 'Reviewing on schedule keeps material from fading before the exam.',
        limitations: ['The schedule only knows the reviews you did in Semester.'],
        alternatives: ['Review later today; the cards stay due.'],
      },
      primary: { label: 'Start reviewing', kind: 'navigate', target: toHash({ screen: 'study', id: '' }), requiresConfirmation: false },
    });
  }

  if (input.catalogEmpty) {
    out.push({
      id: 'semester:start',
      type: 'setup',
      title: 'Start your semester',
      whyItMatters: 'Add a syllabus or course so deadlines and the day plan have a source.',
      priority: 'high',
      source: {
        label: 'student_entered',
        system: 'Your Semester workspace',
        authority: 'You choose what to add',
        dataOwner: 'You',
        correctionRoute: 'Add or import a course, then review its source details.',
        officialFallback: 'Use your institution’s course schedule or ask an advisor for your current enrollment.',
      },
      explanation: {
        trigger: 'No course or syllabus is recorded yet.',
        factors: ['No courses in this workspace'],
        expectedImpact: 'Deadlines, study plans and Today all start working.',
        limitations: ['Semester only knows the courses you add.'],
        alternatives: ['Import your course catalog under Registration first.'],
      },
      primary: { label: 'Add a course', kind: 'navigate', target: toHash({ screen: 'import', id: '' }), requiresConfirmation: false },
    });
  }

  return out;
}
