// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, type ReadEnvelope } from '../../lib/read/envelope';
import { ReadState } from './ReadState';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.parse('2026-10-04T12:00:00Z');
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

const make = (over: Partial<ReadEnvelope<string[]>>) =>
  envelope<string[]>({
    state: 'connected',
    authority: 'derived',
    source: { id: 't', label: 'T', kind: 'estimated' },
    data: ['one', 'two'],
    observedAt: new Date(NOW - 1000).toISOString(),
    ...over,
  });

function draw(env: ReadEnvelope<string[]>, onRecover?: (a: string) => void) {
  act(() =>
    root.render(
      <ReadState env={env} now={NOW} what="your reminders" empty={{ title: 'Nothing.', body: 'Check later.' }} onRecover={onRecover}>
        {(d) => <ul>{d.map((x) => <li key={x}>{x}</li>)}</ul>}
      </ReadState>,
    ),
  );
}

describe('ReadState', () => {
  it('content: data and a source badge in words', () => {
    draw(make({}));
    expect([...host.querySelectorAll('li')].map((l) => l.textContent)).toEqual(['one', 'two']);
    expect(host.querySelector('[data-source="estimated"]')?.textContent).toMatch(/Estimated/);
  });

  it('loading: announces itself and draws no data', () => {
    draw(make({ state: 'loading', data: null }));
    expect(host.querySelector('[role="status"]')?.textContent).toMatch(/Loading your reminders/);
    expect(host.querySelector('li')).toBeNull();
  });

  it('empty: says why and carries the envelope’s limitations', () => {
    draw(make({ state: 'empty', data: null, limitations: ['You put everything away for today.'] }));
    expect(host.textContent).toContain('Nothing.');
    expect(host.textContent).toContain('You put everything away');
  });

  it('denied: names the boundary and leaks no data, even if the server sent some', () => {
    draw(make({ permission: { canRead: false, allowedActions: [] }, data: ['secret'] }));
    expect(host.textContent).toContain('You can’t see your reminders here.');
    expect(host.textContent).not.toContain('secret');
  });

  it('offline: keeps the list beside a strip', () => {
    draw(make({ state: 'offline' }));
    expect(host.textContent).toContain('You are offline.');
    expect(host.querySelectorAll('li')).toHaveLength(2);
  });

  it('stale: keeps the list and says it may be out of date', () => {
    draw(make({ staleAfter: new Date(NOW - 1).toISOString() }));
    expect(host.textContent).toContain('may be out of date');
    expect(host.querySelectorAll('li')).toHaveLength(2);
  });

  it('failed: alerts, shows the reference and runs the recovery', () => {
    const run = vi.fn();
    draw(make({ state: 'error', data: null, recovery: [{ action: 'retry', label: 'Try again' }], supportReference: 'REF-1' }), run);
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.textContent).toContain('REF-1');
    act(() => host.querySelector<HTMLButtonElement>('button')!.click());
    expect(run).toHaveBeenCalledWith('retry');
  });

  it('pending: says nothing is final', () => {
    draw(make({ state: 'pending_approval' }));
    expect(host.textContent).toContain('waiting for approval');
  });

  it('an unknown state fails closed to a notice, not content', () => {
    draw(make({ state: 'whatever' as never, data: null }));
    expect(host.textContent).toContain('only partly available');
    expect(host.querySelector('li')).toBeNull();
  });
});
