import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SANDBOX_INSTITUTION, SANDBOX_MARK, SandboxStore } from './sandbox.ts';
import { careerAdapter, closed, offered, vetted } from './career.ts';
import type { AdapterContext, InstitutionAdapter } from './adapter.ts';
import type { ActionInput, UniversityArea, UniversityRole } from '../../../packages/institution/src/index.ts';

/**
 * Career, and the two things in it that are not a list.
 *
 * The **offer** is finite, and the **pipeline** is private. Everything else a
 * job board does is a query, and the tests are weighted accordingly: most of
 * what follows is a refusal or an absence.
 *
 * On the absences specifically — they are asserted by reading a record as the
 * person who should not see the thing and searching *every detail on it* for
 * the thing, rather than by checking that some flag is false. A flag that is
 * false is a claim about the code that sets it; a field that is not in the
 * record is a claim about what left the server. The second is the one worth
 * making, and a matching control reads the same record as somebody entitled
 * to it and asserts the field *is* there — because a test that only ever
 * looks for an absence passes just as well against a record that is empty.
 *
 * Phase 4 is gated in the build-out plan on Phase 3 sustained through a live
 * pilot plus a university extending trust into official transactions. Nothing
 * here satisfies any of that, and nothing here claims to.
 */

let dir = '';
let store: SandboxStore;
let career: InstitutionAdapter;
let today = new Date('2026-09-20T12:00:00.000Z');

const who = (userId: string, ...roles: UniversityRole[]): AdapterContext => ({
  identity: { userId, institutionId: SANDBOX_INSTITUTION, roles },
  signal: new AbortController().signal,
});

const act = (recordId: string, actionId: string, fields: Record<string, string> = {}): ActionInput => ({
  area: 'career' as UniversityArea,
  recordId,
  version: '0',
  actionId,
  fields,
});

const student = (n = 1) => who(`student-${n}`, 'student');
/*
 * An employer is not a role. It is a row the career office owns, and the only
 * thing that grants the right to act for one is being named in its `owner`
 * column — so this context carries `staff`, which is true of somebody using a
 * university's employer portal and is not what the authorization turns on.
 */
const harbour = () => who('employer-harbour', 'staff');
const schools = () => who('employer-schools', 'staff');
const quickcash = () => who('employer-quickcash', 'staff');
const oldfield = () => who('employer-oldfield', 'staff');

const OPEN = 'harbour-analyst-intern';
const ONE_OPENING = 'harbour-grad-analyst';
const SHUT = 'schools-tutor';

let keys = 0;
const nextKey = () => `k${++keys}`;

/** Apply, through both phases, the way the gateway would. */
async function apply(context: AdapterContext, listing = OPEN, note = 'because') {
  const input = act(listing, 'apply', { note });
  await career.review(context, input);
  return career.execute(context, input, nextKey());
}

/** An employer's move on a named applicant, through both phases. */
async function move(context: AdapterContext, listing: string, actionId: string, applicant: string) {
  const input = act(listing, actionId, { who: applicant });
  await career.review(context, input);
  return career.execute(context, input, nextKey());
}

/** A student's move on their own application, through both phases. */
async function mine(context: AdapterContext, listing: string, actionId: string) {
  const input = act(listing, actionId);
  await career.review(context, input);
  return career.execute(context, input, nextKey());
}

/** Everything a record actually carries, as one string, for absence tests. */
const everything = async (context: AdapterContext, id: string) => {
  const r = await career.get(context, id);
  return JSON.stringify(r ?? {});
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'career-'));
  store = new SandboxStore(join(dir, 'sandbox.sqlite'));
  today = new Date('2026-09-20T12:00:00.000Z');
  career = careerAdapter(store, () => today);
  keys = 0;
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('what the sandbox career office opens with', () => {
  it('lists every posting, and every one of them says SANDBOX', async () => {
    const got = await career.list(student(), { search: '', cursor: null });
    expect(got.records.length).toBeGreaterThan(0);
    for (const r of got.records) expect(r.title.startsWith(`${SANDBOX_MARK} · `)).toBe(true);
  });

  it('carries an employer in each of the three states, so each refusal is walkable', () => {
    const states = store.employers().map((e) => e.state);
    expect(states).toContain('approved');
    expect(states).toContain('pending');
    expect(states).toContain('suspended');
  });

  it('carries a listing that has already closed', () => {
    const shut = store.listing(SHUT);
    expect(shut).not.toBeNull();
    expect(closed(shut!, today)).toBe(true);
  });

  it('and one with a single opening, so the second offer meets the limit', () => {
    expect(store.listing(ONE_OPENING)?.openings).toBe(1);
  });

  it('says it is a sandbox in its connection status', async () => {
    const status = await career.status(student());
    expect(status.provider).toContain(SANDBOX_MARK);
    expect(status.canWrite).toBe(true);
  });

  it('and offers an employer write access too, without their holding a student role', async () => {
    expect((await career.status(harbour())).canWrite).toBe(true);
    // The control: somebody who is neither.
    expect((await career.status(who('nobody', 'staff'))).canWrite).toBe(false);
  });
});

