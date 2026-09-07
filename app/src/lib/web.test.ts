import { describe, expect, it } from 'vitest';
import { WEB_PAGES, webUrl } from './web';
import { asset } from './asset';

describe('the website beside the app', () => {
  it('names the three pages that are actually deployed', () => {
    // These are the files in `public/web/`. A fourth id here would be a link
    // to a 404, which is worse than not offering the link at all.
    expect(WEB_PAGES.map((p) => p.file)).toEqual([
      'web/index.html',
      'web/app.html',
      'web/study.html',
    ]);
  });

  it('addresses them under whatever base the app is served from', () => {
    // Not a hardcoded github.io URL. That would be right for exactly one
    // deployment and silently wrong for a fork, a local build, or dev.
    for (const page of WEB_PAGES) {
      expect(webUrl(page.id)).toBe(asset(page.file));
    }
  });

  it('gives a relative address, so it stays on the same origin', () => {
    // The whole arrangement rests on same-origin: one localStorage, one
    // Supabase session. An absolute URL to another host would quietly break
    // both while still looking like a working link.
    for (const page of WEB_PAGES) {
      expect(webUrl(page.id).startsWith('http')).toBe(false);
    }
  });

  it('falls back to the front door rather than an empty href', () => {
    expect(webUrl('nonsense' as WebPageId)).toBe(webUrl('front'));
  });

  it('gives every page a label and a blurb', () => {
    for (const page of WEB_PAGES) {
      expect(page.label.length, page.id).toBeGreaterThan(0);
      expect(page.blurb.length, page.id).toBeGreaterThan(0);
    }
  });
});

type WebPageId = (typeof WEB_PAGES)[number]['id'];
