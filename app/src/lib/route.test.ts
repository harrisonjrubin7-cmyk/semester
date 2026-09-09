import { describe, expect, it } from 'vitest';
import { NAMED, fromHash, replaces, same, toHash } from './route';
import type { Screen } from './types';

describe('writing an address', () => {
  it('names a plain screen and nothing else', () => {
    expect(toHash({ screen: 'study', id: '' })).toBe('#/study');
    expect(toHash({ screen: 'home', id: '' })).toBe('#/home');
  });

  it('names the thing a screen is about', () => {
    // The difference between "the study screen" and "ECON's guide", which is
    // the whole reason a link is worth sending.
    expect(toHash({ screen: 'course', id: 'econ' })).toBe('#/course/econ');
    expect(toHash({ screen: 'item', id: 'econ-p1' })).toBe('#/item/econ-p1');
    expect(toHash({ screen: 'note', id: 'n1' })).toBe('#/note/n1');
  });

  it('leaves out an id the screen is not about', () => {
    expect(toHash({ screen: 'study', id: 'econ' })).toBe('#/study');
  });

  it('carries the study mode on a guide, and only there', () => {
    expect(toHash({ screen: 'guide', id: 'econ', mode: 'slides' })).toBe('#/guide/econ?mode=slides');
    expect(toHash({ screen: 'course', id: 'econ', mode: 'slides' })).toBe('#/course/econ');
  });

  it('escapes an id somebody’s own data produced', () => {
    // A note id is generated, but a course id is a slug of a code and an
    // imported one has been anything.
    expect(toHash({ screen: 'course', id: 'a b/c' })).toBe('#/course/a%20b%2Fc');
  });
});

describe('reading one back', () => {
  it('round-trips every shape it writes', () => {
    for (const route of [
      { screen: 'study' as Screen, id: '' },
      { screen: 'course' as Screen, id: 'econ' },
      { screen: 'guide' as Screen, id: 'econ', mode: 'cards' as const },
      { screen: 'note' as Screen, id: 'a b/c' },
    ]) {
      expect(fromHash(toHash(route))).toEqual(route);
    }
  });

  it('takes a hash with or without its hash', () => {
    expect(fromHash('#/study')?.screen).toBe('study');
    expect(fromHash('/study')?.screen).toBe('study');
  });

  it('says nothing rather than guessing at an empty one', () => {
    expect(fromHash('')).toBeNull();
    expect(fromHash('#')).toBeNull();
    expect(fromHash('#/')).toBeNull();
  });

  it('refuses a mangled link rather than landing on a blank screen', () => {
    expect(fromHash('#/../etc')).toBeNull();
    expect(fromHash('#/12345')).toBeNull();
    expect(fromHash('#/<script>')).toBeNull();
  });

  it('drops an id from a screen that is not about one', () => {
    expect(fromHash('#/study/econ')?.id).toBe('');
  });

  it('has an entry in the table for every named screen it reads', () => {
    // A screen routable in one direction only is a link that opens the right
    // screen showing the wrong thing.
    for (const screen of Object.keys(NAMED) as Screen[]) {
      const written = toHash({ screen, id: 'x' });
      expect(fromHash(written)).toEqual({ screen, id: 'x' });
    }
  });
});

describe('whether it is a new place', () => {
  it('replaces when only the mode changed', () => {
    // Otherwise Back walks somebody through every mode they tried rather than
    // out of the guide.
    const a = { screen: 'guide' as Screen, id: 'econ', mode: 'cards' as const };
    const b = { screen: 'guide' as Screen, id: 'econ', mode: 'slides' as const };
    expect(replaces(a, b)).toBe(true);
  });

  it('pushes for a different screen or a different thing', () => {
    expect(replaces({ screen: 'guide', id: 'econ' }, { screen: 'guide', id: 'psci' })).toBe(false);
    expect(replaces({ screen: 'guide', id: 'econ' }, { screen: 'study', id: '' })).toBe(false);
  });

  it('replaces the first entry, because there is nothing to go back to', () => {
    expect(replaces(null, { screen: 'home', id: '' })).toBe(true);
  });
});

describe('comparing two', () => {
  it('ignores whether the mode was written or left out', () => {
    expect(same({ screen: 'study', id: '' }, { screen: 'study', id: '' })).toBe(true);
    expect(same({ screen: 'guide', id: 'e' }, { screen: 'guide', id: 'e', mode: undefined })).toBe(true);
  });

  it('tells two apart', () => {
    expect(same({ screen: 'study', id: '' }, { screen: 'home', id: '' })).toBe(false);
    expect(same(null, { screen: 'home', id: '' })).toBe(false);
    expect(same(null, null)).toBe(true);
  });
});

describe('links to screens that have since merged', () => {
  it('sends a retired screen to the one it merged into', () => {
    // Somebody bookmarked these before the merges. A saved link landing on a
    // screen the app no longer has is a blank page, which reads as the app
    // being broken rather than as a screen having moved.
    expect(fromHash('#/weekly')?.screen).toBe('brief');
    expect(fromHash('#/worked')?.screen).toBe('brief');
    expect(fromHash('#/check')?.screen).toBe('announce');
    expect(fromHash('#/chat')?.screen).toBe('ask');
    expect(fromHash('#/grades')?.screen).toBe('courses');
    // A settings page rather than a destination, and the same rule: it counted
    // the same bytes the Data screen counts.
    expect(fromHash('#/setStorage')?.screen).toBe('data');
    // The directory that was a screen is the tab it duplicated.
    expect(fromHash('#/everything')?.screen).toBe('me');
  });

  it('says which part of the survivor the link meant', () => {
    // The screen alone is the promise technically kept and actually broken:
    // a bookmark to the weekly report opening today's report is not it.
    expect(fromHash('#/weekly')?.opens).toEqual({ report: 'week' });
    expect(fromHash('#/worked')?.opens).toEqual({ report: 'term' });
    expect(fromHash('#/check')?.opens).toEqual({ changes: 'feed' });
    // `#/grades` meant the grade table, which is one of the three grains of
    // Courses — landing on the course list is the same broken promise.
    expect(fromHash('#/grades')?.opens).toEqual({ courses: 'grades' });
    // The id a link used to carry went with the screen: the table lists every
    // course and never read it.
    expect(fromHash('#/grades/econ')?.screen).toBe('courses');
    // `#/everything` says which tab of Progress it meant.
    expect(fromHash('#/everything')?.opens).toEqual({ meTab: 'all' });
    // Nothing to disambiguate: the chat was the whole of what Ask now is, and
    // the Data screen has no sections to open.
    expect(fromHash('#/chat')?.opens).toBeUndefined();
    expect(fromHash('#/setStorage')?.opens).toBeUndefined();
    expect(fromHash('#/brief')?.opens).toBeUndefined();
  });

  it('leaves every screen that still exists alone', () => {
    expect(fromHash('#/brief')?.screen).toBe('brief');
    expect(fromHash('#/announce')?.screen).toBe('announce');
    expect(fromHash('#/home')?.screen).toBe('home');
  });

  it('still refuses a name it has never had', () => {
    // The rename table is not a licence to guess: an unknown name is a route
    // to a screen the switch does not have, which is the caller's problem to
    // notice, not this file's to invent an answer for.
    expect(fromHash('#/nonsense')?.screen).toBe('nonsense');
    expect(fromHash('#/../etc')).toBeNull();
  });
});
