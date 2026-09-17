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
  type Booking,
  type Mentor,
  type Mentorship,
  type SandboxStore,
  type Slot,
} from './sandbox.ts';

/**
 * Advising appointments and the alumni network, against the sandbox, as a
 * labelled demonstration.
 *
 * `career.ts` carries the Phase 4 warning in full and it applies unchanged
 * here: **no adviser holds any of these appointments and no alumnus named
 * here exists.** Nothing is in anybody's diary.
 *
 * ## Advising: the half-hour is the finite thing
 *
 * Which makes it registration again, and it is built the same way — the taken
 * count is derived from the bookings rather than stored on the slot, the
 * check is made at review and again at the write, and the review reserves
 * nothing. Two refusals are this area's own rather than registration's:
 *
 *   **The past.** A slot whose time has gone cannot be booked, and the sandbox
 *   carries one so a person can walk into it rather than only a test.
 *
 *   **The day before.** Cancelling inside twenty-four hours is refused, and
 *   the refusal says why rather than only that: a slot given back too late
 *   cannot be re-offered, so it is not given back at all, it is wasted. That
 *   is a real advising office's rule and the reason for it is the only part
 *   worth putting on a screen.
 *
 * A clash check too, because somebody booked at ten cannot also be booked at
 * ten, and a diary that records both has produced a row that cannot be true.
 *
 * ## Alumni: the address is the whole of it
 *
 * A mentor's contact address is on the stored row and is **not** on the
 * record a student reads until the mentorship is accepted. Not redacted, not
 * behind a flag — absent. `career.test.ts` asserts it by reading the record as
 * a student with a pending request and searching every detail on it for the
 * address, which is the only form of that test that cannot be satisfied by a
 * lock somebody later works around.
 *
 * The finite thing here is the mentor's willingness, as a number of students
 * they will take at once, counted from the accepted mentorships. A mentor at
 * capacity refuses, and says so in a way that is about them rather than about
 * the person asking.
 */

/* ── Advising ───────────────────────────────────────────────────────────── */

/** How many of a slot's places are held, counted rather than stored. */
export const held = (store: SandboxStore, slot: string): number =>
  store.bookings(slot).filter((b) => b.state === 'booked').length;

/** Whether this slot's time has gone. */
export const gone = (slot: Slot, now: Date) => new Date(slot.when).getTime() <= now.getTime();

/** How long until it, in hours, which is what the cancel window is about. */
export const hoursTo = (slot: Slot, now: Date) => (new Date(slot.when).getTime() - now.getTime()) / 3_600_000;

/** The window inside which a slot cannot be given back in time to be reused. */
export const CANCEL_WINDOW_HOURS = 24;

const bookingOf = (store: SandboxStore, student: string, slot: string): Booking | null =>
  store.bookings(slot).find((b) => b.student === student) ?? null;

const readable = (at: string) => `${at.slice(0, 10)} at ${at.slice(11, 16)} UTC`;

