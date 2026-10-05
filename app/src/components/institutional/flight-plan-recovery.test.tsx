// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSeed } from '../../data/seed';
import { StoreProvider } from '../../state/store';
import { FlightPlanProvider } from './FlightPlanContext';
import { FlightPlanRecovery } from './FlightPlanRecovery';

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

function renderRecovery() {
  act(() => {
    root.render(
      <StoreProvider>
        <FlightPlanProvider tenant="northstar" role="student" personId="student-a" storage={storage}>
          <FlightPlanRecovery />
        </FlightPlanProvider>
      </StoreProvider>,
    );
  });
}

describe('Flight Plan recovery', () => {
  for (const [label, receipt] of [
    ['Reschedule my plan', 'Rescheduled missed work'],
    ['Reduce my estimate', 'Reduced personal work estimate'],
    ['Prepare help request', 'Drafted help request'],
    ['Prepare office-hours note', 'Added office-hours preparation'],
  ]) {
    it(`${label.toLowerCase()} keeps the source deadline unchanged`, () => {
      renderRecovery();
      const button = [...host.querySelectorAll('button')].find((candidate) => candidate.textContent === label);
      act(() => button?.click());
      expect(host.textContent).toContain(receipt);
      expect(host.textContent).toContain('Source deadline unchanged · due in 1 day');
      expect(host.textContent).toContain('Nothing was sent or booked');
    });
  }
});
