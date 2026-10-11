// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { RolePolicySnapshot } from '../../lib/console/role-policy';
import { RolePolicy } from './RolePolicy';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const POLICY: RolePolicySnapshot = {
  roles: [
    { role: 'platform_admin', global: true },
    { role: 'student', global: false },
  ],
  capabilities: [
    { capability: 'console:operate', about: 'Open the operations console.' },
    { capability: 'student:self', about: 'Read the signed-in student record.' },
  ],
  assignments: [
    { role: 'platform_admin', capability: 'console:operate' },
    { role: 'student', capability: 'student:self' },
  ],
};

let host: HTMLDivElement;
let root: Root;
let read: Mock<() => Promise<RolePolicySnapshot>>;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  read = vi.fn(async () => POLICY);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function draw(filter = '', authorityKey = 'operator-a') {
  await act(async () => root.render(<RolePolicy filter={filter} authorityKey={authorityKey} read={read} />));
  await act(async () => {});
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('Roles & capabilities workspace', () => {
  it('announces loading without showing stale policy', async () => {
    read.mockImplementation(() => new Promise(() => {}));
    await draw();
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(host.textContent).toContain('Loading roles and capabilities…');
    expect(host.textContent).not.toContain('platform_admin');
  });

  it('renders responsive server truth and all non-authoritative Copy 7 proposals', async () => {
    await draw();
    expect(host.querySelectorAll('table.table-stack')).toHaveLength(3);
    expect(host.textContent).toContain('platform_admin');
    expect(host.textContent).toContain('console:operate');
    expect(host.textContent).toContain('Open the operations console.');
    expect(host.textContent).toContain('51 design and governance proposals');
    expect(host.textContent).toContain('Exact identifier match · not activation evidence');
    expect(host.textContent).toContain('Table membership is vocabulary and policy, not a user’s active grants.');
    expect(host.textContent).toContain('Copy 7 proposals are non-authoritative');
    expect(host.textContent).toContain('identical to the Copy 5 role dataset');
    expect(host.querySelectorAll('button')).toHaveLength(0);
  });

  it('fails closed and offers a keyboard-operable retry that reads fresh data', async () => {
    read.mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce(POLICY);
    await draw();
    expect(host.getAttribute('aria-busy')).toBeNull();
    expect(host.textContent).toContain('Role policy could not be loaded');
    expect(host.textContent).not.toContain('platform_admin');
    const retry = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Try again') as HTMLButtonElement;
    expect(retry.type).toBe('button');
    await act(async () => retry.click());
    await act(async () => {});
    expect(read).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('platform_admin');
  });

  it('explains a successful empty server snapshot without hiding the proposals', async () => {
    read.mockResolvedValue({ roles: [], capabilities: [], assignments: [] });
    await draw();
    expect(host.textContent).toContain('No server role policy rows');
    expect(host.textContent).toContain('No authoritative role or capability rows were returned.');
    expect(host.textContent).toContain('Semester support operator');
  });

  it('applies the Console filter to server truth and Copy 7 proposals', async () => {
    await draw('platform_admin');
    expect(host.textContent).toContain('platform_admin');
    expect(host.textContent).toContain('Semester security operator');
    expect(host.textContent).not.toContain('student:self');
    expect(host.textContent).not.toContain('Academic advisor');
  });

  it('ignores a stale result after the authority key changes accounts', async () => {
    const first = deferred<RolePolicySnapshot>();
    const second = deferred<RolePolicySnapshot>();
    read.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await act(async () => root.render(<RolePolicy filter="" authorityKey="operator-a" read={read} />));
    await act(async () => root.render(<RolePolicy filter="" authorityKey="operator-b" read={read} />));
    second.resolve({
      roles: [{ role: 'second_operator', global: true }],
      capabilities: [{ capability: 'second:read', about: 'Second account policy.' }],
      assignments: [{ role: 'second_operator', capability: 'second:read' }],
    });
    await act(async () => {});
    first.resolve({
      roles: [{ role: 'stale_operator', global: true }],
      capabilities: [{ capability: 'stale:read', about: 'Stale account policy.' }],
      assignments: [{ role: 'stale_operator', capability: 'stale:read' }],
    });
    await act(async () => {});
    expect(host.textContent).toContain('second_operator');
    expect(host.textContent).not.toContain('stale_operator');
  });
});
