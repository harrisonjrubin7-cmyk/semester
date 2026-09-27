// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  on: true,
  standing: vi.fn(),
  roster: vi.fn(),
  events: vi.fn(),
  items: vi.fn(),
  manage: vi.fn(),
  add: vi.fn(),
  retire: vi.fn(),
}));

vi.mock('../state/store', () => ({
  useStore: () => ({ account: { id: 'me', email: 'me@semester.example', via: 'email' }, state: { tone: 'plain' }, dispatch: vi.fn() }),
  useNow: () => new Date(),
}));
vi.mock('../lib/cloud', () => ({ cloudConfigured: true, cloud: vi.fn() }));
vi.mock('../community/flags', () => ({ COMMUNITY_FLAGS: {}, enabled: () => mock.on }));
vi.mock('../community/client', () => ({
  reviewerStanding: mock.standing,
  loadRoster: mock.roster,
  loadVolunteerEvents: mock.events,
  loadCalibrationItems: mock.items,
  manageVolunteer: mock.manage,
  addCalibrationItem: mock.add,
  retireCalibrationItem: mock.retire,
  accountHash: async (id: string) => `hash-${id}`,
}));

import { Volunteers, calibrationShortfall, volunteerStage } from './Volunteers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

const person = (patch: Record<string, unknown> = {}) => ({
  userId: 'u1',
  handle: 'maya',
  tenantId: 'vu',
  status: 'active',
  appliedAt: '2026-09-01T10:00:00Z',
  trainedAt: '2026-09-02T10:00:00Z',
  confidentialityAt: '2026-09-02T11:00:00Z',
  recusalAt: '2026-09-02T11:00:00Z',
  calibrationStartedAt: '2026-09-01T10:00:00Z',
  revokedAt: null,
  revokedReason: '',
  onboardingAnswered: 20,
  onboardingRight: 19,
  quality: 90,
  reviewsToday: 6,
  lastAnsweredAt: '2026-09-27T09:00:00Z',
  ...patch,
});

const item = (n: number, kind = 'onboarding', patch: Record<string, unknown> = {}) => ({
  id: `i${kind}${n}`,
  tenantId: 'vu',
  kind,
  category: 'spam_scam_or_phishing',
  severity: 'P2',
  communityKind: 'course',
  body: `Practice ${kind} ${n}`,
  expectedAction: 'remove',
  retiredAt: null,
  ...patch,
});
const enough = () => [...Array.from({ length: 20 }, (_, n) => item(n)), ...Array.from({ length: 20 }, (_, n) => item(n, 'control'))];

beforeEach(() => {
  vi.clearAllMocks();
  mock.on = true;
  mock.standing.mockResolvedValue('senior');
  mock.roster.mockResolvedValue([
    person(),
    person({ userId: 'u2', handle: 'newbie', status: 'onboarding', trainedAt: null, confidentialityAt: null, recusalAt: null, onboardingAnswered: 0, onboardingRight: 0, quality: null }),
  ]);
  mock.events.mockResolvedValue([
    { volunteer: 'hash-u1', event: 'attested:recusal', fromStatus: null, toStatus: null, reason: '', occurredAt: '2026-09-02T11:00:00Z' },
    { volunteer: 'hash-u2', event: 'applied', fromStatus: null, toStatus: 'onboarding', reason: '', occurredAt: '2026-09-20T11:00:00Z' },
  ]);
  mock.items.mockResolvedValue(enough());
  mock.manage.mockResolvedValue(undefined);
  mock.add.mockResolvedValue(undefined);
  mock.retire.mockResolvedValue(undefined);
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
    root.render(<Volunteers />);
  });
}

const button = (scope: Element, text: string) =>
  [...scope.querySelectorAll('button')].find((b) => b.textContent === text) as HTMLButtonElement | undefined;
