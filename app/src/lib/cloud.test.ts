import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';

/**
 * The account copy, without an account.
 *
 * Everything here goes through Supabase, and a test that mocks a database to
 * prove a query was sent is a test of the mock. What earns a test is the
 * reasoning wrapped around those queries: which rows a delete actually names,
 * whether a course removed on one device stays removed, what the newest
 * timestamp across an account is, and what a Postgres error is turned into
 * before a person reads it. Those are the parts that decide whether somebody
 * loses a semester, and none of them need a real server.
 *
 * The module reads its project URL at import time, so each test imports it
 * fresh with the environment stubbed and the SDK replaced.
 */

/** A chainable stand-in for `db.from(...)`, recording what it was asked. */
function makeDb() {
  const log: { table: string; op: string; args: unknown[] }[] = [];
  const rows: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  const chain = (table: string, op: string) => {
    const record = (name: string, ...args: unknown[]) => {
      log.push({ table, op: name, args });
    };
    const self: Record<string, unknown> = {};
    for (const name of ['eq', 'in', 'select', 'delete', 'insert', 'upsert', 'maybeSingle']) {
      self[name] = (...args: unknown[]) => {
        record(name, ...args);
        return self;
      };
    }
    // Awaiting the chain resolves to what PostgREST returns.
    self.then = (resolve: (v: unknown) => unknown) =>
      resolve(
        errors[table]
          ? { data: null, error: { message: errors[table] } }
          : { data: rows[table] ?? null, error: null },
      );
    void op;
    return self;
  };

  return {
    log,
    rows,
    errors,
    db: {
      from: (table: string) => chain(table, 'from'),
      auth: {
        getUser: async () => ({ data: { user: { id: 'user-1' } } }),
        signOut: vi.fn(async () => ({ error: null })),
      },
    },
    /** Which tables a delete was sent to, in order. */
    deleted: () => log.filter((l) => l.op === 'delete').map((l) => l.table),
    /** The ids named by an `.in('id', [...])` call. */
    prunedIds: () =>
      log
        .filter((l) => l.op === 'in')
        .flatMap((l) => (Array.isArray(l.args[1]) ? (l.args[1] as string[]) : [])),
  };
}

let harness: ReturnType<typeof makeDb>;

/** The module, imported fresh with a project configured and the SDK faked. */
async function load() {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('VITE_SUPABASE_KEY', 'a-publishable-key');
  harness = makeDb();
  vi.doMock('@supabase/supabase-js', () => ({ createClient: () => harness.db }));
  return import('./cloud');
}

beforeEach(() => {
  vi.stubGlobal('window', { location: { origin: 'https://example.test' } });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.doUnmock('@supabase/supabase-js');
});

describe('cloudConfigured', () => {
  it('is false when no project is set, so the app runs device-only', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_KEY', '');
    const mod = await import('./cloud');
    expect(mod.cloudConfigured).toBe(false);
    // And asking for a client says so rather than half-working.
    await expect(mod.cloud()).rejects.toThrow(/no account service/i);
  });

  it('needs both halves, not just a URL', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_KEY', '');
    expect((await import('./cloud')).cloudConfigured).toBe(false);
  });

  it('is true once both are set', async () => {
    expect((await load()).cloudConfigured).toBe(true);
  });
});

describe('cloud', () => {
  it('builds one client however many callers race for it', async () => {
    // The promise is cached rather than the client, so two callers on the
    // first use share one import instead of each starting their own.
    const mod = await load();
    const [a, b] = await Promise.all([mod.cloud(), mod.cloud()]);
    expect(a).toBe(b);
  });
});

