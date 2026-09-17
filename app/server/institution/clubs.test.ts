import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SANDBOX_INSTITUTION, SANDBOX_MARK, SandboxStore } from './sandbox.ts';
import { cents, clubsAdapter, committed, heldBy, remaining, roll, tally, voting } from './clubs.ts';
import type { AdapterContext, InstitutionAdapter } from './adapter.ts';
import type { ActionInput, UniversityArea, UniversityRole } from '../../../packages/institution/src/index.ts';

/**
 * Clubs, and the four finite things that are not the same kind of finite.
 *
 * Most of this file is the **ballot**, because it is the hardest thing in
 * Phase 4: an election has to record who has voted so that nobody votes twice,
 * and must not record how anybody voted. Both at once is the whole problem.
 *
 * The test that matters most reads the *stored rows* rather than the adapter's
 * output — every row on the electoral roll and every paper in the box — and
 * asserts that no value appearing in one appears in the other. A test of what
 * the adapter returns could not make that claim, because the claim is about
 * what a person with the database could reconstruct.
 *
 * Phase 4's gates are not satisfied by any of this. No club named here exists,
 * no money moves, and no election decides anything.
 */

let dir = '';
let store: SandboxStore;
let clubs: InstitutionAdapter;
let today = new Date('2026-09-20T12:00:00.000Z');

const who = (userId: string, ...roles: UniversityRole[]): AdapterContext => ({
  identity: { userId, institutionId: SANDBOX_INSTITUTION, roles },
  signal: new AbortController().signal,
});

const act = (recordId: string, actionId: string, fields: Record<string, string> = {}): ActionInput => ({
  area: 'clubs' as UniversityArea,
  recordId,
  version: '0',
  actionId,
  fields,
});

const student = (n = 1) => who(`student-${n}`, 'student');
const mun = () => who('officer-mun', 'staff');
const econ = () => who('officer-econ', 'staff');

const MUN = 'model-un';
const ECON = 'econ-society';
const POLL = 'mun-president-2027';
const LATER_POLL = 'econ-treasurer-2027';
const BIG_ROOM = 'buttrick-101';
const SMALL_ROOM = 'sarratt-216';
const SOON = '2026-10-06T20:00:00.000Z';

let keys = 0;
const nextKey = () => `k${++keys}`;

/** Any action, through both phases, the way the gateway would. */
async function go(context: AdapterContext, recordId: string, actionId: string, fields: Record<string, string> = {}) {
  const input = act(recordId, actionId, fields);
  await clubs.review(context, input);
  return clubs.execute(context, input, nextKey());
}

const joinClub = (n = 1, club = MUN) => go(student(n), club, 'join', { name: `Student ${n}` });
const vote = (n = 1, choice = 'A. Osei', poll = POLL) => go(student(n), poll, 'vote', { choice });

const everything = async (context: AdapterContext, id: string) =>
  JSON.stringify((await clubs.get(context, id)) ?? {});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'clubs-'));
  store = new SandboxStore(join(dir, 'sandbox.sqlite'));
  today = new Date('2026-09-20T12:00:00.000Z');
  clubs = clubsAdapter(store, () => today);
  keys = 0;
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('what the sandbox clubs office opens with', () => {
  it('lists clubs, elections and rooms, all marked SANDBOX', async () => {
    const got = await clubs.list(student(), { search: '', cursor: null });
    expect(got.records.length).toBeGreaterThan(0);
    for (const r of got.records) expect(r.title.startsWith(`${SANDBOX_MARK} · `)).toBe(true);
  });

  it('carries an election that has not opened yet, so that refusal is walkable', () => {
    expect(voting(store.election(LATER_POLL)!, today)).toBe(false);
  });

  it('and one club that charges dues and one that does not', () => {
    expect(store.club(MUN)!.duesCents).toBeGreaterThan(0);
    expect(store.club(ECON)!.duesCents).toBe(0);
  });
});

