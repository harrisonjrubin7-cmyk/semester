import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PLAN_CHANGE_BY, SANDBOX_INSTITUTION, SANDBOX_MARK, SandboxStore } from './sandbox.ts';
import {
  changeCosts,
  coolingOff,
  diningAdapter,
  filled,
  housingAdapter,
  planShut,
  plusDays,
} from './housing.ts';
import type { AdapterContext, InstitutionAdapter } from './adapter.ts';
import type { ActionInput, UniversityArea, UniversityRole } from '../../../packages/institution/src/index.ts';

/**
 * Housing and dining, and the two things in them this repository had not met.
 *
 * **A signature**, which binds — and whose cooling-off window is the only
 * reason offering one in software is honest. Most of the housing tests are
 * about the boundary of that window, on both sides and on the day itself, and
 * about the commit checking it again: a review read on the last day can be
 * committed on the next, and on that day the answer is different.
 *
 * **A computed amount**, which is the meal plan change. The property asserted
 * is not a formula but an absence: `changeCosts` is exercised over *every pair
 * of plans* on both sides of the deadline and required never to come out
 * negative, because a refund the dining contract does not give is the software
 * lying about somebody's money.
 *
 * Phase 4's gates are not satisfied. No building here exists and nobody is
 * housed anywhere.
 */

let dir = '';
let store: SandboxStore;
let housing: InstitutionAdapter;
let dining: InstitutionAdapter;
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

const SINGLE = 'kissam-201';
const DOUBLE = 'kissam-202';
const OTHER = 'highland-3a';

let keys = 0;
const nextKey = () => `k${++keys}`;

async function go(a: InstitutionAdapter, context: AdapterContext, area: UniversityArea, id: string, actionId: string, fields: Record<string, string> = {}) {
  const input = act(area, id, actionId, fields);
  await a.review(context, input);
  return a.execute(context, input, nextKey());
}

const applyFor = (n = 1, wants = SINGLE) =>
  go(housing, student(n), 'housing', SINGLE, 'apply-housing', { wants });

/** The office answering, which is `reconcile` — see the adapter. */
const assign = (n = 1) =>
  housing.reconcile!(student(n), act('housing', `student-${n}`, 'assign'), nextKey());

const appId = (n = 1) => `housing::student-${n}`;

const onApp = (n: number, actionId: string) => go(housing, student(n), 'housing', appId(n), actionId);

const pickPlan = (n: number, plan: string) => go(dining, student(n), 'dining', plan, 'choose-plan');

const everything = async (a: InstitutionAdapter, context: AdapterContext, id: string) =>
  JSON.stringify((await a.get(context, id)) ?? {});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'housing-'));
  store = new SandboxStore(join(dir, 'sandbox.sqlite'));
  today = new Date('2026-09-20T12:00:00.000Z');
  housing = housingAdapter(store, () => today);
  dining = diningAdapter(store, () => today);
  keys = 0;
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('what the sandbox housing office opens with', () => {
  it('lists rooms, all marked SANDBOX', async () => {
    const got = await housing.list(student(), { search: '', cursor: null });
    expect(got.records.length).toBeGreaterThan(0);
    for (const r of got.records) expect(r.title.startsWith(`${SANDBOX_MARK} · `)).toBe(true);
  });

  it('carries a double, so the third applicant meets the refusal', () => {
    expect(store.space(DOUBLE)!.beds).toBe(2);
  });

  it('says it is a sandbox in both connections', async () => {
    expect((await housing.status(student())).provider).toContain(SANDBOX_MARK);
    expect((await dining.status(student())).provider).toContain(SANDBOX_MARK);
  });
});

