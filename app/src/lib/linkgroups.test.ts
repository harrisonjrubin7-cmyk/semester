import { describe, expect, it } from 'vitest';
import { BUILT_IN_GROUPS, OWN_GROUP, groupName, inGroup, linkGroups } from './linkgroups';
import { CAMPUS_LINKS } from '../data/campus';
import type { CampusLink } from './types';

/**
 * The headings, and the one they replaced.
 *
 * "Yours" used to be a fixed fifth heading holding everything anybody ever
 * added. These are mostly about what happens once a student names their own:
 * the app's four keep their order, the new ones follow in the order they were
 * named, and a name typed twice in two cases is one heading rather than two
 * that look identical on a phone.
 */

const added = (name: string, group?: string): CampusLink => ({
  id: name,
  name,
  url: `https://${name}.example.edu`,
  hint: '',
  note: '',
  ...(group === undefined ? {} : { group }),
});

/** As the screen prepares them: every added row carrying a resolved name. */
const resolved = (links: CampusLink[]) => links.map((l) => ({ ...l, group: groupName(l) }));

describe('what an added link is filed under', () => {
  it('is what the student called it', () => {
    expect(groupName(added('Landlord', 'Housing'))).toBe('Housing');
  });

  it('is "Yours" when they called it nothing, or nothing but spaces', () => {
    expect(groupName(added('Gym'))).toBe(OWN_GROUP);
    expect(groupName(added('Gym', ''))).toBe(OWN_GROUP);
    expect(groupName(added('Gym', '   '))).toBe(OWN_GROUP);
  });

  it('keeps the name as typed, without the space somebody leaned on', () => {
    expect(groupName(added('Gym', ' Sport '))).toBe('Sport');
  });
});

describe('the headings, in order', () => {
  it('is the app’s four when nothing has been added', () => {
    expect(linkGroups([])).toEqual([...BUILT_IN_GROUPS]);
  });

  /*
   * The whole change. One fixed "Yours" is a flat list of everything a person
   * ever added, which is the shape this screen was grouped to stop being.
   */
  it('adds a heading per name the student gave, after the app’s own', () => {
    const groups = linkGroups([added('Landlord', 'Housing'), added('Gym'), added('Coach', 'Sport')]);
    expect(groups).toEqual([...BUILT_IN_GROUPS, 'Housing', OWN_GROUP, 'Sport']);
  });

  it('is one heading for a name typed twice, keeping the first spelling', () => {
    const groups = linkGroups([added('A', 'Landlord'), added('B', 'landlord'), added('C', 'LANDLORD')]);
    expect(groups).toEqual([...BUILT_IN_GROUPS, 'Landlord']);
  });

  /*
   * Somebody typing "Tickets" wants their row under the Tickets heading, not
   * beside a second one spelled the same. It falls out of the fold rather than
   * being special-cased.
   */
  it('puts a name the app already uses under the app’s own heading', () => {
    expect(linkGroups([added('Season pass', 'tickets')])).toEqual([...BUILT_IN_GROUPS]);
  });
});

describe('which rows sit under a heading', () => {
  it('files a bundled row that names no group under Campus', () => {
    const under = inGroup(CAMPUS_LINKS, 'Campus');
    expect(under.length).toBeGreaterThan(0);
    expect(under.every((l) => !l.group)).toBe(true);
  });

  it('files the added rows under the names they were given', () => {
    const mine = resolved([added('Landlord', 'Housing'), added('Gym'), added('Coach', 'sport')]);
    expect(inGroup(mine, 'Housing').map((l) => l.name)).toEqual(['Landlord']);
    expect(inGroup(mine, OWN_GROUP).map((l) => l.name)).toEqual(['Gym']);
    expect(inGroup(mine, 'sport').map((l) => l.name)).toEqual(['Coach']);
  });

  it('draws every row exactly once across every heading it draws', () => {
    const mine = resolved([added('Landlord', 'Housing'), added('Gym'), added('Season pass', 'tickets')]);
    const all = [...CAMPUS_LINKS, ...mine];
    const drawn = linkGroups([added('Landlord', 'Housing'), added('Gym'), added('Season pass', 'tickets')]).flatMap(
      (g) => inGroup(all, g).map((l) => l.id),
    );
    expect(drawn.sort()).toEqual(all.map((l) => l.id).sort());
  });
});
