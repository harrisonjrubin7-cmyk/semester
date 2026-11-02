import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Checkbox } from '@project/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { DatePicker } from '@project/components/ui/date-picker';
import { Field, TableKey, TABLES, TITLE_FIELD } from './config';
import { useData } from './data';

type Row = Record<string, any>;

function toDate(s?: string) { return s ? new Date(s.length === 10 ? s + 'T12:00:00' : s) : undefined; }
function fromDate(d?: Date) { return d ? d.toISOString().slice(0, 10) : null; }

function FieldInput({ f, v, set }: { f: Field; v: any; set: (x: any) => void }) {
  const { data } = useData();
  if (f.kind === 'long') return <Textarea value={v ?? ''} onChange={(e) => set(e.target.value)} rows={3} />;
  if (f.kind === 'check') return <Checkbox checked={!!v} onCheckedChange={(c) => set(!!c)} />;
  if (f.kind === 'date') return <DatePicker value={toDate(v)} onChange={(d) => set(fromDate(d))} />;
  if (f.kind === 'money') return <Input type="number" min={0} value={v == null ? '' : v / 100} onChange={(e) => set(e.target.value === '' ? null : Math.round(Number(e.target.value) * 100))} />;
  if (f.kind === 'multi') return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 rounded-md border border-border p-2">
      {f.options!.map((o) => {
        const arr: string[] = v ?? [];
        return (
          <label key={o} className="flex items-center gap-2 text-sm">
            <Checkbox checked={arr.includes(o)} onCheckedChange={(c) => set(c ? [...arr, o] : arr.filter((x) => x !== o))} />{o}
          </label>
        );
      })}
    </div>
  );
  if (f.kind === 'select' || f.kind === 'user' || f.kind === 'link') {
    const opts: { value: string; label: string }[] =
      f.kind === 'select' ? f.options!.map((o) => ({ value: o, label: o }))
      : f.kind === 'user' ? (data?.users ?? []).map((u) => ({ value: u.id, label: u.name }))
      : ((data?.[f.link === 'projects' ? 'projects' : f.link!] ?? []) as Row[]).map((r) => ({ value: r.id, label: r[TITLE_FIELD[f.link!]] || 'Untitled' }));
    return (
      <Select value={v ?? undefined} onValueChange={set}>
        <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
        <SelectContent>{opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    );
  }
  return <Input type={f.kind === 'url' ? 'url' : 'text'} value={v ?? ''} onChange={(e) => set(e.target.value)} />;
}

export default function RecordForm({ table, row, open, onClose }: { table: TableKey; row: Row | null; open: boolean; onClose: () => void }) {
  const { mutate } = useData();
  const cfg = TABLES[table];
  const editable = cfg.fields.filter((f) => !(table === 'tickets' && f.key === 'openedAt'));
  const [vals, setVals] = useState<Row>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setVals(row ? { ...row } : {}); }, [open, row]);
  const missing = editable.filter((f) => f.required && !String(vals[f.key] ?? '').trim());
  const urlBad = editable.some((f) => f.kind === 'url' && vals[f.key] && !/^https?:\/\/\S+$/.test(vals[f.key]));

  const save = async () => {
    setBusy(true);
    const values: Row = {};
    editable.forEach((f) => { if (f.key in vals) values[f.key] = vals[f.key]; });
    const ok = await mutate({ table, op: row ? 'update' : 'create', id: row?.id, values }, row ? 'Saved' : `New ${cfg.singular} created`);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">{row ? `Edit ${cfg.singular}` : `New ${cfg.singular}`}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {editable.map((f) => (
            <div key={f.key} className={f.kind === 'check' ? 'flex items-center gap-2 flex-row-reverse justify-end' : 'space-y-1.5'}>
              <Label>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
              <FieldInput f={f} v={vals[f.key]} set={(x) => setVals((p) => ({ ...p, [f.key]: x }))} />
              {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
              {f.required && missing.includes(f) && vals[f.key] !== undefined && <p className="text-xs text-destructive">{f.label} is required.</p>}
            </div>
          ))}
          {urlBad && <p className="text-xs text-destructive">Links must start with http:// or https://</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || missing.length > 0 || urlBad}>{busy ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