describe('applying, which binds nobody', () => {
  it('works, and the receipt says nobody is housed', async () => {
    const receipt = await applyFor(1);
    expect(receipt.message).toContain(SANDBOX_MARK);
    expect(receipt.message).toMatch(/nobody is housed/i);
    expect(store.housingOf('student-1')?.state).toBe('applied');
  });

  it('takes no bed — applying is not being assigned', async () => {
    await applyFor(1, `${SINGLE}`);
    expect(filled(store, SINGLE)).toBe(0);
  });

  it('says so in the review, in those words', async () => {
    const review = await housing.review(student(1), act('housing', SINGLE, 'apply-housing', { wants: SINGLE }));
    expect(JSON.stringify(review)).toMatch(/binds nobody/i);
  });

  it('refuses a second application while one is live', async () => {
    await applyFor(1);
    await expect(applyFor(1)).rejects.toThrow(/already have a housing application/);
  });

  it('but allows a new one after withdrawing', async () => {
    await applyFor(1);
    await onApp(1, 'withdraw-housing');
    await expect(applyFor(1, OTHER)).resolves.toBeTruthy();
  });

  it('refuses a room that does not exist', async () => {
    await expect(applyFor(1, 'kissam-999')).rejects.toThrow(/no room called kissam-999/);
  });

  it('refuses naming no preferences at all', async () => {
    await expect(
      housing.review(student(1), act('housing', SINGLE, 'apply-housing', { wants: '  ,  ' })),
    ).rejects.toThrow(/at least one room/);
  });

  it('refuses somebody who is not a student', async () => {
    await expect(
      go(housing, who('staffer', 'staff'), 'housing', SINGLE, 'apply-housing', { wants: SINGLE }),
    ).rejects.toThrow(/Only a student can apply/);
  });
});

describe('the office answering, and the bed it takes', () => {
  it('assigns the first preference with a bed free', async () => {
    await applyFor(1, `${SINGLE},${OTHER}`);
    await assign(1);
    expect(store.housingOf('student-1')?.room).toBe(SINGLE);
    expect(filled(store, SINGLE)).toBe(1);
  });

  it('falls through to the next when the first is full', async () => {
    await applyFor(1, SINGLE);
    await assign(1);
    await applyFor(2, `${SINGLE},${OTHER}`);
    await assign(2);
    expect(store.housingOf('student-2')?.room).toBe(OTHER);
  });

  it('fits two in a double and refuses a third', async () => {
    for (const n of [1, 2]) {
      await applyFor(n, DOUBLE);
      await assign(n);
    }
    expect(filled(store, DOUBLE)).toBe(2);
    await applyFor(3, DOUBLE);
    await expect(assign(3)).rejects.toThrow(/has a bed free/);
  });

  it('refuses answering an application that is not waiting', async () => {
    await applyFor(1);
    await assign(1);
    await expect(assign(1)).rejects.toThrow(/not waiting on the office/);
  });

  it('refuses an application that does not exist', async () => {
    await expect(housing.reconcile!(student(9), act('housing', 'student-9', 'assign'), nextKey())).rejects.toThrow(
      /No such housing application/,
    );
  });

  it('never shows a room-mate’s name on the room', async () => {
    for (const n of [1, 2]) {
      await applyFor(n, DOUBLE);
      await assign(n);
    }
    const said = await everything(housing, student(1), DOUBLE);
    expect(said, 'a room-mate’s name was disclosed').not.toContain('student-2');
    // The control: the occupancy count is not hidden, only who.
    expect(said).toContain('2 of 2 taken');
  });
});

describe('signing, which binds', () => {
  it('says the figure and the date it becomes unbreakable, before anything happens', async () => {
    await applyFor(1);
    await assign(1);
    const review = await housing.review(student(1), act('housing', appId(1), 'sign'));
    const said = JSON.stringify(review);
    expect(said).toContain('$11,800.00');
    expect(said).toMatch(/whether or not you live there/i);
    expect(said).toContain(plusDays('2026-09-20', 7));
  });

  it('makes a contract with a cooling-off date', async () => {
    await applyFor(1);
    await assign(1);
    await onApp(1, 'sign');
    const c = store.contractOf('student-1')!;
    expect(c.state).toBe('signed');
    expect(c.cents).toBe(1_180_000);
    expect(c.coolingOff).toBe('2026-09-27');
  });

  it('refuses when nothing is assigned', async () => {
    await applyFor(1);
    await expect(onApp(1, 'sign')).rejects.toThrow(/no room assigned to you/);
  });

  it('refuses signing twice', async () => {
    await applyFor(1);
    await assign(1);
    await onApp(1, 'sign');
    await expect(onApp(1, 'sign')).rejects.toThrow(/no room assigned to you/);
  });

  it('refuses withdrawing once signed, and says what to do instead', async () => {
    await applyFor(1);
    await assign(1);
    await onApp(1, 'sign');
    await expect(onApp(1, 'withdraw-housing')).rejects.toThrow(/Cancel the contract instead/);
  });

  it('refuses somebody with no application at all', async () => {
    await expect(onApp(1, 'sign')).rejects.toThrow(/no housing application/);
  });
});

