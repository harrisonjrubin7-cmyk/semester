import { useState } from 'react';
import { z } from 'zod';
import { teaching } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Card, CardContent } from '@project/components/ui/card';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { DateTimePicker } from '@project/components/ui/date-picker';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { errMsg } from '../lib/useLoad';

const schema = z.object({ title: z.string().trim().min(2, 'Title needs at least 2 characters'), dueAt: z.date({ required_error: 'Choose a due date' }).refine((d) => d > new Date(), 'Due date must be in the future'), points: z.coerce.number().min(0, 'Points can’t be negative'), rubric: z.string() });

export default function NewAssignment({ sectionId, students, onDone }: { sectionId: string; students: number; onDone: () => void }) {
  const [f, setF] = useState<{ title: string; dueAt?: Date; points: string; rubric: string }>({ title: '', points: '100', rubric: '' });
  const [busy, setBusy] = useState(false);
  const p = schema.safeParse(f);
  const errs = p.success ? {} : p.error.flatten().fieldErrors;
  const [touched, setTouched] = useState(false);

  const submit = async () => {
    if (!p.success) return;
    setBusy(true);
    try {
      const out = (await teaching({ action: 'createAssignment', sectionId, title: p.data.title, dueAt: p.data.dueAt.toISOString(), points: p.data.points, rubric: p.data.rubric })) as { assigned: number };
      toast.success(`Published to ${out.assigned} students.`);
      setF({ title: '', points: '100', rubric: '' }); setTouched(false); onDone();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const E = ({ k }: { k: keyof typeof errs }) => touched && errs[k]?.[0] ? <p className="text-xs text-destructive">{errs[k]![0]}</p> : null;

  return (
    <Card><CardContent className="grid gap-4 p-5 sm:grid-cols-2" onChange={() => setTouched(true)}>
      <div className="space-y-1.5 sm:col-span-2"><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /><E k="title" /></div>
      <div className="space-y-1.5"><Label>Due</Label><DateTimePicker value={f.dueAt} onChange={(d) => { setTouched(true); setF({ ...f, dueAt: d }); }} /><E k="dueAt" /></div>
      <div className="space-y-1.5"><Label>Points</Label><Input type="number" min={0} value={f.points} onChange={(e) => setF({ ...f, points: e.target.value })} /><E k="points" /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label>Rubric</Label><Textarea rows={5} value={f.rubric} onChange={(e) => setF({ ...f, rubric: e.target.value })} placeholder="How the work will be assessed" /></div>
      <div className="flex items-center justify-between sm:col-span-2">
        <p className="text-sm text-muted-foreground">Goes to all {students} enrolled students, who get a notification.</p>
        <Button disabled={!p.success || busy || students === 0} onClick={submit}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Publish</Button>
      </div>
    </CardContent></Card>
  );
}
