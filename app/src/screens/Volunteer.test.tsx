// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  on: true,
  programs: vi.fn(),
  load: vi.fn(),
  apply: vi.fn(),
  attest: vi.fn(),
  next: vi.fn(),
  decide: vi.fn(),
}));

vi.mock('../state/store', () => ({
  useStore: () => ({ account: { id: 'v', email: 'v@example.edu', via: 'email' }, state: { tone: 'plain' }, dispatch: vi.fn() }),
  useNow: () => new Date('2026-09-27T12:00:00Z'),
}));
vi.mock('../lib/cloud', () => ({ cloudConfigured: true, cloud: vi.fn() }));
vi.mock('../community/flags', () => ({ COMMUNITY_FLAGS: {}, enabled: () => mock.on }));
vi.mock('../community/client', () => ({
  loadPrograms: mock.programs,
  loadVolunteer: mock.load,
  applyToVolunteer: mock.apply,
  attest: mock.attest,
  nextTasks: mock.next,
  decideTask: mock.decide,
}));

import { Volunteer } from './Volunteer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

const ready = { status: 'active', trained: true, confidentialitySigned: true, recusalAcknowledged: true };
const standing = { onboardingAnswered: 20, quality: 90, reviewsLastHour: 3, reviewsToday: 12 };

beforeEach(() => {
  vi.clearAllMocks();
  mock.on = true;
  mock.programs.mockResolvedValue({ scopedPseudonymity: false, volunteerModeration: true });
  mock.load.mockResolvedValue({ record: ready, standing });
  mock.apply.mockResolvedValue(undefined);
  mock.attest.mockResolvedValue(undefined);
  mock.next.mockResolvedValue([
    { taskId: 't1', category: 'spam_scam_or_phishing', severity: 'P2', communityKind: 'course', body: 'Cheap tickets here' },
  ]);
  mock.decide.mockResolvedValue(undefined);
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
    root.render(<Volunteer />);
  });
}

async function click(text: string) {
  const el = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  if (!el) throw new Error(`No button "${text}" in: ${host.textContent}`);
  await act(async () => el.click());
}

describe('Volunteer', () => {
  it('is off while its build flag is off', async () => {
    mock.on = false;
    await render();
    expect(host.textContent).toContain('isn’t switched on in this build');
    expect(mock.programs).not.toHaveBeenCalled();
  });

  it('is off while the school has not switched it on', async () => {
    mock.programs.mockResolvedValue({ scopedPseudonymity: false, volunteerModeration: false });
    await render();
    expect(host.textContent).toContain('hasn’t switched volunteer moderation on');
    expect(mock.load).not.toHaveBeenCalled();
  });

  it('explains the programme and its rules before anybody applies', async () => {
    mock.load.mockResolvedValue({ record: null, standing: null });
    await render();
    expect(host.textContent).toContain('never shown to a volunteer');
    expect(host.textContent).toContain('support community');
    expect(host.textContent).toContain('30 days old');
    expect(host.textContent).toContain('passing at 85%');
    await click('Apply to volunteer');
    expect(mock.apply).toHaveBeenCalled();
  });

  it('keeps the queue shut until training and both agreements are done', async () => {
    mock.load.mockResolvedValue({
      record: { status: 'onboarding', trained: false, confidentialitySigned: false, recusalAcknowledged: false },
      standing: { onboardingAnswered: 0, quality: null, reviewsLastHour: 0, reviewsToday: 0 },
    });
    await render();
    expect(host.textContent).toContain('Your queue opens once training and both agreements are done');
    expect([...host.querySelectorAll('button')].some((b) => b.textContent === 'Get cases to review')).toBe(false);
    await click('I agree');
    expect(mock.attest).toHaveBeenCalledWith('confidentiality');
    await click('I understand');
    expect(mock.attest).toHaveBeenCalledWith('recusal');
  });

  it('shows standing in words and numbers, never a karma score', async () => {
    await render();
    expect(host.textContent).toContain('90 out of 100');
    expect(host.textContent).toContain('3 of 20 reviews this hour');
    expect(host.textContent).not.toMatch(/karma|points/i);
  });

  it('stops at the cap', async () => {
    mock.load.mockResolvedValue({ record: ready, standing: { ...standing, reviewsLastHour: 20 } });
    await render();
    expect(host.textContent).toContain('reached the review limit');
  });

  it('shows a task blind — category, severity, community type and text only', async () => {
    await render();
    await click('Get cases to review');
    const card = host.querySelector('[aria-label="A post to review"]') as HTMLElement;
    expect(card.textContent).toContain('Spam, a scam or a phishing link');
    expect(card.textContent).toContain('in a course community');
    expect(card.textContent).toContain('Cheap tickets here');
    expect(host.textContent).toContain('practice cases with known answers');
    expect(host.textContent).toContain('not monitored as an emergency-response service');
  });

  it('asks for a reason before any decision can be made', async () => {
    await render();
    await click('Get cases to review');
    const buttons = [...host.querySelectorAll('[aria-label="A post to review"] button')] as HTMLButtonElement[];
    expect(buttons.every((b) => b.disabled)).toBe(true);
    expect(host.textContent).toContain('standard · in a course community');
  });

  it('records a decision with its reason and drops the task', async () => {
    await render();
    await click('Get cases to review');
    const select = host.querySelector('[aria-label="A post to review"] select') as HTMLSelectElement;
    await act(async () => {
      select.value = 'spam.link';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await click('Remove it');
    expect(mock.decide).toHaveBeenCalledWith('t1', 'remove', 'spam.link');
    expect(host.querySelector('[aria-label="A post to review"]')).toBeNull();
  });

  it('says plainly when access is paused or has ended', async () => {
    mock.load.mockResolvedValue({ record: { ...ready, status: 'paused' }, standing });
    await render();
    expect(host.textContent).toContain('Paused');
    expect([...host.querySelectorAll('button')].length).toBe(0);
  });
});
