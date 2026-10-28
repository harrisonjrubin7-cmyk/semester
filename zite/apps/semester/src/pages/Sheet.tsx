import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { toolkit } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { PageHeader, Panel, Empty, Loadable, useLoad, errMsg } from '../components/kit';
import { blankGrid, evaluate, show, isErr, colName, ref, toCsv, fromCsv, toXlsx, MAX_ROWS, MAX_COLS, type Grid } from '../lib/sheetRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const save = (name: string, blob: Blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
const fileName = (t: string) => (t.trim() || 'sheet').replace(/[^\w\- ]+/g, '').slice(0, 60);
const FNS = 'SUM, AVERAGE, MIN, MAX, COUNT, MEDIAN, STDEV, ROUND, ABS, SQRT, IF';

export default function Sheet() {
  const state = useLoad(() => toolkit({ action: 'list', kind: 'sheet' } as never) as Promise<any>, []);
  const [open, setOpen] = useState<{ id: number | null; version: number } | null>(null);
  const [title, setTitle] = useState('');
  const [grid, setGrid] = useState<Grid>(blankGrid());
  const [at, setAt] = useState({ r: 0, c: 0 });
  const [edit, setEdit] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const vals = useMemo(() => evaluate(grid), [grid]);
  const cellRefs = useRef<Record<string, HTMLTableCellElement | null>>({});

  const start = (d: any | null) => { setOpen(d ? { id: d.id, version: d.version } : { id: null, version: 0 }); setGrid(d?.data?.grid ?? blankGrid()); setTitle(d?.title ?? ''); setAt({ r: 0, c: 0 }); setEdit(null); setDirty(false); };
  const put = (r: number, c: number, v: string) => { setGrid((g) => g.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row))); setDirty(true); };
  const move = (r: number, c: number) => { const nr = Math.max(0, Math.min(grid.length - 1, r)); const nc = Math.max(0, Math.min(grid[0].length - 1, c)); setAt({ r: nr, c: nc }); cellRefs.current[`${nr},${nc}`]?.focus(); };
  const commit = (dr: number, dc: number) => { if (edit !== null) put(at.r, at.c, edit); setEdit(null); move(at.r + dr, at.c + dc); };
  const persist = async () => {
    try { const r: any = await toolkit({ action: 'save', id: open!.id, kind: 'sheet', title: title.trim() || 'Untitled sheet', data: { grid }, expectedVersion: open!.version } as never); setOpen({ id: r.result.id, version: r.result.version }); setDirty(false); toast('Saved.'); state.reload(); }
    catch (e) { toast(`! ${errMsg(e)}`); }
  };
  const raw = grid[at.r]?.[at.c] ?? '';

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Toolkit" title="Spreadsheet" sub="A grid you type into, with formulas. Out as Excel (.xlsx) or CSV. Nothing here is sent anywhere until you save." />
      <Loadable state={state}>{(d: any) => (
        <div className="grid gap-4 lg:grid-cols-4">
          <Panel title="Your sheets"><Button size="sm" onClick={() => start(null)}>New sheet</Button>
            <Button size="sm" variant="outline" className="ml-2" onClick={() => fileRef.current?.click()}>Open CSV</Button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Open a CSV file" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; start(null); setGrid(fromCsv(await f.text())); setTitle(f.name.replace(/\.csv$/i, '')); setDirty(true); e.target.value = ''; }} />
            {!d.docs.length ? <Empty>No sheets yet.</Empty> : d.docs.map((x: any) => (
              <button type="button" key={x.id} onClick={() => start(x)} className={`mt-1 block w-full rounded-md border p-2 text-left text-sm ${open?.id === x.id ? 'border-primary' : 'border-border'}`}>{x.title}
                <span className="block text-xs text-muted-foreground">{new Date(x.updatedAt).toLocaleDateString()}</span></button>))}
          </Panel>
          <div className="lg:col-span-3">{!open ? <Panel><Empty>Start a new sheet, open a CSV, or choose one of yours.</Empty></Panel> : (
            <Panel title={open.id ? 'Edit' : 'New sheet'} action={<div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={persist}>{dirty ? 'Save' : 'Saved'}</Button>
              <Button size="sm" variant="outline" onClick={() => save(`${fileName(title)}.xlsx`, new Blob([toXlsx(grid, title || 'Sheet1') as Uint8Array<ArrayBuffer>], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))}>Excel</Button>
              <Button size="sm" variant="outline" onClick={() => save(`${fileName(title)}.csv`, new Blob([toCsv(grid)], { type: 'text/csv' }))}>CSV</Button>
              {open.id && <Button size="sm" variant="ghost" onClick={async () => { try { await toolkit({ action: 'delete', id: open.id, kind: 'sheet' } as never); setOpen(null); state.reload(); toast('Deleted.'); } catch (e) { toast(`! ${errMsg(e)}`); } }}>Delete</Button>}</div>}>
              <Input aria-label="Sheet title" placeholder="Title" className="mb-2" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
              <div className="mb-2 flex items-center gap-2 text-sm">
                <span className="w-12 font-mono text-xs" aria-live="polite">{ref(at.r, at.c)}</span>
                <Input aria-label={`Contents of ${ref(at.r, at.c)}`} className="font-mono text-xs" value={edit ?? raw} placeholder="Type a value or =formula"
                  onChange={(e) => setEdit(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(1, 0); } if (e.key === 'Escape') setEdit(null); }} onBlur={() => { if (edit !== null) { put(at.r, at.c, edit); setEdit(null); } }} />
              </div>
              <div className="max-h-[60vh] overflow-auto rounded-md border border-border">
                <table className="border-collapse text-xs" role="grid" aria-label={title || 'Spreadsheet'}>
                  <thead><tr><th className="sticky top-0 bg-muted p-1" />{grid[0].map((_, c) => <th key={c} scope="col" className="sticky top-0 min-w-20 bg-muted p-1 font-medium">{colName(c)}</th>)}</tr></thead>
                  <tbody>{grid.map((row, r) => (
                    <tr key={r}><th scope="row" className="bg-muted px-2 font-medium">{r + 1}</th>
                      {row.map((_, c) => { const v = vals[r][c]; const sel = at.r === r && at.c === c;
                        return <td key={c} ref={(el) => { cellRefs.current[`${r},${c}`] = el; }} tabIndex={sel ? 0 : -1} role="gridcell" aria-selected={sel}
                          aria-label={`${ref(r, c)} ${show(v) || 'empty'}${grid[r][c].startsWith('=') ? `, formula ${grid[r][c]}` : ''}`}
                          onClick={() => { if (edit !== null) put(at.r, at.c, edit); setEdit(null); setAt({ r, c }); }}
                          onDoubleClick={() => setEdit(grid[r][c])}
                          onKeyDown={(e) => {
                            const k = e.key;
                            if (edit !== null && sel) { if (k === 'Enter') { e.preventDefault(); commit(1, 0); } else if (k === 'Tab') { e.preventDefault(); commit(0, e.shiftKey ? -1 : 1); } else if (k === 'Escape') setEdit(null); else if (k === 'Backspace') { e.preventDefault(); setEdit(edit.slice(0, -1)); } else if (k.length === 1) { e.preventDefault(); setEdit(edit + k); } return; }
                            if (k.startsWith('Arrow')) { e.preventDefault(); move(r + (k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0), c + (k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0)); }
                            else if (k === 'Enter' || k === 'F2') { e.preventDefault(); setEdit(grid[r][c]); }
                            else if (k === 'Tab') { e.preventDefault(); move(r, c + (e.shiftKey ? -1 : 1)); }
                            else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); put(r, c, ''); }
                            else if (k.length === 1 && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setEdit(k); }
                          }}
                          className={`h-7 min-w-20 border border-border px-1 ${typeof v === 'number' ? 'text-right' : ''} ${isErr(v) ? 'text-destructive' : ''} ${sel ? 'outline outline-2 outline-primary' : ''}`}>
                          {sel && edit !== null ? <span className="font-mono">{edit}<span aria-hidden>▏</span></span> : show(v)}</td>; })}</tr>))}</tbody>
                </table>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={grid.length >= MAX_ROWS} onClick={() => { setGrid([...grid, Array(grid[0].length).fill('')]); setDirty(true); }}>Add row</Button>
                <Button size="sm" variant="outline" disabled={grid[0].length >= MAX_COLS} onClick={() => { setGrid(grid.map((row) => [...row, ''])); setDirty(true); }}>Add column</Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Formulas start with =, e.g. =SUM(B2:B10) or =IF(C2&gt;=60,"pass","fail"). Functions: {FNS}. Arrow keys move; type to replace, Enter or F2 to edit, Delete to clear. Errors show as #DIV/0!, #REF!, #NAME?, #VALUE! or #CYCLE!. Up to {MAX_ROWS} rows and {MAX_COLS} columns.</p>
            </Panel>)}</div>
        </div>)}</Loadable>
    </div>
  );
}