describe('providerOf and accountOf', () => {
  const session = (provider?: unknown, email = 'someone@vanderbilt.edu') =>
    ({
      user: { id: 'u1', email, app_metadata: provider === undefined ? {} : { provider } },
    }) as unknown as Session;

  it('names the provider the way the button did', async () => {
    const { providerOf } = await load();
    expect(providerOf(session('google'))).toBe('Google');
    expect(providerOf(session('azure'))).toBe('Microsoft');
    expect(providerOf(session('apple'))).toBe('Apple');
  });

  it('describes a password sign-in in words, not as "email"', async () => {
    // "Signed in with email" reads like a magic link. What somebody needs to
    // know on a second device is that they typed a password.
    const { providerOf } = await load();
    expect(providerOf(session('email'))).toBe('an email address and password');
  });

  it('passes an unfamiliar provider through rather than inventing a name', async () => {
    const { providerOf } = await load();
    expect(providerOf(session('keycloak'))).toBe('keycloak');
  });

  it('says nothing when there is no session or no provider on it', async () => {
    const { providerOf } = await load();
    expect(providerOf(null)).toBe('');
    expect(providerOf(session())).toBe('');
    expect(providerOf(session(42))).toBe('');
  });

  it('turns a session into an account, carrying how they got in', async () => {
    const { accountOf } = await load();
    expect(accountOf(session('azure'))).toEqual({
      id: 'u1',
      email: 'someone@vanderbilt.edu',
      via: 'Microsoft',
    });
  });

  it('has no account for no session', async () => {
    const { accountOf } = await load();
    expect(accountOf(null)).toBeNull();
  });

  it('copes with a provider that returns no email address', async () => {
    // Microsoft does this without the right scopes. An account with no email
    // is still an account; crashing on it is not an option.
    const { accountOf } = await load();
    const noEmail = { user: { id: 'u1', app_metadata: { provider: 'azure' } } } as unknown as Session;
    expect(accountOf(noEmail)?.email).toBe('');
    expect(accountOf(noEmail)?.via).toBe('Microsoft');
  });

  it('labels every provider it offers a button for', async () => {
    const { PROVIDER_LABEL } = await load();
    expect(Object.keys(PROVIDER_LABEL).sort()).toEqual(['apple', 'azure', 'google']);
    for (const label of Object.values(PROVIDER_LABEL)) expect(label).toBeTruthy();
  });
});

describe('appUrl', () => {
  it('is the app’s own address, not whatever the browser is showing', async () => {
    // A redirect URL has to match the project's allowlist exactly, and the
    // current href can still be carrying the ?code= of the callback that just
    // happened. A near miss is not an error — it silently falls back to the
    // Site URL, which nobody can diagnose from outside.
    const { appUrl } = await load();
    expect(appUrl()).toBe('https://example.test/');
  });
});

describe('explainSyncError', () => {
  it('turns a missing table into the setup step that was missed', async () => {
    const { explainSyncError } = await load();
    const out = explainSyncError("Could not find the table 'public.state' in the schema cache");
    expect(out).toContain('supabase/schema.sql');
    expect(out).toContain('NOTIFY pgrst');
    // The original wording is kept: it is accurate, and somebody searching for
    // it should still find their own error in the message.
    expect(out).toContain('public.state');
  });

  it('turns an expired session into what to do about it', async () => {
    const { explainSyncError } = await load();
    expect(explainSyncError('JWT expired')).toMatch(/sign out and back in/i);
    expect(explainSyncError('invalid claim: missing sub')).toMatch(/sign out and back in/i);
  });

  it('explains a row-level-security refusal as a half-run schema', async () => {
    const { explainSyncError } = await load();
    expect(explainSyncError('new row violates policy for table "state"')).toMatch(/Re-run it/);
  });

  it('passes anything it does not recognise through untouched', async () => {
    // A wrong guess would be worse than the original wording.
    const { explainSyncError } = await load();
    expect(explainSyncError('connection reset by peer')).toBe('connection reset by peer');
  });
});

