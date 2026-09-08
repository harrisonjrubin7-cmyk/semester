import { describe, expect, it } from 'vitest';
import { LINKABLE_LEAVES, linkedScreen } from './deeplink';
import { ROOTS } from '../state/shape';
import { SETTINGS_SCREENS } from './settings';
import { DESTINATIONS } from './nav';
import type { Screen } from './types';

describe('what a ?screen= link may open', () => {
  it('opens any root, which is what an installed app’s shortcuts use', () => {
    for (const root of ROOTS) expect(linkedScreen(root, false)).toBe(root);
  });

  it('opens the settings index and every page under it', () => {
    expect(linkedScreen('settings', false)).toBe('settings');
    for (const page of SETTINGS_SCREENS) expect(linkedScreen(page, false)).toBe(page);
  });

  it('opens Ask Claude and Account', () => {
    // Both are leaves the rail draws as rows of their own, both keep the app's
    // navigation on screen, and neither is in FULLSCREEN — so a link to either
    // lands somewhere you can leave. Before this they fell through to Today,
    // silently, which is the worst of the three possible answers.
    expect(linkedScreen('ask', false)).toBe('ask');
    expect(linkedScreen('account', false)).toBe('account');
  });

  it('still refuses a screen that would strand you', () => {
    // The rule this guard exists for. A link three levels into a drill hides
    // the tab bar, and on a cold load there is no history for Back to pop.
    for (const screen of ['drill', 'quiz', 'guess', 'lesson', 'slides'] as Screen[]) {
      expect(linkedScreen(screen, false)).toBeNull();
    }
  });

  it('refuses the importer typed by hand, and allows a real share', () => {
    // Arriving at an empty importer you did not ask for is worse than
    // arriving at Today.
    expect(linkedScreen('import', false)).toBeNull();
    expect(linkedScreen('import', true)).toBe('import');
  });

  it('falls back rather than trusting whatever was in the query string', () => {
    expect(linkedScreen(null, false)).toBeNull();
    expect(linkedScreen(undefined, false)).toBeNull();
    expect(linkedScreen('', false)).toBeNull();
    expect(linkedScreen('wormhole', false)).toBeNull();
    expect(linkedScreen('__proto__', false)).toBeNull();
  });

  it('names only screens the directory knows about', () => {
    // A leaf listed here that no longer exists would be a link to nowhere.
    const known = new Set(DESTINATIONS.map((d) => d.screen));
    for (const screen of LINKABLE_LEAVES) expect(known.has(screen)).toBe(true);
  });

  it('does not repeat a root in the leaf list', () => {
    for (const screen of LINKABLE_LEAVES) expect(ROOTS).not.toContain(screen);
  });
});
