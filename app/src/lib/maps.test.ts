import { describe, expect, it } from 'vitest';
import { appleMapsUrl, directionsUrl, fromRoom, isPlace } from './maps';

describe('fromRoom', () => {
  it('drops the room number, which no map service knows about', () => {
    expect(fromRoom('Alumni Hall 201')?.query).toBe(
      'Alumni Hall, Vanderbilt University, Nashville, TN',
    );
  });

  it('drops a lettered room too', () => {
    expect(fromRoom('Garland 162A')?.query).toBe('Garland, Vanderbilt University, Nashville, TN');
  });

  it('keeps a building that has no number', () => {
    expect(fromRoom('Garland')?.query).toBe('Garland, Vanderbilt University, Nashville, TN');
  });

  // This used to assert the opposite — that a search was always produced,
  // "whatever the syllabus said". That is the bug: a bare 205 is not a place,
  // and a confident search for one lands somewhere wrong.
  it('returns nothing for a room that names nowhere', () => {
    expect(fromRoom('205')).toBeNull();
    expect(fromRoom('Section 9:05')).toBeNull();
  });
});

describe('isPlace', () => {
  it('accepts buildings, however they are named', () => {
    for (const r of ['Garland', 'Alumni Hall 201', "The Wond'ry", 'E. Bronson Ingram', 'Buttrick 101']) {
      expect(isPlace(r), r).toBe(true);
    }
  });

  it('refuses a clock time left in the room field', () => {
    // The one from the sample semester, which offered directions to
    // "Section 9:05, Vanderbilt University".
    expect(isPlace('Section 9:05')).toBe(false);
    expect(isPlace('9:05a')).toBe(false);
    expect(isPlace('MWF 14:30')).toBe(false);
  });

  it('refuses a section number', () => {
    for (const r of ['Section 9', 'Sec. 03', 'Sect 2']) expect(isPlace(r), r).toBe(false);
  });

  it('refuses meeting days on their own', () => {
    for (const r of ['MWF', 'TR', 'tth', 'M']) expect(isPlace(r), r).toBe(false);
  });

  it('refuses a delivery mode', () => {
    for (const r of ['Online', 'Zoom', 'Remote', 'Asynchronous', 'Hybrid']) {
      expect(isPlace(r), r).toBe(false);
    }
  });

  it('refuses a room not yet decided', () => {
    for (const r of ['TBA', 'TBD', 'N/A', 'None', 'Unknown']) expect(isPlace(r), r).toBe(false);
  });

  it('refuses a bare number and an empty string', () => {
    expect(isPlace('205')).toBe(false);
    expect(isPlace('')).toBe(false);
    expect(isPlace('  ')).toBe(false);
  });
});

describe('directionsUrl', () => {
  it('routes to a coordinate when the app has one', () => {
    const url = new URL(directionsUrl({ query: 'ignored', lat: 36.1462, lon: -86.8025 }));
    expect(url.searchParams.get('destination')).toBe('36.1462,-86.8025');
  });

  it('falls back to the search text when it does not', () => {
    const url = new URL(directionsUrl({ query: 'Alumni Hall, Nashville' }));
    expect(url.searchParams.get('destination')).toBe('Alumni Hall, Nashville');
  });

  it('defaults to walking, which is what a campus is', () => {
    expect(new URL(directionsUrl({ query: 'x' })).searchParams.get('travelmode')).toBe('walking');
  });

  it('carries the mode that was asked for', () => {
    expect(new URL(directionsUrl({ query: 'x' }, 'transit')).searchParams.get('travelmode')).toBe(
      'transit',
    );
  });

  it('escapes a destination rather than breaking the address', () => {
    const url = directionsUrl({ query: 'Rand Hall & Commons, Nashville, TN' });
    expect(url).not.toContain(' ');
    expect(new URL(url).searchParams.get('destination')).toBe('Rand Hall & Commons, Nashville, TN');
  });
});

describe('appleMapsUrl', () => {
  it('maps the travel modes Apple has', () => {
    expect(new URL(appleMapsUrl({ query: 'x' }, 'driving')).searchParams.get('dirflg')).toBe('d');
    expect(new URL(appleMapsUrl({ query: 'x' }, 'transit')).searchParams.get('dirflg')).toBe('r');
    expect(new URL(appleMapsUrl({ query: 'x' }, 'walking')).searchParams.get('dirflg')).toBe('w');
  });

  it('sends a bike ride walking rather than silently driving it', () => {
    expect(new URL(appleMapsUrl({ query: 'x' }, 'bicycling')).searchParams.get('dirflg')).toBe('w');
  });
});