describe('applying', () => {
  it('works, and the receipt says nothing was sent to anybody', async () => {
    const receipt = await apply(student());
    expect(receipt.status).toBe('completed');
    expect(receipt.message).toContain(SANDBOX_MARK);
    expect(receipt.message).toMatch(/nothing was sent/i);
  });

  it('is refused after the closing day', async () => {
    await expect(apply(student(), SHUT)).rejects.toThrow(/closed on 2026-09-10/);
  });

  it('is refused twice to the same listing', async () => {
    await apply(student());
    await expect(apply(student())).rejects.toThrow(/You applied to/);
  });

  it('is refused to a listing whose employer is not approved', async () => {
    store.saveListing({
      id: 'quickcash-thing',
      employer: 'quickcash-partners',
      title: 'Something',
      kind: 'Job',
      where: 'Anywhere',
      pay: '$0',
      openings: 1,
      closes: '2026-12-01',
      at: today.toISOString(),
    });
    await expect(apply(student(), 'quickcash-thing')).rejects.toThrow(/not currently approved/);
  });

  it('is refused by somebody who is not a student', async () => {
    await expect(apply(harbour())).rejects.toThrow(/Only a student can apply/);
  });

  it('and the not-approved refusal names the employer, so it can be acted on', async () => {
    store.saveListing({
      id: 'oldfield-thing',
      employer: 'oldfield-group',
      title: 'Something',
      kind: 'Job',
      where: 'Anywhere',
      pay: '$0',
      openings: 1,
      closes: '2026-12-01',
      at: today.toISOString(),
    });
    await expect(apply(student(), 'oldfield-thing')).rejects.toThrow(/Oldfield Group is not currently approved/);
  });

  it('is refused for a listing that does not exist', async () => {
    await expect(apply(student(), 'no-such-listing')).rejects.toThrow(/No such listing/);
  });
});

describe('withdrawing, which is final', () => {
  it('works once', async () => {
    await apply(student());
    const receipt = await mine(student(), OPEN, 'withdraw');
    expect(receipt.status).toBe('completed');
    expect(store.application(`${OPEN}::student-1`)?.state).toBe('withdrawn');
  });

  it('cannot be undone by applying again, and the refusal says why', async () => {
    await apply(student());
    await mine(student(), OPEN, 'withdraw');
    await expect(apply(student())).rejects.toThrow(/already read it/);
  });

  it('is refused twice', async () => {
    await apply(student());
    await mine(student(), OPEN, 'withdraw');
    await expect(mine(student(), OPEN, 'withdraw')).rejects.toThrow(/already withdrawn/);
  });

  it('is refused when there is nothing to withdraw', async () => {
    await expect(mine(student(), OPEN, 'withdraw')).rejects.toThrow(/have not applied/);
  });

  it('takes the withdrawn application out of the employer’s reach', async () => {
    await apply(student());
    await mine(student(), OPEN, 'withdraw');
    await expect(move(harbour(), OPEN, 'shortlist', 'student-1')).rejects.toThrow(/was withdrawn/);
  });
});

