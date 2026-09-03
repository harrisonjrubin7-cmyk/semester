import { describe, expect, it } from 'vitest';
import { BOXES, queryFor, readResults, searchUrl } from './findplace';

describe('queryFor', () => {
  it('pins a campus search to the university', () => {
    // "Buttrick" is a surname before it is a building.
    expect(queryFor('Buttrick', 'campus')).toBe('Buttrick, Vanderbilt University Nashville');
  });

  it('does not say Vanderbilt twice', () => {
    expect(queryFor('Vanderbilt Law School', 'campus')).toBe('Vanderbilt Law School');
    expect(queryFor('vandy rec center', 'campus')).toBe('vandy rec center');
  });

  it('keeps a city search in Nashville', () => {
    expect(queryFor('Pancake Pantry', 'city')).toBe('Pancake Pantry, Nashville, TN');
  });

  it('leaves a city search alone when it already says where', () => {
    expect(queryFor('Broadway, Nashville', 'city')).toBe('Broadway, Nashville');
    expect(queryFor('100 Main St, TN', 'city')).toBe('100 Main St, TN');
  });

  it('is empty for empty input rather than searching for the hint', () => {
    expect(queryFor('   ', 'campus')).toBe('');
  });
});

describe('searchUrl', () => {
  it('biases rather than fences, so a right answer just outside survives', () => {
    const url = new URL(searchUrl('Rand', 'campus'));
    expect(url.searchParams.get('bounded')).toBe('0');
    expect(url.searchParams.get('viewbox')).toBe(BOXES.campus.join(','));
  });

  it('asks for json and stays in the country', () => {
    const url = new URL(searchUrl('Rand', 'city'));
    expect(url.searchParams.get('format')).toBe('jsonv2');
    expect(url.searchParams.get('countrycodes')).toBe('us');
    expect(url.origin).toBe('https://nominatim.openstreetmap.org');
  });

  it('carries the scoped query, not the raw text', () => {
    expect(new URL(searchUrl('Buttrick', 'campus')).searchParams.get('q')).toContain('Vanderbilt');
  });
});

describe('readResults', () => {
  const raw = [
    {
      place_id: 12,
      lat: '36.1447',
      lon: '-86.8027',
      name: 'Rand Dining Center',
      display_name: 'Rand Dining Center, West End Avenue, Nashville, Davidson County, 37240, USA',
      type: 'dining_hall',
    },
  ];

  it('splits the name off the chain and keeps only useful context', () => {
    const [r] = readResults(raw);
    expect(r.name).toBe('Rand Dining Center');
    expect(r.detail).toBe('West End Avenue, Nashville, Davidson County');
    expect(r.kind).toBe('dining hall');
    expect(r.lat).toBeCloseTo(36.1447);
  });

  it('drops a result with no usable position rather than plotting it at zero', () => {
    // A marker at 0,0 is in the Atlantic and would look like a bug in the map.
    expect(readResults([{ place_id: 1, lat: 'x', lon: 'y' }])).toEqual([]);
  });

  it('survives a shape it did not expect', () => {
    expect(readResults(null)).toEqual([]);
    expect(readResults({ error: 'nope' })).toEqual([]);
    expect(readResults([])).toEqual([]);
  });

  it('falls back to the first part of the chain when there is no name', () => {
    const [r] = readResults([
      { place_id: 3, lat: '36.1', lon: '-86.8', display_name: '21st Avenue South, Nashville' },
    ]);
    expect(r.name).toBe('21st Avenue South');
    expect(r.detail).toBe('Nashville');
  });
});

describe('BOXES', () => {
  it('draws campus inside the city, not beside it', () => {
    const [cw, cn, ce, cs] = BOXES.campus;
    const [w, n, e, s] = BOXES.city;
    expect(cw).toBeGreaterThan(w);
    expect(ce).toBeLessThan(e);
    expect(cn).toBeLessThan(n);
    expect(cs).toBeGreaterThan(s);
  });

  it('orders each box west-north-east-south, as Nominatim wants it', () => {
    for (const [w, n, e, s] of Object.values(BOXES)) {
      expect(w).toBeLessThan(e);
      expect(n).toBeGreaterThan(s);
    }
  });
});
