import { useState } from 'react';
import { toast } from 'sonner';
import { accommodations } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Checkbox } from '@project/components/ui/checkbox';
import { PageHeader, Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const CAT: Record<string, string> = { testing: 'Testing and exams', classroom: 'Classroom', course_materials: 'Course materials', housing: 'Housing', other: 'Other' };
const call = async (input: any, ok: string, reload: () => void) => { try { await accommodations(input); toast(ok); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); return false; } };

function Request({ reload }: { reload: () => void }) {
  const [f, setF] = useState({ category: 'testing', description: '', documentation: false });
  const [id, setId] = useState(() => crypto.randomUUID());
  return (
    <Panel title="Request an accommodation">
      <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); if (await call({ action: 'submit', id, ...f }, 'Sent to the accessibility office.', reload)) { setId(crypto.randomUUID()); setF({ ...f, description: '' }); } }}>
        <select aria-label="Category" className="rounded-[3px] border border-input bg-background p-2 text-sm" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <Textarea aria-label="What would help" rows={4} placeholder="What makes things hard, and what would help? (20+ characters)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.documentation} onCheckedChange={(v) => setF({ ...f, documentation: !!v })} />I can provide documentation to the accessibility office</label>
        <Button type="submit" disabled={f.description.trim().length < 20}>Send to accessibility office</Button>
        <p className="text-xs text-muted-foreground">Only your institution's accessibility office reads this. Instructors only ever see the approved arrangements, and only for courses you choose. Don't upload documents here; the office will tell you how to send them.</p>
      </form>
    </Panel>
  );
}

