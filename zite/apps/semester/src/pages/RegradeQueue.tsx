import { useState } from 'react';
import { toast } from 'sonner';
import { regrade, RegradeOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { PageHeader, Panel, Empty, Loadable, useLoad, fmt, Status, ActionPreview } from '../components/kit';
import { ConfirmAction } from '../components/overlays';

type Item = { id: string; label: string; status: string; reason: string; gradeAtRequest: string; newGrade: string; student: string; self: boolean; decidedBy: string; note: string; requestedAt: string | null; decidedAt: string | null };

function Decide({ item, grades, outcome, onDone }: { item: Item; grades: readonly string[]; outcome: 'Grade Changed' | 'Grade Upheld'; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [grade, setGrade] = useState<string | undefined>();
  const change = outcome === 'Grade Changed';
  return (
    <ConfirmAction trigger={<Button size="sm" variant={change ? 'default' : 'outline'}>{change ? 'Change grade' : 'Keep grade'}</Button>}
      title={change ? `Change ${item.student}’s grade for ${item.label.replace('Regrade · ', '')}?` : `Keep ${item.gradeAtRequest} for ${item.student}?`}
      confirmLabel={change ? 'Change grade' : 'Keep grade'}
      onConfirm={async () => { await regrade({ action: 'decide', id: item.id, outcome, newGrade: grade, note }); toast(change ? 'Grade changed. The student was told.' : 'Grade kept. The student was told.'); onDone(); }}>
      <ActionPreview says={change ? `The released grade changes from ${item.gradeAtRequest} to the grade you pick, and the student gets your note.` : 'The released grade stays as it is, and the student gets your note.'}
        stays="The original grade and this decision stay in the audit log." recovery={{ kind: 'request', how: 'a later correction needs a new regrade request.' }} />
      {change && (
        <div className="mt-3">
          <Label htmlFor={`g-${item.id}`} className="text-xs">New grade</Label>
          <Select value={grade} onValueChange={setGrade}>
            <SelectTrigger id={`g-${item.id}`} className="mt-1 w-32"><SelectValue placeholder="Pick" /></SelectTrigger>
            <SelectContent>{grades.filter((g) => g !== item.gradeAtRequest).map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <Label htmlFor={`n-${item.id}`} className="mt-3 block text-xs">Note to the student</Label>
      <Textarea id={`n-${item.id}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={change ? 'e.g. Q3 rescored per the answer key; final average now 91.' : 'e.g. Grading followed the posted rubric for Q3.'} />
    </ConfirmAction>
  );
}

export default function RegradeQueue() {
  const s = useLoad(() => regrade({ action: 'queue' }));
  return (
    <>
      <PageHeader eyebrow="Faculty · Registrar" title="Regrade queue" sub="Students’ requests to review a released grade. Instructors decide for their own sections; the Registrar can decide any." />
      <Loadable state={s}>{(d: RegradeOutputType) => {
        const items = d.items as Item[];
        const pending = items.filter((i) => i.status === 'Pending');
        const done = items.filter((i) => i.status !== 'Pending');
        return (
          <div className="space-y-4">
            <Panel title={`Waiting for a decision (${pending.length})`}>
              {pending.length ? (
                <ul className="divide-y divide-border">{pending.map((i) => (
                  <li key={i.id} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">{i.label.replace('Regrade · ', '')} · {i.student} · <span className="font-display tabular-nums">{i.gradeAtRequest}</span></p>
                      <span className="text-xs text-muted-foreground">Asked {fmt(i.requestedAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{i.reason}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {i.self ? <span className="text-xs text-muted-foreground">This is your own request. Someone else decides it.</span> : (<>
                        <Decide item={i} grades={[...(d.grades ?? [])]} outcome="Grade Changed" onDone={s.reload} />
                        <Decide item={i} grades={[...(d.grades ?? [])]} outcome="Grade Upheld" onDone={s.reload} />
                      </>)}
                    </div>
                  </li>))}</ul>
              ) : <Empty>No regrade requests are waiting.</Empty>}
            </Panel>
            <Panel title="Decided">
              {done.length ? (
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground"><th className="py-1">Course</th><th>Student</th><th>Outcome</th><th>By</th><th>When</th></tr></thead>
                  <tbody>{done.map((i) => (
                    <tr key={i.id} className="border-t border-border"><td className="py-2">{i.label.replace('Regrade · ', '')}</td><td>{i.student}</td>
                      <td><Status value={i.status} /> {i.status === 'Grade Changed' ? `${i.gradeAtRequest} → ${i.newGrade}` : i.status === 'Grade Upheld' ? i.gradeAtRequest : ''}</td>
                      <td>{i.decidedBy || '—'}</td><td className="text-xs">{fmt(i.decidedAt)}</td></tr>))}</tbody>
                </table></div>
              ) : <Empty>Nothing decided yet.</Empty>}
            </Panel>
          </div>
        );
      }}</Loadable>
    </>
  );
}
