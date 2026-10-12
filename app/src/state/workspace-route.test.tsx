// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { StoreProvider, useStore } from './store';
import { STORAGE_KEY } from './shape';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let openWorkspace: (screen: 'account' | 'university', view: 'course-studio' | 'overview' | 'drafts') => void;

function Where() {
  const { state, dispatch } = useStore();
  openWorkspace = (screen, view) => {
    if (screen === 'account' && view === 'course-studio') dispatch({ type: 'openWorkspace', screen, view });
    if (screen === 'university' && view !== 'course-studio') dispatch({ type: 'openWorkspace', screen, view });
  };
  return <span data-screen={state.screen} data-view={(state as typeof state & { workspaceView?: string }).workspaceView ?? ''} />;
}

async function mount() {
  await act(async () => {
    root.render(<StoreProvider><Where /></StoreProvider>);
  });
}

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ seenOnboarding: true }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  history.replaceState(null, '', '/');
});

const state = () => ({
  screen: host.querySelector('span')?.getAttribute('data-screen'),
  view: host.querySelector('span')?.getAttribute('data-view'),
});

describe('typed workspace destinations', () => {
  it('keeps the requested subview across a cold link and its canonical rewrite', async () => {
    history.replaceState(null, '', '/#/university?view=drafts');
    await mount();
    expect(state()).toEqual({ screen: 'university', view: 'drafts' });
    expect(location.hash).toBe('#/university?view=drafts');
  });

  it('writes a typed destination and follows browser navigation back to another one', async () => {
    history.replaceState(null, '', '/#/university?view=overview');
    await mount();

    await act(async () => openWorkspace('account', 'course-studio'));
    expect(state()).toEqual({ screen: 'account', view: 'course-studio' });
    expect(location.hash).toBe('#/account?view=course-studio');

    history.pushState(null, '', '#/university?view=drafts');
    await act(async () => window.dispatchEvent(new HashChangeEvent('hashchange')));
    expect(state()).toEqual({ screen: 'university', view: 'drafts' });
  });
});
