// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DueRow, LoadedDueDates } from '../../lib/gradebook/duedates';

/**
 * Due dates on screen, both sides. A student: the item's date, or their
 * approved extension said in words with the original date under it; no date
 * set, no items, a school without the feature and a failed load each say so.
 * An instructor: each item's date and which students hold an extension; the
 * holder of grades:release sets and clears a date naming the version read; a
 * change that lost a race offers a reload, not a retry; a teaching assistant
 * reads without the controls. The server's rules are proved by
 * gradebook-due-dates.check.sql.
 */

const mock = vi.hoisted(() => ({ rpc: vi.fn(), say: vi.fn(), load: vi.fn() }));
vi.mock('../../lib/cloud', () => ({ cloudConfigured: true, cloud: () => Promise.resolve({ rpc: mock.rpc, from: vi.fn() }) }));
vi.mock('../../state/store', () => ({ useStore: () => ({ say: mock.say }) }));
vi.mock('../../lib/gradebook/duedates', async (orig) => ({ ...(await orig<object>()), loadDueDates: mock.load }));
const { DueDates } = await import('./DueDates');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  mock.rpc.mockReset();
  mock.say.mockReset();
  mock.load.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const row = (patch: Partial<DueRow> = {}): DueRow => ({
  itemId: 'essay',
  title: 'Essay 2',
  studentId: null,
  itemDue: '2026-11-07T05:59:00Z',
  version: 1,
  grantedDue: null,
  requestId: null,
  effectiveDue: '2026-11-07T05:59:00Z',
  extended: false,
  ...patch,
});
const MAYA = 'maya-0000-1111';
const loaded = (rows: DueRow[]): LoadedDueDates => ({ available: true, rows });
const extended = row({ studentId: MAYA, grantedDue: '2026-11-12', requestId: 'r1', effectiveDue: '2026-11-13T11:59:59Z', extended: true });
const quiz = row({ itemId: 'quiz', title: 'Quiz 1', itemDue: null, version: 0, effectiveDue: null });

