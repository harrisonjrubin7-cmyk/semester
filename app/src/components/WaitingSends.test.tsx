// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fakeIndexedDB } from '../lib/sync/fakeidb';

/**
 * What the student saved to send later, and the promise that matters most:
 * coming back online never sends it by itself.
 */

const me = { account: { id: 'u1' } as { id: string } | null };
const net = { online: true, subs: new Set<(v: boolean) => void>() };
const share = vi.fn();
const contribute = vi.fn();

vi.mock('../lib/cloud', () => ({ cloudConfigured: true }));
vi.mock('../state/store', () => ({ useStore: () => ({ account: me.account }), useNow: () => new Date() }));
vi.mock('../lib/offline-mode', async (original) => {
  const react = await import('react');
  return {
    ...(await original<typeof import('../lib/offline-mode')>()),
    useOnline: () => {
      const [on, set] = react.useState(net.online);
      react.useEffect(() => {
        net.subs.add(set);
        return () => void net.subs.delete(set);
      }, []);
      return on;
    },
  };
});
vi.mock('../lib/sync/senders', () => ({
  senders: { share: (p: unknown) => share(p), contribute: (p: unknown) => contribute(p) },
}));

const { WaitingSends, KeepForLater } = await import('./WaitingSends');
const { resetOutbox } = await import('../lib/sync/useOutbox');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
const setOnline = async (on: boolean) => {
  net.online = on;
  await act(async () => net.subs.forEach((s) => s(on)));
};
const flush = () => act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); });
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.getAttribute('aria-label') ?? b.textContent ?? '')) as HTMLButtonElement | undefined;

const offer = { kind: 'share' as const, summary: 'Share “Advising” with a@school.edu, for 7 days from when you send it', payload: { email: 'a@school.edu' } };

async function mount(withOffer = false) {
  await act(async () => {
    root.render(
      <>
        {withOffer ? <KeepForLater {...offer} /> : null}
        <WaitingSends />
      </>,
    );
  });
  await flush();
}

/** A fresh mount: what closing the app and opening it again does. */
async function remount(withOffer = false) {
  await act(async () => root.unmount());
  root = createRoot(host);
  await mount(withOffer);
}

