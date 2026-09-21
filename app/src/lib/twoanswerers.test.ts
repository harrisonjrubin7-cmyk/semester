import { describe, expect, it } from 'vitest';
import { answerLocally } from './localask';
import { findEverything } from './find';
import { DESTINATIONS, offered } from './nav';
import { buildCatalog } from '../data/catalog';
import type { Capabilities } from './school';
import type { Role } from './role';
import ECON from '../data/courses/econ';

/**
 * Two answerers to one typed question, and they must agree about what they
 * will not name.
 *
 * "Where is the meal plan" can be typed into the search box or into Ask, and
 * the app answers it twice from the same registry. `lib/find.ts` has gated
 * search on the school and the role since it was written, and says why:
 *
 * > search was the leak that would have let somebody reach a meal-plan screen
 * > their university does not have, and a role is the same kind of hole — a
 * > professor typing "housing" should not be offered a dorm screen the
 * > directory has already stopped showing them.
 *
 * `lib/localask.ts` — the offline answerer, written later — read the ungated
 * registry, in both halves of what it returns. Measured, before the fix:
 *
 * | Typed | search said | Ask said |
 * | --- | --- | --- |
 * | "where is the meal plan", school with no meal plan | nothing | `meals` |
 * | "housing", faculty | nothing | `housing` |
 * | "degree audit", faculty | nothing | `degree` |
 * | "campus map", school with no map | nothing | `maps` |
 *
 * For a Vanderbilt student the two agreed exactly, on every query. That is
 * the control below, and it is why this lasted: the answerer was not broken,
 * it was right for the person it was written against.
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

const cat = buildCatalog([ECON]);
const NOW = new Date(2026, 8, 15);

const asked = (q: string, caps: Capabilities, role: Role) =>
  (answerLocally(q, offered(caps, role))?.matches ?? []).map((m) => m.screen as string);

const searched = (q: string, caps: Capabilities, role: Role) =>
  findEverything(cat, NOW, q, [], [], caps, [], undefined, undefined, undefined, role)
    .flatMap((g) => g.hits ?? [])
    .filter((h) => h.kind === 'screen')
    .map((h) => h.screen as string);

const QUESTIONS = [
  'where is the meal plan',
  'housing',
  'meal swipes',
  'degree audit',
  'campus map',
];

describe('what the offline answerer will name', () => {
  it('is never a screen this person does not have', () => {
    for (const [caps, role] of [
      [VANDERBILT, 'faculty'],
      [BARE, 'student'],
      [BARE, 'faculty'],
    ] as [Capabilities, Role][]) {
      const can = new Set(offered(caps, role).map((d) => d.screen as string));
      for (const q of QUESTIONS) {
        for (const screen of asked(q, caps, role)) {
          expect(can, `"${q}" named ${screen}`).toContain(screen);
        }
      }
    }
  });

  it('never names one search has already refused', () => {
    // The two need not rank alike — they do not, and that is a separate
    // question. What they may not do is disagree about whether a screen is
    // this person's at all.
    for (const [caps, role] of [
      [VANDERBILT, 'faculty'],
      [BARE, 'student'],
    ] as [Capabilities, Role][]) {
      for (const q of QUESTIONS) {
        const refused = new Set(
          DESTINATIONS.map((d) => d.screen as string).filter(
            (s) => !offered(caps, role).some((d) => (d.screen as string) === s),
          ),
        );
        for (const screen of asked(q, caps, role)) {
          expect(refused, `"${q}" named ${screen}`).not.toContain(screen);
        }
      }
    }
  });

  it('still answers a Vanderbilt student exactly as it did — the control', () => {
    // If these move, the fix is not a gate, it is a truncation, and every
    // assertion above would pass against an answerer that had simply stopped
    // working.
    expect(asked('where is the meal plan', VANDERBILT, 'student')).toContain('meals');
    expect(asked('housing', VANDERBILT, 'student')).toContain('housing');
    expect(asked('degree audit', VANDERBILT, 'student')).toContain('degree');
    expect(asked('campus map', VANDERBILT, 'student')).toContain('maps');
  });

  it('agrees with search on what it will name, for that student', () => {
    for (const q of QUESTIONS) {
      const first = searched(q, VANDERBILT, 'student')[0];
      if (!first) continue;
      expect(asked(q, VANDERBILT, 'student'), q).toContain(first);
    }
  });
});

describe('what it quotes out of the guide', () => {
  /*
   * The half a fix to the ranking alone would have left behind. `fromGuide`
   * quotes the generated manual, which documents all fifty-eight screens on
   * purpose — so before the fix, "where is the meal plan" stopped naming the
   * meal screen and went on quoting its entry.
   */
  const quoted = (q: string, caps: Capabilities, role: Role) =>
    (answerLocally(q, offered(caps, role))?.fromGuide ?? []).join(' ');

  it('says nothing about a screen this school does not have', () => {
    expect(quoted('where is the meal plan', BARE, 'student')).not.toMatch(/meal/i);
    expect(quoted('housing move out date', BARE, 'student')).not.toMatch(/move-out/i);
  });

  it('says nothing about a screen this role does not have', () => {
    expect(quoted('housing move out date', VANDERBILT, 'faculty')).not.toMatch(/move-out/i);
  });

  it('still quotes both to the student they are written for — the control', () => {
    expect(quoted('where is the meal plan', VANDERBILT, 'student')).toMatch(/meal/i);
    expect(quoted('housing move out date', VANDERBILT, 'student')).toMatch(/move-out/i);
  });
});

describe('the file that may no longer reach the registry', () => {
  it('localask.ts does not import DESTINATIONS', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(process.cwd(), 'src', 'lib', 'localask.ts'), 'utf8');
    const imports = src.slice(0, src.indexOf('\nexport'));
    expect(imports).not.toMatch(/import\s*\{[^}]*\bDESTINATIONS\b/);
  });
});
