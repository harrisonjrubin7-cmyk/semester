import { useState } from 'react';
import { toast } from 'sonner';
import { syllabusHub, gradeTracker } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';
import { compareVersions, weightsProposal } from '../lib/syllabusExtract';
import { DEFAULT_THRESHOLDS } from '../lib/gradeCalc';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';

function Review({ s, reload }: { s: any; reload: () => void }) {
  const v = s.versions[0]?.version ?? 1;
  const decide = async (key: string, decision: 'accepted' | 'rejected') => { try { await syllabusHub({ action: 'review', ref: s.ref, version: v, key, decision }); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  const task = async (d: any) => { try { await syllabusHub({ action: 'createTask', title: `${s.course}: ${d.label}`, date: d.date, ref: s.ref }); toast('Task added to Today.'); } catch (e) { toast(`! ${errMsg(e)}`); } };
  const accepted = s.weights.filter((w: any) => s.decisions[w.key] === 'accepted');
  const prop = weightsProposal(accepted);
  const apply = async () => {
    try {
      await gradeTracker({ action: 'saveCourse', id: null, name: `${s.course} (from syllabus v${v})`, doc: { credits: 3, mode: 'weighted', missingPolicy: 'exclude', extraCredit: false, thresholds: DEFAULT_THRESHOLDS, unsupportedRules: [], categories: prop.categories, assignments: [] } as any });
      toast('New grade-tracker plan created from the reviewed weights. Your existing plans were not changed.');
    } catch (e) { toast(`! ${errMsg(e)}`); }
  };
  const row = (item: any, kind: 'date' | 'weight') => {
    const d = s.decisions[item.key];
    return (
      <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 text-sm">
        <span className="min-w-0">{kind === 'date' ? <><b className="tabular-nums">{item.date}</b> · {item.label}</> : <><b>{item.name}</b> · {item.weight}%</>}
          <span className="block text-xs text-muted-foreground">Line {item.line}: “{item.text}”</span></span>
        <span className="flex items-center gap-2"><Status value={d === 'accepted' ? 'Accepted' : d === 'rejected' ? 'Rejected' : 'Pending review'} />
          {d !== 'accepted' && <Button size="sm" variant="outline" onClick={() => decide(item.key, 'accepted')}>Accept</Button>}
          {d !== 'rejected' && <Button size="sm" variant="ghost" onClick={() => decide(item.key, 'rejected')}>Reject</Button>}
          {kind === 'date' && d === 'accepted' && <Button size="sm" onClick={() => task(item)}>Create task</Button>}</span>
      </li>
    );
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Found by fixed patterns in version {v}. Nothing is used until you accept it; check each against the source line.</p>
      <div><p className="text-xs font-medium">Dates · {s.dates.length}</p>{s.dates.length ? <ul>{s.dates.map((d: any) => row(d, 'date'))}</ul> : <p className="text-xs text-muted-foreground">No dates found.</p>}</div>
      <div><p className="text-xs font-medium">Grading weights · {s.weights.length}</p>{s.weights.length ? <ul>{s.weights.map((w: any) => row(w, 'weight'))}</ul> : <p className="text-xs text-muted-foreground">No weights found.</p>}</div>
      {accepted.length > 0 && (
        <div className="rounded-md border border-border p-3 text-sm">
          <p className="font-medium">Use grading rules — preview</p>
          <ul className="text-xs">{prop.categories.map((c) => <li key={c.id}>{c.name}: {c.weight}%</li>)}</ul>
          <p className="text-xs">Total {prop.total}%{prop.applicable ? '' : ' — must total 100% before it can be used'}</p>
          <Button size="sm" className="mt-2" disabled={!prop.applicable} onClick={apply}>Create a grade-tracker plan from these</Button>
        </div>
      )}
    </div>
  );
}

function Versions({ s }: { s: any }) {
  const [a, setA] = useState(s.versions[1]?.version ?? s.versions[0]?.version);
  const [b, setB] = useState(s.versions[0]?.version);
  if (s.versions.length < 2) return <p className="text-xs text-muted-foreground">Only one version so far.</p>;
  const va = s.versions.find((x: any) => x.version === a), vb = s.versions.find((x: any) => x.version === b);
  const c = compareVersions(va?.body ?? '', vb?.body ?? '');
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">Compare <select aria-label="Older version" className={sel} value={a} onChange={(e) => setA(Number(e.target.value))}>{s.versions.map((x: any) => <option key={x.version} value={x.version}>v{x.version}</option>)}</select>
        with <select aria-label="Newer version" className={sel} value={b} onChange={(e) => setB(Number(e.target.value))}>{s.versions.map((x: any) => <option key={x.version} value={x.version}>v{x.version}</option>)}</select></div>
      <ul className="text-xs">{c.removed.map((x, i) => <li key={`r${i}`}>− {x}</li>)}{c.added.map((x, i) => <li key={`a${i}`}>+ {x}</li>)}{!c.removed.length && !c.added.length && <li>No line changes.</li>}</ul>
    </div>
  );
}

function AddPrivate({ reload, edit }: { reload: () => void; edit?: any }) {
  const [f, setF] = useState({ course: edit?.course ?? '', title: edit?.title ?? '', sourceRef: edit?.sourceRef ?? '', body: edit?.versions?.[0]?.body ?? '', effectiveDate: edit?.versions?.[0]?.effectiveDate ?? '', note: '' });
  const save = async () => {
    try { await syllabusHub({ action: 'save', docId: edit?.docId ?? null, ...f, effectiveDate: f.effectiveDate || null, expectedVersion: edit?.versions?.[0]?.version ?? 0 });
      toast(edit ? 'New version saved.' : 'Syllabus added. Review what was found before using it.'); reload(); } catch (e) { toast(`! ${errMsg(e)}`); }
  };
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <Input aria-label="Course" placeholder="Course, e.g. ECON 1010" value={f.course} onChange={(e) => setF({ ...f, course: e.target.value })} />
      <Input aria-label="Title" placeholder="Title, e.g. Fall 2026 syllabus" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <Input aria-label="Source" placeholder="Where it came from (file name, page, link)" value={f.sourceRef} onChange={(e) => setF({ ...f, sourceRef: e.target.value })} />
      <label className="text-xs">Effective date (optional)<Input className="mt-1" type="date" value={f.effectiveDate} onChange={(e) => setF({ ...f, effectiveDate: e.target.value })} /></label>
      <Textarea aria-label="Syllabus text" className="min-h-40 sm:col-span-2" placeholder="Paste the syllabus text" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      {edit && <Input aria-label="What changed" className="sm:col-span-2" placeholder="What changed in this version" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />}
      <p className="text-xs text-muted-foreground sm:col-span-2">PDF extraction is not implemented. Paste the text; the file itself is not read.</p>
      <div><Button size="sm" disabled={f.course.trim().length < 2 || f.title.trim().length < 2 || f.sourceRef.trim().length < 3 || f.body.trim().length < 20} onClick={save}>{edit ? 'Save as new version' : 'Add syllabus'}</Button></div>
    </div>
  );
}