function Mine({ d, reload }: { d: any; reload: () => void }) {
  if (!d.mine.length) return null;
  return (
    <Panel title="Your requests">
      <div className="space-y-3">{d.mine.map((r: any) => (
        <div key={r.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
          <p className="flex flex-wrap items-center gap-2 text-sm"><Status value={r.state.replace('_', ' ')} /> {CAT[r.category]} · requested {fmt(r.createdAt)}</p>
          {r.note && <p className="mt-1 text-sm">Office: {r.note}</p>}
          {r.state === 'approved' && <>
            <p className="mt-1 text-sm">Approved until {r.validUntil}: {r.arrangements.join('; ')}{r.timeMultiplier ? ` · Extended time ${r.timeMultiplier}× on timed assessments in courses you send this letter to` : ''}</p>
            <p className="mt-2 text-xs font-medium">Send the letter to:</p>
            {d.mySections.length ? <div className="mt-1 flex flex-wrap gap-1">{d.mySections.map((s: any) => {
              const sent = r.sent.includes(s.id);
              return <Button key={s.id} size="sm" variant={sent ? 'default' : 'outline'} onClick={() => call({ action: 'letter', id: r.id, sectionId: s.id, send: !sent }, sent ? 'Letter withdrawn.' : 'Letter sent to the instructor.', reload)}>{sent ? '✓ ' : ''}{s.label}</Button>;
            })}</div> : <p className="text-xs text-muted-foreground">You're not enrolled in any courses yet.</p>}
          </>}
          {!['withdrawn', 'declined'].includes(r.state) && <Button size="sm" variant="ghost" className="mt-1" onClick={() => call({ action: 'withdraw', id: r.id }, 'Withdrawn.', reload)}>Withdraw request</Button>}
        </div>))}</div>
    </Panel>
  );
}

function Decide({ r, reload }: { r: any; reload: () => void }) {
  const [arr, setArr] = useState(r.arrangements.join('\n'));
  const [note, setNote] = useState('');
  const [until, setUntil] = useState(r.validUntil ?? '');
  const go = (decision: string) => call({ action: 'decide', id: r.id, version: r.version, decision, arrangements: arr.split('\n').map((x: string) => x.trim()).filter((x: string) => x.length >= 3), note, validUntil: until || null }, 'Decision recorded.', reload);
  return (
    <div className="mt-2 space-y-2">
      <Textarea aria-label="Arrangements" rows={3} placeholder={'Arrangements instructors will see, one per line\ne.g. Extended exam time, 1.5x'} value={arr} onChange={(e) => setArr(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs">Valid until <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="inline-block w-40" /></label>
        <Input aria-label="Note to student" placeholder="Note to the student" value={note} onChange={(e) => setNote(e.target.value)} className="max-w-sm" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => go('approve')}>Approve arrangements</Button>
        <Button size="sm" variant="outline" onClick={() => go('request_info')}>Ask for more information</Button>
        <Button size="sm" variant="outline" onClick={() => go('decline')}>Decline</Button>
      </div>
      {r.state === 'approved' && <label className="block text-xs">Extended time on timed assessments (applies only in courses the student sends their letter to)
        <select className="mt-1 block rounded-md border border-border bg-background p-2 text-sm" value={r.timeMultiplier ?? ''}
          onChange={(e) => call({ action: 'setTime', id: r.id, version: r.version, multiplier: e.target.value ? Number(e.target.value) : null }, 'Extended time saved.', reload)}>
          <option value="">None</option>{[1.25, 1.5, 2, 2.5, 3].map((m) => <option key={m} value={m}>{m}× the time limit</option>)}
        </select></label>}
    </div>
  );
}

function Office({ d, reload }: { d: any; reload: () => void }) {
  return (
    <Panel title={`Accessibility office queue · ${d.queue.filter((q: any) => ['submitted', 'info_requested'].includes(q.state)).length} open`}>
      {!d.queue.length ? <Empty>No requests.</Empty> : <div className="space-y-4">{d.queue.map((r: any) => (
        <div key={r.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
          <p className="flex flex-wrap items-center gap-2 text-sm"><Status value={r.state.replace('_', ' ')} /> #{r.number} · {r.student} · {CAT[r.category]} · {fmt(r.createdAt)}{r.documentation ? ' · documentation offered' : ''}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{r.description}</p>
          {r.arrangements.length > 0 && <p className="mt-1 text-xs">Current: {r.arrangements.join('; ')} (until {r.validUntil})</p>}
          {['submitted', 'info_requested', 'approved'].includes(r.state) && <Decide r={r} reload={reload} />}
        </div>))}</div>}
    </Panel>
  );
}

function Letters({ d }: { d: any }) {
  if (!d.letters.length) return null;
  return (
    <Panel title="Accommodation letters for your sections">
      <ul className="space-y-2 text-sm">{d.letters.map((l: any, i: number) => <li key={i}><span className="font-medium">{l.student}</span> · {l.section} · until {l.validUntil}<br />{l.arrangements.join('; ')}</li>)}</ul>
      <p className="mt-2 text-xs text-muted-foreground">You see the arrangements the accessibility office approved, nothing about why. Questions go to the office, not the student.</p>
    </Panel>
  );
}

function OfficeAccess({ d, reload }: { d: any; reload: () => void }) {
  const [who, setWho] = useState('');
  return (
    <Panel title="Accessibility office members">
      <ul className="text-sm">{d.officeMembers.map((m: any) => <li key={m.id} className="flex items-center justify-between py-1">{m.name}<Button size="sm" variant="ghost" onClick={() => call({ action: 'setOffice', userId: m.id, on: false }, 'Access removed.', reload)}>Remove</Button></li>)}</ul>
      {!d.officeMembers.length && <Empty>No one is in the accessibility office yet.</Empty>}
      <div className="mt-2 flex gap-2">
        <select aria-label="Member" className="rounded-[3px] border border-input bg-background p-2 text-sm" value={who} onChange={(e) => setWho(e.target.value)}><option value="">Choose a member…</option>{d.members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <Button size="sm" disabled={!who} onClick={() => call({ action: 'setOffice', userId: who, on: true }, 'Added to the accessibility office.', reload)}>Add</Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Office members read sensitive requests. You can't add yourself.</p>
    </Panel>
  );
}

export default function Accommodations() {
  const s = useLoad(() => accommodations({ action: 'get' }));
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Campus" title="Accommodations" sub="Ask the accessibility office for support. You decide which instructors get a letter." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          <Request reload={s.reload} />
          <Mine d={d} reload={s.reload} />
          <Letters d={d} />
          {d.office && <Office d={d} reload={s.reload} />}
          {d.isAdmin && <OfficeAccess d={d} reload={s.reload} />}
        </div>)}
      </Loadable>
    </div>
  );
}
