import { describe, expect, it } from 'vitest';
import { finite, isoDay, obj, textValue } from './device-library';
import { ATHLETICS_LIMITS, absenceDraft, eventDays, overlaps, readAthletics, type AthleticEvent } from './athletics';
import { EMPTY_FAMILY, familyPlanActive, familyPreview, readFamily, type FamilyLibrary } from './family';
import { EMPTY_CAREER, readCareer, readOpportunities } from './career';
import { EMPTY_PATHWAY, netProgramCost, newProgram, programReadiness, readPathway, readPrograms } from './pathway';
import { allowsFamilyRequest, type FamilyGrant, type FamilyRequest } from '@semester/institution';

/**
 * The four workspaces that are not this term, at their edges.
 *
 * Each keeps its work in `localStorage` with no server copy, which changes
 * what these tests are for. There is nothing to restore from, so a reader
 * that is lenient in the wrong place does not cause a sync bug — it causes a
 * student to lose a term of application notes. Every one of these is about a
 * bound, a refusal, or a claim the app must not make.
 */

/* ── The shared validators ──────────────────────────────────────────────── */

describe('the checks every library is built out of', () => {
  it('knows an object from the things that look like one', () => {
    expect(obj({})).toBe(true);
    for (const bad of [null, undefined, [], 'x', 3]) expect(obj(bad)).toBe(false);
  });

  it('holds a string to its length, and lets empty through', () => {
    expect(textValue('', 5)).toBe(true);
    expect(textValue('abcde', 5)).toBe(true);
    expect(textValue('abcdef', 5)).toBe(false);
    expect(textValue(5, 5)).toBe(false);
  });

  it('refuses the numbers that are not numbers', () => {
    expect(finite(3, 0, 10)).toBe(true);
    for (const bad of [Number.NaN, Infinity, -Infinity, '3', null]) expect(finite(bad, 0, 10)).toBe(false);
    expect(finite(11, 0, 10)).toBe(false);
    expect(finite(-1, 0, 10)).toBe(false);
  });

  /*
   * The round-trip is the whole point of `isoDay`, and the case that proves
   * it is a date that matches the pattern, parses, and is not real.
   */
  it('refuses a day that is not the day it says it is', () => {
    expect(isoDay('2026-02-28')).toBe(true);
    expect(isoDay('')).toBe(true);
    expect(isoDay('2026-02-31'), 'February has no 31st').toBe(false);
    expect(isoDay('2026-13-01')).toBe(false);
    expect(isoDay('26-01-01')).toBe(false);
    expect(isoDay('next tuesday')).toBe(false);
  });
});

/* ── Athletics ──────────────────────────────────────────────────────────── */

const event = (over: Partial<AthleticEvent> = {}): AthleticEvent => ({
  id: 'a',
  title: 'Away meet',
  team: 'Swim',
  kind: 'Travel',
  start: '2026-10-01T16:00',
  end: '2026-10-04T20:00',
  where: 'Athens, GA',
  notes: '',
  steps: [],
  ...over,
});