export default function SyllabusHub() {
  const s = useLoad(() => syllabusHub({ action: 'get' }));
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<'read' | 'review' | 'versions' | 'edit'>('review');
  return (
    <>
      <PageHeader eyebrow="Learn" title="Syllabi" sub="Your course syllabi in one place. Dates and grading weights found in them wait for your review before they become tasks or grade settings." />
      <Loadable state={s}>{(d: any) => {
        const all = [...d.official.map((x: any) => ({ ...x, kind: 'official' })), ...d.mine.map((x: any) => ({ ...x, kind: 'mine' }))]
          .filter((x) => !q || `${x.course} ${x.title} ${x.versions[0]?.body ?? ''}`.toLowerCase().includes(q.toLowerCase()));
        return (
          <div className="space-y-4">
            <Panel title={`Syllabi · ${all.length}`}>
              <Input aria-label="Search syllabi" placeholder="Search course, title or text" className="mb-2 max-w-md" value={q} onChange={(e) => setQ(e.target.value)} />
              {all.length === 0 ? <Empty>No syllabi yet. Your instructors' published syllabi appear here, and you can add your own below.</Empty> : (
                <ul className="space-y-2">{all.map((x: any) => {
                  const pending = [...x.dates, ...x.weights].filter((i: any) => !x.decisions[i.key]).length;
                  return (
                    <li key={x.ref} className="rounded-md border border-border p-3">
                      <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left text-sm" aria-expanded={open === x.ref} onClick={() => setOpen(open === x.ref ? null : x.ref)}>
                        <span><b>{x.course}</b> · {x.title}<span className="block text-xs text-muted-foreground">{x.kind === 'official' ? (x.instructorPublished ? `Published by your instructor · v${x.versions[0].version} · ${fmt(x.versions[0].at)}` : 'Your instructor has not published a syllabus yet') : `Added by you · source: ${x.sourceRef} · v${x.versions[0]?.version}`}</span></span>
                        <Status value={pending ? `${pending} to review` : 'Reviewed'} /></button>
                      {open === x.ref && x.versions.length > 0 && (
                        <div className="mt-3 space-y-3">
                          <div className="flex flex-wrap gap-1">{(['review', 'read', 'versions', ...(x.kind === 'mine' ? ['edit'] : [])] as const).map((t) => <Button key={t} size="sm" variant={tab === t ? 'default' : 'outline'} onClick={() => setTab(t as never)}>{t === 'review' ? 'Review extracted items' : t === 'read' ? 'Read' : t === 'versions' ? 'Compare versions' : 'New version'}</Button>)}</div>
                          {tab === 'review' && <Review s={x} reload={s.reload} />}
                          {tab === 'read' && <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">{x.versions[0].body}</pre>}
                          {tab === 'versions' && <Versions s={x} />}
                          {tab === 'edit' && x.kind === 'mine' && <AddPrivate edit={x} reload={s.reload} />}
                        </div>)}
                    </li>);
                })}</ul>)}
            </Panel>
            <Panel title="Add a syllabus"><AddPrivate reload={s.reload} /></Panel>
          </div>
        );
      }}</Loadable>
    </>
  );
}
