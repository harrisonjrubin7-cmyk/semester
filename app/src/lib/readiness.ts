/**
 * Where a university actually stands with Semester, and what the app may
 * therefore claim about it.
 *
 * This file exists because a catalogue of universities is a claim about a
 * hundred institutions, and the claim is easy to make by accident. Holding
 * Harvard's public course catalogue is not a relationship with Harvard.
 * Knowing the address of Harvard's LMS is not an integration with it. Both
 * look identical in a data file, and both look identical on a screen unless
 * something refuses to let them.
 *
 * So two values, and the rule between them is the point of the module.
 *
 * ## Relationship is declared, because it is a fact about paperwork
 *
 * Nothing in a data pack can tell you whether an agreement exists. A campus
 * map does not become a contract by being detailed. So `Relationship` is
 * stated by whoever knows, defaults to the weakest value, and is never
 * inferred from how much data a school happens to have.
 *
 * ## Readiness is derived, because it is a fact about the software
 *
 * The opposite. A hand-set level is a second thing to keep true, and the one
 * that rots first — it is set during an implementation, the implementation
 * changes, and the number stays. So `readinessOf` computes it from what the
 * school profile actually carries, and there is no setter.
 *
 * ## The rule: a link is not a connection
 *
 * This is the half that does the work, and it is worth being exact about.
 *
 * `Capabilities` carries `lmsUrl`, `registrarUrl`, `orgPortalUrl` and their
 * neighbours. Every one of them is **an address a student can click**, of the
 * kind that goes in a data pack alongside a dining hall's opening hours.
 * None of them is a connection: nothing authenticates, nothing syncs, nobody
 * at the university approved anything.
 *
 * Levels 0 to 2 are therefore reachable from a pack, because they describe
 * information. **Levels 3 and up are not reachable from a pack at any amount
 * of data**, because they describe systems talking to each other, and the
 * only evidence for that is an integration that exists. `connectionsOf` takes
 * that evidence as an argument rather than reading it out of the profile, so
 * that no quantity of links can be mistaken for one.
 *
 * The consequence, today, is that **every school in this repository tops out
 * at level 2, Vanderbilt included** — `app/server/institution/`'s production
 * adapter registry is empty and `docs/UNIVERSITY_CONNECTIONS.md` says why it
 * stays that way. That is not a gap in this file. It is this file reporting
 * the truth, and `readiness.test.ts` pins it so that a level 3 cannot appear
 * without a real connection appearing first.
 */

import type { School } from './school';

/**
 * What Semester's relationship to an institution actually is.
 *
 * Ordered weakest first, and the order is load-bearing — `atLeast` compares
 * by position, and `ceiling` reads the same order. Inserting a value in the
 * middle changes both, which is intended: a new kind of relationship should
 * have to say where it sits.
 */
export const RELATIONSHIPS = [
  'public-data',
  'available',
  'pilot',
  'connected',
  'institutional-customer',
] as const;

export type Relationship = (typeof RELATIONSHIPS)[number];

/**
 * The weakest one, and the default for anything that does not say.
 *
 * Defaulting upward would be the whole bug this module exists to prevent: a
 * university added to a catalogue with a field left blank would read as a
 * customer, and nobody would notice until somebody asked them about it.
 */
export const NO_RELATIONSHIP: Relationship = 'public-data';

/**
 * What each one means, in the words the app should use for it.
 *
 * Written as sentences rather than labels because a label is where this goes
 * wrong: "Connected" on a card is ambiguous and reassuring, and the sentence
 * is neither. A screen may show the short name, but it may not show it
 * *instead of* being able to say this.
 */
export const RELATIONSHIP_MEANS: Record<Relationship, { short: string; says: string }> = {
  'public-data': {
    short: 'Public information',
    says:
      'Semester holds public information about this university. It is not a ' +
      'customer, nothing is connected to its systems, and nobody there has ' +
      'agreed to anything.',
  },
  available: {
    short: 'Available',
    says:
      'Semester could be switched on here and has not been. There is no ' +
      'agreement and nothing is connected.',
  },
  pilot: {
    short: 'Pilot',
    says:
      'A limited pilot is agreed with this university. It is not a full ' +
      'deployment and may end.',
  },
  connected: {
    short: 'Connected',
    says:
      'This university has approved one or more system connections. That is ' +
      'narrower than being a customer and says nothing about the rest.',
  },
  'institutional-customer': {
    short: 'Institutional customer',
    says: 'This university has an agreement with Semester covering the deployment it runs.',
  },
};

/** Is `have` at least as strong as `want`? By position, per `RELATIONSHIPS`. */
export function atLeast(have: Relationship, want: Relationship): boolean {
  return RELATIONSHIPS.indexOf(have) >= RELATIONSHIPS.indexOf(want);
}

