import { describe, expect, it } from 'vitest';
import {
  NO_SCHOOL,
  REQUIRES,
  allowed,
  cardName,
  hiddenFor,
  lmsName,
  moveOut,
  moveOutWhy,
  orgPortalName,
  readCapabilities,
  readSchool,
  registrarName,
  schoolLine,
  showsCash,
  showsSwipes,
  swipeUnit,
  termFor,
  type Capabilities,
  type SchoolData,
} from './school';
import { BUNDLED, resolveSchool } from '../data/schools';

const VU = BUNDLED.vanderbilt;

/** A school with nothing switched on — somebody at any other university. */
const PLAIN: Capabilities = { mealPlan: 'none', housing: false, campusMap: false };

describe('Vanderbilt loses nothing', () => {
  it('ships in the bundle, so a first launch offline still knows it', () => {
    // Putting the profile behind a fetch would break the local-first guarantee
    // for the one university the app was built for.
    expect(VU.id).toBe('vanderbilt');
    expect(VU.name).toContain('Vanderbilt');
  });

  it('keeps every detail the app already had', () => {
    const c = VU.capabilities;
    expect(c.cardName).toBe('Commodore Cash');
    expect(c.swipeUnit).toBe('meal swipes');
    expect(c.registrarName).toBe('YES');
    expect(c.registrarUrl).toBe('https://yes.vanderbilt.edu');
    expect(c.orgPortalName).toBe('Anchor Link');
    expect(c.lmsName).toBe('Brightspace');
    expect(c.athleticsName).toBe('Commodores');
    expect(c.mealPlan).toBe('both');
    expect(c.housing).toBe(true);
    expect(c.campusMap).toBe(true);
  });

  it('hides nothing at all', () => {
    // The acceptance test for the whole refactor: a Vanderbilt student should
    // not be able to tell it happened.
    expect(hiddenFor(VU.capabilities)).toEqual([]);
  });

  it('is locked against a stranger correcting it', () => {
    expect(VU.verified).toBe(true);
  });

  it('counts move-out from the last exam, which is a rule not a fact', () => {
    // The pattern for all of this: the smart Vanderbilt behaviour is not
    // deleted, it is promoted to a named rule and Vanderbilt uses it.
    const lastExam = Date.parse('2026-12-18T11:00:00Z');
    expect(moveOut(VU.data, lastExam)).toBe(lastExam + 24 * 3_600_000);
    expect(moveOutWhy(VU.data)).toContain('24 hours after your last exam');
  });
});

describe('capabilities, not schools', () => {
  it('hides the school-specific screens for somebody with none of it', () => {
    expect(hiddenFor(PLAIN).sort()).toEqual(
      ['activities', 'housing', 'maps', 'meals', 'yes'].sort(),
    );
  });

  it('leaves everything universal alone', () => {
    // Roughly eighty per cent of the app, and the actual product.
    // `registrar` is in this list on purpose: add/drop and withdrawal dates
    // exist at every university. A school with no calendar in its pack gets a
    // list to fill in, not a missing screen.
    for (const screen of ['home', 'courses', 'grades', 'study', 'drill', 'exam', 'essay', 'weekly', 'mine', 'registrar']) {
      expect(allowed(screen, PLAIN), screen).toBe(true);
    }
  });

  it('opens one screen when one capability appears', () => {
    expect(allowed('meals', PLAIN)).toBe(false);
    expect(allowed('meals', { ...PLAIN, mealPlan: 'dollars' })).toBe(true);
  });

  it('needs a real url before offering a link to one', () => {
    // A registrar screen whose button goes nowhere is worse than no screen.
    expect(allowed('yes', { ...PLAIN, registrarName: 'Testudo' })).toBe(false);
    expect(allowed('yes', { ...PLAIN, registrarUrl: 'https://testudo.umd.edu' })).toBe(true);
  });

  it('gates every school-specific screen and nothing else', () => {
    expect(Object.keys(REQUIRES).sort()).toEqual(
      ['activities', 'housing', 'maps', 'meals', 'yes'].sort(),
    );
  });
});

describe('the words on the page', () => {
  it('uses the school’s own name for its money', () => {
    expect(cardName(VU.capabilities)).toBe('Commodore Cash');
    expect(swipeUnit(VU.capabilities)).toBe('meal swipes');
  });

  it('falls back to something true rather than something blank', () => {
    // A school with dollars on a card and no name for them still has dollars
    // on a card.
    expect(cardName({ ...PLAIN, mealPlan: 'dollars' })).toBe('card balance');
    expect(swipeUnit(PLAIN)).toBe('meals');
    expect(registrarName(PLAIN)).toBe('your registrar');
    expect(orgPortalName(PLAIN)).toContain('organisations');
    expect(lmsName(PLAIN)).toBe('your course site');
  });

  it('shows the halves of a meal plan that exist', () => {
    expect(showsSwipes({ ...PLAIN, mealPlan: 'swipes' })).toBe(true);
    expect(showsCash({ ...PLAIN, mealPlan: 'swipes' })).toBe(false);
    expect(showsSwipes({ ...PLAIN, mealPlan: 'both' })).toBe(true);
    expect(showsCash({ ...PLAIN, mealPlan: 'both' })).toBe(true);
    expect(showsSwipes(PLAIN)).toBe(false);
  });
});

