// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import type { Message } from '../lib/classmates';

/**
 * The mention badge had never been able to appear.
 *
 * `components/room/rooms.test.tsx` proves the badge draws — it hands `Rooms` a
 * `Listed` row with `mentions: 2` and finds the pill. `lib/roomchat.test.ts`
 * proves `unread` counts a mention correctly. Both pass, both always passed,
 * and the badge was still unreachable in the shipping app, because the one
 * thing neither covers is the argument the screen hands the library:
 * `screens/Classmates.tsx` passed `[]` for the handles, and `pieces` only
 * treats `@name` as a mention when `name` is in that list.
 *
 * So `@harrison` was plain text, `mentions` could only ever count `@class`,
 * and a warning-coloured pill with a screen-reader label sat in the codebase
 * that no message from a classmate could light.
 *
 * That is a whole class of bug this suite could not see: a correct component
 * and a correct library, wired together with a wrong constant. A test that
 * builds its own `Listed` row cannot find it, because building the row is the
 * step that was broken. **This one starts from the messages.**
 *
 * Found in #668, where the same `[]` was copied into the Today row and its
 * mount test caught it there.
 *
 * ## What is faked
 *
 * Only the three queries and the account, through `importOriginal`, so
 * `roomsFor`, `roomKey`, `listed`, `unread`, `pieces` and `mentionsMe` are all
 * the shipping code. The badge asserted below is found by the accessible name
 * the real `Rooms` gives it.
 */

const session = {
  user: { id: 'me', email: 'a@vanderbilt.edu', app_metadata: { provider: 'email' } },
  access_token: 'tok',
} as unknown as Session;

vi.mock('../lib/cloud', async (original) => ({
  ...(await original<typeof import('../lib/cloud')>()),
  cloudConfigured: true,
  accountOf: (s: Session | null) =>
    s?.user ? { id: s.user.id, email: s.user.email ?? '', via: 'email' } : null,
  currentSession: async () => session,
  onAuthChange: () => () => {},
  pull: async () => null,
  push: async () => {},
}));

let joined: string[] = [];
let said: Message[] = [];

vi.mock('../lib/classmates', async (original) => ({
  ...(await original<typeof import('../lib/classmates')>()),
  eligible: () => true,
  myProfile: async () => ({ handle: 'harrison' }),
  myRooms: async () => joined,
  across: async () => said,
}));

const { StoreProvider } = await import('../state/store');
const { Classmates } = await import('./Classmates');
const { loadSeed } = await import('../data/seed');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ROOM = 'vanderbilt/ECON 1020';

function from(who: string, body: string, minutesAgo = 5): Message {
  return {
    id: `${who}-${minutesAgo}`,
    term: '2026FA',
    code: ROOM,
    user_id: who,
    body,
    created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  } as Message;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  history.replaceState(null, '', '/');
  localStorage.clear();
  joined = [ROOM];
  said = [];
  window.matchMedia = (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  host = document.createElement('div');
  document.body.append(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

/** Mount, and wait out the store's idle-callback fallback — 600ms, per `state/storetoken.test.tsx`. */
async function draw(): Promise<void> {
  await loadSeed().catch(() => []);
  await act(async () => {
    root = createRoot(host);
    root.render(
      <StoreProvider>
        <Classmates />
      </StoreProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 600));
  });
}

/** The badge, by the accessible name `components/room/Rooms.tsx` gives it. */
function badges(): string[] {
  return [...host.querySelectorAll('[aria-label]')]
    .map((el) => el.getAttribute('aria-label') ?? '')
    .filter((l) => /\bmentions?\b/.test(l));
}

describe('the mention badge in the room list', () => {
  it('appears when a classmate names you by handle', async () => {
    said = [from('oskar', '@harrison can you send your notes?')];
    await draw();
    expect(badges()).toEqual(['1 mention']);
  });

  it('counts several, and says so in the plural', async () => {
    said = [
      from('oskar', '@harrison notes?'),
      from('kayo', 'also @harrison for the reading', 3),
    ];
    await draw();
    expect(badges()).toEqual(['2 mentions']);
  });

  it('still counts a message addressed to the whole room', async () => {
    // `@class` worked before this fix and must keep working — the control
    // that stops "pass the handle" being written as "pass only the handle".
    said = [from('oskar', '@class does anyone have Thursday?')];
    await draw();
    expect(badges()).toEqual(['1 mention']);
  });

  /*
   * The controls. Without these, a `mentions` that simply counted every
   * message would pass all three tests above and be nonsense.
   */

  it('does not appear for an ordinary message', async () => {
    said = [from('oskar', 'is it due Friday?')];
    await draw();
    expect(badges()).toEqual([]);
  });

  it('does not appear for an @ that matches nobody', async () => {
    // An unmatched `@` stays plain text on purpose: painting it would tell the
    // reader somebody had been addressed who will never be told.
    said = [from('oskar', 'email @registrar about it')];
    await draw();
    expect(badges()).toEqual([]);
  });

  it('does not count your own message naming yourself', async () => {
    said = [from('me', '@harrison remember to post the notes')];
    await draw();
    expect(badges()).toEqual([]);
  });
});
