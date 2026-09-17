import { Refusal } from '../../../packages/institution/src/index.ts';
import type { ActionInput, Receipt, UniversityRecord } from '../../../packages/institution/src/index.ts';
import type { AdapterContext, InstitutionAdapter } from './adapter.ts';
import {
  SANDBOX_INSTITUTION,
  SANDBOX_MARK,
  already,
  connection,
  isStudent,
  matching,
  page,
  type Athlete,
  type Eligibility,
  type SandboxStore,
  type Seat,
  type Team,
  type Trip,
} from './sandbox.ts';

/**
 * Athletics, against the sandbox, as a labelled demonstration.
 *
 * `career.ts` carries the Phase 4 warning in full and it holds here unchanged:
 * **no team named here exists**, nobody is cleared to play anything, and no
 * coach is going anywhere. Every record says so.
 *
 * ## Why this area is shaped differently from the three before it
 *
 * A roster spot looks like registration's seat and is not one. Teams do not
 * generally turn people away for want of a number — what they turn people away
 * for is **eligibility**, and eligibility is not a finite resource at all. It
 * is a condition that *expires*.
 *
 * That makes athletics the first area in this repository whose hard part is
 * time rather than contention, and it wanted its own shape:
 *
 *   **A clearance is a date, never a flag.** Nothing anywhere asks whether
 *   somebody *was* cleared. Every check asks whether their clearance is good
 *   on the day being asked about, against the clock the adapter was given. A
 *   demonstration that stored `eligible: true` and set it once would have been
 *   demonstrating the bug rather than the rule, and it is precisely the bug
 *   that lets an athlete with a lapsed physical get on a bus.
 *
 * The genuinely finite thing is the **seat on the coach**. So the two rules
 * compose — and the order they compose in is itself a decision:
 *
 *   **Eligibility is checked before the seat.** Telling somebody the bus is
 *   full when the real answer is that their return-to-play assessment is
 *   outstanding sends them to the wrong office, and they will come back.
 *
 * ## The disclosure, which is a medical one
 *
 * Why somebody is not cleared is a medical fact. `Eligibility.why` is readable
 * by the athlete and by **nobody else — including their coach**. A coach sees
 * *that* a player is not cleared, because that is what picking a team needs,
 * and does not see why, because that is between the athlete and the people who
 * assessed them. `athletics.test.ts` asserts a coach's reading of the roster
 * contains "not cleared" and does not contain the reason, with a control that
 * reads the same roster as the athlete and finds it.
 *
 * ## And why a clearance file is opened late
 *
 * The first time somebody is put on a roster, not the first time they log in —
 * the same reason a bill is opened late. Opening a clearance file for everybody
 * with an account would be recording a medical question about people who have
 * no business with one.
 */

const day = (at: Date) => at.toISOString().slice(0, 10);

/* ── Eligibility, which is a date ───────────────────────────────────────── */

/** Whether one clearance is good on this day. The only form of the question. */
export const good = (c: Eligibility, now: Date) => day(now) <= c.until;

/** Every clearance of this person's that has run out, or never was good. */
export const lapsed = (store: SandboxStore, student: string, now: Date): Eligibility[] =>
  store.clearances(student).filter((c) => !good(c, now));

/**
 * Whether this person may take the field today.
 *
 * Note what it is *not*: a stored answer, a cached answer, or an answer about
 * any day but the one passed in. A student cleared yesterday and lapsed today
 * is refused today, and the test for that moves the clock rather than editing
 * a row — which is the only version of that test that proves the date is doing
 * the work.
 */
export const eligible = (store: SandboxStore, student: string, now: Date): boolean =>
  store.clearances(student).length > 0 && lapsed(store, student, now).length === 0;

/* ── Travel, where the seat is ──────────────────────────────────────────── */

/** Places taken on one coach, counted rather than stored. */
export const aboard = (store: SandboxStore, trip: string): number =>
  store.seats(trip).filter((s) => s.state === 'on').length;