export function slotRecord(store: SandboxStore, slot: Slot, context: AdapterContext, now: Date): UniversityRecord {
  const me = context.identity.userId;
  const taken = held(store, slot.id);
  const left = Math.max(0, slot.seats - taken);
  const ours = bookingOf(store, me, slot.id);
  const past = gone(slot, now);
  const booked = ours?.state === 'booked';

  const state = booked ? 'Booked' : past ? 'Gone' : left > 0 ? `${left} of ${slot.seats} free` : 'Full';

  return {
    id: slot.id,
    area: 'advising',
    title: `${SANDBOX_MARK} · ${slot.adviser} — ${readable(slot.when)}`,
    summary: `${slot.about} · ${slot.minutes} minutes · ${slot.where}`,
    status: state,
    version: `${taken}:${ours?.version ?? 0}`,
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Adviser', value: slot.adviser },
      { label: 'About', value: slot.about },
      { label: 'When', value: readable(slot.when) },
      { label: 'How long', value: `${slot.minutes} minutes` },
      { label: 'Where', value: slot.where },
      { label: 'Places', value: `${taken} of ${slot.seats} taken` },
      /*
       * Only ever this person's own note. An adviser's diary in a real system
       * shows them everybody's; this demonstration has no adviser session, and
       * inventing one to disclose through would be inventing the disclosure.
       */
      ...(ours ? [{ label: 'You said', value: ours.about || '(nothing)' }] : []),
      ...(booked && !past
        ? [
            {
              label: 'Cancelling',
              value:
                hoursTo(slot, now) < CANCEL_WINDOW_HOURS
                  ? `Less than ${CANCEL_WINDOW_HOURS} hours away — telephone the office instead.`
                  : `Until ${CANCEL_WINDOW_HOURS} hours before it.`,
            },
          ]
        : []),
      ...(ours?.history ?? []).map((h) => ({ label: h.at.slice(0, 16).replace('T', ' '), value: `${h.what} — ${h.who}` })),
    ],
    dates: [{ at: slot.when, what: `${slot.adviser} — advising appointment` }],
    actions: past
      ? []
      : booked
        ? [{ id: 'cancel', label: 'Cancel this appointment', fields: [] }]
        : left > 0
          ? [{ id: 'book', label: 'Book this appointment', fields: [{ id: 'about', label: 'What you want to talk about', kind: 'text' as const, required: false }] }]
          : [],
  };
}

/** The place check, made at review and again at the write. */
function placeFor(store: SandboxStore, slot: Slot): void {
  if (slot.seats - held(store, slot.id) <= 0) {
    throw new Refusal(`${slot.adviser} at ${readable(slot.when)} was taken while you were reading.`);
  }
}

function bookable(store: SandboxStore, context: AdapterContext, slot: Slot, now: Date): void {
  if (!isStudent(context)) throw new Refusal('Only a student can book their own advising appointment.');
  if (gone(slot, now)) throw new Refusal(`That appointment was at ${readable(slot.when)} and has gone.`);

  const ours = bookingOf(store, context.identity.userId, slot.id);
  if (ours?.state === 'booked') throw new Refusal('You are already booked into that one.');

  /*
   * A clash, against what this person already holds. Compared on the start
   * time rather than on an overlap of ranges, which is the honest shape for a
   * diary of fixed slots and is worth saying because an overlap check is what
   * somebody will reach for when the slots stop being fixed.
   */
  for (const b of store.bookingsOf(context.identity.userId)) {
    if (b.state !== 'booked' || b.slot === slot.id) continue;
    const other = store.slot(b.slot);
    if (other && other.when === slot.when) {
      throw new Refusal(`That clashes with ${other.adviser} at the same time.`);
    }
  }
}

const commitBooking = (
  store: SandboxStore,
  row: Booking,
  key: string,
  who: string,
  what: string,
  at: string,
  change: (b: Booking) => void,
): Receipt => {
  change(row);
  row.version += 1;
  row.history.push({ at, who, what, receipt: key });
  store.saveBooking(row);
  const receipt: Receipt = {
    id: key,
    status: 'completed',
    message: `${SANDBOX_MARK} · ${what}. No adviser anywhere holds this time.`,
    recordedAt: at,
  };
  store.keep(receipt);
  return receipt;
};

