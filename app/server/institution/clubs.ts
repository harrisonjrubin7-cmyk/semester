import { randomUUID } from 'node:crypto';
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
  money,
  page,
  type Ballot,
  type Club,
  type Election,
  type Member,
  type RoomHold,
  type SandboxStore,
  type Spend,
  type Voted,
} from './sandbox.ts';

/**
 * Clubs and student organizations, against the sandbox, as a labelled
 * demonstration.
 *
 * `career.ts` carries the Phase 4 warning in full. Here: **no club named here
 * exists**, no money moves, and no election decides anything.
 *
 * ## Four finite things, and they are not the same kind of finite
 *
 * Which is what makes this the most interesting of Phase 4, because up to now
 * every finite thing in this repository has been a *count*.
 *
 *   A **room at a time** is registration's seat exactly. Two clubs cannot hold
 *   Buttrick 101 at eight on Tuesday.
 *
 *   A **budget is a sum**, and that is genuinely different. Two claims of
 *   forty dollars fit inside a hundred and a third does not, and no number of
 *   slots expresses that. So the check is against the remainder, and the
 *   remainder is derived from the approved claims rather than stored — for the
 *   reason the seat count is: a `spent` column and the rows that add up to it
 *   are two answers to one question.
 *
 *   A **vote** is one per member, and is the only thing in this repository
 *   that has to be both counted and secret.
 *
 *   And an **event's capacity** is the room's, so it is a seat again.
 *
 * ## The ballot, which is the hardest thing in Phase 4
 *
 * Two requirements that pull against each other:
 *
 *   **Nobody votes twice**, which needs a record of who voted.
 *   **Nobody can tell how anybody voted**, which forbids a record joining a
 *   person to a choice.
 *
 * A demonstration storing `{ voter, choice }` would have satisfied the first
 * and *pretended* at the second by not showing a column — and a column
 * somebody can select is a column somebody will select.
 *
 * So the ballot is two tables that are never joined: a roll of who has voted,
 * carrying no choice, and a pile of papers, carrying no voter. The count comes
 * from the papers and the double-vote refusal from the roll, and nothing in
 * either row names a row in the other, so there is no query that puts them
 * back together. A paper's id is `randomUUID()` and is deliberately **not**
 * derived from the voter: an id anybody could recompute is a join waiting for
 * somebody who knows the recipe.
 *
 * Both writes go through `castVote`, in one transaction, because a marked roll
 * with no paper loses somebody's vote and a paper with no mark lets them vote
 * twice.
 *
 * `clubs.test.ts` asserts the separation from the outside: it reads every roll
 * row and every ballot row and checks that no value appearing in one appears
 * in the other. That is a claim about what is *stored*, which a test of the
 * adapter's output could not make.
 *
 * ## Dues, which are a club's money and not a university's
 *
 * Money's constraint with an extra turn. A dues record says what is owed and
 * records that a treasurer marked it settled; nothing here takes a payment
 * from anybody, and the record says so.
 */

/* ── Membership ─────────────────────────────────────────────────────────── */

const memberOf = (store: SandboxStore, student: string, club: string): Member | null =>
  store.members(club).find((m) => m.student === student && m.state === 'member') ?? null;

/** Everybody currently in a club, which is what quorum and dues are read off. */
export const roll = (store: SandboxStore, club: string): Member[] =>
  store.members(club).filter((m) => m.state === 'member');

/* ── Budget, where the finite thing is a sum ────────────────────────────── */

/**
 * What the club has committed, in cents, derived rather than stored.
 *
 * `approved` and `paid` both count: an approved claim is money promised, and a
 * budget that only counted what had actually gone out would let a club promise
 * the same thousand dollars to four people. `refused` and `asked` do not.
 */
export const committed = (store: SandboxStore, club: string): number =>
  store
    .spends(club)
    .filter((s) => s.state === 'approved' || s.state === 'paid')
    .reduce((n, s) => n + s.cents, 0);

/** What is left of the year's grant. */
export const remaining = (store: SandboxStore, club: Club): number => club.budgetCents - committed(store, club.id);

