import { describe, expect, it } from 'vitest';
import {
  SAFEST,
  backupName,
  countRows,
  decide,
  destructive,
  done,
  options,
  type Sides,
} from './adopt';

const sides = (over: Partial<Sides> = {}): Sides => ({
  cloud: 0,
  local: 0,
  cloudCourses: 0,
  localCourses: 0,
  ...over,
});

describe('the case that can destroy a semester', () => {
  it('never treats an empty account as the truth', () => {
    // A student who has used the app all term signs in for the first time. If
    // the empty account wins, the term is gone before they finish reading the
    // welcome message.
    const move = decide(sides({ local: 300, localCourses: 4 }));
    expect(move.do).toBe('upload');
    expect(move.say).toContain('4 courses');
  });

  it('says so in courses rather than in rows', () => {
    // "180 kB" is not a thing a student recognises. "4 courses" is.
    expect(decide(sides({ local: 300, localCourses: 1 })).say).toContain('1 course');
  });

  it('uploads without asking, because that is what signing in is for', () => {
    // Asking here would be asking somebody to authorise the obvious.
    expect(decide(sides({ local: 40, localCourses: 2 })).do).toBe('upload');
  });
});

describe('the other two easy cases', () => {
  it('pulls onto an empty device', () => {
    const move = decide(sides({ cloud: 200, cloudCourses: 3 }));
    expect(move.do).toBe('pull');
    expect(move.say).toContain('3 courses');
  });

  it('says something plain when there is nothing anywhere', () => {
    const move = decide(sides());
    expect(move.do).toBe('nothing');
    expect(move.say).toContain('Nothing to bring across');
  });
});

describe('the one case that is a question', () => {
  const both = sides({ cloud: 200, local: 300, cloudCourses: 3, localCourses: 4 });

  it('asks rather than auto-merging somebody’s coursework', () => {
    expect(decide(both).do).toBe('ask');
  });

  it('states both sides in the same breath', () => {
    const said = decide(both).say;
    expect(said).toContain('This device has 4 courses');
    expect(said).toContain('account has 3 courses');
  });

  it('offers exactly three ways out', () => {
    expect(options(both).map((o) => o.id)).toEqual(['merge', 'cloud', 'device']);
  });

  it('defaults to the only one that cannot lose anything', () => {
    // A dialogue whose safe option is second is one that gets clicked through
    // to the dangerous one.
    expect(SAFEST).toBe('merge');
    expect(options(both)[0].id).toBe(SAFEST);
    expect(destructive('merge')).toBe(false);
  });

  it('names what each option does to the other side', () => {
    // The part somebody is actually deciding, and the part a vague label hides.
    const [, useCloud, useDevice] = options(both);
    expect(useCloud.blurb).toContain('4 courses');
    expect(useDevice.blurb).toContain('3 courses');
  });

  it('promises a backup on both of the ones that can lose something', () => {
    for (const o of options(both).filter((x) => destructive(x.id))) {
      expect(o.blurb.toLowerCase(), o.id).toContain('backup');
    }
    expect(destructive('cloud')).toBe(true);
    expect(destructive('device')).toBe(true);
  });

  it('admits what merging cannot fix', () => {
    // The same note edited on both devices is the one thing a union cannot
    // reconcile, and the app would rather say so than pretend.
    expect(options(both)[0].blurb).toContain('later edit wins');
  });
});

describe('what it says afterwards', () => {
  const both = sides({ cloud: 200, local: 300, cloudCourses: 3, localCourses: 4 });

  it('confirms nothing was dropped on a merge', () => {
    expect(done('merge', both)).toContain('nothing was dropped');
  });

  it('mentions the backup on the two that overwrote', () => {
    expect(done('cloud', both).toLowerCase()).toContain('backup');
    expect(done('device', both).toLowerCase()).toContain('backup');
  });
});

describe('the backup file', () => {
  it('is named so two in one day do not collide', () => {
    const a = backupName(Date.parse('2026-09-06T09:05:00'));
    const b = backupName(Date.parse('2026-09-06T14:32:00'));
    expect(a).not.toBe(b);
    expect(a).toMatch(/^semester-before-sign-in-2026-09-06-0905\.json$/);
  });
});

describe('counting what is on a side', () => {
  it('counts rows in lists and keys in maps', () => {
    const { rows } = countRows({ notes: [1, 2, 3], done: { a: true, b: true } });
    expect(rows).toBe(5);
  });

  it('counts courses separately, because that is the unit people think in', () => {
    expect(countRows({ courses: [1, 2, 3, 4], notes: [] }).courses).toBe(4);
  });

  it('does not count a setting as a row', () => {
    // Somebody who has only ever changed the accent should still be told this
    // device is empty.
    expect(countRows({ accent: 'copper', textSize: 'large', hue: 210 }).rows).toBe(0);
  });

  it('takes anything that is not a state as empty', () => {
    expect(countRows(null).rows).toBe(0);
    expect(countRows('x').rows).toBe(0);
  });
});