describe('an athletics library', () => {
  const read = (events: unknown[]) => readAthletics({ version: 1, events });

  it('reads an event a screen would save', () => {
    expect(read([event()]).events[0].title).toBe('Away meet');
  });

  /*
   * The two time rules, which exist because `eventDays` walks a loop over
   * them. An end at or before the start would never terminate.
   */
  it('refuses an event that ends when or before it starts', () => {
    expect(() => read([event({ end: '2026-10-01T16:00' })])).toThrow();
    expect(() => read([event({ end: '2026-09-30T16:00' })])).toThrow();
  });

  it('refuses an event longer than a month', () => {
    expect(() => read([event({ start: '2026-01-01T00:00', end: '2026-03-01T00:00' })])).toThrow(/31/);
  });

  it('refuses two events sharing an id, and a bad shape', () => {
    expect(() => read([event(), event()])).toThrow();
    expect(() => read([event({ kind: 'Brunch' as AthleticEvent['kind'] })])).toThrow();
    expect(() => read([event({ start: '2026-10-01' })]), 'a day is not a minute').toThrow();
    expect(() => read([event({ title: '   ' })])).toThrow();
  });

  it('holds its caps', () => {
    expect(() => read(Array.from({ length: ATHLETICS_LIMITS.events + 1 }, (_, i) => event({ id: `e${i}` })))).toThrow();
    expect(() => read([event({ notes: 'x'.repeat(ATHLETICS_LIMITS.notes + 1) })])).toThrow();
  });

  /*
   * Four days, not three. A trip leaving Thursday afternoon and returning
   * Sunday evening costs four days of classes, and a planner that counted the
   * span in milliseconds would report three.
   */
  it('counts every day a trip touches, including the one it leaves on', () => {
    expect(eventDays(event())).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  });

  it('counts a single afternoon as one day', () => {
    expect(eventDays(event({ start: '2026-10-01T16:00', end: '2026-10-01T18:00' }))).toEqual(['2026-10-01']);
  });

  it('treats touching events as not overlapping', () => {
    const a = { start: '2026-10-01T10:00', end: '2026-10-01T12:00' };
    expect(overlaps(a, { start: '2026-10-01T12:00', end: '2026-10-01T14:00' })).toBe(false);
    expect(overlaps(a, { start: '2026-10-01T11:59', end: '2026-10-01T14:00' })).toBe(true);
  });

  /*
   * The letter goes to somebody who can hold a grade. It must not read as
   * though an authority produced it, and it must ask rather than instruct.
   */
  it('never lets the absence letter claim to be an authorization', () => {
    const text = absenceDraft(event(), ['2026-10-02 · ECON 1020 · 9:05a']);
    expect(text).toMatch(/not an official travel authorization/i);
    expect(text).toContain('2026-10-02 · ECON 1020 · 9:05a');
    expect(text).toMatch(/could we discuss/i);
    expect(text).not.toMatch(/\b(is approved|has been approved|you are excused)\b/i);
  });

  it('says it will confirm, when there is nothing recorded to list', () => {
    expect(absenceDraft(event(), [])).toMatch(/I will confirm any affected classes/i);
  });
});

/* ── Family ─────────────────────────────────────────────────────────────── */

const member = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  name: 'A parent',
  email: '',
  relationship: 'Parent',
  expires: '',
  revoked: false,
  permissions: {
    finances: 'view',
    aid: 'none',
    housing: 'none',
    calendar: 'none',
    academic: 'none',
    emergency: 'none',
    travel: 'none',
    'health-admin': 'none',
    career: 'none',
    communication: 'none',
  },
  ...over,
});

const item = (over: Record<string, unknown> = {}) => ({
  id: 'i1',
  memberId: 'm1',
  category: 'finances',
  title: 'The bill',
  body: 'Due in October',
  due: '',
  kind: 'information',
  done: false,
  amount: 0,
  ...over,
});

