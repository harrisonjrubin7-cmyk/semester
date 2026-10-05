import { describe, expect, it, vi } from 'vitest';
import {
  AccountHeldError,
  SAID,
  serveDeleteAccount,
  type DeleteAccountAnswer,
  type DeleteAccountDeps,
} from '../../../supabase/functions/_shared/deleteaccount';

/**
 * The `delete-account` Edge Function, walked answer by answer.
 *
 * The SQL half — that `erase_account` is complete, keeps what the privacy page
 * says stays, and is all-or-nothing — is `supabase/deletion.check.sql`, against
 * real policies. What is left for here is the order and the words: nobody's
 * sign-in is removed while their rows are still there, nobody is told
 * "nothing was deleted" when something was, and the account acted on is the
 * one the token belongs to, whatever the body says.
 */

const ME = '11111111-1111-1111-1111-111111111111';
const SOMEONE_ELSE = '22222222-2222-2222-2222-222222222222';

const post = (opts: { auth?: string; body?: unknown; method?: string } = {}) =>
  new Request('https://x.supabase.co/functions/v1/delete-account', {
    method: opts.method ?? 'POST',
    headers: opts.auth ? { Authorization: opts.auth } : {},
    ...((opts.method ?? 'POST') === 'POST'
      ? { body: opts.body === undefined ? JSON.stringify({ confirm: 'DELETE' }) : String(opts.body) }
      : {}),
  });

function deps(over: Partial<Record<'whoIs' | 'erase' | 'deleteUser', 'throws' | 'null' | 'held'>> = {}) {
  const calls: string[] = [];
  const d: DeleteAccountDeps = {
    whoIs: vi.fn(async (token: string) => {
      calls.push('whoIs');
      if (over.whoIs === 'throws') throw new Error('auth down');
      if (over.whoIs === 'null') return null;
      return token === 'good-token' ? ME : null;
    }),
    erase: vi.fn(async (id: string) => {
      calls.push(`erase:${id}`);
      if (over.erase === 'throws') throw new Error('restrict_violation');
      if (over.erase === 'held') throw new AccountHeldError();
      return { removed: { courses: 3 } };
    }),
    deleteUser: vi.fn(async (id: string) => {
      calls.push(`deleteUser:${id}`);
      if (over.deleteUser === 'throws') throw new Error('admin api down');
    }),
  };
  return { d, calls };
}

const read = async (res: Response) => (await res.json()) as DeleteAccountAnswer;

