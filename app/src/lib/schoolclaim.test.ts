import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { domainOf, looksClaimable, type KnownSchool } from './schoolclaim';

const SQL = readFileSync(
  join(process.cwd(), '..', 'supabase/migrations/20260921170000_schools.sql'),
  'utf8',
);

const VANDY: KnownSchool = {
  id: 'vanderbilt',
  name: 'Vanderbilt University',
  shortName: 'Vanderbilt',
  domains: ['vanderbilt.edu'],
};

describe('the domain of an address', () => {
  it('is taken from the last @, not the first', () => {
    // A quoted local part may contain one. `split('@')[1]` gives `b"` here,
    // which matches nothing — it fails closed, but for a reason nobody could
    // read off the screen. The migration takes the same last-@ reading.
    expect(domainOf('"a@b"@vanderbilt.edu')).toBe('vanderbilt.edu');
    expect(domainOf('harrison@vanderbilt.edu')).toBe('vanderbilt.edu');
  });

  it('is lower case and trimmed, because an address is not', () => {
    expect(domainOf('  Harrison@Vanderbilt.EDU  ')).toBe('vanderbilt.edu');
  });

  it('is empty when there is no @ at all', () => {
    expect(domainOf('harrison')).toBe('');
    expect(domainOf('')).toBe('');
  });
});

describe('what the form may say before anybody presses anything', () => {
  it('recognises an address the school publishes', () => {
    expect(looksClaimable('harrison@vanderbilt.edu', VANDY)).toBe(true);
    expect(looksClaimable('HARRISON@VANDERBILT.EDU', VANDY)).toBe(true);
  });

  it('does not recognise one it does not', () => {
    expect(looksClaimable('harrison@gmail.com', VANDY)).toBe(false);
    expect(looksClaimable('harrison@alumni.vanderbilt.edu', VANDY)).toBe(false);
  });

  it('refuses everybody for a school that publishes no domains', () => {
    // Empty is a real state and means "not claimable yet". It must refuse
    // rather than admit, which is the direction a missing value usually fails
    // in the wrong way.
    const blank: KnownSchool = { ...VANDY, domains: [] };
    expect(looksClaimable('harrison@vanderbilt.edu', blank)).toBe(false);
  });

  it('is not a subdomain match, which would admit a different mailbox', () => {
    expect(looksClaimable('x@mail.vanderbilt.edu', VANDY)).toBe(false);
    expect(looksClaimable('x@notvanderbilt.edu', VANDY)).toBe(false);
  });
});

/**
 * The half that is the security, asserted against the SQL rather than the TS.
 *
 * `invite.test.ts` does the same thing for the same reason: the enforcement is
 * in the database, this file is an explanation, and a test that only exercised
 * the explanation would pass just as happily with the enforcement deleted.
 */
describe('the enforcement, which is not in this module', () => {
  it('revokes the column from both API roles, so a direct write cannot set it', () => {
    expect(SQL).toMatch(/revoke update \(school_id\) on public\.profiles from anon, authenticated;/);
  });

  it('never grants that column back', () => {
    expect(SQL).not.toMatch(/grant update \([^)]*school_id/);
  });

  it('reads the address from auth.users and requires it confirmed', () => {
    const fn = /create or replace function public\.claim_school[\s\S]*?\$\$;/.exec(SQL)?.[0] ?? '';
    expect(fn, 'claim_school is gone').not.toBe('');
    expect(fn).toMatch(/from auth\.users/);
    expect(fn).toMatch(/email_confirmed_at is not null/);
    // Not `auth.jwt()` and not an argument: the address has to be the one the
    // server confirmed, never one the caller supplies.
    expect(fn, 'the address must not come from the caller').not.toMatch(/want_email|addr\s+text\s*:?=\s*\$/);
  });

  it('raises rather than returning quietly, so a refusal cannot read as a win', () => {
    const fn = /create or replace function public\.claim_school[\s\S]*?\$\$;/.exec(SQL)?.[0] ?? '';
    expect((fn.match(/raise exception/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('is definer with an empty search_path, like every other definer here', () => {
    const fn = /create or replace function public\.claim_school[\s\S]*?\$\$;/.exec(SQL)?.[0] ?? '';
    expect(fn).toMatch(/security definer/);
    expect(fn).toMatch(/set search_path = ''/);
  });

  it('is executable by a signed-in person and by nobody else', () => {
    expect(SQL).toMatch(/revoke all on function public\.claim_school\(text\) from public, anon;/);
    expect(SQL).toMatch(/grant execute on function public\.claim_school\(text\) to authenticated;/);
  });

  it('lets anyone read the school list and only an admin write it', () => {
    expect(SQL).toMatch(/create policy schools_read on public\.schools\s*\n\s*for select using \(true\);/);
    expect(SQL).toMatch(/create policy schools_write[\s\S]*?private\.is_app_admin\(\)/);
  });

  it('hardcodes no university, which is the rule the whole table exists to keep', () => {
    // A seeded 'vanderbilt' row would put one university's name in the schema
    // every other university has to live in. The bundled profiles are a
    // client-side matter; this table is about who the server believes.
    const body = SQL.replace(/^--.*$/gm, '');
    expect(body).not.toMatch(/insert into public\.schools/i);
  });

  it('same_school refuses two people who have claimed nothing', () => {
    const fn = /create or replace function private\.same_school[\s\S]*?\$\$;/.exec(SQL)?.[0] ?? '';
    expect(fn, 'same_school is gone').not.toBe('');
    // `null = null` is null, which a policy reads as false — but that is the
    // subtle half, so the explicit not-null is what is asserted.
    expect(fn).toMatch(/me\.school_id is not null/);
  });
});