describe('the cooling-off window, which is the whole of why signing is offered', () => {
  const sign = async (n = 1) => {
    await applyFor(n);
    await assign(n);
    await onApp(n, 'sign');
  };

  it('lets somebody out inside it, owing nothing', async () => {
    await sign();
    await onApp(1, 'cancel-contract');
    expect(store.contractOf('student-1')?.state).toBe('cancelled');
    expect(store.housingOf('student-1')?.state).toBe('ended');
  });

  it('and the bed goes back', async () => {
    await sign();
    expect(filled(store, SINGLE)).toBe(1);
    await onApp(1, 'cancel-contract');
    expect(filled(store, SINGLE)).toBe(0);
  });

  it('allows it on the last day itself', async () => {
    await sign();
    today = new Date(`${store.contractOf('student-1')!.coolingOff}T23:00:00.000Z`);
    await expect(onApp(1, 'cancel-contract')).resolves.toBeTruthy();
  });

  it('refuses the day after, and names a person rather than a button', async () => {
    await sign();
    today = new Date('2026-09-28T00:30:00.000Z');
    await expect(onApp(1, 'cancel-contract')).rejects.toThrow(
      /only the housing office can release you from it/i,
    );
  });

  it('and the refusal says what is owed, because that is the thing being decided', async () => {
    await sign();
    today = new Date('2026-09-28T00:30:00.000Z');
    await expect(onApp(1, 'cancel-contract')).rejects.toThrow(/\$11,800\.00/);
  });

  it('is checked again at the commit, because a review read on the last day is pressed on the next', async () => {
    await sign();
    const input = act('housing', appId(1), 'cancel-contract');
    await housing.review(student(1), input);
    today = new Date('2026-09-28T00:30:00.000Z');
    await expect(housing.execute(student(1), input, nextKey())).rejects.toThrow(/housing office can release you/);
  });

  it('refuses when there is no contract', async () => {
    await applyFor(1);
    await expect(onApp(1, 'cancel-contract')).rejects.toThrow(/no signed housing contract/);
  });

  it('refuses cancelling twice', async () => {
    await sign();
    await onApp(1, 'cancel-contract');
    await expect(onApp(1, 'cancel-contract')).rejects.toThrow(/no signed housing contract/);
  });

  it('offers no cancel action at all once the window has gone', async () => {
    await sign();
    today = new Date('2026-09-28T00:30:00.000Z');
    const r = await housing.get(student(1), appId(1));
    expect((r?.actions ?? []).map((a) => a.id)).not.toContain('cancel-contract');
  });

  it('coolingOff is a day comparison, inclusive of the last day', async () => {
    await sign();
    const c = store.contractOf('student-1')!;
    expect(coolingOff(c, new Date(`${c.coolingOff}T23:59:59.000Z`))).toBe(true);
    expect(coolingOff(c, new Date('2026-09-28T00:00:01.000Z'))).toBe(false);
  });

  it('plusDays crosses a month end correctly', () => {
    expect(plusDays('2026-09-27', 7)).toBe('2026-10-04');
    expect(plusDays('2026-12-30', 7)).toBe('2027-01-06');
  });

  it('refuses an action a housing record does not have', async () => {
    await applyFor(1);
    await expect(housing.review(student(1), act('housing', appId(1), 'evict'))).rejects.toThrow(
      /not something a housing record can do/,
    );
  });
});

/* ── Dining ─────────────────────────────────────────────────────────────── */

