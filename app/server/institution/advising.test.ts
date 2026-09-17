import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SANDBOX_INSTITUTION, SANDBOX_MARK, SandboxStore } from './sandbox.ts';
import {
  CANCEL_WINDOW_HOURS,
  advisingAdapter,
  alumniAdapter,
  gone,
  held,
  hoursTo,
  mayReadAddress,
  mentoring,
} from './advising.ts';
import type { AdapterContext, InstitutionAdapter } from './adapter.ts';
import type { ActionInput, UniversityArea, UniversityRole } from '../../../packages/institution/src/index.ts';

/**
 * Advising, and the alumni network, and the one sentence each is really about.
 *
 * Advising's is the half-hour: one person can have it, so every test that
 * matters is about two people wanting the same one, or about somebody trying
 * to give one back too late for it to be any use to anybody.
 *
 * The alumni network's is the address. It is on the stored row and not on the
 * record until the mentorship is accepted, and the tests for that read the
 * *whole serialised record* looking for the address rather than checking a
 * flag — with a control that reads it as somebody entitled and asserts it is
 * there, because a search for an absence passes just as well against a record
 * that came back empty.
 *
 * Phase 4's gates are not satisfied by any of this and nothing here says they
 * are: no adviser holds these appointments and no alumnus named here exists.
 */

let dir = '';
let store: SandboxStore;
let advising: InstitutionAdapter;
let alumni: InstitutionAdapter;
let today = new Date('2026-09-20T12:00:00.000Z');

const who = (userId: string, ...roles: UniversityRole[]): AdapterContext => ({
  identity: { userId, institutionId: SANDBOX_INSTITUTION, roles },
  signal: new AbortController().signal,
});

const act = (area: UniversityArea, recordId: string, actionId: string, fields: Record<string, string> = {}): ActionInput => ({
  area,
  recordId,
  version: '0',
  actionId,
  fields,
});

const student = (n = 1) => who(`student-${n}`, 'student');

const FREE = 'career-thu-1000';
const NEXT = 'career-thu-1030';
const GROUP = 'grad-school-panel';
const PAST = 'career-past-slot';

let keys = 0;
const nextKey = () => `k${++keys}`;

async function book(context: AdapterContext, slot = FREE, about = 'my CV') {
  const input = act('advising', slot, 'book', { about });
  await advising.review(context, input);
  return advising.execute(context, input, nextKey());
}

async function cancel(context: AdapterContext, slot = FREE) {
  const input = act('advising', slot, 'cancel');
  await advising.review(context, input);
  return advising.execute(context, input, nextKey());
}

async function ask(context: AdapterContext, mentor: string, why = 'I want to work in policy') {
  const input = act('alumni', mentor, 'ask', { why });
  await alumni.review(context, input);
  return alumni.execute(context, input, nextKey());
}

async function answer(mentor: string, actionId: string, applicant: string) {
  const input = act('alumni', mentor, actionId, { who: applicant });
  const asMentor = who(mentor, 'staff');
  await alumni.review(asMentor, input);
  return alumni.execute(asMentor, input, nextKey());
}

/** Everything a record actually carries, for the absence tests. */
const everything = async (a: InstitutionAdapter, context: AdapterContext, id: string) =>
  JSON.stringify((await a.get(context, id)) ?? {});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'advising-'));
  store = new SandboxStore(join(dir, 'sandbox.sqlite'));
  today = new Date('2026-09-20T12:00:00.000Z');
  advising = advisingAdapter(store, () => today);
  alumni = alumniAdapter(store, () => today);
  keys = 0;
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

/* ── Advising ───────────────────────────────────────────────────────────── */

describe('the diary the sandbox opens with', () => {
  it('lists every slot, and every one of them says SANDBOX', async () => {
    const got = await advising.list(student(), { search: '', cursor: null });
    expect(got.records.length).toBeGreaterThan(0);
    for (const r of got.records) expect(r.title.startsWith(`${SANDBOX_MARK} · `)).toBe(true);
  });

  it('carries one slot already in the past, so that refusal is walkable', () => {
    expect(gone(store.slot(PAST)!, today)).toBe(true);
  });

  it('and a group session, so the seat count is not secretly a boolean', () => {
    expect(store.slot(GROUP)!.seats).toBeGreaterThan(1);
  });

  it('says it is a sandbox in its connection status', async () => {
    const status = await advising.status(student());
    expect(status.provider).toContain(SANDBOX_MARK);
    expect(status.canWrite).toBe(true);
  });
});