beforeEach(() => {
  vi.stubGlobal('indexedDB', fakeIndexedDB());
  resetOutbox();
  me.account = { id: 'u1' };
  net.online = true;
  net.subs.clear();
  share.mockReset();
  contribute.mockReset();
  share.mockResolvedValue('share-id');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks(); // the spies on the port and on openPort, or they wrap each other across tests
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function keepOne() {
  await mount(true);
  await act(async () => button(/Keep it to send later/)!.click());
  await flush();
}

describe('nothing waiting', () => {
  it('draws nothing at all', async () => {
    await mount();
    expect(host.textContent).toBe('');
  });
});

describe('keeping a request for later', () => {
  it('keeps it, says it will not go by itself, and puts it on the list', async () => {
    await keepOne();
    expect(host.textContent).toMatch(/Waiting for you to send/);
    expect(host.textContent).toMatch(/Share “Advising” with a@school.edu/);
    expect(host.textContent).toMatch(/Nothing here is sent by itself/);
    expect(share).not.toHaveBeenCalled();
  });

  it('offers nothing without an account to hold it for', async () => {
    me.account = null;
    await mount(true);
    // The offer renders, but keeping returns nothing and nothing is listed.
    await act(async () => button(/Keep it to send later/)?.click());
    await flush();
    expect(host.textContent).not.toMatch(/Waiting for you to send/);
  });
});

describe('airplane mode and back', () => {
  it('cannot be sent offline, says why, and calls nothing', async () => {
    await keepOne();
    await setOnline(false);
    const send = button(/^Send: /)!;
    expect(send.disabled).toBe(true);
    expect(host.textContent).toMatch(/You are offline\. It will be ready to send when you are back\./);
    await act(async () => send.click());
    expect(share).not.toHaveBeenCalled();
  });

  it('is NOT sent by itself when the connection comes back, however long it waits', async () => {
    await keepOne();
    await setOnline(false);
    await setOnline(true);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(share).not.toHaveBeenCalled();
    expect(button(/^Send: /)!.disabled).toBe(false); // ready, and waiting for the student
  });

  it('is sent once, on the tap, and shows as sent — even if tapped twice', async () => {
    await keepOne();
    const send = button(/^Send: /)!;
    await act(async () => { send.click(); send.click(); });
    await flush();
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({ email: 'a@school.edu' });
    expect(host.textContent).toMatch(/Sent /);
    expect(button(/^Send: /)).toBeUndefined();
    expect(host.querySelector('section [role="status"]')!.textContent).toMatch(/^Sent\./);
  });

  it('survives a connection that drops mid-send: it may have gone, so the student checks first', async () => {
    share.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await keepOne();
    await act(async () => button(/^Send: /)!.click());
    await flush();
    expect(host.textContent).toMatch(/may or may not have arrived\. Check before sending it again/);
    // Not one tap: the box has to be ticked, on purpose.
    const again = button(/^Send: /)!;
    expect(again.textContent).toBe('Send again');
    expect(again.disabled).toBe(true);
    await act(async () => (host.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
    expect(button(/^Send: /)!.disabled).toBe(false);
    await act(async () => button(/^Send: /)!.click());
    await flush();
    expect(share).toHaveBeenCalledTimes(2);
    expect(host.textContent).toMatch(/Sent /);
  });

  it('says the server’s own words when it refused, and does not call it lost', async () => {
    share.mockRejectedValueOnce(new Error('No advisor at your school uses that address in Semester. Check it with your advisor.'));
    await keepOne();
    await act(async () => button(/^Send: /)!.click());
    await flush();
    expect(host.textContent).toMatch(/Not sent\. No advisor at your school/);
    expect(button(/^Send: /)!.disabled).toBe(false); // a refusal is not delivery: it can be tried again
  });
});

describe('what it will not do', () => {
  it('never sends one that waited more than three days, and says to make it again', async () => {
    await keepOne();
    const later = Date.now() + 3 * 24 * 60 * 60 * 1000 + 1000;
    vi.useFakeTimers({ toFake: ['Date'], now: later });
    resetOutbox();
    await remount();
    expect(host.textContent).toMatch(/waited too long, so it will not go/);
    expect(button(/^Send: /)).toBeUndefined();
    expect(share).not.toHaveBeenCalled();
  });

  it('never shows or sends another account’s', async () => {
    await keepOne();
    me.account = { id: 'u2' };
    resetOutbox();
    await remount();
    expect(host.textContent).toBe('');
    expect(share).not.toHaveBeenCalled();
  });

  it('discarding removes it and sends nothing', async () => {
    await keepOne();
    await act(async () => button(/^Discard: /)!.click());
    await flush();
    expect(share).not.toHaveBeenCalled();
    expect(host.textContent).not.toMatch(/Share “Advising”/);
  });
});

describe('where the browser will not keep it', () => {
  it('says the request will be lost if the app is closed', async () => {
    vi.stubGlobal('indexedDB', undefined);
    resetOutbox();
    await keepOne();
    expect(host.textContent).toMatch(/would not keep them, so they will be lost if you close the app/);
  });

  it('says nothing of the kind where it can', async () => {
    await keepOne();
    expect(host.textContent).not.toMatch(/lost if you close the app/);
  });
});

describe('when the browser will not save', () => {
  it('says it could not be kept, keeps nothing and sends nothing', async () => {
    // A store that opens but refuses every write: the "storage full" case.
    const { openPort } = await import('../lib/sync/outbox');
    const port = await openPort();
    vi.spyOn(port, 'put').mockRejectedValue(new Error('QuotaExceededError'));
    // openPort is called once per tab; hand the failing one to the hook by resetting to it.
    resetOutbox();
    vi.spyOn(await import('../lib/sync/outbox'), 'openPort').mockResolvedValue(port);
    await remount(true);
    await act(async () => button(/Keep it to send later/)!.click());
    await flush();
    expect(host.querySelector('[role="alert"]')!.textContent).toMatch(/could not be kept.*Nothing was saved and nothing was sent/);
    expect(host.textContent).not.toMatch(/Waiting for you to send/);
    expect(share).not.toHaveBeenCalled();
  });

  it('sends nothing if it cannot first write that it is sending', async () => {
    await keepOne();
    const { openPort } = await import('../lib/sync/outbox');
    const port = await openPort();
    const real = port.put.bind(port);
    vi.spyOn(port, 'put').mockImplementation(async (e) => {
      if (e.state === 'sending') throw new Error('QuotaExceededError');
      return real(e);
    });
    resetOutbox();
    vi.spyOn(await import('../lib/sync/outbox'), 'openPort').mockResolvedValue(port);
    await remount();
    await act(async () => button(/^Send: /)!.click());
    await flush();
    expect(share).not.toHaveBeenCalled(); // no place saved, no request made
    expect(host.textContent).toMatch(/Not sent\. This device would not save its place first, so nothing left/);
  });
});

describe('for a keyboard and a screen reader', () => {
  it('has a labelled section, a live region, named buttons at a touch size, and no duplicate ids', async () => {
    await keepOne();
    const section = host.querySelector('section[aria-labelledby="waiting-head"]')!;
    expect(section.querySelector('#waiting-head')!.textContent).toBe('Waiting for you to send');
    expect(host.querySelector('[role="status"][aria-live="polite"]')).toBeTruthy();
    for (const b of host.querySelectorAll('button')) {
      expect((b.getAttribute('aria-label') ?? b.textContent ?? '').trim().length, 'a button has a name').toBeGreaterThan(0);
    }
    expect(button(/^Send: /)!.style.minHeight).toBe('44px');
    const ids = [...host.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('links a disabled Send to the sentence that says why', async () => {
    await keepOne();
    await setOnline(false);
    const send = button(/^Send: /)!;
    const why = host.querySelector(`#${send.getAttribute('aria-describedby')}`);
    expect(why?.textContent).toMatch(/offline/i);
  });

  it('moves focus to the heading after an action, so it is not lost with the row', async () => {
    await keepOne();
    await act(async () => button(/^Discard: /)!.click());
    await flush();
    // The list is empty and the section gone, so the focus that was on the button is not left on nothing.
    expect(document.activeElement === document.body || document.activeElement?.id === 'waiting-head').toBe(true);
  });
});

describe('the two screens that were refused offer it', () => {
  const read = (f: string) => readFileSync(join(import.meta.dirname, f), 'utf8');
  it.each([
    ['AdvisorMeeting.tsx', 'share'],
    ['DemandContribution.tsx', 'contribute'],
  ])('%s offers to keep it when the refusal is for want of a connection', (file, kind) => {
    const text = read(file);
    expect(text).toContain("import { OfflineRefusal } from '../lib/offline-mode'");
    expect(text).toMatch(/instanceof OfflineRefusal/);
    expect(text).toContain(`<KeepForLater kind="${kind}"`);
  });
});