export function advisingAdapter(store: SandboxStore, clock: () => Date = () => new Date()): InstitutionAdapter {
  const slotOr = (id: string): Slot => {
    const row = store.slot(id);
    if (!row) throw new Refusal('No such appointment in the sandbox diary.');
    return row;
  };

  const adapter: InstitutionAdapter = {
    area: 'advising',
    institutionId: SANDBOX_INSTITUTION,
    status: async (context) => connection('advising', context, isStudent(context)),
    list: async (context, query) => {
      const now = clock();
      return page(matching(store.slots().map((s) => slotRecord(store, s, context, now)), query.search));
    },
    get: async (context, id) => {
      const row = store.slot(id);
      return row ? slotRecord(store, row, context, clock()) : null;
    },
    review: async (context, input) => {
      const now = clock();
      const slot = slotOr(input.recordId);

      if (input.actionId === 'book') {
        bookable(store, context, slot, now);
        placeFor(store, slot);
        return {
          title: `Book ${slot.adviser} at ${readable(slot.when)}`,
          details: [
            { label: 'About', value: slot.about },
            { label: 'Where', value: slot.where },
            { label: 'How long', value: `${slot.minutes} minutes` },
            { label: 'Places left now', value: String(slot.seats - held(store, slot.id)) },
            {
              label: 'After this',
              value: `Yours. You can cancel up to ${CANCEL_WINDOW_HOURS} hours before it.`,
            },
          ],
        };
      }

      if (input.actionId === 'cancel') {
        const ours = bookingOf(store, context.identity.userId, slot.id);
        if (!ours || ours.state !== 'booked') throw new Refusal('You are not booked into that one.');
        if (gone(slot, now)) throw new Refusal('That appointment has already happened.');
        if (hoursTo(slot, now) < CANCEL_WINDOW_HOURS) {
          throw new Refusal(
            `That is less than ${CANCEL_WINDOW_HOURS} hours away. A place given back this late cannot be offered to anybody else in time, so the office asks you to telephone instead of cancelling here.`,
          );
        }
        return {
          title: `Cancel ${slot.adviser} at ${readable(slot.when)}`,
          details: [
            { label: 'Booked', value: ours.at.slice(0, 10) },
            { label: 'After this', value: 'The place goes back and somebody else can take it.' },
          ],
        };
      }
      throw new Refusal('That is not something an appointment can do.');
    },
    execute: async (context: AdapterContext, input: ActionInput, key: string) => {
      const done = already(store, key);
      if (done) return done;

      const now = clock();
      const at = now.toISOString();
      const slot = slotOr(input.recordId);
      const me = context.identity.userId;

      if (input.actionId === 'book') {
        bookable(store, context, slot, now);
        // Again: the review reserved nothing, and this is where one person
        // gets the half-hour.
        placeFor(store, slot);
        const row: Booking = bookingOf(store, me, slot.id) ?? {
          id: `${slot.id}::${me}`,
          slot: slot.id,
          student: me,
          state: 'cancelled',
          about: '',
          at,
          version: 0,
          history: [],
        };
        return commitBooking(store, row, key, me, `Booked ${slot.adviser} at ${readable(slot.when)}`, at, (b) => {
          b.state = 'booked';
          b.about = String(input.fields?.about ?? '').slice(0, 300);
          b.at = at;
        });
      }

      if (input.actionId === 'cancel') {
        if (!isStudent(context)) throw new Refusal('Only a student can cancel their own advising appointment.');
        const row = bookingOf(store, me, slot.id);
        if (!row || row.state !== 'booked') throw new Refusal('You are not booked into that one.');
        if (gone(slot, now)) throw new Refusal('That appointment has already happened.');
        if (hoursTo(slot, now) < CANCEL_WINDOW_HOURS) {
          throw new Refusal(
            `That is less than ${CANCEL_WINDOW_HOURS} hours away. A place given back this late cannot be offered to anybody else in time, so the office asks you to telephone instead of cancelling here.`,
          );
        }
        return commitBooking(store, row, key, me, `Cancelled ${slot.adviser} at ${readable(slot.when)}`, at, (b) => {
          b.state = 'cancelled';
        });
      }
      throw new Refusal('That is not something an appointment can do.');
    },
  };
  return adapter;
}

/* ── Alumni ─────────────────────────────────────────────────────────────── */