describe('booking', () => {
  it('works, and the receipt says no adviser holds the time', async () => {
    const receipt = await book(student());
    expect(receipt.status).toBe('completed');
    expect(receipt.message).toContain(SANDBOX_MARK);
    expect(receipt.message).toMatch(/no adviser anywhere/i);
  });

  it('takes the place, counted rather than stored', async () => {
    expect(held(store, FREE)).toBe(0);
    await book(student());
    expect(held(store, FREE)).toBe(1);
  });

  it('is refused for a slot whose time has gone', async () => {
    await expect(book(student(), PAST)).rejects.toThrow(/has gone/);
  });

  it('is refused when the place is taken', async () => {
    await book(student(1));
    await expect(book(student(2))).rejects.toThrow(/taken while you were reading/);
  });

  it('is refused at the review, so the student is told before they commit', async () => {
    /*
     * Separately from the commit check below, and for the reason spelled out
     * in `career.test.ts`: removing the review's own call left this suite
     * green, because the commit caught it. A review that says a place is
     * free, followed by a commit that says it is not, is the exact failure
     * two-phase actions exist to avoid.
     */
    await book(student(1));
    await expect(advising.review(student(2), act('advising', FREE, 'book', { about: 'b' }))).rejects.toThrow(
      /taken while you were reading/,
    );
  });

  it('is refused at the commit even when the review passed', async () => {
    const first = act('advising', FREE, 'book', { about: 'a' });
    const second = act('advising', FREE, 'book', { about: 'b' });
    await advising.review(student(1), first);
    await advising.review(student(2), second);
    await advising.execute(student(1), first, nextKey());
    await expect(advising.execute(student(2), second, nextKey())).rejects.toThrow(/taken while you were reading/);
  });

  it('is refused twice into the same slot', async () => {
    await book(student());
    await expect(book(student())).rejects.toThrow(/already booked into that one/);
  });

  it('is refused when it clashes with something already held', async () => {
    // A second adviser at the same moment as the first.
    const clashing = { ...store.slot(NEXT)!, id: 'other-adviser-same-time', adviser: 'Dr Someone' };
    clashing.when = store.slot(FREE)!.when;
    store.saveSlot(clashing);
    await book(student());
    await expect(book(student(), 'other-adviser-same-time')).rejects.toThrow(/clashes with/);
  });

  it('but a different time with a different adviser is fine', async () => {
    await book(student(), FREE);
    await book(student(), NEXT);
    expect(store.bookingsOf('student-1').filter((b) => b.state === 'booked').length).toBe(2);
  });

  it('lets several people into a group session', async () => {
    await book(student(1), GROUP);
    await book(student(2), GROUP);
    await book(student(3), GROUP);
    expect(held(store, GROUP)).toBe(3);
  });

  it('is refused by somebody who is not a student', async () => {
    await expect(book(who('staffer', 'staff'))).rejects.toThrow(/Only a student can book/);
  });

  it('is refused for a slot that does not exist', async () => {
    await expect(book(student(), 'no-such-slot')).rejects.toThrow(/No such appointment/);
  });
});

describe('cancelling, and the day before', () => {
  it('works with more than the window to go, and gives the place back', async () => {
    await book(student());
    await cancel(student());
    expect(held(store, FREE)).toBe(0);
  });

  it('and somebody else can then take it', async () => {
    await book(student(1));
    await cancel(student(1));
    await book(student(2));
    expect(store.bookings(FREE).filter((b) => b.state === 'booked')[0]?.student).toBe('student-2');
  });

  it('is refused inside the window, and the refusal says why rather than only that', async () => {
    await book(student());
    // Four hours before it.
    today = new Date(new Date(store.slot(FREE)!.when).getTime() - 4 * 3_600_000);
    await expect(cancel(student())).rejects.toThrow(/cannot be offered to anybody else in time/);
  });

  it('and the boundary itself is on the allowed side', async () => {
    await book(student());
    today = new Date(new Date(store.slot(FREE)!.when).getTime() - CANCEL_WINDOW_HOURS * 3_600_000);
    await expect(cancel(student())).resolves.toBeTruthy();
  });

  it('a minute inside it is not', async () => {
    await book(student());
    today = new Date(new Date(store.slot(FREE)!.when).getTime() - CANCEL_WINDOW_HOURS * 3_600_000 + 60_000);
    await expect(cancel(student())).rejects.toThrow(/telephone/);
  });

  it('is refused for an appointment that has already happened', async () => {
    await book(student());
    today = new Date(new Date(store.slot(FREE)!.when).getTime() + 3_600_000);
    await expect(cancel(student())).rejects.toThrow(/already happened/);
  });

  it('is refused when this person is not booked into it', async () => {
    await book(student(1));
    await expect(cancel(student(2))).rejects.toThrow(/not booked into that one/);
  });

  it('is refused twice', async () => {
    await book(student());
    await cancel(student());
    await expect(cancel(student())).rejects.toThrow(/not booked into that one/);
  });

  it('is refused at the commit too, not only at the review', async () => {
    await book(student());
    const input = act('advising', FREE, 'cancel');
    await advising.review(student(), input);
    today = new Date(new Date(store.slot(FREE)!.when).getTime() - 1_000);
    await expect(advising.execute(student(), input, nextKey())).rejects.toThrow(/telephone/);
  });
});

