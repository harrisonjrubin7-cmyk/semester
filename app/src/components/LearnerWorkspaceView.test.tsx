// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LearnerWorkspaceView, type ReadyData, type WorkspaceState } from './LearnerWorkspaceView';

/**
 * The learner's "Your semester" view is a controlled projection: these tests
 * hold it to what the parent is allowed to show, and to the source and
 * freshness every connected item must carry.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));

const source = { label: 'Registrar', observedAt: '2026-10-20T14:00:00Z', freshness: 'current' as const };

const ready: ReadyData = {
  contextKey: 'school:a|term:2026FA',
  termLabel: 'Fall 2026',
  contextLabel: 'Northfield University',
  connectionMessage: 'Connected to the registrar.',
  actions: [
    {
      id: 'a1',
      title: 'Confirm your schedule',
      explanation: 'Check the courses you chose.',
      dueLabel: 'Oct 30',
      source,
      canOpen: true,
      blockedReason: null,
    },
    {
      id: 'a2',
      title: 'Clear the hold',
      explanation: 'A hold blocks registration.',
      dueLabel: null,
      source: { label: 'Student accounts', observedAt: null, freshness: 'unknown' },
      canOpen: false,
      blockedReason: 'Waiting for the account office.',
    },
  ],
  courses: [
    { id: 'c1', label: 'ECON 1020', relationship: 'planned', source },
    { id: 'c2', label: 'HIST 2100', relationship: 'enrolled', source },
  ],
};

function render(state: WorkspaceState, activeContextKey = ready.contextKey) {
  const handlers = {
    onRetry: vi.fn(),
    onCreatePlan: vi.fn(),
    onOpenAction: vi.fn(),
    onOpenCourse: vi.fn(),
  };
  act(() => {
    root.render(<LearnerWorkspaceView activeContextKey={activeContextKey} state={state} {...handlers} />);
  });
  return handlers;
}

it('shows nothing from a previous context while the new context loads', () => {
  render({ status: 'ready', data: ready }, 'school:b|term:2026FA');

  expect(host.textContent).toContain('Loading this workspace');
  expect(host.textContent).not.toContain('Confirm your schedule');
  expect(host.textContent).not.toContain('ECON 1020');
});

it('renders no restricted content when access is forbidden', () => {
  render({ status: 'forbidden', message: 'Your access to this workspace has ended.' });

  expect(host.textContent).toContain('Your access to this workspace has ended.');
  expect(host.textContent).toContain('No restricted workspace content is shown.');
  expect(host.textContent).not.toContain('Confirm your schedule');
  expect(host.textContent).not.toContain('ECON 1020');
  expect(button(/Try again/)).toBeUndefined();
});

it('offers retry on error and calls it', () => {
  const { onRetry } = render({ status: 'error', message: 'The registrar did not answer.' });

  expect(host.textContent).toContain('The registrar did not answer.');
  button(/Try again/)!.click();

  expect(onRetry).toHaveBeenCalledTimes(1);
});

it('does not claim institutional completion when nothing was returned', () => {
  render({ status: 'ready', data: { ...ready, actions: [], courses: [] } });

  expect(host.textContent).toContain('No actions were returned for this workspace.');
  expect(host.textContent).toContain('No courses were returned.');
  expect(host.textContent).not.toMatch(/complete|all done|nothing to do/i);
});

it('does not invoke the callback for a disabled action', () => {
  const { onOpenAction } = render({ status: 'ready', data: ready });

  const blocked = button(/Review Clear the hold/)!;
  expect(blocked.disabled).toBe(true);
  blocked.click();

  expect(onOpenAction).not.toHaveBeenCalled();
});

it('opens an available action by its id', () => {
  const { onOpenAction } = render({ status: 'ready', data: ready });

  button(/Review Confirm your schedule/)!.click();

  expect(onOpenAction).toHaveBeenCalledWith('a1');
});

it('labels a planned course as planned, never as enrolled', () => {
  render({ status: 'ready', data: ready });

  const planned = [...host.querySelectorAll('li')].find((li) => li.textContent?.includes('ECON 1020'))!;
  expect(planned.textContent).toContain('Relationship: Planned');
  expect(planned.textContent).not.toContain('Enrolled');
});

it('shows the source and freshness of every connected item, including unknown check times', () => {
  render({ status: 'ready', data: ready });

  const lines = [...host.querySelectorAll('.sharing-meta')].map((p) => p.textContent ?? '');
  const sourced = lines.filter((line) => line.startsWith('Source:'));

  // Two actions and two courses, each with its own source line.
  expect(sourced).toHaveLength(4);
  for (const line of sourced) {
    expect(line).toMatch(/Freshness: (current|stale|unknown)/);
  }
  expect(sourced.some((line) => line.includes('Check time unavailable'))).toBe(true);
});

it('keeps the create-plan action available even with no courses', () => {
  const { onCreatePlan } = render({ status: 'ready', data: { ...ready, courses: [] } });

  button(/Create a personal plan/)!.click();

  expect(onCreatePlan).toHaveBeenCalledTimes(1);
});