describe('the pipeline, which is the employer’s and nobody else’s', () => {
  it('shows the employer who applied to their own posting', async () => {
    await apply(student(1));
    await apply(student(2));
    const said = await everything(harbour(), OPEN);
    expect(said).toContain('student-1');
    expect(said).toContain('student-2');
  });

  it('shows a student nothing of who else applied — not a name, not a count', async () => {
    await apply(student(1));
    await apply(student(2));
    const said = await everything(student(1), OPEN);
    expect(said, 'a student could read another applicant’s name').not.toContain('student-2');
    /*
     * And not the number either. A line reading "2 applications" is a
     * disclosure with the names taken off, and it is the one people leave in.
     *
     * The first version of this probe searched for the bare word and went red
     * against the record's own closing date — "applications close" — which is
     * not a disclosure of anything. A probe that convicts on the feature's own
     * prose is a probe that would have convicted whatever the code did, so it
     * is narrowed to a *count* of them, and the control two lines down asserts
     * the employer's record does match it.
     */
    expect(said).not.toMatch(/\d+ applications?\b/i);
    // The control: their own state is on it, so this is not an empty record.
    expect(said).toContain('student-1');
  });

  it('and the count probe above is one an employer\u2019s record does trip', async () => {
    await apply(student(1));
    await apply(student(2));
    expect(await everything(harbour(), OPEN)).toMatch(/\d+ applications?\b/i);
  });

  it('shows one employer nothing of another employer’s pipeline', async () => {
    await apply(student(1));
    const said = await everything(schools(), OPEN);
    expect(said, 'a competitor could read the pipeline').not.toContain('student-1');
  });

  it('and refuses one employer acting on another’s posting', async () => {
    await apply(student(1));
    await expect(move(schools(), OPEN, 'shortlist', 'student-1')).rejects.toThrow(/belongs to another employer/);
  });

  it('refuses somebody with no employer record at all', async () => {
    await apply(student(1));
    await expect(move(who('nobody', 'staff'), OPEN, 'shortlist', 'student-1')).rejects.toThrow(
      /career office holds a record for/,
    );
  });

  it('refuses a pending employer, differently from one that does not exist', async () => {
    await expect(move(quickcash(), OPEN, 'shortlist', 'student-1')).rejects.toThrow(/awaiting review/);
  });

  it('and refuses a suspended one, saying which', async () => {
    await expect(move(oldfield(), OPEN, 'shortlist', 'student-1')).rejects.toThrow(/suspended/i);
  });

  it('refuses an employer naming somebody who did not apply', async () => {
    await expect(move(harbour(), OPEN, 'shortlist', 'nobody-at-all')).rejects.toThrow(/Nobody by that name/);
  });

  it('refuses an employer naming nobody at all', async () => {
    const input = act(OPEN, 'shortlist', {});
    await expect(career.review(harbour(), input)).rejects.toThrow(/Name the applicant/);
  });
});