describe('what an advising record says', () => {
  it('shows this person their own note and nobody else’s', async () => {
    await book(student(1), GROUP, 'my own private worry');
    await book(student(2), GROUP, 'something else entirely');
    const said = await everything(advising, student(1), GROUP);
    expect(said).toContain('my own private worry');
    expect(said, 'another student’s note was readable').not.toContain('something else entirely');
  });

  it('offers no action at all on a slot that has gone', async () => {
    expect((await advising.get(student(), PAST))?.actions ?? []).toEqual([]);
  });

  it('carries the appointment as a date, not only as a sentence', async () => {
    const r = await advising.get(student(), FREE);
    expect(r?.dates?.[0]?.at).toBe(store.slot(FREE)!.when);
  });

  it('returns the same receipt for a retried key rather than booking twice', async () => {
    const input = act('advising', FREE, 'book', { about: 'once' });
    await advising.review(student(), input);
    const first = await advising.execute(student(), input, 'same-key');
    const again = await advising.execute(student(), input, 'same-key');
    expect(again).toEqual(first);
    expect(held(store, FREE)).toBe(1);
  });

  it('refuses an action an appointment does not have', async () => {
    await expect(advising.review(student(), act('advising', FREE, 'reschedule'))).rejects.toThrow(
      /not something an appointment can do/,
    );
  });

  it('hoursTo is what the window is measured with, and it is signed', () => {
    const slot = store.slot(FREE)!;
    expect(hoursTo(slot, new Date(new Date(slot.when).getTime() - 3_600_000))).toBeCloseTo(1, 5);
    expect(hoursTo(slot, new Date(new Date(slot.when).getTime() + 3_600_000))).toBeCloseTo(-1, 5);
  });
});

/* ── Alumni ─────────────────────────────────────────────────────────────── */

const WHITFIELD = 'a-whitfield';
const PARK = 'j-park';
const CLOSED = 'r-santos';

describe('the alumni network the sandbox opens with', () => {
  it('lists everybody, marked, and one of them not taking requests', async () => {
    const got = await alumni.list(student(), { search: '', cursor: null });
    expect(got.records.length).toBeGreaterThan(0);
    for (const r of got.records) expect(r.title.startsWith(`${SANDBOX_MARK} · `)).toBe(true);
    expect(store.mentor(CLOSED)!.open).toBe(false);
  });
});

