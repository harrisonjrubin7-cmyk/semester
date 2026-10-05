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
  const unchecked = uncheckedSections(input.cart);
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
      detail: !input.cart.length
        ? 'Add courses before checking the schedule.'
        : plan.conflicts
          ? `${plan.conflicts} conflict${plan.conflicts === 1 ? '' : 's'} need attention.`
          : unchecked
            ? `${unchecked} selected section${unchecked === 1 ? ' has' : 's have'} no meeting times, so conflicts cannot be checked for ${unchecked === 1 ? 'it' : 'them'}.`
            : 'No meeting-time conflicts found in the imported schedule.',
      state: !input.cart.length ? 'not_started' : plan.conflicts || unchecked ? 'attention' : 'ready',
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

/** Selected sections with no meeting times: they cannot be conflict-checked, whatever else is true. */
export function uncheckedSections(cart: readonly CatalogCourse[]): number {
  return cart.filter((course) => !course.meetings.length).length;
}

/**
 * The one line above the steps: where the student stands as a whole.
 *
 * Five answers, and each is read off something the app really holds. There is
 * deliberately no "needs advisor review": nothing Semester stores says an
 * advisor must review a plan, so offering it would be a claim with no source.
 * It can join this list when a source (an advising hold, a program rule) exists.
 *
 * - `blocked`: a meeting-time conflict in the chosen schedule. Computed, not
 *   assumed. Holds and prerequisites live in the official system and are not
 *   known here, so they can never produce this state.
 * - `unavailable`: no course catalog is loaded, or a selected section has no
 *   meeting times, so conflicts cannot be checked (the planner itself warns
 *   "Conflicts cannot be checked for those sections"). That is a gap in what
 *   Semester knows, not in what the student has done, and it must stop the
 *   headline from saying Ready.
 * - `ready`, `almost_ready`, `getting_ready`: by how many of the steps are done.
 *
 * Preparation only. None of these says the registration will succeed.
 */
export type OverallState = 'ready' | 'almost_ready' | 'getting_ready' | 'blocked' | 'unavailable';

export interface OverallReadiness {
  state: OverallState;
  label: string;
  why: string;
}

/** What the overall status is read from, besides the steps themselves. */
export interface ReadinessFacts {
  /** Sections in the loaded catalog. Zero means nothing can be selected or checked. */
  catalogSize: number;
  /** Meeting-time overlaps the app computed in the chosen schedule. */
  conflicts: number;
  /** Selected sections with no meeting times (see `uncheckedSections`). */
  unchecked: number;
}

export function readinessFacts(input: PathReadinessInput): ReadinessFacts {
  return {
    catalogSize: input.catalog.length,
    conflicts: readiness(input.registration, input.cart, input.catalog).conflicts,
    unchecked: uncheckedSections(input.cart),
  };
}

export function overallReadiness(items: readonly PathReadinessItem[], facts: ReadinessFacts): OverallReadiness {
  if (facts.conflicts > 0) {
    const schedule = items.find((item) => item.id === 'schedule');
    return { state: 'blocked', label: 'Blocked', why: `${schedule?.detail ?? 'Two selected sections overlap.'} Fix it before you register.` };
  }
  if (facts.catalogSize === 0) {
    return {
      state: 'unavailable',
      label: 'Information unavailable',
      why: 'No course catalog is loaded, so sections, conflicts and backups cannot be checked here.',
    };
  }
  if (facts.unchecked > 0) {
    return {
      state: 'unavailable',
      label: 'Information unavailable',
      why: `${facts.unchecked} selected section${facts.unchecked === 1 ? ' has' : 's have'} no meeting times, so a conflict cannot be ruled out. Check the official listing.`,
    };
  }
  const left = items.filter((item) => item.state !== 'ready');
  if (left.length === 0) {
    return { state: 'ready', label: 'Ready', why: 'Every preparation step is done. Your registrar and official system still decide the result.' };
  }
  const names = left.map((item) => item.label.toLowerCase()).join(' and ');
  if (left.length <= 2) {
    return { state: 'almost_ready', label: 'Almost ready', why: `${left.length === 1 ? 'One step' : 'Two steps'} left: ${names}.` };
  }
  return { state: 'getting_ready', label: 'Getting ready', why: `${items.length - left.length} of ${items.length} steps done. Next: ${left[0]!.label.toLowerCase()}.` };
}
