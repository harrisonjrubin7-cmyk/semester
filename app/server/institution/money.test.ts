import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SANDBOX_INSTITUTION, SANDBOX_MARK, SandboxStore, money } from './sandbox.ts';
import { aidAdapter, balance, billingAdapter, cents, owing } from './money.ts';
import type { AdapterContext, InstitutionAdapter } from './adapter.ts';
import type { ActionInput, UniversityArea, UniversityRole } from '../../../packages/institution/src/index.ts';

/**
 * The bill, the aid, and every way of being refused by them.
 *
 * The constraint the source documents put on this domain is one sentence —
 * read access first, *"not a competing processor"* — and the tests that matter
 * are the ones that would catch it being violated: that the amount of an award
 * is never taken from the request, that a payment cannot exceed what is owed,
 * that one student cannot touch another's account, and that a retry does not
 * pay twice.
 *
 * Phase 3 is gated on an institutional agreement, a security review and a
 * legal review including FERPA. None of that is satisfied here and none is
 * claimed: every record is marked and every receipt says no real money moved.
 */

let dir = '';
let store: SandboxStore;
let billing: InstitutionAdapter;
let aid: InstitutionAdapter;
let today = new Date('2026-09-20T12:00:00.000Z');

const who = (userId: string, ...roles: UniversityRole[]): AdapterContext => ({
  identity: { userId, institutionId: SANDBOX_INSTITUTION, roles },
  signal: new AbortController().signal,
});

const act = (
  area: UniversityArea,
  recordId: string,
  version: string,
  actionId: string,
  fields: Record<string, string> = {},
): ActionInput => ({ area, recordId, version, actionId, fields });

const student = (n = 1) => who(`student-${n}`, 'student');
const id = (n: number, tail: string) => `student-${n}::${tail}`;

async function seen(a: InstitutionAdapter, context: AdapterContext, recordId: string) {
  const record = await a.get(context, recordId);
  if (!record) throw new Error(`${recordId} is not visible`);
  return record;
}

/** Do it the way the gateway would: review, then execute. */
async function run(
  a: InstitutionAdapter,
  area: UniversityArea,
  context: AdapterContext,
  recordId: string,
  actionId: string,
  key: string,
  fields: Record<string, string> = {},
) {
  const record = await seen(a, context, recordId);
  const input = act(area, recordId, record.version, actionId, fields);
  await a.review(context, input);
  return a.execute(context, input, key);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'money-'));
  store = new SandboxStore(join(dir, 'sandbox.sqlite'));
  today = new Date('2026-09-20T12:00:00.000Z');
  billing = billingAdapter(store);
  aid = aidAdapter(store, () => today);
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('dollars a person types', () => {
  for (const [said, want] of [
    ['250', 25_000],
    ['250.00', 25_000],
    ['250.5', 25_050],
    ['$1,250.75', 125_075],
    ['  40 ', 4_000],
  ] as [string, number][]) {
    it(`reads ${said} as ${want} cents`, () => expect(cents(said)).toBe(want));
  }

  for (const bad of ['', '   ', 'abc', '10.005', '-5', '0', '1e3', '10.', '.5']) {
    it(`refuses ${JSON.stringify(bad)}`, () => expect(() => cents(bad)).toThrow());
  }

  it('is cents, because money in a float is a bug waiting for a decimal', () => {
    // 0.1 + 0.2 in dollars is the reason this type is an integer.
    expect(cents('0.10') + cents('0.20')).toBe(30);
    expect(money(30)).toBe('$0.30');
  });
});

describe('the account a student opens with', () => {
  it('has a bill, and every line of it says it is a sandbox', async () => {
    const { records } = await billing.list(student(), { search: '', cursor: null });
    expect(records.length).toBe(3);
    for (const r of records) expect(r.title.startsWith(`${SANDBOX_MARK} · `), r.title).toBe(true);
  });

  it('is not doubled by looking at it twice', async () => {
    await billing.list(student(), { search: '', cursor: null });
    await billing.list(student(), { search: '', cursor: null });
    await aid.list(student(), { search: '', cursor: null });
    expect(store.charges('student-1').length).toBe(3);
  });

  it('adds up to a balance that is computed rather than stored', async () => {
    await billing.list(student(), { search: '', cursor: null });
    const { charged, paid, owed } = balance(store, 'student-1');
    expect(charged).toBe(2_950_000 + 68_500 + 640_000);
    expect(paid).toBe(0);
    expect(owed).toBe(charged);
  });

  it('says on the record itself who moves the money', async () => {
    await billing.list(student(), { search: '', cursor: null });
    const r = await seen(billing, student(), id(1, 'tuition-fall'));
    const line = r.details.find((d) => d.label === 'Who moves the money')?.value ?? '';
    expect(line).toContain('The institution does');
    expect(line).toContain('Semester holds no card');
  });

  it('carries the due date as a date and not only as a sentence', async () => {
    await billing.list(student(), { search: '', cursor: null });
    expect((await seen(billing, student(), id(1, 'tuition-fall'))).dates?.[0]?.at).toBe(
      '2026-10-15T23:59:59.000Z',
    );
  });
});