describe('the offer, which is the finite thing', () => {
  it('can be made, and moves the application to offered', async () => {
    await apply(student(1), ONE_OPENING);
    await move(harbour(), ONE_OPENING, 'offer', 'student-1');
    expect(store.application(`${ONE_OPENING}::student-1`)?.state).toBe('offered');
  });

  it('is refused once the openings are gone', async () => {
    await apply(student(1), ONE_OPENING);
    await apply(student(2), ONE_OPENING);
    await move(harbour(), ONE_OPENING, 'offer', 'student-1');
    await expect(move(harbour(), ONE_OPENING, 'offer', 'student-2')).rejects.toThrow(/all offered/);
  });

  it('is refused at the review, so the employer is told before they commit', async () => {
    /*
     * The commit-time check below is the one that keeps the promise, and for
     * a while it was the only one tested: removing the review's call to
     * `openingFor` left this suite green, because `execute` caught it a
     * moment later. That is a worse thing than it sounds. The whole point of
     * a two-phase action is that the review tells the truth, and a review
     * that says "go ahead" before a commit that says "no" has turned a
     * refusal into a loss. So both call sites are asserted, separately.
     */
    await apply(student(1), ONE_OPENING);
    await apply(student(2), ONE_OPENING);
    await move(harbour(), ONE_OPENING, 'offer', 'student-1');
    await expect(career.review(harbour(), act(ONE_OPENING, 'offer', { who: 'student-2' }))).rejects.toThrow(
      /all offered/,
    );
  });

  it('is refused at the commit even when the review passed, because a review reserves nothing', async () => {
    await apply(student(1), ONE_OPENING);
    await apply(student(2), ONE_OPENING);
    // Two employers-in-a-tab: both reviews pass, then one commits.
    const first = act(ONE_OPENING, 'offer', { who: 'student-1' });
    const second = act(ONE_OPENING, 'offer', { who: 'student-2' });
    await career.review(harbour(), first);
    await career.review(harbour(), second);
    await career.execute(harbour(), first, nextKey());
    await expect(career.execute(harbour(), second, nextKey())).rejects.toThrow(/all offered/);
  });

  it('comes back when it is declined, so the employer can offer it again', async () => {
    await apply(student(1), ONE_OPENING);
    await apply(student(2), ONE_OPENING);
    await move(harbour(), ONE_OPENING, 'offer', 'student-1');
    await mine(student(1), ONE_OPENING, 'decline');
    expect(offered(store, ONE_OPENING)).toBe(0);
    await move(harbour(), ONE_OPENING, 'offer', 'student-2');
    expect(store.application(`${ONE_OPENING}::student-2`)?.state).toBe('offered');
  });

  it('does not come back when it is accepted', async () => {
    await apply(student(1), ONE_OPENING);
    await apply(student(2), ONE_OPENING);
    await move(harbour(), ONE_OPENING, 'offer', 'student-1');
    await mine(student(1), ONE_OPENING, 'accept');
    expect(offered(store, ONE_OPENING)).toBe(1);
    await expect(move(harbour(), ONE_OPENING, 'offer', 'student-2')).rejects.toThrow(/all offered/);
  });

  it('is refused twice to the same applicant', async () => {
    await apply(student(1));
    await move(harbour(), OPEN, 'offer', 'student-1');
    await expect(move(harbour(), OPEN, 'offer', 'student-1')).rejects.toThrow(/already has an offer/);
  });

  it('can be withdrawn by passing, and the opening comes back', async () => {
    await apply(student(1), ONE_OPENING);
    await move(harbour(), ONE_OPENING, 'offer', 'student-1');
    expect(offered(store, ONE_OPENING)).toBe(1);
    await move(harbour(), ONE_OPENING, 'pass', 'student-1');
    expect(offered(store, ONE_OPENING)).toBe(0);
  });

  it('but an accepted one cannot be taken back here', async () => {
    await apply(student(1), ONE_OPENING);
    await move(harbour(), ONE_OPENING, 'offer', 'student-1');
    await mine(student(1), ONE_OPENING, 'accept');
    await expect(move(harbour(), ONE_OPENING, 'pass', 'student-1')).rejects.toThrow(/cannot be taken back/);
  });
});

describe('accepting an offer settles the others', () => {
  it('declines the student’s other outstanding offers in the same commit', async () => {
    await apply(student(1), OPEN);
    await apply(student(1), ONE_OPENING);
    await move(harbour(), OPEN, 'offer', 'student-1');
    await move(harbour(), ONE_OPENING, 'offer', 'student-1');

    const receipt = await mine(student(1), ONE_OPENING, 'accept');
    expect(store.application(`${ONE_OPENING}::student-1`)?.state).toBe('accepted');
    expect(store.application(`${OPEN}::student-1`)?.state).toBe('declined');
    expect(receipt.message).toMatch(/other offer/i);
  });

  it('and the freed opening is immediately offerable to somebody else', async () => {
    await apply(student(1), OPEN);
    await apply(student(1), ONE_OPENING);
    await apply(student(2), OPEN);
    await move(harbour(), OPEN, 'offer', 'student-1');
    await move(harbour(), ONE_OPENING, 'offer', 'student-1');
    await mine(student(1), ONE_OPENING, 'accept');
    await move(harbour(), OPEN, 'offer', 'student-2');
    expect(store.application(`${OPEN}::student-2`)?.state).toBe('offered');
  });

  it('leaves another student’s offers alone', async () => {
    await apply(student(1), OPEN);
    await apply(student(2), OPEN);
    await apply(student(1), ONE_OPENING);
    await move(harbour(), OPEN, 'offer', 'student-1');
    await move(harbour(), ONE_OPENING, 'offer', 'student-1');
    // student-2 is not offered, so nothing of theirs should move either way.
    await mine(student(1), ONE_OPENING, 'accept');
    expect(store.application(`${OPEN}::student-2`)?.state).toBe('submitted');
  });

  it('says how many will be settled, before it does it', async () => {
    await apply(student(1), OPEN);
    await apply(student(1), ONE_OPENING);
    await move(harbour(), OPEN, 'offer', 'student-1');
    await move(harbour(), ONE_OPENING, 'offer', 'student-1');
    const review = await career.review(student(1), act(ONE_OPENING, 'accept'));
    expect(JSON.stringify(review)).toMatch(/other offers/i);
  });

  it('is refused when there is no offer', async () => {
    await apply(student(1));
    await expect(mine(student(1), OPEN, 'accept')).rejects.toThrow(/no open offer/);
  });

  it('is refused on somebody else’s application', async () => {
    await apply(student(1));
    await move(harbour(), OPEN, 'offer', 'student-1');
    await expect(mine(student(2), OPEN, 'accept')).rejects.toThrow(/have not applied/);
  });
});

