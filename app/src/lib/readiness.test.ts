import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CEILING,
  connectionsFrom,
  relationshipOf,
  LEVELS,
  NO_CONNECTIONS,
  NO_RELATIONSHIP,
  RELATIONSHIPS,
  RELATIONSHIP_MEANS,
  atLeast,
  mayClaimConnection,
  mayClaimCustomer,
  readRelationship,
  readinessOf,
  type Connections,
  type Relationship,
} from './readiness';
import { NO_SCHOOL, readSchool, type School } from './school';

/**
 * A catalogue of universities is a claim about a hundred institutions.
 *
 * The specification calls this critical and is right to: holding Harvard's
 * public course catalogue is not a relationship with Harvard, and knowing the
 * address of Harvard's LMS is not an integration with it. Both are a string in
 * a data file. Both render identically unless something refuses.
 *
 * So these are not tests of a calculation. They are the refusals, and the one
 * that carries the weight is `no quantity of pack data reaches level 3` —
 * because a data pack is the thing this repository can acquire in bulk, and an
 * integration is the thing it cannot.
 */

/** A school with everything a pack can carry, and nothing a pack cannot. */
const RICH: School = {
  ...NO_SCHOOL,
  id: 'example',
  name: 'Example University',
  capabilities: {
    mealPlan: 'swipes',
    housing: true,
    campusMap: true,
    registrarName: 'Registrar',
    registrarUrl: 'https://registrar.example.edu',
    orgPortalName: 'Portal',
    orgPortalUrl: 'https://orgs.example.edu',
    lmsName: 'Brightspace',
    lmsUrl: 'https://lms.example.edu',
    lmsIcsHelpUrl: 'https://lms.example.edu/help',
    libraryUrl: 'https://library.example.edu',
    healthUrl: 'https://health.example.edu',
    advisingUrl: 'https://advising.example.edu',
    athleticsName: 'Examples',
  },
  data: {
    academicCalendar: [
      { termName: 'Fall 2026', startsOn: '2026-08-19', endsOn: '2026-12-11', deadlines: [] },
    ],
    buildings: [{ name: 'Main Hall', lat: 36, lng: -86 }],
  },
};

describe('the refusal that matters: a link is not a connection', () => {
  it('no quantity of pack data reaches level 3', () => {
    /*
     * The whole point of the module, in one assertion.
     *
     * `RICH` carries an LMS name, an LMS address, the LMS's own calendar-help
     * page, a registrar, an organisations portal, a library, a campus map and
     * a term with dates in it. Every one of those is something a university
     * publishes and a pack can contain. Level 3 is "sign-on, the LMS, calendar
     * and email" — systems talking to each other — and none of it is evidence
     * of that.
     *
     * If this ever goes green at 3, somebody has taught the derivation to read
     * a URL as an integration, and the catalogue has started lying.
     */
    const r = readinessOf(RICH, 'institutional-customer', NO_CONNECTIONS);
    expect(r.level).toBe(2);
    expect(mayClaimConnection(r)).toBe(false);
  });

  it('and says so, rather than just returning a smaller number', () => {
    // The number alone is not actionable. A data-health screen has to be able
    // to say why, or the level reads as a grade rather than a state.
    expect(readinessOf(RICH, 'institutional-customer').held).toMatch(/[Nn]othing is connected/);
  });

  it('while one real connection does reach it', () => {
    // The control for the assertion above. A test that only proves nothing
    // reaches 3 also passes on a function that returns 2 forever.
    const connected: Connections = { sso: true };
    expect(readinessOf(RICH, 'institutional-customer', connected).level).toBe(3);
    expect(readinessOf(RICH, 'institutional-customer', { sis: true }).level).toBe(4);
  });
});

