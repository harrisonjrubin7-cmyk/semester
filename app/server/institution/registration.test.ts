import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SANDBOX_INSTITUTION, SANDBOX_MARK, SandboxStore } from './sandbox.ts';
import { registrationAdapter, taken, waitingAt } from './registration.ts';
import type { AdapterContext, InstitutionAdapter } from './adapter.ts';
import type { ActionInput, UniversityRole } from '../../../packages/institution/src/index.ts';

/**
 * Registration, against the sandbox, and every way of being refused by it.
 *
 * The build-out plan calls this "the transactional standard's first full
 * application", and the thing that makes it one is that a seat is finite: two
 * people can want the last one and only one can have it. So the tests that
 * matter here are not "can somebody enrol" — they are the five refusals, the
 * race for the last seat, and the retry that must not enrol somebody twice.
 *
 * Phase 3 is gated in the source document on an institutional agreement, a
 * security review and a legal review. None of that is satisfied by this and
 * none of it is claimed: every record here is marked, and the receipts say
 * that no seat here is a seat anywhere.
 */

let dir = '';
let store: SandboxStore;
let reg: InstitutionAdapter;
/** A clock the tests move, so "add/drop has closed" is reachable. */
let today = new Date('2026-09-10T12:00:00.000Z');

const who = (userId: string, ...roles: UniversityRole[]): AdapterContext => ({
  identity: { userId, institutionId: SANDBOX_INSTITUTION, roles },
  signal: new AbortController().signal,
});

const act = (recordId: string, version: string, actionId: string): ActionInput => ({
  area: 'registration',
  recordId,
  version,
  actionId,
  fields: {},
});

const student = (n = 1) => who(`student-${n}`, 'student');

/** The record as this person currently sees it, with its live version. */
async function seen(context: AdapterContext, id: string) {
  const record = await reg.get(context, id);
  if (!record) throw new Error(`${id} is not visible`);
  return record;
}

/** Do an action the way the gateway would: review first, then execute. */
async function run(context: AdapterContext, id: string, actionId: string, key: string) {
  const record = await seen(context, id);
  const input = act(id, record.version, actionId);
  await reg.review(context, input);
  return reg.execute(context, input, key);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'registration-'));
  store = new SandboxStore(join(dir, 'sandbox.sqlite'));
  today = new Date('2026-09-10T12:00:00.000Z');
  reg = registrationAdapter(store, () => today);
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('what a student can see', () => {
  it('lists the sections, and every one of them says it is a sandbox', async () => {
    const { records } = await reg.list(student(), { search: '', cursor: null });
    expect(records.length).toBeGreaterThan(3);
    for (const r of records) {
      expect(r.title.startsWith(`${SANDBOX_MARK} · `), r.title).toBe(true);
      expect(r.area).toBe('registration');
    }
  });

  it('says how many seats are left, before anybody takes one', async () => {
    const r = await seen(student(), 'econ-1020-001');
    expect(r.status).toBe('30 of 30 seats left');
    expect(r.details).toContainEqual({ label: 'Seats', value: '0 of 30 taken' });
  });

  it('carries the add/drop deadline as a date and not only as a sentence', async () => {
    // The reason `UniversityRecord.dates` exists: a calendar should hold a
    // date, not parse one back out of a display string.
    const r = await seen(student(), 'econ-1020-001');
    expect(r.dates?.[0]?.at).toBe('2026-09-30T23:59:59.000Z');
    expect(r.details).toContainEqual({ label: 'Add/drop until', value: '2026-09-30' });
  });

  it('offers to enrol, and nothing else, before anything has happened', async () => {
    expect((await seen(student(), 'econ-1020-001')).actions.map((a) => a.id)).toEqual(['enrol']);
  });
});

describe('enrolling', () => {
  it('takes a seat, and the seat count says so', async () => {
    const receipt = await run(student(), 'econ-1020-001', 'enrol', 'k1');
    expect(receipt.status).toBe('completed');
    expect(receipt.message).toContain('No seat here is a seat at any real institution');
    expect(taken(store, 'econ-1020-001')).toBe(1);
    expect((await seen(student(), 'econ-1020-001')).status).toBe('Enrolled');
  });

  it('then offers to drop, and no longer offers to enrol', async () => {
    await run(student(), 'econ-1020-001', 'enrol', 'k1');
    expect((await seen(student(), 'econ-1020-001')).actions.map((a) => a.id)).toEqual(['drop']);
  });

  it('refuses a second enrolment in the same section', async () => {
    await run(student(), 'econ-1020-001', 'enrol', 'k1');
    await expect(run(student(), 'econ-1020-001', 'enrol', 'k2')).rejects.toThrow(/already enrolled/i);
  });

  it('does not enrol twice when the same request arrives twice', async () => {
    /*
     * The retry after a dropped connection, which is the case idempotency
     * exists for and the one a seat count makes visible: a second seat taken
     * by one person is a seat somebody else could have had.
     */
    const first = await run(student(), 'econ-1020-001', 'enrol', 'same-key');
    const record = await seen(student(), 'econ-1020-001');
    const again = await reg.execute(student(), act('econ-1020-001', record.version, 'enrol'), 'same-key');
    expect(again).toEqual(first);
    expect(taken(store, 'econ-1020-001')).toBe(1);
  });
});

