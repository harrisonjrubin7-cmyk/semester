// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useNativeWorkload } from './WorkloadAssumptionsEntry';

const deferred = vi.hoisted(() => {
  let resolve!: () => void;
  const ready = new Promise<void>(done => { resolve = done; });
  return { ready, resolve, apply: vi.fn() };
});
vi.mock('./WorkloadAssumptions', async () => {
  await deferred.ready;
  return { WorkloadAssumptions: () => <button onClick={deferred.apply}>Apply loaded draft</button> };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Pending({ scope }: { scope: string }) {
  const native = useNativeWorkload(scope);
  return <section><button onClick={() => native.edit('contract', '12')}>Stage workload</button>{native.editor}</section>;
}

it('discards pending lazy requests on owner, term, course or original-setting changes, including a return to the old context', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const initial = ['a:2026FA:course1:0', 'a:2026FA:course1:0', 'a:2026FA:course1:0', 'a:2026FA:course1:0'];
  const render = (scopes: string[]) => root.render(scopes.map((scope, i) => <Pending key={i} scope={scope} />));
  try {
    await act(async () => render(initial));
    await act(async () => host.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.click()));
    expect(host.querySelectorAll('[role="status"]')).toHaveLength(4);
    await act(async () => render(['b:2026FA:course1:0', 'a:2027SP:course1:0', 'a:2026FA:course2:0', 'a:2026FA:course1:12']));
    expect(host.querySelector('[role="status"]')).toBeNull();
    await act(async () => { deferred.resolve(); await deferred.ready; });
    expect(host.textContent).not.toContain('Apply loaded draft');
    await act(async () => render(initial));
    expect(host.textContent).not.toContain('Apply loaded draft');
    expect(deferred.apply).not.toHaveBeenCalled();
    await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
    expect(host.textContent).toContain('Apply loaded draft');
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
