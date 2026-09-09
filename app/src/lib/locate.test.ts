import { describe, expect, it } from 'vitest';
import { fillLine, foundLine, inside, judge, unplaced, type Candidate } from './locate';
import { roomStop, savedStop, type Stop } from './arrive';
import type { Found } from './findplace';
import type { SavedPlace } from './place';

const garland: SavedPlace = {
  id: 'g',
  label: 'Garland',
  lat: 36.1452,
  lon: -86.8046,
  radius: 80,
  created: 0,
};

const stop = (key: string, room: string, places: SavedPlace[] = []): Stop =>
  roomStop(key, 'room', key.toUpperCase(), room, { query: room }, places);

const hit = (name: string, lat: number, lon: number): Found => ({
  id: name,
  name,
  detail: 'Nashville, Davidson County',
  kind: 'building',
  lat,
  lon,
});

describe('unplaced', () => {
  it('names each building once, however many rooms are in it', () => {
    expect(
      unplaced([stop('a', 'Garland 162'), stop('b', 'Garland'), stop('c', 'Buttrick 101')]),
    ).toEqual(['Garland', 'Buttrick']);
  });

  it('leaves out what the app can already place', () => {
    expect(unplaced([stop('a', 'Garland 162', [garland]), stop('b', 'Furman 114')])).toEqual([
      'Furman',
    ]);
  });

  it('leaves out a saved place, which is placed by definition', () => {
    expect(unplaced([savedStop(garland)])).toEqual([]);
  });
});

describe('inside', () => {
  it('knows the campus box from the one the search is biased to', () => {
    expect(inside(36.1447, -86.8027)).toBe(true);
    // Franklin, twenty miles south.
    expect(inside(35.925, -86.868)).toBe(false);
  });
});

describe('judge', () => {
  it('prefers the result on campus over the one that came first', () => {
    const c = judge('Garland', [hit('Garland Road', 35.9, -86.9), hit('Garland Hall', 36.145, -86.805)]);
    expect(c.hit?.name).toBe('Garland Hall');
    expect(c.near).toBe(true);
    expect(c.keep).toBe(true);
  });

  it('offers a far result but does not tick it', () => {
    const c = judge('Garland', [hit('Garland Road', 35.9, -86.9)]);
    expect(c.hit?.name).toBe('Garland Road');
    expect(c.near).toBe(false);
    expect(c.keep).toBe(false);
    expect(c.line).toContain('outside campus');
  });

  it('says so when the name found nothing', () => {
    const c = judge('The Wond‘ry', []);
    expect(c.hit).toBeNull();
    expect(c.keep).toBe(false);
  });
});

describe('the sentences', () => {
  it('counts what is left to do', () => {
    expect(fillLine(0)).toContain('Every building');
    expect(fillLine(1)).toContain('One building');
    expect(fillLine(4)).toContain('4 buildings');
  });

  it('says how a run went, including what missed', () => {
    const found = judge('Garland', [hit('Garland Hall', 36.145, -86.805)]);
    const missed = judge('Nowhere', []);
    expect(foundLine([found, missed])).toBe('1 of 2 found; 1 not.');
    expect(foundLine([found])).toContain('Untick anything');
    expect(foundLine([missed] as Candidate[])).toBe('None of them could be found by name.');
  });
});
