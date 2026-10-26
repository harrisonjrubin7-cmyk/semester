import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { help, progress, study } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, fmt, errMsg, ActionPreview } from '../components/kit';
import { ConfirmAction } from '../components/overlays';
import AdvisorShare from '../components/AdvisorShare';

export default function Advising() {
  const h = useLoad(() => help({ action: 'get' }));
  const p = useLoad(() => progress({ action: 'get' }));
  const st = useLoad(() => study({ action: 'list' }));
  const agenda = st.data?.items?.find((i: { title: string }) => i.title === 'Advising agenda');
  const [text, setText] = useState('');
  useEffect(() => { if (agenda) setText(agenda.body); }, [agenda?.id]);
  const save = async (share: boolean) => {
    try {
      await study({ action: 'save', id: agenda?.id, title: 'Advising agenda', kind: 'Study Plan', visibility: share ? 'Selected Collaborators' : 'Only Me', body: text });
      toast(share ? 'Agenda shared for your advising meeting.' : 'Agenda saved. Only you can see it.'); st.reload();
    } catch (e) { toast(`! ${errMsg(e)}`); }
  };
  return (
    <>
      <PageHeader eyebrow="Help" title="Advising" sub="Get ready for your next advising meeting: what is booked, where you stand, and what you want to ask." actions={<Button asChild variant="outline"><Link to="/help">Book a slot</Link></Button>} />
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Panel title="Your agenda">
            <Textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Questions for your advisor — e.g. Can CS 410 count as a major elective?" />
            <p className="mt-2 text-xs text-muted-foreground">Visibility: {agenda?.visibility === 'Selected Collaborators' ? 'Shared for advising' : 'Only me'}. Private notes are never shared.</p>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" onClick={() => save(false)} disabled={!text.trim()}>Save privately</Button>
              <ConfirmAction trigger={<Button disabled={!text.trim()}>Share with advisor</Button>} title="Share your agenda?" confirmLabel="Share agenda" onConfirm={() => save(true)}>
                <ActionPreview says="Advisors you have shared “Advising agenda” with (below) can read this agenda before and during your meeting." exactly="Only the agenda text above. Not your grades, notes or study history." recovery={{ kind: 'undo', how: 'save it privately again at any time' }} />
              </ConfirmAction>
            </div>
          </Panel>
          <AdvisorShare />
          <Loadable state={p}>{(d) => (
            <Panel title="Where you stand">
              <p className="text-sm">{d.totalEarned} of {d.totalReq} credits · Estimated GPA {d.gpa ?? '—'}</p>
              <ul className="mt-2 space-y-1 text-sm">{d.requirements.map((r: { id: string; name: string; earned: number; required: number }) => <li key={r.id}>{r.earned >= r.required ? '✓' : '…'} {r.name} · {r.earned}/{r.required}</li>)}</ul>
              <Link to="/progress/degree" className="mt-2 inline-block text-xs underline">Open degree requirements</Link>
            </Panel>
          )}</Loadable>
        </div>
        <Loadable state={h}>{(d) => (
          <div className="space-y-4">
            <Panel title="Booked">{d.booked.length ? <ul className="space-y-2 text-sm">{d.booked.map((b: { id: string; label: string; startsAt: string }) => <li key={b.id}>✓ {b.label}<br /><span className="text-xs text-muted-foreground">{fmt(b.startsAt)}</span></li>)}</ul> : <Empty>No meeting booked.</Empty>}</Panel>
            <Panel title="Holds">{d.holds.length ? d.holds.map((x: { id: string; title: string; office: string }) => <p key={x.id} className="text-sm">! {x.title} · {x.office}</p>) : <p className="text-sm text-muted-foreground">✓ No holds.</p>}</Panel>
          </div>
        )}</Loadable>
      </div>
    </>
  );
}