describe('paying', () => {
  beforeEach(async () => {
    await billing.list(student(), { search: '', cursor: null });
  });

  it('reduces what is owed, and the receipt says no real money moved', async () => {
    const receipt = await run(billing, 'billing', student(), id(1, 'activity-fee'), 'pay', 'k1', { amount: '100' });
    expect(receipt.message).toContain('No real money moved and no card was used');
    expect(owing(store.charge(id(1, 'activity-fee'))!)).toBe(68_500 - 10_000);
  });

  it('can settle a charge, which then offers nothing further', async () => {
    await run(billing, 'billing', student(), id(1, 'activity-fee'), 'pay', 'k1', { amount: '685' });
    const r = await seen(billing, student(), id(1, 'activity-fee'));
    expect(r.status).toBe('Paid');
    expect(r.actions).toEqual([]);
  });

  it('refuses more than is owed', async () => {
    await expect(
      run(billing, 'billing', student(), id(1, 'activity-fee'), 'pay', 'k1', { amount: '700' }),
    ).rejects.toThrow(/more than the \$685\.00 still owed/i);
  });

  it('refuses more than is owed at the write boundary too', async () => {
    /*
     * The bill may be paid from somewhere else between the review and the
     * commit — an office, a parent, a different tab. So the check is made
     * again where the write happens, not only where the person reads.
     */
    const record = await seen(billing, student(), id(1, 'activity-fee'));
    const ready = act('billing', id(1, 'activity-fee'), record.version, 'pay', { amount: '685' });
    await billing.review(student(), ready);
    await run(billing, 'billing', student(), id(1, 'activity-fee'), 'pay', 'elsewhere', { amount: '600' });
    await expect(billing.execute(student(), ready, 'k2')).rejects.toThrow(/more than the \$85\.00 still owed/i);
  });

  it('refuses paying something already paid', async () => {
    await run(billing, 'billing', student(), id(1, 'activity-fee'), 'pay', 'k1', { amount: '685' });
    await expect(
      billing.execute(student(), act('billing', id(1, 'activity-fee'), '1', 'pay', { amount: '10' }), 'k2'),
    ).rejects.toThrow(/already paid/i);
  });

  it('does not pay twice when the same request arrives twice', async () => {
    const first = await run(billing, 'billing', student(), id(1, 'activity-fee'), 'pay', 'same', { amount: '100' });
    const again = await billing.execute(
      student(),
      act('billing', id(1, 'activity-fee'), '1', 'pay', { amount: '100' }),
      'same',
    );
    expect(again).toEqual(first);
    expect(store.charge(id(1, 'activity-fee'))!.paid).toBe(10_000);
  });

  it('refuses another student’s account', async () => {
    await billing.list(student(2), { search: '', cursor: null });
    await expect(
      billing.execute(student(2), act('billing', id(1, 'tuition-fall'), '0', 'pay', { amount: '10' }), 'k'),
    ).rejects.toThrow(/not your account/i);
  });

  it('does not even show another student’s account', async () => {
    await billing.list(student(2), { search: '', cursor: null });
    expect(await billing.get(student(2), id(1, 'tuition-fall'))).toBeNull();
  });

  it('refuses somebody with no claim on the account at all', async () => {
    // Not "only the student", which is the message for the account's *owner*
    // holding the wrong role. A stranger is told the truer and less
    // informative thing: it is not theirs.
    await expect(
      billing.execute(who('bursar-1', 'staff'), act('billing', id(1, 'tuition-fall'), '0', 'pay', { amount: '1' }), 'k'),
    ).rejects.toThrow(/not your account/i);
  });

  it('refuses the account’s own holder when they are not a student', async () => {
    // The other half, so the two messages are both reachable and neither is
    // dead prose. `student-1` owns this charge; without the student role they
    // are told which role it needs.
    await expect(
      billing.execute(who('student-1', 'staff'), act('billing', id(1, 'tuition-fall'), '0', 'pay', { amount: '1' }), 'k'),
    ).rejects.toThrow(/only the student on the account/i);
  });

  it('refuses an action that is not paying', async () => {
    await expect(
      billing.execute(student(), act('billing', id(1, 'tuition-fall'), '0', 'waive'), 'k'),
    ).rejects.toThrow(/not something you can do/i);
  });

  it('keeps every payment in the record’s own history', async () => {
    await run(billing, 'billing', student(), id(1, 'tuition-fall'), 'pay', 'k1', { amount: '1000' });
    await run(billing, 'billing', student(), id(1, 'tuition-fall'), 'pay', 'k2', { amount: '500' });
    const shown = (await seen(billing, student(), id(1, 'tuition-fall'))).details.map((d) => d.value).join(' | ');
    expect(shown).toContain('Paid $1,000.00');
    expect(shown).toContain('Paid $500.00');
  });
});

