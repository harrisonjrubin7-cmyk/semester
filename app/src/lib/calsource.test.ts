import { describe, expect, it } from 'vitest';
import { keepBlock, shows, sourceName, type CalSource } from './calsource';

const ALL: CalSource[] = ['all', 'classes', 'deadlines', 'campus'];

describe('shows', () => {
  it('shows everything under All', () => {
    expect(shows('all')).toEqual({ classes: true, deadlines: true, campus: true });
  });

  it('gives each named source exactly its own bucket', () => {
    expect(shows('classes')).toEqual({ classes: true, deadlines: false, campus: false });
    expect(shows('deadlines')).toEqual({ classes: false, deadlines: true, campus: false });
    expect(shows('campus')).toEqual({ classes: false, deadlines: false, campus: true });
  });

  it('never leaves a source showing nothing', () => {
    // A chip that selects an empty set is a chip that empties the screen and
    // says nothing about why. Every one of the four turns something on.
    for (const source of ALL) {
      const on = Object.values(shows(source)).filter(Boolean);
      expect(on.length, source).toBeGreaterThan(0);
    }
  });

  it('covers every bucket between the three named sources', () => {
    // The union of the named three has to be All, or something is reachable
    // only by not filtering — which is a thing you cannot find on purpose.
    const union = {
      classes: shows('classes').classes || shows('deadlines').classes || shows('campus').classes,
      deadlines:
        shows('classes').deadlines || shows('deadlines').deadlines || shows('campus').deadlines,
      campus: shows('classes').campus || shows('deadlines').campus || shows('campus').campus,
    };
    expect(union).toEqual(shows('all'));
  });
});

describe('sourceName', () => {
  it('names the thing rather than the control', () => {
    // "Nothing from this source" describes the chips. These describe what is
    // missing, which is what somebody reading an empty screen wants.
    for (const source of ALL) {
      const said = sourceName(source);
      expect(said, source).not.toContain('source');
      expect(said.length, source).toBeGreaterThan(3);
    }
  });

  it('reads inside the sentence the empty states put it in', () => {
    expect(`Nothing from ${sourceName('deadlines')} this week.`).toBe(
      'Nothing from deadlines or your own tasks this week.',
    );
  });
});

describe('keepBlock', () => {
  const item = { kind: 'item' as const };
  const appointment = { kind: 'appointment' as const };

  it('keeps everything under All', () => {
    const on = shows('all');
    expect(keepBlock(undefined, on)).toBe(true);
    expect(keepBlock(item, on)).toBe(true);
    expect(keepBlock(appointment, on)).toBe(true);
  });

  it('treats a block with no record behind it as the timetable', () => {
    // A class from a syllabus, or a standing commitment: neither can be moved,
    // and both are hours in the day rather than work to hand in.
    expect(keepBlock(undefined, shows('classes'))).toBe(true);
    expect(keepBlock(undefined, shows('deadlines'))).toBe(false);
    expect(keepBlock(undefined, shows('campus'))).toBe(false);
  });

  it('files a deadline under Due and an appointment under Classes', () => {
    expect(keepBlock(item, shows('deadlines'))).toBe(true);
    expect(keepBlock(item, shows('classes'))).toBe(false);
    expect(keepBlock(appointment, shows('classes'))).toBe(true);
    expect(keepBlock(appointment, shows('deadlines'))).toBe(false);
  });

  it('draws nothing on a grid under Campus', () => {
    // Nothing on an hour grid is a campus event — they are listed beside it,
    // which is why choosing Campus empties the grid rather than filtering it.
    const on = shows('campus');
    expect([undefined, item, appointment].some((f) => keepBlock(f, on))).toBe(false);
  });
});