describe('closing a posting', () => {
  it('shuts it to further applications from today', async () => {
    await move(harbour(), OPEN, 'close', '');
    expect(closed(store.listing(OPEN)!, today)).toBe(false);
    // Closing sets the last day to today, so tomorrow it is shut.
    expect(closed(store.listing(OPEN)!, new Date('2026-09-21T12:00:00.000Z'))).toBe(true);
  });

  it('is refused by another employer', async () => {
    await expect(move(schools(), OPEN, 'close', '')).rejects.toThrow(/belongs to another employer/);
  });

  it('is refused when it is already closed', async () => {
    await expect(move(schools(), SHUT, 'close', '')).rejects.toThrow(/already closed/);
  });

  it('leaves the applications already made alone', async () => {
    await apply(student(1));
    await move(harbour(), OPEN, 'close', '');
    expect(store.application(`${OPEN}::student-1`)?.state).toBe('submitted');
  });
});

describe('the gateway’s own guarantees, kept here', () => {
  it('returns the same receipt for a retried key rather than acting twice', async () => {
    const input = act(OPEN, 'apply', { note: 'once' });
    await career.review(student(), input);
    const first = await career.execute(student(), input, 'same-key');
    const again = await career.execute(student(), input, 'same-key');
    expect(again).toEqual(first);
    expect(store.applicationsOf('student-1').length).toBe(1);
  });

  it('refuses an action the listing does not have', async () => {
    await expect(career.review(student(), act(OPEN, 'abolish'))).rejects.toThrow(/not something this listing can do/);
  });

  it('answers null for a record that is not there, rather than throwing', async () => {
    expect(await career.get(student(), 'no-such-listing')).toBeNull();
  });

  it('moves the version when the pipeline moves, so a stale review is caught', async () => {
    const before = (await career.get(harbour(), ONE_OPENING))?.version;
    await apply(student(1), ONE_OPENING);
    const after = (await career.get(harbour(), ONE_OPENING))?.version;
    expect(after).not.toBe(before);
  });
});

describe('the helpers, read directly', () => {
  it('vetted is true only for approved', () => {
    expect(vetted(store.employer('harbour-analytics'))).toBe(true);
    expect(vetted(store.employer('quickcash-partners'))).toBe(false);
    expect(vetted(store.employer('oldfield-group'))).toBe(false);
    expect(vetted(null)).toBe(false);
  });

  it('closed is a day comparison, inclusive of the closing day itself', () => {
    const l = store.listing(OPEN)!;
    expect(closed(l, new Date(`${l.closes}T23:59:59.000Z`)), 'the closing day was already shut').toBe(false);
    expect(closed(l, new Date('2026-10-21T00:00:01.000Z'))).toBe(true);
  });

  it('offered counts accepted as well as offered, and nothing else', async () => {
    await apply(student(1), OPEN);
    await apply(student(2), OPEN);
    expect(offered(store, OPEN)).toBe(0);
    await move(harbour(), OPEN, 'shortlist', 'student-1');
    expect(offered(store, OPEN), 'shortlisting spent an opening').toBe(0);
    await move(harbour(), OPEN, 'offer', 'student-1');
    expect(offered(store, OPEN)).toBe(1);
  });
});