/* ── Rooms, where it is a seat again ────────────────────────────────────── */

/** Whichever club holds this room at this moment, or null. */
export const heldBy = (store: SandboxStore, room: string, when: string): RoomHold | null =>
  store.holds(room).find((h) => h.when === when) ?? null;

/* ── The ballot ─────────────────────────────────────────────────────────── */

/** Whether an election is open at this moment. */
export const voting = (e: Election, now: Date) =>
  now.getTime() >= new Date(e.opens).getTime() && now.getTime() <= new Date(e.closes).getTime();

/**
 * The count, from the papers alone.
 *
 * Note what this function does not take and could not use: a voter. There is
 * no argument that would let it report how one person voted, which is the
 * property being demonstrated rather than merely claimed.
 */
export function tally(store: SandboxStore, e: Election): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of e.candidates) counts[c] = 0;
  for (const paper of store.ballots(e.id)) {
    if (paper.choice in counts) counts[paper.choice] += 1;
  }
  return counts;
}

const cash = (cents: number) => money(cents);

/* ── Records ────────────────────────────────────────────────────────────── */

export function clubRecord(store: SandboxStore, club: Club, context: AdapterContext): UniversityRecord {
  const me = context.identity.userId;
  const officer = club.officer === me;
  const mine = memberOf(store, me, club.id);
  const members = roll(store, club.id);
  const left = remaining(store, club);
  const owing = club.duesCents > 0 && mine !== null && !mine.duesPaid;

  return {
    id: club.id,
    area: 'clubs',
    title: `${SANDBOX_MARK} · ${club.name}`,
    summary: `${club.what} · ${members.length} member${members.length === 1 ? '' : 's'}`,
    status: officer
      ? `${members.length} members · ${cash(left)} of ${cash(club.budgetCents)} left`
      : mine
        ? owing
          ? `Member · ${cash(club.duesCents)} dues outstanding`
          : 'Member'
        : `${members.length} members`,
    version: `${members.length}:${committed(store, club.id)}:${mine?.version ?? 0}`,
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'What it does', value: club.what },
      { label: 'Run by', value: club.officerName },
      { label: 'Members', value: String(members.length) },
      { label: 'Dues', value: club.duesCents > 0 ? `${cash(club.duesCents)} a year` : 'None' },
      /*
       * The budget is the officers' to see in detail and the membership's to
       * see in total. A club whose members cannot find out what its grant was
       * is a club with a governance problem, so the headline figure is not
       * hidden from them — only the claim-by-claim breakdown is, because a
       * claim carries who asked for it.
       */
      { label: 'Grant this year', value: cash(club.budgetCents) },
      ...(officer || mine ? [{ label: 'Left to spend', value: cash(left) }] : []),
      ...(officer
        ? store.spends(club.id).map((s) => ({
            label: `${s.what} · ${s.by}`,
            value: `${cash(s.cents)} — ${s.state}`,
          }))
        : []),
      /* The membership list, for members and officers. */
      ...(officer || mine
        ? members.map((m) => ({
            label: m.name,
            value: club.duesCents > 0 ? (m.duesPaid ? 'Dues settled' : 'Dues outstanding') : 'Member',
          }))
        : []),
      ...(mine?.history ?? []).map((h) => ({ label: h.at.slice(0, 16).replace('T', ' '), value: `${h.what} — ${h.who}` })),
    ],
    actions: officer
      ? [
          {
            id: 'claim',
            label: 'Claim against the budget',
            fields: [
              { id: 'what', label: 'What for', kind: 'text' as const, required: true },
              { id: 'amount', label: 'Amount in dollars', kind: 'text' as const, required: true },
            ],
          },
          { id: 'settle', label: 'Record dues as settled', fields: [{ id: 'who', label: 'Member', kind: 'text' as const, required: true }] },
          {
            id: 'book',
            label: 'Ask for a room',
            fields: [
              { id: 'room', label: 'Room', kind: 'text' as const, required: true },
              { id: 'when', label: 'When, as an ISO time', kind: 'text' as const, required: true },
              { id: 'what', label: 'What for', kind: 'text' as const, required: true },
            ],
          },
        ]
      : mine
        ? [{ id: 'leave', label: 'Leave this club', fields: [] }]
        : isStudent(context)
          ? [{ id: 'join', label: 'Join this club', fields: [{ id: 'name', label: 'Your name', kind: 'text' as const, required: true }] }]
          : [],
  };
}