describe('membership', () => {
  it('joins, and the receipt says no money moved', async () => {
    const receipt = await joinClub(1);
    expect(receipt.message).toContain(SANDBOX_MARK);
    expect(receipt.message).toMatch(/no money moved/i);
    expect(roll(store, MUN).length).toBe(1);
  });

  it('records dues as outstanding rather than taking anything', async () => {
    await joinClub(1);
    expect(roll(store, MUN)[0].duesPaid).toBe(false);
  });

  it('refuses joining twice', async () => {
    await joinClub(1);
    await expect(joinClub(1)).rejects.toThrow(/already a member/);
  });

  it('refuses joining without a name for the list', async () => {
    await expect(clubs.review(student(1), act(MUN, 'join', {}))).rejects.toThrow(/name that goes on the membership/);
  });

  it('refuses somebody who is not a student', async () => {
    await expect(go(who('staffer', 'staff'), MUN, 'join', { name: 'X' })).rejects.toThrow(/Only a student can join/);
  });

  it('leaves, and takes them off the roll', async () => {
    await joinClub(1);
    await go(student(1), MUN, 'leave');
    expect(roll(store, MUN).length).toBe(0);
  });

  it('refuses leaving something they are not in', async () => {
    await expect(go(student(1), MUN, 'leave')).rejects.toThrow(/not a member/);
  });

  it('shows the membership list to members and officers, and to nobody else', async () => {
    await joinClub(1);
    expect(await everything(mun(), MUN)).toContain('Student 1');
    expect(await everything(student(1), MUN)).toContain('Student 1');
    const outsider = await everything(student(9), MUN);
    expect(outsider, 'a stranger could read the membership list').not.toContain('Student 1');
    // The control: the club itself is not hidden, only who is in it.
    expect(outsider).toContain('Model United Nations');
  });
});

describe('the budget, where the finite thing is a sum and not a count', () => {
  it('claims against it, and the receipt says nothing was paid', async () => {
    const receipt = await go(mun(), MUN, 'claim', { what: 'Conference fees', amount: '400' });
    expect(receipt.message).toMatch(/no money moved/i);
    expect(committed(store, MUN)).toBe(40_000);
  });

  it('lets several claims through while the sum fits', async () => {
    await go(mun(), MUN, 'claim', { what: 'Fees', amount: '1000' });
    await go(mun(), MUN, 'claim', { what: 'Travel', amount: '1000' });
    expect(remaining(store, store.club(MUN)!)).toBe(50_000);
  });

  it('refuses the one that does not fit, against the remainder', async () => {
    await go(mun(), MUN, 'claim', { what: 'Fees', amount: '2000' });
    await expect(go(mun(), MUN, 'claim', { what: 'Travel', amount: '600' })).rejects.toThrow(
      /has \$500\.00 left of its \$2,500\.00 grant/,
    );
  });

  it('and one that exactly fits is allowed — the boundary is not off by a cent', async () => {
    await go(mun(), MUN, 'claim', { what: 'Everything', amount: '2500' });
    expect(remaining(store, store.club(MUN)!)).toBe(0);
    await expect(go(mun(), MUN, 'claim', { what: 'One cent more', amount: '0.01' })).rejects.toThrow(/left of its/);
  });

  it('is refused at the review, so the officer is told before they commit', async () => {
    await go(mun(), MUN, 'claim', { what: 'Fees', amount: '2500' });
    await expect(clubs.review(mun(), act(MUN, 'claim', { what: 'More', amount: '1' }))).rejects.toThrow(/left of its/);
  });

  it('and again at the commit, because a review reserves nothing', async () => {
    const first = act(MUN, 'claim', { what: 'A', amount: '2000' });
    const second = act(MUN, 'claim', { what: 'B', amount: '2000' });
    await clubs.review(mun(), first);
    await clubs.review(mun(), second);
    await clubs.execute(mun(), first, nextKey());
    await expect(clubs.execute(mun(), second, nextKey())).rejects.toThrow(/left of its/);
  });

  it('refuses a claim by anybody but the officer', async () => {
    await joinClub(1);
    await expect(go(student(1), MUN, 'claim', { what: 'X', amount: '1' })).rejects.toThrow(/Only H. Osei/);
  });

  it('refuses another club’s officer', async () => {
    await expect(go(econ(), MUN, 'claim', { what: 'X', amount: '1' })).rejects.toThrow(/Only H. Osei/);
  });

  it('refuses a claim for nothing, or for something that is not money', async () => {
    await expect(go(mun(), MUN, 'claim', { what: 'X', amount: '0' })).rejects.toThrow(/more than nothing/);
    await expect(go(mun(), MUN, 'claim', { what: 'X', amount: 'lots' })).rejects.toThrow(/in dollars/);
    await expect(go(mun(), MUN, 'claim', { what: '', amount: '5' })).rejects.toThrow(/what the claim is for/);
  });

  it('shows the claim-by-claim breakdown to the officer and not to members', async () => {
    await joinClub(1);
    await go(mun(), MUN, 'claim', { what: 'A delicate matter', amount: '100' });
    expect(await everything(mun(), MUN)).toContain('A delicate matter');
    const asMember = await everything(student(1), MUN);
    expect(asMember, 'a member could read the claim-by-claim breakdown').not.toContain('A delicate matter');
    // The control: a member does see the headline figures, which is the point.
    expect(asMember).toContain('Left to spend');
  });

  it('cents reads dollars and refuses everything else', () => {
    expect(cents('40')).toBe(4_000);
    expect(cents('40.50')).toBe(4_050);
    expect(cents('$1,250.00')).toBe(125_000);
    expect(() => cents('40.999')).toThrow(/in dollars/);
    expect(() => cents('-5')).toThrow(/in dollars/);
    expect(() => cents('')).toThrow(/in dollars/);
  });
});

