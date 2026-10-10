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
    for (const name of ['eq', 'in', 'select', 'delete', 'insert', 'update', 'upsert', 'maybeSingle']) {
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
      /*
       * One entry in `OWNED_TABLES` is emptied by a function rather than by a
       * filtered DELETE, because DELETE on its table is revoked from both API
       * roles. Recorded under the same log so that "what did the button send"
       * is one question with one answer, rather than two lists a later test
       * has to remember to check both of.
       */
      rpc: (fn: string, args?: unknown) => {
        log.push({ table: fn, op: 'rpc', args: [args] });
        return Promise.resolve(
          errors[fn] ? { data: null, error: { message: errors[fn] } } : { data: null, error: null },
        );
      },
      auth: {
        getUser: async () => ({ data: { user: { id: 'user-1' } } }),
        getSession: async (): Promise<{ data: { session: { access_token: string } | null } }> => ({
          data: { session: { access_token: 'access-token' } },
        }),
        signOut: vi.fn(async () => ({ error: null })),
        signInWithSSO: vi.fn(async (args: unknown) => {
          log.push({ table: 'auth', op: 'signInWithSSO', args: [args] });
          return { error: errors.auth ? { message: errors.auth } : null };
        }),
        resetPasswordForEmail: vi.fn(async (email: string, opts: unknown) => {
          log.push({ table: 'auth', op: 'resetPasswordForEmail', args: [email, opts] });
          return { error: errors.auth ? { message: errors.auth } : null };
        }),
      },
    },
    /** Which tables a delete was sent to, in order. */
    deleted: () => log.filter((l) => l.op === 'delete').map((l) => l.table),
    /** Which functions were called, in order. */
    called: () => log.filter((l) => l.op === 'rpc').map((l) => l.table),
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
  vi.stubEnv('VITE_UNIVERSITY_GATEWAY_URL', 'https://gateway.example.test');
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

describe('sendReset', () => {
  /*
   * It returned nothing, and the form only puts a sentence up when it is
   * given one — so a reset link that went looked exactly like a button that
   * did nothing, which is the one situation where somebody presses twice.
   */
  it('gives the form something to say', async () => {
    const mod = await load();
    const said = await mod.sendReset('you@vanderbilt.edu');
    expect(said).toContain('you@vanderbilt.edu');
    expect(said).toMatch(/reset link/i);
  });

  it('does not say whether that address has an account', async () => {
    // Supabase answers the same way for an address it has never seen, so that
    // nobody can use this form to find out who has an account here. Saying
    // more than the call knows would give that back.
    const mod = await load();
    expect(await mod.sendReset('nobody@example.edu')).toMatch(/^If /);
  });

  it('still throws what the service said', async () => {
    const mod = await load();
    harness.errors.auth = 'For security purposes, you can only request this after 60 seconds.';
    await expect(mod.sendReset('you@vanderbilt.edu')).rejects.toThrow(/60 seconds/);
  });
});

describe('signOut', () => {
  it('propagates an account-service refusal to the caller', async () => {
    const mod = await load();
    harness.db.auth.signOut.mockResolvedValueOnce({ error: { message: 'Sign-out service unavailable' } });
    await expect(mod.signOut()).rejects.toThrow(/Sign-out service unavailable/);
  });
});

describe('namesSaid', () => {
  /*
   * The paragraph under the buttons named Google and Microsoft by hand, and
   * Apple was added to the record without it — so the app drew three buttons
   * under a line describing two. Generating it from the record fixed that and
   * left the narrower version standing: the record is every provider the app
   * knows, and the buttons are every provider the *project* has on. It takes
   * the names now, and the form passes the ones it drew.
   */
  it('reads as a sentence rather than as a list', async () => {
    const { namesSaid } = await load();
    expect(namesSaid(['Google', 'Microsoft', 'Apple'])).toBe('Google, Microsoft or Apple');
    expect(namesSaid(['Google', 'Microsoft'])).toBe('Google or Microsoft');
  });

  it('is still a sentence with one name, and with none', async () => {
    // One switched-on provider is the case this was rewritten for: "Any
    // Google or  account works" was what joining a one-item list by hand gave.
    const { namesSaid } = await load();
    expect(namesSaid(['Google'])).toBe('Google');
    expect(namesSaid([])).toBe('');
  });
});