/** Whether the manifest has gone to the driver. */
export const sealed = (trip: Trip, now: Date) => day(now) > trip.until;

const seatOf = (store: SandboxStore, student: string, trip: string): Seat | null =>
  store.seats(trip).find((s) => s.student === student) ?? null;

const onRoster = (store: SandboxStore, student: string, team: string): Athlete | null =>
  store.athletes(team).find((a) => a.student === student && a.state === 'rostered') ?? null;

const readable = (at: string) => `${at.slice(0, 10)} at ${at.slice(11, 16)} UTC`;

/* ── Records ────────────────────────────────────────────────────────────── */

/**
 * A team, as this particular person is allowed to read it.
 *
 * The roster lines are where the medical disclosure lives. Everybody on the
 * team, and the coach, can see *who is on the team* and *whether each is
 * cleared* — a squad list with the availability on it is the ordinary
 * artefact of a sport. The reason is added to exactly one line: the reader's
 * own.
 */
export function teamRecord(store: SandboxStore, team: Team, context: AdapterContext, now: Date): UniversityRecord {
  const me = context.identity.userId;
  const coach = team.coachId === me;
  const squad = store.athletes(team.id).filter((a) => a.state === 'rostered');
  const ours = squad.find((a) => a.student === me) ?? null;
  const onIt = coach || ours !== null;

  const cleared = (student: string) => eligible(store, student, now);

  return {
    id: team.id,
    area: 'athletics',
    title: `${SANDBOX_MARK} · ${team.name}`,
    summary: `${team.sport} · ${team.coach} · ${team.season}`,
    status: coach
      ? `${squad.length} on the roster · ${squad.filter((a) => cleared(a.student)).length} cleared`
      : ours
        ? cleared(me)
          ? 'You are cleared'
          : 'You are not cleared'
        : `${squad.length} on the roster`,
    version: `${squad.length}:${squad.filter((a) => cleared(a.student)).length}:${ours?.version ?? 0}`,
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Sport', value: team.sport },
      { label: 'Coached by', value: team.coach },
      { label: 'Season', value: team.season },
      /*
       * The squad list, for the coach and for the athletes on it. A person
       * with no connection to the team sees the team exists and not who is
       * in it — the same posture the rest of Phase 4 takes.
       */
      ...(onIt
        ? squad.map((a) => ({
            label: `${a.name} · ${a.position}`,
            value: cleared(a.student) ? 'Cleared' : 'Not cleared',
          }))
        : []),
      /*
       * And the reason, on exactly one line: the reader's own. A coach reading
       * this sees "Not cleared" beside a player's name and nothing more,
       * because why is a medical fact and picking a team does not need it.
       */
      ...(ours && !cleared(me)
        ? lapsed(store, me, now).map((c) => ({
            label: `Your ${c.what.toLowerCase()}`,
            value: c.why || `Ran out on ${c.until}.`,
          }))
        : []),
      ...(ours?.history ?? []).map((h) => ({ label: h.at.slice(0, 16).replace('T', ' '), value: `${h.what} — ${h.who}` })),
    ],
    actions: coach
      ? [
          {
            id: 'add',
            label: 'Add a player to the roster',
            fields: [
              { id: 'who', label: 'Student', kind: 'text' as const, required: true },
              { id: 'name', label: 'Name', kind: 'text' as const, required: true },
              { id: 'position', label: 'Position', kind: 'text' as const, required: false },
            ],
          },
          { id: 'release', label: 'Release a player', fields: [{ id: 'who', label: 'Student', kind: 'text' as const, required: true }] },
        ]
      : [],
  };
}

