import { useState } from 'react';
import { toast } from 'sonner';
import { addMonths } from 'date-fns';
import { privacy } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Checkbox } from '@project/components/ui/checkbox';
import { DatePicker } from '@project/components/ui/date-picker';
import { Panel, ActionPreview, errMsg } from './kit';
import { ConfirmAction } from './overlays';

const CATS = ['Grades', 'Holds', 'Calendar'] as const;

export default function FamilyShare({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const [until, setUntil] = useState<Date | undefined>(addMonths(new Date(), 3));
  const valid = /\S+@\S+\.\S+/.test(email) && cats.length > 0 && !!until;
  return (
    <Panel title="Share with family" className="lg:col-span-2">
      <p className="text-sm text-muted-foreground">Let a parent or guardian see chosen parts of your record in Semester Family. Nothing is shared until you choose. Notes, messages and counselling records can never be shared.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Input placeholder="Their email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="flex flex-wrap items-center gap-3 text-sm">{CATS.map((c) => <label key={c} className="flex items-center gap-1.5"><Checkbox checked={cats.includes(c)} onCheckedChange={(v) => setCats(v ? [...cats, c] : cats.filter((x) => x !== c))} />{c}</label>)}</div>
        <DatePicker value={until} onChange={setUntil} />
      </div>
      <ConfirmAction trigger={<Button className="mt-3" disabled={!valid}>Review share</Button>} title="Share with family?" confirmLabel="Share" keepLabel="Don’t share"
        onConfirm={async () => { try { await privacy({ action: 'shareFamily', email, categories: cats as ('Grades' | 'Holds' | 'Calendar')[], expiresOn: until!.toISOString().slice(0, 10) }); toast('Shared. You can revoke it any time above.'); setEmail(''); setCats([]); onDone(); } catch (e) { throw new Error(errMsg(e)); } }}>
        <ActionPreview says={`${email} can see your ${cats.join(', ').toLowerCase()} in Semester Family.`} exactly={`Until ${until?.toDateString() ?? ''}. Each time they look, it shows in your access history.`} stays="Everything else stays private." recovery={{ kind: 'undo', how: 'revoke it from Shares and consents.' }} />
      </ConfirmAction>
    </Panel>
  );
}
