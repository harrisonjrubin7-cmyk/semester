import { useMemo, useState } from 'react';
import { z } from 'zod';
import { sectionRequests } from 'zitejs/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { errMsg } from '../lib/useLoad';
import type { SreqData } from './sreqTypes';

const schema = z.object({
  departmentId: z.string().min(1, 'Choose a department'), courseId: z.string().min(1, 'Choose a course'), termId: z.string().min(1, 'Choose a term'),
  sectionCode: z.string().trim().min(1, 'Enter a section code').max(8), capacity: z.coerce.number().int().min(1, 'At least 1'),
  meetingTimes: z.string().trim().min(3, 'e.g. MWF 09:00-09:50').max(40), roomId: z.string().min(1, 'Choose a room'),
  instructorId: z.string().min(1, 'Choose an instructor'), reason: z.string().max(1000),
});
type Form = z.input<typeof schema>;
const blank: Form = { departmentId: '', courseId: '', termId: '', sectionCode: '', capacity: '', meetingTimes: '', roomId: '', instructorId: '', reason: '' } as unknown as Form;

type Props = { open: boolean; onOpenChange: (o: boolean) => void; data: SreqData; onDone: (d: SreqData) => void };

export default function NewRequestDialog({ open, onOpenChange, data, onDone }: Props) {
  const [f, setF] = useState<Form>(blank);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => schema.safeParse(f), [f]);
  const errs = parsed.success ? {} : parsed.error.flatten().fieldErrors;
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const set = (k: keyof Form, v: string) => { setF({ ...f, [k]: v }); setTouched({ ...touched, [k]: true }); };
  const err = (k: keyof Form) => touched[k] && errs[k]?.[0] ? <p className="text-xs text-destructive">{errs[k]![0]}</p> : null;

  const pick = (k: keyof Form, label: string, items: { id: string | number; name: string }[]) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={String(f[k] ?? '')} onValueChange={(v) => set(k, v)}>
        <SelectTrigger><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent>{items.map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>)}</SelectContent>
      </Select>
      {err(k)}
    </div>
  );

  const submit = async () => {
    if (!parsed.success) return;
    const v = parsed.data;
    setBusy(true);
    try {
      const d = (await sectionRequests({ action: 'submit', requestKey: key, departmentId: Number(v.departmentId), courseId: v.courseId, termId: v.termId,
        sectionCode: v.sectionCode, capacity: v.capacity, meetingTimes: v.meetingTimes, roomId: Number(v.roomId), instructorId: v.instructorId, reason: v.reason })) as SreqData;
      onDone(d);
      toast.success((d.result as { replayed?: boolean })?.replayed ? 'This request was already submitted.' : 'Request submitted to the department chair.');
      setF(blank); setTouched({}); setKey(crypto.randomUUID()); onOpenChange(false);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request a new section</DialogTitle>
          <DialogDescription>Goes to the department chair, then the registrar, who checks room and instructor conflicts before creating it.</DialogDescription>
        </DialogHeader>
        {data.departments.length === 0 || data.rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">An administrator needs to add at least one department and one room (Departments & rooms) before sections can be requested.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {pick('departmentId', 'Department', data.departments.filter((d) => d.active).map((d) => ({ id: d.id, name: d.name })))}
            {pick('courseId', 'Course', data.courses.map((c) => ({ id: c.id, name: `${c.code} — ${c.title}` })))}
            {pick('termId', 'Term', data.terms.map((t) => ({ id: t.id, name: t.label })))}
            {pick('roomId', 'Room', data.rooms.filter((r) => r.active).map((r) => ({ id: r.id, name: `${r.name} (seats ${r.capacity})` })))}
            {pick('instructorId', 'Instructor', data.faculty.map((p) => ({ id: p.id, name: p.name })))}
            <div className="space-y-1.5"><Label>Section code</Label><Input value={String(f.sectionCode)} onChange={(e) => set('sectionCode', e.target.value)} placeholder="02" />{err('sectionCode')}</div>
            <div className="space-y-1.5"><Label>Capacity</Label><Input type="number" value={String(f.capacity)} onChange={(e) => set('capacity', e.target.value)} />{err('capacity')}</div>
            <div className="space-y-1.5"><Label>Meeting times</Label><Input value={String(f.meetingTimes)} onChange={(e) => set('meetingTimes', e.target.value)} placeholder="MWF 09:00-09:50" />{err('meetingTimes')}</div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Reason</Label><Textarea value={String(f.reason)} onChange={(e) => set('reason', e.target.value)} placeholder="Why is this section needed?" /></div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!parsed.success || busy} onClick={submit}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
