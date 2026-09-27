import { describe, expect, it } from 'vitest';
import { DIRECTORY_COPY, directoryTemplate, parseDirectory, upcomingEvents, validWhen, whenLine, type CampusListing } from './campusdirectory';
import { readStoredDirectory } from './portal-storage';

const file = (items: object[]) => JSON.stringify({ institution: 'Test School', items });
const ev = (id: string, starts: string, extra = {}) => ({ id, name: `Event ${id}`, starts, ...extra });

describe('departments and events directories', () => {
  it('ships a template for each, marked as an example to replace', () => {
    for (const kind of ['departments', 'events'] as const) {
      const t = directoryTemplate(kind);
      expect(t.institution).toContain('Example University — replace');
      expect(t.items[0].name).toContain('— replace this entry');
      expect(parseDirectory(JSON.stringify(t), kind).items).toHaveLength(1);
    }
  });

  it('gives every kind its own words, rather than falling back to clubs', () => {
    const blurbs = Object.values(DIRECTORY_COPY).map((c) => c.blurb);
    expect(new Set(blurbs).size).toBe(blurbs.length);
    expect(DIRECTORY_COPY.departments.label).toBe('departments & offices');
  });
});

describe('event dates', () => {
  it('accepts a date, or a date and a time, and only real ones', () => {
    expect(validWhen('2026-10-08')).toBe(true);
    expect(validWhen('2026-10-08T18:30')).toBe(true);
    for (const bad of ['2026-02-31', '2026-10-08T24:00', '8 Oct', '2026-10-08T18:30:00Z']) expect(validWhen(bad), bad).toBe(false);
  });

  it('refuses an event with no start, or an end before its start', () => {
    expect(() => parseDirectory(file([{ id: 'a', name: 'Fair' }]), 'events')).toThrow(/needs a start date/);
    expect(() => parseDirectory(file([ev('a', '2026-10-08', { ends: '2026-10-07' })]), 'events')).toThrow(/on or after the start/);
    // Other kinds do not need one.
    expect(parseDirectory(file([{ id: 'a', name: 'Registrar' }]), 'departments').items[0].starts).toBeUndefined();
  });

  it('keeps the dates through storage', () => {
    const d = parseDirectory(file([ev('a', '2026-10-08T18:30', { ends: '2026-10-08T20:00' })]), 'events');
    expect(readStoredDirectory(JSON.parse(JSON.stringify(d)))?.items[0]).toMatchObject({ starts: '2026-10-08T18:30', ends: '2026-10-08T20:00' });
  });

  it('lists upcoming events in date order and sets finished ones aside', () => {
    const items = parseDirectory(file([ev('late', '2026-11-02'), ev('gone', '2026-09-01'), ev('soon', '2026-10-08T18:30'), ev('multi', '2026-09-20', { ends: '2026-10-01' })]), 'events').items;
    const { upcoming, past } = upcomingEvents(items, '2026-09-27');
    expect(upcoming.map((i) => i.id)).toEqual(['multi', 'soon', 'late']);
    expect(past.map((i) => i.id)).toEqual(['gone']);
  });

  it('writes the time as given, inventing no time zone', () => {
    const i = { starts: '2026-10-08T18:30', ends: '2026-10-08T20:00' } as CampusListing;
    expect(whenLine(i)).toBe('Thu, Oct 8, 18:30 – 20:00');
    expect(whenLine({ starts: '2026-10-08', ends: '2026-10-10' } as CampusListing)).toBe('Thu, Oct 8 – Sat, Oct 10');
    expect(whenLine({ starts: '2026-10-08' } as CampusListing)).toBe('Thu, Oct 8');
  });
});
