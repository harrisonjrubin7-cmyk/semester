import { describe, expect, it, vi } from 'vitest';
import { probeReachable, type Reachability } from './claude';

/**
 * Telling a CORS refusal from a dead host, which the app could not do.
 *
 * `lib/claude.ts` used to answer both with one sentence — *"either not
 * deployed or is refusing this origin"* — because that is genuinely all a
 * single `fetch` rejection says. `supabase/functions/_shared/cors.ts` records
 * what that cost: `ALLOWED_ORIGIN` sat on a **localhost** value on the live
 * project, every function was ACTIVE, CI was green, and the deployed site
 * could reach none of them. Nothing server-side could see it, because from the
 * function's side the request arrived and was answered.
 *
 * `probeReachable` asks the same address a second time in `no-cors` mode,
 * which is not subject to the check that threw the first answer away. The two
 * cases separate: something answered, or nothing did.
 *
 * ## What these tests are careful about
 *
 * A probe that returned `'answered'` unconditionally would pass the first test
 * here and be worthless, so the **controls** matter more than the happy path:
 * a rejecting fetch must come back `'silent'`, and an aborted one must not be
 * asked at all. Two of the four tests below exist only to fail if the probe
 * stops discriminating.
 */

/**
 * A fetch that resolves, as a browser's does the moment a server answers.
 *
 * 405 rather than 200 because that is what
 * `supabase/functions/claude/index.ts` really answers a GET, and because the
 * status is the thing the probe must *not* care about: in a real browser a
 * `no-cors` response is opaque and its status reads 0 whatever was sent. A
 * probe that started reading it would work here and answer "silent" against
 * every live deployment.
 */
function answers(status = 405): typeof fetch {
  return vi.fn(async () => new Response(null, { status })) as unknown as typeof fetch;
}

/** A fetch that rejects the way a browser does when nothing is there. */
function silent(): typeof fetch {
  return vi.fn(async () => {
    throw new TypeError('Load failed');
  }) as unknown as typeof fetch;
}

const URL_ = 'https://example.supabase.co/functions/v1/claude';

describe('asking a second time, differently', () => {
  it('reads an answer of any kind as the origin being refused', async () => {
    const send = answers();
    expect(await probeReachable(URL_, { fetch: send })).toBe<Reachability>('answered');
    expect(send).toHaveBeenCalledTimes(1);
  });

  /*
   * Any kind means any kind. A live deployment refusing this origin is still a
   * server that answered, and so is one returning 500 — the probe is asking
   * whether anything is there, not whether it is happy. In a browser it could
   * not read these numbers even if it wanted to.
   */
  it.each([200, 401, 405, 500, 503])('reads %i as an answer too', async (status) => {
    expect(await probeReachable(URL_, { fetch: answers(status) })).toBe<Reachability>('answered');
  });

  /*
   * The control. A probe that could only ever say "answered" would satisfy the
   * test above, and would turn every outage in the app into a confident and
   * wrong instruction to go and edit a secret.
   */
  it('reads nothing at all as the function being absent', async () => {
    expect(await probeReachable(URL_, { fetch: silent() })).toBe<Reachability>('silent');
  });

  /*
   * The second control, and the reason the probe takes a signal at all. A
   * student who pressed stop aborts the signal; the probe would then reject on
   * that same signal and report "silent" — naming a deployment fault that is
   * really a cancelled request. Not asking is the only correct answer here.
   */
  it('does not ask at all once the request has been aborted', async () => {
    const send = answers();
    const ac = new AbortController();
    ac.abort();
    expect(await probeReachable(URL_, { fetch: send, signal: ac.signal })).toBe<Reachability>(
      'unasked',
    );
    expect(send, 'an aborted request must send nothing').not.toHaveBeenCalled();
  });

  /**
   * The method is load-bearing and is not an implementation detail.
   *
   * `supabase/functions/claude/index.ts` answers a non-POST with 405 *before*
   * it reads the key, verifies the caller or calls `count_call`. A POST would
   * reach the meter. So a probe that drifted to POST would start charging
   * students one of their sixty monthly generations for each failed request —
   * silently, and precisely when the app is already broken.
   */
  it('asks with GET and no-cors, so it can neither be refused nor metered', async () => {
    const send = answers();
    await probeReachable(URL_, { fetch: send });
    const [, init] = (send as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0];
    expect(init.method, 'a POST would reach the meter').toBe('GET');
    expect(init.mode, 'a cors request would be thrown away like the first one').toBe('no-cors');
  });
});