describe('the address, which is the whole of this area', () => {
  it('is not on the record before anybody has asked', async () => {
    const said = await everything(alumni, student(), WHITFIELD);
    expect(said).not.toContain(store.mentor(WHITFIELD)!.email);
  });

  it('is still not on it once the request is made and not yet answered', async () => {
    await ask(student(), WHITFIELD);
    const said = await everything(alumni, student(), WHITFIELD);
    expect(said, 'asking was enough to disclose the address').not.toContain(store.mentor(WHITFIELD)!.email);
    // The control: the record is not empty — this person's own state is on it.
    expect(said).toContain('asked');
  });

  it('is on it once they accept — which is the control for every absence above', async () => {
    await ask(student(), WHITFIELD);
    await answer(WHITFIELD, 'accept', 'student-1');
    expect(await everything(alumni, student(), WHITFIELD)).toContain(store.mentor(WHITFIELD)!.email);
  });

  it('comes off again when the mentorship ends', async () => {
    await ask(student(), WHITFIELD);
    await answer(WHITFIELD, 'accept', 'student-1');
    const input = act('alumni', WHITFIELD, 'end');
    await alumni.review(student(), input);
    await alumni.execute(student(), input, nextKey());
    expect(await everything(alumni, student(), WHITFIELD)).not.toContain(store.mentor(WHITFIELD)!.email);
  });

  it('is never on it for a student whose request was declined', async () => {
    await ask(student(), WHITFIELD);
    await answer(WHITFIELD, 'decline', 'student-1');
    expect(await everything(alumni, student(), WHITFIELD)).not.toContain(store.mentor(WHITFIELD)!.email);
  });

  it('is not on it for a third party, whatever anybody else was granted', async () => {
    await ask(student(1), WHITFIELD);
    await answer(WHITFIELD, 'accept', 'student-1');
    expect(await everything(alumni, student(2), WHITFIELD)).not.toContain(store.mentor(WHITFIELD)!.email);
  });

  it('and mayReadAddress, asked directly, agrees with all of that', async () => {
    const m = store.mentor(WHITFIELD)!;
    expect(mayReadAddress(store, m, 'student-1')).toBe(false);
    await ask(student(1), WHITFIELD);
    expect(mayReadAddress(store, m, 'student-1')).toBe(false);
    await answer(WHITFIELD, 'accept', 'student-1');
    expect(mayReadAddress(store, m, 'student-1')).toBe(true);
    expect(mayReadAddress(store, m, 'student-2')).toBe(false);
    // And the mentor themselves, always.
    expect(mayReadAddress(store, m, WHITFIELD)).toBe(true);
  });
});

describe('asking', () => {
  it('works, and the receipt says nobody named here is real', async () => {
    const receipt = await ask(student(), WHITFIELD);
    expect(receipt.message).toContain(SANDBOX_MARK);
    expect(receipt.message).toMatch(/not a real graduate|real graduate of anywhere/i);
  });

  it('is refused without a reason, because the reason is what they answer on', async () => {
    await expect(ask(student(), WHITFIELD, '   ')).rejects.toThrow(/Say why you are asking/);
  });

  it('is refused of somebody not taking requests', async () => {
    await expect(ask(student(), CLOSED)).rejects.toThrow(/not taking requests/);
  });

  it('is refused twice while it is unanswered', async () => {
    await ask(student(), WHITFIELD);
    await expect(ask(student(), WHITFIELD)).rejects.toThrow(/have not answered yet/);
  });

  it('is refused after a decline, and says so', async () => {
    await ask(student(), WHITFIELD);
    await answer(WHITFIELD, 'decline', 'student-1');
    await expect(ask(student(), WHITFIELD)).rejects.toThrow(/declined on/);
  });

  it('is refused of somebody already mentoring you', async () => {
    await ask(student(), WHITFIELD);
    await answer(WHITFIELD, 'accept', 'student-1');
    await expect(ask(student(), WHITFIELD)).rejects.toThrow(/already mentoring you/);
  });

  it('is refused by somebody who is not a student', async () => {
    await expect(ask(who('staffer', 'staff'), WHITFIELD)).rejects.toThrow(/Only a student can ask/);
  });

  it('is refused of somebody who is not in the network', async () => {
    await expect(ask(student(), 'nobody-at-all')).rejects.toThrow(/not.*in the sandbox alumni network|Nobody by that name/);
  });
});

