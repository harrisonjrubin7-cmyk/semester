import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SANDBOX_INSTITUTION, SANDBOX_MARK, SandboxStore } from './sandbox.ts';
import { familyAdapter, familyMay } from './family.ts';
import { billingAdapter } from './money.ts';
import type { AdapterContext, InstitutionAdapter } from './adapter.ts';
import type { ActionInput, UniversityArea, UniversityRole } from '../../../packages/institution/src/index.ts';

/**
 * Family access, and the asymmetry that is the whole of it.
 *
 * `allowsFamilyRequest` in the contract already decided the hard part and says
 * so in its own words: *"payment-only access discloses nothing"*. A parent who
 * can pay the tuition bill cannot read it. These tests assert that from both
 * directions, because a feature whose point is a refusal is a feature whose
 * tests are mostly refusals.
 *
 * Phase 3 is gated on an institutional agreement, a security review and a
 * legal review including FERPA — and family access is the domain where that
 * gate matters most, since it is the one that discloses a student's record to
 * somebody who is not the student. None of that is satisfied here and none is
 * claimed.
 */

let dir = '';
let store: SandboxStore;
let family: InstitutionAdapter;
let billing: InstitutionAdapter;
let today = new Date('2026-09-20T12:00:00.000Z');

const who = (userId: string, ...roles: UniversityRole[]): AdapterContext => ({
  identity: { userId, institutionId: SANDBOX_INSTITUTION, roles },
  signal: new AbortController().signal,
});

const act = (
  area: UniversityArea,
  recordId: string,
  actionId: string,
  fields: Record<string, string> = {},
): ActionInput => ({ area, recordId, version: '0', actionId, fields });

const student = () => who('student-1', 'student');
/*
 * `payer` and not `family` — the contract's own role list has six, and a
 * parent paying a bill is exactly the one it named. Writing `family` here
 * typechecked as a string and would have run as a role nothing recognises.
 */
const parent = () => who('parent-1', 'payer');
const stranger = () => who('stranger-1', 'payer');

/** Give access, and hand back the grant's id. */
async function invite(fields: Record<string, string> = {}, key = 'inv') {
  const input = act('family', 'new', 'invite', {
    recipient: 'parent-1',
    category: 'finances',
    access: 'payment',
    items: 'student-1::tuition-fall',
    days: '90',
    ...fields,
  });
  await family.review(student(), input);
  await family.execute(student(), input, key);
  const made = store.grantsBy('student-1');
  return made[made.length - 1];
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'family-'));
  store = new SandboxStore(join(dir, 'sandbox.sqlite'));
  today = new Date('2026-09-20T12:00:00.000Z');
  family = familyAdapter(store, () => today);
  billing = billingAdapter(store, () => today);
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('making a grant', () => {
  it('produces one that is offered and not yet live', async () => {
    const g = await invite();
    expect(g.acceptedAt, 'a grant nobody accepted was live').toBeNull();
    expect(familyMay(store, 'parent-1', 'student-1', 'finances', 'student-1::tuition-fall', 'pay', today.getTime())).toBe(false);
  });

  it('is marked as a sandbox wherever it is read', async () => {
    const g = await invite();
    const r = await family.get(student(), g.id);
    expect(r?.title.startsWith(`${SANDBOX_MARK} · `)).toBe(true);
  });

  it('refuses a category with nothing named in it', async () => {
    // The contract enforces this at the point of use; refusing it here means
    // the student is told when they make it rather than when it fails.
    await expect(invite({ items: '   ' }, 'k')).rejects.toThrow(/category on its own grants nothing/i);
  });

  it('refuses access with no end', async () => {
    await expect(invite({ days: '' }, 'k')).rejects.toThrow(/between 1 and 400/i);
    await expect(invite({ days: '9999' }, 'k2')).rejects.toThrow(/between 1 and 400/i);
  });

  it('refuses payment access on anything but finances', async () => {
    await expect(invite({ category: 'academic', access: 'payment' }, 'k')).rejects.toThrow(
      /only means anything on finances/i,
    );
  });

  it('refuses a category that is not one', async () => {
    await expect(invite({ category: 'everything' }, 'k')).rejects.toThrow(/Choose one of/i);
  });

  it('refuses "none", which is not a grant', async () => {
    await expect(invite({ access: 'none' }, 'k')).rejects.toThrow(/not a grant/i);
  });

  it('refuses granting access to yourself', async () => {
    await expect(invite({ recipient: 'student-1' }, 'k')).rejects.toThrow(/already have your own record/i);
  });

  it('refuses somebody who is not the student', async () => {
    const input = act('family', 'new', 'invite', {
      recipient: 'parent-1',
      category: 'finances',
      access: 'payment',
      items: 'x',
      days: '30',
    });
    await expect(family.execute(parent(), input, 'k')).rejects.toThrow(/only the student can give access/i);
  });
});

