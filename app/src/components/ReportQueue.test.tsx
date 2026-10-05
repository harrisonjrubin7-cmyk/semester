// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ModerationAccess, QueuedReport } from '../lib/moderation';

/**
 * The queue as each kind of account sees it. `lib/moderation` is mocked at the
 * network edge only — the ordering, counts and moves are the real ones.
 */

let access: ModerationAccess = { canRead: false, canAct: false };
let rows: QueuedReport[] = [];
const moved: [string, string][] = [];

vi.mock('../lib/moderation', async () => {
  const real = await vi.importActual<typeof import('../lib/moderation')>('../lib/moderation');
  return {
    ...real,
    moderationAccess: () => Promise.resolve(access),
    loadQueue: () => Promise.resolve({ reports: real.ordered(rows), moreWaiting: false, closedCapped: false }),
    moveReport: (id: string, to: string) => {
      moved.push([id, to]);
      return Promise.resolve();
    },
  };
});

const { ReportQueue } = await import('./ReportQueue');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const me = { id: 'u1', email: 'mod@example.edu', via: 'email' } as never;

beforeEach(() => {
  access = { canRead: false, canAct: false };
  rows = [];
  moved.length = 0;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const draw = async () => {
  await act(async () => {
    root.render(<ReportQueue account={me} />);
  });
};

const report = (id: string, status: QueuedReport['status']): QueuedReport => ({
  id, status, reason: `reason ${id}`, copy: `copy ${id}`, createdAt: '2026-09-27T10:00:00Z', messageGone: false,
});

it('draws nothing at all for an account without report:read', async () => {
  rows = [report('a', 'open')];
  await draw();
  expect(host.innerHTML).toBe('');
});

it('tells a moderator with an empty queue that nothing is waiting — the control for the case above', async () => {
  access = { canRead: true, canAct: true };
  await draw();
  expect(host.textContent).toContain('Nothing waiting.');
});

it('shows the reason and the message, and says it does not show who reported', async () => {
  access = { canRead: true, canAct: true };
  rows = [report('a', 'open')];
  await draw();
  expect(host.textContent).toContain('reason a');
  expect(host.textContent).toContain('copy a');
  expect(host.textContent).toContain('Who reported it and who it is about are not shown here.');
});

it('moves a report and re-files it under its new status', async () => {
  access = { canRead: true, canAct: true };
  rows = [report('a', 'open')];
  await draw();
  const take = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Take under review')!;
  await act(async () => take.click());
  expect(moved).toEqual([['a', 'under_review']]);
  expect(host.textContent).toContain('Under review');
  expect([...host.querySelectorAll('button')].some((b) => b.textContent === 'Resolve')).toBe(true);
});

it('offers no moves to a reader who may not act', async () => {
  access = { canRead: true, canAct: false };
  rows = [report('a', 'open')];
  await draw();
  expect([...host.querySelectorAll('button')].some((b) => b.textContent === 'Dismiss')).toBe(false);
  expect(host.textContent).toContain('You can read this queue but not move reports.');
});