describe('dues, which are a club’s money and not a university’s', () => {
  it('records a settlement, and says it is not a receipt for a payment', async () => {
    await joinClub(1);
    const receipt = await go(mun(), MUN, 'settle', { who: 'student-1' });
    expect(receipt.message).toMatch(/no money moved/i);
    expect(roll(store, MUN)[0].duesPaid).toBe(true);
  });

  it('says so in the review as well, before anybody presses the button', async () => {
    await joinClub(1);
    const review = await clubs.review(mun(), act(MUN, 'settle', { who: 'student-1' }));
    expect(JSON.stringify(review)).toMatch(/not a receipt for a payment/i);
  });

  it('refuses for a club that charges none', async () => {
    await joinClub(1, ECON);
    await expect(go(econ(), ECON, 'settle', { who: 'student-1' })).rejects.toThrow(/does not charge dues/);
  });

  it('refuses for somebody who is not a member', async () => {
    await expect(go(mun(), MUN, 'settle', { who: 'student-9' })).rejects.toThrow(/not a member/);
  });

  it('refuses twice', async () => {
    await joinClub(1);
    await go(mun(), MUN, 'settle', { who: 'student-1' });
    await expect(go(mun(), MUN, 'settle', { who: 'student-1' })).rejects.toThrow(/already recorded as settled/);
  });

  it('refuses a member settling their own', async () => {
    await joinClub(1);
    await expect(go(student(1), MUN, 'settle', { who: 'student-1' })).rejects.toThrow(/Only H. Osei/);
  });
});

