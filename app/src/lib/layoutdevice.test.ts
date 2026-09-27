import { describe, expect, it } from 'vitest';
import { strategyFor, withNotes } from './merge';

/**
 * A layout is chosen for a screen, so each device keeps its own.
 *
 * The phone on the Soft shell with a tab bar, the laptop on the workspace
 * with the reading pane underneath: a pull from one used to put the other in
 * the same layout, and choosing again there changed it back on the first.
 * `hydrate` merges a pull through `withNotes` (`state/slices/library.ts`),
 * so this is the merge a real pull runs.
 */

const LAYOUT = ['nav', 'shell', 'mailPane', 'tabs', 'directory'] as const;

const phone = {
  nav: 'tabs',
  shell: 'soft',
  mailPane: 'off',
  tabs: ['home', 'calendar', 'mail'],
  directory: 'tiles',
  accent: 'sterling',
  favourites: 'study',
};

const laptop = {
  nav: 'workspace',
  shell: 'plain',
  mailPane: 'bottom',
  tabs: ['home', 'courses', 'grades', 'people', 'more'],
  directory: 'list',
  accent: 'oxide',
  favourites: 'study,calendar',
};

describe("pulling the laptop's copy onto the phone", () => {
  const { merged } = withNotes(phone, laptop);

  it.each(LAYOUT)("keeps the phone's own %s", (field) => {
    expect(merged[field]).toEqual(phone[field]);
  });

  it('still takes what is about the person — the control that sync is on at all', () => {
    // The accent and the workspace favourites are the student's, not the
    // screen's, and still follow them.
    expect(merged.accent).toBe('oxide');
    expect(merged.favourites).toBe('study,calendar');
  });
});

describe('the strategy table', () => {
  it.each(LAYOUT)('marks %s as per device', (field) => {
    expect(strategyFor(field)).toBe('mine');
  });

  it('leaves the arrangements the student made following them', () => {
    for (const field of ['boardOrder', 'groupOrder', 'favourites', 'feedOrder', 'courseOrder', 'shortcuts']) {
      expect(strategyFor(field), field).toBe('theirs');
    }
  });
});
