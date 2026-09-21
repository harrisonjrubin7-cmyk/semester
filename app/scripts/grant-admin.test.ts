import { describe, expect, it } from 'vitest';
import { looksLikeServiceKey, parseArgs, plausibleEmail, readConfig } from './grant-admin.ts';

/**
 * The refusals, which are the whole of this script's behaviour worth testing.
 *
 * Everything else in `grant-admin.ts` is a round trip to a project, and a test
 * that mocked one would be asserting that the mock was written the way the
 * code was. What is worth pinning is what it refuses to do *before* reaching
 * the network, because each of those is a case where going ahead would have
 * looked like it worked.
 */

/** A legacy-style key carrying a role claim. Not signed; nothing here verifies one. */
const jwt = (role: string) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.sig`;

describe('which key this will use', () => {
  it('takes a service-role JWT and the new-style secret key', () => {
    expect(looksLikeServiceKey(jwt('service_role'))).toBe(true);
    expect(looksLikeServiceKey('sb_secret_abcdef123456')).toBe(true);
  });

  /*
   * The control, and the reason this function exists. `app_admins` has no
   * policy, so with the publishable key `list` returns zero rows and no
   * error — indistinguishable from an empty table. A refusal is the only
   * honest answer.
   */
  it('refuses the two keys that would read an empty table instead of erroring', () => {
    expect(looksLikeServiceKey(jwt('anon'))).toBe(false);
    expect(looksLikeServiceKey('sb_publishable_abcdef123456')).toBe(false);
  });

  it('refuses a string that is not a key at all', () => {
    for (const junk of ['', '   ', 'hunter2', 'a.b', 'a.b.c.d', 'x.!!!notbase64!!!.y']) {
      expect(looksLikeServiceKey(junk), junk).toBe(false);
    }
  });

  it('is not fooled by a JWT whose payload is valid base64 but not an object', () => {
    const weird = `h.${Buffer.from('"service_role"').toString('base64url')}.s`;
    expect(looksLikeServiceKey(weird)).toBe(false);
  });
});

describe('the environment it needs', () => {
  const key = jwt('service_role');

  it('takes a url and a service key', () => {
    const got = readConfig({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: key });
    expect(got).toEqual({ ok: true, url: 'https://x.supabase.co', key });
  });

  it('says which one is missing rather than failing later', () => {
    const noUrl = readConfig({ SUPABASE_SERVICE_ROLE_KEY: key });
    expect(noUrl.ok).toBe(false);
    expect(noUrl.ok === false && noUrl.why).toContain('SUPABASE_URL');

    const noKey = readConfig({ SUPABASE_URL: 'https://x.supabase.co' });
    expect(noKey.ok).toBe(false);
    expect(noKey.ok === false && noKey.why).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('refuses a publishable key in the service key variable', () => {
    const got = readConfig({
      SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: jwt('anon'),
    });
    expect(got.ok).toBe(false);
    expect(got.ok === false && got.why).toContain('does not look like a service key');
  });

  it('treats whitespace as absence, because a shell will hand you it', () => {
    expect(readConfig({ SUPABASE_URL: '  ', SUPABASE_SERVICE_ROLE_KEY: key }).ok).toBe(false);
  });
});

describe('what it was asked to do', () => {
  it('reads the three commands', () => {
    expect(parseArgs(['list'])).toEqual({ ok: true, verb: 'list' });
    expect(parseArgs(['grant', 'ada@example.com'])).toEqual({
      ok: true,
      verb: 'grant',
      email: 'ada@example.com',
      note: '',
    });
    expect(parseArgs(['revoke', 'ada@example.com'])).toEqual({
      ok: true,
      verb: 'revoke',
      email: 'ada@example.com',
    });
  });

  it('takes an unquoted note as the rest of the line', () => {
    expect(parseArgs(['grant', 'ada@example.com', 'the', 'founder'])).toEqual({
      ok: true,
      verb: 'grant',
      email: 'ada@example.com',
      note: 'the founder',
    });
  });

  it('refuses a command it does not have, and says so by name', () => {
    const got = parseArgs(['promote', 'ada@example.com']);
    expect(got.ok).toBe(false);
    expect(got.ok === false && got.why).toContain('"promote"');
  });

  it('refuses an address that is not one', () => {
    for (const bad of ['ada', 'ada@', '@example.com', 'a b@example.com', 'a@b@c']) {
      expect(parseArgs(['grant', bad]).ok, bad).toBe(false);
    }
  });

  /*
   * `grant --force ada@example.com` would otherwise read `--force` as the
   * address and fail with a confusing message about an account that does not
   * exist. There are no flags; a leading dash is a mistake worth naming.
   */
  it('refuses a flag where an address goes', () => {
    expect(parseArgs(['grant', '--force']).ok).toBe(false);
    expect(plausibleEmail('--force@example.com')).toBe(false);
  });

  it('refuses a note the column cannot hold, rather than letting the server truncate it', () => {
    expect(parseArgs(['grant', 'ada@example.com', 'x'.repeat(201)]).ok).toBe(false);
    expect(parseArgs(['grant', 'ada@example.com', 'x'.repeat(200)]).ok).toBe(true);
  });

  it('refuses arguments the commands do not take', () => {
    expect(parseArgs(['list', 'ada@example.com']).ok).toBe(false);
    expect(parseArgs(['revoke', 'ada@example.com', 'why']).ok).toBe(false);
    expect(parseArgs([]).ok).toBe(false);
  });
});
