// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../state/store', () => ({ useStore: () => ({ state: { shell: 'plain' } }) }));
import { ControlPlane } from './ControlPlane';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('ControlPlane', () => {
  it('shows every institutional control area and keeps preview changes staged', () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() => root.render(<ControlPlane input={{
      tenantId: 'northstar', viewedTenantId: 'northstar', previewRole: 'admin', featureState: 'preview',
      gatewayStatus: 'sandbox tested', verifiedCapabilities: [], approvedSourceCount: 2,
      activeConsentCount: 1, auditEventCount: 4,
    }} />));
    for (const heading of ['Identity', 'Roles', 'Integrations', 'Intelligence', 'Sources', 'Data governance', 'Audit', 'Accessibility', 'Outcomes', 'Support']) {
      expect(host.textContent).toContain(heading);
    }
    expect(host.textContent).toContain('Preview persona does not grant authorization');
    const stage = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Stage local policy change')!;
    act(() => stage.click());
    expect(host.querySelector('[role="status"]')?.textContent).toContain('staged locally');
    expect(host.textContent).not.toContain('production receipt created');
  });
});