/**
 * The connections a university has actually approved.
 *
 * Deliberately not read from `School`. A school profile is a data pack, and a
 * data pack is something somebody was handed — see `docs/SCHOOL_DATA_PACK.md`,
 * which opens by saying a pack "is not a connection, not a login, and not read
 * access to any system". Taking this as an argument is what makes that
 * sentence enforceable rather than aspirational.
 */
export interface Connections {
  /** Single sign-on, actually configured and tested against the institution. */
  sso?: boolean;
  /** An approved LMS integration. Not a link to the LMS. */
  lms?: boolean;
  /** Calendar read/write through an approved integration. */
  calendar?: boolean;
  /** Institutional email, likewise. */
  email?: boolean;
  /** The student information system. */
  sis?: boolean;
  /** Degree audit. */
  degreeAudit?: boolean;
  /** Registration. */
  registration?: boolean;
}

/** Nothing connected, which is every institution in this repository today. */
export const NO_CONNECTIONS: Connections = {};

/** The six rungs, weakest first. `level` is the number the spec names. */
export const LEVELS = [
  { level: 0, name: 'Directory', is: 'Public campus information.' },
  { level: 1, name: 'Community', is: 'Organisations, events and campus resources.' },
  { level: 2, name: 'Academic', is: 'Courses, the academic calendar and degree information.' },
  { level: 3, name: 'Connected', is: 'Sign-on, the LMS, calendar and email.' },
  { level: 4, name: 'Institutional', is: 'The student information system, degree audit and registration.' },
  { level: 5, name: 'Full Semester', is: 'A deep integrated university deployment.' },
] as const;

export type Level = (typeof LEVELS)[number]['level'];

/**
 * The strongest level a relationship may be shown at.
 *
 * The second half of the honesty rule, and the one that catches the case the
 * derivation cannot: somebody configures a connection for a university that
 * has agreed to nothing. The software would then be genuinely connected and
 * the claim would still be wrong, so the ceiling is about the paperwork and
 * the derivation is about the software, and a level has to satisfy both.
 *
 * `public-data` and `available` share a ceiling deliberately. The difference
 * between them is intent, not capability, and a ladder that rewarded intent
 * would be measuring the wrong thing.
 */
export const CEILING: Record<Relationship, Level> = {
  'public-data': 2,
  available: 2,
  pilot: 3,
  connected: 4,
  'institutional-customer': 5,
};

/** What a school's own data reaches, before the ceiling is applied. */
function fromProfile(school: School): Level {
  if (!school.id || !school.name) return 0;
  const c = school.capabilities;
  const d = school.data;

  // Level 2 wants the academic layer, and wants it as *dates* — a term with
  // a start and an end, which is the thing a student came for.
  //
  // `registrarUrl` deliberately does not count, and the first draft of this
  // let it. That is the module's own thesis applied to itself: a link to the
  // registrar is a link, of exactly the kind level 0 to 2 are allowed to be
  // made of, but it is a *campus resource* rather than an academic calendar.
  // Letting one address promote a school a whole rung is the small version of
  // reading an LMS URL as an integration.
  const academic = (d.academicCalendar?.length ?? 0) > 0;

  // Level 1 wants somewhere to go and something to join. Any one of these is
  // enough: a campus that can be navigated, an organisations portal, the
  // buildings list the map screen reads, a library, or the registrar's own
  // address — which is a campus resource and lives here.
  const community =
    Boolean(c.orgPortalUrl) ||
    c.campusMap ||
    (d.buildings?.length ?? 0) > 0 ||
    Boolean(c.libraryUrl) ||
    Boolean(c.registrarUrl);

  if (academic && community) return 2;
  if (community) return 1;
  // Academic depth without a campus around it is still a real level 1: the
  // student gets dates, which is the thing they came for. Calling it 0 would
  // hide a working calendar behind a missing buildings list.
  if (academic) return 1;
  return 0;
}

/** What the approved connections reach, before the ceiling is applied. */
function fromConnections(c: Connections): Level {
  if (c.sis || c.degreeAudit || c.registration) return 4;
  if (c.sso || c.lms || c.calendar || c.email) return 3;
  return 0;
}

export interface Readiness {
  level: Level;
  name: string;
  /** What that level covers. */
  is: string;
  /**
   * Why it is not higher, when something is holding it down.
   *
   * Null at the top of what is possible. This is the field a data-health
   * screen shows, and the reason the level is a number rather than a badge:
   * "level 2, because nothing is connected" is actionable and "Academic" is
   * not.
   */
  held?: string;
}