/**
 * An election, as a person reads it.
 *
 * The record carries the count and whether *this* reader has voted, and those
 * are the only two facts about voting it can carry — there is nothing else in
 * the store to put on it.
 */
export function electionRecord(
  store: SandboxStore,
  e: Election,
  context: AdapterContext,
  now: Date,
): UniversityRecord {
  const me = context.identity.userId;
  const club = store.club(e.club);
  const open = voting(e, now);
  const done = store.hasVoted(e.id, me);
  const counts = tally(store, e);
  const cast = Object.values(counts).reduce((n, c) => n + c, 0);
  const members = roll(store, e.club).length;

  return {
    id: e.id,
    area: 'clubs',
    title: `${SANDBOX_MARK} · ${club?.name ?? 'A club'} — ${e.post}`,
    summary: `${e.candidates.length} candidates · ${cast} vote${cast === 1 ? '' : 's'} cast`,
    status: !open
      ? now.getTime() < new Date(e.opens).getTime()
        ? `Opens ${e.opens.slice(0, 10)}`
        : `Closed ${e.closes.slice(0, 10)}`
      : done
        ? 'You have voted'
        : 'Open',
    version: `${cast}:${done ? 1 : 0}`,
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Post', value: e.post },
      { label: 'Opens', value: e.opens.slice(0, 16).replace('T', ' ') },
      { label: 'Closes', value: e.closes.slice(0, 16).replace('T', ' ') },
      { label: 'Members eligible', value: String(members) },
      { label: 'Votes cast', value: String(cast) },
      /*
       * The count, by candidate, and only once the poll has shut. A running
       * total by candidate during an open election tells late voters which way
       * it is going, which is a thing elections take trouble to avoid. The
       * *number* of votes cast is published throughout, because turnout is not
       * a result.
       */
      ...(!open && now.getTime() > new Date(e.closes).getTime()
        ? e.candidates.map((c) => ({ label: c, value: `${counts[c]} vote${counts[c] === 1 ? '' : 's'}` }))
        : e.candidates.map((c) => ({ label: c, value: 'Standing' }))),
      /* And whether this reader voted — never whether anybody else did. */
      { label: 'You', value: done ? 'Voted' : open ? 'Not yet voted' : 'Did not vote' },
    ],
    dates: [{ at: e.closes, what: `${e.post} — the poll closes` }],
    actions:
      open && !done
        ? [{ id: 'vote', label: 'Vote', fields: [{ id: 'choice', label: 'Candidate', kind: 'text' as const, required: true }] }]
        : [],
  };
}

export function roomRecord(store: SandboxStore, hold: RoomHold, context: AdapterContext): UniversityRecord {
  const club = store.club(hold.club);
  const room = store.room(hold.room);
  return {
    id: hold.id,
    area: 'clubs',
    title: `${SANDBOX_MARK} · ${room?.name ?? hold.room} — ${hold.what}`,
    summary: `${club?.name ?? 'A club'} · ${hold.when.slice(0, 16).replace('T', ' ')} UTC`,
    status: 'Room held',
    version: String(hold.version),
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Room', value: room?.name ?? hold.room },
      { label: 'Holds', value: String(hold.holds) },
      { label: 'Club', value: club?.name ?? 'Unknown' },
      { label: 'When', value: `${hold.when.slice(0, 16).replace('T', ' ')} UTC` },
      { label: 'What for', value: hold.what },
    ],
    dates: [{ at: hold.when, what: `${club?.name ?? 'A club'} — ${hold.what}` }],
    actions:
      club?.officer === context.identity.userId
        ? [{ id: 'release-room', label: 'Give the room back', fields: [] }]
        : [],
  };
}