describe('a family library', () => {
  /*
   * Overrides are `unknown`, deliberately. These fixtures are input to a
   * validator, and typing them as `FamilyLibrary` would mean the compiler
   * refusing exactly the malformed values these tests exist to hand it.
   */
  const read = (over: Record<string, unknown> = {}) =>
    readFamily({ version: 1, members: [member()], items: [item()], history: [], ...over });

  it('reads a plan a screen would save', () => {
    expect(read().members[0].name).toBe('A parent');
  });

  /*
   * The single most important refusal in this file. An extra key on a
   * permissions object is the shape of a smuggled grant, so the reader
   * rebuilds the object from the ten known categories rather than passing it
   * through.
   */
  it('drops a permission category it does not know', () => {
    const sneaky = member({ permissions: { ...member().permissions, everything: 'view' } });
    const out = readFamily({ version: 1, members: [sneaky], items: [], history: [] });
    expect(Object.keys(out.members[0].permissions)).toHaveLength(10);
    expect(out.members[0].permissions).not.toHaveProperty('everything');
  });

  it('allows payment only on finances', () => {
    expect(() =>
      readFamily({
        version: 1,
        members: [member({ permissions: { ...member().permissions, academic: 'payment' } })],
        items: [],
        history: [],
      }),
    ).toThrow(/permission/i);
    // And on finances it is fine.
    expect(() =>
      readFamily({
        version: 1,
        members: [member({ permissions: { ...member().permissions, finances: 'payment' } })],
        items: [],
        history: [],
      }),
    ).not.toThrow();
  });

  it('refuses an item belonging to nobody', () => {
    expect(() => read({ items: [item({ memberId: 'ghost' })] })).toThrow();
  });

  it('refuses a malformed email but allows none at all', () => {
    expect(() => readFamily({ version: 1, members: [member({ email: 'not-an-email' })], items: [], history: [] })).toThrow();
    expect(() => readFamily({ version: 1, members: [member({ email: '' })], items: [], history: [] })).not.toThrow();
  });

  it('refuses a nameless member and a negative amount', () => {
    expect(() => read({ members: [member({ name: '  ' })] })).toThrow();
    expect(() => read({ items: [item({ amount: -5 })] })).toThrow();
  });

  /* ── What the preview actually shows ── */

  const library = (over: Record<string, unknown> = {}): FamilyLibrary =>
    readFamily({ version: 1, members: [member()], items: [item()], history: [], ...over });

  it('shows an item its category is permitted for', () => {
    expect(familyPreview(library(), 'm1')).toHaveLength(1);
  });

  it('hides everything once the plan is removed', () => {
    expect(familyPreview(library({ members: [member({ revoked: true })] }), 'm1')).toEqual([]);
  });

  it('hides everything once the plan has expired', () => {
    const expiring = library({ members: [member({ expires: '2026-09-30' })] });
    expect(familyPreview(expiring, 'm1', '2026-09-30'), 'live on its last day').toHaveLength(1);
    expect(familyPreview(expiring, 'm1', '2026-10-01'), 'gone the next').toEqual([]);
    expect(familyPlanActive(expiring.members[0], '2026-10-01')).toBe(false);
  });

  /*
   * Payment access discloses nothing, and this is where a student would find
   * that out. A payer who could read the statement is the exact failure the
   * four access levels exist to prevent.
   */
  it('shows a payer nothing at all', () => {
    const payer = library({ members: [member({ permissions: { ...member().permissions, finances: 'payment' } })] });
    expect(familyPreview(payer, 'm1')).toEqual([]);
  });

  it('shows nothing for somebody who is not in the library', () => {
    expect(familyPreview(EMPTY_FAMILY, 'nobody')).toEqual([]);
  });
});

/* ── The server-side grant rule ─────────────────────────────────────────── */

