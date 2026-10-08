// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GALLERY_GROUNDS, galleryPages } from './pages';
import { STORIES } from './stories';

const unity = join(__dirname, '../components/unity');
const css = ['tokens', 'industry', 'app', 'unity'].map((f) => readFileSync(join(__dirname, `../styles/${f}.css`), 'utf8')).join('\n');

/**
 * Components in `components/unity/` that have no story yet, and why.
 *
 * Shrink-only, like the other ledgers here: a component added without a story
 * fails, a story added for one of these fails until its entry is removed, and
 * every entry says why. The design-system components built in this effort all
 * have stories; the rest are app-level and need the store or router around
 * them, which is a bigger fixture than this gallery has.
 */
const NO_STORY: Record<string, string> = {
  AccessibilityPanel: 'app-level; reads the store',
  AccessibilityTools: 'app-level; reads the store',
  CommandCenter: 'app-level; reads the store and router',
  ContextBar: 'app-level; reads the store',
  DecisionTrail: 'needs decision-record fixtures',
  NextSteps: 'app-level; reads the store',
  OpenIn: 'app-level; navigates through the router',
  QuickActions: 'app-level; reads the store',
  ReadState: 'needs a reading-state fixture',
  ScreenGuide: 'app-level; reads the store',
  States: 'several small components; each wants its own story',
  Status: 'several small components; each wants its own story',
  SystemContextBar: 'app-level; reads the store',
  ToolDisclosure: 'needs a tool fixture',
  UnityLayer: 'app-level overlay; reads the store',
  Visibility: 'app-level; reads the store',
  modes: 'app-level; reads the store',
};

const components = readdirSync(unity)
  .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
  .map((f) => f.replace(/\.tsx$/, ''));

describe('the gallery', () => {
  it('has a story, with a unique id and a title, for every entry', () => {
    expect(STORIES.length).toBeGreaterThan(0);
    expect(new Set(STORIES.map((s) => s.id)).size).toBe(STORIES.length);
    for (const s of STORIES) expect(s.title.length, s.id).toBeGreaterThan(3);
  });

  it('draws every story, under every ground, with real content', () => {
    const pages = galleryPages(css);
    expect(pages.map((p) => p.ground)).toEqual([...GALLERY_GROUNDS]);
    for (const p of pages) {
      for (const s of STORIES) {
        const section = new RegExp(`<section data-story="${s.id}">([\\s\\S]*?)</section>`).exec(p.html)?.[1] ?? '';
        expect(section.length, `${s.id} on ${p.ground}`).toBeGreaterThan(80);
        expect(section, `${s.id} on ${p.ground}`).not.toMatch(/undefined|\[object Object\]/);
      }
    }
  });

  it('does not read the clock: no story shows an age measured from the real now', () => {
    // Every age on a page is "… ago" measured from NOW. Drawn twice a moment apart the markup is identical.
    const a = galleryPages(css).map((p) => p.html);
    const real = Date.now;
    Date.now = () => real() + 7 * 3_600_000;
    try {
      expect(galleryPages(css).map((p) => p.html)).toEqual(a);
    } finally {
      Date.now = real;
    }
  });

  it('sets the ground’s variables on <html>, where tokens.css resolves its aliases', () => {
    const [ink, parchment] = galleryPages(css);
    const bg = (h: string) => /<html[^>]*style="[^"]*--app-bg:([^;"]+)/.exec(h)?.[1];
    expect(bg(ink.html)).toBeTruthy();
    expect(bg(ink.html)).not.toBe(bg(parchment.html));
  });

  it('gives every component in components/unity a story, or a reason it has none', () => {
    const covered = new Set(STORIES.map((s) => s.component));
    const missing = components.filter((c) => !covered.has(c) && !(c in NO_STORY));
    expect(missing, 'add a story in gallery/stories.tsx, or list it in NO_STORY with a reason').toEqual([]);
  });

  it('names only components that exist, and only ones still without a story', () => {
    const covered = new Set(STORIES.map((s) => s.component));
    expect(STORIES.filter((s) => !components.includes(s.component)).map((s) => s.id)).toEqual([]);
    const stale = Object.keys(NO_STORY).filter((c) => !components.includes(c) || covered.has(c));
    expect(stale, 'the ledger only shrinks — remove an entry once its component has a story').toEqual([]);
    for (const [c, why] of Object.entries(NO_STORY)) expect(why.length, c).toBeGreaterThan(8);
  });
});