/** A fixture, as a person reads it. */
export function tripRecord(store: SandboxStore, trip: Trip, context: AdapterContext, now: Date): UniversityRecord {
  const me = context.identity.userId;
  const team = store.team(trip.team);
  const coach = team?.coachId === me;
  const on = aboard(store, trip.id);
  const left = Math.max(0, trip.seats - on);
  const ours = seatOf(store, me, trip.id);
  const shut = sealed(trip, now);
  const manifest = store.seats(trip.id).filter((s) => s.state === 'on');

  return {
    id: trip.id,
    area: 'athletics',
    title: `${SANDBOX_MARK} · ${trip.what} — ${trip.where}`,
    summary: `${team?.name ?? 'Unknown team'} · leaves ${readable(trip.leaves)}`,
    status: ours?.state === 'on' ? 'You are on the coach' : shut ? 'Manifest closed' : left > 0 ? `${left} of ${trip.seats} places left` : 'Full',
    version: `${on}:${ours?.version ?? 0}`,
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Team', value: team?.name ?? 'Unknown' },
      { label: 'Where', value: trip.where },
      { label: 'Leaves', value: readable(trip.leaves) },
      { label: 'Back', value: readable(trip.returns) },
      { label: 'Places', value: `${on} of ${trip.seats} taken` },
      { label: 'Manifest closes', value: trip.until },
      /* The manifest is the coach's, because it is what they hand the driver. */
      ...(coach ? manifest.map((s) => ({ label: s.student, value: 'On the coach' })) : []),
      ...(ours ? [{ label: 'You', value: ours.state === 'on' ? 'On the coach' : 'Not travelling' }] : []),
    ],
    dates: [
      { at: trip.leaves, what: `${trip.what} — the coach leaves` },
      { at: `${trip.until}T23:59:59.000Z`, what: `${trip.what} — last day to change the manifest` },
    ],
    actions: shut
      ? []
      : ours?.state === 'on'
        ? [{ id: 'step-off', label: 'Take my name off the manifest', fields: [] }]
        : left > 0
          ? [{ id: 'travel', label: 'Put my name on the manifest', fields: [] }]
          : [],
  };
}

/* ── The refusals ───────────────────────────────────────────────────────── */

/** The team this caller coaches, refused rather than returned null. */
function coaching(context: AdapterContext, team: Team): Team {
  if (team.coachId !== context.identity.userId) {
    throw new Refusal(`Only ${team.coach} can change the ${team.name} roster.`);
  }
  return team;
}

/**
 * Whether this athlete can get on this coach, in the order that helps them.
 *
 * Eligibility first and the seat second, deliberately. Told "the bus is full"
 * when the true answer is a lapsed assessment, somebody goes to the travel
 * office, is sent away, and comes back no better off.
 */
function travelling(store: SandboxStore, context: AdapterContext, trip: Trip, now: Date): void {
  if (!isStudent(context)) throw new Refusal('Only an athlete can put their own name on a manifest.');
  if (sealed(trip, now)) {
    throw new Refusal(`The manifest for ${trip.what} closed on ${trip.until} and is with the driver.`);
  }

  const me = context.identity.userId;
  if (!onRoster(store, me, trip.team)) {
    throw new Refusal(`You are not on the ${store.team(trip.team)?.name ?? 'team'} roster.`);
  }

  if (seatOf(store, me, trip.id)?.state === 'on') {
    /*
     * Boarding twice was not refused, and nothing noticed, because the second
     * commit wrote the same row to the same state and the manifest count did
     * not move. It was the mutation harness that found it: removing the
     * idempotency check left the suite green, which meant the retried-key test
     * was not testing anything — there was nothing for a retry to get wrong.
     * A refusal here gives it something.
     */
    throw new Refusal(`Your name is already on the manifest for ${trip.what}.`);
  }

  const out = lapsed(store, me, now);
  if (store.clearances(me).length === 0 || out.length) {
    const what = out.map((c) => c.what.toLowerCase()).join(' and ') || 'clearance';
    throw new Refusal(
      `You are not cleared to compete: your ${what} is outstanding. Travel is closed to you until it is done.`,
    );
  }
}

/** The place check, made at review and again at the write. */
function placeOn(store: SandboxStore, trip: Trip): void {
  if (trip.seats - aboard(store, trip.id) <= 0) {
    throw new Refusal(`The coach to ${trip.where} filled while you were reading. Ask about a second vehicle.`);
  }
}

