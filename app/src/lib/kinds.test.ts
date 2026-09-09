import { describe, expect, it } from 'vitest';
import { CAMPUS_KIND, CAMPUS_TINT, EVENT_KINDS, blockLabel, kindOf, kindTint } from './kinds';
import { AA_LARGE, contrast } from './contrast';
import { GROUNDS } from './look';
import { satOf } from './tint';

describe('blockLabel', () => {
  it('names the kind, which the tinted border carries and nothing else', () => {
    expect(blockLabel('Standup', 'work', '9:00')).toBe('Standup. Work. 9:00.');
    expect(blockLabel('Gym', 'health', '6:30')).toBe('Gym. Health. 6:30.');
  });

  it('calls a null kind a class — the one kind that comes from a syllabus', () => {
    expect(blockLabel('ECON 1020', null, '9:05')).toBe('ECON 1020. Class. 9:05.');
    expect(blockLabel('ECON 1020', undefined, '9:05')).toBe('ECON 1020. Class. 9:05.');
  });

  it('calls a task a task rather than "Other"', () => {
    // The other kind that is not in `EVENT_KINDS`: a task is a thing you
    // wrote down, not a category of event you chose, and `kindOf` falls back
    // to Other — a word for an unfiled shift, not for a to-do.
    expect(blockLabel('Draft the memo', 'task', '2:00')).toBe('Draft the memo. Task. 2:00.');
  });

  it('includes the meta line when there is one', () => {
    expect(blockLabel('ECON 1020', null, '9:05', 'Buttrick 101')).toBe(
      'ECON 1020. Class. 9:05. Buttrick 101.',
    );
  });

  it('says cancelled, which was a line-through and an opacity', () => {
    expect(blockLabel('ECON 1020', null, '9:05', '', true)).toBe(
      'ECON 1020. Class. 9:05. Cancelled.',
    );
  });

  it('gives every event kind words, so none is colour alone', () => {
    for (const k of EVENT_KINDS) {
      expect(blockLabel('x', k.id, '1:00'), k.id).toContain(k.label);
    }
  });
});

describe('a kind drawn for the ground it is on', () => {
  it('is the table verbatim on a dark ground', () => {
    // Not "close to": those seven values are the palette, and a change of
    // ground must not become a change of palette.
    for (const k of EVENT_KINDS) expect(kindTint(k.id, false)).toBe(k.tint);
  });

  it('keeps a kind’s own saturation, so Other stays a grey', () => {
    // The failure this catches: re-mixing every kind at the course palette's
    // saturation, which turns the one category meaning "uncategorised" into
    // a blue. Other is a near-grey in the table and has to stay one.
    expect(satOf('#9aa2ad')).toBeLessThan(0.2);
    expect(satOf(kindTint('other', true))).toBeLessThan(0.2);
    // And a kind that is a colour stays as saturated as it was.
    expect(satOf(kindTint('social', true))).toBeCloseTo(satOf(kindOf('social').tint), 2);
  });

  it('is dark enough to see on a light one, which it was not', () => {
    // The bug this fixes: seven pastels a couple of steps off a Parchment
    // page. A category colour that cannot be seen is a category that is not
    // there. A block's edge is a mark, so 3:1.
    for (const g of GROUNDS.filter((x) => x.light)) {
      for (const k of EVENT_KINDS) {
        expect(contrast(kindTint(k.id, true), g.ramp[2]) ?? 0, `${k.label} on ${g.label}`).toBeGreaterThanOrEqual(
          AA_LARGE,
        );
      }
    }
  });

  it('gives campus a colour of its own, not one of the seven', () => {
    // A campus event is drawn on the grids now, and it is neither a class nor
    // a kind anybody chose. Falling back to Other would have made "what is on
    // around campus" and "uncategorised thing I added" the same grey.
    expect(kindTint(CAMPUS_KIND, false)).toBe(CAMPUS_TINT);
    expect(EVENT_KINDS.map((k) => k.tint)).not.toContain(CAMPUS_TINT);
    expect(blockLabel('Football vs. Delaware', CAMPUS_KIND, '6:00')).toBe(
      'Football vs. Delaware. Campus. 6:00.',
    );
  });

  it('keeps campus visible on a light ground too', () => {
    for (const g of GROUNDS.filter((x) => x.light)) {
      expect(
        contrast(kindTint(CAMPUS_KIND, true), g.ramp[2]) ?? 0,
        `Campus on ${g.label}`,
      ).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });

  it('calls an unknown kind Other rather than throwing', () => {
    expect(kindTint('chores', false)).toBe(kindTint('other', false));
    expect(kindTint(null, true)).toBe(kindTint('other', true));
  });
});