describe('the data pack, and what it refuses to invent', () => {
  it('gives no move-out date where the school has not said', () => {
    // An invented move-out date is worse than none: somebody would book a
    // flight around it.
    expect(moveOut({}, Date.now())).toBeNull();
    expect(moveOutWhy({})).toBe('');
  });

  it('gives none where the rule needs an exam and there is none', () => {
    expect(moveOut(VU.data, null)).toBeNull();
  });

  it('handles a school that uses a fixed date instead', () => {
    const fixed: SchoolData = { housing: { moveOutRule: 'fixed_date', fixedDate: '2026-12-20' } };
    expect(moveOut(fixed, null)).toBe(Date.parse('2026-12-20T12:00:00'));
    expect(moveOutWhy(fixed)).toContain('fixed date');
  });

  it('refuses a fixed rule with no date rather than guessing one', () => {
    expect(moveOut({ housing: { moveOutRule: 'fixed_date' } }, Date.now())).toBeNull();
  });

  it('finds the term covering a date, and none outside one', () => {
    const data: SchoolData = {
      academicCalendar: [
        { termName: 'Fall 2026', startsOn: '2026-08-19', endsOn: '2026-12-18', deadlines: [] },
      ],
    };
    expect(termFor(data, '2026-09-06')?.termName).toBe('Fall 2026');
    expect(termFor(data, '2027-01-04')).toBeNull();
    expect(termFor({}, '2026-09-06')).toBeNull();
  });
});

describe('a profile written by someone else', () => {
  it('takes what it recognises', () => {
    const c = readCapabilities({ mealPlan: 'swipes', housing: true, cardName: 'Terrapin Express' });
    expect(c.mealPlan).toBe('swipes');
    expect(c.cardName).toBe('Terrapin Express');
    expect(c.housing).toBe(true);
  });

  it('refuses a link that is not one', () => {
    // A capability row is user-supplied, and `javascript:` in a field the app
    // turns into a link is the obvious way to abuse that.
    expect(readCapabilities({ registrarUrl: 'javascript:alert(1)' }).registrarUrl).toBeUndefined();
    expect(readCapabilities({ orgPortalUrl: '/relative' }).orgPortalUrl).toBeUndefined();
    expect(readCapabilities({ libraryUrl: 'https://ok.example' }).libraryUrl).toBe('https://ok.example');
  });

  it('refuses a meal plan it has never heard of', () => {
    expect(readCapabilities({ mealPlan: 'bitcoin' }).mealPlan).toBe('none');
  });

  it('takes rubbish as nothing rather than throwing', () => {
    expect(readCapabilities(null)).toEqual({ mealPlan: 'none', housing: false, campusMap: false });
    expect(readSchool('x')).toEqual(NO_SCHOOL);
    expect(readSchool({ id: 'umd' }).capabilities.mealPlan).toBe('none');
  });

  it('does not let anyone claim to be verified by saying so', () => {
    expect(readSchool({ id: 'fake', verified: 'yes' }).verified).toBe(false);
  });
});

describe('resolving which profile to use', () => {
  it('prefers the account row, so a fix lands without a build', () => {
    const fixed = readSchool({ id: 'vanderbilt', name: 'Vanderbilt', capabilities: { mealPlan: 'swipes' } });
    expect(resolveSchool('vanderbilt', fixed).capabilities.mealPlan).toBe('swipes');
  });

  it('falls back to the bundle rather than to nothing', () => {
    expect(resolveSchool('vanderbilt', null).capabilities.cardName).toBe('Commodore Cash');
  });

  it('ignores a loaded row for a different school', () => {
    const other = readSchool({ id: 'umd', name: 'Maryland' });
    expect(resolveSchool('vanderbilt', other).name).toContain('Vanderbilt');
  });

  it('gives the empty school for one it has never heard of', () => {
    expect(resolveSchool('unknown-college', null).id).toBe('');
  });

  it('gives the empty school when none is set', () => {
    expect(resolveSchool('', null)).toEqual(NO_SCHOOL);
  });
});

describe('what the settings row says', () => {
  it('does not apologise for somebody’s university', () => {
    const line = schoolLine(readSchool({ id: 'umd', name: 'Maryland' }));
    expect(line).toContain('Maryland');
    for (const word of ['sorry', 'unfortunately', 'unsupported', 'not supported', 'limited']) {
      expect(line.toLowerCase()).not.toContain(word);
    }
  });

  it('says nothing is hidden when nothing is', () => {
    expect(schoolLine(VU)).toContain('switched on');
  });

  it('treats no school as a normal state', () => {
    expect(schoolLine(NO_SCHOOL)).toContain('universal part of the app');
  });
});

describe('search cannot reach what navigation hides', () => {
  it('offers a gated screen where the school has it', async () => {
    const { findEverything } = await import('./find');
    const { buildCatalog } = await import('../data/catalog');
    const cat = buildCatalog([]);
    const hits = findEverything(cat, new Date(), 'meal plan', [], [], VU.capabilities);
    const screens = hits.flatMap((g) => g.hits).filter((h) => h.kind === 'screen');
    expect(screens.some((h) => h.screen === 'meals')).toBe(true);
  });

  it('does not offer it where the school has not', () => {
    // Search was the leak: navigation could hide a screen and typing its name
    // would still walk you into it.
    return (async () => {
      const { findEverything } = await import('./find');
      const { buildCatalog } = await import('../data/catalog');
      const cat = buildCatalog([]);
      const hits = findEverything(cat, new Date(), 'meal plan', [], [], PLAIN);
      const screens = hits.flatMap((g) => g.hits).filter((h) => h.kind === 'screen');
      expect(screens.some((h) => h.screen === 'meals')).toBe(false);
    })();
  });
});
