// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSeed } from '../../data/seed';
import { StoreProvider } from '../../state/store';
import { FlightPlanProvider } from './FlightPlanContext';
import { FlightPlanCalendar } from './FlightPlanCalendar';

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

const storage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };

function renderCalendar() {
  act(() => {
    root.render(
      <StoreProvider>
        <FlightPlanProvider tenant="northstar" role="student" personId="student-a" storage={storage}>
          <FlightPlanCalendar />
        </FlightPlanProvider>
      </StoreProvider>,
    );
  });
}

describe('Flight Plan Calendar capacity strip', () => {
  it('keeps uncertain source work visible but unscheduled and stays within capacity', () => {
    renderCalendar();
    expect(host.textContent).toContain('Sample Flight Plan capacity');
    expect(host.textContent).toContain('Seminar reflection');
    expect(host.textContent).toContain('Unscheduled until source is confirmed');
    expect(host.textContent).toContain('300 of 480 min planned');
    expect(host.textContent).not.toContain('Session · Seminar reflection');
  });

  it('adds confirmed source work to the plan without changing its source deadline', () => {
    renderCalendar();
    const button = [...host.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === 'Confirm sample source date',
    );
    act(() => button?.click());
    expect(host.textContent).toContain('360 of 480 min planned');
    expect(host.textContent).toContain('Session · Seminar reflection');
    expect(host.textContent).toContain('Source date retained · due in 3 days');
  });
});
