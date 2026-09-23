// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StoreProvider } from '../../state/store';
import { updateTask } from '../../lib/flight-plan';
import { FlightPlanProvider, useFlightPlan } from './FlightPlanContext';
import { FlightPlanInbox } from './FlightPlanInbox';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
};

function PrepareDraft() {
  const { workspace, updateWorkspace } = useFlightPlan();
  return (
    <button type="button" onClick={() => updateWorkspace((current) => updateTask(current, workspace.tasks[2].id, 'help'))}>
      Prepare
    </button>
  );
}

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

function renderInbox(personId: string, prepare = false) {
  act(() => {
    root.render(
      <StoreProvider>
        <FlightPlanProvider key={personId} tenant="northstar" role="student" personId={personId} storage={storage}>
          {prepare && <PrepareDraft />}
          <FlightPlanInbox />
        </FlightPlanProvider>
      </StoreProvider>,
    );
  });
}

describe('prepared Flight Plan drafts', () => {
  it('shows an unsent draft only in its originating person context', () => {
    renderInbox('student-a', true);
    act(() => host.querySelector<HTMLButtonElement>('button')?.click());
    expect(host.textContent).toContain('Help with Evidence & sampling practice');
    expect(host.textContent).toContain('Prepared locally · unsent');
    renderInbox('student-b');
    expect(host.textContent).not.toContain('Help with Evidence & sampling practice');
  });
});
