// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';

/**
 * What actually leaves the device when somebody says something is wrong.
 *
 * `lib/feedback.test.ts` proves `routeShape` reduces a route to a shape across
 * a dozen hostile inputs. `supabase/feedback.check.sql` proves Postgres
 * refuses a raw one at the column. Between those two sits the part neither
 * covers: **the row this form actually builds.** A form that called
 * `window.location.href` directly, or assembled its own route, would pass the
 * library's tests untouched and be refused by the database only after a
 * student had pressed Send — which is a worse way to find out than not being
 * able to write the code.
 *
 * So this captures the insert and reads the payload.
 *
 * ## What is faked
 *
 * The account and the database client, through `importOriginal`, so
 * `lib/feedback.ts` — the shaping, the validation, the payload — is entirely
 * the shipping code. `rows` below is what the real `send` handed to the real
 * `.insert()`.
 */

const session = {
  user: { id: 'me', email: 'a@vanderbilt.edu', app_metadata: { provider: 'email' } },
  access_token: 'tok',
} as unknown as Session;

let signedIn: Session | null = session;
/** Every row the form sent, as `send` built it. */
let rows: Record<string, unknown>[] = [];
/** What the insert answers with, so the failure path can be driven too. */
let refuse: string | null = null;

vi.mock('../lib/cloud', async (original) => ({
  ...(await original<typeof import('../lib/cloud')>()),
  cloudConfigured: true,
  accountOf: (s: Session | null) =>
    s?.user ? { id: s.user.id, email: s.user.email ?? '', via: 'email' } : null,
  currentSession: async () => signedIn,
  onAuthChange: () => () => {},
  pull: async () => null,
  push: async () => {},
  cloud: async () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        rows.push(row);
        return Promise.resolve({ error: refuse ? { message: refuse } : null });
      },
    }),
  }),
}));

const { StoreProvider } = await import('../state/store');
const { STORAGE_KEY } = await import('../state/shape');
const { SaySomething } = await import('./SaySomething');
const { loadSeed } = await import('../data/seed');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  signedIn = session;
  rows = [];
  refuse = null;
  host = document.createElement('div');
  document.body.append(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

/** Mount at a given address, and wait out the store's idle fallback. */
async function draw(hash = '#/today'): Promise<void> {
  /*
   * Past onboarding before mounting, and it matters more than it looks.
   *
   * A fresh profile is sent to `#/onboarding` by the store, which rewrites the
   * address — so without this every case below silently measured the
   * onboarding route rather than the one it set, and the redaction assertions
   * passed for the wrong reason. Found because the context line read
   * `/onboarding` when the test had asked for a course.
   */
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ schemaVersion: 6, seenOnboarding: true, sample: true }),
  );
  history.replaceState(null, '', `/${hash}`);
  await loadSeed().catch(() => []);
  await act(async () => {
    root = createRoot(host);
    root.render(
      <StoreProvider>
        <SaySomething />
      </StoreProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 600));
  });
}

const text = () => host.textContent ?? '';
const box = () => host.querySelector('textarea');
const button = (name: RegExp) =>
  [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));

async function type(what: string): Promise<void> {
  const area = box();
  if (!area) throw new Error('no box');
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  await act(async () => {
    setter?.call(area, what);
    area.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function sendIt(): Promise<void> {
  await act(async () => button(/^Send$/)?.click());
  await act(async () => {
    await Promise.resolve();
  });
}

describe('what leaves the device', () => {
  it('sends the shape of the screen, never the screen', async () => {
    await draw('#/course/greek-orthodox-theology-seminar');
    await type('The reading list is empty');
    await sendIt();

    expect(rows).toHaveLength(1);
    expect(rows[0].route).toBe('/course/:id');
    // The whole point, asserted against the payload rather than the display.
    expect(JSON.stringify(rows[0])).not.toMatch(/theology|orthodox|seminar/i);
  });

  it('sends no room key when one is in the address', async () => {
    await draw('#/classmates?room=vanderbilt/ECON%201020');
    await type('Messages arrive twice');
    await sendIt();

    expect(rows[0].route).toBe('/classmates');
    expect(JSON.stringify(rows[0])).not.toMatch(/ECON|vanderbilt|room=/);
  });

  it('sends what the person wrote, the kind, and who they are', async () => {
    await draw('#/today');
    await type('Back button does nothing');
    await sendIt();

    expect(rows[0]).toMatchObject({
      author: 'me',
      kind: 'bug',
      note: 'Back button does nothing',
      route: '/today',
    });
  });

  it('sends the kind that was chosen', async () => {
    await draw('#/today');
    await act(async () => button(/Confusing/)?.click());
    await type('I could not tell how');
    await sendIt();

    expect(rows[0].kind).toBe('confusing');
  });

  /*
   * The control. Every assertion above is about what is *absent* from the
   * payload, and all of them pass on a form that sends nothing at all.
   */
  it('really does send something', async () => {
    await draw('#/today');
    await type('Something happened');
    await sendIt();
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toBe('Something happened');
  });
});

describe('what the person is told', () => {
  it('shows the context in the words it will be stored in', async () => {
    await draw('#/course/econ');
    expect(text()).toContain('Sent with this: /course/:id');
  });

  it('says thank you once it has gone', async () => {
    await draw('#/today');
    await type('A thing');
    await sendIt();
    expect(text()).toContain('Sent.');
  });

  it('keeps the address when the send is refused, rather than losing the report', async () => {
    refuse = 'network down';
    await draw('#/today');
    await type('A thing');
    await sendIt();

    expect(text()).toContain('network down');
    expect(text()).toContain('@');
    // Still on the form, so the words they wrote are still there to copy.
    expect(box()?.value).toBe('A thing');
  });

  it('will not send an empty report', async () => {
    await draw('#/today');
    expect(button(/^Send$/)?.disabled).toBe(true);
    await sendIt();
    expect(rows).toHaveLength(0);
  });

  it('offers the address instead when nobody is signed in', async () => {
    signedIn = null;
    await draw('#/today');
    expect(text()).toContain('@');
    expect(box()).toBeNull();
  });
});
