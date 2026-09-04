import { describe, expect, it } from 'vitest';
import {
  ASKS,
  SKIP_LINE,
  capabilitiesFrom,
  hintFor,
  idFor,
  nearDuplicates,
  schoolFrom,
  score,
  search,
} from './findschool';
import { NO_SCHOOL, hiddenFor, type School } from './school';

const of = (name: string, extra: Partial<School> = {}): School => ({
  ...NO_SCHOOL,
  id: name.toLowerCase().replace(/\W+/g, '-'),
  name,
  ...extra,
});

const all: School[] = [
  of('Vanderbilt University', { shortName: 'Vanderbilt', emailDomains: ['vanderbilt.edu'] }),
  of('University of Vermont', { shortName: 'UVM' }),
  of('Ohio State University', { emailDomains: ['osu.edu'] }),
];

describe('finding a school by typing', () => {
  it('puts a prefix above a mention', () => {
    const got = search('van', all);
    expect(got[0].name).toBe('Vanderbilt University');
  });

  it('finds a school by its short name', () => {
    expect(search('uvm', all)[0].name).toBe('University of Vermont');
  });

  it('matches across words for a name people type out of order', () => {
    expect(score(all[1], 'vermont university')).toBeGreaterThan(0);
  });

  it('finds nothing rather than everything', () => {
    expect(search('zzz', all)).toEqual([]);
  });

  it('shows the list before anything is typed', () => {
    // An empty search box that shows nothing looks broken.
    expect(search('', all)).toHaveLength(3);
  });
});

describe('the email hint', () => {
  it('preselects the school an address belongs to', () => {
    expect(hintFor('someone@vanderbilt.edu', all)?.name).toBe('Vanderbilt University');
  });

  it('matches a subdomain, because plenty of schools use them', () => {
    expect(hintFor('me@mail.vanderbilt.edu', all)?.id).toBe('vanderbilt-university');
  });

  it('has nothing to say about a personal address, and says nothing', () => {
    expect(hintFor('me@gmail.com', all)).toBeNull();
    expect(hintFor(null, all)).toBeNull();
    expect(hintFor('', all)).toBeNull();
  });

  it('never narrows the list it hints about', () => {
    // The point of the rule. Somebody on a Gmail address must still see every
    // school, including their own.
    expect(search('', all)).toHaveLength(3);
    expect(search('ohio', all)).toHaveLength(1);
  });
});

describe('not ending up with eleven Ohio States', () => {
  it('offers a match before letting somebody add a duplicate', () => {
    expect(nearDuplicates('ohio state', all).map((s) => s.name)).toEqual(['Ohio State University']);
  });

  it('catches the longer form of a name already here', () => {
    expect(nearDuplicates('The Ohio State University', all)).toHaveLength(1);
  });

  it('says nothing about two letters, which match everything', () => {
    expect(nearDuplicates('oh', all)).toEqual([]);
  });

  it('gives a genuinely new school a clean id', () => {
    expect(idFor('Rice University', all)).toBe('rice-university');
  });

  it('does not collide with one already here', () => {
    const id = idFor('Vanderbilt University', all);
    expect(id).not.toBe('vanderbilt-university');
    expect(all.some((s) => s.id === id)).toBe(false);
  });
});

describe('the questions', () => {
  it('asks in words a student uses, not in column names', () => {
    for (const a of ASKS) {
      expect(a.ask.endsWith('?'), a.id).toBe(true);
      expect(a.ask.toLowerCase()).not.toMatch(/capabilit|boolean|enum|field|config/);
    }
  });

  it('asks about the thing rather than the screen', () => {
    const meals = ASKS.find((a) => a.id === 'meals');
    expect(meals?.ask).toMatch(/eating/i);
  });

  it('offers to skip in a sentence that says what skipping costs', () => {
    expect(SKIP_LINE).toMatch(/courses|deadlines|grades/i);
    expect(SKIP_LINE.toLowerCase()).not.toContain('recommend');
  });
});

describe('answers into capabilities', () => {
  it('leaves everything off when nothing was answered', () => {
    const c = capabilitiesFrom({});
    expect(c).toEqual({ mealPlan: 'none', housing: false, campusMap: false });
  });

  it('never turns a blank into a default that opens an empty screen', () => {
    // Every screen a capability gates stays hidden. That is the honest state
    // for somebody who skipped, and it is most of what this file protects.
    const c = capabilitiesFrom({});
    expect(hiddenFor(c).sort()).toEqual(['activities', 'housing', 'maps', 'meals', 'yes']);
  });

  it('reads the plain answers', () => {
    const c = capabilitiesFrom({
      meals: 'both',
      cardName: 'Commodore Cash',
      housing: 'yes',
      campusMap: 'yes',
    });
    expect(c.mealPlan).toBe('both');
    expect(c.cardName).toBe('Commodore Cash');
    expect(c.housing).toBe(true);
    expect(c.campusMap).toBe(true);
  });

  it('refuses a meal plan it does not recognise rather than guessing', () => {
    expect(capabilitiesFrom({ meals: 'brunch' }).mealPlan).toBe('none');
  });

  it('drops a link that is not http', () => {
    // Somebody else's school profile becomes a link in this app. `javascript:`
    // in a field the app renders as an anchor is the obvious way to abuse it.
    const c = capabilitiesFrom({ registrarUrl: 'javascript:alert(1)', orgPortalUrl: 'nope' });
    expect(c.registrarUrl).toBeUndefined();
    expect(c.orgPortalUrl).toBeUndefined();
    expect(capabilitiesFrom({ registrarUrl: 'https://yes.vanderbilt.edu' }).registrarUrl).toBe(
      'https://yes.vanderbilt.edu',
    );
  });
});

describe('a school somebody added', () => {
  it('is never verified, whatever was typed', () => {
    // `verified` is what stops a stranger degrading a bundled profile.
    const s = schoolFrom('Rice University', {}, all);
    expect(s?.verified).toBe(false);
  });

  it('needs a name and nothing else', () => {
    expect(schoolFrom('Rice University', {}, all)?.capabilities.mealPlan).toBe('none');
    expect(schoolFrom('   ', {}, all)).toBeNull();
  });

  it('carries the answers through', () => {
    const s = schoolFrom('Rice University', { meals: 'swipes', housing: 'yes' }, all);
    expect(s?.capabilities.mealPlan).toBe('swipes');
    expect(s?.capabilities.housing).toBe(true);
  });
});
