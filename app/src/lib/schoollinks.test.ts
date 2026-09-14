import { describe, expect, it } from 'vitest';
import { sameAddress, schoolLinks } from './schoollinks';
import { NO_SCHOOL, type School } from './school';
import { CAMPUS_LINKS } from '../data/campus';
import { BUNDLED } from '../data/schools';
import type { CampusLink } from './types';

const school = (caps: Partial<School['capabilities']>): School => ({
  ...NO_SCHOOL,
  id: 'x',
  name: 'Example',
  capabilities: { ...NO_SCHOOL.capabilities, ...caps },
});

describe('sameAddress', () => {
  it('treats protocol, www, case and a trailing slash as noise', () => {
    const one = sameAddress('https://www.Library.Example.edu/');
    expect(one).toBe(sameAddress('http://library.example.edu'));
    expect(one).toBe(sameAddress('  library.example.edu/  '));
  });

  it('keeps the path, because two pages on one host are two places', () => {
    expect(sameAddress('https://example.edu/dining')).not.toBe(
      sameAddress('https://example.edu/dining/meal-plans'),
    );
  });
});

describe('schoolLinks', () => {
  it('is empty for a student who has not said where they study', () => {
    expect(schoolLinks(NO_SCHOOL)).toEqual([]);
  });

  it('skips a field the school left blank rather than drawing an empty row', () => {
    const rows = schoolLinks(school({ libraryUrl: 'https://library.example.edu', healthUrl: '' }));
    expect(rows.map((r) => r.id)).toEqual(['school-library']);
  });

  it("uses the school's own name for a service, and a plain word when it has none", () => {
    const rows = schoolLinks(
      school({
        registrarName: 'YES',
        registrarUrl: 'https://yes.example.edu',
        libraryUrl: 'https://library.example.edu',
      }),
    );
    expect(rows.find((r) => r.id === 'school-registrar')?.name).toBe('YES');
    expect(rows.find((r) => r.id === 'school-library')?.name).toBe('Library');
  });

  it('drops an address the screen is already drawing, however it is spelled', () => {
    const taken: CampusLink[] = [
      { id: 'lms', name: 'Brightspace', url: 'https://brightspace.example.edu/', hint: '', note: '' },
    ];
    const caps = { lmsUrl: 'https://www.brightspace.example.edu', libraryUrl: 'https://library.example.edu' };
    expect(schoolLinks(school(caps), taken).map((r) => r.id)).toEqual(['school-library']);
  });

  it('ignores a taken row with no address, so an empty myVU suppresses nothing', () => {
    const taken: CampusLink[] = [{ id: 'myvu', name: 'myVU', url: '', hint: '', note: '' }];
    expect(schoolLinks(school({ libraryUrl: 'https://library.example.edu' }), taken)).toHaveLength(1);
  });

  it('every row it generates is editable by id and carries a note', () => {
    const rows = schoolLinks(school({ advisingUrl: 'https://advising.example.edu' }));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toMatch(/^school-/);
    expect(rows[0].note).not.toBe('');
    expect(rows[0].group).toBe('Campus');
  });

  it('leaves Vanderbilt the two addresses its bundled rows do not already have', () => {
    // The point of the dedupe, on the one profile that ships: YES, Brightspace,
    // AnchorLink and the libraries are all in CAMPUS_LINKS already.
    const rows = schoolLinks(BUNDLED.vanderbilt, CAMPUS_LINKS);
    expect(rows.map((r) => r.id).sort()).toEqual(['school-advising', 'school-health']);
  });
});
