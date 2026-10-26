import { useState } from 'react';
import { officeHours } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { DateTimePicker } from '@project/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { errMsg } from '../lib/useLoad';
import type { OhData } from '../lib/oh';

type Props = { open: boolean; onOpenChange: (o: boolean) => void; data: OhData; onDone: () => void };

export default function NewSlotDialog({ open, onOpenChange, data, onDone }: Props) {
  const [start, setStart] = useState<Date | undefined>();
  const [section, setSection] = useState(data.firstSection ?? 'none');
  const [minutes, setMinutes] = useState('60');
  const [capacity, setCapacity] = useState('4');
  const [weeks, setWeeks] = useState('1');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const kind = data.hostKinds.includes('Office hours') ? 'Office hours' : data.hostKinds[0];
  const error = !start ? 'Choose a start time.' : start < new Date() ? 'Start time must be in the future.' : Number(minutes) < 5 ? 'At least 5 minutes.' : Number(capacity) < 1 ? 'At least 1 student.' : Number(weeks) < 1 || Number(weeks) > 16 ? 'Repeat 1–16 weeks.' : '';

  const submit = async () => {
    if (error) return;
    setBusy(true);
    try {
      await officeHours({ action: 'create', kind: kind as 'Office hours', sectionId: section === 'none' ? null : section, startsAt: start!.toISOString(), minutes: Number(minutes), capacity: Number(capacity), weeks: Number(weeks), location: location.trim() });
      toast.success('Office hours added.'); onOpenChange(false); setStart(undefined); onDone();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add office hours</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Starts</Label><DateTimePicker value={start} onChange={setStart} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>For</Label><Select value={section} onValueChange={setSection}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">All my students</SelectItem>{data.teaching.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Minutes</Label><Input type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Students per slot</Label><Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Repeat weekly for</Label><Input type="number" value={weeks} onChange={(e) => setWeeks(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Room or video link" /></div>
        </div>
        {error && start !== undefined && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!!error || busy} onClick={submit}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