function type(el: Element, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
const card = (handle: string) => host.querySelector(`[aria-label="Volunteer ${handle}"]`) as HTMLElement;

describe('Volunteers', () => {
  it('is off while volunteer moderation is not built', async () => {
    mock.on = false;
    await render();
    expect(host.textContent).toContain('isn’t switched on in this build');
    expect(mock.standing).not.toHaveBeenCalled();
  });

  it('is only for a senior reviewer', async () => {
    mock.standing.mockResolvedValue('reviewer');
    await render();
    expect(host.textContent).toContain('Only a senior reviewer manages volunteers.');
    expect(mock.roster).not.toHaveBeenCalled();
  });

  it('puts whoever needs training first, and says where each volunteer is', async () => {
    await render();
    const cards = [...host.querySelectorAll('article')].map((a) => a.getAttribute('aria-label'));
    expect(cards).toEqual(['Volunteer newbie', 'Volunteer maya']);
    expect(card('newbie').textContent).toContain('Waiting for training to be recorded');
    expect(card('maya').textContent).toContain('90 out of 100');
  });

  it('records training with a reason', async () => {
    await render();
    const record = button(card('newbie'), 'Record training') as HTMLButtonElement;
    expect(record.disabled).toBe(true);
    type(card('newbie').querySelector('textarea') as HTMLTextAreaElement, 'finished the September session');
    await act(async () => record.click());
    expect(mock.manage).toHaveBeenCalledWith('u2', 'record_training', 'finished the September session');
    expect(button(card('maya'), 'Record training'), 'training is recorded once').toBeUndefined();
  });

  it('offers sending back to calibration only to someone past it, and says it starts again', async () => {
    await render();
    expect(button(card('newbie'), 'Send back to calibration')).toBeUndefined();
    expect(card('maya').textContent).toContain('earlier answers don’t count');
    type(card('maya').querySelector('textarea') as HTMLTextAreaElement, 'missed three controls on scams');
    await act(async () => button(card('maya'), 'Send back to calibration')!.click());
    expect(mock.manage).toHaveBeenCalledWith('u1', 'recalibrate', 'missed three controls on scams');
  });

  it('revokes with a reason, and a revoked volunteer has no actions left', async () => {
    await render();
    type(card('maya').querySelector('textarea') as HTMLTextAreaElement, 'shared a case outside the queue');
    await act(async () => button(card('maya'), 'Revoke')!.click());
    expect(mock.manage).toHaveBeenCalledWith('u1', 'revoke', 'shared a case outside the queue');
    act(() => root.unmount());
    root = createRoot(host);
    mock.roster.mockResolvedValue([person({ status: 'revoked', revokedReason: 'shared a case outside the queue' })]);
    await render();
    expect(card('maya').textContent).toContain('Revoked: “shared a case outside the queue”');
    expect(card('maya').querySelectorAll('button').length).toBe(0);
  });

  it('shows each volunteer their own history, in words', async () => {
    await render();
    expect(card('maya').textContent).toContain('Acknowledged the recusal rules');
    expect(card('maya').textContent).not.toContain('Applied');
    expect(card('newbie').textContent).toContain('Applied');
  });

  it('warns when a school has too few practice cases for anybody to finish', async () => {
    mock.items.mockResolvedValue([item(1), item(2)]);
    await render();
    expect(host.textContent).toContain('2 onboarding items — nobody can finish calibrating until there are 20.');
    expect(host.textContent).toContain('No control items');
  });

  it('adds a practice case for the school on screen, and retires one', async () => {
    await render();
    await act(async () => button(host, 'Add a practice case')!.click());
    const form = host.querySelector('form[aria-label="Add a practice case"]') as HTMLFormElement;
    expect(form.textContent).toContain('Never paste a real student’s post.');
    const add = button(form, 'Add it') as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    type(form.querySelector('textarea') as HTMLTextAreaElement, 'Free tickets, just log in here: bit.ly/xyz');
    await act(async () => add.click());
    expect(mock.add).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'vu', kind: 'onboarding', expectedAction: 'remove' }));
    expect(host.querySelector('[aria-label="Practice cases"] summary')?.textContent).toBe('20 onboarding and 20 control items in use');
    const retire = host.querySelector('[aria-label="Practice cases"] li.portal-panel button') as HTMLButtonElement;
    await act(async () => retire.click());
    expect(mock.retire).toHaveBeenCalled();
  });
});

describe('the rules the screen reads', () => {
  it('orders by what needs doing', () => {
    expect(volunteerStage(person({ trainedAt: null, status: 'onboarding' }) as never).order).toBe(0);
    expect(volunteerStage(person({ status: 'paused' }) as never).text).toMatch(/Paused/);
    expect(volunteerStage(person({ status: 'revoked' }) as never).order).toBe(6);
  });

  it('counts only live items toward calibration', () => {
    const retired = enough().map((i, n) => (n < 5 ? { ...i, retiredAt: '2026-09-01T00:00:00Z' } : i));
    expect(calibrationShortfall(enough() as never)).toEqual([]);
    expect(calibrationShortfall(retired as never)[0]).toMatch(/^15 onboarding items/);
  });
});
