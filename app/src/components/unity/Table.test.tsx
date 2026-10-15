// @vitest-environment jsdom
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TABLET_AT } from '../../lib/media';
import { Table, type Column, type SortState } from './Table';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Row {
  id: string;
  name: string;
  score: number | null;
}
const ROWS: Row[] = [
  { id: 'a', name: 'Problem set 1', score: 9 },
  { id: 'b', name: 'Midterm', score: 71 },
  { id: 'c', name: 'Problem set 2', score: null },
];
const COLUMNS: Column<Row>[] = [
  { id: 'name', header: 'Item', cell: (r) => r.name, rowHeader: true, sortable: true },
  { id: 'score', header: 'Score', cell: (r) => (r.score === null ? '—' : String(r.score)), numeric: true, sortable: true },
  { id: 'act', header: 'Action', cell: (r) => <button type="button">Ask about {r.name}</button> },
];

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const draw = (node: React.ReactNode) => act(() => root.render(node));
const empty = <p data-empty>No grades yet.</p>;

describe('Table', () => {
  it('is a real table: caption, column headers with scope, and a row header', () => {
    draw(<Table caption="Released grades" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} empty={empty} />);
    expect(host.querySelector('caption')?.textContent).toBe('Released grades');
    expect([...host.querySelectorAll('thead th')].map((th) => th.getAttribute('scope'))).toEqual(['col', 'col', 'col']);
    const first = host.querySelector('tbody tr')!;
    expect(first.querySelector('th')?.getAttribute('scope')).toBe('row');
    expect(first.querySelector('th')?.textContent).toBe('Problem set 1');
    expect(first.querySelectorAll('td')).toHaveLength(2);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('draws the empty content and no table when there are no rows', () => {
    draw(<Table caption="Released grades" columns={COLUMNS} rows={[]} rowKey={(r) => r.id} empty={empty} />);
    expect(host.querySelector('[data-empty]')).not.toBeNull();
    expect(host.querySelector('table')).toBeNull();
  });

  it('keeps the caption as the name even when it is not drawn', () => {
    draw(<Table caption="Released grades" captionHidden columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} empty={empty} />);
    expect(host.querySelector('caption')?.className).toBe('sr-only');
  });

  it('right-aligns numbers in header and cell alike', () => {
    draw(<Table caption="c" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} empty={empty} />);
    expect(host.querySelectorAll('[data-numeric]')).toHaveLength(1 + ROWS.length);
  });
});

describe('Table sorting', () => {
  function Sortable({ announce }: { announce: (s: string) => void }) {
    const [sort, setSort] = useState<SortState | null>(null);
    const rows = [...ROWS].sort((a, b) => {
      if (!sort) return 0;
      const d = sort.dir === 'ascending' ? 1 : -1;
      return sort.id === 'name' ? a.name.localeCompare(b.name) * d : ((a.score ?? -1) - (b.score ?? -1)) * d;
    });
    return (
      <Table
        caption="Released grades"
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        sort={sort}
        empty={empty}
        onSort={(id) => {
          const dir = sort?.id === id && sort.dir === 'ascending' ? 'descending' : 'ascending';
          setSort({ id, dir });
          announce(`Sorted by ${id}, ${dir}`);
        }}
      />
    );
  }
  const header = (name: string) => [...host.querySelectorAll('thead th')].find((th) => th.textContent?.includes(name))!;

  it('marks only sortable columns, all unsorted to begin with', () => {
    draw(<Sortable announce={() => {}} />);
    expect(header('Item').getAttribute('aria-sort')).toBe('none');
    expect(header('Score').getAttribute('aria-sort')).toBe('none');
    expect(header('Action').hasAttribute('aria-sort')).toBe(false);
    expect(header('Action').querySelector('button')).toBeNull();
  });

  it('reports the request and shows the order it is given, one column at a time', () => {
    const announce = vi.fn();
    draw(<Sortable announce={announce} />);
    act(() => header('Score').querySelector('button')!.click());
    expect(header('Score').getAttribute('aria-sort')).toBe('ascending');
    expect([...host.querySelectorAll('tbody th')].map((th) => th.textContent)).toEqual(['Problem set 2', 'Problem set 1', 'Midterm']);
    act(() => header('Score').querySelector('button')!.click());
    expect(header('Score').getAttribute('aria-sort')).toBe('descending');
    expect([...host.querySelectorAll('tbody th')].map((th) => th.textContent)).toEqual(['Midterm', 'Problem set 1', 'Problem set 2']);
    act(() => header('Item').querySelector('button')!.click());
    // Sorting by another column un-sorts the first: only one column carries a direction.
    expect(header('Score').getAttribute('aria-sort')).toBe('none');
    expect(header('Item').getAttribute('aria-sort')).toBe('ascending');
    expect(announce).toHaveBeenLastCalledWith('Sorted by name, ascending');
  });

  it('does not reorder rows itself', () => {
    draw(<Table caption="c" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} sort={{ id: 'score', dir: 'descending' }} onSort={() => {}} empty={empty} />);
    expect([...host.querySelectorAll('tbody th')].map((th) => th.textContent)).toEqual(['Problem set 1', 'Midterm', 'Problem set 2']);
  });

  it('draws a plain header, not a dead button, when no handler is given', () => {
    draw(<Table caption="c" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} empty={empty} />);
    expect(host.querySelectorAll('thead button')).toHaveLength(0);
  });
});

