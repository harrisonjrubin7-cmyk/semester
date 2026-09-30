/**
 * Which reading of a course's deadlines the student has acknowledged.
 *
 * `onlyNew` seeds the courses that have none, silently, so the first visit
 * reports nothing; without it the map is replaced course by course, which is
 * how "Got it" moves the baseline to what is on screen. Never applied except
 * by a tap or by the seeding effect — see `components/WhatChanged.tsx`.
 *
 * Returns null for an action that is not this slice's.
 */

import type { Action, State } from '../shape';

export function seen(state: State, action: Action): State | null {
  switch (action.type) {
    case 'seenDeadlines': {
      const next = { ...state.deadlineSeen };
      for (const [course, list] of Object.entries(action.seen)) {
        if (action.onlyNew && next[course]) continue;
        next[course] = list;
      }
      return { ...state, deadlineSeen: next };
    }

    default:
      return null;
  }
}
