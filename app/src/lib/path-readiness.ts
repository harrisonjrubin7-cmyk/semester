import type { MeetingLibrary } from './advisor-meeting';
import { CHECKLIST, readiness, type RegistrationDayData } from './registration-day';
import type { CatalogCourse } from './registration';

export type ReadinessState = 'ready' | 'attention' | 'not_started';

export interface PathReadinessInput {
  pathConfigured: boolean;
  requirementTotal: number;
  cart: CatalogCourse[];
  catalog: CatalogCourse[];
  registration: RegistrationDayData;
  meetings: MeetingLibrary;
  institution: string | null;
}

export interface PathReadinessItem {
  id: 'path' | 'requirements' | 'courses' | 'schedule' | 'backups' | 'window' | 'official_checks' | 'advisor';
  label: string;
  detail: string;
  state: ReadinessState;
  destination: 'degree' | 'yes';
}

/**
 * One honest readiness model for My Path and registration day.
 *
 * It deliberately distinguishes preparation from institutional confirmation:
 * imported courses help build a plan, while holds, prerequisites and the final
 * registration result remain the official system's decision.
 */
export function pathReadiness(input: PathReadinessInput): PathReadinessItem[] {
  const plan = readiness(input.registration, input.cart, input.catalog);
  const checked = CHECKLIST.filter((item) => input.registration.checks.includes(item.id)).length;
  const latestMeeting = [...input.meetings.meetings].sort((a, b) => b.created - a.created)[0];
  const hasAgenda = Boolean(latestMeeting && (latestMeeting.agenda.length || latestMeeting.questions.length));

  return [
    {
      id: 'path',
      label: 'Path details',
      detail: input.pathConfigured ? 'Program, credit target and target term are recorded.' : 'Add your program, credit target and target term.',
      state: input.pathConfigured ? 'ready' : 'not_started',
      destination: 'degree',
    },
    {
      id: 'requirements',
      label: 'Requirements',
      detail: input.requirementTotal > 0 ? `${input.requirementTotal} requirements are in your planning copy.` : 'Copy the requirements from your official degree audit.',
      state: input.requirementTotal > 0 ? 'ready' : 'not_started',
      destination: 'degree',
    },
    {
      id: 'courses',
      label: 'Primary schedule',
      detail: input.cart.length
        ? `${input.cart.length} section${input.cart.length === 1 ? '' : 's'} selected${input.institution ? ` from ${input.institution}` : ''}.`
        : 'Choose the sections you intend to register for.',
      state: input.cart.length ? 'ready' : 'not_started',
      destination: 'yes',
    },
    {
      id: 'schedule',
      label: 'Schedule conflicts',
      detail: !input.cart.length ? 'Add courses before checking the schedule.' : plan.conflicts ? `${plan.conflicts} conflict${plan.conflicts === 1 ? '' : 's'} need attention.` : 'No meeting-time conflicts found in the imported schedule.',
      state: !input.cart.length ? 'not_started' : plan.conflicts ? 'attention' : 'ready',
      destination: 'yes',
    },
    {
      id: 'backups',
      label: 'Backup sections',
      detail: !input.cart.length ? 'Backups appear after you choose a primary schedule.' : plan.unbacked.length ? `${plan.unbacked.length} primary section${plan.unbacked.length === 1 ? '' : 's'} still need a backup.` : 'Every primary section has a backup.',
      state: !input.cart.length ? 'not_started' : plan.unbacked.length ? 'attention' : 'ready',
      destination: 'yes',
    },
    {
      id: 'window',
      label: 'Registration window',
      detail: input.registration.opensAt ? 'Your registration time is recorded as student-entered.' : 'Add the time shown in your official registration system.',
      state: input.registration.opensAt ? 'ready' : 'not_started',
      destination: 'yes',
    },
    {
      id: 'official_checks',
      label: 'Official-system checks',
      detail: checked === CHECKLIST.length ? 'You confirmed every pre-registration check.' : `${checked} of ${CHECKLIST.length} checks confirmed. Holds and prerequisites must be checked in the official system.`,
      state: checked === CHECKLIST.length ? 'ready' : checked ? 'attention' : 'not_started',
      destination: 'yes',
    },
    {
      id: 'advisor',
      label: 'Advisor agenda',
      detail: hasAgenda ? 'An agenda or advisor question is prepared. Sharing remains opt-in and previewed.' : 'Prepare questions and choose exactly what an advisor may see.',
      state: hasAgenda ? 'ready' : 'not_started',
      destination: 'degree',
    },
  ];
}

export function readinessCount(items: readonly PathReadinessItem[]): { ready: number; total: number } {
  return { ready: items.filter((item) => item.state === 'ready').length, total: items.length };
}
