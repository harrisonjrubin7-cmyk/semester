import { describe, expect, it, vi } from 'vitest';
import { usedAssets, warm } from './warm';
import { readFileSync } from 'node:fs';

/**
 * The first visit offline was a blank page.
 *
 * A service worker does not exist while the page registering it loads, so the
 * document and its bundles never pass through its handler — and nothing asks
 * again, because this app routes on the hash and a hash change does not
 * reload. Measured on the production build: install one visit, lose signal,
 * reload.
 *
 *     before   root text length: 0     failed requests: 8
 *     after    root text length: 966   failed requests: 0
 *
 * The cached shell came back and every script around it 404'd — so the promise
 * on the front of the README held for anybody who came back a second time
 * online, and broke for anybody who installed it and lost signal first, which
 * is the case it exists for. After: 25 entries in the shell cache.
 */

const entries = (...names: string[]) => names.map((name) => ({ name }));

describe('what the worker is asked to keep', () => {
  it('takes the code and styles the shell cannot start without', () => {
    expect(
      usedAssets(
        entries(
          'https://x.test/semester/assets/index-CM1jKdWd.js',
          'https://x.test/semester/assets/app-abc.css',
          'https://x.test/semester/fonts/body.woff2',
        ),
        'https://x.test',
        '/semester/',
      ),
    ).toHaveLength(3);
  });

  it('leaves anything not under the app alone', () => {
    // A font or a script from somewhere else is not this worker's to keep, and
    // `cache.add` on an opaque cross-origin response stores something that
    // cannot be read back anyway.
    expect(
      usedAssets(
        entries(
          'https://elsewhere.test/analytics.js',
          'https://x.test/other-app/assets/a.js',
          'https://x.test/semester/assets/keep.js',
        ),
        'https://x.test',
        '/semester/',
      ),
    ).toEqual(['https://x.test/semester/assets/keep.js']);
  });

  it('skips what is neither code nor a style', () => {
    // Audio is never pre-cached: sixty megabytes of lessons downloaded on
    // first open would be a hostile thing to do to a phone plan, which is the
    // rule `sw.js` already states.
    expect(
      usedAssets(
        entries(
          'https://x.test/semester/audio/lesson-1.mp3',
          'https://x.test/semester/handouts/week-2.pdf',
        ),
        'https://x.test',
        '/semester/',
      ),
    ).toEqual([]);
  });

  it('asks for each file once, however often it was fetched', () => {
    expect(
      usedAssets(
        entries(
          'https://x.test/semester/assets/a.js?v=1',
          'https://x.test/semester/assets/a.js?v=2',
          'https://x.test/semester/assets/a.js',
        ),
        'https://x.test',
        '/semester/',
      ),
    ).toEqual(['https://x.test/semester/assets/a.js']);
  });

  it('works at the root, where the base is just a slash', () => {
    expect(
      usedAssets(entries('https://x.test/assets/a.js'), 'https://x.test', '/'),
    ).toEqual(['https://x.test/assets/a.js']);
  });
});

describe('handing the list over', () => {
  it('waits for a worker that is actually active', async () => {
    // A registration exists before its worker is active, and a message posted
    // to one still installing is dropped. `ready` is the wait; using the
    // `register` promise instead would post into nothing.
    const postMessage = vi.fn();
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ active: { postMessage } }) },
    });
    vi.stubGlobal('location', { origin: 'https://x.test' });
    vi.stubGlobal('performance', {
      getEntriesByType: () => entries('https://x.test/assets/a.js'),
    });
    await warm('/');
    expect(postMessage).toHaveBeenCalledWith({
      type: 'warm',
      urls: ['https://x.test/assets/a.js'],
    });
    vi.unstubAllGlobals();
  });

  it('says nothing when there is nothing to say', async () => {
    const postMessage = vi.fn();
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ active: { postMessage } }) },
    });
    vi.stubGlobal('location', { origin: 'https://x.test' });
    vi.stubGlobal('performance', { getEntriesByType: () => [] });
    await warm('/');
    expect(postMessage).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('is silent where there is no worker at all', async () => {
    vi.stubGlobal('navigator', {});
    await expect(warm('/')).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });
});

describe('the worker takes the list', () => {
  const sw = readFileSync('public/sw.js', 'utf8');

  it('has a handler for it, and puts them in the shell cache', () => {
    expect(sw).toContain("event.data.type === 'warm'");
    expect(sw).toMatch(/caches\.open\(SHELL\)/);
  });

  it('looks up past Vary, or the warm neither finds nor helps', () => {
    // A bundle fetched by the page as a module carries different request
    // headers from one the worker fetches, and a strict `Vary` match treats
    // those as different entries — so without this the same file is stored
    // again on every warm and the offline lookup still misses.
    expect(sw.match(/ignoreVary: true/g) ?? []).toHaveLength(3);
  });

  it('is registered by the page, and warmed in the same breath', () => {
    const main = readFileSync('src/main.tsx', 'utf8');
    expect(main).toContain('void warm(base)');
  });
});