describe('the five refusals', () => {
  it('refuses somebody who is not a student', async () => {
    await expect(run(who('prof-1', 'faculty'), 'econ-1020-001', 'enrol', 'k')).rejects.toThrow(
      /only a student/i,
    );
  });

  it('refuses a hold on the account, and names it', async () => {
    store.setSetting('hold:student-1', 'an unpaid library fine|a missing immunisation form');
    await expect(run(student(), 'econ-1020-001', 'enrol', 'k')).rejects.toThrow(
      /hold on your account: an unpaid library fine; a missing immunisation form/i,
    );
  });

  it('refuses a prerequisite that is not recorded', async () => {
    await expect(run(student(), 'econ-3010-001', 'enrol', 'k')).rejects.toThrow(
      /ECON 3010 needs ECON 1020 first/i,
    );
  });

  it('accepts it once the prerequisite is recorded — the control', async () => {
    // Without this, a refusal that refused everybody would pass the test above.
    store.setSetting('passed:student-1', 'ECON 1020');
    const receipt = await run(student(), 'econ-3010-001', 'enrol', 'k');
    expect(receipt.status).toBe('completed');
  });

  it('refuses once add/drop has closed', async () => {
    await expect(run(student(), 'bus-1600-001', 'enrol', 'k')).rejects.toThrow(
      /closed on 2026-09-05/i,
    );
  });

  it('shows no actions at all on a section whose add/drop has closed', async () => {
    expect((await seen(student(), 'bus-1600-001')).actions).toEqual([]);
  });

  it('refuses a clash with something already held', async () => {
    // ECON 1020 and PSCI 2200 do not clash; two sections at the same hour do.
    store.saveSection({ ...store.section('psci-2200-001')!, when: 'Tue/Thu 09:30', seats: 5 });
    await run(student(), 'econ-1020-001', 'enrol', 'k1');
    await expect(run(student(), 'psci-2200-001', 'enrol', 'k2')).rejects.toThrow(/clashes with ECON 1020/i);
  });

  it('refuses a section that does not exist', async () => {
    await expect(
      reg.execute(student(), act('no-such-section', '0:0:0', 'enrol'), 'k'),
    ).rejects.toThrow(/no such section/i);
  });
});

describe('the last seat', () => {
  it('goes to one person, and the next is offered the waiting list', async () => {
    await run(student(1), 'psci-2200-001', 'enrol', 'k1');
    expect(taken(store, 'psci-2200-001')).toBe(1);

    const full = await seen(student(2), 'psci-2200-001');
    expect(full.status).toBe('Full');
    expect(full.actions.map((a) => a.id)).toEqual(['wait']);
  });

  it('refuses an enrolment prepared while a seat was still free', async () => {
    /*
     * The race, and the reason a review is not a reservation. Two people read
     * the last seat; both are offered it; the second commit must lose. Without
     * the recheck inside `execute`, the section would hold two people in one
     * seat.
     */
    const one = await seen(student(1), 'psci-2200-001');
    const two = await seen(student(2), 'psci-2200-001');
    const readyOne = act('psci-2200-001', one.version, 'enrol');
    const readyTwo = act('psci-2200-001', two.version, 'enrol');
    await reg.review(student(1), readyOne);
    await reg.review(student(2), readyTwo);

    await reg.execute(student(1), readyOne, 'k1');
    await expect(reg.execute(student(2), readyTwo, 'k2')).rejects.toThrow(/filled while you were reading/i);
    expect(taken(store, 'psci-2200-001')).toBe(1);
  });

  it('refuses a waiting-list place when a seat is actually free', async () => {
    // The mirror of the above, and the reason it is two checks rather than
    // one: somebody queuing for a section that emptied should be enrolled.
    await expect(run(student(1), 'econ-1020-001', 'wait', 'k')).rejects.toThrow(/seat opened/i);
  });
});

