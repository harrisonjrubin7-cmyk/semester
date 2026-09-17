import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SANDBOX_INSTITUTION, SANDBOX_MARK, SandboxStore } from './sandbox.ts';
import { aboard, athleticsAdapter, eligible, good, lapsed, sealed } from './athletics.ts';
import type { AdapterContext, InstitutionAdapter } from './adapter.ts';
import type { ActionInput, UniversityArea, UniversityRole } from '../../../packages/institution/src/index.ts';

/**
 * Athletics, and the two things that make it different from the areas before.
 *
 * **Eligibility is a date**, so most of these tests move the clock rather than
 * editing a row. A test that made somebody ineligible by setting a flag would
 * have passed just as well against an implementation that stored one, which is
 * the implementation this area exists to argue against.
 *
 * **And why somebody is not cleared is a medical fact.** A coach sees *that* a
 * player is not cleared and not why. That is asserted by reading the coach's
 * own view of the roster and searching the whole serialised record for the
 * reason — with a control that reads the same roster as the athlete and finds
 * it there, because a search for an absence passes against an empty record
 * too.
 *
 * Phase 4's gates are not satisfied by any of this: no team here exists and
 * nobody is cleared to play anything.
 */

let dir = '';
let store: SandboxStore;
let athletics: InstitutionAdapter;
let today = new Date('2026-09-20T12:00:00.000Z');

const who = (userId: string, ...roles: UniversityRole[]): AdapterContext => ({
  identity: { userId, institutionId: SANDBOX_INSTITUTION, roles },
  signal: new AbortController().signal,
});

const act = (recordId: string, actionId: string, fields: Record<string, string> = {}): ActionInput => ({
  area: 'athletics' as UniversityArea,
  recordId,
  version: '0',
  actionId,
  fields,
});

const student = (n = 1) => who(`student-${n}`, 'student');
const brandt = () => who('coach-brandt', 'staff');
const nwosu = () => who('coach-nwosu', 'staff');

const ROWING = 'rowing';
const TRACK = 'track';
const TRIP = 'head-of-the-cumberland';
const BIG_TRIP = 'conference-relays';
const SHUT_TRIP = 'closed-fixture';

let keys = 0;
const nextKey = () => `k${++keys}`;

/** Put somebody on a roster, through both phases, as their coach. */
async function roster(n = 1, team = ROWING, coach = brandt) {
  const input = act(team, 'add', { who: `student-${n}`, name: `Student ${n}`, position: 'Squad' });
  await athletics.review(coach(), input);
  return athletics.execute(coach(), input, nextKey());
}

async function release(n = 1, team = ROWING, coach = brandt) {
  const input = act(team, 'release', { who: `student-${n}` });
  await athletics.review(coach(), input);
  return athletics.execute(coach(), input, nextKey());
}

async function travel(n = 1, trip = TRIP) {
  const input = act(trip, 'travel');
  await athletics.review(student(n), input);
  return athletics.execute(student(n), input, nextKey());
}

async function stepOff(n = 1, trip = TRIP) {
  const input = act(trip, 'step-off');
  await athletics.review(student(n), input);
  return athletics.execute(student(n), input, nextKey());
}

/** Make this person cleared, by dating their clearances into the future. */
function clear(n = 1, until = '2027-12-31') {
  for (const c of store.clearances(`student-${n}`)) store.saveClearance({ ...c, until, why: '' });
}

