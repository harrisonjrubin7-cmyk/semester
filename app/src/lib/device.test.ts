// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  askToPersist,
  badge,
  buzz,
  keepAwake,
  nowPlaying,
  playbackIs,
  roomLine,
  size,
  storageRoom,
} from './device';

/** Put an API on `navigator` for one test, and take it off after. */
function give(key: string, value: unknown) {
  Object.defineProperty(navigator, key, { configurable: true, value, writable: true });
}

afterEach(() => {
  for (const k of ['storage', 'wakeLock', 'vibrate', 'mediaSession', 'setAppBadge', 'clearAppBadge']) {
    Reflect.deleteProperty(navigator, k);
  }
  vi.unstubAllGlobals();
});

describe('a browser with none of it', () => {
  it('never throws, and never claims success', async () => {
    // Nothing here is load-bearing: an absent API costs a convenience, not a
    // screen.
    await expect(askToPersist()).resolves.toBe(false);
    await expect(storageRoom()).resolves.toEqual({ used: -1, quota: -1, safe: false });
    expect(() => buzz()).not.toThrow();
    expect(() => badge(3)).not.toThrow();
    expect(() => nowPlaying({ title: 'x', course: 'y' })).not.toThrow();
    expect(() => playbackIs('playing')).not.toThrow();
    const release = await keepAwake();
    expect(() => release()).not.toThrow();
  });
});

describe('asking to keep the semester', () => {
  it('asks when it is not already persistent', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    give('storage', { persisted: vi.fn().mockResolvedValue(false), persist });
    await expect(askToPersist()).resolves.toBe(true);
    expect(persist).toHaveBeenCalled();
  });

  it('does not ask twice', async () => {
    const persist = vi.fn();
    give('storage', { persisted: vi.fn().mockResolvedValue(true), persist });
    await expect(askToPersist()).resolves.toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('takes a refusal as an answer', async () => {
    give('storage', {
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(false),
    });
    await expect(askToPersist()).resolves.toBe(false);
  });

  it('survives a browser that has the object and throws', async () => {
    give('storage', {
      persisted: () => {
        throw new Error('nope');
      },
      persist: () => {},
    });
    await expect(askToPersist()).resolves.toBe(false);
  });
});

describe('how much room there is', () => {
  it('reports what the browser gives it', async () => {
    give('storage', {
      persisted: vi.fn().mockResolvedValue(true),
      estimate: vi.fn().mockResolvedValue({ usage: 5 * 1024 * 1024, quota: 100 * 1024 * 1024 }),
    });
    await expect(storageRoom()).resolves.toEqual({
      used: 5 * 1024 * 1024,
      quota: 100 * 1024 * 1024,
      safe: true,
    });
  });

  it('still reports safety where it will not give a number', async () => {
    give('storage', { persisted: vi.fn().mockResolvedValue(true) });
    await expect(storageRoom()).resolves.toEqual({ used: -1, quota: -1, safe: true });
  });

  it('reads bytes the way a person does', () => {
    expect(size(-1)).toBe('—');
    expect(size(900)).toBe('900 B');
    expect(size(200 * 1024)).toBe('200 KB');
    expect(size(5.5 * 1024 * 1024)).toBe('5.5 MB');
    expect(size(250 * 1024 * 1024)).toBe('250 MB');
  });

  it('says plainly when the browser may delete it', () => {
    const line = roomLine({ used: 5 * 1024 * 1024, quota: 100 * 1024 * 1024, safe: false });
    expect(line).toContain('5.0 MB of 100 MB used, about 5%');
    expect(line).toContain('may clear it to make room, without asking');
  });

  it('says plainly when it may not', () => {
    const line = roomLine({ used: 5 * 1024 * 1024, quota: 100 * 1024 * 1024, safe: true });
    expect(line).toContain('will not clear it');
  });

  it('says something useful even with no numbers', () => {
    expect(roomLine({ used: -1, quota: -1, safe: true })).toContain('marked as persistent');
    expect(roomLine({ used: -1, quota: -1, safe: false })).toContain('will not say');
  });
});

describe('keeping the screen on', () => {
  it('takes a lock and gives back a way to release it', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    give('wakeLock', { request: vi.fn().mockResolvedValue({ release }) });
    const stop = await keepAwake();
    stop();
    expect(release).toHaveBeenCalled();
  });

  it('returns a release function even when it got no lock', async () => {
    // A caller that has to check whether it got one is a caller that forgets.
    give('wakeLock', { request: vi.fn().mockRejectedValue(new Error('not visible')) });
    await expect(keepAwake()).resolves.toBeTypeOf('function');
  });
});

