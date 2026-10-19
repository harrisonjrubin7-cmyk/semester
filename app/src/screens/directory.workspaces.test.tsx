// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  account: { id: 'account-a' } as { id: string } | null,
  school: { id: 'school-a' },
  state: { role: 'student' },
  dispatch: vi.fn(),
  rpc: vi.fn(),
  teaching: true,
}));

// Only the course-studio flag is switched; every other module flag keeps its real value.
vi.mock('../lib/experience-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/experience-flags')>();
  return {
    ...actual,
    MODULE_FLAGS: { ...actual.MODULE_FLAGS, course_studio: 'course-studio-test' },
    moduleOn: (state: unknown) =>
      state === 'course-studio-test' ? mock.teaching : actual.moduleOn(state as Parameters<typeof actual.moduleOn>[0]),
  };
});

vi.mock('../state/store', () => ({
  useStore: () => ({ account: mock.account, school: mock.school, state: mock.state, dispatch: mock.dispatch }),
}));
vi.mock('../lib/cloud', () => ({
  cloudConfigured: true,
  cloud: async () => ({
    auth: { getUser: async () => ({ data: { user: mock.account ? { id: mock.account.id } : null } }) },
    rpc: mock.rpc,
  }),
}));

const directory = await import('./Directory');
type WorkspaceEntryProps = {
  placement?: 'directory' | 'navigation';
  onNavigate?: () => void;
};
const WorkspaceEntry = (
  directory as typeof directory & { WorkspaceEntry?: React.ComponentType<WorkspaceEntryProps> }
).WorkspaceEntry;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  mock.account = { id: 'account-a' };
  mock.school = { id: 'school-a' };
  mock.state = { role: 'student' };
  mock.teaching = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const buttons = () => [...host.querySelectorAll('button')].map((button) => button.textContent ?? '').join('\n');

describe('connected workspace visibility', () => {
  it('exports the shared Workspace entry', () => {
    expect(typeof WorkspaceEntry).toBe('function');
  });

  it('offers Operations and external listings only from matching live grants', async () => {
    if (!WorkspaceEntry) return;
    mock.rpc.mockResolvedValue({
      data: [
        { capability: 'console:operate', scope_kind: 'platform', scope_id: '' },
        { capability: 'opportunity:publish', scope_kind: 'school', scope_id: 'school-a' },
      ],
      error: null,
    });
    await act(async () => root.render(<WorkspaceEntry />));
    expect(buttons()).toContain('Semester Operations');
    expect(buttons()).toContain('External listings');

    const operations = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Semester Operations'))!;
    const listings = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('External listings'))!;
    expect(listings.textContent).toContain('external listing drafts');
    act(() => operations.click());
    expect(mock.dispatch).toHaveBeenCalledWith({ type: 'go', screen: 'console' });
    act(() => listings.click());
    expect(mock.dispatch).toHaveBeenCalledWith({ type: 'openWorkspace', screen: 'university', view: 'drafts' });
  });

  it('renders the same allowlisted destinations as compact persistent navigation', async () => {
    if (!WorkspaceEntry) return;
    mock.rpc.mockResolvedValue({
      data: [{ capability: 'opportunity:moderate', scope_kind: 'school', scope_id: 'school-a' }],
      error: null,
    });
    const onNavigate = vi.fn();

    await act(async () => root.render(<WorkspaceEntry placement="navigation" onNavigate={onNavigate} />));

    const group = host.querySelector('[role="group"][aria-label="Workspaces"]');
    expect(group).not.toBeNull();
    expect(buttons()).toContain('Teaching');
    expect(buttons()).toContain('University services');
    expect(buttons()).toContain('External listings');
    expect(buttons()).not.toMatch(/Company|Investor|Developer/);

    const teaching = [...group!.querySelectorAll('button')].find((button) => button.textContent?.includes('Teaching'))!;
    act(() => teaching.click());
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(mock.dispatch).toHaveBeenCalledWith({ type: 'openWorkspace', screen: 'account', view: 'course-studio' });
  });

  it('offers no Teaching destination while the course studio module is off', async () => {
    if (!WorkspaceEntry) return;
    mock.teaching = false;
    mock.rpc.mockResolvedValue({ data: [], error: null });

    await act(async () => root.render(<WorkspaceEntry placement="navigation" />));

    expect(buttons()).not.toContain('Teaching');
    expect(buttons()).toContain('University services');
  });

  it('does not broaden a school-scoped console grant or another school’s listing grant', async () => {
    if (!WorkspaceEntry) return;
    mock.rpc.mockResolvedValue({
      data: [
        { capability: 'console:operate', scope_kind: 'school', scope_id: 'school-a' },
        { capability: 'opportunity:moderate', scope_kind: 'school', scope_id: 'school-b' },
      ],
      error: null,
    });
    await act(async () => root.render(<WorkspaceEntry />));
    expect(buttons()).not.toContain('Semester Operations');
    expect(buttons()).not.toContain('External listings');
    expect(host.textContent).toContain('No additional connected workspace was found');
  });

  it('reports a failed discovery with an explicit retry instead of an empty-access claim', async () => {
    if (!WorkspaceEntry) return;
    mock.rpc.mockRejectedValue(new Error('offline'));
    await act(async () => root.render(<WorkspaceEntry />));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Could not check connected access.');
    expect(buttons()).toContain('Try again');
    expect(host.textContent).not.toContain('No additional connected workspace was found');
  });
});
