import { describe, expect, it } from 'vitest';
import { allApps } from './desk';
import { DESTINATIONS } from './nav';
import type { Capabilities } from './school';
import { JOURNEYS, journeysFor, recommendJourney, searchJourneys } from './journeys';

const ALL: Capabilities = {
  mealPlan: 'both',
  housing: true,
  campusMap: true,
  registrarUrl: 'https://example.invalid',
  orgPortalUrl: 'https://example.invalid',
};

describe('student journeys', () => {
  it('maps every journey only to registered screens and preserves all offered destinations', () => {
    const beforeJourneyCount = allApps(ALL, 'student').length;
    const result = journeysFor(DESTINATIONS);
    expect(result.map((journey) => journey.id)).toEqual([
      'start-semester',
      'plan-today',
      'learn-practice',
      'complete-assignment',
      'work-with-people',
      'prepare-next',
    ]);
    const registered = new Set(DESTINATIONS.map((destination) => destination.screen));
    expect(result.every((journey) => journey.screens.every((screen) => registered.has(screen)))).toBe(true);
    expect(new Set(result.flatMap((journey) => journey.screens)).size).toBeGreaterThan(0);
    expect(allApps(ALL, 'student')).toHaveLength(beforeJourneyCount);
  });

  it('ranks plan today from a confirmed deadline without hiding the other journeys', () => {
    const ranked = recommendJourney({
      confirmedDueSoon: 2,
      setupIncomplete: false,
      reviewDue: 0,
      collaborationDue: 0,
      careerDue: 0,
    });
    expect(ranked[0].id).toBe('plan-today');
    expect(ranked[0].reason).toContain('confirmed');
    expect(ranked).toHaveLength(6);
  });

  it('searches outcomes and aliases without changing the fixed registry', () => {
    expect(searchJourneys('flashcards').map((journey) => journey.id)).toContain('learn-practice');
    expect(searchJourneys('resume').map((journey) => journey.id)).toContain('prepare-next');
    expect(JOURNEYS).toHaveLength(6);
  });
});