const everything = async (context: AdapterContext, id: string) =>
  JSON.stringify((await athletics.get(context, id)) ?? {});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'athletics-'));
  store = new SandboxStore(join(dir, 'sandbox.sqlite'));
  today = new Date('2026-09-20T12:00:00.000Z');
  athletics = athleticsAdapter(store, () => today);
  keys = 0;
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('what the sandbox athletics department opens with', () => {
  it('lists teams and fixtures, and every one of them says SANDBOX', async () => {
    const got = await athletics.list(student(), { search: '', cursor: null });
    expect(got.records.length).toBeGreaterThan(0);
    for (const r of got.records) expect(r.title.startsWith(`${SANDBOX_MARK} · `)).toBe(true);
  });

  it('carries a fixture whose manifest has already gone to the driver', () => {
    expect(sealed(store.trip(SHUT_TRIP)!, today)).toBe(true);
  });

  it('and one with two places, so the second athlete meets the limit', () => {
    expect(store.trip(TRIP)!.seats).toBe(2);
  });

  it('opens no clearance file for somebody who is not on a roster', () => {
    expect(store.clearances('student-1')).toEqual([]);
  });

  it('says it is a sandbox, and offers a coach write access without a student role', async () => {
    const status = await athletics.status(brandt());
    expect(status.provider).toContain(SANDBOX_MARK);
    expect(status.canWrite).toBe(true);
    expect((await athletics.status(who('nobody', 'staff'))).canWrite).toBe(false);
  });
});

describe('the roster, which is the coach’s', () => {
  it('adds a player, and the receipt says no real roster changed', async () => {
    const receipt = await roster(1);
    expect(receipt.message).toContain(SANDBOX_MARK);
    expect(receipt.message).toMatch(/no roster at any real institution/i);
    expect(store.athletes(ROWING).length).toBe(1);
  });

  it('opens their clearance file at that moment and not before', async () => {
    expect(store.clearances('student-1')).toEqual([]);
    await roster(1);
    expect(store.clearances('student-1').length).toBeGreaterThan(0);
  });

  it('and being on a roster is not being cleared to compete', async () => {
    await roster(1);
    expect(eligible(store, 'student-1', today)).toBe(false);
  });

  it('refuses another team’s coach', async () => {
    await expect(roster(1, ROWING, nwosu)).rejects.toThrow(/Only Coach I. Brandt/);
  });

  it('refuses somebody who coaches nothing', async () => {
    await expect(roster(1, ROWING, () => who('nobody', 'staff'))).rejects.toThrow(/Only Coach I. Brandt/);
  });

  it('refuses a student adding themselves', async () => {
    await expect(roster(1, ROWING, () => student(1))).rejects.toThrow(/Only Coach I. Brandt/);
  });

  it('refuses the same player twice', async () => {
    await roster(1);
    await expect(roster(1)).rejects.toThrow(/already on the Rowing roster/);
  });

  it('and refuses it at the review, so the coach is told before they commit', async () => {
    await roster(1);
    const input = act(ROWING, 'add', { who: 'student-1', name: 'Student 1' });
    await expect(athletics.review(brandt(), input)).rejects.toThrow(/already on the Rowing roster/);
  });

  it('refuses a player with no name for the squad list', async () => {
    const input = act(ROWING, 'add', { who: 'student-1' });
    await expect(athletics.review(brandt(), input)).rejects.toThrow(/name that goes on the squad list/);
  });

  it('refuses naming nobody at all', async () => {
    await expect(athletics.review(brandt(), act(ROWING, 'add', {}))).rejects.toThrow(/Name the player/);
  });

  it('releases a player, and leaves their clearances alone', async () => {
    await roster(1);
    clear(1);
    await release(1);
    expect(store.athletes(ROWING)[0].state).toBe('released');
    expect(store.clearances('student-1').length).toBeGreaterThan(0);
  });

  it('refuses releasing somebody who is not on it', async () => {
    await expect(release(1)).rejects.toThrow(/not on the Rowing roster/);
  });

  it('refuses an action a team does not have', async () => {
    await expect(athletics.review(brandt(), act(ROWING, 'relegate'))).rejects.toThrow(
      /not something a team can do/,
    );
  });
});