describe('rooms, where it is registration’s seat again', () => {
  it('holds one, and the receipt says no real room was booked', async () => {
    const receipt = await go(mun(), MUN, 'book', { room: BIG_ROOM, when: SOON, what: 'Committee practice' });
    expect(receipt.message).toMatch(/no room at any real institution/i);
    expect(heldBy(store, BIG_ROOM, SOON)?.club).toBe(MUN);
  });

  it('refuses a second club the same room at the same time', async () => {
    await go(mun(), MUN, 'book', { room: BIG_ROOM, when: SOON, what: 'Practice' });
    await expect(go(econ(), ECON, 'book', { room: BIG_ROOM, when: SOON, what: 'A talk' })).rejects.toThrow(
      /is held by Model United Nations/,
    );
  });

  it('but the same room at a different time is fine', async () => {
    await go(mun(), MUN, 'book', { room: BIG_ROOM, when: SOON, what: 'Practice' });
    await expect(
      go(econ(), ECON, 'book', { room: BIG_ROOM, when: '2026-10-07T20:00:00.000Z', what: 'A talk' }),
    ).resolves.toBeTruthy();
  });

  it('and a different room at the same time is fine', async () => {
    await go(mun(), MUN, 'book', { room: BIG_ROOM, when: SOON, what: 'Practice' });
    await expect(go(econ(), ECON, 'book', { room: SMALL_ROOM, when: SOON, what: 'A talk' })).resolves.toBeTruthy();
  });

  it('refuses the same club asking twice for the same slot', async () => {
    await go(mun(), MUN, 'book', { room: BIG_ROOM, when: SOON, what: 'Practice' });
    await expect(go(mun(), MUN, 'book', { room: BIG_ROOM, when: SOON, what: 'Again' })).rejects.toThrow(
      /already hold that room/,
    );
  });

  it('is refused at the review as well as the commit', async () => {
    await go(mun(), MUN, 'book', { room: BIG_ROOM, when: SOON, what: 'Practice' });
    await expect(
      clubs.review(econ(), act(ECON, 'book', { room: BIG_ROOM, when: SOON, what: 'A talk' })),
    ).rejects.toThrow(/is held by/);
  });

  it('and again at the commit, because a review reserves nothing', async () => {
    const first = act(MUN, 'book', { room: BIG_ROOM, when: SOON, what: 'Practice' });
    const second = act(ECON, 'book', { room: BIG_ROOM, when: SOON, what: 'A talk' });
    await clubs.review(mun(), first);
    await clubs.review(econ(), second);
    await clubs.execute(mun(), first, nextKey());
    await expect(clubs.execute(econ(), second, nextKey())).rejects.toThrow(/is held by/);
  });

  it('refuses a room that does not exist, a time that is not one, and a time in the past', async () => {
    await expect(go(mun(), MUN, 'book', { room: 'nowhere', when: SOON, what: 'X' })).rejects.toThrow(/No such room/);
    await expect(go(mun(), MUN, 'book', { room: BIG_ROOM, when: 'whenever', what: 'X' })).rejects.toThrow(/ISO/);
    await expect(
      go(mun(), MUN, 'book', { room: BIG_ROOM, when: '2026-01-01T09:00:00.000Z', what: 'X' }),
    ).rejects.toThrow(/already passed/);
  });

  it('gives it back, and another club can then have it', async () => {
    await go(mun(), MUN, 'book', { room: BIG_ROOM, when: SOON, what: 'Practice' });
    const id = `${BIG_ROOM}::${SOON}`;
    await go(mun(), id, 'release-room');
    await expect(go(econ(), ECON, 'book', { room: BIG_ROOM, when: SOON, what: 'A talk' })).resolves.toBeTruthy();
  });

  it('refuses another club giving back a room they do not hold', async () => {
    await go(mun(), MUN, 'book', { room: BIG_ROOM, when: SOON, what: 'Practice' });
    await expect(go(econ(), `${BIG_ROOM}::${SOON}`, 'release-room')).rejects.toThrow(/Only H. Osei/);
  });
});

describe('the ballot, which has to be counted and secret at once', () => {
  it('lets a member vote, and the receipt does not say what for', async () => {
    await joinClub(1);
    const receipt = await vote(1, 'A. Osei');
    expect(receipt.message).toContain(SANDBOX_MARK);
    expect(receipt.message, 'the receipt named the choice').not.toContain('A. Osei');
    expect(receipt.message).toMatch(/not recorded against your name/i);
  });

  it('counts it', async () => {
    await joinClub(1);
    await vote(1, 'A. Osei');
    expect(tally(store, store.election(POLL)!)['A. Osei']).toBe(1);
  });

  it('refuses a second vote from the same person', async () => {
    await joinClub(1);
    await vote(1);
    await expect(vote(1, 'B. Farouk')).rejects.toThrow(/already voted/);
  });

  it('and the second vote leaves the count alone', async () => {
    await joinClub(1);
    await vote(1, 'A. Osei');
    await expect(vote(1, 'B. Farouk')).rejects.toThrow(/already voted/);
    expect(tally(store, store.election(POLL)!)['B. Farouk']).toBe(0);
    expect(store.ballots(POLL).length).toBe(1);
  });

  it('refuses it at the commit too, in case the review was taken twice', async () => {
    await joinClub(1);
    const input = act(POLL, 'vote', { choice: 'A. Osei' });
    const again = act(POLL, 'vote', { choice: 'B. Farouk' });
    await clubs.review(student(1), input);
    await clubs.review(student(1), again);
    await clubs.execute(student(1), input, nextKey());
    await expect(clubs.execute(student(1), again, nextKey())).rejects.toThrow(/already voted/);
  });

  it('refuses a non-member', async () => {
    await expect(vote(1)).rejects.toThrow(/Only members of Model United Nations/);
  });

  it('refuses somebody who left before voting', async () => {
    await joinClub(1);
    await go(student(1), MUN, 'leave');
    await expect(vote(1)).rejects.toThrow(/Only members of/);
  });

  it('refuses a poll that has not opened', async () => {
    await joinClub(1, ECON);
    await expect(vote(1, 'R. Devi', LATER_POLL)).rejects.toThrow(/opens on 2026-11-01/);
  });

  it('refuses a poll that has closed', async () => {
    await joinClub(1);
    today = new Date('2026-10-01T12:00:00.000Z');
    await expect(vote(1)).rejects.toThrow(/closed on 2026-09-30/);
  });

  it('refuses a candidate who is not standing', async () => {
    await joinClub(1);
    await expect(vote(1, 'Somebody Else')).rejects.toThrow(/is not standing/);
  });

  it('refuses naming nobody', async () => {
    await joinClub(1);
    await expect(clubs.review(student(1), act(POLL, 'vote', {}))).rejects.toThrow(/Name the candidate/);
  });

  it('refuses an action an election does not have', async () => {
    await expect(clubs.review(student(1), act(POLL, 'annul'))).rejects.toThrow(
      /not something an election can do/,
    );
  });
});

