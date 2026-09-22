// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import type { Report, ReportStatus } from '../lib/moderation';
import { Moderation } from './Moderation';

/**
 * The report queue, drawn.
 *
 * `lib/moderation.test.ts` holds the model — the order, the sentence, the
 * pattern across reporters — and every one of those cases passed while the
 * screen drew nothing, because there is no way to reach a real row from here:
 * the rows only exist for an account on `public.app_admins` in a live project,
 * and this container has neither. Driven in Chromium, the screen reaches its
 * empty state and stops there.
 *
 * So the rows are stood up here instead. What this file is for is the half the
 * browser run cannot see: that a report renders its complaint, the message it
 * was about, the four transitions — and that pressing one of them sends the
 * move and then **re-reads**, rather than assuming it worked. A screen that
 * patched the row in place would show a status the server may have refused,
 * which on a moderation queue is the difference between a report being dealt
 * with and somebody believing it was.
 */

let rows: Report[] = [];
let moved: { id: string; status: ReportStatus }[] = [];
/** Set to make the next `moveTo` fail, the way a policy refusal would. */
let refuse = false;
let reads = 0;

vi.mock('../lib/moderation', async () => {
  const real = await vi.importActual<typeof import('../lib/moderation')>('../lib/moderation');
  return {
    ...real,
    queue: () => {
      reads += 1;
      // Through the real ordering, so this file cannot disagree with the model
      // about which report is at the top.
      return Promise.resolve(real.queueOrder(rows));
    },
    moveTo: (id: string, status: ReportStatus) => {
      if (refuse) return Promise.reject(new Error('refused by a policy'));
      moved.push({ id, status });
      rows = rows.map((r) => (r.id === id ? { ...r, status } : r));
      return Promise.resolve();
    },
  };
});

// `cloudConfigured` is false in a test, and the screen must still draw its
// rows — the flag decides whether it reads, not whether it renders.
vi.mock('../lib/cloud', async () => {
  const real = await vi.importActual<typeof import('../lib/cloud')>('../lib/cloud');
  return { ...real, cloudConfigured: true };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const report = (over: Partial<Report> = {}): Report => ({
  id: 'r1',
  reporter: 'aaaaaaaa-1111-4111-8111-111111111111',
  message_id: 'm1',
  about: 'bbbbbbbb-2222-4222-8222-222222222222',
  reason: 'Told me to kill myself in the ECON room.',
  copy: 'the message, exactly as it was sent',
  created_at: new Date().toISOString(),
  status: 'open',
  ...over,
});

function text(): string {
  return (host.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function button(named: RegExp): HTMLButtonElement {
  const found = [...host.querySelectorAll('button')].find((b) =>
    named.test((b.textContent ?? '').trim()),
  );
  if (!found) throw new Error(`no button reading ${named} — the screen has: ${
    [...host.querySelectorAll('button')].map((b) => b.textContent).join(' | ')
  }`);
  return found as HTMLButtonElement;
}

async function draw() {
  await act(async () => {
    root.render(
      <StoreProvider>
        <Moderation />
      </StoreProvider>,
    );
  });
  // The queue read is a promise behind the first effect.
  await act(async () => {
    await Promise.resolve();
  });
}

/*
 * `src/seedawait.test.ts` is the guard that caught this file for not doing it,
 * and the race it is about is the one CLAUDE.md singles out: the store sets a
 * sample load going on mount, and a test that does not wait for it can finish
 * with the load still in flight.
 */
beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
  rows = [];
  moved = [];
  refuse = false;
  reads = 0;
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  // `src/rootunmount.test.ts` is the guard that a file which mounts a root
  // takes it down again, and it is the guard that found a real leak.
  act(() => root.unmount());
  host.remove();
});

describe('a report, drawn', () => {
  it('shows the complaint and the message it was about', async () => {
    rows = [report()];
    await draw();
    expect(text()).toContain('Told me to kill myself in the ECON room.');
    // The copy is the column the table keeps precisely so that a report about a
    // deleted message is still readable.
    expect(text()).toContain('the message, exactly as it was sent');
  });

  it('names the accounts as accounts, never as people', async () => {
    rows = [report()];
    await draw();
    expect(text()).toContain('About account bbbbbbbb');
    expect(text()).toContain('reported by aaaaaaaa');
  });

  it('says when the message it was about is gone', async () => {
    rows = [report({ message_id: null })];
    await draw();
    expect(text()).toContain('the message has since been deleted');
  });

  it('offers the other three statuses and not the one it is at', async () => {
    rows = [report({ status: 'open' })];
    await draw();
    for (const label of ['Under review', 'Resolved', 'Dismissed']) {
      expect(() => button(new RegExp(`^${label}$`))).not.toThrow();
    }
    // "Open" appears as this report's own status, and must not also be a
    // button — a transition to where you already are is a press that does
    // nothing and reads as broken.
    expect([...host.querySelectorAll('button')].map((b) => b.textContent)).not.toContain('Open');
  });
});

describe('moving one along', () => {
  it('sends the move and re-reads rather than assuming it worked', async () => {
    rows = [report({ id: 'r1', status: 'open' })];
    await draw();
    const before = reads;
    await act(async () => {
      button(/^Under review$/).click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(moved).toEqual([{ id: 'r1', status: 'under_review' }]);
    // The re-read is the assertion. A screen that patched the row in place
    // would show a status the server may never have accepted.
    expect(reads).toBeGreaterThan(before);
    expect(text()).toContain('Under review');
  });

  it('says so when the server refuses, and does not pretend it moved', async () => {
    rows = [report({ id: 'r1', status: 'open' })];
    refuse = true;
    await draw();
    await act(async () => {
      button(/^Resolved$/).click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(text()).toContain('refused by a policy');
    expect(moved).toEqual([]);
    expect(text()).toContain('1 report is waiting.');
  });
});

describe('what the queue says about itself', () => {
  it('never claims an empty queue it cannot tell from a locked one', async () => {
    rows = [];
    await draw();
    // The sentence that would otherwise be repeated to a third party. See
    // `lib/moderation.ts`.
    expect(text()).toMatch(/either an empty queue or an account that is not one/);
  });

  it('draws the pattern across reporters above the list', async () => {
    const them = 'cccccccc-3333-4333-8333-333333333333';
    rows = [
      report({ id: '1', about: them, reporter: 'p1' }),
      report({ id: '2', about: them, reporter: 'p2' }),
    ];
    await draw();
    expect(text()).toContain('Reported by more than one person');
    expect(text()).toContain('Account cccccccc — 2 people');
  });

  it('says nothing about a pattern when one person reported twice', async () => {
    // The control. A panel that appears on every queue is a panel that says
    // nothing, and this is the case that would make it one.
    const them = 'cccccccc-3333-4333-8333-333333333333';
    rows = [
      report({ id: '1', about: them, reporter: 'p1' }),
      report({ id: '2', about: them, reporter: 'p1' }),
    ];
    await draw();
    expect(text()).not.toContain('Reported by more than one person');
  });

  it('puts what is unfinished first', async () => {
    rows = [
      report({ id: 'done', status: 'resolved', reason: 'the resolved one' }),
      report({ id: 'live', status: 'open', reason: 'the open one' }),
    ];
    await draw();
    const body = text();
    expect(body.indexOf('the open one')).toBeLessThan(body.indexOf('the resolved one'));
  });
});
