import { describe, expect, it } from 'vitest';
import { deviceLabel, orderSessions, sessionRows, type RawSession, type SessionRow } from './devices';

/**
 * The words for a device and the order of the list. The two RPC calls are one
 * line each and are held by `supabase/my-sessions.check.sql`; this is the part
 * that can be wrong without the database being wrong.
 */

const UA = {
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  edgeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
  chromeIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1',
  safariIpad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  operaMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0',
};

describe('deviceLabel', () => {
  it.each([
    [UA.chromeMac, 'Chrome on Mac'],
    [UA.safariIphone, 'Safari on iPhone'],
    [UA.chromeAndroid, 'Chrome on Android'],
    [UA.edgeWindows, 'Edge on Windows'],
    [UA.firefoxLinux, 'Firefox on Linux'],
    [UA.chromeIphone, 'Chrome on iPhone'],
    [UA.safariIpad, 'Safari on iPad'],
    [UA.operaMac, 'Opera on Mac'],
  ])('reads %#', (ua, label) => expect(deviceLabel(ua)).toBe(label));

  it('says only what it can tell, and never an empty string', () => {
    expect(deviceLabel(null)).toBe('A device');
    expect(deviceLabel(undefined)).toBe('A device');
    expect(deviceLabel('   ')).toBe('A device');
    expect(deviceLabel('curl/8.0')).toBe('A device');
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0)')).toBe('Windows');
    expect(deviceLabel('Chrome/130.0')).toBe('Chrome');
  });

  it('control: an Android phone is not called Linux, and an iPhone is not called a Mac', () => {
    expect(deviceLabel(UA.chromeAndroid)).not.toContain('Linux');
    expect(deviceLabel(UA.safariIphone)).not.toContain('Mac');
  });
});

const row = (id: string, lastActiveAt: string, isCurrent = false): SessionRow => ({ id, startedAt: lastActiveAt, lastActiveAt, userAgent: null, isCurrent });

describe('orderSessions', () => {
  it('puts the device in use first, then the most recently active, and is stable on ties', () => {
    const ordered = orderSessions([
      row('b', '2026-10-01T00:00:00Z'),
      row('a', '2026-10-01T00:00:00Z'),
      row('here', '2026-09-01T00:00:00Z', true),
      row('new', '2026-10-05T00:00:00Z'),
    ]);
    expect(ordered.map((r) => r.id)).toEqual(['here', 'new', 'a', 'b']);
  });

  it('does not change the list it was given', () => {
    const given = [row('x', '2026-10-01T00:00:00Z'), row('y', '2026-10-02T00:00:00Z')];
    orderSessions(given);
    expect(given.map((r) => r.id)).toEqual(['x', 'y']);
  });
});

describe('sessionRows', () => {
  it('maps the database columns and treats nothing as an empty list', () => {
    const raw: RawSession[] = [{ id: 's1', created_at: 'c', last_active: 'l', user_agent: UA.chromeMac, is_current: true }];
    expect(sessionRows(raw)).toEqual([{ id: 's1', startedAt: 'c', lastActiveAt: 'l', userAgent: UA.chromeMac, isCurrent: true }]);
    expect(sessionRows(null)).toEqual([]);
  });

  it('only a true is_current counts', () => {
    const raw = [{ id: 's', created_at: 'c', last_active: 'l', user_agent: null, is_current: null as unknown as boolean }];
    expect(sessionRows(raw)[0].isCurrent).toBe(false);
  });
});
