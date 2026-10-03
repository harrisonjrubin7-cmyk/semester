// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const site = readFileSync(join(import.meta.dirname, '../../../company-site/site.js'), 'utf8');

// Execute the shipped functions, not a copy of their behavior. The only shims
// are unrelated search results/dropdowns and jsdom's missing layout measurements.
function between(start: string, end: string) {
  const from = site.indexOf(start);
  const to = site.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`Company dialog section missing: ${start}`);
  return site.slice(from, to);
}

const drawerSource = between('// ---------- drawer ----------', '// ---------- tabs ----------');
const searchSource = between('const sd=document.getElementById("search")', '// ---------- trust center ----------');
type Dialogs = {
  openDrawer: () => void;
  closeDrawer: (returnFocus?: boolean) => void;
  sOpen: () => void;
  sClose: (returnFocus?: boolean) => void;
};

const fixtures: HTMLElement[] = [];
let dialogs: Dialogs;
let previousOverflow: string;
let listeners: ReturnType<typeof vi.spyOn>;

const element = (id: string) => document.getElementById(id)!;
const backgroundState = () => ['site-header', 'main', 'site-footer'].map(id => Boolean(element(id).inert));

beforeEach(() => {
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'auto';
  const template = document.createElement('template');
  template.innerHTML = `
    <header id="site-header">
      <button id="menu-btn" aria-expanded="false">Menu</button>
      <button id="search-btn">Search</button>
    </header>
    <main id="main"><a href="#product">Background link</a></main>
    <footer id="site-footer">Already isolated background</footer>
    <div class="drawer" id="drawer" hidden>
      <div role="dialog" aria-modal="true" aria-label="Menu">
        <button id="drawer-close">Close</button><a href="#product">Product</a>
      </div>
    </div>
    <div class="drawer" id="search" hidden>
      <div role="dialog" aria-modal="true" aria-label="Search">
        <input id="search-q"><button id="search-close">Close</button>
        <div id="search-f"><button data-k="all">All</button></div>
        <a href="#product">Search result</a>
      </div>
    </div>`;
  fixtures.push(...Array.from(template.content.children) as HTMLElement[]);
  document.body.append(...fixtures);
  element('site-footer').inert = true;

  // Browsers report no client rects for hidden triggers. jsdom reports none
  // for every element, so supply only that public visibility measurement.
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
    const visible = !this.closest('[hidden]') && this.style.display !== 'none';
    const rects = visible ? [new DOMRect(0, 0, 100, 44)] : [];
    return Object.assign(rects, { item: (index: number) => rects[index] ?? null }) as DOMRectList;
  });
  listeners = vi.spyOn(document, 'addEventListener');
  const evaluate = new Function('document', 'window', 'sRun', 'sfe', 'setP', 'dds', 'closeDD', `
    ${drawerSource}
    ${searchSource}
    return { openDrawer, closeDrawer, sOpen, sClose };
  `);
  dialogs = evaluate(document, window, () => {}, element('search-f'), () => {}, [], () => {}) as Dialogs;
});

afterEach(() => {
  dialogs?.sClose(false);
  dialogs?.closeDrawer(false);
  for (const [type, listener, options] of listeners.mock.calls) {
    if (listener) document.removeEventListener(type as string, listener as EventListener, options as AddEventListenerOptions);
  }
  fixtures.splice(0).forEach(node => node.remove());
  document.body.style.overflow = previousOverflow;
  vi.restoreAllMocks();
});

describe('the company site dialog lifecycle', () => {
  it('reads real drawer and search functions, including their dismissal listeners', () => {
    expect(drawerSource.includes('function openDrawer(')).toBe(true);
    expect(searchSource.includes('function sClose(')).toBe(true);
    expect(searchSource.includes('search-close')).toBe(true);
    expect(element('search').hidden).toBe(true);
    expect(backgroundState()).toEqual([false, false, true]);
    expect(document.body.style.overflow).toBe('auto');
  });

  it('opens desktop search and returns focus on Escape', () => {
    element('search-btn').focus();
    element('search-btn').click();
    expect(document.activeElement?.id).toBe('search-q');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(element('search').hidden).toBe(true);
    expect(document.activeElement?.id).toBe('search-btn');
  });

  it('returns mobile search focus to the visible menu, not the hidden desktop trigger', () => {
    // A compact-header variant may hide its search trigger. The menu can still
    // open search after closing the drawer, without losing keyboard focus.
    element('search-btn').style.display = 'none';
    element('menu-btn').focus();
    dialogs.openDrawer();
    dialogs.closeDrawer();
    dialogs.sOpen();
    expect(document.activeElement?.id).toBe('search-q');
    element('search-close').click();
    expect(element('search').hidden).toBe(true);
    expect(document.activeElement?.id).toBe('menu-btn');
  });

  it.each(['drawer', 'search'] as const)('isolates the background only while %s is open and restores pre-existing state', kind => {
    element(kind === 'drawer' ? 'menu-btn' : 'search-btn').focus();
    if (kind === 'drawer') dialogs.openDrawer(); else dialogs.sOpen();
    expect(backgroundState()).toEqual([true, true, true]);
    expect(document.body.style.overflow).toBe('hidden');
    expect(element(kind).inert).not.toBe(true);

    if (kind === 'drawer') dialogs.closeDrawer(); else dialogs.sClose();
    expect(backgroundState()).toEqual([false, false, true]);
    expect(document.body.style.overflow).toBe('auto');
  });

  it('switches from the mobile menu to shortcut search without two active modals', () => {
    element('menu-btn').focus();
    dialogs.openDrawer();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    expect(element('drawer').hidden).toBe(true);
    expect(element('search').hidden).toBe(false);
    expect(element('menu-btn').getAttribute('aria-expanded')).toBe('false');
    expect(backgroundState()).toEqual([true, true, true]);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement?.id).toBe('search-q');
    dialogs.sClose();
    expect(document.activeElement?.id).toBe('menu-btn');
    expect(backgroundState()).toEqual([false, false, true]);
  });

  it('keeps only the menu active if it replaces an open search dialog', () => {
    element('search-btn').focus();
    dialogs.sOpen();
    dialogs.openDrawer();
    expect(element('search').hidden).toBe(true);
    expect(element('drawer').hidden).toBe(false);
    expect(document.activeElement?.id).toBe('drawer-close');
    expect(document.body.style.overflow).toBe('hidden');
    dialogs.closeDrawer();
    expect(backgroundState()).toEqual([false, false, true]);
    expect(document.body.style.overflow).toBe('auto');
  });
});