const commitSeat = (
  store: SandboxStore,
  row: Seat,
  key: string,
  who: string,
  what: string,
  at: string,
  change: (s: Seat) => void,
): Receipt => {
  change(row);
  row.version += 1;
  row.history.push({ at, who, what, receipt: key });
  store.saveSeat(row);
  const receipt: Receipt = {
    id: key,
    status: 'completed',
    message: `${SANDBOX_MARK} · ${what}. No coach is going anywhere and no team here exists.`,
    recordedAt: at,
  };
  store.keep(receipt);
  return receipt;
};

const commitAthlete = (
  store: SandboxStore,
  row: Athlete,
  key: string,
  who: string,
  what: string,
  at: string,
  change: (a: Athlete) => void,
): Receipt => {
  change(row);
  row.version += 1;
  row.history.push({ at, who, what, receipt: key });
  store.saveAthlete(row);
  const receipt: Receipt = {
    id: key,
    status: 'completed',
    message: `${SANDBOX_MARK} · ${what}. No roster at any real institution changed.`,
    recordedAt: at,
  };
  store.keep(receipt);
  return receipt;
};

export function athleticsAdapter(store: SandboxStore, clock: () => Date = () => new Date()): InstitutionAdapter {
  /** A team or a trip — the area carries both kinds of record. */
  const find = (id: string): { team: Team } | { trip: Trip } => {
    const team = store.team(id);
    if (team) return { team };
    const trip = store.trip(id);
    if (trip) return { trip };
    throw new Refusal('No such team or fixture in the sandbox athletics department.');
  };

  const adapter: InstitutionAdapter = {
    area: 'athletics',
    institutionId: SANDBOX_INSTITUTION,
    status: async (context) =>
      connection('athletics', context, isStudent(context) || store.coaches(context.identity.userId) !== null),
    list: async (context, query) => {
      const now = clock();
      const records = [
        ...store.teams().map((t) => teamRecord(store, t, context, now)),
        ...store.trips().map((t) => tripRecord(store, t, context, now)),
      ];
      return page(matching(records, query.search));
    },
    get: async (context, id) => {
      const now = clock();
      const team = store.team(id);
      if (team) return teamRecord(store, team, context, now);
      const trip = store.trip(id);
      return trip ? tripRecord(store, trip, context, now) : null;
    },
    review: async (context, input) => {
      const now = clock();
      const found = find(input.recordId);

      if ('trip' in found) {
        const trip = found.trip;
        if (input.actionId === 'travel') {
          travelling(store, context, trip, now);
          placeOn(store, trip);
          return {
            title: `Travel to ${trip.where} for ${trip.what}`,
            details: [
              { label: 'Leaves', value: readable(trip.leaves) },
              { label: 'Back', value: readable(trip.returns) },
              { label: 'Places left now', value: String(trip.seats - aboard(store, trip.id)) },
              { label: 'After this', value: `Your name is on the manifest. You can take it off until ${trip.until}.` },
            ],
          };
        }
        if (input.actionId === 'step-off') {
          if (!isStudent(context)) throw new Refusal('Only an athlete can take their own name off a manifest.');
          const ours = seatOf(store, context.identity.userId, trip.id);
          if (ours?.state !== 'on') throw new Refusal('Your name is not on that manifest.');
          if (sealed(trip, now)) {
            throw new Refusal(`The manifest for ${trip.what} closed on ${trip.until} and is with the driver.`);
          }
          return {
            title: `Take your name off the manifest for ${trip.what}`,
            details: [
              { label: 'After this', value: 'The place goes back and somebody else on the roster can take it.' },
            ],
          };
        }
        throw new Refusal('That is not something a fixture can do.');
      }

      const team = coaching(context, found.team);
      if (input.actionId !== 'add' && input.actionId !== 'release') {
        throw new Refusal('That is not something a team can do.');
      }
      const who = String(input.fields?.who ?? '').trim();
      if (!who) throw new Refusal('Name the player.');

      if (input.actionId === 'add') {
        if (onRoster(store, who, team.id)) throw new Refusal(`${who} is already on the ${team.name} roster.`);
        if (!String(input.fields?.name ?? '').trim()) throw new Refusal('Give the name that goes on the squad list.');
        return {
          title: `Add ${who} to the ${team.name} roster`,
          details: [
            { label: 'Roster now', value: String(store.athletes(team.id).filter((a) => a.state === 'rostered').length) },
            {
              label: 'After this',
              value:
                'Their clearance file is opened, which is when the questions about a physical start. Being on a roster is not being cleared to compete.',
            },
          ],
        };
      }

      const row = onRoster(store, who, team.id);
      if (!row) throw new Refusal(`${who} is not on the ${team.name} roster.`);
      return {
        title: `Release ${who} from the ${team.name} roster`,
        details: [
          { label: 'On the roster since', value: row.at.slice(0, 10) },
          { label: 'After this', value: 'They come off the squad list. Their clearances are theirs and stay.' },
        ],
      };
    },
    execute: async (context: AdapterContext, input: ActionInput, key: string) => {
      const done = already(store, key);
      if (done) return done;

      const now = clock();
      const at = now.toISOString();
      const found = find(input.recordId);
      const me = context.identity.userId;

      if ('trip' in found) {
        const trip = found.trip;
        if (input.actionId === 'travel') {
          travelling(store, context, trip, now);
          // Again, because the review reserved nothing.
          placeOn(store, trip);
          const row: Seat = seatOf(store, me, trip.id) ?? {
            id: `${trip.id}::${me}`,
            trip: trip.id,
            student: me,
            state: 'off',
            at,
            version: 0,
            history: [],
          };
          return commitSeat(store, row, key, me, `On the manifest for ${trip.what}`, at, (s) => {
            s.state = 'on';
            s.at = at;
          });
        }
        if (input.actionId === 'step-off') {
          if (!isStudent(context)) throw new Refusal('Only an athlete can take their own name off a manifest.');
          const row = seatOf(store, me, trip.id);
          if (row?.state !== 'on') throw new Refusal('Your name is not on that manifest.');
          if (sealed(trip, now)) {
            throw new Refusal(`The manifest for ${trip.what} closed on ${trip.until} and is with the driver.`);
          }
          return commitSeat(store, row, key, me, `Off the manifest for ${trip.what}`, at, (s) => {
            s.state = 'off';
          });
        }
        throw new Refusal('That is not something a fixture can do.');
      }

      const team = coaching(context, found.team);
      if (input.actionId !== 'add' && input.actionId !== 'release') {
        throw new Refusal('That is not something a team can do.');
      }
      const who = String(input.fields?.who ?? '').trim();
      if (!who) throw new Refusal('Name the player.');

      if (input.actionId === 'add') {
        if (onRoster(store, who, team.id)) throw new Refusal(`${who} is already on the ${team.name} roster.`);
        const name = String(input.fields?.name ?? '').trim();
        if (!name) throw new Refusal('Give the name that goes on the squad list.');
        const row: Athlete = store.athletes(team.id).find((a) => a.student === who) ?? {
          id: `${team.id}::${who}`,
          team: team.id,
          student: who,
          name,
          position: String(input.fields?.position ?? '').trim() || 'Squad',
          state: 'released',
          at,
          version: 0,
          history: [],
        };
        /*
         * The clearance file opens here and not at sign-in, for the reason a
         * bill does: a medical question about somebody with no business with
         * one is a record that should not exist.
         */
        store.openClearances(who, at);
        return commitAthlete(store, row, key, team.coach, `Added to the ${team.name} roster`, at, (a) => {
          a.state = 'rostered';
          a.name = name;
          a.at = at;
        });
      }

      const row = onRoster(store, who, team.id);
      if (!row) throw new Refusal(`${who} is not on the ${team.name} roster.`);
      return commitAthlete(store, row, key, team.coach, `Released from the ${team.name} roster`, at, (a) => {
        a.state = 'released';
      });
    },
  };
  return adapter;
}
