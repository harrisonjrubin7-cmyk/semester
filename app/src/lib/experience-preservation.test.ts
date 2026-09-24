import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from './nav';
import { JOURNEYS } from './journeys';
import { experienceFlags } from './experience-flags';
import { flightStorageKey } from './flight-plan-storage';

const PRE_EXPANSION_SCREENS = [
  'home', 'brief', 'courses', 'degree', 'calendar', 'study', 'meet', 'ask', 'work',
  'update', 'analyse', 'draw', 'solve', 'exam', 'deck', 'write', 'sheet', 'equations',
  'sources', 'create', 'essay', 'import', 'edit', 'registrar', 'announce', 'costs',
  'call', 'groupwork', 'meals', 'housing', 'runway', 'behind', 'maps', 'mail', 'yes',
  'classmates', 'activities', 'people', 'pathway', 'career', 'family', 'athletics',
  'nil', 'applying', 'proof', 'clocks', 'mine', 'me', 'account', 'profile',
  'university', 'links', 'connect', 'data', 'privacy', 'export', 'settings', 'notifs',
  'help',
] as const;

describe('the intelligence expansion preserves the existing Semester product', () => {
  it('keeps every pre-expansion destination exactly once', () => {
    const screens = DESTINATIONS.map((destination) => destination.screen);
    expect(screens).toEqual(expect.arrayContaining([...PRE_EXPANSION_SCREENS]));
    expect(new Set(screens).size).toBe(screens.length);
  });

  it('adds six journeys as routes into the catalog instead of replacing it', () => {
    expect(JOURNEYS).toHaveLength(6);
    expect(new Set(JOURNEYS.map((journey) => journey.id)).size).toBe(6);
    for (const journey of JOURNEYS) {
      expect(journey.screens.length).toBeGreaterThan(0);
      expect(DESTINATIONS.some(({ screen }) => screen === journey.screens[0])).toBe(true);
    }
  });

  it('keeps every expansion off in the ordinary production build', () => {
    expect(experienceFlags({})).toEqual({
      semesterIntelligence: 'off',
      journeyNavigation: 'off',
      adaptiveLearning: 'off',
      careerSkillsGraph: 'off',
      multimodalCapture: 'off',
      universityControlPlane: 'off',
    });
  });

  it('partitions preview workspaces by tenant, role and person', () => {
    const keys = [
      flightStorageKey('northstar', 'student', 'student-a'),
      flightStorageKey('cedar-coast', 'student', 'student-a'),
      flightStorageKey('northstar', 'student', 'student-b'),
      flightStorageKey('northstar', 'campus_staff', 'staff-a'),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });
});