/**
 * Where a university stands, computed from what it has.
 *
 * Never hand-set, and there is deliberately no way to override the result.
 * An implementation that wants a higher number gets it by connecting
 * something or by signing something, which is the only honest way to have it.
 */
export function readinessOf(
  school: School,
  relationship: Relationship = NO_RELATIONSHIP,
  connections: Connections = NO_CONNECTIONS,
): Readiness {
  const earned = Math.max(fromProfile(school), fromConnections(connections)) as Level;
  const ceiling = CEILING[relationship];
  const level = (earned > ceiling ? ceiling : earned) as Level;
  const rung = LEVELS[level];

  let held: string | undefined;
  if (earned > ceiling) {
    // The uncomfortable case, and the one worth naming out loud rather than
    // silently clamping: the software can do more than the paperwork allows
    // it to claim.
    held =
      `Connections reach level ${earned}, and the relationship is ` +
      `"${RELATIONSHIP_MEANS[relationship].short}", which is shown at no more than ${ceiling}.`;
  } else if (level < 3) {
    held = 'Nothing is connected to this university’s systems.';
  } else if (level < ceiling) {
    held = `More is agreed than is connected: level ${ceiling} is available.`;
  }

  return { level, name: rung.name, is: rung.is, held };
}

/**
 * Whether the app may say this university is connected to anything.
 *
 * One function rather than a comparison written at each call site, because
 * the comparison is the thing that gets written slightly wrong somewhere and
 * ships a claim nobody intended.
 */
export function mayClaimConnection(r: Readiness): boolean {
  return r.level >= 3;
}

/** Whether the app may describe this university as a customer. */
export function mayClaimCustomer(relationship: Relationship): boolean {
  return relationship === 'institutional-customer';
}

/**
 * Which institutions Semester actually has a relationship with.
 *
 * Deliberately a table in the repository rather than a field on `School`, and
 * that placement is the point. A `School` is a data pack — something somebody
 * was handed, per `docs/SCHOOL_DATA_PACK.md` — and a pack that could carry
 * `relationship: 'institutional-customer'` would let a file claim a contract.
 * Anyone who can write a pack could then promote their own university.
 *
 * So this is declared here, by whoever knows, and a school absent from it is
 * `public-data`. **Vanderbilt is not in it**, which is correct: this app was
 * built around Vanderbilt and Vanderbilt has agreed to nothing.
 */
const DECLARED: Record<string, Relationship> = {};

/** What Semester's relationship to this school is. Absent means public data. */
export function relationshipOf(schoolId: string): Relationship {
  return DECLARED[schoolId] ?? NO_RELATIONSHIP;
}

/**
 * The areas whose gateway connection counts as which kind of integration.
 *
 * The bridge between `ConnectionStatus[]` — which the school's own gateway
 * reports — and the ladder. Reading the gateway rather than taking a caller's
 * word is what makes level 3 mean something: the evidence is a service the
 * institution stood up, not a field anybody here can set.
 *
 * Mapped conservatively, and the gaps are deliberate rather than forgotten:
 *
 *   · **`calendar` has no area.** `UNIVERSITY_AREAS` has no calendar entry, so
 *     that flag stays false until the contract grows one. Inventing a mapping
 *     — `courses`, say — would be the small dishonesty this module exists to
 *     refuse.
 *   · **`advising`, `billing`, `aid` and the rest map to nothing.** They are
 *     real connections and they are not what levels 3 and 4 are defined as, so
 *     they raise no rung. A level is not a count of integrations.
 */
const AREA_MEANS: Record<string, keyof Connections> = {
  identity: 'sso',
  courses: 'lms',
  assignments: 'lms',
  assessments: 'lms',
  grades: 'lms',
  email: 'email',
  registration: 'registration',
  records: 'sis',
  graduation: 'degreeAudit',
};

/**
 * The connections a gateway is actually reporting as live.
 *
 * Only `state === 'connected'` counts. `not-configured`, `error` and
 * `disconnected` are each a reason the thing is not working, and a ladder that
 * treated a broken integration as a rung would be at its least honest exactly
 * when a student most needs it to be right.
 */
export function connectionsFrom(
  reported: readonly { area: string; state: string }[] | null | undefined,
): Connections {
  const out: Connections = {};
  for (const c of reported ?? []) {
    if (c.state !== 'connected') continue;
    const kind = AREA_MEANS[c.area];
    if (kind) out[kind] = true;
  }
  return out;
}

/** A `Relationship` from whatever a stored profile had, defaulting weakest. */
export function readRelationship(raw: unknown): Relationship {
  return (RELATIONSHIPS as readonly string[]).includes(raw as string)
    ? (raw as Relationship)
    : NO_RELATIONSHIP;
}
