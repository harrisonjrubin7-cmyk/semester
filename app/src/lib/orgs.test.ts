import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CAPABILITIES,
  CAPABILITY_MEANS,
  STANDINGS,
  SELF_DECLARED,
  can,
  inside,
  readMember,
  slugFor,
  type Member,
  type Standing,
} from './orgs';

/**
 * The parts of `orgs.ts` that decide anything, which are the two vocabularies
 * and the three pure functions.
 *
 * Everything else is a round trip, and the rules those round trips are subject
 * to are proved in `supabase/organizations.check.sql` by attempting them as the
 * account that should be refused. A mock here would assert that the mock was
 * written the way the code was — and, worse, would assert it about the half of
 * the system that is not where the decision is made.
 */

const SQL = (name: string) =>
  readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), 'utf8');

const ORGANIZATIONS = SQL('20260921230000_organizations.sql');

const asMember = (over: Partial<Member> = {}): Member => ({
  orgId: 'o',
  userId: 'u',
  standing: 'MEMBER',
  capabilities: [],
  since: '',
  ...over,
});

describe('the vocabularies, against the constraints that hold them', () => {
  /*
   * A copy of a closed vocabulary is worth what the check that it is still the
   * same vocabulary is worth. Both of these are read out of the migration
   * rather than repeated here, so widening the column fails in this file rather
   * than in a screen that draws nothing for a value it has never heard of.
   */
  it('lists exactly the standings the column allows', () => {
    const declared = /standing text not null check \(standing in \(([^)]*)\)\)/s.exec(ORGANIZATIONS);
    expect(declared, 'the standing check constraint has moved').not.toBeNull();
    const inSql = [...declared![1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
    expect([...STANDINGS].sort()).toEqual(inSql.sort());
  });

  it('lists exactly the capabilities the column allows', () => {
    const declared = /capabilities <@ array\[([^\]]*)\]/s.exec(ORGANIZATIONS);
    expect(declared, 'the capability containment check has moved').not.toBeNull();
    const inSql = [...declared![1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
    expect([...CAPABILITIES].sort()).toEqual(inSql.sort());
  });

  /*
   * Not a style rule. A capability with no sentence is a checkbox on the
   * officer screen with nothing beside it saying what ticking it hands over,
   * which is the one screen in this feature where that matters most.
   */
  it('says what each capability means, in words rather than in its name', () => {
    for (const cap of CAPABILITIES) {
      expect(CAPABILITY_MEANS[cap], cap).toBeTruthy();
      expect(CAPABILITY_MEANS[cap].length, cap).toBeGreaterThan(15);
    }
  });

  /*
   * The two a person says about themselves, which `set_member_standing`
   * refuses to let an organization set. If this list and that refusal drifted,
   * a screen would offer an officer a button the server always says no to.
   */
  it('keeps the self-declared two out of what an organization may set', () => {
    const settable = /want not in \(([^)]*)\)/s.exec(ORGANIZATIONS);
    expect(settable, 'the settable-standing list has moved').not.toBeNull();
    const byTheOrg = [...settable![1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
    for (const own of SELF_DECLARED) {
      expect(byTheOrg, own).not.toContain(own);
    }
    // The control: the split is only meaningful if the other six are settable.
    expect(byTheOrg.sort()).toEqual(
      STANDINGS.filter((s) => !SELF_DECLARED.includes(s))
        .map(String)
        .sort(),
    );
  });
});

describe('what a screen is allowed to draw', () => {
  it('reads a capability that is held', () => {
    expect(can(asMember({ capabilities: ['EVENTS'] }), 'EVENTS')).toBe(true);
  });

  it('does not read one that is not', () => {
    expect(can(asMember({ capabilities: ['EVENTS'] }), 'TREASURY')).toBe(false);
    expect(can(asMember(), 'EVENTS')).toBe(false);
    expect(can(null, 'EVENTS')).toBe(false);
  });

  /*
   * The one implication, and it has to be the only one. `ADMIN` answering for
   * everything is what item 257's dashboard needs; anything else answering for
   * anything else would be the ladder the set model exists to refuse.
   */
  it('lets ADMIN answer for every capability, and nothing else answer for any', () => {
    const admin = asMember({ capabilities: ['ADMIN'] });
    for (const cap of CAPABILITIES) expect(can(admin, cap), cap).toBe(true);

    for (const held of CAPABILITIES.filter((c) => c !== 'ADMIN')) {
      const officer = asMember({ capabilities: [held] });
      for (const cap of CAPABILITIES) {
        expect(can(officer, cap), `${held} answering for ${cap}`).toBe(cap === held);
      }
    }
  });

  /*
   * The standing test, which looks redundant beside a table constraint that
   * refuses the row. It is the same argument `private.org_can()` makes for
   * checking it too: the constraint stops the row existing, and this stops a
   * row that somehow exists from being obeyed. A stale read held across a
   * removal is exactly how one exists.
   */
  it('obeys nobody who is not a member, whatever their row says', () => {
    for (const standing of STANDINGS.filter((s) => s !== 'MEMBER')) {
      const stale = asMember({ standing: standing as Standing, capabilities: ['ADMIN'] });
      expect(can(stale, 'TREASURY'), standing).toBe(false);
    }
  });

  it('counts a member and an alumnus as inside, and the other six as not', () => {
    for (const standing of STANDINGS) {
      expect(inside(asMember({ standing })), standing).toBe(
        standing === 'MEMBER' || standing === 'ALUMNI_MEMBER',
      );
    }
    expect(inside(null)).toBe(false);
  });

  /*
   * A capability this build has never heard of is one it cannot draw a panel
   * for. Reading it as held would put a heading on a screen with nothing under
   * it and every button behind it refused.
   *
   * Asserted against `readMember`, which is where the filter is, rather than
   * against a `Member` built by hand: the first version of this test made the
   * object directly and passed with the filter deleted, because `can()` was
   * answering about a capability it does not recognise either way.
   */
  it('drops a capability from a newer server than this build, and keeps the rest', () => {
    const row = readMember({
      org_id: 'o',
      user_id: 'u',
      standing: 'MEMBER',
      capabilities: ['PRESIDENT', 'EVENTS'],
      since: '',
    });
    expect(row.capabilities).toEqual(['EVENTS']);
    expect(can(row, 'EVENTS')).toBe(true);
    expect(can(row, 'ADMIN')).toBe(false);
  });
});

describe('the slug a name suggests', () => {
  /*
   * Held against the column's own pattern rather than a copy of it: a
   * suggestion the server would refuse is a form that fails on submit, after
   * somebody has typed everything else.
   */
  const pattern = (() => {
    const declared = /slug +text not null check \(slug ~ '([^']+)'\)/.exec(ORGANIZATIONS);
    expect(declared, 'the slug check constraint has moved').not.toBeNull();
    return new RegExp(declared![1]);
  })();

  it('suggests something the column will take', () => {
    for (const name of [
      'Chess Club',
      'Vanderbilt Consulting Group',
      'Société Française',
      '  Rowing  ',
      'A Cappella!!',
      'Students for the Exploration and Development of Space and Other Places',
    ]) {
      const slug = slugFor(name);
      expect(slug, name).not.toBe('');
      expect(pattern.test(slug), `${name} → ${slug}`).toBe(true);
    }
  });

  it('reads the names it is given', () => {
    expect(slugFor('Chess Club')).toBe('chess-club');
    expect(slugFor('Société Française')).toBe('societe-francaise');
  });

  /*
   * A truncation at forty can land on a hyphen, which the pattern allows at
   * the end and which looks like a mistake. This is the case that found it.
   */
  it('does not leave a hyphen hanging off a truncated name', () => {
    /*
     * The name matters and the first one chosen did not. A truncation only
     * lands on a hyphen when the fortieth character is one, and
     * "Students for the Exploration and Development of Space" cuts at
     * "…and-develop" — so that case passed with the trailing-hyphen strip
     * deleted. This name's slug is `alpha-beta-…-eta-` at exactly forty.
     */
    const long = slugFor('Alpha Beta Gamma Delta Epsilon Zeta Eta Theta');
    expect(long).toBe('alpha-beta-gamma-delta-epsilon-zeta-eta');
    expect(long.length).toBeLessThanOrEqual(40);
  });

  /*
   * Empty rather than something the server refuses. A form that asks is a
   * better answer than one that submits and comes back with a constraint.
   */
  it('gives nothing back when there is nothing it can make', () => {
    for (const hopeless of ['', '   ', '!!!', '日本語', 'x']) {
      expect(slugFor(hopeless), hopeless).toBe('');
    }
  });
});
