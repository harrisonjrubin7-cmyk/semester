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
    const plan = host.querySelector('details.flight-plan-card')!;
    expect(plan.hasAttribute('open')).toBe(false);
    expect(plan.querySelector('summary')?.textContent).toContain('Study plan');
    expect(plan.querySelector('summary')?.textContent).toContain('300 of 480 min');
    expect(plan.querySelector('summary')?.textContent).toContain('2 tasks');
    expect(plan.querySelector('summary')?.textContent).toContain('7 sessions');
    const groups = [...host.querySelectorAll('details.flight-plan-task')];
    expect(groups).toHaveLength(2);
    expect(groups[0].querySelector('summary')?.textContent).toContain('Research brief · 3 sessions · 120 min');
    expect(groups[1].querySelector('summary')?.textContent).toContain('Community project outline · 4 sessions · 180 min');
    expect(host.querySelectorAll('.flight-plan-session')).toHaveLength(7);
    expect(host.textContent).toContain('Seminar reflection');
    expect(host.textContent).toContain('1 task needs a source-date check');
    expect(host.textContent).not.toContain('Seminar reflection · 1 session');
  });

  it('adds confirmed source work to the plan without changing its source deadline', () => {
    renderCalendar();
    const button = [...host.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === 'Use syllabus date in sample plan',
    );
    act(() => button?.click());
    expect(host.querySelector('details.flight-plan-card summary')?.textContent).toContain('360 of 480 min');
    expect(host.querySelector('details.flight-plan-card summary')?.textContent).toContain('3 tasks');
    expect(host.querySelector('details.flight-plan-card summary')?.textContent).toContain('9 sessions');
    expect(host.textContent).toContain('Seminar reflection · 2 sessions · 60 min');
    expect(host.textContent).toContain('Source date retained · due in 3 days');
  });
});
