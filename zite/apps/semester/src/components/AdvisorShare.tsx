import { useState } from 'react';
import { toast } from 'sonner';
import { addMonths } from 'date-fns';
import { advisorShare } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Checkbox } from '@project/components/ui/checkbox';
import { Label } from '@project/components/ui/label';
import { DatePicker } from '@project/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Panel, ActionPreview, Loadable, useLoad, Empty } from './kit';
import { ConfirmAction } from './overlays';

type Cat = 'Degree progress' | 'Registration plan' | 'Holds' | 'Advising agenda';

/** Student-side control: share chosen parts of the record with one advisor until a date. */
export default function AdvisorShare({ onDone, className }: { onDone?: () => void; className?: string }) {
  const s = useLoad(() => advisorShare({ action: 'advisors' }));
  const [advisor, setAdvisor] = useState<string | undefined>();
  const [cats, setCats] = useState<Cat[]>([]);
  const [until, setUntil] = useState<Date | undefined>(addMonths(new Date(), 4));
  const valid = !!advisor && cats.length > 0 && !!until;
  return (
    <Panel title="Share with your advisor" className={className}>
      <p className="text-sm text-muted-foreground">Your advisor sees only what you tick, only until the date you pick. Each time they look, it shows in your access history. Private notes, messages and support cases are never shared.</p>
      <Loadable state={s}>{(d) => {
        const advisors = d.advisors as { id: string; name: string }[];
        if (!advisors.length) return <Empty>No advisors at your institution are on Semester yet.</Empty>;
        const name = advisors.find((x) => x.id === advisor)?.name ?? 'your advisor';
        return (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="share-advisor" className="text-xs">Advisor</Label>
                <Select value={advisor} onValueChange={setAdvisor}>
                  <SelectTrigger id="share-advisor" className="mt-1"><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{advisors.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <fieldset className="text-sm"><legend className="text-xs">What to share</legend>
                <div className="mt-1 grid gap-1">{(d.categories as Cat[]).map((c) => (
                  <label key={c} className="flex items-center gap-1.5"><Checkbox checked={cats.includes(c)} onCheckedChange={(v) => setCats(v ? [...cats, c] : cats.filter((x) => x !== c))} />{c}</label>))}</div>
              </fieldset>
              <div><Label className="text-xs">Until</Label><div className="mt-1"><DatePicker value={until} onChange={setUntil} /></div></div>
            </div>
            <ConfirmAction trigger={<Button className="mt-3" disabled={!valid}>Review share</Button>} title={`Share with ${name}?`} confirmLabel="Share" keepLabel="Don’t share"
              onConfirm={async () => { await advisorShare({ action: 'share', advisorId: advisor!, categories: cats, expiresOn: until!.toISOString().slice(0, 10) }); toast('Shared. You can revoke it any time in You → Privacy & data.'); setCats([]); onDone?.(); }}>
              <ActionPreview says={`${name} can see your ${cats.join(', ').toLowerCase()}.`} exactly={`Until ${until?.toDateString() ?? ''}. Every view is logged in your access history.`} stays="Everything else stays private." recovery={{ kind: 'undo', how: 'revoke it from You → Privacy & data.' }} />
            </ConfirmAction>
          </>
        );
      }}</Loadable>
    </Panel>
  );
}
