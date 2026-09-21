import { describe, expect, it } from 'vitest';
import {
  EMPTY_FAMILY,
  FAMILY_CATEGORIES,
  familyPlanActive,
  familyPreview,
  newFamilyItem,
  newFamilyMember,
  type FamilyAccess,
  type FamilyLibrary,
  type FamilyMember,
} from './family';

/**
 * What a preview shows, and the four ways it must show nothing.
 *
 * `lib/family.ts` had no test. It is the module behind the one screen in this
 * app whose entire argument is *restraint* — the version everybody else builds
 * is a parent login, and the module's own docblock says why that is wrong: "A
 * student who wanted one thing shared has shared their life." `familyPreview`
 * is where that argument is actually enforced, and nothing was holding it.
 *
 * ## The one that would break quietly
 *
 * `FamilyAccess` is `'none' | 'selected' | 'view' | 'payment'`, and the four
 * are **not an ordinal scale** — `@semester/institution` says so in as many
 * words. `payment` lets somebody pay and read nothing, so it sits outside the
 * order rather than above `view`. The filter is therefore an explicit
 * `['selected', 'view']` and not a `>=`.
 *
 * That is the line somebody tidies. Read as a scale, `payment` looks like the
 * most access rather than a different kind, and adding it to the filter is a
 * one-word change that makes a payer a reader — of the health administration
 * and the calendar, in a feature whose whole point is that they are not.
 *
 * ## The control matters more than the assertions
 *
 * Four of the cases below assert an empty preview, and a `familyPreview` that
 * returned `[]` unconditionally would pass all four. So the first case asserts
 * the opposite, and the last walks every access level rather than the ones
 * that interest us — a fifth added to the union should fail here rather than
 * quietly land on whichever side the filter's default puts it.
 */

const CATEGORY = 'finances';

function member(over: Partial<FamilyMember> = {}): FamilyMember {
  const m = newFamilyMember();
  return { ...m, name: 'A parent', ...over };
}

function withAccess(m: FamilyMember, access: FamilyAccess): FamilyMember {
  return { ...m, permissions: { ...m.permissions, [CATEGORY]: access } };
}

function library(m: FamilyMember, titles: string[] = ['The autumn bill']): FamilyLibrary {
  return {
    ...EMPTY_FAMILY,
    members: [m],
    items: titles.map((title) => ({ ...newFamilyItem(m.id), category: CATEGORY, title })),
  };
}

describe('familyPreview', () => {
  it('shows a chosen item to somebody the student chose it for', () => {
    // The control. Every "sees nothing" case below is worthless without it:
    // a filter that always returned [] would satisfy all of them.
    const m = withAccess(member(), 'selected');
    const shown = familyPreview(library(m), m.id);
    expect(shown.map((i) => i.title)).toEqual(['The autumn bill']);
  });

  it('shows a payer nothing at all', () => {
    // `payment` is not a level of reading. See the docblock above: this is the
    // assertion that fails if the four are ever treated as a scale.
    const m = withAccess(member(), 'payment');
    expect(familyPreview(library(m), m.id)).toEqual([]);
  });

  it('shows nothing once the student revokes the plan', () => {
    const m = withAccess(member({ revoked: true }), 'view');
    expect(familyPreview(library(m), m.id)).toEqual([]);
  });

  it('shows nothing the day after the plan expires, and everything on the day itself', () => {
    const m = withAccess(member({ expires: '2026-09-21' }), 'view');
    // `familyPlanActive` compares calendar days as strings, in the reader's own
    // timezone, so a plan that expires today is live until the day turns.
    expect(familyPlanActive(m, '2026-09-21')).toBe(true);
    expect(familyPreview(library(m), m.id, '2026-09-21')).toHaveLength(1);
    expect(familyPreview(library(m), m.id, '2026-09-22')).toEqual([]);
  });

  it('never shows one person the items chosen for another', () => {
    const mine = withAccess(member(), 'view');
    const other = withAccess(member(), 'view');
    const lib: FamilyLibrary = {
      ...EMPTY_FAMILY,
      members: [mine, other],
      items: [
        { ...newFamilyItem(mine.id), category: CATEGORY, title: 'For mine' },
        { ...newFamilyItem(other.id), category: CATEGORY, title: 'For the other' },
      ],
    };
    expect(familyPreview(lib, mine.id).map((i) => i.title)).toEqual(['For mine']);
    expect(familyPreview(lib, other.id).map((i) => i.title)).toEqual(['For the other']);
  });

  it('shows nothing for a member who is not in the library', () => {
    expect(familyPreview(library(withAccess(member(), 'view')), 'nobody')).toEqual([]);
  });

  it('decides every access level explicitly, so a new one cannot land by default', () => {
    // Walks the union rather than the two that interest us. A fifth level
    // added to `FamilyAccess` fails this row rather than inheriting whichever
    // side of the filter it happens to fall on.
    const levels: FamilyAccess[] = ['none', 'selected', 'view', 'payment'];
    const reads = levels.filter((a) => {
      const m = withAccess(member(), a);
      return familyPreview(library(m), m.id).length > 0;
    });
    expect(reads).toEqual(['selected', 'view']);
  });

  it('starts every category at none, so nothing is shared by not deciding', () => {
    const m = member();
    expect(FAMILY_CATEGORIES.every((c) => m.permissions[c] === 'none')).toBe(true);
    expect(familyPreview(library(m), m.id)).toEqual([]);
  });
});
