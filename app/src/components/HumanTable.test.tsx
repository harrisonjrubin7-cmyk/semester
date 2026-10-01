// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HumanTable, HumanTableOwner, RecordTable, type HumanColumn } from './HumanTable';
import { readTablePreferences } from '../lib/human-table';
const files: { name: string; body: string }[] = [];
vi.mock('../lib/deliver', () => ({ download: (file: { name: string; body: string }) => files.push(file) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
const action = vi.fn();
const rows = [
  { id: 'a', title: '=HYPERLINK("bad")', status: 'Waiting', secret: 'PRIVATE NOTE' },
  { id: 'b', title: 'Other record', status: 'Not known', secret: 'ANOTHER PRIVATE NOTE' },
];
const columns: HumanColumn<(typeof rows)[number]>[] = [
  { id: 'title', label: 'Title', value: (r) => r.title },
  { id: 'status', label: 'Status', value: (r) => r.status, persistFilterValues: ['Waiting', 'Not known'] },
  {
    id: 'action',
    label: 'Review',
    value: () => 'Review before proceeding',
    render: (r) => <button onClick={() => action(r.id)}>Review {r.id}</button>,
    summary: true,
  },
];
beforeEach(() => {
  localStorage.clear();
  files.length = 0;
  action.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});
async function mount(owner = 'student-a', shown = columns, exportAllowed = true) {
  await act(async () =>
    root.render(
      <HumanTableOwner.Provider value={owner}>
        <HumanTable
          id="records"
          label="Records"
          rows={rows}
          rowId={(r) => r.id}
          columns={shown}
          exportAllowed={exportAllowed}
          persistSearchValues={['Waiting']}
        />
      </HumanTableOwner.Provider>,
    ),
  );
}
const button = (s: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === s)!;
async function click(s: string) {
  await act(async () => button(s).click());
}
async function input(label: string, value: string) {
  const field = [...host.querySelectorAll('label')]
    .find((l) => l.textContent?.startsWith(label))!
    .querySelector('input,select') as HTMLInputElement | HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype,
      'value',
    )!.set!.call(field, value);
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
it('persists only owned criteria, restores named views, and resets immediately on an owner switch', async () => {
  await mount();
  await click('Card view');
  await input('Search Records', 'Waiting');
  await input('Status', JSON.stringify('Waiting'));
  await input('View name', 'Waiting review');
  await click('Save view');
  expect(host.querySelectorAll('article')).toHaveLength(1);
  expect(host.querySelector('article')?.getAttribute('aria-label')).toBe(rows[0].title);
  expect(host.querySelector('dl dt')?.textContent).toBe('Title');
  await click('Clear search and filters');
  expect(host.querySelectorAll('article')).toHaveLength(2);
  await click('Load Waiting review');
  expect(host.querySelectorAll('article')).toHaveLength(1);
  const stored = localStorage.getItem(localStorage.key(0)!)!;
  expect(stored).not.toMatch(/PRIVATE|secret|cells/);
  expect(JSON.parse(stored).current.search).toBe('Waiting');
  await mount('student-b');
  expect(host.querySelector('table')).not.toBeNull();
  expect((host.querySelector('input[type="search"]') as HTMLInputElement).value).toBe('');
  expect(host.textContent).not.toContain('Load Waiting review');
  await mount();
  expect(host.querySelectorAll('article')).toHaveLength(1);
  await click('Summary view');
  await click('Review a');
  expect(action).toHaveBeenCalledExactlyOnceWith('a');
});
it('exports only visible explicit values, neutralizes formulas, and never exposes removed columns', async () => {
  await mount();
  await input('Search Records', 'HYPERLINK');
  await click('Download visible rows');
  expect(files).toHaveLength(1);
  expect(files[0].name).toBe('records-working-view.csv');
  expect(files[0].body).toContain('not an official signed record');
  expect(files[0].body).toContain('"\'=HYPERLINK(""bad"")"');
  expect(files[0].body).not.toMatch(/Other record|PRIVATE|secret/);
  await mount('student-a', columns.slice(0, 1));
  await click('Card view');
  await click('Summary view');
  await click('Download visible rows');
  expect(files[1].body).not.toContain('Waiting');
  expect(host.querySelector('article')?.textContent).not.toContain('Waiting');
  expect(action).not.toHaveBeenCalled();
  await mount('student-a', columns, false);
  expect(button('Download visible rows').disabled).toBe(true);
  await click('Download visible rows');
  expect(files).toHaveLength(2);
});
it('keeps React controls functional when storage refuses a write and preserves malformed bytes', async () => {
  localStorage.setItem('semester.human-tables.v1:student-a:records', 'broken');
  await mount();
  await click('Card view');
  expect(host.querySelectorAll('article')).toHaveLength(2);
  await click('Review b');
  expect(action).toHaveBeenCalledExactlyOnceWith('b');
  expect(localStorage.getItem('semester.human-tables.v1:student-a:records')).toBe('broken');
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
});
it('drops foreign content when validating preferences', () => {
  const parsed = readTablePreferences({
    current: { view: 'cards', search: 'mine', filters: { status: 'Waiting' }, records: rows },
    saved: [{ name: 'Mine', criteria: { view: 'summary', search: '', filters: {}, cells: rows }, records: rows }],
    records: rows,
  });
  expect(JSON.stringify(parsed)).not.toMatch(/PRIVATE|records|cells/);
});

it('keeps arbitrary search and record filters in memory, including when saving a named view', async () => {
  await mount();
  await input('Search Records', 'HYPERLINK');
  await input('Title', JSON.stringify(rows[0].title));
  expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
  const key = 'semester.human-tables.v1:student-a:records';
  expect(localStorage.getItem(key)).not.toContain('HYPERLINK');
  await input('View name', 'Review later');
  await click('Save view');
  expect(localStorage.getItem(key)).not.toContain('HYPERLINK');
  await click('Load Review later');
  expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
  expect((host.querySelector('input[type="search"]') as HTMLInputElement).value).toBe('');
});
it('removes legacy disallowed current and saved values from disk before showing a different dataset', async () => {
  const key = 'semester.human-tables.v1:student-a:records';
  const old = { view: 'cards', search: 'PRIVATE DRAFT', filters: { title: 'OLD PRIVATE ROW', status: 'Waiting' } };
  localStorage.setItem(key, JSON.stringify({ current: old, saved: [{ name: 'Review', criteria: old }] }));
  await mount();
  expect(host.innerHTML).not.toMatch(/PRIVATE DRAFT|OLD PRIVATE ROW/);
  expect(localStorage.getItem(key)).not.toMatch(/PRIVATE DRAFT|OLD PRIVATE ROW/);
  expect(JSON.parse(localStorage.getItem(key)!).saved[0].criteria.filters).toEqual({ status: 'Waiting' });
  await click('Load Review');
  expect(host.querySelectorAll('article')).toHaveLength(1);
});
it('supports actual dynamic headings named constructor, toString and __proto__ through save, clear and reload', async () => {
  const ids = ['constructor', 'toString', '__proto__'];
  const render = async () =>
    act(async () =>
      root.render(
        <HumanTableOwner.Provider value="student-a">
          <RecordTable
            id="dynamic"
            label="Dynamic headings"
            columns={ids.map((id) => ({ id, label: id, persistFilterValues: ['First', 'Second'] }))}
            rows={['First', 'Second'].map((value) => ({ id: value, cells: ids.map(() => ({ value })) }))}
          />
        </HumanTableOwner.Provider>,
      ),
    );
  await render();
  expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
  for (const id of ids) {
    await input(id, JSON.stringify('First'));
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
  }
  await input('View name', 'First rows');
  await click('Save view');
  await click('Clear search and filters');
  expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
  await click('Load First rows');
  expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
  await act(async () => root.unmount());
  root = createRoot(host);
  await render();
  expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
  for (const select of host.querySelectorAll('select')) expect(select.value).toBe(JSON.stringify('First'));
  const stored = JSON.parse(localStorage.getItem('semester.human-tables.v1:student-a:dynamic')!);
  for (const id of ids) expect(Object.hasOwn(stored.current.filters, id)).toBe(true);
  await click('Clear search and filters');
  expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
});
