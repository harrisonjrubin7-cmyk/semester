import { describe, expect, it } from 'vitest';
import { appleMapsUrl, directionsUrl, fromRoom, placeUrl } from './maps';

describe('fromRoom', () => {
  it('drops the room number, which no map service knows about', () => {
    expect(fromRoom('Alumni Hall 201').query).toBe(
      'Alumni Hall, Vanderbilt University, Nashville, TN',
    );
  });

  it('drops a lettered room too', () => {
    expect(fromRoom('Garland 162A').query).toBe('Garland, Vanderbilt University, Nashville, TN');
  });

  it('keeps a building that has no number', () => {
    expect(fromRoom('Garland').query).toBe('Garland, Vanderbilt University, Nashville, TN');
  });

  it('never returns an empty search, whatever the syllabus said', () => {
    expect(fromRoom('205').query).toContain('205');
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

describe('placeUrl', () => {
  it('searches rather than routes', () => {
    const url = new URL(placeUrl({ query: 'Central Library' }));
    expect(url.pathname).toContain('search');
    expect(url.searchParams.get('query')).toBe('Central Library');
  });
});
