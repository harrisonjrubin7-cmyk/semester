// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  readCalendar: vi.fn(),
  readHistory: vi.fn(),
}));
vi.mock('../lib/guardianprojection', async (original) => ({
  ...await original<typeof import('../lib/guardianprojection')>(),
  readGuardianCalendarProjection: mock.readCalendar,
  readGuardianProjectionAccessHistory: mock.readHistory,
}));
const { GuardianCalendarProjection, GuardianProjectionAccessHistory } = await import('./GuardianProjection');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  mock.readCalendar.mockReset();
  mock.readHistory.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  host.remove();
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((node) => name.test(node.textContent ?? ''));
const item = (over: Record<string, unknown> = {}) => ({
  student_id: 'student-1', item_id: 'event-1', title: 'Family conference',
  starts_at: '2026-10-12T15:00:00Z', status: 'scheduled',
  source_observed_at: '2026-10-10T10:00:00Z', expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
  ...over,
});

describe('guardian calendar projection', () => {
  const render = (actorId: string | null = 'guardian-1', studentId = 'student-1') =>
    act(async () => root.render(
      <GuardianCalendarProjection actorId={actorId} studentId={studentId} shownAs="Sam" revalidateMs={60_000} />,
    ));

  it('loads only on request, announces loading, and renders the minimized online-only calendar', async () => {
    const pending = deferred<{ kind: 'ready'; items: ReturnType<typeof item>[] }>();
    mock.readCalendar.mockReturnValue(pending.promise);
    await render();
    expect(mock.readCalendar).not.toHaveBeenCalled();
    await act(async () => button(/Open calendar/)!.click());
    expect(host.querySelector('[role="status"]')?.textContent).toMatch(/Checking current access/);
    await act(async () => pending.resolve({ kind: 'ready', items: [item()] }));
    expect(host.textContent).toContain('Family conference');
    expect(host.textContent).toContain('Scheduled');
    const reference = [...host.querySelectorAll('dl div')]
      .find((node) => node.querySelector('dt')?.textContent === 'Event reference');
    expect(reference?.querySelector('dd')?.textContent).toBe('event-1');
    expect(host.textContent).toContain('online only');
    expect(host.textContent).not.toContain('secret');
  });

  it('clears protected rows when a revalidation is denied and lets the person retry explicitly', async () => {
    mock.readCalendar
      .mockResolvedValueOnce({ kind: 'ready', items: [item()] })
      .mockResolvedValueOnce({ kind: 'denied', items: [] });
    await render();
    await act(async () => button(/Open calendar/)!.click());
    expect(host.textContent).toContain('Family conference');
    await act(async () => button(/Refresh access/)!.click());
    expect(host.textContent).not.toContain('Family conference');
    expect(host.textContent).toContain('Calendar access is unavailable');
    expect(button(/Check again/)).toBeTruthy();
  });

  it('never restores a late response from an old actor or subject', async () => {
    const old = deferred<{ kind: 'ready'; items: ReturnType<typeof item>[] }>();
    mock.readCalendar.mockReturnValueOnce(old.promise);
    await render('guardian-1', 'student-1');
    await act(async () => button(/Open calendar/)!.click());
    await render('guardian-2', 'student-2');
    expect(host.textContent).not.toContain('Family conference');
    await act(async () => old.resolve({ kind: 'ready', items: [item()] }));
    expect(host.textContent).not.toContain('Family conference');
    expect(mock.readCalendar).toHaveBeenCalledTimes(1);
  });

  it('clears on sign-out and ignores the request that finishes afterwards', async () => {
    const old = deferred<{ kind: 'ready'; items: ReturnType<typeof item>[] }>();
    mock.readCalendar.mockReturnValue(old.promise);
    await render();
    await act(async () => button(/Open calendar/)!.click());
    await render(null);
    await act(async () => old.resolve({ kind: 'ready', items: [item()] }));
    expect(host.textContent).toBe('');
  });

  it('clears protected rows at their expiry before the next automatic refresh', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
    mock.readCalendar.mockResolvedValue({
      kind: 'ready',
      items: [item({ expires_at: '2026-10-10T12:00:30Z' })],
    });
    await render();
    await act(async () => button(/Open calendar/)!.click());
    expect(host.textContent).toContain('Family conference');

    await act(async () => vi.advanceTimersByTimeAsync(30_000));

    expect(host.textContent).not.toContain('Family conference');
    expect(host.textContent).toContain('expired and was cleared');
    expect(mock.readCalendar).toHaveBeenCalledTimes(1);
  });

  it('automatic revalidation is one audited call at a time and denial clears the prior view', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
    mock.readCalendar
      .mockResolvedValueOnce({ kind: 'ready', items: [item({ expires_at: '2026-10-10T12:02:00Z' })] })
      .mockResolvedValueOnce({ kind: 'denied', items: [] });
    await render();
    await act(async () => button(/Open calendar/)!.click());
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(mock.readCalendar).toHaveBeenCalledTimes(2);
    expect(host.textContent).not.toContain('Family conference');
    expect(host.textContent).toContain('Calendar access is unavailable');
  });

  it('shows a focused retry state without retrying a failed audited read', async () => {
    mock.readCalendar.mockRejectedValue(new Error('network down'));
    await render();
    await act(async () => button(/Open calendar/)!.click());
    const alert = host.querySelector<HTMLElement>('[role="alert"]');
    expect(alert?.textContent).toContain('could not be checked');
    expect(alert).toBe(document.activeElement);
    expect(mock.readCalendar).toHaveBeenCalledTimes(1);
  });
});

describe('student projection access history', () => {
  const event = { guardian_id: 'guardian-1', purpose: 'guardian_portal', decision: 'allow' as const,
    reason: 'allowed' as const, fields_returned: ['title'], projection_count: 1, read_at: '2026-10-10T11:00:00Z' };
  const render = (actorId: string | null = 'student-1') =>
    act(async () => root.render(<GuardianProjectionAccessHistory actorId={actorId} />));

  it('loads bounded content-free records and has empty and refresh states', async () => {
    mock.readHistory.mockResolvedValueOnce([event]).mockResolvedValueOnce([]);
    await render();
    await act(async () => button(/Load access history/)!.click());
    expect(host.textContent).toContain('guardian-1');
    expect(host.textContent).toContain('1 calendar notice');
    expect(host.textContent).not.toContain('Family conference');
    await act(async () => button(/Refresh history/)!.click());
    expect(host.textContent).toContain('No guardian calendar access has been recorded');
  });

  it('clears on account switch and ignores the old account response', async () => {
    const old = deferred<typeof event[]>();
    mock.readHistory.mockReturnValue(old.promise);
    await render('student-1');
    await act(async () => button(/Load access history/)!.click());
    await render('student-2');
    await act(async () => old.resolve([event]));
    expect(host.textContent).not.toContain('guardian-1');
  });
});