describe('the feel of a tap', () => {
  it('buzzes harder for the answer that means more work', () => {
    const vibrate = vi.fn();
    give('vibrate', vibrate);
    buzz('light');
    buzz('firm');
    const [light] = vibrate.mock.calls[0];
    const [firm] = vibrate.mock.calls[1];
    expect(firm).toBeGreaterThan(light);
  });
});

describe('the lock screen', () => {
  function fitMediaSession() {
    const handlers: Record<string, unknown> = {};
    const ms = {
      metadata: null as unknown,
      playbackState: 'none',
      setActionHandler: (a: string, f: unknown) => {
        handlers[a] = f;
      },
    };
    give('mediaSession', ms);
    vi.stubGlobal(
      'MediaMetadata',
      class {
        title: string;
        artist: string;
        album: string;
        artwork: unknown;
        constructor(i: { title: string; artist: string; album: string; artwork: unknown }) {
          this.title = i.title;
          this.artist = i.artist;
          this.album = i.album;
          this.artwork = i.artwork;
        }
      },
    );
    return { ms, handlers };
  }

  it('puts the unit and the course where a player shows track and artist', () => {
    const { ms } = fitMediaSession();
    nowPlaying({ title: 'Unit 3 — Elasticity', course: 'ECON 1020' });
    expect((ms.metadata as { title: string }).title).toBe('Unit 3 — Elasticity');
    expect((ms.metadata as { artist: string }).artist).toBe('ECON 1020');
  });

  it('wires the buttons it is given', () => {
    const { handlers } = fitMediaSession();
    const play = vi.fn();
    nowPlaying({ title: 'x', course: 'y' }, { play });
    expect(handlers.play).toBe(play);
  });

  it('survives a browser that rejects an action it does not know', () => {
    const { ms } = fitMediaSession();
    ms.setActionHandler = () => {
      throw new Error('unsupported');
    };
    expect(() => nowPlaying({ title: 'x', course: 'y' }, { seekforward: () => {} })).not.toThrow();
  });

  it('clears itself when nothing is playing', () => {
    const { ms } = fitMediaSession();
    nowPlaying(null);
    expect(ms.metadata).toBeNull();
    expect(ms.playbackState).toBe('none');
  });
});

describe('the number on the icon', () => {
  it('sets a count and clears a nought', () => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    give('setAppBadge', setAppBadge);
    give('clearAppBadge', clearAppBadge);

    badge(4);
    expect(setAppBadge).toHaveBeenCalledWith(4);

    badge(0);
    expect(clearAppBadge).toHaveBeenCalled();
  });

  it('does not set a badge to what it already shows', () => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    give('setAppBadge', setAppBadge);
    give('clearAppBadge', vi.fn().mockResolvedValue(undefined));
    badge(7);
    badge(7);
    badge(7);
    expect(setAppBadge).toHaveBeenCalledTimes(1);
  });

  it('never shows a negative or a fraction', () => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    give('setAppBadge', setAppBadge);
    give('clearAppBadge', clearAppBadge);
    badge(-3);
    expect(clearAppBadge).toHaveBeenCalled();
    badge(2.7);
    expect(setAppBadge).toHaveBeenCalledWith(2);
  });
});