describe('the paperwork caps the software, and says when it did', () => {
  it('a connected system on a university that agreed to nothing is still shown as public data', () => {
    /*
     * The case the derivation cannot catch on its own: somebody configures an
     * integration against an institution with no agreement. The software is
     * genuinely connected and the claim would still be wrong.
     */
    const r = readinessOf(RICH, 'public-data', { sso: true, lms: true });
    expect(r.level).toBe(2);
    expect(r.held).toMatch(/relationship/i);
    expect(r.held).toMatch(/level 3/);
  });

  it('and every relationship has a ceiling, weakest first', () => {
    const ceilings = RELATIONSHIPS.map((r) => CEILING[r]);
    // Monotonic: a stronger relationship never permits less.
    expect(ceilings).toEqual([...ceilings].sort((a, b) => a - b));
    expect(CEILING['public-data']).toBe(2);
    expect(CEILING['institutional-customer']).toBe(5);
  });

  it('and only a customer may be called one', () => {
    for (const r of RELATIONSHIPS) {
      expect(mayClaimCustomer(r)).toBe(r === 'institutional-customer');
    }
  });
});

describe('the default is the weakest thing it could be', () => {
  it('an unset relationship is public data, not a customer', () => {
    /*
     * The failure this prevents is a university added to a catalogue with a
     * field left blank reading as a customer — which nobody discovers by
     * testing, because the software works. They discover it when somebody at
     * that university asks why they are listed.
     */
    expect(NO_RELATIONSHIP).toBe('public-data');
    expect(readRelationship(undefined)).toBe('public-data');
    expect(readRelationship('institutional-customer ')).toBe('public-data');
    expect(readRelationship('CUSTOMER')).toBe('public-data');
    expect(readRelationship({ relationship: 'pilot' })).toBe('public-data');
  });

  it('and a real value still reads', () => {
    // The control: a reader that refuses everything passes the test above.
    for (const r of RELATIONSHIPS) expect(readRelationship(r)).toBe(r);
  });

  it('and an empty school is level 0 with nothing claimed', () => {
    const r = readinessOf(NO_SCHOOL);
    expect(r.level).toBe(0);
    expect(mayClaimConnection(r)).toBe(false);
  });
});

describe('what the levels are made of', () => {
  it('a school with campus and a registrar link but no calendar is level 1', () => {
    /*
     * The registrar's address is in `RICH`'s capabilities and stays there on
     * purpose. An earlier derivation let it satisfy the academic rung, which
     * made this school level 2 on the strength of one link — the small version
     * of the mistake the whole module exists to prevent. Dates are what level
     * 2 means, and this school has none.
     */
    const community: School = { ...RICH, data: { buildings: RICH.data.buildings } };
    expect(community.capabilities.registrarUrl, 'the fixture lost the link this pins').toBeTruthy();
    expect(readinessOf(community, 'pilot').level).toBe(1);
  });

  it('and dates without a campus around them are still level 1', () => {
    // Deliberate: the student came for the dates. Calling this 0 would hide a
    // working calendar behind a missing buildings list.
    const academic: School = {
      ...NO_SCHOOL,
      id: 'x',
      name: 'X',
      data: { academicCalendar: RICH.data.academicCalendar },
    };
    expect(readinessOf(academic, 'pilot').level).toBe(1);
  });

  it('and a school with no id is 0 however much data it carries', () => {
    expect(readinessOf({ ...RICH, id: '' }, 'pilot').level).toBe(0);
  });

  it('and the ladder is the six rungs the specification names', () => {
    expect(LEVELS.map((l) => l.level)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(LEVELS.map((l) => l.name)).toEqual([
      'Directory',
      'Community',
      'Academic',
      'Connected',
      'Institutional',
      'Full Semester',
    ]);
  });
});

describe('every relationship can be explained in a sentence', () => {
  it('each has one, and it is a sentence rather than a label', () => {
    for (const r of RELATIONSHIPS) {
      const says = RELATIONSHIP_MEANS[r].says;
      expect(says.length, `${r} has no explanation`).toBeGreaterThan(40);
      expect(says, `${r} does not end a sentence`).toMatch(/\.$/);
    }
  });

  it('and the weak ones say plainly that nothing is connected', () => {
    // The wording is the product here. "Public information" on its own is the
    // reassuring label this module exists to stop being shown alone.
    for (const r of ['public-data', 'available'] as Relationship[]) {
      expect(RELATIONSHIP_MEANS[r].says).toMatch(/nothing is connected/i);
    }
    expect(RELATIONSHIP_MEANS['public-data'].says).toMatch(/not a customer/i);
  });

  it('and atLeast orders them the way the list does', () => {
    expect(atLeast('pilot', 'public-data')).toBe(true);
    expect(atLeast('public-data', 'pilot')).toBe(false);
    expect(atLeast('pilot', 'pilot')).toBe(true);
  });
});

describe('the school this repository actually ships', () => {
  it('Vanderbilt tops out at 2, because nothing is connected to it', () => {
    /*
     * Not a hypothetical, and the reason this test reads the shipped file
     * rather than a fixture. `app/server/institution/`'s production adapter
     * registry is empty and `docs/UNIVERSITY_CONNECTIONS.md` says it stays
     * that way until a university writes an adapter and approves it for real
     * student records.
     *
     * So the honest answer for the best-supported school in the app is level
     * 2, and if this ever reads higher without that registry changing, the
     * derivation has started believing a data pack.
     */
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), 'src', 'data', 'schools', 'vanderbilt.json'), 'utf8'),
    );
    const vandy = readSchool(raw);
    expect(vandy.id, 'the shipped school did not parse').not.toBe('');
    const r = readinessOf(vandy, 'institutional-customer', NO_CONNECTIONS);
    expect(r.level).toBe(2);
    expect(mayClaimConnection(r)).toBe(false);
  });
});

