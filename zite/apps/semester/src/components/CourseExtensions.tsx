import { useState } from 'react';
import { toast } from 'sonner';
import { learn } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Panel, Empty, Loadable, useLoad, Status, fmt, errMsg } from './kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const local = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

/** Instructor of record: per-student deadline extensions. A submission's receipt records the deadline it was judged against. */
export default function CourseExtensions({ sectionId }: { sectionId: string }) {
  const s = useLoad(() => learn({ action: 'extensions', sectionId }), [sectionId]);
  const [open, setOpen] = useState<string | null>(null);
  const [due, setDue] = useState('');
  const [kind, setKind] = useState<'instructor' | 'accommodation'>('instructor');
  const [letter, setLetter] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string) => { setBusy(true); try { await fn(); toast(ok); setOpen(null); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } finally { setBusy(false); } };
  return (
    <Loadable state={s}>{(d: any) => (
      <div className="space-y-4">
        <Panel title="Deadline extensions">
          <p className="mb-3 text-xs text-muted-foreground">Only you, as instructor of record, can grant or withdraw an extension. Work submitted before the extended date counts as on time, and its receipt names the deadline it was judged against. Once work is submitted, its deadline can no longer change.</p>
          {d.rows.length === 0 ? <Empty>No assignments with students yet.</Empty> : (
            <ul className="divide-y divide-border">{d.rows.map((r: any) => {
              const key = `${r.taskId}:${r.studentId}`;
              const letters = d.letters.filter((l: any) => l.studentId === r.studentId);
              return (
                <li key={key} className="py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><p className="font-medium">{r.student} · {r.title}</p>
                      <p className="text-xs text-muted-foreground">Due {r.dueAt ? fmt(r.dueAt) : 'not set'}{r.extension && <> · extended to <span className="font-medium text-foreground">{fmt(r.extension.newDue)}</span> ({r.extension.kind === 'accommodation' ? 'accommodation' : 'instructor'}){r.extension.note ? ` · ${r.extension.note}` : ''}</>}</p></div>
                    <div className="flex gap-2">
                      {r.submitted ? <Status value="Submitted" /> : <>
                        {r.dueAt && <Button size="sm" variant="outline" onClick={() => { setOpen(open === key ? null : key); setDue(local(r.extension?.newDue ?? r.dueAt)); setKind(letters.length ? 'accommodation' : 'instructor'); setLetter(letters[0]?.requestId ?? ''); setNote(''); }}>{r.extension ? 'Change' : 'Extend'}</Button>}
                        {r.extension && <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => learn({ action: 'revokeExtension', sectionId, id: r.extension.id }), 'Extension withdrawn')}>Withdraw</Button>}
                      </>}
                    </div>
                  </div>
                  {open === key && (
                    <div className="mt-2 grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
                      <label className="text-xs">New due date<Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></label>
                      <label className="text-xs">Reason
                        <select className="mt-1 block w-full rounded-md border border-input bg-background p-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value as any)}>
                          <option value="instructor">Instructor's decision</option>
                          <option value="accommodation" disabled={!letters.length}>Accommodation letter{letters.length ? '' : ' (none on file)'}</option>
                        </select></label>
                      {kind === 'accommodation' && <label className="text-xs sm:col-span-2">Letter
                        <select className="mt-1 block w-full rounded-md border border-input bg-background p-2 text-sm" value={letter} onChange={(e) => setLetter(e.target.value)}>
                          {letters.map((l: any) => <option key={l.requestId} value={l.requestId}>{l.arrangements.join('; ') || 'Arrangements on file'}{l.validUntil ? ` · until ${l.validUntil}` : ''}</option>)}
                        </select></label>}
                      <Input className="sm:col-span-2" aria-label="Note to student" placeholder="Note (optional, the student sees it)" value={note} onChange={(e) => setNote(e.target.value)} />
                      <div className="sm:col-span-2"><Button size="sm" disabled={busy || !due} onClick={() => run(() => learn({ action: 'grantExtension', sectionId, taskId: r.taskId, studentId: r.studentId, newDue: new Date(due).toISOString(), kind, accRequestId: kind === 'accommodation' ? letter : undefined, note }), 'Extension granted')}>Grant extension</Button></div>
                    </div>
                  )}
                </li>
              );
            })}</ul>
          )}
        </Panel>
      </div>
    )}</Loadable>
  );
}