describe('the meal plan, where the amount is computed', () => {
  it('lists every plan, marked, including a commuter plan that costs nothing', async () => {
    const got = await dining.list(student(), { search: '', cursor: null });
    for (const r of got.records) expect(r.title.startsWith(`${SANDBOX_MARK} · `)).toBe(true);
    expect(store.plan('commuter')!.termCents).toBe(0);
  });

  it('takes a first choice at its full term price', async () => {
    const receipt = await pickPlan(1, 'twelve');
    expect(receipt.message).toMatch(/nothing was charged/i);
    expect(store.planOf('student-1')?.plan).toBe('twelve');
  });

  it('charges only the difference on an upgrade', async () => {
    await pickPlan(1, 'twelve');
    const review = await dining.review(student(1), act('dining', 'nineteen', 'choose-plan'));
    // 304,000 − 231,000 = 73,000 cents.
    expect(JSON.stringify(review)).toContain('$730.00');
  });

  it('allows a downgrade before the deadline, and gives nothing back', async () => {
    await pickPlan(1, 'nineteen');
    const review = await dining.review(student(1), act('dining', 'twelve', 'choose-plan'));
    expect(JSON.stringify(review)).toMatch(/Nothing is given back/i);
    await expect(pickPlan(1, 'twelve')).resolves.toBeTruthy();
  });

  it('refuses a downgrade after the deadline, and says why rather than only that', async () => {
    await pickPlan(1, 'nineteen');
    today = new Date('2026-09-26T12:00:00.000Z');
    await expect(pickPlan(1, 'twelve')).rejects.toThrow(/already bought and nothing is given back/);
  });

  it('but still allows an upgrade after it, because nothing has to be given back', async () => {
    await pickPlan(1, 'twelve');
    today = new Date('2026-09-26T12:00:00.000Z');
    await expect(pickPlan(1, 'unlimited')).resolves.toBeTruthy();
  });

  it('allows the change on the deadline day itself', async () => {
    await pickPlan(1, 'nineteen');
    today = new Date(`${PLAN_CHANGE_BY}T23:00:00.000Z`);
    await expect(pickPlan(1, 'twelve')).resolves.toBeTruthy();
  });

  it('is refused at the commit too, because a review on the deadline is pressed after it', async () => {
    await pickPlan(1, 'nineteen');
    const input = act('dining', 'twelve', 'choose-plan');
    await dining.review(student(1), input);
    today = new Date('2026-09-26T12:00:00.000Z');
    await expect(dining.execute(student(1), input, nextKey())).rejects.toThrow(/already bought/);
  });

  it('refuses moving to the plan somebody is already on', async () => {
    await pickPlan(1, 'twelve');
    await expect(pickPlan(1, 'twelve')).rejects.toThrow(/already on 12 meals a week/);
  });

  it('refuses a plan that does not exist', async () => {
    await expect(pickPlan(1, 'banquet')).rejects.toThrow(/No such meal plan/);
  });

  it('refuses somebody who is not a student', async () => {
    await expect(
      go(dining, who('staffer', 'staff'), 'dining', 'twelve', 'choose-plan'),
    ).rejects.toThrow(/Only a student can change/);
  });

  it('refuses an action a plan does not have', async () => {
    await expect(dining.review(student(1), act('dining', 'twelve', 'cater'))).rejects.toThrow(
      /not something a meal plan can do/,
    );
  });

  it('offers no action on a downgrade once the deadline has gone', async () => {
    await pickPlan(1, 'nineteen');
    today = new Date('2026-09-26T12:00:00.000Z');
    expect((await dining.get(student(1), 'twelve'))?.actions ?? []).toEqual([]);
    // The control: the upgrade is still offered.
    expect(((await dining.get(student(1), 'unlimited'))?.actions ?? []).length).toBe(1);
  });
});

