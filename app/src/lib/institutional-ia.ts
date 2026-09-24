import type { Screen } from './types';

export interface InstitutionalNavItem {
  id: string;
  label: string;
  screen: Screen;
  includes: Screen[];
}

export type InstitutionalWorkspaceId =
  | 'home'
  | 'courses'
  | 'study'
  | 'create'
  | 'campus'
  | 'career'
  | 'messages';

export interface InstitutionalWorkspace extends InstitutionalNavItem {
  id: InstitutionalWorkspaceId;
}

export const PRIMARY_DESTINATIONS: InstitutionalNavItem[] = [
  {
    id: 'home',
    label: 'Home',
    screen: 'home',
    includes: ['home', 'brief', 'runway', 'behind', 'clocks', 'me'],
  },
  {
    id: 'calendar',
    label: 'Calendar',
    screen: 'calendar',
    includes: ['calendar', 'registrar', 'announce'],
  },
  {
    id: 'discover',
    label: 'Discover',
    screen: 'search',
    includes: ['search', 'directory', 'university', 'maps', 'activities', 'people', 'links'],
  },
  {
    id: 'ask-semester',
    label: 'Ask Semester',
    screen: 'ask',
    includes: ['ask'],
  },
  {
    id: 'inbox',
    label: 'Inbox',
    screen: 'mail',
    includes: ['mail', 'notifs', 'classmates', 'groupwork', 'call'],
  },
];

/**
 * The seven durable student workspaces. Their `includes` arrays partition the
 * registered destination catalogue: no route is renamed and no screen is
 * hidden by this preview layer.
 */
export const WORKSPACES: InstitutionalWorkspace[] = [
  {
    id: 'home',
    label: 'Home',
    screen: 'home',
    includes: [
      'home',
      'brief',
      'calendar',
      'runway',
      'behind',
      'clocks',
      'me',
      'account',
      'profile',
      'links',
      'connect',
      'data',
      'privacy',
      'export',
      'settings',
      'notifs',
      'help',
    ],
  },
  {
    id: 'courses',
    label: 'Courses',
    screen: 'courses',
    includes: ['courses', 'degree', 'work', 'import', 'edit', 'registrar', 'announce', 'yes'],
  },
  {
    id: 'study',
    label: 'Study',
    screen: 'study',
    includes: ['study', 'meet', 'ask', 'update', 'solve', 'exam', 'sources'],
  },
  {
    id: 'create',
    label: 'Create',
    screen: 'create',
    includes: ['analyse', 'draw', 'deck', 'write', 'sheet', 'equations', 'create', 'essay', 'mine', 'proof'],
  },
  {
    id: 'campus',
    label: 'Campus',
    screen: 'university',
    includes: ['costs', 'meals', 'housing', 'maps', 'classmates', 'activities', 'people', 'family', 'athletics', 'university'],
  },
  {
    id: 'career',
    label: 'Career',
    screen: 'career',
    includes: ['nil', 'applying', 'pathway', 'career'],
  },
  {
    id: 'messages',
    label: 'Messages',
    screen: 'mail',
    includes: ['call', 'groupwork', 'mail'],
  },
];

export function allMappedDestinationIds(): Screen[] {
  return WORKSPACES.flatMap((workspace) => workspace.includes);
}

export function workspaceFor(screen: Screen): InstitutionalWorkspace {
  return WORKSPACES.find((workspace) => workspace.includes.includes(screen)) ?? WORKSPACES[0];
}

export function primaryFor(screen: Screen): InstitutionalNavItem | undefined {
  return PRIMARY_DESTINATIONS.find((destination) => destination.includes.includes(screen));
}