describe('the secrecy, asserted against what is actually stored', () => {
  it('keeps the roll and the box in two sets of rows with nothing in common', async () => {
    /*
     * The test that matters. It reads the *stored* rows rather than the
     * adapter's output, because the claim is about what somebody holding the
     * database could reconstruct — and an adapter that simply declined to
     * return the join would pass a test of its output while storing it.
     */
    for (const n of [1, 2, 3]) await joinClub(n);
    await vote(1, 'A. Osei');
    await vote(2, 'B. Farouk');
    await vote(3, 'A. Osei');

    const marks = store.roll(POLL);
    const papers = store.ballots(POLL);
    expect(marks.length).toBe(3);
    expect(papers.length).toBe(3);

    const inMarks = new Set(marks.flatMap((m) => Object.values(m).map(String)));
    const inPapers = new Set(papers.flatMap((p) => Object.values(p).map(String)));
    // The election id is on both by construction and is not a link to anybody.
    inMarks.delete(POLL);
    inPapers.delete(POLL);

    for (const value of inPapers) {
      expect(inMarks.has(value), `the value ${value} appears on both the roll and a paper`).toBe(false);
    }
  });

  it('carries no voter on any paper, under any key', async () => {
    await joinClub(1);
    await vote(1, 'A. Osei');
    const said = JSON.stringify(store.ballots(POLL));
    expect(said, 'a paper named its voter').not.toContain('student-1');
  });

  it('carries no choice on any mark, under any key', async () => {
    await joinClub(1);
    await vote(1, 'A. Osei');
    const said = JSON.stringify(store.roll(POLL));
    expect(said, 'the roll recorded a choice').not.toContain('A. Osei');
    // The control: the roll does record that this person voted.
    expect(said).toContain('student-1');
  });

  it('gives two identical votes different paper ids, so a paper is not a fingerprint', async () => {
    await joinClub(1);
    await joinClub(2);
    await vote(1, 'A. Osei');
    await vote(2, 'A. Osei');
    const [a, b] = store.ballots(POLL);
    expect(a.id).not.toBe(b.id);
    // And neither id is derivable from the voter, which is what makes it safe.
    expect(a.id).not.toContain('student');
    expect(b.id).not.toContain('student');
  });

  it('publishes turnout during the poll but not the count by candidate', async () => {
    await joinClub(1);
    await joinClub(2);
    await vote(1, 'A. Osei');
    const said = await everything(student(2), POLL);
    /*
     * Turnout is not a result, so it is published. A running total by
     * candidate during an open poll tells late voters which way it is going,
     * which is a thing elections take trouble to avoid.
     */
    expect(said).toContain('Votes cast');
    expect(said).toContain('Standing');
    expect(said, 'a running count by candidate was published mid-poll').not.toMatch(/A\. Osei[^}]*1 vote/);
  });

  it('and publishes the count by candidate once the poll has shut', async () => {
    await joinClub(1);
    await vote(1, 'A. Osei');
    today = new Date('2026-10-01T12:00:00.000Z');
    const said = await everything(student(1), POLL);
    expect(said).toMatch(/A\. Osei[^}]*1 vote/);
  });

  it('tells each reader whether they voted and never whether anybody else did', async () => {
    await joinClub(1);
    await joinClub(2);
    await vote(1, 'A. Osei');
    expect(await everything(student(1), POLL)).toContain('Voted');
    const other = await everything(student(2), POLL);
    expect(other).toContain('Not yet voted');
    expect(other, 'one member could see that another had voted').not.toContain('student-1');
  });

  it('and a vote already cast survives leaving the club, because it cannot be found', async () => {
    await joinClub(1);
    await vote(1, 'A. Osei');
    await go(student(1), MUN, 'leave');
    expect(tally(store, store.election(POLL)!)['A. Osei']).toBe(1);
  });
});