describe('the rule a real family grant would be checked against', () => {
  const NOW = 1_700_000_000_000;
  const grant = (over: Partial<FamilyGrant> = {}): FamilyGrant => ({
    id: 'g1',
    institutionId: 'vandy',
    studentId: 's1',
    recipientId: 'r1',
    category: 'finances',
    access: 'view',
    resourceIds: ['bill-1'],
    acceptedAt: NOW - 1000,
    expiresAt: NOW + 100_000,
    revokedAt: null,
    ...over,
  });
  const ask = (over: Partial<FamilyRequest> = {}): FamilyRequest => ({
    institutionId: 'vandy',
    studentId: 's1',
    recipientId: 'r1',
    category: 'finances',
    resourceId: 'bill-1',
    operation: 'read',
    ...over,
  });

  it('allows the request it was granted for', () => {
    expect(allowsFamilyRequest(grant(), ask(), NOW)).toBe(true);
  });

  it('refuses a grant nobody accepted, or accepted in the future', () => {
    expect(allowsFamilyRequest(grant({ acceptedAt: null }), ask(), NOW)).toBe(false);
    expect(allowsFamilyRequest(grant({ acceptedAt: NOW + 5000 }), ask(), NOW)).toBe(false);
  });

  it('refuses an expired or revoked grant', () => {
    expect(allowsFamilyRequest(grant({ expiresAt: NOW - 1 }), ask(), NOW)).toBe(false);
    expect(allowsFamilyRequest(grant({ revokedAt: NOW - 1 }), ask(), NOW)).toBe(false);
  });

  it('refuses a resource the grant does not name', () => {
    expect(allowsFamilyRequest(grant(), ask({ resourceId: 'bill-2' }), NOW)).toBe(false);
  });

  it('refuses another student, recipient, institution or category', () => {
    expect(allowsFamilyRequest(grant(), ask({ studentId: 's2' }), NOW)).toBe(false);
    expect(allowsFamilyRequest(grant(), ask({ recipientId: 'r2' }), NOW)).toBe(false);
    expect(allowsFamilyRequest(grant(), ask({ institutionId: 'other' }), NOW)).toBe(false);
    expect(allowsFamilyRequest(grant({ category: 'housing' }), ask(), NOW)).toBe(false);
  });

  it('refuses a grant to oneself', () => {
    expect(allowsFamilyRequest(grant({ recipientId: 's1' }), ask({ recipientId: 's1' }), NOW)).toBe(false);
  });

  /*
   * The asymmetry the four access levels exist for, asserted from both sides:
   * payment pays and cannot read; view reads and cannot pay.
   */
  it('lets payment pay and read nothing', () => {
    const payer = grant({ access: 'payment' });
    expect(allowsFamilyRequest(payer, ask({ operation: 'pay' }), NOW)).toBe(true);
    expect(allowsFamilyRequest(payer, ask({ operation: 'read' }), NOW)).toBe(false);
  });

  it('lets view read and pay nothing', () => {
    expect(allowsFamilyRequest(grant({ access: 'view' }), ask({ operation: 'pay' }), NOW)).toBe(false);
  });

  it('refuses paying against any category but finances', () => {
    const housing = grant({ category: 'housing', access: 'payment' });
    expect(allowsFamilyRequest(housing, ask({ category: 'housing', operation: 'pay' }), NOW)).toBe(false);
  });
});

/* ── Career ─────────────────────────────────────────────────────────────── */

describe('a career library', () => {
  const opportunity = (over: Record<string, unknown> = {}) => ({
    ...newOpportunityFixture(),
    ...over,
  });
  function newOpportunityFixture() {
    return {
      id: 'o1',
      title: 'Summer analyst',
      organization: 'Somewhere',
      kind: 'Internship',
      location: 'Nashville',
      format: 'In person',
      compensation: '',
      deadline: '2026-11-01',
      skills: '',
      description: '',
      requirements: '',
      url: '',
      country: '',
      term: '',
      cost: '',
      credit: '',
      saved: false,
    };
  }

  const read = (over: Record<string, unknown> = {}) =>
    readCareer({ ...EMPTY_CAREER, opportunities: [opportunity()], ...over });

  it('reads one a screen would save', () => {
    expect(read().opportunities[0].title).toBe('Summer analyst');
  });

  it('refuses an unknown kind, format or a bad deadline', () => {
    expect(() => read({ opportunities: [opportunity({ kind: 'Apprenticeship' })] })).toThrow();
    expect(() => read({ opportunities: [opportunity({ format: 'Underwater' })] })).toThrow();
    expect(() => read({ opportunities: [opportunity({ deadline: '2026-02-31' })] })).toThrow();
  });

  /*
   * The link is the one field a student will click, and these arrive by
   * import. `safeUrl` is the app's single answer to "is this a link we will
   * put on screen", and this holds the reader to using it.
   */
  it('refuses a link that is not a link', () => {
    expect(() => read({ opportunities: [opportunity({ url: 'javascript:alert(1)' })] })).toThrow();
    expect(() => read({ opportunities: [opportunity({ url: 'https://example.com/job' })] })).not.toThrow();
    expect(() => read({ opportunities: [opportunity({ url: '' })] }), 'no link is fine').not.toThrow();
  });

  it('refuses a nameless opportunity and a duplicate id', () => {
    expect(() => read({ opportunities: [opportunity({ title: ' ' })] })).toThrow();
    expect(() => read({ opportunities: [opportunity(), opportunity()] })).toThrow();
  });

  /*
   * An import can neither collide with what is already there nor arrive
   * pre-starred, because every row is given a fresh id and `saved: false`.
   */
  it('gives every imported row a new id and no star', () => {
    const rows = readOpportunities(JSON.stringify([opportunity({ id: 'o1', saved: true })]));
    expect(rows[0].id).not.toBe('o1');
    expect(rows[0].saved).toBe(false);
  });

  it('refuses an import that is not a list', () => {
    expect(() => readOpportunities(JSON.stringify({ nope: 1 }))).toThrow(/list/i);
  });
});

