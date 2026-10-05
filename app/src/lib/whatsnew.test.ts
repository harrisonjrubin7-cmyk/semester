import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODULE_FLAG_NAMES, type ModuleFlags } from './experience-flags';
import { isIsoDate } from './ops/render';
import { NOTES, forScreen, knownIssues, visible } from './whatsnew';

/**
 * A release note in the app is held to what the changelog is held to: a real
 * date, a screen that exists, and a sentence about what to do.
 */
const SCREENS: string[] = (() => {
  const types = readFileSync(new URL('./types.ts', import.meta.url), 'utf8');
  const union = /export type Screen =([\s\S]*?);\n/.exec(types)!;
  return [...union[1].matchAll(/\|\s*'([a-zA-Z0-9_-]+)'/g)].map((m) => m[1]);
})();

const allOff = Object.fromEntries(MODULE_FLAG_NAMES.map((n) => [n, 'off'])) as ModuleFlags;

describe('what changed', () => {
  it('dates every note, names a real screen, and says what to do', () => {
    for (const n of NOTES) {
      expect(isIsoDate(n.date), n.title).toBe(true);
      expect(n.screens.length, n.title).toBeGreaterThan(0);
      for (const s of n.screens) expect(SCREENS, `${n.title} → ${s}`).toContain(s);
      for (const m of n.modules ?? []) expect(MODULE_FLAG_NAMES, `${n.title} → ${m}`).toContain(m);
      expect(n.doTo.trim().length, n.title).toBeGreaterThan(5);
      expect(n.sees.trim().length, n.title).toBeGreaterThan(20);
    }
  });

  it('shows everyone’s notes, and a module’s only where the module is on', () => {
    const off = visible(allOff);
    expect(off.some((n) => n.modules?.includes('course_studio'))).toBe(false);
    expect(off.length).toBe(NOTES.filter((n) => !n.modules?.length).length);
    const on = visible({ ...allOff, course_studio: 'production' });
    expect(on.some((n) => n.modules?.includes('course_studio'))).toBe(true);
  });

  it('orders newest first', () => {
    const dates = visible({ ...allOff, course_studio: 'production' }).map((n) => n.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('answers "what changed for you" per screen', () => {
    expect(forScreen('activity', NOTES).length).toBeGreaterThan(0);
    expect(forScreen('nil', NOTES)).toEqual([]);
  });

  it('lists known issues separately, and there are none today', () => {
    expect(knownIssues(NOTES)).toEqual([]);
  });
});
