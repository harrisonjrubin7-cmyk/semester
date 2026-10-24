import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { getToday, manageTask, GetTodayOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Checkbox } from '@project/components/ui/checkbox';
import { Input } from '@project/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { ListTree, Plus, Upload, Trash2 } from 'lucide-react';
import { PageHeader, Panel, SourceTag, Empty, fmt, useLoad, Loadable, errMsg } from '../components/kit';
import SyllabusImport, { DraftTask } from '../components/SyllabusImport';

type Task = GetTodayOutputType['tasks'][0];

function TaskRow({ t, steps, onToggle, onBreak, onDelete }: { t: Task; steps: Task[]; onToggle: (t: Task) => void; onBreak: (t: Task) => void; onDelete: (t: Task) => void }) {
  const done = t.status === 'Done';
  return (
    <div className="border-b border-border py-2.5 last:border-0">
      <div className="flex items-start gap-3">
        <Checkbox checked={done} onCheckedChange={() => onToggle(t)} className="mt-0.5" aria-label={`Mark ${t.title} done`} />
        <div className="min-w-0 flex-1">
          <p className={done ? 'text-muted-foreground line-through' : ''}>{t.title}</p>
          <p className="text-xs text-muted-foreground">{[t.course, t.dueAt && fmt(t.dueAt), t.points && `${t.points} pts`].filter(Boolean).join(' · ')}</p>
        </div>
        <SourceTag source={t.source} />
        {t.type === 'Assignment' && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onBreak(t)} aria-label="Break into steps"><ListTree className="h-4 w-4" strokeWidth={1.5} /></Button>}
        {(t.source === 'Yours' || t.source === 'Made Here') && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(t)} aria-label="Delete"><Trash2 className="h-4 w-4" strokeWidth={1.5} /></Button>}
      </div>
      {steps.length > 0 && <div className="ml-8 mt-2 space-y-1">{steps.map((s) => (
        <label key={s.id} className="flex items-center gap-2 text-sm"><Checkbox checked={s.status === 'Done'} onCheckedChange={() => onToggle(s)} /><span className={s.status === 'Done' ? 'text-muted-foreground line-through' : ''}>{s.title}</span></label>
      ))}</div>}
    </div>
  );
}

export default function Today() {
  const state = useLoad(() => getToday({}));
  const [title, setTitle] = useState('');
  const [breaking, setBreaking] = useState<Task | null>(null);
  const [stepsText, setStepsText] = useState('Outline\nDraft\nCite sources\nFinal read');
  const [importOpen, setImportOpen] = useState(false);
  const [items, setItems] = useState<DraftTask[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const act = async (fn: () => Promise<unknown>) => { try { await fn(); await state.reload(); } catch (e) { toast.error(errMsg(e)); } };
  const toggle = (t: Task) => {
    const next = t.status === 'Done' ? 'Open' : 'Done';
    setOverrides((o) => ({ ...o, [t.id]: next }));
    manageTask({ action: 'update', id: t.id, done: next === 'Done' }).catch((e) => { setOverrides((o) => ({ ...o, [t.id]: t.status })); toast.error(errMsg(e)); });
  };

  return (
    <>
      <PageHeader eyebrow="Today" title={format(new Date(), 'EEE d MMM')} sub="What needs you today, with where each item came from."
        actions={<Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="mr-1.5 h-4 w-4" strokeWidth={1.5} />Add a syllabus</Button>} />
      <Loadable state={state}>{(d) => {
        const tasks = d.tasks.map((t) => ({ ...t, status: overrides[t.id] ?? t.status }));
        const top = tasks.filter((t) => !t.parentId && t.type !== 'Hold').sort((a, b) => (a.status === 'Done' ? 1 : 0) - (b.status === 'Done' ? 1 : 0) || (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'));
        const holds = tasks.filter((t) => t.type === 'Hold' && t.status === 'Open');
        const next = top.find((t) => t.status !== 'Done');
        return (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              {next && <div className="rounded-md border border-primary/30 bg-accent p-4"><p className="eyebrow text-accent-foreground">Next</p><p className="mt-1 font-display text-2xl">{next.title}</p><p className="text-sm text-muted-foreground">{[next.course, next.dueAt && fmt(next.dueAt)].filter(Boolean).join(' · ')}</p></div>}
              <Panel title="Your work">
                <form className="mb-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (title.trim()) act(() => manageTask({ action: 'create', title: title.trim(), dueAt: null })).then(() => setTitle('')); }}>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task of your own" />
                  <Button type="submit" variant="outline" disabled={!title.trim()}><Plus className="h-4 w-4" /></Button>
                </form>
                {top.length === 0 ? <Empty>Nothing due. Add a task or a syllabus to get started.</Empty> :
                  top.map((t) => <TaskRow key={t.id} t={t} steps={tasks.filter((s) => s.parentId === t.id)} onToggle={toggle} onBreak={setBreaking} onDelete={(x) => act(() => manageTask({ action: 'delete', id: x.id }))} />)}
              </Panel>
            </div>
            <div className="space-y-4">
              <Panel title="Needs you">
                {holds.length + d.approvals.length === 0 ? <Empty>✓ Nothing is blocking you.</Empty> : (
                  <div className="space-y-3 text-sm">
                    {holds.map((h) => <Link to="/help" key={h.id} className="block"><p>! {h.title}</p><p className="text-xs text-muted-foreground">Owned by {h.owningOffice.split(' · ')[0]}</p></Link>)}
                    {d.approvals.map((a) => <Link to={a.mine ? '/plan/registration' : '/help'} key={a.id} className="block"><p>… {a.title}</p><p className="text-xs text-muted-foreground">{a.mine ? 'Waiting on ' + (a.office || 'approver') : 'Waiting on you'}</p></Link>)}
                  </div>)}
              </Panel>
              <Panel title="Coming up">
                {d.events.length + d.appointments.length === 0 ? <Empty>No events or appointments yet.</Empty> : (
                  <div className="space-y-2 text-sm">
                    {d.appointments.map((x) => <p key={x.id}>{x.label}<span className="block text-xs text-muted-foreground">{fmt(x.startsAt)}</span></p>)}
                    {d.events.map((x) => <p key={x.id}>{x.title}<span className="block text-xs text-muted-foreground">{fmt(x.startsAt)} · {x.location}</span></p>)}
                  </div>)}
              </Panel>
            </div>
          </div>
        );
      }}</Loadable>

      <Dialog open={!!breaking} onOpenChange={(o) => !o && setBreaking(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Break “{breaking?.title}” into steps</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">One step per line. Steps are yours and only you can see them.</p>
          <textarea className="min-h-32 w-full rounded-sm border border-input bg-card p-2 text-sm" value={stepsText} onChange={(e) => setStepsText(e.target.value)} />
          <DialogFooter><Button onClick={() => { const steps = stepsText.split('\n').map((s) => s.trim()).filter(Boolean); const t = breaking!; setBreaking(null); act(() => manageTask({ action: 'breakdown', id: t.id, steps })); }}>Add steps</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Add a syllabus</DialogTitle></DialogHeader>
          <SyllabusImport items={items} setItems={setItems} />
          <DialogFooter><Button disabled={!items.length} onClick={() => { const it = items; setImportOpen(false); setItems([]); act(() => manageTask({ action: 'bulkCreate', items: it })); }}>Save {items.length || ''} tasks</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
