import { useState } from 'react';
import { toast } from 'sonner';
import { audit } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';
import { AREAS, AREA_LABEL, SEVERITIES } from '../lib/auditRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const key = () => crypto.randomUUID();
const area = (a: string) => AREA_LABEL[a as keyof typeof AREA_LABEL] ?? a;

function useAct(reload: () => void) {
  return async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}

/** Hashes a file in the browser. The file itself is never uploaded: only the reference and the hash are recorded. */
async function sha256File(f: File) {
  const buf = await crypto.subtle.digest('SHA-256', await f.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function HashPicker({ onHash }: { onHash: (h: string) => void }) {
  return <label className="text-xs text-muted-foreground">Compute from a local file (not uploaded): <input type="file" className="text-xs" onChange={async (e) => { const f = e.target.files?.[0]; if (f) onHash(await sha256File(f)); }} /></label>;
}

function Plan({ p, d, reload }: { p: any; d: any; reload: () => void }) {
  const act = useAct(reload);
  const [ev, setEv] = useState({ ref: '', sha256: '', note: '', requestKey: key() });
  const [rep, setRep] = useState<Record<number, string>>({});
  const [t, setT] = useState({ controlId: '', evidenceIds: [] as number[], sampleSize: 25, result: 'pass', note: '' });
  const [f, setF] = useState({ controlId: '', severity: 'medium', title: '', detail: '', ownerEmail: '', due: '', requestKey: key() });
  const ctrls = d.controls.filter((c: any) => c.area === p.area);
  const next = { planned: 'fieldwork', fieldwork: 'reporting', reporting: 'closed' }[p.state as string];
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">{area(p.area)} · <Status value={p.state} />{p.scopeNote ? ` · ${p.scopeNote}` : ''}</p>
      {next && <Button size="sm" variant="outline" onClick={() => act(() => audit({ action: 'planStep', planId: p.id, to: next as never, expectedVersion: p.version }), `Moved to ${next}.`)}>Move to {next}</Button>}
      <div><p className="text-xs font-medium">Evidence ({p.evidence.length})</p>
        {p.evidence.length ? <ul className="mt-1 space-y-1">{p.evidence.map((e: any) => (
          <li key={e.id} className="rounded border border-border p-2 text-xs">
            <p>#{e.id} · {e.ref}{e.note ? ` — ${e.note}` : ''}</p>
            <p className="font-mono text-[11px] text-muted-foreground break-all">{e.sha256}</p>
            <p className="text-muted-foreground">{e.collectedBy} · {fmt(e.collectedAt)}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Input aria-label="Hash to compare" placeholder="Re-hash and paste to compare" className="h-8 max-w-sm text-xs" value={rep[e.id] ?? ''} onChange={(x) => setRep({ ...rep, [e.id]: x.target.value })} />
              <HashPicker onHash={(h) => setRep({ ...rep, [e.id]: h })} />
              <Button size="sm" variant="outline" disabled={!rep[e.id]} onClick={async () => { try { const r: any = await audit({ action: 'reproduce', evidenceId: e.id, sha256: rep[e.id] }); toast(r.result.match ? 'Matches the recorded hash.' : '! Does not match — logged as possible tampering.'); } catch (x) { toast(`! ${errMsg(x)}`); } }}>Compare</Button>
            </div>
          </li>))}</ul> : <Empty>No evidence yet.</Empty>}
        {p.state !== 'closed' && <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Input aria-label="Evidence reference" placeholder="Where the evidence lives (system, path, ticket)" value={ev.ref} onChange={(e) => setEv({ ...ev, ref: e.target.value })} />
          <Input aria-label="SHA-256" placeholder="SHA-256" className="font-mono text-xs" value={ev.sha256} onChange={(e) => setEv({ ...ev, sha256: e.target.value.trim().toLowerCase() })} />
          <Input aria-label="Evidence note" placeholder="Note (optional)" value={ev.note} onChange={(e) => setEv({ ...ev, note: e.target.value })} />
          <div className="flex flex-wrap items-center gap-2"><HashPicker onHash={(h) => setEv({ ...ev, sha256: h })} />
            <Button size="sm" disabled={ev.ref.trim().length < 3 || !/^[0-9a-f]{64}$/.test(ev.sha256)} onClick={async () => { if (await act(() => audit({ action: 'evidence', planId: p.id, ...ev }), 'Evidence reference recorded.')) setEv({ ref: '', sha256: '', note: '', requestKey: key() }); }}>Record evidence</Button></div>
          <p className="text-xs text-muted-foreground sm:col-span-2">Record a pointer and its hash, not a copy of production data. Synthetic security testing belongs in Security Lab.</p>
        </div>}
      </div>
      <div><p className="text-xs font-medium">Tests ({p.tests.length})</p>
        {p.tests.length > 0 && <ul className="mt-1 space-y-1">{p.tests.map((x: any) => <li key={x.id} className="text-xs"><Status value={x.result} /> {x.control} · sample {x.sampleSize} · evidence {x.evidenceIds.map((i: number) => `#${i}`).join(', ')} · {x.tester}{x.note ? ` — ${x.note}` : ''}</li>)}</ul>}
        {p.state === 'fieldwork' && <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select aria-label="Control" className={sel} value={t.controlId} onChange={(e) => setT({ ...t, controlId: e.target.value })}><option value="">Control…</option>{ctrls.map((c: any) => <option key={c.id} value={c.id}>{c.code} {c.title}</option>)}</select>
          <select aria-label="Result" className={sel} value={t.result} onChange={(e) => setT({ ...t, result: e.target.value })}>{['pass', 'fail', 'exception'].map((r) => <option key={r}>{r}</option>)}</select>
          <Input aria-label="Sample size" type="number" min={1} value={t.sampleSize} onChange={(e) => setT({ ...t, sampleSize: Number(e.target.value) })} />
          <Input aria-label="Test note" placeholder="Note" value={t.note} onChange={(e) => setT({ ...t, note: e.target.value })} />
          <div className="flex flex-wrap gap-2 text-xs sm:col-span-2">{p.evidence.map((e: any) => <label key={e.id} className="flex items-center gap-1"><input type="checkbox" checked={t.evidenceIds.includes(e.id)} onChange={(x) => setT({ ...t, evidenceIds: x.target.checked ? [...t.evidenceIds, e.id] : t.evidenceIds.filter((i) => i !== e.id) })} />#{e.id}</label>)}</div>
          <div><Button size="sm" disabled={!t.controlId || !t.evidenceIds.length} onClick={async () => { if (await act(() => audit({ action: 'test', planId: p.id, controlId: Number(t.controlId), evidenceIds: t.evidenceIds, sampleSize: t.sampleSize, result: t.result as never, note: t.note }), 'Test recorded.')) setT({ ...t, evidenceIds: [], note: '' }); }}>Record test</Button></div>
        </div>}
      </div>
      {(p.state === 'fieldwork' || p.state === 'reporting') && <div><p className="text-xs font-medium">Issue a finding</p>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          <Input aria-label="Finding title" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <select aria-label="Severity" className={sel} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select>
          <select aria-label="Control (optional)" className={sel} value={f.controlId} onChange={(e) => setF({ ...f, controlId: e.target.value })}><option value="">No specific control</option>{ctrls.map((c: any) => <option key={c.id} value={c.id}>{c.code} {c.title}</option>)}</select>
          <Input aria-label="Management owner email" placeholder="Management owner email" value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} />
          <Input aria-label="Due date" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
          <Textarea aria-label="Finding detail" placeholder="Condition, criteria, cause, effect" className="sm:col-span-2" value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} />
          <div><Button size="sm" disabled={f.title.trim().length < 3 || !f.ownerEmail.includes('@')} onClick={async () => { if (await act(() => audit({ action: 'issue', planId: p.id, controlId: f.controlId ? Number(f.controlId) : null, severity: f.severity as never, title: f.title, detail: f.detail, ownerEmail: f.ownerEmail, due: f.due || null, requestKey: f.requestKey }), 'Finding issued; the owner was notified.')) setF({ controlId: '', severity: 'medium', title: '', detail: '', ownerEmail: '', due: '', requestKey: key() }); }}>Issue finding</Button></div>
        </div></div>}
    </div>
  );
}

function Finding({ f, d, reload }: { f: any; d: any; reload: () => void }) {
  const act = useAct(reload);
  const [text, setText] = useState('');
  const [ev, setEv] = useState('');
  const plan = d.plans.find((p: any) => p.title === f.planTitle && p.area === f.area);
  const step = (s: string, msg: string, evidenceId: number | null = null) => act(() => audit({ action: 'finding', findingId: f.id, step: s as never, text, evidenceId, expectedVersion: f.version }), msg).then((ok) => { if (ok) setText(''); });
  const canVerify = f.auditorView && f.state === 'awaiting_verification' && !f.mineToAnswer && !f.remediatedByMe;
  return (
    <li className="rounded border border-border p-3 text-sm">
      <p className="font-medium">{f.title} <span className="text-xs text-muted-foreground">· {f.severity} · {area(f.area)} · {f.planTitle}</span></p>
      <p className="text-xs"><Status value={f.state} /> {f.stateLabel}{f.due ? ` · due ${f.due}` : ''}</p>
      {f.detail && <p className="mt-1 whitespace-pre-wrap text-xs">{f.detail}</p>}
      <p className="text-xs text-muted-foreground">Issued by {f.issuedBy} to {f.owner}{f.control ? ` · ${f.control}` : ''}</p>
      {f.response && <p className="mt-1 text-xs"><b>Management response:</b> {f.response}</p>}
      {f.remediationNote && <p className="text-xs"><b>Remediation:</b> {f.remediationNote}{f.remediatedBy ? ` (${f.remediatedBy}, ${fmt(f.remediatedAt)})` : ''}</p>}
      {f.verifiedBy && <p className="text-xs"><b>Verified</b> by {f.verifiedBy}, {fmt(f.verifiedAt)}{f.verifyEvidenceId ? ` · evidence #${f.verifyEvidenceId}` : ''}</p>}
      {f.mineToAnswer && (f.state === 'issued' || f.state === 'responded') && <div className="mt-2 space-y-2">
        <Textarea aria-label="Your response or remediation" placeholder={f.state === 'issued' ? 'Management response: agree or disagree, and the plan' : 'What was fixed'} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex gap-2">
          <Button size="sm" variant={f.state === 'issued' ? 'default' : 'outline'} disabled={text.trim().length < 5} onClick={() => step('respond', 'Response recorded.')}>{f.state === 'issued' ? 'Respond' : 'Update response'}</Button>
          {f.state === 'responded' && <Button size="sm" disabled={text.trim().length < 5} onClick={() => step('remediate', 'Remediation recorded; an auditor will verify.')}>Mark remediated</Button>}
        </div></div>}
      {canVerify && <div className="mt-2 space-y-2">
        <select aria-label="Verification evidence" className={sel} value={ev} onChange={(e) => setEv(e.target.value)}><option value="">Evidence collected after remediation…</option>{(plan?.evidence ?? []).filter((e: any) => !f.remediatedAt || e.collectedAt >= f.remediatedAt).map((e: any) => <option key={e.id} value={e.id}>#{e.id} {e.ref}</option>)}</select>
        <Textarea aria-label="Verification note" placeholder="Why the remediation is not accepted (needed to return it)" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex gap-2"><Button size="sm" disabled={!ev} onClick={() => step('verify_accept', 'Verified and closed.', Number(ev))}>Verify and close</Button>
          <Button size="sm" variant="outline" disabled={text.trim().length < 5} onClick={() => step('verify_reject', 'Returned to the owner.')}>Not accepted</Button></div></div>}
      {f.auditorView && f.state === 'awaiting_verification' && !canVerify && <p className="mt-1 text-xs text-muted-foreground">Another auditor, independent of the owner and the remediator, verifies this.</p>}
    </li>
  );
}

export default function Audit() {
  const s = useLoad(() => audit({ action: 'get' }));
  const act = useAct(s.reload);
  const [g, setG] = useState({ email: '', purpose: '', areas: [] as string[], days: 60 });
  const [c, setC] = useState({ code: '', area: '', title: '', objective: '' });
  const [pl, setPl] = useState({ grantId: '', area: '', title: '', note: '' });
  return (
    <>
      <PageHeader eyebrow="Assurance" title="Audit and assurance" sub="Purpose-bound audit access, evidence references with hashes, tests, findings, management response and independent verification." />
      <Loadable state={s}>{(d: any) => {
        const myGrants = d.grants.filter((x: any) => x.mine && x.live);
        const toAnswer = d.findings.filter((f: any) => f.mineToAnswer);
        const audited = d.findings.filter((f: any) => f.auditorView);
        return (
          <div className="space-y-4">
            {toAnswer.length > 0 && <Panel title={`Findings issued to you · ${toAnswer.filter((f: any) => f.state !== 'closed').length} open`}><ul className="space-y-2">{toAnswer.map((f: any) => <Finding key={f.id} f={f} d={d} reload={s.reload} />)}</ul></Panel>}
            {d.areas.length > 0 ? <>
              <Panel title="Your audit access">
                <ul className="space-y-1 text-xs">{myGrants.map((x: any) => <li key={x.id}>{x.areas.map(area).join(', ')} — {x.purpose} · until {fmt(x.expiresAt)} · granted by {x.grantedBy}</li>)}</ul>
                <p className="mt-1 text-xs text-muted-foreground">Every view is logged against these grants. When a grant ends or is revoked, its plans and evidence disappear from this page.</p>
              </Panel>
              <Panel title="Controls">
                {d.controls.length ? <ul className="space-y-1 text-xs">{d.controls.map((x: any) => <li key={x.id}><b>{x.code}</b> {x.title} · {area(x.area)}{x.objective ? ` — ${x.objective}` : ''}</li>)}</ul> : <Empty>No controls defined.</Empty>}
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-4">
                  <Input aria-label="Control code" placeholder="FIN-12" value={c.code} onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase() })} />
                  <select aria-label="Control area" className={sel} value={c.area} onChange={(e) => setC({ ...c, area: e.target.value })}><option value="">Area…</option>{d.areas.map((a: string) => <option key={a} value={a}>{area(a)}</option>)}</select>
                  <Input aria-label="Control title" placeholder="Title" value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} />
                  <Input aria-label="Control objective" placeholder="Objective" value={c.objective} onChange={(e) => setC({ ...c, objective: e.target.value })} />
                  <div><Button size="sm" disabled={!c.area || c.title.trim().length < 3 || !/^[A-Z]{2,6}-[0-9]{1,4}$/.test(c.code)} onClick={async () => { if (await act(() => audit({ action: 'control', code: c.code, area: c.area as never, title: c.title, objective: c.objective }), 'Control defined.')) setC({ code: '', area: '', title: '', objective: '' }); }}>Define control</Button></div>
                </div>
              </Panel>
              {d.plans.map((p: any) => <Panel key={p.id} title={`Plan · ${p.title}`}><Plan p={p} d={d} reload={s.reload} /></Panel>)}
              <Panel title="Open an audit plan">
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <select aria-label="Under grant" className={sel} value={pl.grantId} onChange={(e) => setPl({ ...pl, grantId: e.target.value, area: '' })}><option value="">Under grant…</option>{myGrants.map((x: any) => <option key={x.id} value={x.id}>{x.purpose}</option>)}</select>
                  <select aria-label="Plan area" className={sel} value={pl.area} onChange={(e) => setPl({ ...pl, area: e.target.value })}><option value="">Area…</option>{(myGrants.find((x: any) => String(x.id) === pl.grantId)?.areas ?? []).map((a: string) => <option key={a} value={a}>{area(a)}</option>)}</select>
                  <Input aria-label="Plan title" placeholder="Title" value={pl.title} onChange={(e) => setPl({ ...pl, title: e.target.value })} />
                  <Input aria-label="Scope" placeholder="Scope" value={pl.note} onChange={(e) => setPl({ ...pl, note: e.target.value })} />
                  <div><Button size="sm" disabled={!pl.grantId || !pl.area || pl.title.trim().length < 3} onClick={async () => { if (await act(() => audit({ action: 'plan', grantId: Number(pl.grantId), area: pl.area as never, title: pl.title, note: pl.note }), 'Plan opened.')) setPl({ grantId: '', area: '', title: '', note: '' }); }}>Open plan</Button></div>
                </div>
              </Panel>
              <Panel title={`Findings in your areas · ${audited.filter((f: any) => f.state !== 'closed').length} open`}>{audited.length ? <ul className="space-y-2">{audited.map((f: any) => <Finding key={f.id} f={f} d={d} reload={s.reload} />)}</ul> : <Empty>No findings.</Empty>}</Panel>
            </> : !d.isAdmin && !toAnswer.length && <Panel><Empty>You have no audit access and no findings to answer. An administrator grants audit access for a stated purpose and period.</Empty></Panel>}
            {d.isAdmin && <>
              <Panel title="Audit access grants">
                {d.grants.length ? <ul className="space-y-1 text-xs">{d.grants.map((x: any) => (
                  <li key={x.id} className="flex flex-wrap items-center gap-2"><Status value={x.live ? 'active' : x.revokedAt ? 'revoked' : 'expired'} /> {x.auditor} · {x.areas.map(area).join(', ')} · {x.purpose} · until {fmt(x.expiresAt)} · by {x.grantedBy}{x.revokedBy ? ` · revoked by ${x.revokedBy}` : ''}
                    {x.live && <Button size="sm" variant="outline" onClick={() => act(() => audit({ action: 'revoke', grantId: x.id }), 'Revoked. Access ends on their next request.')}>Revoke</Button>}</li>))}</ul> : <Empty>No grants.</Empty>}
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <Input aria-label="Auditor email" placeholder="Auditor email" value={g.email} onChange={(e) => setG({ ...g, email: e.target.value })} />
                  <Input aria-label="Days" type="number" min={1} max={180} value={g.days} onChange={(e) => setG({ ...g, days: Number(e.target.value) })} />
                  <Input aria-label="Purpose" placeholder="Purpose (e.g. FY26 cash controls review)" className="sm:col-span-2" value={g.purpose} onChange={(e) => setG({ ...g, purpose: e.target.value })} />
                  <div className="flex flex-wrap gap-2 text-xs sm:col-span-2">{AREAS.map((a) => <label key={a} className="flex items-center gap-1"><input type="checkbox" checked={g.areas.includes(a)} onChange={(e) => setG({ ...g, areas: e.target.checked ? [...g.areas, a] : g.areas.filter((x) => x !== a) })} />{area(a)}</label>)}</div>
                  <div><Button size="sm" disabled={!g.email.includes('@') || g.purpose.trim().length < 10 || !g.areas.length} onClick={async () => { if (await act(() => audit({ action: 'grant', email: g.email, purpose: g.purpose, areas: g.areas as never, days: g.days }), 'Granted; they were notified.')) setG({ email: '', purpose: '', areas: [], days: 60 }); }}>Grant access</Button></div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">At most 180 days, named areas only. You cannot grant yourself. Administrators see grants and finding counts, not evidence.</p>
              </Panel>
              <Panel title="Findings by area">{d.summary.length ? <ul className="text-xs">{d.summary.map((x: any) => <li key={`${x.area}-${x.state}`}>{area(x.area)} · {x.state}: {x.n}</li>)}</ul> : <Empty>No findings yet.</Empty>}</Panel>
            </>}
          </div>
        );
      }}</Loadable>
    </>
  );
}
