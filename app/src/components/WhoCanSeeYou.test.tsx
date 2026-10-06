// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessOverview } from '../lib/access-overview';
import type { Account } from '../lib/cloud';

/**
 * The "who can see your things" panel in every state: signed out, loading,
 * empty, a list, one source failed, all of it failed, and the retry.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const load = vi.fn<(id: string, now: number) => Promise<AccessOverview>>();

import { WhoCanSeeYou } from './WhoCanSeeYou';

let root: Root;
let host: HTMLDivElement;
const account = { id: 'me', email: 'a@b.c' } as Account;
const flush = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
  load.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  act(() => { root = createRoot(host); });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = async (acct: Account | null) => {
  act(() => root.render(<WhoCanSeeYou account={acct} now={() => 0} read={load} />));
  await flush();
};

describe('WhoCanSeeYou', () => {
  it('signed out, says so and reads nothing', async () => {
    await render(null);
    expect(host.textContent).toContain('Sign in to see who has access');
    expect(load).not.toHaveBeenCalled();
  });

  it('shows loading before the answer arrives', () => {
    load.mockReturnValue(new Promise(() => {}));
    act(() => root.render(<WhoCanSeeYou account={account} now={() => 0} read={load} />));
    expect(host.textContent).toContain('who can see your things');
    expect(host.querySelector('ul')).toBeNull();
  });

  it('says nobody can see anything only when every source answered and none is open', async () => {
    load.mockResolvedValue({ entries: [], failed: [] });
    await render(account);
    expect(host.textContent).toContain('Nobody can see anything of yours');
  });

  it('lists each entry with its end and where to end it', async () => {
    load.mockResolvedValue({
      entries: [
        { id: '1', kind: 'family', what: 'Your housing, only the items you named', endsAt: '2026-10-10T12:00:00Z' },
        { id: '2', kind: 'guardian', what: 'Your school record, to read', endsAt: null },
      ],
      failed: [],
    });
    await render(account);
    const items = [...host.querySelectorAll('li')].map((li) => li.textContent ?? '');
    expect(items).toHaveLength(2);
    expect(items[0]).toContain('Family access');
    expect(items[0]).toContain('Ends ');
    expect(items[0]).toContain('End it in Family.');
    expect(items[1]).toContain('No end date.');
    expect(items[1]).toContain('your school');
  });

  it('names a source it could not read, and never claims nobody has access', async () => {
    load.mockResolvedValue({ entries: [], failed: ['advisor'] });
    await render(account);
    expect(host.textContent).toContain('Could not check: advisor share');
    expect(host.textContent).not.toContain('Nobody can see anything');
  });

  it('a whole failure offers a way back and retrying reads again', async () => {
    load.mockRejectedValueOnce(new Error('offline'));
    await render(account);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Could not check who has access');
    load.mockResolvedValueOnce({ entries: [], failed: [] });
    const retry = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Try again')!;
    act(() => retry.click());
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('Nobody can see anything');
  });
});