/* ── The refusals ───────────────────────────────────────────────────────── */

/** The club this caller is an officer of, refused rather than returned null. */
function officerFor(context: AdapterContext, club: Club): Club {
  if (club.officer !== context.identity.userId) {
    throw new Refusal(`Only ${club.officerName} can do that for ${club.name}.`);
  }
  return club;
}

/** Dollars in, cents out, refusing anything that is not money. */
export function cents(said: string): number {
  const text = said.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new Refusal('Give the amount in dollars, like 40 or 40.00.');
  }
  const n = Math.round(Number(text) * 100);
  if (n <= 0) throw new Refusal('An amount has to be more than nothing.');
  return n;
}

/** The budget check, against the remainder and made twice. */
function affordable(store: SandboxStore, club: Club, want: number): void {
  const left = remaining(store, club);
  if (want > left) {
    throw new Refusal(
      `${club.name} has ${cash(left)} left of its ${cash(club.budgetCents)} grant, and that claim is ${cash(want)}.`,
    );
  }
}

/** The room check, made twice. */
function freeRoom(store: SandboxStore, room: string, when: string, club: string): void {
  const taken = heldBy(store, room, when);
  if (taken && taken.club !== club) {
    throw new Refusal(
      `${store.room(room)?.name ?? room} is held by ${store.club(taken.club)?.name ?? 'another club'} at that time.`,
    );
  }
  if (taken) throw new Refusal('You already hold that room at that time.');
}

const commitMember = (
  store: SandboxStore,
  row: Member,
  key: string,
  who: string,
  what: string,
  at: string,
  change: (m: Member) => void,
): Receipt => {
  change(row);
  row.version += 1;
  row.history.push({ at, who, what, receipt: key });
  store.saveMember(row);
  const receipt: Receipt = {
    id: key,
    status: 'completed',
    message: `${SANDBOX_MARK} · ${what}. No club here exists and no money moved.`,
    recordedAt: at,
  };
  store.keep(receipt);
  return receipt;
};

