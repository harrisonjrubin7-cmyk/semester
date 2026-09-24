import type { Destination } from './nav';
import type { Screen } from './types';

export type JourneyId =
  | 'start-semester'
  | 'plan-today'
  | 'learn-practice'
  | 'complete-assignment'
  | 'work-with-people'
  | 'prepare-next';

export interface Journey {
  id: JourneyId;
  label: string;
  outcome: string;
  aliases: string[];
  screens: Screen[];
}

export const JOURNEYS: Journey[] = [
  {
    id: 'start-semester',
    label: 'Start my semester',
    outcome: 'Bring in courses, confirm dates and connect the systems you already use.',
    aliases: ['setup', 'syllabus', 'import', 'registration', 'connect accounts'],
    screens: ['import', 'search', 'directory', 'connect', 'courses', 'edit', 'registrar', 'yes', 'announce'],
  },
  {
    id: 'plan-today',
    label: 'Plan today',
    outcome: 'Turn confirmed deadlines and available time into a realistic next step.',
    aliases: ['today', 'deadline', 'schedule', 'tasks', 'week', 'behind'],
    screens: ['home', 'calendar', 'mine', 'clocks', 'brief', 'runway', 'behind', 'notifs'],
  },
  {
    id: 'learn-practice',
    label: 'Learn and practice',
    outcome: 'Review what matters next, practice it and strengthen recall over time.',
    aliases: ['study', 'flashcards', 'quiz', 'exam', 'mastery', 'review'],
    screens: ['study', 'meet', 'ask', 'solve', 'exam', 'update', 'sources', 'proof'],
  },
  {
    id: 'complete-assignment',
    label: 'Complete an assignment',
    outcome: 'Move from source material to a checked document, deck, analysis or solution.',
    aliases: ['assignment', 'essay', 'paper', 'slides', 'citations', 'draft'],
    screens: ['work', 'essay', 'write', 'sheet', 'deck', 'equations', 'draw', 'analyse', 'create'],
  },
  {
    id: 'work-with-people',
    label: 'Work with people',
    outcome: 'Coordinate classmates, groups, meetings, messages and campus relationships.',
    aliases: ['group', 'classmates', 'collaboration', 'meeting', 'email', 'mentor'],
    screens: [
      'groupwork',
      'classmates',
      'call',
      'mail',
      'people',
      'activities',
      'university',
      'maps',
      'housing',
      'meals',
      'costs',
      'family',
      'athletics',
    ],
  },
  {
    id: 'prepare-next',
    label: 'Prepare for what comes next',
    outcome: 'Connect the degree to skills, opportunities, applications and your next move.',
    aliases: ['career', 'resume', 'jobs', 'internship', 'applications', 'degree'],
    screens: [
      'degree',
      'career',
      'applying',
      'pathway',
      'profile',
      'export',
      'account',
      'data',
      'privacy',
      'settings',
      'help',
      'links',
      'me',
      'nil',
    ],
  },
];

/** Keep the six stable journeys while removing screens this destination set cannot offer. */
export function journeysFor(destinations: Destination[]): Journey[] {
  const registered = new Set(destinations.map((destination) => destination.screen));
  return JOURNEYS.map((journey) => ({
    ...journey,
    aliases: [...journey.aliases],
    screens: journey.screens.filter((screen) => registered.has(screen)),
  }));
}

export interface JourneyPosition {
  journey: Journey;
  current: Screen;
  position: number;
  total: number;
  previous?: Screen;
  next?: Screen;
}

/** The current part of the larger student outcome, with the adjacent handoffs. */
export function journeyPositionFor(
  screen: Screen,
  journeys: Journey[] = JOURNEYS,
): JourneyPosition | null {
  for (const journey of journeys) {
    const index = journey.screens.indexOf(screen);
    if (index < 0) continue;
    return {
      journey,
      current: screen,
      position: index + 1,
      total: journey.screens.length,
      previous: journey.screens[index - 1],
      next: journey.screens[index + 1],
    };
  }
  return null;
}

export interface JourneySignals {
  confirmedDueSoon: number;
  setupIncomplete: boolean;
  reviewDue: number;
  collaborationDue: number;
  careerDue: number;
}

export type RecommendedJourney = Journey & { reason: string; score: number };

/** A deterministic explanation-first ranking; every journey stays present. */
export function recommendJourney(input: JourneySignals): RecommendedJourney[] {
  const scored = JOURNEYS.map((journey, index): RecommendedJourney => {
    let score = 0;
    let reason = 'Available whenever you need it.';
    if (journey.id === 'start-semester' && input.setupIncomplete) {
      score = 600;
      reason = 'Your semester setup still needs confirmation.';
    } else if (journey.id === 'plan-today' && input.confirmedDueSoon > 0) {
      score = 500 + input.confirmedDueSoon;
      reason = `${input.confirmedDueSoon} confirmed ${input.confirmedDueSoon === 1 ? 'deadline is' : 'deadlines are'} coming up soon.`;
    } else if (journey.id === 'learn-practice' && input.reviewDue > 0) {
      score = 400 + input.reviewDue;
      reason = `${input.reviewDue} review ${input.reviewDue === 1 ? 'activity is' : 'activities are'} ready.`;
    } else if (journey.id === 'work-with-people' && input.collaborationDue > 0) {
      score = 300 + input.collaborationDue;
      reason = `${input.collaborationDue} collaboration ${input.collaborationDue === 1 ? 'item needs' : 'items need'} attention.`;
    } else if (journey.id === 'prepare-next' && input.careerDue > 0) {
      score = 200 + input.careerDue;
      reason = `${input.careerDue} career ${input.careerDue === 1 ? 'step is' : 'steps are'} due soon.`;
    }
    return { ...journey, aliases: [...journey.aliases], screens: [...journey.screens], reason, score: score - index / 100 };
  });
  return scored.sort((a, b) => b.score - a.score);
}

export function searchJourneys(query: string): Journey[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return JOURNEYS;
  return JOURNEYS.filter((journey) => {
    const text = [journey.label, journey.outcome, ...journey.aliases].join(' ').toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
