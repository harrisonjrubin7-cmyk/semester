import { describe, expect, it } from 'vitest';
import type { Taken } from './degree';
import {
  EMPTY_PATH_PROFILE,
  MAX_GOALS,
  NOT_OFFICIAL,
  hasPathProfile,
  pathCredits,
  pathStatus,
  readPathProfile,
  termLine,
} from './path-profile';
import { pathSnapshot } from './today-decision';

const taken = (hours: number, current = false): Taken =>
  ({ id: `t${hours}${current}`, code: 'X 1', hours, current }) as unknown as Taken;

describe('the stored profile', () => {
  it('starts empty, with no credit total assumed', () => {
    expect(EMPTY_PATH_PROFILE.creditTarget).toBeNull();
    expect(hasPathProfile(EMPTY_PATH_PROFILE)).toBe(false);
  });

  it('round-trips through its reader', () => {
    const p = {
      version: 1 as const,
      programme: 'Economics BA',
      targetTerm: { season: 'Spring' as const, year: 2029 },
      creditTarget: 120,
      goals: ['Study abroad', 'Internship'],
      updatedAt: 1,
    };
    expect(readPathProfile(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('drops what it cannot read instead of guessing', () => {
    const p = readPathProfile({
      version: 1,
      programme: 7,
      targetTerm: { season: 'Winter', year: 2029 },
      creditTarget: 9000,
      goals: ['a', '', 3, 'b', 'c', 'd', 'e', 'f'],
    });
    expect(p.programme).toBe('');
    expect(p.targetTerm).toBeNull();
    expect(p.creditTarget).toBeNull();
    expect(p.goals).toEqual(['a', 'b', 'c', 'd', 'e'].slice(0, MAX_GOALS));
  });

  it('refuses a value that is not a profile at all', () => {
    for (const bad of [null, [], {}, { version: 2 }]) expect(() => readPathProfile(bad)).toThrow();
  });
});

describe('credits', () => {
  const t = [taken(60), taken(15, true)];

  it('counts complete, in progress and planned separately', () => {
    const c = pathCredits(EMPTY_PATH_PROFILE, t, 16);
    expect(c).toMatchObject({ complete: 60, inProgress: 15, planned: 16 });
  });

  it('shows nothing remaining until the student gives a total', () => {
    expect(pathCredits(EMPTY_PATH_PROFILE, t, 16).remaining).toBeNull();
    expect(pathCredits({ ...EMPTY_PATH_PROFILE, creditTarget: 120 }, t, 16).remaining).toBe(29);
  });

  it('never goes below zero', () => {
    expect(pathCredits({ ...EMPTY_PATH_PROFILE, creditTarget: 50 }, t, 0).remaining).toBe(0);
  });
});

describe('status and wording', () => {
  it('maps the snapshot to the three statuses, and qualifies "on track"', () => {
    expect(pathStatus(pathSnapshot([], [])).status).toBe('incomplete');
    const on = pathStatus({ ...pathSnapshot([], []), state: 'moving' });
    expect(on.status).toBe('on_track');
    expect(on.label).toMatch(/by what you recorded/);
    expect(pathStatus({ ...pathSnapshot([], []), state: 'review' }).label).toBe('Review recommended');
  });

  it('says it is not official degree clearance', () => {
    expect(NOT_OFFICIAL).toMatch(/not an official degree audit or degree clearance/);
  });

  it('writes a target term the way a student says it', () => {
    expect(termLine({ season: 'Fall', year: 2028 })).toBe('Fall 2028');
    expect(termLine(null)).toBeNull();
  });
});
