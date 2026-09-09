import { describe, expect, it } from 'vitest';
import {
  foundStop,
  leaving,
  matchStops,
  nearestFirst,
  reach,
  roomStop,
  savedStop,
  said,
  type Stop,
} from './arrive';
import type { SavedPlace } from './place';

const place = (label: string, lat: number, lon: number): SavedPlace => ({
  id: label.toLowerCase(),
  label,
  lat,
  lon,
  radius: 80,
  created: 0,
});

// Two points about 250 m apart on Vanderbilt's campus.
const buttrick = place('Buttrick', 36.1462, -86.8032);
const rand = place('Rand', 36.1447, -86.8055);

describe('reach', () => {
  it('measures the walk and says it in one line', () => {
    const r = reach(buttrick, rand);
    expect(r.metres).toBeGreaterThan(200);
    expect(r.metres).toBeLessThan(300);
    expect(r.minutes).toBe(Math.max(1, Math.ceil(r.metres / 80)));
    expect(r.line).toContain('walk');
  });

  it('never says nought minutes, however close', () => {
    expect(reach(buttrick, { lat: buttrick.lat, lon: buttrick.lon }).minutes).toBe(1);
  });
});

describe('roomStop', () => {
  it('takes coordinates from a place you saved, matched on the building', () => {
    const stop = roomStop('k', 'class', 'ECON 1020', 'Buttrick 101', { query: 'Buttrick' }, [
      buttrick,
    ]);
    expect(stop.spot).toEqual({ lat: buttrick.lat, lon: buttrick.lon });
    expect(stop.placeId).toBe('buttrick');
    // The hand-off to the map app uses the coordinate rather than the search,
    // because an exact position beats a building name every time.
    expect(stop.dest.lat).toBe(buttrick.lat);
  });

  it('says it does not know rather than guessing', () => {
    const stop = roomStop('k', 'class', 'ECON 1020', 'Furman 114', { query: 'Furman' }, [buttrick]);
    expect(stop.spot).toBeNull();
    expect(stop.placeId).toBeUndefined();
    expect(stop.building).toBe('Furman');
  });
});

describe('said', () => {
  it('keeps the minutes, which an hour grid drops and a sentence needs', () => {
    expect(said(545)).toBe('9:05a');
    expect(said(660)).toBe('11:00a');
    expect(said(720)).toBe('12:00p');
    expect(said(0)).toBe('12:00a');
  });
});

describe('leaving', () => {
  // A class at 9:05 is 545 minutes past midnight; a seven-minute walk plus the
  // three-minute cushion means setting off at 8:55.
  it('gives a time while there is time', () => {
    const l = leaving(500, 545, 7);
    expect(l.at).toBe(535);
    expect(l.urgency).toBe('later');
    expect(l.line).toContain('8:55a');
  });

  it('counts down once it is close', () => {
    const l = leaving(525, 545, 7);
    expect(l.urgency).toBe('soon');
    expect(l.line).toContain('10 minutes');
  });

  it('says now at the moment itself', () => {
    expect(leaving(535, 545, 7).urgency).toBe('now');
  });

  it('says how late rather than rounding it up to "now"', () => {
    const l = leaving(545, 545, 7);
    expect(l.urgency).toBe('late');
    expect(l.line).toContain('10 minutes ago');
  });
});

describe('nearestFirst', () => {
  it('sorts what it can measure and keeps the rest', () => {
    const stops: Stop[] = [
      savedStop(rand),
      roomStop('u', 'room', 'PSCI 2100', 'Furman 114', { query: 'Furman' }, []),
      savedStop(buttrick),
    ];
    const out = nearestFirst(stops, { lat: buttrick.lat, lon: buttrick.lon });
    expect(out.map((o) => o.stop.label)).toEqual(['Buttrick', 'Rand', 'PSCI 2100']);
    expect(out[2].reach).toBeNull();
  });

  it('measures nothing at all without a position, and drops nothing either', () => {
    const out = nearestFirst([savedStop(rand)], null);
    expect(out).toHaveLength(1);
    expect(out[0].reach).toBeNull();
  });
});

describe('matchStops', () => {
  const stops: Stop[] = [
    savedStop(place('Grand Reading Room', 36.1449, -86.8009)),
    savedStop(rand),
    roomStop('e', 'room', 'ECON 1020', 'Buttrick 101', { query: 'Buttrick' }, [buttrick]),
  ];

  it('prefers the name that starts with what you typed', () => {
    expect(matchStops(stops, 'ran')[0].label).toBe('Rand');
  });

  it('finds a course by the room it is in', () => {
    expect(matchStops(stops, 'buttrick').map((s) => s.label)).toContain('ECON 1020');
  });

  it('waits for a second letter rather than listing everything', () => {
    expect(matchStops(stops, 'r')).toEqual([]);
  });

  it('shows one row per building, not one per source', () => {
    const twice = [...stops, roomStop('e2', 'class', 'ECON 1020', 'Buttrick 101', { query: 'B' }, [])];
    expect(twice.length).toBe(4);
    expect(matchStops(twice, 'econ')).toHaveLength(1);
  });
});

describe('foundStop', () => {
  it('carries the coordinates a search came back with', () => {
    const stop = foundStop({
      id: '1',
      name: 'Rand Dining Center',
      detail: 'West End Avenue',
      kind: 'restaurant',
      lat: 36.1447,
      lon: -86.8055,
    });
    expect(stop.spot).toEqual({ lat: 36.1447, lon: -86.8055 });
    expect(stop.detail).toBe('restaurant · West End Avenue');
    // Not yours until you save it — a found stop has no place id.
    expect(stop.placeId).toBeUndefined();
  });
});
