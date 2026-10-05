import { forProgramme, hours, programmes, type Requirement, type Taken } from './degree';
import type { Role } from './role';
import type { DatedItem, Screen } from './types';

export type PathState = 'incomplete' | 'review' | 'moving';

export interface PathSnapshot {
  state: PathState;
  heading: string;
  detail: string;
  creditLine: string;
  covered: number;
  total: number;
  percent: number;
  unresolved: number;
  firstUnresolved: string | null;
  source: string;
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/** The briefing is intentionally student-specific; it is not an authorization boundary. */
export const showsTodayDecisionSurface = (role: Role): boolean => role === 'student';

/**
 * The path claim Today can honestly make from the existing degree record.
 *
 * This deliberately does not invent a 120-credit denominator or graduation
 * date. Requirements can overlap and Semester's degree screen explicitly
 * allows double counting because university rules differ. A percentage here
 * is therefore the share of the student's *recorded requirements* covered by
 * finished or in-progress courses, never “degree complete”.
 */
export function pathSnapshot(requirements: Requirement[], taken: Taken[]): PathSnapshot {
  const credit = hours(taken);
  const creditLine = credit.done > 0
    ? `${credit.done} credit hours recorded as finished${credit.withThisTerm > credit.done ? ` · ${credit.withThisTerm} including this term` : ''}`
    : credit.withThisTerm > 0
      ? `${credit.withThisTerm} credit hours recorded in progress`
      : 'No credit hours recorded yet';
  const progress = programmes(requirements).flatMap((programme) =>
    forProgramme(requirements, taken, programme),
  );
  const covered = progress.filter((item) => item.met || item.meetsAfter).length;
  const unresolvedRows = progress.filter((item) => !item.met && !item.meetsAfter);
  const total = progress.length;
  const percent = total === 0 ? 0 : Math.round((covered / total) * 100);
  const source = 'Based only on the degree requirements and courses you entered. This is not the registrar’s audit.';

  if (requirements.length === 0) {
    return {
      state: 'incomplete',
      heading: 'Add a few details to see a clearer path',
      detail: 'Copy the requirement names from your own degree audit before Semester estimates what is covered.',
      creditLine,
      covered,
      total,
      percent,
      unresolved: 0,
      firstUnresolved: null,
      source,
    };
  }

  if (taken.length === 0) {
    return {
      state: 'incomplete',
      heading: 'Your path needs completed and current courses',
      detail: `${plural(total, 'recorded requirement')} can be checked once you add the courses from your transcript and current term.`,
      creditLine,
      covered,
      total,
      percent,
      unresolved: total,
      firstUnresolved: unresolvedRows[0]?.req.name || null,
      source,
    };
  }

  if (unresolvedRows.length > 0) {
    return {
      state: 'review',
      heading: 'A few choices could affect your plan',
      detail: `${plural(unresolvedRows.length, 'recorded requirement')} still ${unresolvedRows.length === 1 ? 'needs' : 'need'} a course choice after this term.`,
      creditLine,
      covered,
      total,
      percent,
      unresolved: unresolvedRows.length,
      firstUnresolved: unresolvedRows[0]?.req.name || null,
      source,
    };
  }

  return {
    state: 'moving',
    heading: 'Your recorded plan is moving forward',
    detail: `All ${plural(total, 'recorded requirement')} are covered by finished or in-progress courses.`,
    creditLine,
    covered,
    total,
    percent,
    unresolved: 0,
    firstUnresolved: null,
    source,
  };
}

export interface TodayDecision {
  id: string;
  title: string;
  body: string;
  action: string;
  destination: Screen;
  itemId?: string;
  why: string;
  source: string;
}

export function nextTodayDecision(input: {
  path: PathSnapshot;
  upcoming: DatedItem[];
  done: Record<string, boolean>;
  reviewDue: number;
  catalogEmpty: boolean;
}): TodayDecision {
  const soon = input.upcoming.find(
    (item) => item.daysAway <= 3 && !input.done[item.id],
  );
  if (soon) {
    const source = soon.checked?.confirmed
      ? 'Confirmed course-source deadline'
      : 'Course date recorded in Semester; confirm it against the course source.';
    return {
      id: `deadline:${soon.id}`,
      title: `Prepare ${soon.title}`,
      body: `${soon.dueShort}. Open the assignment to review its instructions, source and study plan.`,
      action: 'Open assignment',
      destination: 'item',
      itemId: soon.id,
      why: 'It is the nearest unfinished course commitment in the next 72 hours.',
      source,
    };
  }

  if (input.path.state === 'incomplete') {
    return {
      id: 'path:complete',
      title: 'Complete your path details',
      body: 'Add the requirements and courses you already know so Semester can give a useful, qualified next step.',
      action: 'Build My Path',
      destination: 'degree',
      why: 'The current record does not contain enough information to estimate requirement coverage.',
      source: input.path.source,
    };
  }

  if (input.path.state === 'review') {
    return {
      id: `path:${input.path.firstUnresolved ?? 'review'}`,
      title: input.path.firstUnresolved
        ? `Review ${input.path.firstUnresolved}`
        : 'Review your next degree choice',
      body: `${plural(input.path.unresolved, 'recorded requirement')} still ${input.path.unresolved === 1 ? 'needs' : 'need'} a course choice after this term.`,
      action: 'Review My Path',
      destination: 'degree',
      why: 'Finished and current courses do not yet cover every requirement you recorded.',
      source: input.path.source,
    };
  }

  if (input.reviewDue > 0) {
    return {
      id: 'study:review',
      title: 'Bring due material back into view',
      body: `${plural(input.reviewDue, 'review')} ${input.reviewDue === 1 ? 'is' : 'are'} ready for retrieval practice.`,
      action: 'Start reviewing',
      destination: 'study',
      why: 'These cards have reached the review time recorded by the spaced-retrieval schedule.',
      source: 'Your private review history and current device time.',
    };
  }

  if (input.catalogEmpty) {
    return {
      id: 'semester:start',
      title: 'Start your semester',
      body: 'Add a syllabus or course so deadlines, study activities and the day plan have a source.',
      action: 'Add a course',
      destination: 'import',
      why: 'No course or syllabus is recorded yet.',
      source: 'Your current Semester workspace.',
    };
  }

  return {
    id: 'plan:week',
    title: 'Review the week ahead',
    body: 'Your immediate course commitments are clear. Check the calendar for the next useful planning move.',
    action: 'Open Plan',
    destination: 'calendar',
    why: 'There is no unfinished course deadline in the next 72 hours and no unresolved recorded path choice.',
    source: 'Your recorded courses, deadlines, degree details and review history.',
  };
}
