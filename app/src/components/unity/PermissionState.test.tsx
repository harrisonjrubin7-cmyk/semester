// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionState } from './States';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('PermissionState', () => {
  it('names the boundary, its authority and the one safe recovery action', () => {
    const run = vi.fn();
    act(() =>
      root.render(
        <PermissionState
          title="You can’t see this record."
          body="Nothing about the protected record is shown."
          owner="your school’s registrar"
          recover={{ label: 'Request access', run }}
        />,
      ),
    );

    const state = host.querySelector('[data-state="permission-denied"]');
    expect(state?.getAttribute('role')).toBe('status');
    expect(state?.getAttribute('aria-label')).toBe('You can’t see this record.');
    expect(state?.textContent).toContain('Access is controlled by your school’s registrar.');
    act(() => host.querySelector<HTMLButtonElement>('button')!.click());
    expect(run).toHaveBeenCalledOnce();
  });

  it('does not invent an action when no governed recovery exists', () => {
    act(() =>
      root.render(<PermissionState title="This area is unavailable." body="No protected details are shown." owner="your school" />),
    );

    expect(host.querySelector('button')).toBeNull();
  });
});