describe('aid', () => {
  beforeEach(async () => {
    await aid.list(student(), { search: '', cursor: null });
  });

  it('offers four kinds, and says who set the amount', async () => {
    const { records } = await aid.list(student(), { search: '', cursor: null });
    expect(records.length).toBe(4);
    const set = records[0].details.find((d) => d.label === 'Set by')?.value ?? '';
    expect(set).toContain('The institution');
    expect(set).toContain('nothing you send here alters it');
  });

  it('can be accepted', async () => {
    const receipt = await run(aid, 'aid', student(), id(1, 'need-grant'), 'accept', 'k1');
    expect(receipt.message).toContain('No real award was changed');
    expect(store.award(id(1, 'need-grant'))!.state).toBe('accepted');
  });

  it('never takes the amount from the request', async () => {
    /*
     * The obvious attack on a screen like this. There is nowhere to put a
     * number, and the commit reads the row — so a field sent anyway changes
     * nothing, which is a stronger guarantee than validating it away.
     */
    await aid.execute(
      student(),
      act('aid', id(1, 'need-grant'), '0', 'accept', { cents: '99999999', amount: '99999999' }),
      'k1',
    );
    expect(store.award(id(1, 'need-grant'))!.cents).toBe(1_800_000);
  });

  it('can be declined, and then not un-declined', async () => {
    await run(aid, 'aid', student(), id(1, 'subsidised-loan'), 'decline', 'k1');
    await expect(
      aid.execute(student(), act('aid', id(1, 'subsidised-loan'), '1', 'accept'), 'k2'),
    ).rejects.toThrow(/was declined/i);
  });

  it('refuses accepting twice', async () => {
    await run(aid, 'aid', student(), id(1, 'need-grant'), 'accept', 'k1');
    await expect(
      aid.execute(student(), act('aid', id(1, 'need-grant'), '1', 'accept'), 'k2'),
    ).rejects.toThrow(/already accepted/i);
  });

  it('refuses touching something already paid out', async () => {
    await expect(
      aid.execute(student(), act('aid', id(1, 'merit'), '0', 'decline'), 'k'),
    ).rejects.toThrow(/already been paid out/i);
  });

  it('refuses after the date to answer has passed', async () => {
    today = new Date('2026-10-02T12:00:00.000Z');
    await expect(
      aid.execute(student(), act('aid', id(1, 'need-grant'), '0', 'accept'), 'k'),
    ).rejects.toThrow(/passed on 2026-10-01/i);
  });

  it('shows no actions once the date has passed — the control', async () => {
    // Before the date there are two; after it there are none. Without the
    // first half, an adapter that offered nothing ever would pass.
    expect((await seen(aid, student(), id(1, 'need-grant'))).actions.map((a) => a.id)).toEqual([
      'accept',
      'decline',
    ]);
    today = new Date('2026-10-02T12:00:00.000Z');
    expect((await seen(aid, student(), id(1, 'need-grant'))).actions).toEqual([]);
  });

  it('refuses another student’s award', async () => {
    await aid.list(student(2), { search: '', cursor: null });
    await expect(
      aid.execute(student(2), act('aid', id(1, 'need-grant'), '0', 'accept'), 'k'),
    ).rejects.toThrow(/not your award/i);
  });

  it('refuses an action that is neither accepting nor declining', async () => {
    await expect(
      aid.execute(student(), act('aid', id(1, 'need-grant'), '0', 'increase'), 'k'),
    ).rejects.toThrow(/accepted or declined, and nothing else/i);
  });

  it('counts accepted aid on the bill without clearing it', async () => {
    // Aid accepted is not a payment made. Showing it as one would be the
    // single most consequential lie this screen could tell.
    await billing.list(student(), { search: '', cursor: null });
    await run(aid, 'aid', student(), id(1, 'need-grant'), 'accept', 'k1');
    const after = balance(store, 'student-1');
    expect(after.accepted).toBe(1_800_000 + 500_000);
    expect(after.owed, 'accepted aid was treated as money paid').toBe(after.charged);
  });
});

describe('what the adapters say about themselves', () => {
  it('report a sandbox and never a university system', async () => {
    for (const a of [billing, aid]) {
      const status = await a.status(student());
      expect(status.provider).toContain('not a university system');
    }
  });

  it('will not let a non-student write', async () => {
    expect((await billing.status(who('bursar-1', 'staff'))).canWrite).toBe(false);
  });

  it('answer a reconcile from the receipt rather than by doing it again', async () => {
    await billing.list(student(), { search: '', cursor: null });
    const receipt = await run(billing, 'billing', student(), id(1, 'activity-fee'), 'pay', 'k1', { amount: '100' });
    const found = await billing.reconcile?.(student(), act('billing', id(1, 'activity-fee'), '1', 'pay'), 'k1');
    expect(found).toEqual(receipt);
    expect(store.charge(id(1, 'activity-fee'))!.paid).toBe(10_000);
  });
});