describe('pull', () => {
  it('reads the state row and the courses together', async () => {
    const { pull } = await load();
    harness.rows.state = { data: { term: '2026FA' }, updated_at: '2026-09-01T10:00:00Z' };
    harness.rows.courses = [
      { id: 'econ', data: { code: 'ECON 1020' }, updated_at: '2026-09-02T10:00:00Z' },
    ];
    const snap = await pull('user-1');
    expect(snap.state).toEqual({ term: '2026FA' });
    expect(snap.courses).toEqual([{ id: 'econ', data: { code: 'ECON 1020' } }]);
  });

  it('reports the newest stamp across every row, not just the state row', async () => {
    // This is what decides whether the account copy is ahead of this device.
    // Taking only the state row would call an account stale while a course
    // imported on the laptop sat there newer than anything here.
    const { pull } = await load();
    harness.rows.state = { data: {}, updated_at: '2026-09-01T00:00:00Z' };
    harness.rows.courses = [
      { id: 'a', data: {}, updated_at: '2026-09-05T00:00:00Z' },
      { id: 'b', data: {}, updated_at: '2026-09-03T00:00:00Z' },
    ];
    expect((await pull('user-1')).updated).toBe(new Date('2026-09-05T00:00:00Z').getTime());
  });

  it('reports nothing rather than now for an account with no rows at all', async () => {
    // Zero, not `Date.now()`. A fresh account must not look newer than the
    // device, or the first sync would pull emptiness over a real semester.
    const { pull } = await load();
    const snap = await pull('user-1');
    expect(snap.state).toBeNull();
    expect(snap.courses).toEqual([]);
    expect(snap.updated).toBe(0);
  });

  it('scopes both reads to the one account', async () => {
    const { pull } = await load();
    await pull('user-1');
    const scoped = harness.log.filter((l) => l.op === 'eq' && l.args[0] === 'user_id');
    expect(scoped).toHaveLength(2);
    for (const call of scoped) expect(call.args[1]).toBe('user-1');
  });

  it('surfaces a database error rather than returning half a semester', async () => {
    const { pull } = await load();
    harness.errors.courses = 'permission denied for table courses';
    await expect(pull('user-1')).rejects.toThrow(/permission denied/);
  });
});

describe('push', () => {
  const course = (id: string) => ({ id, data: { code: id.toUpperCase() } });

  it('writes the state and the courses', async () => {
    const { push } = await load();
    await push('user-1', { term: '2026FA' }, [course('econ')]);
    const upserts = harness.log.filter((l) => l.op === 'upsert');
    expect(upserts.map((u) => u.table)).toEqual(['state', 'courses']);
  });

  it('sends no course write at all when there are none', async () => {
    // An empty upsert is a round trip that achieves nothing, and on a phone
    // plan that is somebody's data.
    const { push } = await load();
    await push('user-1', {}, []);
    expect(harness.log.filter((l) => l.op === 'upsert').map((u) => u.table)).toEqual(['state']);
  });

  it('deletes only the courses this device actually removed', async () => {
    /*
     * The rule this function exists to get right.
     *
     * It used to delete everything the account held that this device did not,
     * which is a way to lose a course: a phone that had never synced would
     * push its two courses and delete the third, imported on the laptop, that
     * it had simply never heard of. Only names it was told about.
     */
    const { push } = await load();
    await push('user-1', {}, [course('econ')], ['psci']);
    expect(harness.deleted()).toEqual(['courses']);
    expect(harness.prunedIds()).toEqual(['psci']);
  });

  it('sends no delete when nothing was removed', async () => {
    const { push } = await load();
    await push('user-1', {}, [course('econ')]);
    expect(harness.deleted()).toEqual([]);
  });

  it('does not delete a course that is also being written', async () => {
    // Deleted and then re-imported before the sync. The write is the newer
    // intention, and running the delete after it would undo it.
    const { push } = await load();
    await push('user-1', {}, [course('econ')], ['econ']);
    expect(harness.deleted()).toEqual([]);
  });

  it('stops and says so if the state write fails', async () => {
    const { push } = await load();
    harness.errors.state = 'JWT expired';
    await expect(push('user-1', {}, [course('econ')])).rejects.toThrow(/JWT expired/);
  });

  it('reports a failed course write rather than reporting success', async () => {
    const { push } = await load();
    harness.errors.courses = 'row-level security';
    await expect(push('user-1', {}, [course('econ')])).rejects.toThrow(/row-level security/);
  });
});

