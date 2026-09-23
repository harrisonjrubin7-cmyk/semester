// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  screen: 'calendar',
  dispatch: vi.fn(),
}));

vi.mock('../../state/store', () => ({
  useStore: () => ({
    state: { screen: store.screen },
    dispatch: store.dispatch,
  }),
}));

import { InstitutionalNavigation } from './InstitutionalPrimaryNav';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function render(enabled?: boolean) {
  act(() => root.render(<InstitutionalNavigation {...(enabled === undefined ? {} : { enabled })} />));
}

beforeEach(() => {
  store.screen = 'calendar';
  store.dispatch.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('institutional navigation preview', () => {
  it('renders nothing when the preview is disabled by default', () => {
    render();
    expect(host.querySelector('nav[aria-label="Primary"]')).toBeNull();
    expect(host.querySelector('nav[aria-label="Workspace"]')).toBeNull();
  });

  it('renders the five primary destinations and seven workspaces when enabled', () => {
    render(true);

    const primary = host.querySelector('nav[aria-label="Primary"]')!;
    expect([...primary.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      'Home',
      'Calendar',
      'Discover',
      'Ask Semester',
      'Inbox',
    ]);

    const desktopWorkspace = host.querySelector(
      'nav[aria-label="Workspace"].institutional-workspace-desktop',
    )!;
    expect([...desktopWorkspace.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      'Home',
      'Courses',
      'Study',
      'Create',
      'Campus',
      'Career',
      'Messages',
    ]);
  });

  it('marks the current primary destination and routes through the existing store action', () => {
    render(true);
    const calendar = [...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Primary"] button')]
      .find((button) => button.textContent === 'Calendar')!;

    expect(calendar.getAttribute('aria-current')).toBe('page');
    act(() => calendar.click());
    expect(store.dispatch).toHaveBeenCalledWith({ type: 'go', screen: 'calendar' });
  });

  it('offers the phone workspace navigation as an accessible disclosure', () => {
    render(true);
    const sheet = host.querySelector('details.institutional-workspace-sheet')!;
    expect(sheet.querySelector('summary')?.textContent).toContain('Home workspace');
    expect(sheet.querySelector('nav[aria-label="Workspace"]')).not.toBeNull();
  });
});
