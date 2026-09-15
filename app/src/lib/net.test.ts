import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MOVE_MS, TALK_MS, fetchWithin, timedOut, tookTooLong } from './net';

/**
 * The point of `fetchWithin` is the case a normal test cannot reach by waiting:
 * a server that accepts the connection and then never answers. So the tests
 * below stand a fake `fetch` in its place that settles only when its signal
 * aborts, and ask for a deadline of a few milliseconds rather than fifteen
 * seconds.
 *
 * Real timers rather than fake ones on purpose: `AbortSignal.timeout` is a
 * platform timer, not a `setTimeout` the test runner can reach in, so a fake
 * clock moves past the deadline without ever firing it. A real two
 * milliseconds is both faithful and quick.
 */

/** Long enough to be a deadline, short enough to be a test. */
const BLINK = 2;

const original = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = original;
});

/** A server that answers nothing, ever — until the request is aborted. */
function silent(): { seen: () => RequestInit | undefined } {
  let last: RequestInit | undefined;
  globalThis.fetch = ((_input: unknown, init?: RequestInit) => {
    last = init;
    return new Promise<Response>((_resolve, reject) => {
      // A signal that is already aborted fires no event, and the real `fetch`
      // rejects on one straight away. Without this line the fake waits for an
      // `abort` that has already happened, which is a hang in the test rather
      // than a fault in the code.
      if (init?.signal?.aborted) {
        reject(init.signal.reason);
        return;
      }
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    });
  }) as typeof fetch;
  return { seen: () => last };
}

describe('fetchWithin', () => {
  it('gives up on a server that never answers', async () => {
    silent();
    const e = await fetchWithin('https://example.test/thing', {}, BLINK).catch(
      (err: unknown) => err,
    );
    expect(timedOut(e)).toBe(true);
  });

  it('is still waiting on a long deadline when a short one would have given up', async () => {
    silent();
    const caught = fetchWithin('https://example.test/upload', { method: 'POST' }, 10_000).catch(
      (e: unknown) => e,
    );
    let settled = false;
    void caught.then(() => {
      settled = true;
    });
    // Past a deadline of BLINK several times over, and still open.
    await new Promise((r) => setTimeout(r, BLINK * 20));
    expect(settled).toBe(false);
  });

  it('asks for the conversational deadline unless told otherwise', () => {
    // The two are the contract the call sites lean on: a question is short,
    // a body that moves is not.
    expect(TALK_MS).toBeLessThan(MOVE_MS);
    expect(TALK_MS).toBeGreaterThanOrEqual(10_000);
  });

  it('keeps the caller’s own abort, so closing a screen still cancels', async () => {
    silent();
    const mine = new AbortController();
    const caught = fetchWithin('https://example.test/thing', { signal: mine.signal }).catch(
      (e: unknown) => e,
    );
    mine.abort(new DOMException('Gone', 'AbortError'));
    const e = await caught;
    expect((e as DOMException).name).toBe('AbortError');
    // Not a timeout: the person asked for this one, and it reads differently.
    expect(timedOut(e)).toBe(false);
  });

  it('passes the rest of the request through untouched', async () => {
    const fake = silent();
    void fetchWithin('https://example.test/thing', {
      method: 'PUT',
      headers: { Accept: 'text/calendar' },
    }).catch(() => undefined);
    expect(fake.seen()?.method).toBe('PUT');
    expect(fake.seen()?.headers).toEqual({ Accept: 'text/calendar' });
    expect(fake.seen()?.signal).toBeInstanceOf(AbortSignal);
  });

  /*
   * The same four promises again, on a browser without `AbortSignal.any`.
   *
   * It is newer than this app can assume — Safari 17.4, March 2024 — and the
   * README's front page tells people to open this on a phone. These stand the
   * function aside and re-run the cases that depend on it, which is the only
   * way to be sure the fallback is the one being exercised: with the real
   * `AbortSignal.any` present it would pass either way.
   */
  describe('where AbortSignal.any does not exist', () => {
    const had = AbortSignal.any;

    beforeEach(() => {
      (AbortSignal as { any?: unknown }).any = undefined;
    });

    afterEach(() => {
      (AbortSignal as { any?: unknown }).any = had;
    });

    it('still gives up on a server that never answers', async () => {
      silent();
      const e = await fetchWithin('https://example.test/thing', {}, BLINK).catch(
        (err: unknown) => err,
      );
      expect(timedOut(e)).toBe(true);
    });

    it('still lets the caller’s own abort through, with its reason', async () => {
      silent();
      const mine = new AbortController();
      const caught = fetchWithin('https://example.test/thing', { signal: mine.signal }).catch(
        (e: unknown) => e,
      );
      mine.abort(new DOMException('Gone', 'AbortError'));
      const e = await caught;
      expect((e as DOMException).name).toBe('AbortError');
      // The reason has to survive, or a deadline and a Stop read the same.
      expect(timedOut(e)).toBe(false);
    });

    it('takes a signal that had already aborted before the call', async () => {
      silent();
      const mine = new AbortController();
      mine.abort(new DOMException('Gone', 'AbortError'));
      const e = await fetchWithin('https://example.test/thing', { signal: mine.signal }).catch(
        (err: unknown) => err,
      );
      expect((e as DOMException).name).toBe('AbortError');
    });
  });

  it('returns the answer when there is one', async () => {
    globalThis.fetch = (() => Promise.resolve(new Response('ok'))) as typeof fetch;
    const res = await fetchWithin('https://example.test/thing');
    expect(await res.text()).toBe('ok');
  });
});

describe('timedOut', () => {
  it('is false for the things that are not a deadline', () => {
    expect(timedOut(new Error('Failed to fetch'))).toBe(false);
    expect(timedOut(new DOMException('Aborted', 'AbortError'))).toBe(false);
    expect(timedOut(null)).toBe(false);
    expect(timedOut('TimeoutError')).toBe(false);
  });
});

describe('tookTooLong', () => {
  it('names what did not answer, and says what to do', () => {
    expect(tookTooLong('Google')).toBe(
      'Google did not answer in time. Check your connection and try again.',
    );
  });
});
