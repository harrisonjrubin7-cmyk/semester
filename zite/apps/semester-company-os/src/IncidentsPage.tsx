import { useState } from 'react';
import { toast } from 'sonner';
import { incidents } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Checkbox } from '@project/components/ui/checkbox';
import { Header, Panel, Chip, Loadable, useLoad, fmt, errMsg } from './ui';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Inc = any;
type Data = any;

/** One command key per intent: a retry or double-click replays the same step instead of repeating it. */
function useRunner(reload: () => void) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const run = async (input: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await incidents({ op: 'run', commandKey: key, ...input } as never) as { resultCode: string; message: string; replay: boolean };
      (r.resultCode === 'OK' ? toast.success : toast.error)(`${r.replay ? '(already done) ' : ''}${r.message}`);
      if (r.resultCode === 'OK') { setKey(crypto.randomUUID()); reload(); return true; }
    } catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
    return false;
  };
  return { run, busy };
}

function Report({ reload }: { reload: () => void }) {
  const [title, setTitle] = useState('');
  const { run, busy } = useRunner(reload);
  return (
    <Panel title="Report an incident">
      <form className="flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: 'report', title })) setTitle(''); }}>
        <Input aria-label="What is happening" placeholder="What is happening? (5+ characters)" value={title} onChange={(e) => setTitle(e.target.value)} className="min-w-64 flex-1" />
        <Button type="submit" disabled={busy || title.trim().length < 5}>Report</Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">Anyone can report. Never paste student records, passwords or keys here.</p>
    </Panel>
  );
}

function Step({ label, hint, need, onRun, busy, children }: { label: string; hint?: string; need?: string; onRun: (note: string) => void; busy: boolean; children?: React.ReactNode }) {
  const [note, setNote] = useState('');
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="text-sm font-medium">{label}{need && <span className="ml-2 text-xs font-normal text-muted-foreground">needs {need}</span>}</p>
      {children}
      {hint !== undefined && <Textarea aria-label={label} placeholder={hint} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />}
      <Button size="sm" disabled={busy} onClick={() => { onRun(note); setNote(''); }}>{label}</Button>
    </div>
  );
}