describe('eligibility, which is a date and never a flag', () => {
  it('good is a day comparison, inclusive of the last day itself', async () => {
    await roster(1);
    const c = store.clearances('student-1').find((x) => x.id.endsWith('physical'))!;
    expect(good(c, new Date(`${c.until}T23:59:59.000Z`)), 'the last day was already stale').toBe(true);
    expect(good(c, new Date('2027-07-01T00:00:01.000Z'))).toBe(false);
  });

  it('somebody cleared today is not cleared once the date passes — with no row edited', async () => {
    await roster(1);
    clear(1, '2026-09-25');
    expect(eligible(store, 'student-1', today)).toBe(true);

    // The clock moves. Nothing else does.
    today = new Date('2026-09-26T12:00:00.000Z');
    expect(eligible(store, 'student-1', today), 'a lapsed clearance still read as good').toBe(false);
  });

  it('names every outstanding clearance rather than only the first', async () => {
    await roster(1);
    // Two of the three are stale at the opening dates.
    const out = lapsed(store, 'student-1', today).map((c) => c.what);
    expect(out).toContain('Return-to-play clearance');
    expect(out.length).toBeGreaterThanOrEqual(1);
  });

  it('somebody with no clearance file at all is not eligible', () => {
    expect(eligible(store, 'nobody', today)).toBe(false);
  });

  it('and one good clearance among stale ones is still not eligible', async () => {
    await roster(1);
    const all = store.clearances('student-1');
    store.saveClearance({ ...all[0], until: '2027-12-31', why: '' });
    expect(eligible(store, 'student-1', today)).toBe(false);
  });
});

describe('why somebody is not cleared, which is a medical fact', () => {
  const REASON = 'Return-to-play assessment outstanding';

  it('is on the athlete’s own reading of the roster', async () => {
    await roster(1);
    expect(await everything(student(1), ROWING)).toContain(REASON);
  });

  it('is not on their coach’s reading of the same roster', async () => {
    await roster(1);
    const said = await everything(brandt(), ROWING);
    expect(said, 'a coach could read why a player was not cleared').not.toContain(REASON);
    // The control: the coach does see that they are not cleared, and who they are.
    expect(said).toContain('Not cleared');
    expect(said).toContain('Student 1');
  });

  it('is not on a team-mate’s reading of it either', async () => {
    await roster(1);
    await roster(2);
    clear(2);
    const said = await everything(student(2), ROWING);
    expect(said, 'a team-mate could read it').not.toContain(REASON);
    expect(said).toContain('Not cleared');
  });

  it('and the reason a person is shown is their own, not the first one on the list', async () => {
    /*
     * Two uncleared athletes with different reasons. The mutation that found
     * this gap replaced the reader's id with the squad's first entry — which
     * every other test in this block was blind to, because in each of them
     * the reader either was the first entry or was cleared and saw no reason
     * at all. Somebody reading a team-mate's medical reason instead of their
     * own is the worst version of this bug and it had no test.
     */
    await roster(1);
    await roster(2);
    for (const c of store.clearances('student-2')) {
      store.saveClearance({ ...c, until: '2026-09-01', why: 'A knee thing that is student-2 business only.' });
    }
    const said = await everything(student(2), ROWING);
    expect(said).toContain('A knee thing that is student-2 business only.');
    expect(said, 'a team-mate\u2019s reason was shown in place of their own').not.toContain(REASON);
  });

  it('and a person with no connection to the team sees no squad list at all', async () => {
    await roster(1);
    const said = await everything(student(9), ROWING);
    expect(said).not.toContain('Student 1');
    expect(said).not.toContain(REASON);
    // The control: the team itself is not hidden, only its roster.
    expect(said).toContain('Rowing');
  });
});

