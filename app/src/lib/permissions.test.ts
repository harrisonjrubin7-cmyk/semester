// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CAPABILITIES,
  GRANT_WORDS,
  allowAgainSteps,
  allowedCount,
  available,
  readGrant,
  revokeSteps,
  type CapabilityId,
} from './permissions';

/**
 * What the app may use, and how to take it back.
 *
 * The browser is stubbed at the edge, field by field, because jsdom has none of
 * it: no camera, no position, no permission service. Each test says which of
 * those exist, which is the situation the real code branches on.
 */

type Query = (d: { name: string }) => Promise<{ state: string }>;

function browser(opts: {
  query?: Query | 'absent';
  media?: boolean;
  geo?: boolean;
  notification?: NotificationPermission | 'absent';
}) {
  const getUserMedia = vi.fn();
  const getCurrentPosition = vi.fn();
  vi.stubGlobal('navigator', {
    ...(opts.query === 'absent' ? {} : { permissions: { query: opts.query ?? (async () => ({ state: 'prompt' })) } }),
    ...(opts.media === false ? {} : { mediaDevices: { getUserMedia } }),
    ...(opts.geo === false ? {} : { geolocation: { getCurrentPosition } }),
  });
  const requestPermission = vi.fn();
  if (opts.notification === 'absent') vi.stubGlobal('Notification', undefined);
  else vi.stubGlobal('Notification', Object.assign(function () {}, { permission: opts.notification ?? 'default', requestPermission }));
  return { getUserMedia, getCurrentPosition, requestPermission };
}

afterEach(() => vi.unstubAllGlobals());

describe('the four capabilities', () => {
  it('each says what it is for, what still works without it, and has a way back', () => {
    expect(CAPABILITIES.map((c) => c.id)).toEqual(['camera', 'microphone', 'location', 'notifications']);
    for (const c of CAPABILITIES) {
      expect(c.purpose.length, `${c.id} purpose`).toBeGreaterThan(20);
      expect(c.fallback.length, `${c.id} fallback`).toBeGreaterThan(10);
      expect(revokeSteps(c.id)).toMatch(/site settings/);
      expect(allowAgainSteps(c.id)).toMatch(/site settings/);
    }
  });

  it('every state has a word and a glyph, so colour is never the only signal', () => {
    for (const [grant, w] of Object.entries(GRANT_WORDS)) {
      expect(w.word, grant).not.toBe('');
      expect(w.glyph, grant).not.toBe('');
    }
    expect(new Set(Object.values(GRANT_WORDS).map((w) => w.word)).size).toBe(5);
  });
});

describe('reading what the browser thinks', () => {
  it.each([
    ['granted', 'granted'],
    ['denied', 'denied'],
    ['prompt', 'ask'],
  ])('maps the permission state %s to %s', async (state, want) => {
    browser({ query: async () => ({ state }) });
    for (const c of CAPABILITIES) expect((await readGrant(c.id)).grant).toBe(want);
  });

  it('asks the browser by the name the browser uses: geolocation, not location', async () => {
    const seen: string[] = [];
    browser({ query: async (d) => (seen.push(d.name), { state: 'prompt' }) });
    for (const c of CAPABILITIES) await readGrant(c.id);
    expect(seen).toEqual(['camera', 'microphone', 'geolocation', 'notifications']);
  });

  it('says unsupported where the thing itself is absent, without asking the browser', async () => {
    const query = vi.fn();
    browser({ query, media: false, geo: false, notification: 'absent' });
    for (const c of CAPABILITIES) expect((await readGrant(c.id)).grant).toBe('unsupported');
    expect(query).not.toHaveBeenCalled();
  });

  it('says unknown, not ask, where the browser will not report camera or microphone', async () => {
    browser({ query: async () => Promise.reject(new TypeError('not a valid permission name')) });
    expect((await readGrant('camera')).grant).toBe('unknown');
    expect((await readGrant('microphone')).grant).toBe('unknown');
  });

  it('still answers notifications from the browser when the permission service will not', async () => {
    browser({ query: async () => Promise.reject(new TypeError('no')), notification: 'granted' });
    expect((await readGrant('notifications')).grant).toBe('granted');
    browser({ query: 'absent', notification: 'denied' });
    expect((await readGrant('notifications')).grant).toBe('denied');
  });

  it('says unknown for camera when there is no permission service at all', async () => {
    browser({ query: 'absent' });
    expect((await readGrant('camera')).grant).toBe('unknown');
  });

  it('does not swallow a failure it does not understand', async () => {
    browser({ query: async () => Promise.reject(new Error('boom')) });
    await expect(readGrant('camera')).rejects.toThrow('boom');
  });

  it('never asks for anything: reading is not prompting', async () => {
    const spies = browser({ query: async () => ({ state: 'prompt' }) });
    for (const c of CAPABILITIES) await readGrant(c.id);
    expect(spies.getUserMedia).not.toHaveBeenCalled();
    expect(spies.getCurrentPosition).not.toHaveBeenCalled();
    expect(spies.requestPermission).not.toHaveBeenCalled();
  });

  it('control: available() sees a browser that has them and one that has not', () => {
    browser({});
    expect(CAPABILITIES.every((c) => available(c.id as CapabilityId))).toBe(true);
    browser({ media: false, geo: false, notification: 'absent' });
    expect(CAPABILITIES.some((c) => available(c.id as CapabilityId))).toBe(false);
  });
});

describe('counting', () => {
  it('counts only the granted ones', () => {
    expect(allowedCount({})).toBe(0);
    expect(allowedCount({ camera: 'granted', microphone: 'denied', location: 'granted', notifications: 'ask' })).toBe(2);
  });
});