/* ── Pathway ────────────────────────────────────────────────────────────── */

describe('a pathway library', () => {
  const program = (over: Record<string, unknown> = {}) => ({
    ...newProgram(),
    id: 'p1',
    school: 'Somewhere',
    program: 'A degree',
    ...over,
  });

  it('reads a program a screen would save', () => {
    expect(readPrograms([program()])[0].school).toBe('Somewhere');
  });

  it('refuses a nameless school, a bad date, a bad link and a bad number', () => {
    expect(() => readPrograms([program({ school: ' ' })])).toThrow();
    expect(() => readPrograms([program({ deadline: '2026-02-31' })])).toThrow();
    expect(() => readPrograms([program({ url: 'javascript:alert(1)' })])).toThrow();
    expect(() => readPrograms([program({ tuition: Number.NaN })])).toThrow();
    expect(() => readPrograms([program({ tuition: -1 })])).toThrow();
  });

  it('refuses an unknown status or material state', () => {
    expect(() => readPrograms([program({ status: 'Vibes' })])).toThrow();
    expect(() =>
      readPrograms([program({ materials: [{ id: 'm', title: 'Essay', status: 'Sent', due: '' }] })]),
    ).toThrow();
  });

  it('refuses two programs sharing an id', () => {
    expect(() => readPrograms([program(), program()])).toThrow();
  });

  it('reads a whole library back, and refuses an unknown stage', () => {
    expect(readPathway({ ...EMPTY_PATHWAY, programs: [program()] }).programs).toHaveLength(1);
    expect(() => readPathway({ ...EMPTY_PATHWAY, stage: 'Wizard' })).toThrow();
  });

  /*
   * Loans are not aid. Subtracting them would make a programme somebody has
   * to pay back look cheaper than one they do not, which is the single most
   * misleading thing a cost comparison can do.
   */
  it('is tuition plus living plus other, less grants', () => {
    expect(netProgramCost(program({ tuition: 50_000, living: 18_000, other: 2000, aid: 20_000 }))).toBe(50_000);
  });

  it('says what a program is still missing', () => {
    const bare = programReadiness(program());
    expect(bare).toEqual({ missing: 0, hasRequirements: false, hasDeadline: false });

    const partly = programReadiness(
      program({
        deadline: '2026-12-01',
        requirements: 'Two essays',
        materials: [
          { id: 'a', title: 'Essay', status: 'Ready locally', due: '' },
          { id: 'b', title: 'Transcript', status: 'Preparing', due: '' },
          { id: 'c', title: 'Reference', status: 'Not started', due: '' },
        ],
      }),
    );
    expect(partly).toEqual({ missing: 2, hasRequirements: true, hasDeadline: true });
  });
});