describe('the review, asked on its own', () => {
  /*
   * Every refusal in this area is made twice — once so the person is told and
   * once so the world cannot have moved in between — and for five of them the
   * mutation harness found that only the *commit* was load-bearing in this
   * suite. Removing the review's own check left everything green, because the
   * helper that drives both phases could not tell which one had refused.
   *
   * That is not a cosmetic gap. A review that says go ahead before a commit
   * that says no is the exact failure two phases exist to prevent, and it is
   * worse here than elsewhere: an officer told at the commit that the room was
   * taken has already told somebody the meeting is happening.
   */
  it('refuses a room in the past', async () => {
    await expect(
      clubs.review(mun(), act(MUN, 'book', { room: BIG_ROOM, when: '2026-01-01T09:00:00.000Z', what: 'X' })),
    ).rejects.toThrow(/already passed/);
  });

  it('refuses joining a club somebody is already in', async () => {
    await joinClub(1);
    await expect(clubs.review(student(1), act(MUN, 'join', { name: 'Student 1' }))).rejects.toThrow(
      /already a member/,
    );
  });

  it('refuses somebody who is not a student joining', async () => {
    await expect(clubs.review(who('staffer', 'staff'), act(MUN, 'join', { name: 'X' }))).rejects.toThrow(
      /Only a student can join/,
    );
  });

  it('refuses dues on a club that charges none', async () => {
    await joinClub(1, ECON);
    await expect(clubs.review(econ(), act(ECON, 'settle', { who: 'student-1' }))).rejects.toThrow(
      /does not charge dues/,
    );
  });

  it('refuses dues already recorded as settled', async () => {
    await joinClub(1);
    await go(mun(), MUN, 'settle', { who: 'student-1' });
    await expect(clubs.review(mun(), act(MUN, 'settle', { who: 'student-1' }))).rejects.toThrow(
      /already recorded as settled/,
    );
  });
});

describe('the gateway’s own guarantees, kept here', () => {
  it('returns the same receipt for a retried vote rather than voting twice', async () => {
    await joinClub(1);
    const input = act(POLL, 'vote', { choice: 'A. Osei' });
    await clubs.review(student(1), input);
    const first = await clubs.execute(student(1), input, 'same-key');
    const again = await clubs.execute(student(1), input, 'same-key');
    expect(again).toEqual(first);
    expect(store.ballots(POLL).length).toBe(1);
  });

  it('answers null for a record that is not there, rather than throwing', async () => {
    expect(await clubs.get(student(), 'no-such-thing')).toBeNull();
  });

  it('refuses an action a club does not have', async () => {
    await expect(go(mun(), MUN, 'disband')).rejects.toThrow(/not something a club can do/);
  });

  it('moves the version when the budget moves, so a stale review is caught', async () => {
    const before = (await clubs.get(mun(), MUN))?.version;
    await go(mun(), MUN, 'claim', { what: 'X', amount: '10' });
    expect((await clubs.get(mun(), MUN))?.version).not.toBe(before);
  });

  it('carries the poll close as a date, not only as a sentence', async () => {
    expect((await clubs.get(student(), POLL))?.dates?.[0]?.at).toBe(store.election(POLL)!.closes);
  });
});
