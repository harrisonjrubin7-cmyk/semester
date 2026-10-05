import { describe, expect, it } from 'vitest';
import { loadOfficial, officialMessages } from './official-notices';
import { admit, visible, EMPTY_PREFS } from './comms';
import { buildEnvironment, type Fact, type SchoolRecordsView } from './integration/school-records';

/**
 * The school's facts as hub messages. The control is the first case: a current
 * emergency must reach Required. A mapping that never said Required would pass
 * every "is not Required" case below and be useless in an emergency.
 */

const NOW = new Date('2026-09-28T15:00:00Z');

const fact = (id: string, text: string, patch: Partial<Fact> = {}): Fact => ({
  id, text, source: 'Public safety', freshness: 'live', official: true, link: 'https://safety.example.edu/alert', mine: false, ...patch,
});

const view = (patch: Partial<SchoolRecordsView>): SchoolRecordsView => ({
  readiness: 'unknown', window: null, holds: [], enrollment: null, requirements: null, alerts: [], appointment: null,
  referrals: [], actions: [], opportunity: null, event: null, empty: false, ...patch,
});

const shown = (v: SchoolRecordsView) => admit(officialMessages(v, NOW)).shown;

describe('official notices', () => {
  it('lets a current emergency alert say Required — THE CONTROL', () => {
    const [m] = shown(view({ alerts: [fact('e', 'Emergency: shelter in place', { caveat: 'Follow Public safety for anything urgent.' })] }));
    expect(m).toMatchObject({ channel: 'official', priority: 'required', source: 'Public safety', url: 'https://safety.example.edu/alert' });
    expect(m.body).toContain('Follow Public safety for anything urgent.');
    expect(m.sourceLabel).toBe('institution_verified');
  });

  it('never lets a stale emergency say Required, and says it is not current', () => {
    const [m] = shown(view({ alerts: [fact('e', 'Emergency: shelter in place', { official: false, freshness: 'stale' })] }));
    expect(m.priority).toBe('high');
    expect(m.body).toContain('Not the official current record');
    expect(m.sourceLabel).toBe('needs_review');
  });

  it('lets only a current blocking hold say Required among holds', () => {
    const out = shown(view({
      holds: [
        fact('b', 'Action required before you can register — Bursar', { source: 'Bursar' }),
        fact('n', 'Action required — Health center', { source: 'Health center' }),
        fact('s', 'Action required before you can register — Registrar', { source: 'Registrar', official: false, freshness: 'stale' }),
      ],
    }));
    const p = (id: string) => out.find((m) => m.id === `official:hold:${id}`)!.priority;
    expect([p('b'), p('n'), p('s')]).toEqual(['required', 'high', 'high']);
  });

  it('keeps advisories, actions, referrals, windows and appointments below Required', () => {
    const out = shown(view({
      alerts: [fact('a', 'Advisory: icy walkways'), fact('i', 'Notice: library hours change')],
      actions: [fact('x', 'An action from Bursar — due Fri Oct 2', { source: 'Bursar' })],
      referrals: [fact('r', 'Advising asked to hear from you', { source: 'Advising' })],
      window: fact('w', 'Registration opens Mon Nov 2', { source: 'Registrar' }),
      appointment: fact('ap', 'Advising appointment Tue Sep 29', { source: 'Advising' }),
    }));
    expect(out.every((m) => m.priority !== 'required')).toBe(true);
    expect(out.find((m) => m.id === 'official:alert:a')!.priority).toBe('high');
    expect(out.find((m) => m.id === 'official:alert:i')!.priority).toBe('normal');
    expect(out).toHaveLength(6);
  });

  it('drops a link that is not https', () => {
    const [m] = shown(view({ alerts: [fact('e', 'Advisory: storm', { link: 'http://insecure.example.edu' })] }));
    expect(m.url).toBeUndefined();
  });

  it('shows a current emergency through mute and quiet hours, and holds a stale one', () => {
    const out = shown(view({ alerts: [fact('c', 'Emergency: now'), fact('s', 'Emergency: earlier', { official: false, freshness: 'stale' })] }));
    const late = visible(out, { ...EMPTY_PREFS, muted: ['official'] }, 23 * 60);
    expect(late.now.map((m) => m.id)).toEqual(['official:alert:c']);
  });
});

/**
 * A client that answers the reads the loader makes: who is signed in,
 * whether the module is on for the school (and for whom), and the rows. Each can be made to
 * fail, which is the case the hub has to tell apart from "not connected".
 */
function fakeDb(o: { user?: string | null; state?: string; stateFails?: boolean; switchesFail?: boolean; rowsFail?: boolean; userThrows?: boolean; authError?: string }) {
  const fail = { message: 'network' };
  return {
    auth: {
      getUser: async () => {
        if (o.userThrows) throw new Error('offline');
        // Supabase returns an auth error rather than throwing it.
        if (o.authError) return { data: { user: null }, error: { name: o.authError, message: 'x' } };
        return { data: { user: o.user === null ? null : { id: o.user ?? 'u1' } }, error: null };
      },
    },
    rpc: async (name: string) =>
      // The narrowing read: the school names no role or cohort.
      name === 'feature_narrowing' ? { data: [], error: null }
        : o.stateFails ? { data: null, error: fail } : { data: o.state ?? 'production', error: null },
    from: (table: string) => {
      if (table === 'feature_kill_switch') {
        return { select: async () => (o.switchesFail ? { data: null, error: fail } : { data: [], error: null }) };
      }
      const q = { select: () => q, in: () => q, is: () => q, limit: async () => (o.rowsFail ? { data: null, error: fail } : { data: [], error: null }) };
      return q;
    },
  } as never;
}

describe('loading the official channel', () => {
  const env = buildEnvironment('production');
  const school = async () => 'vanderbilt';
  const load = (db: unknown, s = school) => loadOfficial(db as never, s, env, NOW);

  it('is ready when the module is on and the rows load — the control', async () => {
    expect(await load(fakeDb({}))).toEqual({ status: 'ready', userId: 'u1', rows: [] });
  });

  it('is off for what is true about the school or the account', async () => {
    expect((await load(null)).status).toBe('off');
    expect((await load(fakeDb({ user: null }))).status).toBe('off');
    expect((await load(fakeDb({ authError: 'AuthSessionMissingError' }))).status).toBe('off');
    expect((await load(fakeDb({}), async () => '')).status).toBe('off');
    expect((await load(fakeDb({ state: 'off' }))).status).toBe('off');
  });

  it('is an error, never off, when a request fails', async () => {
    expect((await load(fakeDb({ stateFails: true }))).status).toBe('error');
    expect((await load(fakeDb({ switchesFail: true }))).status).toBe('error');
    expect((await load(fakeDb({ rowsFail: true }))).status).toBe('error');
    expect((await load(fakeDb({ userThrows: true }))).status).toBe('error');
    expect((await load(fakeDb({ authError: 'AuthRetryableFetchError' }))).status).toBe('error');
    expect((await load(fakeDb({}), async () => { throw new Error('profile lookup failed'); })).status).toBe('error');
  });
});
