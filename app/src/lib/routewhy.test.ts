// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { route, routeWhy, saveSettings, settings } from './assistant';
import { setSessionToken } from './token';

/**
 * The four situations "nothing yet" used to be.
 *
 * `routeLabel` answers *where an answer would come from*, and when the answer
 * is nowhere it says "nothing yet" to all four — so `components/NeedsKey.tsx`
 * printed one fixed sentence, *"Sign in to use the shared key, or add your
 * own"*, to everybody. To a signed-in student that is not advice, it is a
 * contradiction, and it is the same fault that file was written to end.
 *
 * Each case below is a different thing to do about it, which is the whole
 * argument for the function existing.
 */

const shared = (url: string | undefined) => {
  if (url === undefined) vi.unstubAllEnvs();
  else vi.stubEnv('VITE_SUPABASE_URL', url);
};

beforeEach(() => {
  window.localStorage.clear();
  setSessionToken(null);
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  setSessionToken(null);
});

/** No key, no proxy — the state every case below starts from. */
const bare = () => saveSettings({ ...settings(), apiKey: '', proxy: '', provider: 'anthropic' });

describe('when a question can be asked, it says nothing', () => {
  it('stays silent on a working route', () => {
    saveSettings({ ...settings(), apiKey: 'sk-ant-x', proxy: '' });
    expect(route()).toBe('own');
    expect(routeWhy(false)).toBe('');
  });
});

describe('the four ways there is no route', () => {
  it('signed out, on a build that has a shared key service: sign in', () => {
    bare();
    // The stub is the whole point. This case read `bare()` and nothing else,
    // so it ran against whatever the environment happened to hold — and the
    // sentence it asserted is right only where there is a shared key to sign
    // in *for*. Naming the condition is what turns it from a sentence the app
    // always gave into a sentence about a situation.
    shared('https://project.supabase.co');
    const said = routeWhy(false);
    expect(said).toMatch(/Sign in to use the shared key/);
    expect(said).toMatch(/add your own/);
  });

  it('signed out, on a build with no shared key service: not "sign in"', () => {
    /*
     * The case the order got wrong.
     *
     * `!signedIn` was tested before `!sharedEndpoint()`, so a signed-out
     * student on a build with no shared key service — where `cloud.ts` may
     * offer no sign-in at all — was told to sign in to use a shared key that
     * does not exist. That is the contradiction this file's header says the
     * function exists to end, arriving by the other door.
     */
    bare();
    shared('');
    const said = routeWhy(false);
    expect(said).toMatch(/built without a shared key service/);
    expect(said).not.toMatch(/Sign in/);
  });

  it('signed in, but this build has no shared key service', () => {
    bare();
    shared('');
    setSessionToken('tok');
    const said = routeWhy(true);
    expect(said).toMatch(/built without a shared key service/);
    // And explicitly not the old sentence: telling somebody already signed in
    // to sign in is the contradiction this whole function exists to stop.
    expect(said).not.toMatch(/^Sign in/);
  });

  it('signed in, endpoint present, and the assistant has no session — the impossible one', () => {
    /*
     * `state/store.tsx` sets the account and the token on adjacent lines of a
     * single callback, so this should never happen. It did: an account that
     * rendered "Signed in" while `route()` answered `none`, established from
     * outside the browser through gateway logs and a chunk graph because no
     * screen would say it. If a student reaches this, the two have come apart.
     */
    bare();
    shared('https://project.supabase.co');
    setSessionToken(null);
    expect(route()).toBe('none');
    const said = routeWhy(true);
    expect(said).toMatch(/has not handed its session to the assistant/);
    expect(said).toMatch(/Reload the page/);
    expect(said).not.toMatch(/^Sign in/);
  });

  it('openai with no key, which is not about signing in at all', () => {
    saveSettings({ ...settings(), provider: 'openai', openaiKey: '', apiKey: '', proxy: '' });
    const said = routeWhy(true);
    expect(said).toMatch(/OpenAI key/);
    expect(said).not.toMatch(/shared key/);
  });
});

describe('and the session actually reaching it is the difference', () => {
  it('goes quiet the moment the token arrives', () => {
    bare();
    shared('https://project.supabase.co');
    setSessionToken(null);
    expect(routeWhy(true)).not.toBe('');

    setSessionToken('tok');
    expect(route()).toBe('shared');
    expect(routeWhy(true)).toBe('');
  });

  it('gives four different answers to four different situations', () => {
    const said = new Set<string>();

    // No shared key service. Signing in adds nothing here, so both sign-in
    // states get the same answer — and that is the fix rather than a
    // collapse: the four situations are keyed on what would help, not on
    // whether somebody happens to be signed in.
    bare();
    shared('');
    setSessionToken(null);
    said.add(routeWhy(false));
    said.add(routeWhy(true));
    expect(said.size).toBe(1);

    // With a service, the sign-in state is the difference again.
    shared('https://project.supabase.co');
    said.add(routeWhy(false));
    said.add(routeWhy(true));

    saveSettings({ ...settings(), provider: 'openai', openaiKey: '' });
    said.add(routeWhy(true));

    // The control. One sentence for four situations is what this replaced, so
    // a version that collapsed them again would pass every test above.
    expect(said.size).toBe(4);
  });
});
