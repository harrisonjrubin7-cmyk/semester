import { useState } from 'react';
import { toast } from 'sonner';
import { alumni } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { DateTimePicker } from '@project/components/ui/date-picker';
import { PageHeader, Panel, Empty, Loadable, useLoad, fmt, Status, errMsg } from '../components/kit';

type Slot = { id: string; label: string; startsAt: string | null; status: string; attendee: string | null };

export default function Mentoring() {
  const s = useLoad(() => alumni({ action: 'get' }));
  const [when, setWhen] = useState<Date | undefined>();
  const [topic, setTopic] = useState('');
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast(ok); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  const valid = !!when && when.getTime() > Date.now() && topic.trim().length >= 3;
  return (
    <>
      <PageHeader eyebrow="Alumni" title="Mentoring" sub="Offer time to students. Open slots appear in their Advising & support page, and booked ones show here with who is coming." />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <Panel title="Offer a slot">
          <Input placeholder="Topic, e.g. Breaking into product design" value={topic} onChange={(e) => setTopic(e.target.value)} />
          <div className="mt-3"><DateTimePicker value={when} onChange={setWhen} /></div>
          {when && when.getTime() <= Date.now() && <p className="mt-2 text-xs text-destructive">! Pick a time in the future.</p>}
          <Button className="mt-3" disabled={!valid} onClick={() => act(() => alumni({ action: 'addSlot', startsAt: when!.toISOString(), topic }), 'Slot offered. Students can book it now.').then(() => setTopic(''))}>Offer slot</Button>
          <p className="mt-2 text-xs text-muted-foreground">Students see your name and topic. They don’t see your email.</p>
        </Panel>
        <Loadable state={s}>{(d) => (
          <Panel title="Your slots">
            {d.slots.length ? <ul className="divide-y divide-border">{d.slots.map((x: Slot) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>{x.label}<span className="block text-xs text-muted-foreground">{fmt(x.startsAt)}{x.attendee ? ` · with ${x.attendee}` : ''}</span></span>
                <span className="flex items-center gap-2"><Status value={x.status === 'Open Slot' ? 'Open' : x.status} />
                  {x.status === 'Booked' && <Button size="sm" variant="outline" onClick={() => act(() => alumni({ action: 'complete', id: x.id }), 'Marked completed.')}>Mark done</Button>}
                  {(x.status === 'Open Slot' || x.status === 'Booked') && <Button size="sm" variant="ghost" onClick={() => act(() => alumni({ action: 'cancel', id: x.id }), 'Slot cancelled.')}>Cancel</Button>}
                </span>
              </li>))}</ul> : <Empty>No slots yet. Offer one to start mentoring.</Empty>}
          </Panel>
        )}</Loadable>
      </div>
    </>
  );
}
