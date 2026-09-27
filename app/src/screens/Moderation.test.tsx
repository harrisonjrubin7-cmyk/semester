// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  on: true,
  standing: vi.fn(),
  queue: vi.fn(),
  decideCase: vi.fn(),
  decideAppeal: vi.fn(),
}));

vi.mock('../state/store', () => ({
  useStore: () => ({ account: { id: 'rev', email: 'rev@semester.example', via: 'email' }, state: { tone: 'plain' }, dispatch: vi.fn() }),
  useNow: () => new Date('2026-09-27T12:00:00Z'),
}));
vi.mock('../lib/cloud', () => ({ cloudConfigured: true, cloud: vi.fn() }));
vi.mock('../community/flags', () => ({ COMMUNITY_FLAGS: {}, enabled: () => mock.on }));
vi.mock('../community/client', () => ({
  reviewerStanding: mock.standing,
  loadQueue: mock.queue,
  decideCase: mock.decideCase,
  decideAppeal: mock.decideAppeal,
}));

import { Moderation } from './Moderation';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

const kase = (id: string, patch: Record<string, unknown> = {}) => ({
  id,
  postId: `post-${id}`,
  category: 'private_information_or_doxxing',
  severity: 'P0',
  protection: 'temporary_hold',
  route: 'professional_urgent',
  status: 'open',
  createdAt: '2026-09-27T10:00:00Z',
  post: { body: `Body ${id}`, authorName: 'Jordan', status: 'held', communityName: 'ECON 1010' },
  reports: [{ category: 'private_information_or_doxxing', imminent: true, details: 'posted her room', createdAt: '2026-09-27T10:00:00Z' }],
  ...patch,
});

beforeEach(() => {
  vi.clearAllMocks();
  mock.on = true;
  mock.standing.mockResolvedValue('reviewer');
  mock.queue.mockResolvedValue([kase('k0'), kase('k1', { status: 'appealed', severity: 'P2', category: 'spam_scam_or_phishing' })]);
  mock.decideCase.mockResolvedValue(undefined);
  mock.decideAppeal.mockResolvedValue(undefined);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function render() {
  await act(async () => {
    root.render(<Moderation />);
  });
}

function reason(el: Element, value: string) {
  const input = el.querySelector('input') as HTMLInputElement;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('Moderation', () => {
  it('is off while its flag is off', async () => {
    mock.on = false;
    await render();
    expect(host.textContent).toContain('isn’t switched on');
    expect(mock.standing).not.toHaveBeenCalled();
  });

  it('shows no queue to an account without a reviewer role', async () => {
    mock.standing.mockResolvedValue('none');
    await render();
    expect(host.textContent).toContain('doesn’t hold a Trust & Safety reviewer role');
    expect(mock.queue).not.toHaveBeenCalled();
  });

  it('shows the post, the reports and what triage did — never who reported', async () => {
    await render();
    const card = host.querySelector('article') as HTMLElement;
    expect(card.textContent).toContain('P0 · urgent');
    expect(card.textContent).toContain('Hidden pending review');
    expect(card.textContent).toContain('Body k0');
    expect(card.textContent).toContain('posted her room');
    expect(card.textContent).not.toMatch(/reported by|reporter:/i);
    expect(host.textContent).toContain('not monitored as an emergency-response service');
  });

  it('does not offer a P0 account-wide pause to a non-senior reviewer', async () => {
    await render();
    const options = [...(host.querySelector('article select') as HTMLSelectElement).options].map((o) => o.value);
    expect(options).not.toContain('account_restriction');
    expect(options).toContain('remove');
  });

  it('offers it to a senior reviewer', async () => {
    mock.standing.mockResolvedValue('senior');
    await render();
    const options = [...(host.querySelector('article select') as HTMLSelectElement).options].map((o) => o.value);
    expect(options).toContain('account_restriction');
  });

  it('needs a reason code before a decision can be recorded', async () => {
    await render();
    const card = host.querySelector('article') as HTMLElement;
    const record = [...card.querySelectorAll('button')].find((b) => b.textContent === 'Record decision') as HTMLButtonElement;
    expect(record.disabled).toBe(true);
    reason(card, 'privacy.dox');
    const select = card.querySelector('select') as HTMLSelectElement;
    act(() => {
      select.value = 'remove';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => record.click());
    expect(mock.decideCase).toHaveBeenCalledWith('k0', 'remove', 'privacy.dox');
  });

  it('decides appeals separately, and says the deciding reviewer is refused', async () => {
    await render();
    const appealCard = [...host.querySelectorAll('article')][1] as HTMLElement;
    expect(appealCard.textContent).toContain('an appeal goes to somebody else');
    reason(appealCard, 'context');
    const grant = [...appealCard.querySelectorAll('button')].find((b) => b.textContent === 'Grant appeal and restore') as HTMLButtonElement;
    await act(async () => grant.click());
    expect(mock.decideAppeal).toHaveBeenCalledWith('k1', false, 'context');
  });
});
