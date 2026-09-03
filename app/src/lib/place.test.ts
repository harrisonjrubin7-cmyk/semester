import { describe, expect, it } from 'vitest';
import { DEFAULT_RADIUS, far, metresBetween, nearest, placeAt, type Fix, type SavedPlace } from './place';

// Two real points on Vanderbilt's campus, about 300 m apart.
const ALUMNI = { lat: 36.1462, lon: -86.8025 };
const LIBRARY = { lat: 36.1436, lon: -86.8036 };

const place = (label: string, at: { lat: number; lon: number }, radius = DEFAULT_RADIUS): SavedPlace =>
  ({ id: label, label, lat: at.lat, lon: at.lon, radius, created: 0 });

const fix = (at: { lat: number; lon: number }, accuracy = 10): Fix =>
  ({ lat: at.lat, lon: at.lon, accuracy, at: 0 });

describe('metresBetween', () => {
  it('is zero for the same point', () => {
    expect(metresBetween(ALUMNI, ALUMNI)).toBe(0);
  });

  it('measures a short campus walk within a few metres', () => {
    const d = metresBetween(ALUMNI, LIBRARY);
    expect(d).toBeGreaterThan(250);
    expect(d).toBeLessThan(350);
  });

  it('is symmetric', () => {
    expect(metresBetween(ALUMNI, LIBRARY)).toBeCloseTo(metresBetween(LIBRARY, ALUMNI), 6);
  });

  it('handles a degree of latitude at roughly 111 km', () => {
    const d = metresBetween({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});

describe('placeAt', () => {
  const places = [place('Alumni Hall', ALUMNI), place('Library', LIBRARY)];

  it('names the place you are standing in', () => {
    expect(placeAt(fix(ALUMNI), places)?.label).toBe('Alumni Hall');
  });

  it('says nothing when you are nowhere saved', () => {
    expect(placeAt(fix({ lat: 40.7, lon: -74 }), places)).toBeNull();
  });

  it('forgives a poor fix, because lectures happen indoors', () => {
    // 120 m away, but the phone only knows itself to 100 m.
    const off = { lat: ALUMNI.lat + 0.0011, lon: ALUMNI.lon };
    expect(placeAt(fix(off, 5), places)).toBeNull();
    expect(placeAt(fix(off, 100), places)?.label).toBe('Alumni Hall');
  });

  it('does not let a wild accuracy claim match anything anywhere', () => {
    const miles = { lat: 36.5, lon: -86.8 };
    expect(placeAt(fix(miles, 50_000), places)).toBeNull();
  });

  it('picks the nearer of two overlapping places', () => {
    const wide = [place('Campus', ALUMNI, 2000), place('Alumni Hall', ALUMNI, 80)];
    expect(placeAt(fix(ALUMNI), wide)?.label).toBe('Campus');
  });
});

describe('nearest', () => {
  it('orders by distance and reports it', () => {
    const out = nearest(fix(ALUMNI), [place('Library', LIBRARY), place('Alumni Hall', ALUMNI)]);
    expect(out[0].place.label).toBe('Alumni Hall');
    expect(out[0].metres).toBe(0);
    expect(out[1].metres).toBeGreaterThan(250);
  });

  it('returns nothing when nothing is saved', () => {
    expect(nearest(fix(ALUMNI), [])).toEqual([]);
  });
});

describe('far', () => {
  it('reads in metres up close and kilometres far away', () => {
    expect(far(42)).toBe('42 m');
    expect(far(999)).toBe('999 m');
    expect(far(1200)).toBe('1.2 km');
    expect(far(48_000)).toBe('48 km');
  });
});
