import { useState } from 'react';
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getToday } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { cn } from '@project/components/lib/utils';
import { PageHeader, Panel, SourceTag, useLoad, Loadable } from '../components/kit';

type Entry = { id: string; at: string; label: string; meta: string; source: string };

function EntryRow({ e, compact }: { e: Entry; compact?: boolean }) {
  if (compact) return <p className="truncate text-[11px] leading-tight" title={`${e.label} · ${e.meta}`}><span className="font-mono text-muted-foreground">{format(new Date(e.at), 'HH:mm')}</span> {e.label}</p>;
  return (
    <div className="text-xs">
      <p className="font-medium">{format(new Date(e.at), 'HH:mm')} {e.label}</p>
      <p className="text-muted-foreground">{e.meta}</p>
      <SourceTag source={e.source} />
    </div>
  );
}

function Month({ entries, month, picked, onPick }: { entries: Entry[]; month: Date; picked: Date; onPick: (d: Date) => void }) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const on = (d: Date) => entries.filter((e) => isSameDay(new Date(e.at), d)).sort((a, b) => a.at.localeCompare(b.at));
  const sel = on(picked);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <Panel className="p-0">
        <div className="grid grid-cols-7 border-b border-border">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => <p key={w} className="eyebrow px-2 py-2">{w}</p>)}</div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const items = on(d);
            const today = isSameDay(d, new Date());
            return (
              <button key={d.toISOString()} type="button" onClick={() => onPick(d)}
                className={cn('min-h-20 border-b border-r border-border p-1.5 text-left transition-colors hover:bg-muted sm:min-h-24', !isSameMonth(d, month) && 'text-muted-foreground opacity-60', isSameDay(d, picked) && 'bg-accent')}>
                <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-sm text-xs', today && 'bg-primary text-primary-foreground')}>{format(d, 'd')}</span>
                <div className="mt-1 hidden space-y-0.5 sm:block">{items.slice(0, 3).map((e) => <EntryRow key={e.id} e={e} compact />)}{items.length > 3 && <p className="text-[11px] text-muted-foreground">+{items.length - 3} more</p>}</div>
                {items.length > 0 && <span className="mt-1 block text-[11px] text-muted-foreground sm:hidden">● {items.length}</span>}
              </button>
            );
          })}
        </div>
      </Panel>
      <Panel title={format(picked, 'EEE d MMM')}>
        <div className="space-y-3">{sel.length === 0 ? <p className="text-sm text-muted-foreground">Nothing scheduled.</p> : sel.map((e) => <EntryRow key={e.id} e={e} />)}</div>
      </Panel>
    </div>
  );
}

export default function CalendarPage() {
  const state = useLoad(() => getToday({}));
  const [view, setView] = useState<'month' | 'two'>('month');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [picked, setPicked] = useState(() => startOfDay(new Date()));
  const days = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i));
  return (
    <>
      <PageHeader eyebrow="Plan" title={view === 'month' ? format(month, 'MMMM yyyy') : 'Next two weeks'} sub="Deadlines, appointments and events in one place. Calendar sync stays off until your school allows it." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          <Button size="sm" variant={view === 'month' ? 'default' : 'outline'} onClick={() => setView('month')}>Month</Button>
          <Button size="sm" variant={view === 'two' ? 'default' : 'outline'} onClick={() => setView('two')}>Two weeks</Button>
        </div>
        {view === 'month' && <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => { setMonth(startOfMonth(new Date())); setPicked(startOfDay(new Date())); }}>Today</Button>
          <Button size="icon" variant="ghost" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>}
      </div>
      <Loadable state={state}>{(d) => {
        const entries: Entry[] = [
          ...d.tasks.filter((t) => t.dueAt && t.status !== 'Done').map((t) => ({ id: t.id, at: t.dueAt!, label: t.title, meta: t.course, source: t.source })),
          ...d.appointments.map((a) => ({ id: a.id, at: a.startsAt!, label: a.label, meta: 'Appointment', source: 'Sample' })),
          ...d.events.map((e) => ({ id: e.id, at: e.startsAt!, label: e.title, meta: e.location, source: 'Sample' })),
        ].filter((e) => e.at);
        if (view === 'month') return <Month entries={entries} month={month} picked={picked} onPick={(x) => { setPicked(x); if (!isSameMonth(x, month)) setMonth(startOfMonth(x)); }} />;
        return (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {days.map((day) => {
              const items = entries.filter((e) => isSameDay(new Date(e.at), day)).sort((a, b) => a.at.localeCompare(b.at));
              return (
                <Panel key={day.toISOString()} className="min-h-28 p-3">
                  <p className="eyebrow">{format(day, 'EEE d MMM')}</p>
                  <div className="mt-2 space-y-2">{items.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : items.map((e) => <EntryRow key={e.id} e={e} />)}</div>
                </Panel>
              );
            })}
          </div>
        );
      }}</Loadable>
    </>
  );
}
