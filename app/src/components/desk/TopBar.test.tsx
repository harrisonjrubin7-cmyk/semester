// @vitest-environment jsdom
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP, DESKTOP_AT, TABLET_AT, WIDE } from '../../lib/media';
import { TopBar } from './TopBar';

const dispatch = vi.hoisted(() => vi.fn());
vi.mock('../../state/store', () => ({
  useStore: () => ({
    state: { role: 'student', cleared: true, apps: false, myName: '' },
    dispatch,
    school: { capabilities: {} },
  }),
}));
vi.mock('../../lib/desk', () => ({ findApps: () => [] }));
vi.mock('../Bookmarks', () => ({
  BookmarkStar: () => <button type="button" className="bare desktop-star" aria-label="Bookmark this page" />,
}));

const SEARCH_NAME = 'Search apps and features, or add something';
let host: HTMLDivElement;
let root: Root;
let width = 391;
let mediaDescriptor: PropertyDescriptor | undefined;
const changes = new Set<() => void>();
const media = (boundary: number) => ({
  get matches() { return width >= boundary; },
  addEventListener: (_type: string, listener: () => void) => changes.add(listener),
  removeEventListener: (_type: string, listener: () => void) => changes.delete(listener),
});
const desktop = media(DESKTOP_AT);
const wide = media(TABLET_AT);
const box = () => host.querySelector<HTMLInputElement>('[role="combobox"]')!;
const action = (name: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
const mount = async () => {
  await act(async () => root.render(<TopBar boxRef={createRef<HTMLInputElement>()} onSuggesting={() => {}} />));
};

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mediaDescriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  width = 391;
  changes.clear();
  dispatch.mockClear();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => query === DESKTOP ? desktop : query === WIDE ? wide : { matches: false, addEventListener() {}, removeEventListener() {} },
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  if (mediaDescriptor) Object.defineProperty(window, 'matchMedia', mediaDescriptor);
  else Reflect.deleteProperty(window, 'matchMedia');
  vi.unstubAllGlobals();
});

describe('the search prompt fits its workspace', () => {
  it.each([320, 391])('uses a short prompt at %ipx without reducing its accessible name', async (at) => {
    width = at;
    await mount();
    expect(box().placeholder).toBe('Search Semester');
    expect(box().getAttribute('aria-label')).toBe(SEARCH_NAME);
  });

  it('keeps the full desktop prompt when there is room', async () => {
    width = 1440;
    await mount();
    expect(box().placeholder).toBe(SEARCH_NAME);
    expect(box().getAttribute('aria-label')).toBe(SEARCH_NAME);
  });

  it('updates the prompt when the window narrows without discarding the query', async () => {
    width = 1440;
    await mount();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(box(), 'biology');
      box().dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { width = 391; changes.forEach(change => change()); });
    expect(box().placeholder).toBe('Search Semester');
    expect(box().value).toBe('biology');
    expect(box().getAttribute('aria-label')).toBe(SEARCH_NAME);
    expect(box().getAttribute('aria-expanded')).toBe('true');
    expect(action('Semester Intelligence').closest('.desktop-tools')).not.toBeNull();
    expect(host.querySelectorAll('.desktop-ai')).toHaveLength(1);
  });
});

describe('the compact toolbar leaves room to search without losing page actions', () => {
  it.each([320, 391])('moves the existing actions out of the search field at %ipx', async (at) => {
    width = at;
    await mount();
    expect(host.querySelector('.desktop-field .desktop-star, .desktop-field .desktop-ai')).toBeNull();
    for (const name of ['Bookmark this page', 'Semester Intelligence', 'All apps', 'Profile']) {
      expect(action(name).closest('.desktop-tools'), name).not.toBeNull();
      expect(host.querySelectorAll(`button[aria-label="${name}"]`), name).toHaveLength(1);
    }
    await act(async () => action('Semester Intelligence').click());
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'go', screen: 'ask' });
    await act(async () => action('All apps').click());
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'apps', open: true });
    await act(async () => action('Profile').click());
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'go', screen: 'profile' });
  });

  it('keeps bookmark and Intelligence beside the field from the expanded tier', async () => {
    width = TABLET_AT;
    await mount();
    expect(action('Bookmark this page').closest('.desktop-field')).not.toBeNull();
    expect(action('Semester Intelligence').closest('.desktop-field')).not.toBeNull();
    expect(host.querySelectorAll('.desktop-star')).toHaveLength(1);
    expect(host.querySelectorAll('.desktop-ai')).toHaveLength(1);
  });
});
