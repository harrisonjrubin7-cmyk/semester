// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  screen: 'calendar',
  dispatch: vi.fn(),
  showAI: vi.fn(),
}));

vi.mock('../../state/store', () => ({
  useStore: () => ({
    state: { screen: store.screen, role: 'student' },
    dispatch: store.dispatch,
    school: { capabilities: {} },
  }),
}));

vi.mock('../../ai/store', () => ({
  useAI: () => ({ show: store.showAI }),
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
  store.showAI.mockReset();
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

  it('renders the five primary destinations and keeps all seven workspaces in one disclosure', () => {
    render(true);

    const primary = host.querySelector('nav[aria-label="Primary"]')!;
    expect([...primary.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      'Home',
      'Calendar',
      'Discover',
      'Ask Semester',
      'Inbox',
    ]);

    const disclosure = host.querySelector('details.institutional-workspace-disclosure')!;
    expect(disclosure.hasAttribute('open')).toBe(false);
    expect(disclosure.querySelector('summary')?.textContent).toBe('Home workspace');
    const workspace = disclosure.querySelector('nav[aria-label="Workspace"]')!;
    expect([...workspace.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
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

  it('labels the disclosure with the current contextual workspace', () => {
    render(true);
    expect(host.querySelector('details summary')?.textContent).toBe('Home workspace');

    store.screen = 'degree';
    render(true);
    expect(host.querySelector('details summary')?.textContent).toBe('Courses workspace');
  });

  it('connects the current screen to its journey, adjacent parts and Semester Intelligence', () => {
    store.screen = 'write';
    render(true);
    const disclosure = host.querySelector<HTMLDetailsElement>('details')!;
    disclosure.open = true;
    const context = disclosure.querySelector('[aria-label="Current journey"]')!;
    expect(context.textContent).toContain('Complete an assignment');
    expect(context.textContent).toContain('of');

    const ask = [...context.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Ask Semester'))!;
    act(() => ask.click());
    expect(store.showAI).toHaveBeenCalledWith(expect.stringContaining('Complete an assignment'));
  });
});
