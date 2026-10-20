import { beforeEach, expect, it, vi } from 'vitest';

/**
 * The roster desk's client against a stand-in for the account service: which
 * RPC each call makes with which arguments, how a missing migration and a
 * refusal read, and how the answers are read. The rules themselves are
 * proved by supabase/roster-admin-desk.check.sql.
 */

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../cloud', () => ({ cloud: () => Promise.resolve({ rpc: mock.rpc }) }));
const {
  accountIdProblem, bindPerson, courseLabel, grantLabel, loadRosterDesk, notSetUp, personName, rosterAdminAllowed, setAbsence, stale,
} = await import('./admin');

beforeEach(() => mock.rpc.mockReset());

const CONFIG = {
  configured: true, source_kind: 'csv', absence_revokes_access: false, max_removal_pct: 10,
  roster_complete: true, would_end: 2, unbound: 1, last_promoted_at: '2026-10-20T10:00:00Z',
};
const PEOPLE = [{ sourced_id: 'u-1', role: 'teacher', given_name: 'Tess', family_name: 'Ng', courses: [{ course: 'HIST 2100', term: '2026FA', role: 'faculty' }] }];

function answers(by: Record<string, { data?: unknown; error?: unknown }>) {
  mock.rpc.mockImplementation((name: string) => Promise.resolve({ data: null, error: null, ...by[name] }));
}

it('offers the desk only to roster:administer', () => {
  expect(rosterAdminAllowed(['roster:administer', 'integration:view'])).toBe(true);
  expect(rosterAdminAllowed(['integration:configure', 'integration:approve'])).toBe(false);
});

it('loads the settings and the unbound people for one school', async () => {
  answers({ roster_admin_config: { data: CONFIG }, roster_admin_unbound: { data: PEOPLE } });
  const desk = await loadRosterDesk('vu');
  expect(mock.rpc).toHaveBeenCalledWith('roster_admin_config', { want_tenant: 'vu' });
  expect(mock.rpc).toHaveBeenCalledWith('roster_admin_unbound', { want_tenant: 'vu' });
  expect(desk).toEqual({
    state: 'ready',
    config: { configured: true, absenceRevokesAccess: false, rosterComplete: true, wouldEnd: 2, unbound: 1, lastPromotedAt: '2026-10-20T10:00:00Z' },
    people: [{ sourcedId: 'u-1', role: 'teacher', givenName: 'Tess', familyName: 'Ng', courses: [{ course: 'HIST 2100', term: '2026FA', role: 'faculty' }] }],
  });
});

it.each(['42P01', '42883', 'PGRST202', 'PGRST205'])('reads %s as not set up, not as an error', async (code) => {
  answers({ roster_admin_config: { error: { code, message: 'missing' } }, roster_admin_unbound: { data: [] } });
  await expect(loadRosterDesk('vu')).resolves.toEqual({ state: 'not-set-up' });
});

it('reads a refusal as permission denied, in the server’s words', async () => {
  const refusal = { code: '42501', message: 'semester: the roster desk needs roster:administer at this school' };
  answers({ roster_admin_config: { error: refusal }, roster_admin_unbound: { error: refusal } });
  await expect(loadRosterDesk('vu')).resolves.toEqual({ state: 'denied', message: 'The roster desk needs roster:administer at this school.' });
});

it('throws any other failure, so the screen can offer a retry', async () => {
  answers({ roster_admin_config: { error: { code: 'XX000', message: 'semester: boom' } }, roster_admin_unbound: { data: [] } });
  await expect(loadRosterDesk('vu')).rejects.toThrow('Boom.');
  expect(notSetUp({ code: 'XX000' })).toBe(false);
});

it('binds with the tenant, the person, the account and the key', async () => {
  answers({ roster_admin_bind: { data: { outcome: 'bound', grants: [{ role: 'faculty', scope: 'vu/HIST 2100/2026FA' }], replayed: false } } });
  const r = await bindPerson('vu', 'u-1', 'acc', 'roster-bind.k1');
  expect(mock.rpc).toHaveBeenCalledWith('roster_admin_bind', { want_tenant: 'vu', want_sourced_id: 'u-1', want_subject: 'acc', want_key: 'roster-bind.k1' });
  expect(r).toEqual({ outcome: 'bound', grants: [{ role: 'faculty', scope: 'vu/HIST 2100/2026FA' }], replayed: false });
  expect(grantLabel(r.grants[0])).toBe('HIST 2100 · 2026FA as instructor');
});

it('a refused binding throws the server’s sentence, settled', async () => {
  answers({ roster_admin_bind: { error: { code: '23505', message: 'semester: that roster person is already bound to another account; unbind it first' } } });
  await expect(bindPerson('vu', 'u-1', 'acc', 'k-12345678')).rejects.toMatchObject({
    message: 'That roster person is already bound to another account; unbind it first.', answered: true,
  });
});

it('sets the switch with what the administrator saw, and reads what ended', async () => {
  answers({ roster_admin_set_absence: { data: { outcome: 'turned-on', on: true, grants: { granted: 0, revoked: 2, kept: 3 }, replayed: false } } });
  const r = await setAbsence('vu', true, false, 'roster-absence.k1');
  expect(mock.rpc).toHaveBeenCalledWith('roster_admin_set_absence', { want_tenant: 'vu', want_on: true, want_expect: false, want_key: 'roster-absence.k1' });
  expect(r).toEqual({ outcome: 'turned-on', on: true, revoked: 2, replayed: false });
});

it('recognises the stale refusal', async () => {
  answers({ roster_admin_set_absence: { error: { code: '40001', message: 'semester: stale: someone changed this setting since you looked; nothing was changed' } } });
  const e = await setAbsence('vu', true, false, 'k-12345678').catch((x: unknown) => x);
  expect(stale(e)).toBe(true);
  expect(stale(new Error('Something else.'))).toBe(false);
});

it('checks a pasted account id before sending it', () => {
  expect(accountIdProblem('')).toMatch(/Paste/);
  expect(accountIdProblem('maya@school.edu')).toMatch(/not an account id/);
  expect(accountIdProblem(' 1b2c3d4e-0000-4000-8000-000000000000 ')).toBeNull();
});

it('names a person and a course plainly', () => {
  expect(personName({ sourcedId: 'u-9', role: 'student', givenName: '', familyName: '', courses: [] })).toBe('u-9');
  expect(courseLabel({ course: 'HIST 2100', term: '2026FA', role: 'teaching_assistant' })).toBe('HIST 2100 · 2026FA as teaching assistant');
});
