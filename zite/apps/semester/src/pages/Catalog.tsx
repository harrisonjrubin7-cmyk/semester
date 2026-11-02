import { useState } from 'react';
import { toast } from 'sonner';
import { catalog } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Status, useLoad, Loadable, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const run = async (input: any, ok: string, reload: () => void) => { try { await catalog(input); toast(ok); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); return false; } };
const blank = { code: '', title: '', credits: '3', description: '', prerequisites: '', effectiveTerm: '', retire: false };

function Decide({ kind, p, reload }: { kind: 'course' | 'rules'; p: any; reload: () => void }) {
  const [note, setNote] = useState('');
  if (p.mine) return <p className="mt-1 text-xs text-muted-foreground">Another registrar approves your proposal.</p>;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <Input aria-label="Decision note" className="max-w-sm" placeholder="Note (needed to reject)" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button size="sm" onClick={() => run({ action: 'decide', kind, id: p.id, approve: true, note }, 'Approved and published.', reload)}>Approve</Button>
      <Button size="sm" variant="outline" onClick={() => run({ action: 'decide', kind, id: p.id, approve: false, note }, 'Rejected.', reload)}>Reject</Button>
    </div>
  );
}

export default function Catalog() {
  const s = useLoad(() => catalog({ action: 'get' }));
  const [f, setF] = useState(blank);
  const [max, setMax] = useState(''); const [rnote, setRnote] = useState('');
  const [q, setQ] = useState('');
  return (
    <>
      <PageHeader eyebrow="Registrar" title="Course catalog and rules" sub="The published catalog and registration rules. A registrar proposes a change; a different registrar approves it. Every version is kept." />
      <Loadable state={s}>{(d: any) => (
        <div className="grid gap-4">
          <Panel title="Registration rules">
            {d.rules ? <p className="text-sm">Up to {d.rules.maxCredits} credits per term.{d.rules.note && ` ${d.rules.note}`} <span className="text-xs text-muted-foreground">v{d.rules.version}</span></p>
              : <Empty>No credit limit is approved, so none is enforced.</Empty>}
            {d.canEdit && <>
              {d.pendingRules.map((p: any) => <div key={p.id} className="mt-3 border-t border-border pt-3 text-sm"><p>Proposed by {p.proposedBy}: up to {p.maxCredits} credits{p.note && ` · ${p.note}`}</p><Decide kind="rules" p={p} reload={s.reload} /></div>)}
              {!d.pendingRules.length && <div className="mt-3 flex flex-wrap gap-2">
                <Input aria-label="Credit limit" type="number" className="max-w-[9rem]" placeholder="Max credits" value={max} onChange={(e) => setMax(e.target.value)} />
                <Input aria-label="Overload note" className="max-w-sm" placeholder="What students should do to go over" value={rnote} onChange={(e) => setRnote(e.target.value)} />
                <Button size="sm" disabled={!max} onClick={() => run({ action: 'proposeRules', maxCredits: Number(max), note: rnote }, 'Proposed. Another registrar must approve it.', () => { setMax(''); setRnote(''); s.reload(); })}>Propose limit</Button>
              </div>}
            </>}
          </Panel>
          <Panel title={`Published catalog · ${d.catalog.length} courses`}>
            <Input aria-label="Search the catalog" className="mb-2" placeholder="Search by code or title" value={q} onChange={(e) => setQ(e.target.value)} />
            {!d.catalog.length ? <Empty>No catalog entries are approved yet.</Empty> : d.catalog.filter((c: any) => !q || `${c.code} ${c.title}`.toLowerCase().includes(q.toLowerCase())).map((c: any) => (
              <div key={c.id} className="border-t border-border py-2 text-sm first:border-0">
                <p className="font-medium">{c.code} · {c.title} <span className="font-normal text-muted-foreground">· {c.credits} credits · from {c.effectiveTerm}</span></p>
                <p className="text-muted-foreground">{c.description}</p>
                {c.prerequisites && <p className="text-xs">Prerequisites: {c.prerequisites}</p>}
              </div>))}
            <p className="mt-2 text-xs text-muted-foreground">This is the published description. Changing live sections and enrollments from it is a separate, approved activation step.</p>
          </Panel>
          {d.canEdit && <>
            <Panel title={`Catalog changes waiting · ${d.pendingCourses.length}`}>
              {!d.pendingCourses.length ? <Empty>Nothing waiting.</Empty> : d.pendingCourses.map((p: any) => (
                <div key={p.id} className="border-t border-border py-3 text-sm first:border-0">
                  <p className="font-medium">{p.retire ? 'Retire' : `v${p.version}`} · {p.code} · {p.title} · {p.credits} credits · from {p.effectiveTerm} <span className="font-normal text-muted-foreground">· by {p.proposedBy}</span></p>
                  <p className="text-muted-foreground">{p.description}</p>
                  <Decide kind="course" p={p} reload={s.reload} />
                </div>))}
            </Panel>
            <Panel title="Propose a catalog change">
              <div className="grid gap-2 md:grid-cols-4">
                <Input aria-label="Code" placeholder="HIST 214" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
                <Input aria-label="Title" className="md:col-span-2" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
                <Input aria-label="Credits" type="number" placeholder="Credits" value={f.credits} onChange={(e) => setF({ ...f, credits: e.target.value })} />
              </div>
              <Textarea aria-label="Description" className="mt-2" rows={3} placeholder="Catalog description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                <Input aria-label="Prerequisites" placeholder="Prerequisites (e.g. HIST 101)" value={f.prerequisites} onChange={(e) => setF({ ...f, prerequisites: e.target.value })} />
                <Input aria-label="Effective term" placeholder="Effective term, e.g. Fall 2027" value={f.effectiveTerm} onChange={(e) => setF({ ...f, effectiveTerm: e.target.value })} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.retire} onChange={(e) => setF({ ...f, retire: e.target.checked })} /> Retire this course</label>
              </div>
              <Button className="mt-2" size="sm" disabled={!f.code || f.title.trim().length < 3 || f.description.trim().length < 20 || !f.effectiveTerm || !Number(f.credits)}
                onClick={() => run({ action: 'proposeCourse', ...f, credits: Number(f.credits) }, 'Proposed. Another registrar must approve it.', () => { setF(blank); s.reload(); })}>Propose</Button>
            </Panel>
            {d.history.length > 0 && <Panel title="History">
              <ul className="text-sm">{d.history.map((h: any) => <li key={`${h.kind}${h.id}`} className="border-t border-border py-1.5 first:border-0">{h.kind === 'course' ? `${h.code} v${h.version}` : `Rules v${h.version} (${h.maxCredits} credits)`} · <Status value={h.state} /> · {h.proposedBy}{h.decidedBy && ` → ${h.decidedBy}`}{h.decisionNote && <span className="text-muted-foreground"> · {h.decisionNote}</span>}</li>)}</ul>
            </Panel>}
          </>}
        </div>)}
      </Loadable>
    </>
  );
}
