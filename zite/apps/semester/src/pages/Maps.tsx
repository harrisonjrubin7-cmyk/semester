import { useState } from 'react';
import { campus } from 'zitejs/api';
import { MapPin } from 'lucide-react';
import { Input } from '@project/components/ui/input';
import { PageHeader, Panel, Empty, Loadable, useLoad, fmt, SourceTag } from '../components/kit';

type Ev = { id: string; title: string; startsAt: string | null; location: string; group: string; going: boolean };

export default function Maps() {
  const s = useLoad(() => campus({ action: 'get' }));
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  return (
    <>
      <PageHeader eyebrow="Campus" title="Places" sub="Where things are happening on campus, from the events and groups you can see." />
      <Loadable state={s}>{(d) => {
        const places = Object.entries((d.events as Ev[]).filter((e) => e.location).reduce<Record<string, Ev[]>>((acc, e) => { (acc[e.location] ||= []).push(e); return acc; }, {}))
          .filter(([name]) => name.toLowerCase().includes(q.toLowerCase())).sort(([a], [b]) => a.localeCompare(b));
        const current = places.find(([n]) => n === sel) ?? places[0];
        return (
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <Panel>
              <Input placeholder="Search places" value={q} onChange={(e) => setQ(e.target.value)} />
              {places.length ? <ul className="mt-3 space-y-1">{places.map(([name, evs]) => (
                <li key={name}><button onClick={() => setSel(name)} className={`flex w-full items-center gap-2 rounded-[3px] border-l-2 px-2 py-2 text-left text-sm ${current?.[0] === name ? 'border-primary bg-accent font-medium' : 'border-transparent hover:bg-accent'}`}>
                  <MapPin className="h-4 w-4" strokeWidth={1.5} /><span className="flex-1">{name}</span><span className="text-xs text-muted-foreground">{evs.length} event{evs.length > 1 ? 's' : ''}</span></button></li>
              ))}</ul> : <Empty>No places match.</Empty>}
            </Panel>
            {current ? (
              <Panel title={current[0]}>
                <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><SourceTag source={d.isSample === false ? 'Official' : 'Sample'} />Directions come from your institution’s map once it is connected.</div>
                <ul className="space-y-3">{current[1].map((e) => <li key={e.id} className="border-b border-border pb-3 text-sm last:border-0"><p className="font-medium">{e.title}</p><p className="text-xs text-muted-foreground">{fmt(e.startsAt)} · {e.group}{e.going ? ' · ✓ Going' : ''}</p></li>)}</ul>
              </Panel>
            ) : <Empty>No places yet. Places appear as events are scheduled.</Empty>}
          </div>
        );
      }}</Loadable>
    </>
  );
}
