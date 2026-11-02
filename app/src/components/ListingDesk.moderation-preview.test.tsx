// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  load: vi.fn(),
  moderate: vi.fn(),
}));

vi.mock('../lib/capabilities', () => ({
  useMyCapabilities: () => [{ capability: 'opportunity:moderate', scopeKind: 'tenant', scopeId: 'vu' }],
}));
vi.mock('../lib/listings', async (original) => ({
  ...(await original<object>()),
  loadReviewQueue: mock.load,
  moderateListing: mock.moderate,
}));

import { ListingDesk } from './ListingDesk';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const rows = [
  {
    id: 'listing-1', kind: 'internship', title: 'Research assistant', body: 'Ten hours each week.',
    deadline: '2026-11-15T23:59:59.000Z', status: 'pending_review', url: 'https://example.edu/one',
    publisher_scope_id: 'Career center', eligibility: { text: 'Open to juniors.' },
  },
  {
    id: 'listing-2', kind: 'job', title: 'Research assistant', body: 'Five hours each week.',
    deadline: null, status: 'pending_review', url: null,
    publisher_scope_id: 'Student success', eligibility: {},
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  mock.load.mockResolvedValue({ rows, more: false });
  mock.moderate.mockResolvedValue(undefined);
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function flush() {
  for (let i = 0; i < 4; i++) await act(async () => {});
}

async function renderDesk() {
  await act(async () => root.render(<ListingDesk school="vu" />));
  await flush();
}

const button = (name: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);

describe('verified-listing moderation consequences', () => {
  it('distinguishes repeated listing actions and cancel keeps the queue unchanged', async () => {
    await renderDesk();
    const first = button('Remove listing 1 of 2, Research assistant: internship from Career center');
    const second = button('Remove listing 2 of 2, Research assistant: job from Student success');
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();

    await act(async () => first?.click());
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('removes the internship listing from the review queue');
    expect(mock.moderate).not.toHaveBeenCalled();
    expect(document.activeElement?.textContent).toBe('Cancel');

    await act(async () => {
      [...host.querySelectorAll('button')].find((one) => one.textContent === 'Cancel')?.click();
    });
    expect(mock.moderate).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Ten hours each week.');
  });

  it('publishes only after confirmation and guards every moderation control while awaiting the server', async () => {
    let finish: (() => void) | undefined;
    mock.moderate.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    await renderDesk();

    await act(async () => button('Publish listing 1 of 2, Research assistant: internship from Career center')?.click());
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('publishes the internship listing from Career center');
    expect(mock.moderate).not.toHaveBeenCalled();

    await act(async () => {
      [...host.querySelectorAll('button')].find((one) => one.textContent === 'Publish listing')?.click();
    });
    expect(mock.moderate).toHaveBeenCalledTimes(1);
    expect(mock.moderate).toHaveBeenCalledWith('listing-1', 'published');
    expect([...host.querySelectorAll<HTMLButtonElement>('.jx-actions button')].every((one) => one.disabled)).toBe(true);

    await act(async () => finish?.());
    await flush();
    expect(host.textContent).toContain('Listing published.');
  });

  it('keeps the represented listing available for retry after a server refusal', async () => {
    mock.moderate.mockRejectedValueOnce(new Error('Only a listings moderator can do that.'));
    await renderDesk();

    await act(async () => button('Remove listing 2 of 2, Research assistant: job from Student success')?.click());
    await act(async () => {
      [...host.querySelectorAll('button')].find((one) => one.textContent === 'Remove listing')?.click();
    });
    await flush();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Only a listings moderator');
    expect(button('Remove listing 2 of 2, Research assistant: job from Student success')?.disabled).toBe(false);
    expect(host.textContent).toContain('Five hours each week.');
  });
});