describe('Table at a phone width', () => {
  it('scrolls inside a named, focusable region, with every column still there', () => {
    draw(<Table caption="Released grades" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} empty={empty} />);
    const region = host.querySelector('.integration-table-wrap')!;
    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('aria-label')).toBe('Released grades');
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(host.querySelectorAll('thead th')).toHaveLength(COLUMNS.length);
  });

  it('stacks: every cell keeps its column label and its table roles', () => {
    draw(<Table caption="Released grades" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} compact="stack" empty={empty} />);
    expect(host.querySelector('.integration-table-wrap')).toBeNull();
    const table = host.querySelector('table')!;
    expect(table.className).toContain('table-stack');
    expect(table.getAttribute('role')).toBe('table');
    const row = host.querySelector('tbody tr')!;
    expect(row.getAttribute('role')).toBe('row');
    expect([...row.children].map((c) => [c.getAttribute('role'), c.getAttribute('data-label')])).toEqual([
      ['rowheader', 'Item'],
      ['cell', 'Score'],
      ['cell', 'Action'],
    ]);
    // Nothing is dropped: the same number of cells as columns, on every row.
    for (const tr of host.querySelectorAll('tbody tr')) expect(tr.children).toHaveLength(COLUMNS.length);
  });
});

describe('Table accessibility (axe)', () => {
  async function violations() {
    // jsdom has no layout; the colour-contrast rule needs it and is covered by the contrast sweep.
    const r = await axe.run(host, { rules: { 'color-contrast': { enabled: false } }, resultTypes: ['violations'] });
    return r.violations.map((v) => `${v.id}: ${v.help}`);
  }
  it('is not vacuous: the same probe flags a button with no name', async () => {
    draw(<button type="button" />);
    expect(await violations()).not.toEqual([]);
  });
  it('has none in scroll mode', async () => {
    draw(<Table caption="Released grades" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} sort={{ id: 'score', dir: 'ascending' }} onSort={() => {}} empty={empty} />);
    expect(await violations()).toEqual([]);
  });
  it('has none in stack mode', async () => {
    draw(<Table caption="Released grades" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} compact="stack" empty={empty} />);
    expect(await violations()).toEqual([]);
  });
});

describe('Table stylesheet', () => {
  // jsdom has no layout, so what the stacked table looks like is held by reading the rule.
  const css = readFileSync(join(__dirname, '..', '..', 'styles', 'app.css'), 'utf8');
  const stackBlock = () => {
    const start = css.indexOf(`@media (max-width: ${TABLET_AT - 1}px) {\n  .table-stack thead`);
    expect(start, 'the stacked rules sit in the phone/tablet media query').toBeGreaterThan(-1);
    return css.slice(start, css.indexOf('\n}\n', start));
  };

  it('stacks only under the tablet edge', () => {
    expect(stackBlock()).toContain('.table-stack tr');
  });

  it('keeps the caption full width — a table-caption in a block table shrinks to a sliver', () => {
    expect(stackBlock()).toMatch(/\.table-stack caption\s*\{\s*display:\s*block;/);
  });

  it('keeps the header row for assistive technology rather than removing it', () => {
    const block = stackBlock();
    expect(block).toMatch(/\.table-stack thead\s*\{[^}]*clip: rect\(0, 0, 0, 0\)/);
    expect(block).not.toMatch(/\.table-stack thead\s*\{[^}]*display:\s*none/);
  });
});