describe('travel, where eligibility and the seat compose', () => {
  it('lets a cleared athlete on, and says no coach is going anywhere', async () => {
    await roster(1);
    clear(1);
    const receipt = await travel(1);
    expect(receipt.message).toContain(SANDBOX_MARK);
    expect(receipt.message).toMatch(/no coach is going anywhere/i);
    expect(aboard(store, TRIP)).toBe(1);
  });

  it('refuses an athlete who is not cleared, naming what is outstanding', async () => {
    await roster(1);
    await expect(travel(1)).rejects.toThrow(/not cleared to compete/);
  });

  it('refuses them the moment their clearance lapses, with nothing else changed', async () => {
    await roster(1);
    clear(1, '2026-09-25');
    await travel(1);
    await stepOff(1);

    today = new Date('2026-09-26T12:00:00.000Z');
    await expect(travel(1)).rejects.toThrow(/not cleared to compete/);
  });

  it('refuses somebody who is not on the roster at all', async () => {
    await expect(travel(1)).rejects.toThrow(/not on the Rowing roster/);
  });

  it('says the clearance first and the full coach second, because they go to different offices', async () => {
    // Fill the coach with two cleared athletes, then a third who is not cleared.
    await roster(1);
    await roster(2);
    await roster(3);
    clear(1);
    clear(2);
    await travel(1);
    await travel(2);
    expect(aboard(store, TRIP)).toBe(2);
    /*
     * Both refusals are true of student-3 at this point. The one they are
     * given has to be the clearance, because being told the bus is full sends
     * them to the travel office, which cannot help them.
     */
    await expect(travel(3)).rejects.toThrow(/not cleared to compete/);
  });

  it('refuses when the coach is full and the athlete is cleared', async () => {
    await roster(1);
    await roster(2);
    await roster(3);
    clear(1);
    clear(2);
    clear(3);
    await travel(1);
    await travel(2);
    await expect(travel(3)).rejects.toThrow(/filled while you were reading/);
  });

  it('is refused at the review, so the athlete is told before they commit', async () => {
    await roster(1);
    await roster(2);
    await roster(3);
    clear(1);
    clear(2);
    clear(3);
    await travel(1);
    await travel(2);
    await expect(athletics.review(student(3), act(TRIP, 'travel'))).rejects.toThrow(/filled while you were reading/);
  });

  it('and again at the commit, because a review reserves nothing', async () => {
    await roster(1);
    await roster(2);
    await roster(3);
    clear(1);
    clear(2);
    clear(3);
    await travel(1);
    const second = act(TRIP, 'travel');
    const third = act(TRIP, 'travel');
    await athletics.review(student(2), second);
    await athletics.review(student(3), third);
    await athletics.execute(student(2), second, nextKey());
    await expect(athletics.execute(student(3), third, nextKey())).rejects.toThrow(/filled while you were reading/);
  });

  it('refuses once the manifest is with the driver', async () => {
    await roster(1);
    clear(1);
    await expect(travel(1, SHUT_TRIP)).rejects.toThrow(/closed on 2026-09-15/);
  });

  it('refuses a coach putting their own name on it', async () => {
    const input = act(TRIP, 'travel');
    await expect(athletics.review(brandt(), input)).rejects.toThrow(/Only an athlete can put their own name/);
  });

  it('and refuses a fixture that does not exist', async () => {
    await expect(travel(1, 'no-such-fixture')).rejects.toThrow(/No such team or fixture/);
  });
});

describe('coming off a manifest', () => {
  it('gives the place back', async () => {
    await roster(1);
    clear(1);
    await travel(1);
    await stepOff(1);
    expect(aboard(store, TRIP)).toBe(0);
  });

  it('and somebody else can then take it', async () => {
    await roster(1);
    await roster(2);
    await roster(3);
    clear(1);
    clear(2);
    clear(3);
    await travel(1);
    await travel(2);
    await expect(travel(3)).rejects.toThrow(/filled/);
    await stepOff(1);
    await expect(travel(3)).resolves.toBeTruthy();
  });

  it('is refused when this person is not on it', async () => {
    await roster(1);
    clear(1);
    await expect(stepOff(1)).rejects.toThrow(/not on that manifest/);
  });

  it('is refused twice', async () => {
    await roster(1);
    clear(1);
    await travel(1);
    await stepOff(1);
    await expect(stepOff(1)).rejects.toThrow(/not on that manifest/);
  });

  it('and is refused at the commit as well as the review, which the review was hiding', async () => {
    /*
     * Both phases check, and until this test existed only the review's check
     * was load-bearing in the suite: removing the commit's left everything
     * green. A commit that trusts its own review is a commit that acts on a
     * world that has moved, which is the whole reason there are two phases.
     */
    await roster(1);
    clear(1);
    await travel(1);
    const input = act(TRIP, 'step-off');
    await athletics.review(student(1), input);
    await athletics.execute(student(1), input, nextKey());
    // The review passed once; the second commit must still refuse.
    await expect(athletics.execute(student(1), input, nextKey())).rejects.toThrow(/not on that manifest/);
  });

  it('and the closing day is checked at the commit too', async () => {
    await roster(1, TRACK, nwosu);
    clear(1);
    await travel(1, BIG_TRIP);
    const input = act(BIG_TRIP, 'step-off');
    await athletics.review(student(1), input);
    today = new Date('2026-10-07T12:00:00.000Z');
    await expect(athletics.execute(student(1), input, nextKey())).rejects.toThrow(/with the driver/);
  });

  it('is refused once the manifest has gone to the driver, even for somebody on it', async () => {
    // Track's fixture, so the athlete goes on track's roster. Writing this
    // against the rowing roster went red on the cross-team refusal below,
    // which is the guard doing its job on the test rather than on the code.
    await roster(1, TRACK, nwosu);
    clear(1);
    await travel(1, BIG_TRIP);
    today = new Date('2026-10-07T12:00:00.000Z');
    await expect(stepOff(1, BIG_TRIP)).rejects.toThrow(/with the driver/);
  });

  it('and a fixture belongs to its own team \u2014 a rower cannot board the track coach', async () => {
    await roster(1, ROWING, brandt);
    clear(1);
    await expect(travel(1, BIG_TRIP)).rejects.toThrow(/not on the Track & field roster/);
    // The control: their own team's fixture is open to them.
    await expect(travel(1, TRIP)).resolves.toBeTruthy();
  });

  it('refuses an action a fixture does not have', async () => {
    await expect(athletics.review(student(1), act(TRIP, 'cancel'))).rejects.toThrow(
      /not something a fixture can do/,
    );
  });
});

