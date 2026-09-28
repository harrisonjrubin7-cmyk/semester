import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newFamilyItem, newFamilyMember, type FamilyMember } from './family';
import {
  ATHLETE_NEVER_SHARED, ATHLETE_SHAREABLE, NEVER_SUPPORT_RECIPIENTS, SHARE_MAX_DAYS, SUPPORT_RECIPIENT_ROLE,
  checkSupporterPlan, endProblem, readable, recipientLine, widens,
} from './sharing';

const TODAY = '2026-09-27';

describe('D4: every share ends, within a term', () => {
  it('refuses no end date, a past one, and one past the cap', () => {
    expect(endProblem('', TODAY)).toMatch(/Needs an end date/);
    expect(endProblem('2026-09-26', TODAY)).toMatch(/has passed/);
    expect(endProblem('2027-04-15', TODAY)).toBe(''); // exactly 200 days is allowed
    expect(endProblem('2027-04-16', TODAY)).toMatch(new RegExp(`more than ${SHARE_MAX_DAYS} days`));
    expect(endProblem('2026-12-15', TODAY)).toBe('');
    expect(endProblem(TODAY, TODAY)).toBe('');
  });
});

describe('D5: a supporter sees named items only, and payment is off', () => {
  const plan = (over: Partial<FamilyMember> = {}) => {
    const m = { ...newFamilyMember(), name: 'Mom', expires: '2026-12-15', ...over };
    const bill = { ...newFamilyItem(m.id), category: 'finances' as const, title: 'Spring bill' };
    const form = { ...newFamilyItem(m.id), category: 'health-admin' as const, title: 'Insurance waiver due' };
    return { m, items: [bill, form] };
  };

  it('shows only items in categories granted "selected" (or the older "view", which meant the same)', () => {
    const { m, items } = plan();
    m.permissions.finances = 'selected';
    m.permissions['health-admin'] = 'view';
    const c = checkSupporterPlan(m, items, TODAY);
    expect(c.items.map((i) => i.title)).toEqual(['Spring bill', 'Insurance waiver due']);
    expect(c.problems).toEqual([]);
  });

  it('says why a plan could not be shared as it stands', () => {
    const { m, items } = plan({ expires: '', name: '' });
    m.permissions.finances = 'payment';
    const c = checkSupporterPlan(m, items, TODAY);
    expect(c.items).toEqual([]);
    expect(c.payment).toEqual(['finances']);
    expect(c.problems.join(' ')).toMatch(/Needs an end date.*Name the person.*Nothing is chosen.*Payment access is off/);
  });

  it('never shows one person the items chosen for another', () => {
    const { m, items } = plan();
    m.permissions.finances = 'selected';
    const other = { ...newFamilyItem('someone-else'), category: 'finances' as const, title: 'Not yours' };
    expect(checkSupporterPlan(m, [...items, other], TODAY).items.map((i) => i.title)).toEqual(['Spring bill']);
  });
});

describe('D3: a revoked share reads exactly like an expired one', () => {
  it('uses the same words for both, so stopping it cannot be told apart from time running out', () => {
    const revoked = recipientLine({ acceptedAt: '2026-09-01', revokedAt: '2026-09-20', ends: '2026-12-15' }, TODAY);
    const expired = recipientLine({ acceptedAt: '2026-09-01', revokedAt: null, ends: '2026-09-26' }, TODAY);
    expect(revoked).toBe(expired);
    expect(revoked).toBe('This share has ended.');
  });

  it('reads only when accepted, not revoked, not past its end, and (for staff) the role is still held', () => {
    const live = { acceptedAt: '2026-09-01', revokedAt: null, ends: '2026-12-15' };
    expect(readable(live, TODAY)).toBe(true);
    expect(readable({ ...live, acceptedAt: null }, TODAY)).toBe(false);
    expect(readable({ ...live, revokedAt: '2026-09-20' }, TODAY)).toBe(false);
    expect(readable({ ...live, ends: '2026-09-26' }, TODAY)).toBe(false);
    expect(readable(live, TODAY, false)).toBe(false);
  });
});

describe('widening needs a new confirmation; narrowing does not', () => {
  it('flags an added item or a later end, and nothing else', () => {
    const before = { items: ['a', 'b'], ends: '2026-12-01' };
    expect(widens(before, { items: ['a', 'b', 'c'], ends: '2026-12-01' })).toBe(true);
    expect(widens(before, { items: ['a', 'b'], ends: '2026-12-15' })).toBe(true);
    expect(widens(before, { items: ['a'], ends: '2026-11-01' })).toBe(false);
  });
});

describe('D1 and D2: who can receive an athlete share, and what it can hold', () => {
  it('names one support role, and never compliance', () => {
    expect(SUPPORT_RECIPIENT_ROLE).toBe('athletic_academic_support');
    expect(NEVER_SUPPORT_RECIPIENTS).toContain('athletics_compliance_officer');
    expect(NEVER_SUPPORT_RECIPIENTS as readonly string[]).not.toContain(SUPPORT_RECIPIENT_ROLE);
  });

  it('offers no grades, NIL, hours or health, and says so', () => {
    const offered = ATHLETE_SHAREABLE.map(([, text]) => text).join(' ');
    expect(offered).not.toMatch(/grade|gpa|nil|income|hours log|health/i);
    expect(ATHLETE_NEVER_SHARED.join(' ')).toMatch(/Grades.*NIL.*hours.*Health/s);
  });

  /*
   * The database says the same thing, in 20260928308000_support_shares.sql:
   * the payload check lists the keys a share may carry, and the recipient
   * test names the two roles. A key added here and not there would be
   * offered by the screen and refused by the server; one added there and not
   * here would be a field nobody previewed.
   */
  it('matches what the database lets a share carry, and who it lets receive one', () => {
    const sql = readFileSync(join(__dirname, '../../../supabase/migrations/20260928308000_support_shares.sql'), 'utf8');
    const listed = /payload - array\[([^\]]+)\]::text\[\]/.exec(sql)?.[1] ?? '';
    const keys = [...listed.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(keys.sort()).toEqual([...ATHLETE_SHAREABLE.map(([k]) => k), 'sharedAs'].sort());
    expect(sql).toContain(`holds_role_at(who, '${SUPPORT_RECIPIENT_ROLE}', school)`);
    for (const never of NEVER_SUPPORT_RECIPIENTS) expect(sql).toContain(`not private.holds_role_at(who, '${never}', school)`);
  });
});
