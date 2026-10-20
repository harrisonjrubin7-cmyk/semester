// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudentAction } from '../lib/student-actions';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider } from '../state/store';

/**
 * Released feedback in the Action Center: its loading, empty, error and stale
 * states, and that Done, Not relevant and Undo go to the server with the
 * version read. The two calls are the one thing mocked, because they are the
 * network; the store, the Action Center and its ranking are real.
 */

const PS1: StudentAction = {
  id: 'a1', itemId: 'i1', gradeEntryId: 'g1', courseCode: 'ECON 1020', term: '2026FA',
  itemTitle: 'Problem set 1', state: 'open', version: 1, releasedAt: Date.parse('2026-10-20T15:00:00Z'),
};

const remote = vi.hoisted(() => ({
  feed: [] as unknown[],
  fail: null as Error | null,
  pending: null as Promise<void> | null,
  reads: 0,
  settles: [] as [string, string, number][],
  settleError: null as Error | null,
}));

vi.mock('../lib/student-actions-remote', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/student-actions-remote')>();
  return {
    ...real,
    myStudentActions: async () => {
      remote.reads += 1;
      if (remote.pending) await remote.pending;
      if (remote.fail) throw remote.fail;
      return remote.feed;
    },
    settleStudentAction: async (id: string, to: string, version: number) => {
      remote.settles.push([id, to, version]);
      if (remote.settleError) throw remote.settleError;
      return { id, state: to, version: version + 1 };
    },
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { TodayActionCenter } = await import('./TodayActionCenter');
const { StaleActionError } = await import('../lib/student-actions-remote');

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6 }));
  Object.assign(remote, { feed: [PS1], fail: null, pending: null, reads: 0, settles: [], settleError: null });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

const settle = async () => {
  for (let i = 0; i < 4; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

const mount = async (accountId: string | null = 'u1') => {
  await act(async () => {
    root.render(
      <StoreProvider>
        <TodayActionCenter feedbackAccountId={accountId} />
      </StoreProvider>,
    );
  });
  await settle();
};

const text = () => host.textContent ?? '';
const button = (name: string) => {
  const found = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === name);
  if (!found) throw new Error(`no button "${name}" in: ${text().slice(0, 400)}`);
  return found;
};
const click = async (name: string) => {
  await act(async () => button(name).click());
  await settle();
};
/** A button among the released item's own choices, not another action's. */
const choose = async (name: string) => {
  const group = host.querySelector('[aria-label="Choices for Feedback released: Problem set 1"]');
  const found = [...(group?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.trim() === name);
  if (!found) throw new Error(`no "${name}" among the feedback item's choices`);
  await act(async () => found.click());
  await settle();
};

describe('released feedback in the Action Center', () => {
  it('ranks a released grade with the other actions, and its link opens the gradebook', async () => {
    await mount();
    expect(text()).toContain('ECON 1020 released your grade and feedback.');
    expect(text()).not.toContain('Checking for released feedback');
    const row = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Feedback released: Problem set 1'));
    expect(row).toBeTruthy();
    await act(async () => row!.click());
    expect(location.hash).toBe('#/gradebook');
  });

  it('says it is checking while the feed loads', async () => {
    let release!: () => void;
    remote.pending = new Promise<void>((r) => { release = r; });
    await mount();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Checking for released feedback');
    release();
    await settle();
    expect(text()).toContain('Feedback released: Problem set 1');
  });

  it('adds nothing when nothing has been released — the empty Action Center says so itself', async () => {
    remote.feed = [];
    await mount();
    expect(text()).not.toContain('Feedback released');
    expect(text()).not.toContain('Checking for released feedback');
  });

  it('asks nothing of a signed-out device', async () => {
    await mount(null);
    expect(remote.reads).toBe(0);
    expect(text()).not.toContain('Feedback released');
  });

  it('says when the feed failed, and Try again reads it again', async () => {
    remote.fail = new Error('network down');
    await mount();
    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Released feedback could not be loaded');
    remote.fail = null;
    await click('Try again');
    expect(remote.reads).toBe(2);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(text()).toContain('Feedback released: Problem set 1');
  });

  it('sends Done to the server with the version read, and Undo reopens it with the next', async () => {
    await mount();
    remote.feed = [];
    await choose('Done');
    expect(remote.settles).toEqual([['a1', 'done', 1]]);
    expect(text()).toContain('Marked as done. Saved to your account.');
    expect(text()).not.toContain('Feedback released: Problem set 1');
    remote.feed = [{ ...PS1, version: 3 }];
    await click('Undo');
    expect(remote.settles).toEqual([['a1', 'done', 1], ['a1', 'open', 2]]);
    expect(text()).toContain('Undone.');
    expect(text()).toContain('Feedback released: Problem set 1');
  });

  it('keeps a dismissed one under Hidden, and Bring back reopens it on the server', async () => {
    remote.feed = [{ ...PS1, state: 'dismissed', version: 2 }];
    await mount();
    expect(text()).toContain('Hidden (1)');
    await click('Bring back: Feedback released: Problem set 1');
    expect(remote.settles).toEqual([['a1', 'open', 2]]);
  });

  it('on a stale version saves nothing, says so, and refreshes the list', async () => {
    await mount();
    remote.settleError = new StaleActionError();
    const before = remote.reads;
    await choose('Done');
    expect(text()).toContain('This changed on another device, so nothing was saved.');
    expect(remote.reads).toBeGreaterThan(before);
    expect(text()).toContain('Released feedback changed on another device. This list now shows the latest.');
    expect(text()).toContain('Feedback released: Problem set 1');
  });
});