describe('what a change costs, over every pair of plans', () => {
  it('is never negative, on either side of the deadline', () => {
    /*
     * The property, asserted exhaustively rather than argued. A refund the
     * dining contract does not give is the software lying about somebody's
     * money, and the guarantee wanted here is not a formula but an absence —
     * so it is checked over every ordered pair of plans and both sides of the
     * deadline, rather than over the two examples somebody thought of.
     */
    const plans = store.plans();
    expect(plans.length).toBeGreaterThan(2);
    for (const from of plans) {
      for (const to of plans) {
        expect(changeCosts(from, to), `${from.id} → ${to.id}`).toBeGreaterThanOrEqual(0);
      }
    }
    // And the control: at least one pair does cost something, so this is not
    // a suite of zeroes passing a test about signs.
    expect(plans.some((f) => plans.some((t) => changeCosts(f, t) > 0))).toBe(true);
  });

  it('a first plan costs its whole term price', () => {
    expect(changeCosts(null, store.plan('nineteen')!)).toBe(304_000);
  });

  it('planShut is a day comparison, inclusive of the deadline itself', () => {
    expect(planShut(new Date(`${PLAN_CHANGE_BY}T23:59:59.000Z`))).toBe(false);
    expect(planShut(new Date('2026-09-26T00:00:01.000Z'))).toBe(true);
  });
});

describe('the review, asked on its own', () => {
  /*
   * Three refusals whose review-phase copy the mutation harness found to be
   * untested: removing it left the suite green because `execute` caught
   * everything, and the helper driving both phases cannot say which one
   * refused. It is the same finding Phase 4 has now produced in every area,
   * and it lands hardest here — somebody told at the *commit* that their
   * contract is binding has already pressed the button believing it was not.
   */
  const sign = async (n = 1) => {
    await applyFor(n);
    await assign(n);
    await onApp(n, 'sign');
  };

  it('refuses cancelling after the cooling-off window', async () => {
    await sign();
    today = new Date('2026-09-28T00:30:00.000Z');
    await expect(housing.review(student(1), act('housing', appId(1), 'cancel-contract'))).rejects.toThrow(
      /housing office can release you/,
    );
  });

  it('refuses withdrawing a room already signed for', async () => {
    await sign();
    await expect(housing.review(student(1), act('housing', appId(1), 'withdraw-housing'))).rejects.toThrow(
      /Cancel the contract instead/,
    );
  });

  it('refuses a second application while one is live', async () => {
    await applyFor(1);
    await expect(
      housing.review(student(1), act('housing', SINGLE, 'apply-housing', { wants: SINGLE })),
    ).rejects.toThrow(/already have a housing application/);
  });

  it('and refuses a non-student at the commit as well as the review', async () => {
    const input = act('housing', SINGLE, 'apply-housing', { wants: SINGLE });
    const staffer = who('staffer', 'staff');
    await expect(housing.review(staffer, input)).rejects.toThrow(/Only a student can apply/);
    // Straight to the commit, the way a request that skipped the review would.
    await expect(housing.execute(staffer, input, nextKey())).rejects.toThrow(/Only a student can apply/);
  });
});

describe('the gateway’s own guarantees, kept here', () => {
  it('returns the same receipt for a retried housing key', async () => {
    const input = act('housing', SINGLE, 'apply-housing', { wants: SINGLE });
    await housing.review(student(1), input);
    const first = await housing.execute(student(1), input, 'same-key');
    const again = await housing.execute(student(1), input, 'same-key');
    expect(again).toEqual(first);
  });

  it('and for a retried meal plan key', async () => {
    const input = act('dining', 'twelve', 'choose-plan');
    await dining.review(student(1), input);
    const first = await dining.execute(student(1), input, 'same-key');
    const again = await dining.execute(student(1), input, 'same-key');
    expect(again).toEqual(first);
    expect(store.planOf('student-1')?.version).toBe(1);
  });

  it('answers null for records that are not there', async () => {
    expect(await housing.get(student(), 'no-such-room')).toBeNull();
    expect(await dining.get(student(), 'no-such-plan')).toBeNull();
  });

  it('shows one student nothing of another student’s application', async () => {
    await applyFor(1);
    expect(await housing.get(student(2), appId(1))).toBeNull();
  });

  it('moves the version when a bed is taken, so a stale review is caught', async () => {
    const before = (await housing.get(student(2), SINGLE))?.version;
    await applyFor(1);
    await assign(1);
    expect((await housing.get(student(2), SINGLE))?.version).not.toBe(before);
  });

  it('carries the meal plan deadline as a date, not only as a sentence', async () => {
    expect((await dining.get(student(), 'twelve'))?.dates?.[0]?.at).toBe(`${PLAN_CHANGE_BY}T23:59:59.000Z`);
  });
});
