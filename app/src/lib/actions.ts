import type { Screen } from './types';

export type ActionState = 'open' | 'snooze' | 'dismissed' | 'completed' | 'cancelled';

export type SourceLabel = 
  | 'Confirmed course-source deadline'
  | 'Course date recorded in Semester; confirm it against the course source.'
  | 'Your private review history and current device time.'
  | 'Your current Semester workspace.'
  | 'Your recorded courses, deadlines, degree details and review history.';

export interface ActionHistoryEntry {
  state: ActionState;
  timestamp: number;
  reason?: string;
}

export interface Action {
  id: string;
  title: string;
  body: string;
  action: string;
  destination: Screen;
  itemId?: string;
  why: string;
  source: SourceLabel;
  state: ActionState;
  createdAt: number;
  lastUpdatedAt: number;
  history: readonly ActionHistoryEntry[];
}

export interface RankedActions {
  mostImportant: Action | null;
  next: Action[];
}

export function calculateFreshness(sourceUpdatedAtMs: number): number {
  const now = Date.now();
  const diffMs = now - sourceUpdatedAtMs;
  const daysAgo = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, daysAgo);
}

export function isValidSourceLabel(source: unknown): source is SourceLabel {
  const valid: readonly SourceLabel[] = [
    'Confirmed course-source deadline',
    'Course date recorded in Semester; confirm it against the course source.',
    'Your private review history and current device time.',
    'Your current Semester workspace.',
    'Your recorded courses, deadlines, degree details and review history.',
  ];
  return typeof source === 'string' && valid.includes(source as SourceLabel);
}

export function rankActions(actions: Action[]): RankedActions {
  const open = actions.filter(a => a.state === 'open');
  
  if (open.length === 0) {
    return { mostImportant: null, next: [] };
  }

  const sorted = [...open].sort((a, b) => {
    return b.lastUpdatedAt - a.lastUpdatedAt;
  });

  const [mostImportant, ...rest] = sorted;
  const next = rest.slice(0, 3);

  return {
    mostImportant: mostImportant || null,
    next,
  };
}