describe('providersOn', () => {
  /*
   * Every provider is a dashboard switch, and nothing in the app could see it
   * — so the form drew all three whatever the project had on, and on a project
   * with none of them on all three were doors that could not open.
   *
   * The distinction these tests exist for is `null` against `[]`. They are the
   * same shape of "no buttons" to a careless caller and they are opposite
   * facts: one is the project saying it has none, the other is the app failing
   * to ask. Reading the second as the first hides the only working sign-in
   * from somebody whose network dropped for a moment.
   */
  const answers = (external: unknown, ok = true) =>
    vi.fn(async () => ({ ok, json: async () => ({ external }) }) as unknown as Response);

  it('returns only the providers the project has switched on', async () => {
    const mod = await load();
    vi.stubGlobal('fetch', answers({ email: true, google: true, azure: false, apple: false }));
    expect(await mod.providersOn()).toEqual(['google']);
  });

  it('ignores providers this app does not offer a button for', async () => {
    // The record carries a dozen of them, and a `true` beside github is not a
    // button anybody asked for.
    const mod = await load();
    vi.stubGlobal('fetch', answers({ github: true, discord: true, google: true }));
    expect(await mod.providersOn()).toEqual(['google']);
  });

  it('says none, as a fact, when the project has none on', async () => {
    const mod = await load();
    vi.stubGlobal('fetch', answers({ email: true, google: false, azure: false, apple: false }));
    expect(await mod.providersOn()).toEqual([]);
  });

  it('says it could not ask, rather than saying none, when the fetch fails', async () => {
    const mod = await load();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    expect(await mod.providersOn()).toBeNull();
  });

  it('says it could not ask when the project answers with an error', async () => {
    const mod = await load();
    vi.stubGlobal('fetch', answers({ google: true }, false));
    expect(await mod.providersOn()).toBeNull();
  });

  it('says it could not ask when the answer is not the shape it expects', async () => {
    const mod = await load();
    vi.stubGlobal('fetch', answers(undefined));
    expect(await mod.providersOn()).toBeNull();
  });

  it('asks the project once, however many callers race for it', async () => {
    // The form mounts on the first run and again on the account screen.
    const mod = await load();
    const fetching = answers({ google: true });
    vi.stubGlobal('fetch', fetching);
    await Promise.all([mod.providersOn(), mod.providersOn(), mod.providersOn()]);
    expect(fetching).toHaveBeenCalledTimes(1);
  });

  it('asks the settings endpoint of the configured project, with the key', async () => {
    const mod = await load();
    const fetching = answers({ google: true });
    vi.stubGlobal('fetch', fetching);
    await mod.providersOn();
    const [url, init] = fetching.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://project.supabase.co/auth/v1/settings');
    expect((init.headers as Record<string, string>).apikey).toBe('a-publishable-key');
  });

  it('answers none without a request when no project is configured', async () => {
    // A device-only build has no project to ask and no account screen to ask
    // for. A request here would be to nowhere.
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_KEY', '');
    const fetching = vi.fn();
    vi.stubGlobal('fetch', fetching);
    expect(await (await import('./cloud')).providersOn()).toEqual([]);
    expect(fetching).not.toHaveBeenCalled();
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

describe('institutional SSO activation', () => {
  const response = (body: unknown, ok = true) =>
    vi.fn(async (_input: string, _init?: RequestInit) => ({ ok, json: async () => body }));

  it('accepts only an enabled configuration supplied by the university gateway', async () => {
    const mod = await load();
    const fetching = response({ enabled: true, label: 'Vanderbilt', domain: 'vanderbilt.edu' });
    vi.stubGlobal('fetch', fetching);
    await expect(mod.institutionSsoConfig()).resolves.toEqual({
      enabled: true,
      label: 'Vanderbilt',
      domain: 'vanderbilt.edu',
    });
    expect(fetching).toHaveBeenCalledWith(
      'https://gateway.example.test/v1/auth/config',
      expect.objectContaining({ credentials: 'omit', redirect: 'error' }),
    );
    expect(JSON.stringify(fetching.mock.calls[0]?.[1] ?? {})).not.toMatch(/authorization|bearer/i);
  });

  it.each([
    [{ enabled: false }],
    [{ enabled: true, label: 'Vanderbilt', domain: 'not a host' }],
    [{ enabled: true, label: '', domain: 'vanderbilt.edu' }],
  ])('keeps the institutional button hidden for disabled or malformed configuration', async (body) => {
    const mod = await load();
    vi.stubGlobal('fetch', response(body));
    await expect(mod.institutionSsoConfig()).resolves.toBeNull();
  });

  it('keeps the institutional button hidden when no gateway is configured', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_UNIVERSITY_GATEWAY_URL', '');
    const fetching = vi.fn();
    vi.stubGlobal('fetch', fetching);
    await expect((await import('./cloud')).institutionSsoConfig()).resolves.toBeNull();
    expect(fetching).not.toHaveBeenCalled();
  });

  it('starts domain discovery with the one allowlisted app callback', async () => {
    const mod = await load();
    await mod.signInWithSSO({ domain: 'vanderbilt.edu', redirectTo: 'https://example.test/' });
    expect(harness.log.find((entry) => entry.op === 'signInWithSSO')?.args[0]).toEqual({
      domain: 'vanderbilt.edu',
      options: { redirectTo: 'https://example.test/' },
    });
  });

  it('refuses a different redirect before asking the auth service', async () => {
    const mod = await load();
    await expect(
      mod.signInWithSSO({ domain: 'vanderbilt.edu', redirectTo: 'https://attacker.example/' }),
    ).rejects.toThrow(/approved app address/i);
    expect(harness.log.some((entry) => entry.op === 'signInWithSSO')).toBe(false);
  });
});

describe('explainSyncError', () => {
  it('turns a missing table into the setup step that was missed', async () => {
    const { explainSyncError } = await load();
    const out = explainSyncError("Could not find the table 'public.state' in the schema cache");
    expect(out).toContain('supabase/migrations/');
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

  /*
   * The per-row stamps, which are what decides whether to take rather than the
   * newest one above. `state/shape.ts` has the two ways a single newest stamp
   * loses work; this is the shape that replaces it.
   */
  it('reports every row\u2019s own stamp, exactly as the database wrote it', async () => {
    const { pull } = await load();
    harness.rows.state = { data: {}, updated_at: '2026-09-01T00:00:00.123456Z' };
    harness.rows.courses = [
      { id: 'econ', data: {}, updated_at: '2026-09-05T00:00:00Z' },
      { id: 'psci', data: {}, updated_at: '2026-09-03T00:00:00Z' },
    ];
    expect((await pull('user-1')).seen).toEqual({
      // Not parsed and not re-formatted: a value whose only job is to be
      // compared with itself should survive the round trip byte for byte.
      state: '2026-09-01T00:00:00.123456Z',
      courses: { econ: '2026-09-05T00:00:00Z', psci: '2026-09-03T00:00:00Z' },
    });
  });

  it('has no state entry at all for an account that has no state row', async () => {
    // Absent, not empty-string: `unseen` compares it against what was last
    // seen, and "there is no state row" has to differ from "there is one".
    const { pull } = await load();
    harness.rows.courses = [];
    expect((await pull('user-1')).seen).toEqual({ courses: {} });
  });
});

describe('push', () => {
  const course = (id: string) => ({ id, data: { code: id.toUpperCase() } });

  it('writes the state and the courses', async () => {
    // A device that has read nothing inserts; `cloudcas.test.ts` has the
    // updates and what happens when the account moved on.
    const { push } = await load();
    await push('user-1', { term: '2026FA' }, [course('econ')]);
    const inserts = harness.log.filter((l) => l.op === 'insert');
    expect(inserts.map((u) => u.table)).toEqual(['state', 'courses']);
  });

  it('never upserts, which would write over a copy this device has not read', async () => {
    const { push } = await load();
    await push('user-1', {}, [course('econ')]);
    expect(harness.log.filter((l) => l.op === 'upsert')).toEqual([]);
  });

  it('sends no course write at all when there are none', async () => {
    // An empty write is a round trip that achieves nothing, and on a phone
    // plan that is somebody's data.
    const { push } = await load();
    await push('user-1', {}, []);
    expect(harness.log.filter((l) => l.op === 'insert').map((u) => u.table)).toEqual(['state']);
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

  /*
   * What the device writes down as "taken", and where it comes from.
   *
   * This used to be `Date.now()` on the device, compared against `updated_at`
   * from the database. `20260901000700_records.sql` spends a paragraph on why
   * a device clock must never decide a sync — "a phone set five minutes fast
   * would otherwise win every conflict forever, silently, until somebody
   * noticed their laptop's edits never survived" — and stops a client writing
   * the column. The watermark then put the same clock on the other side of the
   * comparison, with the same result.
   */
  it('reports the stamps the database wrote, so no device clock reaches the watermark', async () => {
    const { push } = await load();
    harness.rows.state = { updated_at: '2026-09-14T10:00:02Z' };
    harness.rows.courses = [
      { id: 'econ', updated_at: '2026-09-14T10:00:02Z' },
      { id: 'psci', updated_at: '2026-09-14T10:00:02Z' },
    ];
    expect(await push('user-1', {}, [course('econ'), course('psci')])).toEqual({
      state: '2026-09-14T10:00:02Z',
      courses: { econ: '2026-09-14T10:00:02Z', psci: '2026-09-14T10:00:02Z' },
    });
  });

  it('asks for those stamps back on the same statement that wrote them', async () => {
    // A second round trip to read what was just written would be a window of
    // its own; the write already returns the row.
    const { push } = await load();
    harness.rows.state = { updated_at: '2026-09-14T10:00:02Z' };
    harness.rows.courses = [{ id: 'econ', updated_at: '2026-09-14T10:00:02Z' }];
    await push('user-1', {}, [course('econ')]);
    const asked = harness.log.filter((l) => l.op === 'select').map((l) => l.args[0]);
    expect(asked).toContain('updated_at');
    expect(asked).toContain('id, updated_at');
  });

  it('claims nothing for a push that wrote no courses', async () => {
    // Rows this device did not write are not rows it has seen. Leaving them
    // out is what makes the next refresh take them.
    const { push } = await load();
    harness.rows.state = { updated_at: '2026-09-14T10:00:02Z' };
    expect(await push('user-1', {}, [])).toEqual({
      state: '2026-09-14T10:00:02Z',
      courses: {},
    });
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
  /*
   * The button no longer deletes anything itself. It asks the `delete-account`
   * Edge Function, which erases every row in one transaction and then the
   * sign-in (`supabase/functions/_shared/deleteaccount.ts`, and
   * `supabase/deletion.check.sql` for the SQL). What is left here is the part
   * a person reads: signed out only when both happened, and told the truth in
   * every other case — including the one where nobody can know.
   */
  const answering = (status: number, body: unknown) =>
    vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));

  it('asks the function, with the session and the word, and deletes nothing itself', async () => {
    const { deleteEverything } = await load();
    const fetching = answering(200, { erased: true, signInRemoved: true, message: 'Your account is deleted.' });
    vi.stubGlobal('fetch', fetching);
    await deleteEverything();
    const [url, init] = fetching.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://project.supabase.co/functions/v1/delete-account');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-token');
    expect(JSON.parse(String(init.body))).toEqual({ confirm: 'DELETE' });
    // The old path, one DELETE per table from the browser, is gone.
    expect(harness.deleted()).toEqual([]);
    expect(harness.called()).toEqual([]);
  });

  it('signs out only when the rows and the sign-in are both gone', async () => {
    const { deleteEverything } = await load();
    vi.stubGlobal('fetch', answering(200, { erased: true, signInRemoved: true, message: 'Your account is deleted.' }));
    const said = await deleteEverything();
    expect(harness.db.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(said).toMatch(/your account is deleted/i);
    expect(said).toMatch(/signed out/i);
    // Somebody deleting their account has asked to be off the server, not to
    // lose their semester. The two are separate actions on purpose.
    expect(said).toMatch(/this device still has its own copy/i);
  });

  it('stays signed in and says nothing was deleted when nothing was', async () => {
    const { deleteEverything } = await load();
    const message = 'Your account could not be deleted, and nothing was: every row is exactly where it was.';
    vi.stubGlobal('fetch', answering(500, { erased: false, signInRemoved: false, message }));
    expect(await deleteEverything()).toBe(message);
    expect(harness.db.auth.signOut).not.toHaveBeenCalled();
  });

  it('stays signed in and says which half happened when only the rows went', async () => {
    // Signed in, because pressing the button again is what finishes it — and
    // that needs the session this would otherwise throw away.
    const { deleteEverything } = await load();
    const message = 'Your data is deleted, but the sign-in itself could not be removed yet.';
    vi.stubGlobal('fetch', answering(500, { erased: true, signInRemoved: false, message }));
    const said = await deleteEverything();
    expect(said).toBe(message);
    expect(said).not.toMatch(/nothing was deleted/i);
    expect(harness.db.auth.signOut).not.toHaveBeenCalled();
  });

  it('does not claim nothing was deleted when no answer came back', async () => {
    /*
     * A rejected fetch is not evidence that nothing happened. A CORS refusal
     * is exactly this rejection, and the browser produces it after the
     * function has run — `_shared/cors.ts` carries the incident where every
     * function was in that state for days. The only true sentence is that
     * nobody here knows.
     */
    const { deleteEverything, ERASURE_UNKNOWN } = await load();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Load failed'); }));
    const said = await deleteEverything();
    expect(said).toBe(ERASURE_UNKNOWN);
    expect(said).not.toMatch(/nothing was deleted/i);
    expect(said).toMatch(/cannot say whether anything was deleted/i);
    expect(harness.db.auth.signOut).not.toHaveBeenCalled();
  });

  it('treats an answer it cannot read as not knowing, not as success', async () => {
    const { deleteEverything, ERASURE_UNKNOWN } = await load();
    vi.stubGlobal('fetch', answering(502, '<html>Bad gateway</html>'));
    expect(await deleteEverything()).toBe(ERASURE_UNKNOWN);
    expect(harness.db.auth.signOut).not.toHaveBeenCalled();
  });

  it('says plainly when this server has no such function yet', async () => {
    // A project the migration and the function have not reached answers 404
    // before anything runs, so here "nothing was deleted" is known.
    const { deleteEverything } = await load();
    vi.stubGlobal('fetch', answering(404, { message: 'Requested function was not found' }));
    const said = await deleteEverything();
    expect(said).toMatch(/nothing was deleted/i);
    expect(harness.db.auth.signOut).not.toHaveBeenCalled();
  });

  it('refuses to start without a session', async () => {
    const { deleteEverything } = await load();
    harness.db.auth.getSession = async () => ({ data: { session: null } });
    const fetching = vi.fn();
    vi.stubGlobal('fetch', fetching);
    await expect(deleteEverything()).rejects.toThrow(/sign in first/i);
    expect(fetching).not.toHaveBeenCalled();
  });

  it('still names every table the page says goes, and every one it says stays', async () => {
    // The lists are the privacy page's account now rather than the button's
    // instructions. `erasure.test.ts` holds them to the schema; here, only
    // that each kept table carries a reason the page can print.
    const { OWNED_TABLES, KEPT_TABLES } = await load();
    expect(OWNED_TABLES.length).toBeGreaterThan(20);
    for (const { table, why } of KEPT_TABLES) {
      expect(OWNED_TABLES.map((t) => t.table), table).not.toContain(table);
      expect(why.length, table).toBeGreaterThan(80);
    }
  });
});

describe('exportAccount', () => {
  it('asks the server for everything it holds about this account, as a named JSON file', async () => {
    const { exportAccount } = await load();
    const file = { format: 'semester.account-export', tables: { courses: [{ id: 'econ' }], notes: [] } };
    harness.db.rpc = ((fn: string, args?: unknown) => {
      harness.log.push({ table: fn, op: 'rpc', args: [args] });
      return Promise.resolve({ data: file, error: null });
    }) as unknown as typeof harness.db.rpc;
    const got = await exportAccount(new Date('2026-09-28T12:00:00Z'));
    expect(harness.called()).toEqual(['export_my_data']);
    expect(got.name).toBe('Semester account export 2026-09-28.json');
    expect(JSON.parse(got.body)).toEqual(file);
    expect(got.tables).toBe(2);
  });

  it('reports a refusal rather than saving an empty file', async () => {
    const { exportAccount } = await load();
    harness.errors.export_my_data = 'Sign in first.';
    await expect(exportAccount()).rejects.toThrow(/sign in first/i);
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

describe('push under read-only mode', () => {
  /** Fresh, with the flag set — the module reads it at import, like the project URL. */
  async function loadReadOnly() {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_KEY', 'a-publishable-key');
    vi.stubEnv('VITE_READ_ONLY', 'true');
    harness = makeDb();
    vi.doMock('@supabase/supabase-js', () => ({ createClient: () => harness.db }));
    return import('./cloud');
  }

  it('refuses before it writes anything, or even fetches the client', async () => {
    const mod = await loadReadOnly();
    await expect(mod.push('user-1', { term: '2026FA' }, [{ id: 'c1', data: {} }])).rejects.toMatchObject({ name: 'ReadOnly' });
    expect(harness.log, 'no table was touched').toEqual([]);
  });

  it('is the ordinary push when the flag is anything but true — the control', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_READ_ONLY', 'on');
    const mod = await load();
    harness.rows.state = { updated_at: '2026-09-28T10:00:00Z' };
    await expect(mod.push('user-1', { term: '2026FA' }, [])).resolves.toBeTruthy();
    expect(harness.log.some((l) => l.table === 'state' && l.op === 'insert')).toBe(true);
  });
});
