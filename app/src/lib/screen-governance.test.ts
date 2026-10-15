import { describe, expect, it } from 'vitest';
import { SCREENS } from '../screens';
import { FIVE_DESTINATIONS } from './tabbar';
import { governanceFor, SCREEN_MATURITY } from './screen-governance';
import type { Screen } from './types';

const ROUTES = ['home', ...Object.keys(SCREENS)] as Screen[];

describe('screen governance registry', () => {
  it('governs every routed screen with the required operational metadata', () => {
    for (const screen of ROUTES) {
      const row = governanceFor(screen);
      expect(row.route).toBe(`#/${screen}`);
      expect(FIVE_DESTINATIONS).toContain(row.canonicalDestination);
      expect(row.primaryJob.length).toBeGreaterThan(10);
      expect(row.primaryAction.length).toBeGreaterThan(5);
      expect(row.dataSources.length).toBeGreaterThan(0);
      expect(row.sourceLabels).toContain('Needs review');
      expect(row.accessibilityTests).toContain('keyboard');
      expect(row.analyticsEvents).toContain(`screen_opened:${screen}`);
      expect(SCREEN_MATURITY).toContain(row.maturity);
    }
  });

  it('keeps specialist screens contextual and sensitive consoles internal', () => {
    expect(governanceFor('guide').canonicalDestination).toBe('me');
    expect(governanceFor('university').canonicalDestination).toBe('search');
    expect(governanceFor('console').maturity).toBe('internal');
    expect(governanceFor('privacy').replacementOrMergeTarget).toBe('me');
  });
});
