import { describe, expect, it } from 'vitest';
import {
  MOST,
  NEARBY,
  OFF,
  SPACING,
  nothingLine,
  onEarth,
  read,
  readNominatim,
  readPhoton,
  readSettings,
  reverseUrl,
  searchUrl,
  shortName,
  waitFor,
  whatIsSent,
} from './geocode';

const NEAR = { lat: 36.1447, lon: -86.8027, span: NEARBY };

describe('the request it builds', () => {
  it('asks Nominatim in the form its API takes', () => {
    const u = new URL(searchUrl('nominatim', '2201 West End Ave'));
    expect(u.host).toBe('nominatim.openstreetmap.org');
    expect(u.searchParams.get('q')).toBe('2201 West End Ave');
    expect(u.searchParams.get('format')).toBe('jsonv2');
    expect(u.searchParams.get('limit')).toBe(String(MOST));
  });

  it('asks Photon in its own form', () => {
    const u = new URL(searchUrl('photon', 'Alumni Hall'));
    expect(u.host).toBe('photon.komoot.io');
    expect(u.searchParams.get('q')).toBe('Alumni Hall');
  });

  it('prefers results near a place you saved, without demanding them', () => {
    // "Alumni Hall" finds a dozen in five countries; a student looking up a
    // home address two states away should still find it.
    const u = new URL(searchUrl('nominatim', 'Alumni Hall', NEAR));
    const [left, top, right, bottom] = (u.searchParams.get('viewbox') ?? '').split(',').map(Number);
    expect(left).toBeLessThan(right);
    expect(bottom).toBeLessThan(top);
    expect(u.searchParams.get('bounded')).toBe('0');
  });

  it('passes a bias to Photon as a point, which is what it takes', () => {
    const u = new URL(searchUrl('photon', 'Alumni Hall', NEAR));
    expect(Number(u.searchParams.get('lat'))).toBeCloseTo(36.1447, 4);
    expect(Number(u.searchParams.get('lon'))).toBeCloseTo(-86.8027, 4);
  });

  it('builds a reverse lookup for either service', () => {
    expect(new URL(reverseUrl('nominatim', 36.1, -86.8)).pathname).toBe('/reverse');
    expect(new URL(reverseUrl('photon', 36.1, -86.8)).host).toBe('photon.komoot.io');
  });

  it('goes nowhere but OpenStreetMap-backed services', () => {
    for (const url of [
      searchUrl('nominatim', 'x'),
      searchUrl('photon', 'x'),
      reverseUrl('nominatim', 1, 2),
      reverseUrl('photon', 1, 2),
    ]) {
      expect(new URL(url).protocol).toBe('https:');
      expect(['nominatim.openstreetmap.org', 'photon.komoot.io']).toContain(new URL(url).host);
    }
  });
});