/** How many students this mentor currently has, counted from the accepted. */
export const mentoring = (store: SandboxStore, mentor: string): number =>
  store.mentorships(mentor).filter((m) => m.state === 'accepted').length;

const askOf = (store: SandboxStore, student: string, mentor: string): Mentorship | null =>
  store.mentorships(mentor).find((m) => m.student === student) ?? null;

/**
 * Whether this person may read this mentor's contact address.
 *
 * One function, asked in one place, because the second place that decided the
 * same thing is the place that comes to decide it differently. It is true for
 * the mentor themselves and for a student whose mentorship is *accepted*, and
 * for nobody else — an asked-and-not-yet-answered request discloses nothing,
 * which is the point of the whole area.
 */
export function mayReadAddress(store: SandboxStore, mentor: Mentor, reader: string): boolean {
  if (mentor.id === reader) return true;
  return askOf(store, reader, mentor.id)?.state === 'accepted';
}

export function mentorRecord(store: SandboxStore, mentor: Mentor, context: AdapterContext): UniversityRecord {
  const me = context.identity.userId;
  const ours = askOf(store, me, mentor.id);
  const taken = mentoring(store, mentor.id);
  const room = Math.max(0, mentor.capacity - taken);
  const iAm = mentor.id === me;
  const open = mayReadAddress(store, mentor, me);

  const state = iAm
    ? `${taken} of ${mentor.capacity} · ${store.mentorships(mentor.id).filter((m) => m.state === 'asked').length} waiting on you`
    : ours?.state === 'accepted'
      ? 'Mentoring you'
      : ours?.state === 'asked'
        ? 'You have asked'
        : ours?.state === 'declined'
          ? 'Declined'
          : ours?.state === 'ended'
            ? 'Ended'
            : !mentor.open
              ? 'Not taking requests'
              : room > 0
                ? `${room} place${room === 1 ? '' : 's'}`
                : 'At capacity';

  return {
    id: mentor.id,
    area: 'alumni',
    title: `${SANDBOX_MARK} · ${mentor.name} — ${mentor.field}`,
    summary: `Class of ${mentor.classOf} · ${mentor.works}`,
    status: state,
    version: `${taken}:${ours?.version ?? 0}`,
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Class of', value: mentor.classOf },
      { label: 'Field', value: mentor.field },
      { label: 'Now', value: mentor.works },
      { label: 'Taking', value: mentor.open ? `up to ${mentor.capacity} students` : 'nobody just now' },
      /*
       * The address, and only for somebody entitled to it. This is an
       * absence and not a redaction: there is no "hidden" line, because a
       * line saying an address exists is most of what an address discloses.
       * `career.test.ts` reads every detail on this record as a student with
       * a pending ask and asserts none of them contains it.
       */
      ...(open ? [{ label: 'Write to', value: mentor.email }] : []),
      /* The mentor's own view of who is waiting, and nobody else's. */
      ...(iAm
        ? store
            .mentorships(mentor.id)
            .filter((m) => m.state === 'asked' || m.state === 'accepted')
            .map((m) => ({ label: m.student, value: `${m.state}${m.why ? ` — ${m.why}` : ''}` }))
        : []),
      ...(ours
        ? [
            { label: 'You', value: ours.state },
            ...ours.history.map((h) => ({ label: h.at.slice(0, 16).replace('T', ' '), value: `${h.what} — ${h.who}` })),
          ]
        : []),
    ],
    actions: iAm
      ? [
          { id: 'accept', label: 'Accept a request', fields: [{ id: 'who', label: 'Student', kind: 'text' as const, required: true }] },
          { id: 'decline', label: 'Decline a request', fields: [{ id: 'who', label: 'Student', kind: 'text' as const, required: true }] },
        ]
      : ours?.state === 'accepted'
        ? [{ id: 'end', label: 'End this mentorship', fields: [] }]
        : ours
          ? []
          : mentor.open && room > 0
            ? [{ id: 'ask', label: 'Ask them to mentor you', fields: [{ id: 'why', label: 'Why you are asking', kind: 'text' as const, required: true }] }]
            : [],
  };
}