export function clubsAdapter(store: SandboxStore, clock: () => Date = () => new Date()): InstitutionAdapter {
  type Found = { club: Club } | { election: Election } | { hold: RoomHold };
  const find = (id: string): Found => {
    const club = store.club(id);
    if (club) return { club };
    const election = store.election(id);
    if (election) return { election };
    const hold = store.hold(id);
    if (hold) return { hold };
    throw new Refusal('No such club, election or room booking in the sandbox.');
  };

  /** The one rule an election cannot bend, asked in one place. */
  const votable = (context: AdapterContext, e: Election, now: Date): string => {
    if (!isStudent(context)) throw new Refusal('Only a student member can vote.');
    const me = context.identity.userId;
    const club = store.club(e.club);
    if (!memberOf(store, me, e.club)) {
      throw new Refusal(`Only members of ${club?.name ?? 'the club'} can vote in its elections.`);
    }
    if (now.getTime() < new Date(e.opens).getTime()) {
      throw new Refusal(`The poll for ${e.post} opens on ${e.opens.slice(0, 10)}.`);
    }
    if (now.getTime() > new Date(e.closes).getTime()) {
      throw new Refusal(`The poll for ${e.post} closed on ${e.closes.slice(0, 10)}.`);
    }
    if (store.hasVoted(e.id, me)) throw new Refusal('You have already voted in this election.');
    return me;
  };

  const chosen = (e: Election, input: ActionInput): string => {
    const choice = String(input.fields?.choice ?? '').trim();
    if (!choice) throw new Refusal('Name the candidate.');
    if (!e.candidates.includes(choice)) {
      throw new Refusal(`${choice} is not standing for ${e.post}.`);
    }
    return choice;
  };

  const adapter: InstitutionAdapter = {
    area: 'clubs',
    institutionId: SANDBOX_INSTITUTION,
    status: async (context) =>
      connection('clubs', context, isStudent(context) || store.officerOf(context.identity.userId) !== null),
    list: async (context, query) => {
      const now = clock();
      const records = [
        ...store.clubs().map((c) => clubRecord(store, c, context)),
        ...store.elections().map((e) => electionRecord(store, e, context, now)),
        ...store.holds().map((h) => roomRecord(store, h, context)),
      ];
      return page(matching(records, query.search));
    },
    get: async (context, id) => {
      const now = clock();
      const club = store.club(id);
      if (club) return clubRecord(store, club, context);
      const e = store.election(id);
      if (e) return electionRecord(store, e, context, now);
      const hold = store.hold(id);
      return hold ? roomRecord(store, hold, context) : null;
    },
    review: async (context, input) => {
      const now = clock();
      const found = find(input.recordId);
      const me = context.identity.userId;

      if ('election' in found) {
        const e = found.election;
        if (input.actionId !== 'vote') throw new Refusal('That is not something an election can do.');
        votable(context, e, now);
        const choice = chosen(e, input);
        return {
          title: `Vote in ${e.post}`,
          details: [
            { label: 'Your choice', value: choice },
            { label: 'Poll closes', value: e.closes.slice(0, 16).replace('T', ' ') },
            {
              label: 'After this',
              value:
                'Your name goes on the roll and your paper goes in the box, and the two are not joined. Nobody, including this system, can tell how you voted — and you cannot change it.',
            },
          ],
        };
      }

      if ('hold' in found) {
        const hold = found.hold;
        if (input.actionId !== 'release-room') throw new Refusal('That is not something a room booking can do.');
        const club = store.club(hold.club);
        if (!club) throw new Refusal('That booking belongs to no club this sandbox knows.');
        officerFor(context, club);
        return {
          title: `Give back ${store.room(hold.room)?.name ?? hold.room}`,
          details: [
            { label: 'When', value: hold.when.slice(0, 16).replace('T', ' ') },
            { label: 'After this', value: 'Another club can ask for it.' },
          ],
        };
      }

      const club = found.club;

      if (input.actionId === 'join') {
        if (!isStudent(context)) throw new Refusal('Only a student can join a club.');
        if (memberOf(store, me, club.id)) throw new Refusal(`You are already a member of ${club.name}.`);
        if (!String(input.fields?.name ?? '').trim()) throw new Refusal('Give the name that goes on the membership list.');
        return {
          title: `Join ${club.name}`,
          details: [
            { label: 'Dues', value: club.duesCents > 0 ? `${cash(club.duesCents)} a year` : 'None' },
            {
              label: 'After this',
              value:
                club.duesCents > 0
                  ? 'You are a member and the dues are recorded as outstanding. Nothing here takes a payment from you.'
                  : 'You are a member, and you can vote in its elections.',
            },
          ],
        };
      }

      if (input.actionId === 'leave') {
        const mine = memberOf(store, me, club.id);
        if (!mine) throw new Refusal(`You are not a member of ${club.name}.`);
        return {
          title: `Leave ${club.name}`,
          details: [
            { label: 'Member since', value: mine.at.slice(0, 10) },
            {
              label: 'After this',
              value: 'You come off the membership list and cannot vote in its elections. A vote already cast stays cast — it is in the box and cannot be found.',
            },
          ],
        };
      }

      officerFor(context, club);

      if (input.actionId === 'claim') {
        const what = String(input.fields?.what ?? '').trim();
        if (!what) throw new Refusal('Say what the claim is for.');
        const want = cents(String(input.fields?.amount ?? ''));
        affordable(store, club, want);
        return {
          title: `Claim ${cash(want)} for ${what}`,
          details: [
            { label: 'Left before this', value: cash(remaining(store, club)) },
            { label: 'Left after this', value: cash(remaining(store, club) - want) },
            {
              label: 'After this',
              value: 'It is recorded as approved against the grant. No money moves and nothing is paid to anybody.',
            },
          ],
        };
      }

      if (input.actionId === 'settle') {
        if (club.duesCents === 0) throw new Refusal(`${club.name} does not charge dues.`);
        const whoseName = String(input.fields?.who ?? '').trim();
        if (!whoseName) throw new Refusal('Name the member.');
        const m = memberOf(store, whoseName, club.id);
        if (!m) throw new Refusal(`${whoseName} is not a member of ${club.name}.`);
        if (m.duesPaid) throw new Refusal(`${whoseName} is already recorded as settled.`);
        return {
          title: `Record ${whoseName}'s dues as settled`,
          details: [
            { label: 'Amount', value: cash(club.duesCents) },
            {
              label: 'After this',
              value:
                'The record says a treasurer marked it settled. It is not a receipt for a payment and no payment was taken here.',
            },
          ],
        };
      }

      if (input.actionId === 'book') {
        const roomId = String(input.fields?.room ?? '').trim();
        const when = String(input.fields?.when ?? '').trim();
        const what = String(input.fields?.what ?? '').trim();
        const room = store.room(roomId);
        if (!room) throw new Refusal('No such room on this campus.');
        if (!when || Number.isNaN(new Date(when).getTime())) throw new Refusal('Give the time as an ISO timestamp.');
        if (new Date(when).getTime() <= now.getTime()) throw new Refusal('That time has already passed.');
        if (!what) throw new Refusal('Say what the room is for.');
        freeRoom(store, roomId, new Date(when).toISOString(), club.id);
        return {
          title: `Ask for ${room.name}`,
          details: [
            { label: 'When', value: when },
            { label: 'Holds', value: String(room.holds) },
            { label: 'After this', value: 'The room is yours at that time and no other club can have it.' },
          ],
        };
      }

      throw new Refusal('That is not something a club can do.');
    },
    execute: async (context: AdapterContext, input: ActionInput, key: string) => {
      const done = already(store, key);
      if (done) return done;

      const now = clock();
      const at = now.toISOString();
      const found = find(input.recordId);
      const me = context.identity.userId;

      if ('election' in found) {
        const e = found.election;
        if (input.actionId !== 'vote') throw new Refusal('That is not something an election can do.');
        // Again, because the review reserved nothing — and because the poll
        // may have shut between the two.
        const voter = votable(context, e, now);
        const choice = chosen(e, input);

        /*
         * The two rows, built so that neither can be derived from the other.
         * The paper's id is random; the mark's is the election and the voter,
         * so a second vote collides on the primary key as well as being
         * refused above.
         */
        const mark: Voted = { id: `${e.id}::${voter}`, election: e.id, voter, at };
        const paper: Ballot = { id: randomUUID(), election: e.id, choice };
        store.castVote(mark, paper);

        const receipt: Receipt = {
          id: key,
          status: 'completed',
          /*
           * The receipt cannot say what was voted for, and that is not an
           * oversight to be corrected later. A receipt naming the choice is a
           * receipt somebody can be made to show, which is how a secret ballot
           * stops being one.
           */
          message: `${SANDBOX_MARK} · Your vote in ${e.post} is in the box. It is not recorded against your name and this receipt does not say what it was. No election here decides anything.`,
          recordedAt: at,
        };
        store.keep(receipt);
        return receipt;
      }

      if ('hold' in found) {
        const hold = found.hold;
        if (input.actionId !== 'release-room') throw new Refusal('That is not something a room booking can do.');
        const club = store.club(hold.club);
        if (!club) throw new Refusal('That booking belongs to no club this sandbox knows.');
        officerFor(context, club);
        /*
         * The row goes, rather than being kept with its club blanked. That
         * was the first version and it left the room unbookable: the clash
         * check found a hold, saw a club that was not the one asking, and
         * refused on behalf of nobody at all. A room given back has to be a
         * room somebody else can have, which is the whole meaning of the word.
         */
        store.dropHold(hold.id);
        const receipt: Receipt = {
          id: key,
          status: 'completed',
          message: `${SANDBOX_MARK} · ${store.room(hold.room)?.name ?? hold.room} given back. No room at any real institution changed hands.`,
          recordedAt: at,
        };
        store.keep(receipt);
        return receipt;
      }

      const club = found.club;

      if (input.actionId === 'join') {
        if (!isStudent(context)) throw new Refusal('Only a student can join a club.');
        if (memberOf(store, me, club.id)) throw new Refusal(`You are already a member of ${club.name}.`);
        const name = String(input.fields?.name ?? '').trim();
        if (!name) throw new Refusal('Give the name that goes on the membership list.');
        const row: Member = store.members(club.id).find((m) => m.student === me) ?? {
          id: `${club.id}::${me}`,
          club: club.id,
          student: me,
          name,
          state: 'left',
          duesPaid: false,
          at,
          version: 0,
          history: [],
        };
        return commitMember(store, row, key, me, `Joined ${club.name}`, at, (m) => {
          m.state = 'member';
          m.name = name;
          m.at = at;
        });
      }

      if (input.actionId === 'leave') {
        const row = memberOf(store, me, club.id);
        if (!row) throw new Refusal(`You are not a member of ${club.name}.`);
        return commitMember(store, row, key, me, `Left ${club.name}`, at, (m) => {
          m.state = 'left';
        });
      }

      officerFor(context, club);

      if (input.actionId === 'claim') {
        const what = String(input.fields?.what ?? '').trim();
        if (!what) throw new Refusal('Say what the claim is for.');
        const want = cents(String(input.fields?.amount ?? ''));
        // Again, because the review reserved nothing. This is the check that
        // stops a club promising the same money twice.
        affordable(store, club, want);
        const row: Spend = {
          id: `${club.id}::${key}`,
          club: club.id,
          what: what.slice(0, 200),
          cents: want,
          state: 'approved',
          by: club.officerName,
          at,
          version: 1,
          history: [{ at, who: club.officerName, what: `Approved ${cash(want)} for ${what}`, receipt: key }],
        };
        store.saveSpend(row);
        const receipt: Receipt = {
          id: key,
          status: 'completed',
          message: `${SANDBOX_MARK} · ${cash(want)} recorded against the ${club.name} grant for ${what}. No money moved and nothing was paid to anybody.`,
          recordedAt: at,
        };
        store.keep(receipt);
        return receipt;
      }

      if (input.actionId === 'settle') {
        if (club.duesCents === 0) throw new Refusal(`${club.name} does not charge dues.`);
        const whoseName = String(input.fields?.who ?? '').trim();
        if (!whoseName) throw new Refusal('Name the member.');
        const row = memberOf(store, whoseName, club.id);
        if (!row) throw new Refusal(`${whoseName} is not a member of ${club.name}.`);
        if (row.duesPaid) throw new Refusal(`${whoseName} is already recorded as settled.`);
        return commitMember(store, row, key, club.officerName, `Dues recorded as settled by the treasurer`, at, (m) => {
          m.duesPaid = true;
        });
      }

      if (input.actionId === 'book') {
        const roomId = String(input.fields?.room ?? '').trim();
        const when = String(input.fields?.when ?? '').trim();
        const what = String(input.fields?.what ?? '').trim();
        const room = store.room(roomId);
        if (!room) throw new Refusal('No such room on this campus.');
        if (!when || Number.isNaN(new Date(when).getTime())) throw new Refusal('Give the time as an ISO timestamp.');
        if (new Date(when).getTime() <= now.getTime()) throw new Refusal('That time has already passed.');
        if (!what) throw new Refusal('Say what the room is for.');
        const stamp = new Date(when).toISOString();
        // Again. This is the check that gives the room to one club.
        freeRoom(store, roomId, stamp, club.id);
        const row: RoomHold = {
          id: `${roomId}::${stamp}`,
          room: roomId,
          club: club.id,
          when: stamp,
          what: what.slice(0, 200),
          holds: room.holds,
          at,
          version: 1,
          history: [{ at, who: club.officerName, what: `Room held for ${what}`, receipt: key }],
        };
        store.saveHold(row);
        const receipt: Receipt = {
          id: key,
          status: 'completed',
          message: `${SANDBOX_MARK} · ${room.name} held for ${club.name}. No room at any real institution was booked.`,
          recordedAt: at,
        };
        store.keep(receipt);
        return receipt;
      }

      throw new Refusal('That is not something a club can do.');
    },
  };
  return adapter;
}
