import { describe, expect, it } from 'vitest';
import { DESTINATIONS, lately, saysFor } from './nav';
import { NO_SCHOOL, type Capabilities } from './school';
import { BUNDLED } from '../data/schools';

const vanderbilt = BUNDLED.vanderbilt.capabilities;
const nowhere = NO_SCHOOL.capabilities;
const elsewhere: Capabilities = {
  mealPlan: 'dollars',
  cardName: 'Tetra',
  housing: true,
  campusMap: true,
  registrarName: 'ESTHER',
  registrarUrl: 'https://example.edu',
};

/**
 * One university's words are not the app's words.
 *
 * The directory promised everybody "Swipes and Commodore Cash" and labelled
 * the registration screen "YES" — Vanderbilt's name for its registrar — for a
 * student at a university that has never heard of either. That is not a screen
 * that should have been hidden; the gating was right. It is a screen whose
 * *words* belonged to somebody else, which is a failure the capability model
 * is supposed to prevent and did not, because nothing was checking.
 */
describe('the shared directory says nothing school-specific', () => {
  const OURS = [
    'commodore',
    'vanderbilt',
    'anchor link',
    'brightspace',
    'onevu',
    'myvu',
    // "YES" is a registrar's name and also an ordinary word, so it is matched
    // as a whole capitalised token rather than as a substring.
  ];

  it('keeps them out of every label and blurb', () => {
    for (const d of DESTINATIONS) {
      const said = `${d.label} ${d.blurb}`.toLowerCase();
      for (const word of OURS) {
        expect(said, `${d.screen}: ${word}`).not.toContain(word);
      }
    }
  });

  it('keeps a registrar’s name out of the labels', () => {
    for (const d of DESTINATIONS) {
      expect(d.label, d.screen).not.toMatch(/\bYES\b/);
    }
  });

  it('leaves the keywords alone, because they are the way in', () => {
    // Searching "commodore cash" must still find the meal screen for somebody
    // who calls it that. Keywords are a haystack, not a promise on a page.
    const meals = DESTINATIONS.find((d) => d.screen === 'meals');
    expect(meals?.keywords).toContain('commodore');
  });
});

describe('and then says exactly what this school says', () => {
  it('gives Vanderbilt back its own words', () => {
    // The whole point. Generalising must not cost the reference school the
    // thing that made the app good.
    const meals = DESTINATIONS.find((d) => d.screen === 'meals')!;
    expect(saysFor(meals, vanderbilt).blurb).toContain('Commodore Cash');
    expect(saysFor(meals, vanderbilt).blurb).toContain('Meal swipes');
    const yes = DESTINATIONS.find((d) => d.screen === 'yes')!;
    expect(saysFor(yes, vanderbilt).label).toBe('YES');
  });

  it('gives another school its own', () => {
    const meals = DESTINATIONS.find((d) => d.screen === 'meals')!;
    const said = saysFor(meals, elsewhere).blurb;
    expect(said).toContain('Tetra');
    expect(said.toLowerCase()).not.toContain('swipe');
    expect(saysFor(DESTINATIONS.find((d) => d.screen === 'yes')!, elsewhere).label).toBe('ESTHER');
  });

  it('says something true for a school that has named nothing', () => {
    for (const d of DESTINATIONS) {
      const said = saysFor(d, nowhere);
      expect(said.label.trim(), d.screen).not.toBe('');
      expect(said.blurb.trim(), d.screen).not.toBe('');
    }
  });

  it('names the course site rather than one particular one', () => {
    const connect = DESTINATIONS.find((d) => d.screen === 'connect')!;
    expect(saysFor(connect, vanderbilt).blurb).toContain('Brightspace');
    expect(saysFor(connect, nowhere).blurb).toContain('your course site');
  });

  it('leaves every other destination exactly as written', () => {
    for (const d of DESTINATIONS) {
      if (d.screen === 'meals' || d.screen === 'yes' || d.screen === 'connect') continue;
      expect(saysFor(d, vanderbilt)).toEqual({ label: d.label, blurb: d.blurb });
    }
  });
});

describe('the bar stays short whatever a registrar is called', () => {
  it('does not put a school’s own name in a 57px tab', () => {
    // "Student Center" would not fit and truncating it in the bar reads as a
    // bug, so the bar keeps a generic short label and the directory — which
    // has room — is where the school's own word appears.
    const yes = DESTINATIONS.find((d) => d.screen === 'yes')!;
    expect(yes.short).toBeDefined();
    expect((yes.short as string).length).toBeLessThanOrEqual(9);
  });
});

describe('the places you keep going back to', () => {
  const caps = vanderbilt;

  it('lists the most recent first', () => {
    expect(lately(['grades', 'runway', 'essay'], [], caps).map((d) => d.screen)).toEqual([
      'grades',
      'runway',
      'essay',
    ]);
  });

  it('leaves out whatever this layout already puts one tap away', () => {
    // The tab bar and the springboard's dock hold different screens, which is
    // why the bar is a parameter rather than a constant.
    expect(lately(['grades', 'runway'], ['grades'], caps).map((d) => d.screen)).toEqual(['runway']);
  });

  it('leaves out a screen this school has no equivalent of', () => {
    // Visited before somebody changed school. It must not come back in
    // through this door when the directory has already dropped it.
    expect(lately(['meals', 'grades'], [], nowhere).map((d) => d.screen)).toEqual(['grades']);
    expect(lately(['meals', 'grades'], [], caps).map((d) => d.screen)).toContain('meals');
  });

  it('drops anything that is not a place in the app', () => {
    expect(lately(['grades', 'nonsense'], [], caps).map((d) => d.screen)).toEqual(['grades']);
  });

  it('never lists the same screen twice', () => {
    expect(lately(['grades', 'grades', 'runway'], [], caps)).toHaveLength(2);
  });

  it('stops at four, because a list of twelve is the directory again', () => {
    const many = ['grades', 'runway', 'essay', 'deck', 'exam', 'costs'];
    expect(lately(many, [], caps)).toHaveLength(4);
  });
});