const commitAsk = (
  store: SandboxStore,
  row: Mentorship,
  key: string,
  who: string,
  what: string,
  at: string,
  change: (m: Mentorship) => void,
): Receipt => {
  change(row);
  row.version += 1;
  row.history.push({ at, who, what, receipt: key });
  store.saveMentorship(row);
  const receipt: Receipt = {
    id: key,
    status: 'completed',
    message: `${SANDBOX_MARK} · ${what}. Nobody named here is a real graduate of anywhere.`,
    recordedAt: at,
  };
  store.keep(receipt);
  return receipt;
};

export function alumniAdapter(store: SandboxStore, clock: () => Date = () => new Date()): InstitutionAdapter {
  const mentorOr = (id: string): Mentor => {
    const row = store.mentor(id);
    if (!row) throw new Refusal('Nobody by that name is in the sandbox alumni network.');
    return row;
  };

  /** Room for one more, checked at review and again at the write. */
  const roomFor = (mentor: Mentor): void => {
    if (mentoring(store, mentor.id) >= mentor.capacity) {
      throw new Refusal(
        `${mentor.name} is mentoring ${mentor.capacity} student${mentor.capacity === 1 ? '' : 's'} already, which is as many as they said they could.`,
      );
    }
  };

  const askable = (context: AdapterContext, mentor: Mentor): void => {
    if (!isStudent(context)) throw new Refusal('Only a student can ask for a mentor.');
    if (!mentor.open) throw new Refusal(`${mentor.name} is not taking requests just now.`);
    const ours = askOf(store, context.identity.userId, mentor.id);
    if (ours?.state === 'asked') throw new Refusal(`You asked ${mentor.name} on ${ours.at.slice(0, 10)} and they have not answered yet.`);
    if (ours?.state === 'accepted') throw new Refusal(`${mentor.name} is already mentoring you.`);
    if (ours?.state === 'declined') throw new Refusal(`${mentor.name} declined on ${ours.at.slice(0, 10)}. Asking again is not something this network does for you.`);
    if (ours?.state === 'ended') throw new Refusal(`That mentorship ended on ${ours.at.slice(0, 10)}. Write to them directly if you want to pick it up.`);
    roomFor(mentor);
  };

  /** A request this caller, as the mentor, may answer. */
  const waiting = (context: AdapterContext, mentor: Mentor, who: string): Mentorship => {
    if (mentor.id !== context.identity.userId) {
      throw new Refusal('Only the alumnus themselves can answer a request made to them.');
    }
    const row = askOf(store, who, mentor.id);
    if (!row) throw new Refusal('Nobody by that name has asked you.');
    if (row.state !== 'asked') throw new Refusal(`That request is already ${row.state}.`);
    return row;
  };

  const adapter: InstitutionAdapter = {
    area: 'alumni',
    institutionId: SANDBOX_INSTITUTION,
    status: async (context) => connection('alumni', context, isStudent(context) || store.mentor(context.identity.userId) !== null),
    list: async (context, query) => page(matching(store.mentors().map((m) => mentorRecord(store, m, context)), query.search)),
    get: async (context, id) => {
      const row = store.mentor(id);
      return row ? mentorRecord(store, row, context) : null;
    },
    review: async (context, input) => {
      const mentor = mentorOr(input.recordId);
      const me = context.identity.userId;

      if (input.actionId === 'ask') {
        askable(context, mentor);
        if (!String(input.fields?.why ?? '').trim()) throw new Refusal('Say why you are asking. It is what they answer on.');
        return {
          title: `Ask ${mentor.name} to mentor you`,
          details: [
            { label: 'They work in', value: mentor.works },
            { label: 'Places left', value: String(mentor.capacity - mentoring(store, mentor.id)) },
            {
              label: 'After this',
              value: 'They see your name and what you wrote. You see nothing of theirs until they say yes.',
            },
          ],
        };
      }

      if (input.actionId === 'end') {
        const ours = askOf(store, me, mentor.id);
        if (ours?.state !== 'accepted') throw new Refusal(`${mentor.name} is not mentoring you.`);
        return {
          title: `End the mentorship with ${mentor.name}`,
          details: [
            { label: 'Since', value: ours.at.slice(0, 10) },
            { label: 'After this', value: 'Their place comes back, and their address comes off your record.' },
          ],
        };
      }

      /*
       * Both of the two below name a student, so the name is read once — but
       * an unknown action has to be refused before that read. Falling through
       * told somebody who typed a wrong action that they had left a field out,
       * which is one message doing two jobs.
       */
      if (input.actionId !== 'accept' && input.actionId !== 'decline') {
        throw new Refusal('That is not something a mentor record can do.');
      }
      const who = String(input.fields?.who ?? '').trim();
      if (!who) throw new Refusal('Name the student.');
      const row = waiting(context, mentor, who);

      if (input.actionId === 'accept') {
        roomFor(mentor);
        return {
          title: `Accept ${who}`,
          details: [
            { label: 'They wrote', value: row.why },
            { label: 'Places left after this', value: String(mentor.capacity - mentoring(store, mentor.id) - 1) },
            { label: 'After this', value: 'They can see your contact address. That is what accepting means here.' },
          ],
        };
      }
      if (input.actionId === 'decline') {
        return {
          title: `Decline ${who}`,
          details: [
            { label: 'They wrote', value: row.why },
            { label: 'After this', value: 'They are told. Your address stays off their record.' },
          ],
        };
      }
      throw new Refusal('That is not something a mentor record can do.');
    },
    execute: async (context: AdapterContext, input: ActionInput, key: string) => {
      const done = already(store, key);
      if (done) return done;

      const at = clock().toISOString();
      const mentor = mentorOr(input.recordId);
      const me = context.identity.userId;

      if (input.actionId === 'ask') {
        askable(context, mentor);
        const why = String(input.fields?.why ?? '').trim();
        if (!why) throw new Refusal('Say why you are asking. It is what they answer on.');
        const row: Mentorship = {
          id: `${mentor.id}::${me}`,
          mentor: mentor.id,
          student: me,
          state: 'asked',
          why: why.slice(0, 500),
          at,
          version: 0,
          history: [],
        };
        return commitAsk(store, row, key, me, `Asked ${mentor.name} to mentor you`, at, () => {});
      }

      if (input.actionId === 'end') {
        const row = askOf(store, me, mentor.id);
        if (row?.state !== 'accepted') throw new Refusal(`${mentor.name} is not mentoring you.`);
        return commitAsk(store, row, key, me, `Ended the mentorship with ${mentor.name}`, at, (m) => {
          m.state = 'ended';
        });
      }

      // Same guard as the review's, and for the same reason.
      if (input.actionId !== 'accept' && input.actionId !== 'decline') {
        throw new Refusal('That is not something a mentor record can do.');
      }
      const who = String(input.fields?.who ?? '').trim();
      if (!who) throw new Refusal('Name the student.');
      const row = waiting(context, mentor, who);

      if (input.actionId === 'accept') {
        // Again, because the review reserved nothing: a mentor answering two
        // requests with one place left gives it to one of them.
        roomFor(mentor);
        return commitAsk(store, row, key, mentor.name, `${mentor.name} accepted`, at, (m) => {
          m.state = 'accepted';
        });
      }
      if (input.actionId === 'decline') {
        return commitAsk(store, row, key, mentor.name, `${mentor.name} declined`, at, (m) => {
          m.state = 'declined';
        });
      }
      throw new Refusal('That is not something a mentor record can do.');
    },
  };
  return adapter;
}
