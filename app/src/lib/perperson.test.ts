import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DESTINATIONS, offered } from './nav';
import { NOTHING_YET, countHidden, type Facts } from './reveal';
import type { Capabilities } from './school';
import type { Role } from './role';
import { me } from '../ai/providers/personal';
import { buildCatalog } from '../../src/data/catalog';
import { DEFAULT_PERSISTED, initialEphemeral, type State } from '../state/shape';
import type { Look } from '../ai/shape';
import ECON from '../data/courses/econ';
import BUS from '../data/courses/bus';

/**
 * The registry is the app. These figures are about a person.
 *
 * `DESTINATIONS` is every screen this app has ever had, before `allowed` has
 * asked what the school has and before `forRole` has asked who is holding the
 * phone. It is the right list for a *manual* — `lib/guidebook.ts` documents
 * all of it on purpose, and the assistant's app-mode prompt should keep
 * describing screens this student has no use for, because "can it do X" is a
 * question about the app.
 *
 * It is the wrong list for any sentence of the form *you have opened N of M*,
 * or *M are being held back*. Three of those existed and all three read the
 * registry:
 *
 * | Where | Said |
 * | --- | --- |
 * | `ai/providers/personal.ts` | "N of 58 screens have been opened", plus every unopened name, to the model |
 * | `screens/Privacy.tsx` | "N of 58 screens you have never opened" |
 * | `lib/reveal.ts` `countHidden` | the settings line's "46 held back" |
 *
 * ## Why it lasted, and what the control here is for
 *
 * For a Vanderbilt student the registry and `offered()` are the same 58
 * screens, so all three were exactly right for the app's main user and for
 * every test written from their point of view. The control below pins that:
 * if a change makes the student's figures move, this test is measuring the
 * wrong thing, and a suite that only asserted "faculty sees fewer" would pass
 * against a pool that had simply been truncated.
 */

const VANDERBILT: Capabilities = {
  mealPlan: 'both',
  housing: true,
  campusMap: true,
  registrarUrl: 'https://yes.vanderbilt.edu',
  orgPortalUrl: 'https://anchorlink.vanderbilt.edu',
};

/** A real school with none of the five gated capabilities. */
const BARE: Capabilities = { mealPlan: 'none', housing: false, campusMap: false };

const FRESH: Facts = { ...NOTHING_YET };
const NONE: Record<string, boolean> = {};

describe('the registry is not this person’s app', () => {
  it('is the same list for a Vanderbilt student — the control', () => {
    // If this stops holding, every "faculty sees fewer" assertion below is
    // measuring something other than the gate.
    expect(offered(VANDERBILT, 'student')).toHaveLength(DESTINATIONS.length);
  });

  it('is shorter for every other person the app supports', () => {
    expect(offered(VANDERBILT, 'faculty').length).toBe(DESTINATIONS.length - 11);
    expect(offered(BARE, 'student').length).toBe(DESTINATIONS.length - 5);
    expect(offered(BARE, 'faculty').length).toBe(DESTINATIONS.length - 12);
  });
});

describe('what the settings line counts as held back', () => {
  const held = (caps: Capabilities, role: Role) =>
    countHidden(offered(caps, role), FRESH, NONE, false);

  it('is unchanged for a Vanderbilt student — the control', () => {
    expect(held(VANDERBILT, 'student')).toBe(
      countHidden(DESTINATIONS, FRESH, NONE, false),
    );
  });

  it('never counts a screen the reveal switch could not produce', () => {
    /*
     * The settings line offers a switch — "show every screen straight away".
     * A screen `allowed` or `forRole` has removed is not waiting behind that
     * switch; it does not exist here, and no amount of using the app makes
     * one. Counting it said "46 held back" to a faculty user whose app has 47
     * screens in it and is holding 35, and to a student at a school with no
     * meal plan, no housing and no campus map, where the figure is 41.
     */
    for (const [caps, role] of [
      [VANDERBILT, 'faculty'],
      [BARE, 'student'],
      [BARE, 'faculty'],
    ] as [Capabilities, Role][]) {
      const pool = offered(caps, role);
      expect(held(caps, role)).toBeLessThan(countHidden(DESTINATIONS, FRESH, NONE, false));
      expect(held(caps, role)).toBeLessThanOrEqual(pool.length);
    }
  });

  it('still answers nothing to somebody who asked for everything', () => {
    expect(countHidden(offered(BARE, 'faculty'), FRESH, NONE, true)).toBe(0);
  });
});

describe('what the assistant is told it has never opened', () => {
  const catalog = buildCatalog([ECON, BUS]);
  const look = (over: Partial<State> = {}): Look => ({
    state: {
      ...DEFAULT_PERSISTED,
      ...initialEphemeral(),
      courses: [ECON, BUS],
      term: '2026FA',
      ...over,
    } as State,
    catalog,
    now: new Date(2026, 8, 15),
  });

  const neverOpenedIn = (ctx: ReturnType<typeof me>): string[] => {
    const row = ctx?.visible?.find((r) => 'neverOpened' in (r as object)) as
      | { neverOpened: string }
      | undefined;
    return row ? row.neverOpened.split(', ').filter(Boolean) : [];
  };

  it('counts out of their app, not the registry', () => {
    const student = me(look({ role: 'student' }));
    const faculty = me(look({ role: 'faculty' }));
    // The control: a student's denominator is the whole registry, because for
    // them it is.
    expect(student?.summary).toContain(`of ${DESTINATIONS.length} screens`);
    expect(faculty?.summary).toContain(`of ${offered(VANDERBILT, 'faculty').length} screens`);
    expect(faculty?.summary).not.toContain(`of ${DESTINATIONS.length} screens`);
  });

  it('names nothing a faculty user cannot open', () => {
    /*
     * This provider offers the model `open_screen` and a suggestion reading
     * "What have I never opened that I should?". Handing it `degree`,
     * `runway`, `behind`, `groupwork`, `meals`, `housing`, `yes`,
     * `classmates`, `activities`, `costs` and `applying` — the eleven
     * `forRole` removes — is how the assistant comes to recommend a degree
     * audit to somebody teaching the course.
     */
    const can = new Set(offered(VANDERBILT, 'faculty').map((d) => d.screen as string));
    const named = neverOpenedIn(me(look({ role: 'faculty' })));
    expect(named.length, 'nothing is named, so this proves nothing').toBeGreaterThan(0);
    for (const screen of named) expect(can, screen).toContain(screen);
  });

  it('still names the student-only screens to a student — the control', () => {
    // Same probe, same fixture, opposite answer: the filter is the role, not
    // a list that came back empty.
    const named = neverOpenedIn(me(look({ role: 'student' })));
    expect(named).toContain('degree');
    expect(named).toContain('meals');
  });
});

describe('the file that may no longer reach the registry', () => {
  /*
   * A structural check, not a runtime one, and the sibling of the one
   * `lib/unseen.test.ts` now holds.
   *
   * `lib/unseen.ts` had the registry as a *default* pool for four passes and
   * was fixed on main while this pass was being written — see the note there,
   * whose `@ts-expect-error` is the better instrument for a signature because
   * it fails both when the default comes back and when the parameter is made
   * optional. This file is not that: `countHidden` never had a default, it
   * named `DESTINATIONS` in its own body, and what keeps it honest is that it
   * can no longer say the word.
   */
  it('reveal.ts does not import DESTINATIONS', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'lib', 'reveal.ts'), 'utf8');
    const imports = src.slice(0, src.indexOf('\nexport'));
    expect(imports).not.toMatch(/import\s*\{[^}]*\bDESTINATIONS\b/);
  });
});
