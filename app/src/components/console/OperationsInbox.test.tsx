// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type {
  OperationsWorkItem,
  OperationsWorkItemEnvelope,
  OperationsWorkItemTransition,
} from '../../lib/console/client';
import { OperationsInbox } from './OperationsInbox';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const workItem = (patch: Partial<OperationsWorkItem> = {}): OperationsWorkItem => ({
  id: '11111111-1111-4111-8111-111111111111',
  tenantId: 'vu',
  kind: 'registration_readiness.referral',
  subject: { type: 'registration_readiness', id: 'evaluation-1' },
  sourceRef: 'registration-readiness-task:task-1',
  purpose: 'Resolve the authoritative mismatch.',
  priority: 'high',
  state: 'open',
  version: 1,
  createdAt: '2026-10-10T01:00:00Z',
  updatedAt: '2026-10-10T02:00:00Z',
  assignedToMe: false,
  resolution: null,
  allowedActions: ['claim'],
  history: [{ action: 'opened', version: 1, occurredAt: '2026-10-10T01:00:00Z', byMe: false, reason: null, resolution: null }],
  ...patch,
});

const envelope = <T,>(data: T): OperationsWorkItemEnvelope<T> => ({
  data,
  generatedAt: '2026-10-10T02:01:00Z',
  authority: 'authoritative',
  warnings: [],
  requestId: '22222222-2222-4222-8222-222222222222',
});

let host: HTMLDivElement;
let root: Root;
let status: Mock<(said: string) => void>;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  status = vi.fn<(said: string) => void>();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const button = (name: string) => [...host.querySelectorAll('button')].find((value) => value.textContent?.includes(name));

async function draw(
  readList: (mine?: boolean) => Promise<OperationsWorkItemEnvelope<OperationsWorkItem[]>>,
  readDetail: (id: string) => Promise<OperationsWorkItemEnvelope<OperationsWorkItem>> = async () => envelope(workItem()),
  transition: (input: OperationsWorkItemTransition) => Promise<OperationsWorkItemEnvelope<OperationsWorkItem>> = async () => envelope(workItem()),
  privileged: (run: () => Promise<void>) => void = (run) => void run(),
) {
  await act(async () => {
    root.render(
      <OperationsInbox
        env="Production"
        scope="All"
        filter=""
        onStatus={status}
        privileged={privileged}
        readList={readList}
        readDetail={readDetail}
        transition={transition}
      />,
    );
  });
  await act(async () => {});
}

describe('operations inbox workspace', () => {
  it('reads list and detail explicitly, renders history, and claims through the privileged gate', async () => {
    const readList = vi.fn(async () => envelope([workItem()]));
    const readDetail = vi.fn(async () => envelope(workItem()));
    const transition = vi.fn(async () => envelope(workItem({
      state: 'claimed', version: 2, assignedToMe: true, allowedActions: ['resolve'],
    })));
    let approved: (() => Promise<void>) | undefined;
    const privileged = vi.fn((run: () => Promise<void>) => { approved = run; });

    await draw(readList, readDetail, transition, privileged);
    expect(host.textContent).toContain('Resolve the authoritative mismatch.');
    expect(host.querySelector('[aria-label="Work-item list"]')?.parentElement?.style.gridTemplateColumns)
      .toContain('auto-fit');

    await act(async () => button('Resolve the authoritative mismatch.')?.click());
    expect(readDetail).toHaveBeenCalledWith(workItem().id);
    expect(host.textContent).toContain('v1 · opened');
    expect(host.textContent).toContain('Authorityauthoritative');

    await act(async () => button('Claim work item')?.click());
    expect(privileged).toHaveBeenCalledOnce();
    expect(transition).not.toHaveBeenCalled();
    await act(async () => { await approved?.(); });
    expect(transition).toHaveBeenCalledWith({ itemId: workItem().id, action: 'claim', version: 1 });
  });

  it('clears detail when the shared filter or tenant scope excludes the selected item', async () => {
    const readList = vi.fn(async () => envelope([workItem()]));
    const readDetail = vi.fn(async () => envelope(workItem()));
    const transition = vi.fn(async () => envelope(workItem()));

    await act(async () => {
      root.render(
        <OperationsInbox
          env="Production" scope="All" filter="" onStatus={status}
          privileged={(run) => void run()}
          readList={readList} readDetail={readDetail} transition={transition}
        />,
      );
    });
    await act(async () => {});
    await act(async () => button('Resolve the authoritative mismatch.')?.click());
    expect(host.textContent).toContain('Authorityauthoritative');

    await act(async () => {
      root.render(
        <OperationsInbox
          env="Production" scope="other" filter="does-not-match" onStatus={status}
          privileged={(run) => void run()}
          readList={readList} readDetail={readDetail} transition={transition}
        />,
      );
    });
    await act(async () => {});
    expect(host.textContent).not.toContain('Authorityauthoritative');
    expect(host.textContent).toContain('No work items are available in this grant scope.');
  });

  it('switches to My Work with a server read rather than a client-only filter', async () => {
    const readList = vi.fn(async () => envelope([] as OperationsWorkItem[]));
    await draw(readList);
    await act(async () => button('My work')?.click());
    expect(readList).toHaveBeenLastCalledWith(true);
    expect(host.textContent).toContain('No work is assigned to you.');
  });

  it('shows truthful denied and unavailable states without records', async () => {
    await draw(async () => { throw new Error('console:operate at platform scope is required.'); });
    expect(host.textContent).toContain('Operations inbox unavailable');
    expect(host.textContent).toContain('No work items are shown.');
    expect(status).toHaveBeenCalledWith('console:operate at platform scope is required.');

    await draw(
      async () => envelope([workItem()]),
      async () => { throw new Error('The work item is unavailable in this grant scope.'); },
    );
    await act(async () => button('Resolve the authoritative mismatch.')?.click());
    expect(host.textContent).toContain('Work item unavailable');
    expect(host.textContent).toContain('intentionally indistinguishable');
  });

  it('surfaces a CAS conflict and offers an authoritative reload', async () => {
    await draw(
      async () => envelope([workItem()]),
      async () => envelope(workItem()),
      async () => { throw new Error('Work item changed; reload the authoritative version.'); },
    );
    await act(async () => button('Resolve the authoritative mismatch.')?.click());
    await act(async () => button('Claim work item')?.click());
    expect(host.textContent).toContain('This work item changed.');
    expect(button('Reload authoritative version')).toBeDefined();
  });
});