function Detail({ i, d, reload }: { i: Inc; d: Data; reload: () => void }) {
  const { run, busy } = useRunner(reload);
  const [sev, setSev] = useState(i.severity ?? 'SEV3');
  const [studentData, setStudentData] = useState(false);
  const [tech, setTech] = useState(i.techLeadId); const [comms, setComms] = useState(i.commsLeadId);
  const [fu, setFu] = useState({ title: '', owner: d.me, due: '' });
  const [audience, setAudience] = useState('');
  const go = (action: string, extra: Record<string, unknown> = {}) => run({ action, incidentId: i.id, version: i.version, ...extra });
  const open = i.state !== 'closed';
  const responders = d.roster.filter((p: any) => p.roles.includes('incident_responder'));
  return (
    <div className="space-y-4">
      <Panel title={<span className="flex flex-wrap items-center gap-2">#{i.number} {i.title} <Chip value={i.state} />{i.severity && <Chip value={i.severity} />}{i.studentData && <Chip value="student data possible" />}</span>}>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div><dt className="eyebrow">Reported by</dt><dd>{i.reportedBy} · {fmt(i.createdAt)}</dd></div>
          <div><dt className="eyebrow">Severity declared by</dt><dd>{i.declaredBy || '—'}</dd></div>
          <div><dt className="eyebrow">Technical lead</dt><dd>{i.techLead || '—'}</dd></div>
          <div><dt className="eyebrow">Communications lead</dt><dd>{i.commsLead || '—'}</dd></div>
        </dl>
        {i.summary && <p className="mt-3 text-sm"><span className="eyebrow">Impact</span><br />{i.summary}</p>}
        {i.mitigation && <p className="mt-2 text-sm"><span className="eyebrow">Mitigation</span><br />{i.mitigation}</p>}
        {i.postmortem && <p className="mt-2 whitespace-pre-wrap text-sm"><span className="eyebrow">Postmortem</span><br />{i.postmortem}</p>}
        {i.privacyNote && <p className="mt-2 text-sm"><span className="eyebrow">Privacy review · {i.privacyReviewedBy}</span><br />{i.privacyNote}</p>}
      </Panel>

      {open && <Panel title="Next steps">
        <p className="text-xs text-muted-foreground">The server checks every step against your role and the incident's state; a refused step explains why.</p>
        {i.state === 'reported' && <Step label="Triage" hint="What is affected? (10+ characters)" need="responder" busy={busy} onRun={(note) => go('triage', { note, studentData })}>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={studentData} onCheckedChange={(v) => setStudentData(!!v)} />Student data may be involved</label></Step>}
        {['triaged', 'declared', 'mitigating'].includes(i.state) && <Step label="Declare severity" hint={i.severity ? 'Why is the severity changing?' : undefined} need="incident executive" busy={busy} onRun={(note) => go('declare', { severity: sev, note })}>
          <div className="flex gap-1">{['SEV1', 'SEV2', 'SEV3', 'SEV4'].map((s) => <Button key={s} size="sm" variant={sev === s ? 'default' : 'outline'} onClick={() => setSev(s)}>{s}</Button>)}</div></Step>}
        {i.severity && <Step label="Assign leads" need="incident executive" busy={busy} onRun={() => go('assign', { techLead: tech, commsLead: comms })}>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs">Technical lead<select className="mt-1 block w-full rounded-[3px] border border-input bg-background p-2 text-sm" value={tech} onChange={(e) => setTech(e.target.value)}><option value="">Choose…</option>{responders.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="text-xs">Communications lead<select className="mt-1 block w-full rounded-[3px] border border-input bg-background p-2 text-sm" value={comms} onChange={(e) => setComms(e.target.value)}><option value="">Choose…</option>{d.roster.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          </div></Step>}
        <Step label="Post update" hint="What changed?" busy={busy} onRun={(note) => go('update', { note })} />
        {['declared', 'mitigating'].includes(i.state) && <Step label="Record mitigation" hint="What was done to stop the impact? (10+ characters)" need="technical lead or responder" busy={busy} onRun={(note) => go('mitigate', { note })} />}
        {i.state === 'mitigating' && <Step label="Resolve" need="technical lead or executive" busy={busy} onRun={() => go('resolve')} />}
        {i.studentData && !i.privacyReviewedBy && <Step label="Privacy review" hint="What data was involved, and the notification decision (20+ characters)" need="privacy officer" busy={busy} onRun={(note) => go('privacy_review', { note })} />}
        {i.state === 'resolved' && !i.postmortem && <Step label="Record postmortem" hint="Cause, impact, what worked, what changes (50+ characters)" need="incident executive" busy={busy} onRun={(note) => go('postmortem', { note })} />}
        <Step label="Add follow-up" need="technical lead or executive" busy={busy} onRun={() => go('followup', fu).then((ok) => ok && setFu({ ...fu, title: '' }))}>
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
            <Input aria-label="Follow-up" placeholder="Follow-up action" value={fu.title} onChange={(e) => setFu({ ...fu, title: e.target.value })} />
            <select aria-label="Owner" className="rounded-[3px] border border-input bg-background p-2 text-sm" value={fu.owner} onChange={(e) => setFu({ ...fu, owner: e.target.value })}>{d.roster.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <Input aria-label="Due date" type="date" value={fu.due} onChange={(e) => setFu({ ...fu, due: e.target.value })} />
          </div></Step>
        {i.commsLeadId === d.me && <Step label="Draft customer notice" hint="Notice text (20+ characters). Sending is disabled." busy={busy} onRun={(body) => go('draft_notice', { audience, body })}>
          <Input aria-label="Audience" placeholder="Audience, e.g. Pilot institution IT" value={audience} onChange={(e) => setAudience(e.target.value)} /></Step>}
        {i.state === 'resolved' && <Step label="Close incident" need="incident executive" busy={busy} onRun={() => go('close')} />}
      </Panel>}

      {(i.followups.length > 0 || i.notices.length > 0) && <Panel title="Follow-ups and notices">
        <ul className="space-y-1 text-sm">{i.followups.map((f: any, n: number) => <li key={n}>{f.title} · {f.owner}{f.due ? ` · due ${f.due}` : ''}</li>)}</ul>
        {i.notices.map((n: any) => (
          <div key={n.id} className="mt-3 rounded-[3px] border border-border p-3 text-sm">
            <p className="flex items-center gap-2"><Chip value={n.status} /> To: {n.audience} · drafted by {n.draftedBy}{n.approvedBy ? ` · approved by ${n.approvedBy}` : ''} · sending disabled</p>
            <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
            {open && n.status === 'draft' && n.draftedById !== d.me && <Button size="sm" className="mt-2" disabled={busy} onClick={() => go('approve_notice', { noticeId: n.id })}>Approve notice (nothing is sent)</Button>}
          </div>))}
      </Panel>}

      <Panel title={`Timeline · ${i.timeline.length}`}>
        <ol className="space-y-2 text-sm">{i.timeline.map((t: any, n: number) => <li key={n} className="border-l-2 border-border pl-3"><span className="text-xs text-muted-foreground">{fmt(t.at)} · {t.actor}</span><br /><span className="font-medium">{t.action.replace(/_/g, ' ')}</span>{t.detail ? ` — ${t.detail}` : ''}</li>)}</ol>
        <p className="mt-2 text-xs text-muted-foreground">The timeline is append-only: entries can't be edited or deleted.</p>
      </Panel>
    </div>
  );
}

export default function IncidentsPage() {
  const state = useLoad(() => incidents({ op: 'list' }) as Promise<Data>, []);
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-6xl">
      <Header eyebrow="Trust" title="Incidents" sub="Report → triage → severity declared by an executive → leads → mitigation → resolved → postmortem → closed. Customer notices need a second approver and are never sent from here." />
      <Report reload={state.reload} />
      <div className="mt-4"><Loadable state={state}>{(d: Data) => {
        if (!d.team) return <Panel title="Your reports">{d.incidents.length ? <ul className="text-sm">{d.incidents.map((i: any) => <li key={i.id}>#{i.number} {i.title} · <Chip value={i.state} /></li>)}</ul> : <p className="text-sm text-muted-foreground">You haven't reported anything. The full incident list is visible to the incident team only.</p>}</Panel>;
        if (!d.incidents.length) return <Panel><p className="text-sm text-muted-foreground">No incidents.</p></Panel>;
        const cur = d.incidents.find((x: Inc) => x.id === sel) ?? d.incidents[0];
        return (
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <nav aria-label="Incidents" className="space-y-1">{d.incidents.map((x: Inc) => (
              <button key={x.id} onClick={() => setSel(x.id)} className={`block w-full rounded-[3px] border p-2 text-left text-sm ${x.id === cur.id ? 'border-primary bg-accent' : 'border-border hover:bg-muted'}`}>
                #{x.number} {x.title}<span className="mt-1 flex gap-1"><Chip value={x.state} />{x.severity && <Chip value={x.severity} />}</span></button>))}</nav>
            <Detail key={`${cur.id}:${cur.version}`} i={cur} d={d} reload={state.reload} />
          </div>
        );
      }}</Loadable></div>
    </div>
  );
}
