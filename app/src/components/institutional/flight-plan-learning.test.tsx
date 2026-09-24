// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSeed } from '../../data/seed';
import { StoreProvider } from '../../state/store';
import { FlightPlanProvider } from './FlightPlanContext';
import { FlightPlanLearning } from './FlightPlanLearning';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeAll(() => loadSeed());
const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
};

beforeEach(() => {
  values.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function renderLearning(personId = 'student-a') {
  act(() => {
    root.render(
      <StoreProvider>
        <FlightPlanProvider key={personId} tenant="northstar" role="student" personId={personId} storage={storage}>
          <FlightPlanLearning />
        </FlightPlanProvider>
      </StoreProvider>,
    );
  });
}

describe('Flight Plan learning evidence', () => {
  it('shows prerequisites and a hint before revealing an explanation', () => {
    renderLearning();
    expect(host.textContent).toContain('Prerequisite · Identify a claim');
    expect(host.textContent).not.toContain('A representative sample and transparent method');
    const hint = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Show hint');
    act(() => hint?.click());
    expect(host.textContent).toContain('Consider whose experiences are represented');
    expect(host.textContent).not.toContain('A representative sample and transparent method');
  });

  it('records only one sample evidence result for a prompt', () => {
    renderLearning();
    const choices = [...host.querySelectorAll('button')].filter((button) => button.dataset.choice);
    act(() => choices[0]?.click());
    expect(host.textContent).toContain('Sample practice evidence · correct');
    expect(host.textContent).toContain('A representative sample and transparent method');
    expect(host.querySelectorAll('[data-evidence="evidence"]')).toHaveLength(1);
    act(() => choices[1]?.click());
    expect(host.querySelectorAll('[data-evidence="evidence"]')).toHaveLength(1);
  });

  it('keeps practice evidence isolated by person context', () => {
    renderLearning('student-a');
    const first = host.querySelector<HTMLButtonElement>('button[data-choice="0"]');
    act(() => first?.click());
    expect(host.textContent).toContain('Sample practice evidence · correct');
    renderLearning('student-b');
    expect(host.textContent).not.toContain('Sample practice evidence · correct');
    expect(host.querySelector('button[data-choice="0"]')).not.toBeNull();
  });
});