describe('accepting', () => {
  it('is what makes a grant live', async () => {
    const g = await invite();
    await family.execute(parent(), act('family', g.id, 'accept'), 'k1');
    expect(familyMay(store, 'parent-1', 'student-1', 'finances', 'student-1::tuition-fall', 'pay', today.getTime())).toBe(true);
  });

  it('cannot be done by the student who gave it', async () => {
    const g = await invite();
    await expect(family.execute(student(), act('family', g.id, 'accept'), 'k')).rejects.toThrow(
      /yours to give, not to accept/i,
    );
  });

  it('cannot be done twice', async () => {
    const g = await invite();
    await family.execute(parent(), act('family', g.id, 'accept'), 'k1');
    await expect(family.execute(parent(), act('family', g.id, 'accept'), 'k2')).rejects.toThrow(
      /already accepted/i,
    );
  });

  it('cannot be done by somebody it was not offered to', async () => {
    const g = await invite();
    await expect(family.execute(stranger(), act('family', g.id, 'accept'), 'k')).rejects.toThrow(
      /not yours to see/i,
    );
  });

  it('cannot revive something that expired first', async () => {
    const g = await invite({ days: '1' });
    today = new Date('2026-09-25T12:00:00.000Z');
    await expect(family.execute(parent(), act('family', g.id, 'accept'), 'k')).rejects.toThrow(
      /expired before it was accepted/i,
    );
  });

  it('can be declined instead, and then it is gone', async () => {
    const g = await invite();
    await family.execute(parent(), act('family', g.id, 'decline'), 'k1');
    expect(familyMay(store, 'parent-1', 'student-1', 'finances', 'student-1::tuition-fall', 'pay', today.getTime())).toBe(false);
  });
});

describe('revoking', () => {
  it('stops it at once', async () => {
    const g = await invite();
    await family.execute(parent(), act('family', g.id, 'accept'), 'k1');
    expect(familyMay(store, 'parent-1', 'student-1', 'finances', 'student-1::tuition-fall', 'pay', today.getTime())).toBe(true);

    await family.execute(student(), act('family', g.id, 'revoke'), 'k2');
    expect(familyMay(store, 'parent-1', 'student-1', 'finances', 'student-1::tuition-fall', 'pay', today.getTime())).toBe(false);
  });

  it('is the student’s to do, not the recipient’s', async () => {
    const g = await invite();
    await expect(family.execute(parent(), act('family', g.id, 'revoke'), 'k')).rejects.toThrow(
      /only the student who gave this access/i,
    );
  });

  it('can be done from the other side as handing it back', async () => {
    const g = await invite();
    await family.execute(parent(), act('family', g.id, 'accept'), 'k1');
    await family.execute(parent(), act('family', g.id, 'hand-back'), 'k2');
    expect(familyMay(store, 'parent-1', 'student-1', 'finances', 'student-1::tuition-fall', 'pay', today.getTime())).toBe(false);
  });

  it('cannot be done twice', async () => {
    const g = await invite();
    await family.execute(student(), act('family', g.id, 'revoke'), 'k1');
    await expect(family.execute(student(), act('family', g.id, 'revoke'), 'k2')).rejects.toThrow(
      /already been revoked/i,
    );
  });

  it('expires on its own even if nobody revokes it', async () => {
    const g = await invite({ days: '2' });
    await family.execute(parent(), act('family', g.id, 'accept'), 'k1');
    expect(familyMay(store, 'parent-1', 'student-1', 'finances', 'student-1::tuition-fall', 'pay', today.getTime())).toBe(true);

    const later = new Date('2026-09-25T12:00:00.000Z').getTime();
    expect(
      familyMay(store, 'parent-1', 'student-1', 'finances', 'student-1::tuition-fall', 'pay', later),
    ).toBe(false);
  });
});