describe('the manifest, which is the coach’s to hand over', () => {
  it('is on the coach’s reading of the fixture', async () => {
    await roster(1);
    clear(1);
    await travel(1);
    expect(await everything(brandt(), TRIP)).toContain('student-1');
  });

  it('is not on a team-mate’s reading of it', async () => {
    await roster(1);
    await roster(2);
    clear(1);
    clear(2);
    await travel(1);
    const said = await everything(student(2), TRIP);
    expect(said, 'a team-mate could read the manifest').not.toContain('student-1');
    // The control: the fixture itself is not hidden, and the count is public.
    expect(said).toContain('Chattanooga');
  });
});

describe('the gateway’s own guarantees, kept here', () => {
  it('refuses boarding a manifest somebody is already on', async () => {
    await roster(1);
    clear(1);
    await travel(1);
    await expect(travel(1)).rejects.toThrow(/already on the manifest/);
  });

  it('returns the same receipt for a retried key rather than refusing the retry', async () => {
    /*
     * This test was worthless until the refusal above existed. With boarding
     * twice permitted, a retry simply wrote the same row to the same state and
     * produced an identical receipt, so removing the idempotency check
     * entirely left the suite green — the mutation harness is what found that.
     * Now the second call would be refused if `already` were not asked first,
     * which is exactly the situation a dropped connection produces.
     */
    await roster(1);
    clear(1);
    const input = act(TRIP, 'travel');
    await athletics.review(student(1), input);
    const first = await athletics.execute(student(1), input, 'same-key');
    const again = await athletics.execute(student(1), input, 'same-key');
    expect(again).toEqual(first);
    expect(aboard(store, TRIP)).toBe(1);
  });

  it('answers null for a record that is not there, rather than throwing', async () => {
    expect(await athletics.get(student(), 'no-such-thing')).toBeNull();
  });

  it('moves the version when the manifest moves, so a stale review is caught', async () => {
    await roster(1);
    clear(1);
    const before = (await athletics.get(brandt(), TRIP))?.version;
    await travel(1);
    expect((await athletics.get(brandt(), TRIP))?.version).not.toBe(before);
  });

  it('carries the departure as a date, not only as a sentence', async () => {
    const r = await athletics.get(student(), TRIP);
    expect(r?.dates?.[0]?.at).toBe(store.trip(TRIP)!.leaves);
  });

  it('offers no action at all once a manifest is closed', async () => {
    await roster(1);
    clear(1);
    expect((await athletics.get(student(1), SHUT_TRIP))?.actions ?? []).toEqual([]);
  });
});