describe('the delete-account function', () => {
  it('answers a preflight with the headers it was given, and touches nothing', async () => {
    const { d, calls } = deps();
    const res = await serveDeleteAccount(post({ method: 'OPTIONS' }), d, { 'Access-Control-Allow-Origin': 'https://app.test' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.test');
    expect(calls).toEqual([]);
  });

  it('refuses anything but POST', async () => {
    const { d, calls } = deps();
    const res = await serveDeleteAccount(post({ method: 'GET', auth: 'Bearer good-token' }), d);
    expect(res.status).toBe(405);
    expect(await read(res)).toMatchObject({ erased: false, signInRemoved: false });
    expect(calls).toEqual([]);
  });

  it('deletes nothing when the server has no service credentials', async () => {
    const res = await serveDeleteAccount(post({ auth: 'Bearer good-token' }), null);
    expect(res.status).toBe(503);
    expect(await read(res)).toEqual({ erased: false, signInRemoved: false, message: SAID.unconfigured });
  });

  it('needs a token, and a token that is somebody', async () => {
    for (const auth of [undefined, 'Bearer ', 'Basic good-token', 'Bearer wrong-token']) {
      const { d, calls } = deps();
      const res = await serveDeleteAccount(post({ auth }), d);
      expect(res.status, String(auth)).toBe(401);
      expect((await read(res)).erased, String(auth)).toBe(false);
      expect(calls.filter((c) => c !== 'whoIs'), String(auth)).toEqual([]);
    }
  });

  it('treats an auth service that cannot answer as signed out, not as yes', async () => {
    const { d, calls } = deps({ whoIs: 'throws' });
    const res = await serveDeleteAccount(post({ auth: 'Bearer good-token' }), d);
    expect(res.status).toBe(401);
    expect(calls).toEqual(['whoIs']);
  });

  it('needs the word, so a bare POST with a live session is not enough', async () => {
    for (const body of ['{}', '{"confirm":"delete"}', 'not json', '{"confirm":true}']) {
      const { d, calls } = deps();
      const res = await serveDeleteAccount(post({ auth: 'Bearer good-token', body }), d);
      expect(res.status, body).toBe(400);
      expect(await read(res), body).toEqual({ erased: false, signInRemoved: false, message: SAID.unconfirmed });
      expect(calls, body).toEqual([]);
    }
  });

  it('acts on the account the token belongs to, never one named in the body', async () => {
    const { d, calls } = deps();
    const body = JSON.stringify({ confirm: 'DELETE', userId: SOMEONE_ELSE, target: SOMEONE_ELSE });
    await serveDeleteAccount(post({ auth: 'Bearer good-token', body }), d);
    expect(calls).toEqual(['whoIs', `erase:${ME}`, `deleteUser:${ME}`]);
    expect(calls.join(' ')).not.toContain(SOMEONE_ELSE);
  });

  it('erases the rows first, then the sign-in, and says both happened', async () => {
    const { d, calls } = deps();
    const res = await serveDeleteAccount(post({ auth: 'Bearer good-token' }), d);
    expect(res.status).toBe(200);
    expect(await read(res)).toEqual({
      erased: true,
      signInRemoved: true,
      message: SAID.done,
      removed: { removed: { courses: 3 } },
    });
    expect(calls).toEqual(['whoIs', `erase:${ME}`, `deleteUser:${ME}`]);
  });

  /*
   * The order is the property. Deleting the sign-in first and the rows second
   * would leave, on any failure between them, rows naming an account nobody
   * can sign in as any more to finish the job — and with no token, nobody the
   * function can act for.
   */
  it('keeps the sign-in when the rows could not be erased, and says nothing was deleted', async () => {
    const { d, calls } = deps({ erase: 'throws' });
    const res = await serveDeleteAccount(post({ auth: 'Bearer good-token' }), d);
    expect(res.status).toBe(500);
    expect(await read(res)).toEqual({ erased: false, signInRemoved: false, message: SAID.eraseFailed });
    expect(d.deleteUser).not.toHaveBeenCalled();
    expect(calls).toEqual(['whoIs', `erase:${ME}`]);
  });

  it('tells a student whose account is held that it cannot be deleted now, and deletes nothing', async () => {
    const { d, calls } = deps({ erase: 'held' });
    const res = await serveDeleteAccount(post({ auth: 'Bearer good-token' }), d);
    expect(res.status).toBe(409);
    expect(await read(res)).toEqual({ erased: false, signInRemoved: false, message: SAID.held });
    // The sign-in is not touched when the erasure was refused.
    expect(calls).toEqual(['whoIs', `erase:${ME}`]);
  });

  it('says it is not a fault, gives no reason, and does not call it an error to retry', () => {
    expect(SAID.held).toMatch(/nothing was deleted/i);
    expect(SAID.held).toMatch(/not a fault/i);
    expect(SAID.held).not.toMatch(/legal|investigat|lawsuit|subpoena|why|because/i);
    expect(SAID.held).not.toMatch(/try again/i);
  });

  it('still calls any other failure a failure, and a hold is not one', async () => {
    const { d } = deps({ erase: 'throws' });
    const res = await serveDeleteAccount(post({ auth: 'Bearer good-token' }), d);
    expect(res.status).toBe(500);
    expect((await read(res)).message).toBe(SAID.eraseFailed);
  });

  it('says so plainly when the rows went and the sign-in did not', async () => {
    const { d } = deps({ deleteUser: 'throws' });
    const res = await serveDeleteAccount(post({ auth: 'Bearer good-token' }), d);
    expect(res.status).toBe(500);
    const said = await read(res);
    expect(said).toMatchObject({ erased: true, signInRemoved: false, message: SAID.signInKept });
    expect(said.message).toMatch(/safe to repeat/i);
  });

  it('never tells anybody nothing was deleted in an answer where something was', () => {
    // The sentences themselves, since the page prints them as they are.
    expect(SAID.eraseFailed).toMatch(/nothing was/i);
    expect(SAID.signInKept).not.toMatch(/nothing was/i);
    expect(SAID.done).not.toMatch(/nothing was/i);
  });

  it('marks every answer uncacheable', async () => {
    const { d } = deps();
    const res = await serveDeleteAccount(post({ auth: 'Bearer good-token' }), d);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