describe('reading what came back', () => {
  const nominatim = [
    {
      lat: '36.1461',
      lon: '-86.8035',
      name: 'Alumni Hall',
      display_name: 'Alumni Hall, 2205 West End Avenue, Nashville, Davidson County, Tennessee, 37235, United States',
    },
  ];

  it('reads Nominatim, keeping a short name and the full address', () => {
    const [f] = readNominatim(nominatim);
    expect(f.name).toBe('Alumni Hall');
    expect(f.lat).toBeCloseTo(36.1461, 4);
    expect(f.lon).toBeCloseTo(-86.8035, 4);
    expect(f.label).toContain('Nashville');
    expect(f.from).toBe('nominatim');
  });

  it('reads Photon’s coordinates the right way round', () => {
    // GeoJSON is [lon, lat]. The wrong way round puts Nashville in the Indian
    // Ocean, which is exactly the silent wrongness a parse test is for.
    const [f] = readPhoton({
      features: [
        {
          geometry: { coordinates: [-86.8035, 36.1461] },
          properties: { name: 'Alumni Hall', city: 'Nashville', state: 'Tennessee' },
        },
      ],
    });
    expect(f.lat).toBeCloseTo(36.1461, 4);
    expect(f.lon).toBeCloseTo(-86.8035, 4);
    expect(f.label).toBe('Alumni Hall, Nashville, Tennessee');
  });

  it('drops a row it cannot read rather than placing it at zero', () => {
    expect(readNominatim([{ lat: 'x', lon: 'y', display_name: 'Somewhere' }])).toEqual([]);
    expect(readNominatim([{ lat: '1', lon: '2' }])).toEqual([]);
    expect(readPhoton({ features: [{ geometry: {}, properties: { name: 'X' } }] })).toEqual([]);
  });

  it('refuses a coordinate that is not on Earth', () => {
    expect(onEarth(91, 0)).toBe(false);
    expect(onEarth(0, 181)).toBe(false);
    expect(onEarth(36.1, -86.8)).toBe(true);
    expect(readNominatim([{ lat: '99', lon: '0', display_name: 'Nowhere' }])).toEqual([]);
  });

  it('takes rubbish as nothing', () => {
    expect(readNominatim(null)).toEqual([]);
    expect(readPhoton(null)).toEqual([]);
    expect(readPhoton({ features: 'no' })).toEqual([]);
    expect(read('photon', {})).toEqual([]);
  });

  it('takes a single reverse result as well as a list', () => {
    expect(readNominatim({ lat: '36.1', lon: '-86.8', display_name: 'A place, Nashville' })).toHaveLength(1);
  });

  it('shortens a long address to something that fits on a pin', () => {
    expect(shortName('Alumni Hall, 2205 West End Avenue, Nashville')).toBe('Alumni Hall');
    expect(shortName('  Just one thing ')).toBe('Just one thing');
  });
});

describe('the spacing the usage policy asks for', () => {
  it('holds requests a second apart', () => {
    expect(SPACING).toBeGreaterThanOrEqual(1000);
    expect(waitFor(1000, 1000)).toBe(SPACING);
    expect(waitFor(1000, 1000 + SPACING)).toBe(0);
    expect(waitFor(1000, 1600)).toBe(SPACING - 600);
  });

  it('lets the first request through', () => {
    expect(waitFor(0, 5_000_000)).toBe(0);
  });
});

describe('what it says when there is nothing', () => {
  it('is a sentence, never a fallback pin', () => {
    // A pin dropped in the wrong place is worse than no pin, because a pin is
    // believed.
    const said = nothingLine('Alumni Hall');
    expect(said).toContain('Nothing found');
    expect(said).toContain('Alumni Hall');
  });

  it('asks for something when nothing was typed', () => {
    expect(nothingLine('  ')).toBe('Type an address or a building name.');
  });
});

describe('the switch, and what it admits to', () => {
  it('is off, and sends nothing, until it is turned on', () => {
    expect(OFF.on).toBe(false);
    expect(OFF.reverseOn).toBe(false);
    expect(readSettings(undefined)).toEqual(OFF);
    expect(readSettings({ on: false, reverseOn: true }).reverseOn).toBe(false);
  });

  it('will not let reverse be on while the whole thing is off', () => {
    // Two switches that can disagree is a way for somebody to believe they
    // turned it off.
    expect(readSettings({ on: false, reverseOn: true, service: 'photon' })).toEqual({
      on: false,
      reverseOn: false,
      service: 'photon',
    });
  });

  it('falls back to a service it knows', () => {
    expect(readSettings({ on: true, service: 'google' }).service).toBe('nominatim');
  });

  it('names who receives what, and distinguishes the two directions', () => {
    const forward = whatIsSent('nominatim', false);
    const reverse = whatIsSent('nominatim', true);
    expect(forward).toContain('text you type');
    expect(reverse).toContain('Your position');
    expect(forward).toContain('OpenStreetMap Foundation');
    expect(reverse).not.toBe(forward);
  });
});