describe('the gateway is what says a thing is connected', () => {
  it('only a connected state counts', () => {
    /*
     * `not-configured`, `error` and `disconnected` are each a reason the
     * integration is not working. A ladder that counted a broken one would be
     * at its least honest exactly when a student most needs it right.
     */
    expect(connectionsFrom([{ area: 'identity', state: 'connected' }])).toEqual({ sso: true });
    for (const state of ['not-configured', 'error', 'disconnected']) {
      expect(connectionsFrom([{ area: 'identity', state }]), state).toEqual({});
    }
  });

  it('and an absent or empty report is no connections, not an error', () => {
    expect(connectionsFrom(null)).toEqual({});
    expect(connectionsFrom(undefined)).toEqual({});
    expect(connectionsFrom([])).toEqual({});
  });

  it('and areas that are not what a level means raise nothing', () => {
    /*
     * Real connections that are simply not the definition of level 3 or 4. A
     * level is not a count of integrations, and mapping these would make it
     * one — a school with dining and athletics connected is not "Connected"
     * in the sense the ladder uses.
     */
    const live = ['dining', 'athletics', 'advising', 'billing', 'library'].map((area) => ({
      area,
      state: 'connected',
    }));
    expect(connectionsFrom(live)).toEqual({});
    expect(readinessOf(RICH, 'institutional-customer', connectionsFrom(live)).level).toBe(2);
  });

  it('and a real gateway report moves the level', () => {
    // The control. Everything above is a refusal, and refusals pass for free
    // on a function that returns {} unconditionally.
    const live = [
      { area: 'courses', state: 'connected' },
      { area: 'dining', state: 'connected' },
    ];
    expect(connectionsFrom(live)).toEqual({ lms: true });
    expect(readinessOf(RICH, 'pilot', connectionsFrom(live)).level).toBe(3);
  });

  it('and calendar stays unmapped rather than guessed', () => {
    // `UNIVERSITY_AREAS` has no calendar entry. Mapping `courses` to it would
    // be the small dishonesty the module exists to refuse, so the flag stays
    // false and this pins that it was a decision.
    expect(connectionsFrom([{ area: 'calendar', state: 'connected' }])).toEqual({});
  });
});

describe('the relationship registry', () => {
  it('Vanderbilt is not a customer, and neither is anybody else', () => {
    /*
     * The app was built around Vanderbilt and Vanderbilt has agreed to
     * nothing. If this ever reads otherwise without paperwork behind it, the
     * catalogue has started claiming a contract.
     */
    expect(relationshipOf('vanderbilt')).toBe('public-data');
    expect(relationshipOf('harvard')).toBe('public-data');
    expect(relationshipOf('')).toBe('public-data');
  });
});