describe('payment access discloses nothing — the asymmetry', () => {
  beforeEach(async () => {
    await billing.list(student(), { search: '', cursor: null });
    const g = await invite();
    await family.execute(parent(), act('family', g.id, 'accept'), 'accepted');
  });

  it('lets the payer pay', async () => {
    const receipt = await billing.execute(
      parent(),
      act('billing', 'student-1::tuition-fall', 'pay', { amount: '500' }),
      'pay-1',
    );
    expect(receipt.status).toBe('completed');
    expect(store.charge('student-1::tuition-fall')!.paid).toBe(50_000);
  });

  it('records who paid it, so the student can see it was not them', async () => {
    await billing.execute(parent(), act('billing', 'student-1::tuition-fall', 'pay', { amount: '500' }), 'pay-1');
    const shown = (await billing.get(student(), 'student-1::tuition-fall'))!.details.map((d) => d.value).join(' | ');
    expect(shown).toContain('by parent-1, with family access');
  });

  it('does not let the payer read the charge', async () => {
    // The contract's sentence, asserted: "payment-only access discloses
    // nothing". Not the balance, not the history, not the aid.
    expect(await billing.get(parent(), 'student-1::tuition-fall')).toBeNull();
  });

  it('does not let the payer list the account at all', async () => {
    const { records } = await billing.list(parent(), { search: '', cursor: null });
    expect(records.map((r) => r.id)).not.toContain('student-1::tuition-fall');
  });

  it('does not let the payer pay a charge they were not named on', async () => {
    // The grant names one item. A category is not a licence over everything.
    await expect(
      billing.execute(parent(), act('billing', 'student-1::housing-fall', 'pay', { amount: '5' }), 'k'),
    ).rejects.toThrow(/not your account/i);
  });

  it('does not let a stranger pay', async () => {
    await expect(
      billing.execute(stranger(), act('billing', 'student-1::tuition-fall', 'pay', { amount: '5' }), 'k'),
    ).rejects.toThrow(/not your account/i);
  });

  it('stops the payer the moment the student revokes', async () => {
    const g = store.grantsBy('student-1')[0];
    await family.execute(student(), act('family', g.id, 'revoke'), 'revoked');
    await expect(
      billing.execute(parent(), act('billing', 'student-1::tuition-fall', 'pay', { amount: '5' }), 'k'),
    ).rejects.toThrow(/not your account/i);
  });

  it('still refuses over-payment when the payer is family', async () => {
    await expect(
      billing.execute(parent(), act('billing', 'student-1::tuition-fall', 'pay', { amount: '999999' }), 'k'),
    ).rejects.toThrow(/more than the/i);
  });
});

describe('reading access, which is the other half', () => {
  it('is not payment, and payment is not it', async () => {
    /*
     * The four levels are not an ordinal scale, and this is what that means:
     * a `view` grant reads and cannot pay; a `payment` grant pays and cannot
     * read. Asserted through `familyMay` from both sides.
     */
    const g = await invite({ access: 'view', category: 'academic', items: 'transcript' }, 'k1');
    await family.execute(parent(), act('family', g.id, 'accept'), 'k2');

    expect(familyMay(store, 'parent-1', 'student-1', 'academic', 'transcript', 'read', today.getTime())).toBe(true);
    expect(familyMay(store, 'parent-1', 'student-1', 'academic', 'transcript', 'pay', today.getTime())).toBe(false);

    const pay = await invite({ access: 'payment', category: 'finances', items: 'bill' }, 'k3');
    await family.execute(parent(), act('family', pay.id, 'accept'), 'k4');
    expect(familyMay(store, 'parent-1', 'student-1', 'finances', 'bill', 'pay', today.getTime())).toBe(true);
    expect(familyMay(store, 'parent-1', 'student-1', 'finances', 'bill', 'read', today.getTime())).toBe(false);
  });
});

describe('what both sides can see', () => {
  it('shows the student what they have given', async () => {
    await invite();
    const { records } = await family.list(student(), { search: '', cursor: null });
    expect(records).toHaveLength(1);
    expect(records[0].details).toContainEqual({ label: 'Given to', value: 'parent-1' });
  });

  it('shows the recipient what they were given', async () => {
    await invite();
    const { records } = await family.list(parent(), { search: '', cursor: null });
    expect(records).toHaveLength(1);
    expect(records[0].details).toContainEqual({ label: 'Given by', value: 'student-1' });
  });

  it('shows a stranger nothing', async () => {
    const g = await invite();
    expect((await family.list(stranger(), { search: '', cursor: null })).records).toEqual([]);
    expect(await family.get(stranger(), g.id)).toBeNull();
  });

  it('says on the record what payment access does not do', async () => {
    const g = await invite();
    const r = await family.get(student(), g.id);
    expect(r!.details.find((d) => d.label === 'What this does not do')?.value).toContain('read nothing');
  });

  it('does not repeat an action when the same request arrives twice', async () => {
    const g = await invite();
    const first = await family.execute(parent(), act('family', g.id, 'accept'), 'same');
    const again = await family.execute(parent(), act('family', g.id, 'accept'), 'same');
    expect(again).toEqual(first);
  });
});