const button = (name: RegExp) => [...document.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const type = (el: HTMLInputElement, text: string) => {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const STALE = { data: null, error: { message: 'semester: this item’s due date changed since you read it (it is at version 2 now). Reload it and look again', code: '40001' } };

describe('the student’s side', () => {
  it('shows the extended date in words, with the original date under it, and the item’s date otherwise', async () => {
    mock.load.mockResolvedValue(loaded([row(), extended, quiz]));
    act(() => root.render(<DueDates course="HIST 2100" term="2026FA" side="mine" canSet={false} me={MAYA} />));
    expect(host.textContent).toContain('Loading the due dates for HIST 2100');
    await flush();
    const cells = [...host.querySelectorAll('tbody tr')].map((tr) => tr.textContent ?? '');
    expect(cells[0]).toMatch(/Essay 2.*Extended to .*Nov.*12.*Originally due/);
    expect(cells[1]).toContain('Quiz 1');
    expect(cells[1]).toContain('No due date set');
    expect(button(/due date/)).toBeUndefined();
  });

  it('another student, without the extension, reads the item’s own date', async () => {
    mock.load.mockResolvedValue(loaded([row(), quiz]));
    act(() => root.render(<DueDates course="HIST 2100" term="2026FA" side="mine" canSet={false} me="ben-0000" />));
    await flush();
    expect(host.textContent).not.toContain('Extended');
    expect(host.querySelector('tbody tr')!.textContent).toMatch(/Essay 2.*Nov/);
  });

  it('says when no item has a date yet', async () => {
    mock.load.mockResolvedValue(loaded([quiz]));
    act(() => root.render(<DueDates course="HIST 2100" term="2026FA" side="mine" canSet={false} me={MAYA} />));
    await flush();
    expect(host.textContent).toContain('No due dates set');
    expect(host.querySelector('table')).toBeNull();
  });

  it('says when the course has no items', async () => {
    mock.load.mockResolvedValue(loaded([]));
    act(() => root.render(<DueDates course="HIST 2100" term="2026FA" side="mine" canSet={false} me={MAYA} />));
    await flush();
    expect(host.textContent).toContain('No graded items yet');
  });

  it('says when the school has not set due dates up, and offers nothing to press', async () => {
    mock.load.mockResolvedValue({ available: false, rows: [] });
    act(() => root.render(<DueDates course="HIST 2100" term="2026FA" side="mine" canSet={false} me={MAYA} />));
    await flush();
    expect(host.textContent).toContain('not set up at your school yet');
    expect(host.querySelectorAll('button')).toHaveLength(0);
  });

  it('a failed load says so and loads again', async () => {
    mock.load.mockRejectedValueOnce(new Error('Could not load the due dates.')).mockResolvedValue(loaded([row()]));
    act(() => root.render(<DueDates course="HIST 2100" term="2026FA" side="mine" canSet={false} me={MAYA} />));
    await flush();
    expect(host.querySelector('[role="alert"]')!.textContent).toContain('The due dates did not load');
    act(() => button(/Load again/)!.click());
    await flush();
    expect(host.querySelector('table')).not.toBeNull();
  });
});

describe('the instructor’s side', () => {
  it('lists each item’s date and which students hold an extension', async () => {
    mock.load.mockResolvedValue(loaded([row(), extended, quiz]));
    act(() => root.render(<DueDates course="HIST 2100" term="2026FA" side="teaching" canSet me="prof" />));
    await flush();
    const rows = [...host.querySelectorAll('tbody tr')].map((tr) => tr.textContent ?? '');
    expect(rows[0]).toMatch(/Student maya-000….*extended to .*Nov.*12/);
    expect(rows[1]).toContain('No due date set');
    expect(rows[1]).toContain('None');
    // Setting a date is not the screen's primary action: releasing grades is.
    expect([...host.querySelectorAll('.btn-primary')]).toHaveLength(0);
  });

  it('sets a due date naming the version read, then reloads', async () => {
    mock.load.mockResolvedValue(loaded([row(), quiz]));
    mock.rpc.mockResolvedValue({ data: { item: 'quiz', due: '2026-11-20T17:00:00Z', version: 1 }, error: null });
    act(() => root.render(<DueDates course="HIST 2100" term="2026FA" side="teaching" canSet me="prof" />));
    await flush();
    act(() => button(/Set the due date for Quiz 1/)!.click());
    expect(document.activeElement?.textContent).toBe('When Quiz 1 is due');
    expect(button(/Save the due date/)!.disabled).toBe(true);
    expect(button(/Clear the due date/)).toBeUndefined();
    type(host.querySelector('input[type="date"]')!, '2026-11-20');
    expect(button(/Save the due date/)!.disabled).toBe(false);
    act(() => button(/Save the due date/)!.click());
    await flush();
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.rpc.mock.calls[0][0]).toBe('gradebook_set_due');
    expect(mock.rpc.mock.calls[0][1]).toMatchObject({ want_item: 'quiz', want_expect: 0, want_due: new Date('2026-11-20T23:59:00').toISOString() });
    expect(host.textContent).toContain('Quiz 1 is now due');
    expect(mock.load).toHaveBeenCalledTimes(2);
  });

  it('clears a date', async () => {
    mock.load.mockResolvedValue(loaded([row()]));
    mock.rpc.mockResolvedValue({ data: { item: 'essay', due: null, version: 2 }, error: null });
    act(() => root.render(<DueDates course="HIST 2100" term="2026FA" side="teaching" canSet me="prof" />));
    await flush();
    act(() => button(/Change the due date for Essay 2/)!.click());
    act(() => button(/Clear the due date/)!.click());
    await flush();
    expect(mock.rpc.mock.calls[0][1]).toMatchObject({ want_item: 'essay', want_due: null, want_expect: 1 });
    expect(host.textContent).toContain('Essay 2 has no due date now');
  });

  it('a change that lost a race says so and offers a reload, not a retry', async () => {
    mock.load.mockResolvedValue(loaded([row()]));
    mock.rpc.mockResolvedValue(STALE);
    act(() => root.render(<DueDates course="HIST 2100" term="2026FA" side="teaching" canSet me="prof" />));
    await flush();
    act(() => button(/Change the due date for Essay 2/)!.click());
    act(() => button(/Clear the due date/)!.click());
    await flush();
    expect(host.textContent).toContain('due date changed since you read it');
    expect(button(/^Try again$/)).toBeUndefined();
    act(() => button(/Reload the due dates/)!.click());
    await flush();
    expect(mock.load).toHaveBeenCalledTimes(2);
  });

  it('a teaching assistant reads the dates and extensions without the controls', async () => {
    mock.load.mockResolvedValue(loaded([row(), extended]));
    act(() => root.render(<DueDates course="HIST 2100" term="2026FA" side="teaching" canSet={false} me="ta" />));
    await flush();
    expect(host.textContent).toContain('The course’s instructor sets them.');
    expect(host.textContent).toContain('extended to');
    expect(button(/due date/)).toBeUndefined();
  });

  it('a failed load offers to load again without a primary button', async () => {
    mock.load.mockRejectedValueOnce(new Error('Could not load the due dates.')).mockResolvedValue(loaded([row()]));
    act(() => root.render(<DueDates course="HIST 2100" term="2026FA" side="teaching" canSet me="prof" />));
    await flush();
    expect(host.querySelector('.btn-primary')).toBeNull();
    act(() => button(/Load the due dates again/)!.click());
    await flush();
    expect(host.querySelector('table')).not.toBeNull();
  });

  it('says on the instructor’s side too when the school has not set due dates up', async () => {
    mock.load.mockResolvedValue({ available: false, rows: [] });
    act(() => root.render(<DueDates course="HIST 2100" term="2026FA" side="teaching" canSet me="prof" />));
    await flush();
    expect(host.textContent).toContain('An approved extension is recorded on its request until it is.');
  });
});