describe('capacity, which is the finite thing here', () => {
  it('is counted from the accepted mentorships rather than stored', async () => {
    expect(mentoring(store, WHITFIELD)).toBe(0);
    await ask(student(1), WHITFIELD);
    expect(mentoring(store, WHITFIELD), 'an unanswered ask counted against capacity').toBe(0);
    await answer(WHITFIELD, 'accept', 'student-1');
    expect(mentoring(store, WHITFIELD)).toBe(1);
  });

  it('refuses a new ask once it is reached', async () => {
    await ask(student(1), WHITFIELD);
    await ask(student(2), WHITFIELD);
    await answer(WHITFIELD, 'accept', 'student-1');
    await answer(WHITFIELD, 'accept', 'student-2');
    await expect(ask(student(3), WHITFIELD)).rejects.toThrow(/as many as they said they could/);
  });

  it('refuses the accept at the review too, not only at the commit', async () => {
    const m = { ...store.mentor(WHITFIELD)!, capacity: 1 };
    store.saveMentor(m);
    await ask(student(1), WHITFIELD);
    await ask(student(2), WHITFIELD);
    await answer(WHITFIELD, 'accept', 'student-1');
    await expect(
      alumni.review(who(WHITFIELD, 'staff'), act('alumni', WHITFIELD, 'accept', { who: 'student-2' })),
    ).rejects.toThrow(/as many as they said/);
  });

  it('refuses the accept itself at the commit, because a review reserves nothing', async () => {
    // Capacity one, and two people already asked.
    const m = { ...store.mentor(WHITFIELD)!, capacity: 1 };
    store.saveMentor(m);
    await ask(student(1), WHITFIELD);
    await ask(student(2), WHITFIELD);

    const first = act('alumni', WHITFIELD, 'accept', { who: 'student-1' });
    const second = act('alumni', WHITFIELD, 'accept', { who: 'student-2' });
    const asMentor = who(WHITFIELD, 'staff');
    await alumni.review(asMentor, first);
    await alumni.review(asMentor, second);
    await alumni.execute(asMentor, first, nextKey());
    await expect(alumni.execute(asMentor, second, nextKey())).rejects.toThrow(/as many as they said/);
  });

  it('comes back when a mentorship ends', async () => {
    const m = { ...store.mentor(WHITFIELD)!, capacity: 1 };
    store.saveMentor(m);
    await ask(student(1), WHITFIELD);
    await answer(WHITFIELD, 'accept', 'student-1');
    const end = act('alumni', WHITFIELD, 'end');
    await alumni.review(student(1), end);
    await alumni.execute(student(1), end, nextKey());
    expect(mentoring(store, WHITFIELD)).toBe(0);
    await expect(ask(student(2), WHITFIELD)).resolves.toBeTruthy();
  });
});

describe('answering, which only the alumnus can do', () => {
  it('is refused to anybody but them', async () => {
    await ask(student(1), WHITFIELD);
    const input = act('alumni', WHITFIELD, 'accept', { who: 'student-1' });
    await expect(alumni.review(student(2), input)).rejects.toThrow(/Only the alumnus themselves/);
  });

  it('is refused to a different alumnus', async () => {
    await ask(student(1), WHITFIELD);
    const input = act('alumni', WHITFIELD, 'accept', { who: 'student-1' });
    await expect(alumni.review(who(PARK, 'staff'), input)).rejects.toThrow(/Only the alumnus themselves/);
  });

  it('is refused for somebody who did not ask', async () => {
    await expect(answer(WHITFIELD, 'accept', 'student-9')).rejects.toThrow(/has asked you/);
  });

  it('is refused twice', async () => {
    await ask(student(1), WHITFIELD);
    await answer(WHITFIELD, 'accept', 'student-1');
    await expect(answer(WHITFIELD, 'accept', 'student-1')).rejects.toThrow(/already accepted/);
  });

  it('is refused without a name', async () => {
    await ask(student(1), WHITFIELD);
    await expect(alumni.review(who(WHITFIELD, 'staff'), act('alumni', WHITFIELD, 'accept'))).rejects.toThrow(
      /Name the student/,
    );
  });

  it('shows the alumnus who is waiting on them, and shows a student nothing of that', async () => {
    await ask(student(1), WHITFIELD, 'a reason only they should read');
    const theirs = await everything(alumni, who(WHITFIELD, 'staff'), WHITFIELD);
    expect(theirs).toContain('a reason only they should read');
    const other = await everything(alumni, student(2), WHITFIELD);
    expect(other, 'a stranger could read somebody else’s request').not.toContain('a reason only they should read');
  });

  it('refuses an action a mentor record does not have', async () => {
    await expect(alumni.review(student(), act('alumni', WHITFIELD, 'befriend'))).rejects.toThrow(
      /not something a mentor record can do/,
    );
  });

  it('returns the same receipt for a retried key rather than asking twice', async () => {
    const input = act('alumni', WHITFIELD, 'ask', { why: 'once' });
    await alumni.review(student(), input);
    const first = await alumni.execute(student(), input, 'same-key');
    const again = await alumni.execute(student(), input, 'same-key');
    expect(again).toEqual(first);
    expect(store.mentorshipsOf('student-1').length).toBe(1);
  });

  it('ending is refused when they are not mentoring you', async () => {
    await expect(alumni.review(student(), act('alumni', WHITFIELD, 'end'))).rejects.toThrow(/is not mentoring you/);
  });
});
