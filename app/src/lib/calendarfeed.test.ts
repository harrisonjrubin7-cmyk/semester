import { describe, expect, it, vi } from 'vitest';
import {
  calendarFeedDeps,
  handleCalendarFeed,
  type CalendarFeedDeps,
} from '../../../supabase/functions/_shared/calendarfeed';

const TOKEN = 'a'.repeat(48);
const URL = `https://functions.example.edu/calendar/${TOKEN}`;
const calendar = 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n';

function dependencies(overrides: Partial<CalendarFeedDeps> = {}) {
  return {
    readFeed: vi.fn(async () => ({
      data: { body: calendar, name: 'Fall 2026', updated_at: '2026-10-28T12:00:00.000Z' },
      error: null,
    })),
    ...overrides,
  } satisfies CalendarFeedDeps;
}

describe('the calendar feed function', () => {
  it('normalizes the Supabase RPC thenable into the promised dependency contract', async () => {
    const rpcResult = { data: { body: calendar }, error: null };
    const thenable: PromiseLike<typeof rpcResult> = {
      then: (resolve, reject) => Promise.resolve(rpcResult).then(resolve, reject),
    };
    const deps = calendarFeedDeps(() => thenable);

    expect(deps.readFeed(TOKEN, 'apple')).toBeInstanceOf(Promise);
    await expect(deps.readFeed(TOKEN, 'apple')).resolves.toEqual(rpcResult);
  });

  it('allows only calendar read methods before configuration or database work', async () => {
    const deps = dependencies();
    const response = await handleCalendarFeed(new Request(URL, { method: 'POST' }), deps);
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, HEAD');
    expect(deps.readFeed).not.toHaveBeenCalled();
  });

  it('fails closed when the deployed function has no service configuration', async () => {
    const response = await handleCalendarFeed(new Request(URL), null);
    expect(response.status).toBe(503);
    expect(await response.text()).toContain('BEGIN:VCALENDAR');
  });

  it('rejects malformed link tokens before database work', async () => {
    const deps = dependencies();
    const response = await handleCalendarFeed(new Request('https://functions.example.edu/calendar/not-a-token'), deps);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('BEGIN:VCALENDAR');
    expect(deps.readFeed).not.toHaveBeenCalled();
  });

  it('does not distinguish a missing feed, database error or thrown database failure', async () => {
    const cases: CalendarFeedDeps[] = [
      dependencies({ readFeed: vi.fn(async () => ({ data: null, error: null })) }),
      dependencies({ readFeed: vi.fn(async () => ({ data: null, error: new Error('database unavailable') })) }),
      dependencies({ readFeed: vi.fn(async () => { throw new Error('database unavailable'); }) }),
    ];
    const bodies: string[] = [];
    for (const deps of cases) {
      const response = await handleCalendarFeed(new Request(URL), deps);
      expect(response.status).toBe(404);
      bodies.push(await response.text());
    }
    expect(new Set(bodies).size).toBe(1);
  });

  it('reads a valid token once with only a fixed client family', async () => {
    const deps = dependencies();
    const response = await handleCalendarFeed(new Request(URL, {
      headers: { 'user-agent': 'CalendarAgent/1.0 private-detail' },
    }), deps);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(calendar);
    expect(deps.readFeed).toHaveBeenCalledWith(TOKEN, 'apple');
    expect(response.headers.get('content-type')).toBe('text/calendar; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('private, max-age=3600');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('content-disposition')).toBe('inline; filename="fall-2026.ics"');
    expect(response.headers.get('last-modified')).toBe('Wed, 28 Oct 2026 12:00:00 GMT');
  });

  it('returns headers without a body for a successful freshness check', async () => {
    const response = await handleCalendarFeed(new Request(URL, { method: 'HEAD' }), dependencies());
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(response.headers.get('content-disposition')).toBe('inline; filename="fall-2026.ics"');
  });
});