describe('deleteEverything', () => {
  it('empties every table the account owns, then signs out', async () => {
    const { deleteEverything, OWNED_TABLES } = await load();
    const said = await deleteEverything();
    expect(harness.deleted().sort()).toEqual([...OWNED_TABLES].sort());
    expect(harness.db.auth.signOut).toHaveBeenCalled();
    expect(said).toMatch(/empty and you are signed out/i);
  });

  it('says plainly that this device keeps its own copy', async () => {
    // Somebody deleting their account has asked to be off the server, not to
    // lose their semester. The two are separate actions on purpose.
    const { deleteEverything } = await load();
    expect(await deleteEverything()).toMatch(/this device still has its own copy/i);
  });

  it('does not treat a table this build never had as a failure', async () => {
    // A deployment without reminders has no push queue to empty.
    const { deleteEverything } = await load();
    harness.errors.push_queue = "Could not find the table 'public.push_queue' in the schema cache";
    expect(await deleteEverything()).toMatch(/empty and you are signed out/i);
  });

  it('names what it could not remove instead of claiming it did', async () => {
    // "Deleted" is a promise, and a half-kept one has to say which half.
    const { deleteEverything } = await load();
    harness.errors.courses = 'permission denied';
    const said = await deleteEverything();
    expect(said).toMatch(/could not be removed/i);
    expect(said).toContain('courses');
  });

  it('still signs out even when a table refused', async () => {
    const { deleteEverything } = await load();
    harness.errors.courses = 'permission denied';
    await deleteEverything();
    expect(harness.db.auth.signOut).toHaveBeenCalled();
  });
});

describe('saveQueue', () => {
  const reminder = (over = {}) => ({
    id: 'r1',
    at: Date.UTC(2026, 8, 20, 14, 0),
    title: 'Problem Set 1',
    body: 'Due tonight',
    ...over,
  });

  it('replaces the queue rather than adding to it', async () => {
    // The queue is regenerated from the device's own data every time. Adding
    // would send a reminder for a deadline that has since moved.
    const { saveQueue } = await load();
    await saveQueue([reminder()]);
    expect(harness.deleted()).toEqual(['push_queue']);
    expect(harness.log.filter((l) => l.op === 'insert')).toHaveLength(1);
  });

  it('sends no insert when the queue is empty, having cleared it', async () => {
    const { saveQueue } = await load();
    await saveQueue([]);
    expect(harness.deleted()).toEqual(['push_queue']);
    expect(harness.log.filter((l) => l.op === 'insert')).toEqual([]);
  });

  it('carries where a reminder should land when tapped', async () => {
    /*
     * This was a hardcoded empty string, so every reminder the server sent
     * arrived with no destination and every tap opened the app at home — the
     * whole point of working out where a reminder belongs, thrown away one
     * line before it left the device.
     */
    const { saveQueue } = await load();
    await saveQueue([reminder({ screen: 'item', item: 'econ-ps1' })]);
    const [row] = (harness.log.find((l) => l.op === 'insert')?.args[0] as Record<string, unknown>[]) ?? [];
    expect(row.screen).toBe('item');
    expect(row.item).toBe('econ-ps1');
  });

  it('writes an empty destination rather than undefined when there is none', async () => {
    const { saveQueue } = await load();
    await saveQueue([reminder()]);
    const [row] = (harness.log.find((l) => l.op === 'insert')?.args[0] as Record<string, unknown>[]) ?? [];
    expect(row.screen).toBe('');
    expect(row.item).toBe('');
  });

  it('sends the send time as a timestamp the server can compare', async () => {
    const { saveQueue } = await load();
    await saveQueue([reminder()]);
    const [row] = (harness.log.find((l) => l.op === 'insert')?.args[0] as Record<string, unknown>[]) ?? [];
    expect(row.send_at).toBe('2026-09-20T14:00:00.000Z');
  });
});