describe('the waiting list', () => {
  it('holds a place, which is not a seat', async () => {
    await run(student(1), 'psci-2200-001', 'enrol', 'k1');
    await run(student(2), 'psci-2200-001', 'wait', 'k2');
    expect(taken(store, 'psci-2200-001'), 'a waiting place took a seat').toBe(1);
    expect(waitingAt(store, 'psci-2200-001', 'student-2')).toBe(1);
    expect((await seen(student(2), 'psci-2200-001')).status).toBe('Waiting · 1 in the queue');
  });

  it('is a queue, in the order people joined it', async () => {
    await run(student(1), 'psci-2200-001', 'enrol', 'k1');
    await run(student(2), 'psci-2200-001', 'wait', 'k2');
    today = new Date(today.getTime() + 60_000);
    await run(student(3), 'psci-2200-001', 'wait', 'k3');
    expect(waitingAt(store, 'psci-2200-001', 'student-2')).toBe(1);
    expect(waitingAt(store, 'psci-2200-001', 'student-3')).toBe(2);
  });

  it('moves when somebody drops, inside the same commit', async () => {
    /*
     * A seat must never sit empty with somebody waiting for it. The promotion
     * happens in the drop, not in a sweep somebody has to run.
     */
    await run(student(1), 'psci-2200-001', 'enrol', 'k1');
    await run(student(2), 'psci-2200-001', 'wait', 'k2');

    const receipt = await run(student(1), 'psci-2200-001', 'drop', 'k3');
    expect(receipt.message).toContain('A waiting place was promoted');
    expect(taken(store, 'psci-2200-001')).toBe(1);
    expect((await seen(student(2), 'psci-2200-001')).status).toBe('Enrolled');
  });

  it('can be left, and leaving puts a re-joiner at the back', async () => {
    await run(student(1), 'psci-2200-001', 'enrol', 'k1');
    await run(student(2), 'psci-2200-001', 'wait', 'k2');
    await run(student(3), 'psci-2200-001', 'wait', 'k3');
    await run(student(2), 'psci-2200-001', 'leave', 'k4');
    expect(waitingAt(store, 'psci-2200-001', 'student-3')).toBe(1);

    today = new Date(today.getTime() + 60_000);
    await run(student(2), 'psci-2200-001', 'wait', 'k5');
    expect(waitingAt(store, 'psci-2200-001', 'student-2')).toBe(2);
  });

  it('lets somebody under a hold leave a queue they are in', async () => {
    // A hold blocks taking something, not giving it back. Somebody trapped in
    // a queue by an unpaid fine is a bug, not a policy.
    await run(student(1), 'psci-2200-001', 'enrol', 'k1');
    await run(student(2), 'psci-2200-001', 'wait', 'k2');
    store.setSetting('hold:student-2', 'an unpaid library fine');
    const receipt = await run(student(2), 'psci-2200-001', 'leave', 'k3');
    expect(receipt.status).toBe('completed');
  });
});

describe('dropping', () => {
  it('gives the seat back', async () => {
    await run(student(), 'econ-1020-001', 'enrol', 'k1');
    await run(student(), 'econ-1020-001', 'drop', 'k2');
    expect(taken(store, 'econ-1020-001')).toBe(0);
    expect((await seen(student(), 'econ-1020-001')).status).toBe('30 of 30 seats left');
  });

  it('refuses dropping something this person is not in', async () => {
    await expect(run(student(), 'econ-1020-001', 'drop', 'k')).rejects.toThrow(/not enrolled/i);
  });

  it('lets somebody under a hold drop', async () => {
    await run(student(), 'econ-1020-001', 'enrol', 'k1');
    store.setSetting('hold:student-1', 'an unpaid library fine');
    expect((await run(student(), 'econ-1020-001', 'drop', 'k2')).status).toBe('completed');
  });

  it('keeps the whole history on the record', async () => {
    await run(student(), 'econ-1020-001', 'enrol', 'k1');
    await run(student(), 'econ-1020-001', 'drop', 'k2');
    const shown = (await seen(student(), 'econ-1020-001')).details.map((d) => d.value).join(' | ');
    expect(shown).toContain('Enrolled in ECON 1020');
    expect(shown).toContain('Dropped ECON 1020');
  });
});

describe('what the adapter says about itself', () => {
  it('reports a sandbox, and never a university system', async () => {
    const status = await reg.status(student());
    expect(status.area).toBe('registration');
    expect(status.provider).toContain('not a university system');
    expect(status.canWrite).toBe(true);
  });

  it('will not let a non-student write', async () => {
    expect((await reg.status(who('prof-1', 'faculty'))).canWrite).toBe(false);
  });

  it('answers a reconcile from the receipt rather than by doing it again', async () => {
    const receipt = await run(student(), 'econ-1020-001', 'enrol', 'k1');
    const found = await reg.reconcile?.(student(), act('econ-1020-001', '0:0:0', 'enrol'), 'k1');
    expect(found).toEqual(receipt);
    expect(taken(store, 'econ-1020-001')).toBe(1);
  });

  it('answers null for an operation it has never seen', async () => {
    expect(await reg.reconcile?.(student(), act('econ-1020-001', '0:0:0', 'enrol'), 'never')).toBeNull();
  });
});
