// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSeed } from '../../data/seed';
import type { Screen } from '../../lib/types';
import { StoreProvider } from '../../state/store';
import { FlightPlanProvider } from './FlightPlanContext';
import { FlightPlanHome } from './FlightPlanHome';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeAll(() => loadSeed());

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

function renderHome(enabled = true, onNavigate: (screen: Screen) => void = () => undefined) {
  act(() => {
    root.render(
      <StoreProvider>
        <FlightPlanProvider
          tenant="northstar"
          role="student"
          personId="northstar-student"
          storage={storage}
        >
          <FlightPlanHome enabled={enabled} onNavigate={onNavigate} />
        </FlightPlanProvider>
      </StoreProvider>,
    );
  });
}

describe('native Flight Plan Home module', () => {
  it('shows one next action while keeping uncertain work out of planned minutes', () => {
    renderHome();
    expect(host.textContent).toContain('Synthetic Flight Plan');
    expect(host.textContent).toContain('Recover Evidence & sampling practice');
    expect(host.textContent).toContain('300 min planned');
    expect(host.textContent).toContain('1 source to verify');
    expect(host.textContent).toContain('1 recovery choice');
  });

  it('opens the existing recovery screen instead of introducing another route', () => {
    let destination: Screen | null = null;
    renderHome(true, (screen) => {
      destination = screen;
    });
    const button = [...host.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === 'Review recovery',
    );
    act(() => button?.click());
    expect(destination).toBe('behind');
  });

  it('renders nothing when the institutional preview is disabled', () => {
    renderHome(false);
    expect(host.textContent).toBe('');
  });
});
