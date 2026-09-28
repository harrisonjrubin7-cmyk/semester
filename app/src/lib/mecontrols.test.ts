import { describe, expect, it } from 'vitest';
import { SCREENS } from '../screens';
import { CONTROLS, controlsOffered } from './mecontrols';
import { DESTINATIONS, screenName } from './nav';
import { SETTINGS_SCREENS } from './settings';

/**
 * A control that opens a screen nobody can otherwise reach is a dead end with
 * a label on it, so every row's target is either in the destination registry,
 * a settings page Settings itself lists, or one of the three pages this
 * surface is the home of — which must then be in the screen table and have a
 * name of their own (`nav.registry.test.ts` says why they are not registered).
 */
const HOMED_HERE = ['activity', 'whatsnew', 'recovery'] as const;

describe('the Me control surface', () => {
  const reachable = new Set<string>([...DESTINATIONS.map((d) => d.screen), ...SETTINGS_SCREENS, ...HOMED_HERE]);

  it('is the home of its own three pages, which are drawn and named', () => {
    for (const s of HOMED_HERE) {
      expect(CONTROLS.some((c) => c.screen === s), s).toBe(true);
      expect(SCREENS[s], `${s} is not in the screen table`).toBeDefined();
      expect(screenName(s), s).not.toBe(s);
    }
  });

  it('names each control once', () => {
    const ids = CONTROLS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('opens only screens that can be reached', () => {
    for (const c of CONTROLS) expect(reachable.has(c.screen), `${c.id} → ${c.screen}`).toBe(true);
  });

  it('covers what the brief says a student should never have to hunt for', () => {
    const labels = CONTROLS.map((c) => c.label);
    for (const want of ['My profile', 'My data', 'Connected accounts', 'Sharing', 'AI controls', 'Notifications', 'Accessibility preferences', 'Export data', 'Request deletion', 'Support access', 'Billing', 'Security']) {
      expect(labels).toContain(want);
    }
  });

  it('says what is there in one line each, in the second person', () => {
    for (const c of CONTROLS) {
      expect(c.sub.length, c.id).toBeGreaterThan(15);
      expect(c.sub.length, c.id).toBeLessThan(90);
    }
  });

  it('drops a row whose screen is not offered', () => {
    const without = controlsOffered((s) => s !== 'account');
    expect(without.some((c) => c.screen === 'account')).toBe(false);
    expect(without.length).toBe(CONTROLS.length - CONTROLS.filter((c) => c.screen === 'account').length);
    expect(controlsOffered(() => true)).toEqual([...CONTROLS]);
  });
});
