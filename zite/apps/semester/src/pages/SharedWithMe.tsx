import { useState } from 'react';
import { advisorShare, AdvisorShareOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { PageHeader, Panel, Empty, Loadable, useLoad, fmtDay, Status, SourceTag } from '../components/kit';

type Student = { id: string; name: string; categories: string[]; expiresOn: string | null };

function StudentView({ id }: { id: string }) {
  const v = useLoad(() => advisorShare({ action: 'view', studentId: id }), [id]);
  return (
    <Loadable state={v}>{(d: AdvisorShareOutputType) => (
      <div className="space-y-4">
        <p className="rounded-[3px] border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          {d.student!.name} shares: {d.student!.categories.join(', ')} · until {fmtDay(d.student!.expiresOn)}. This view was logged in their access history. Anything not listed here is not shared with you.
        </p>
        {d.degree && (
          <Panel title={`Degree progress · ${d.degree.creditsEarned} credits earned`}>
            {d.degree.completed.length ? (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground"><th className="py-1">Course</th><th>Term</th><th>Grade</th><th>Source</th></tr></thead>
                <tbody>{d.degree.completed.map((c: { id: string; code: string; title: string; term: string; grade: string; source: string }) => (
                  <tr key={c.id} className="border-t border-border"><td className="py-2"><span className="font-mono">{c.code}</span> <span className="text-xs text-muted-foreground">{c.title}</span></td><td>{c.term}</td><td className="tabular-nums">{c.grade}</td><td><SourceTag source={c.source || 'Official'} /></td></tr>))}</tbody>
              </table></div>) : <Empty>No released grades yet.</Empty>}
          </Panel>
        )}
        {d.plan && (
          <Panel title="Registration plan">
            {d.plan.length ? <ul className="divide-y divide-border text-sm">{d.plan.map((p: { id: string; code: string; title: string; term: string; status: string }) => (
              <li key={p.id} className="flex items-center justify-between py-2"><span><span className="font-mono">{p.code}</span> <span className="text-xs text-muted-foreground">{p.title} · {p.term}</span></span><Status value={p.status === 'Requested' ? 'Waiting for Registrar' : p.status} /></li>))}</ul>
              : <Empty>No sections planned.</Empty>}
          </Panel>
        )}
        {d.holds && (
          <Panel title="Holds">
            {d.holds.length ? <ul className="space-y-1 text-sm">{d.holds.map((h: { id: string; title: string; office: string; source: string }) => <li key={h.id}>! {h.title} <span className="text-xs text-muted-foreground">· {h.office}</span> <SourceTag source={h.source || 'Official'} /></li>)}</ul>
              : <Empty>No open holds.</Empty>}
          </Panel>
        )}
        {d.agenda && (
          <Panel title="Advising agenda">
            {d.agenda.body ? <p className="whitespace-pre-wrap text-sm">{d.agenda.body}</p> : <Empty>The student hasn’t shared an agenda yet.</Empty>}
          </Panel>
        )}
      </div>
    )}</Loadable>
  );
}

export default function SharedWithMe() {
  const s = useLoad(() => advisorShare({ action: 'students' }));
  const [sel, setSel] = useState<string | null>(null);
  return (
    <>
      <PageHeader eyebrow="Advisor" title="Shared with me" sub="Students who chose to share parts of their record with you. You see only what each student ticked, until their end date." />
      <Loadable state={s}>{(d) => {
        const students = d.students as Student[];
        if (!students.length) return <Empty>No student is sharing with you right now. Students share from Help → Advising prep.</Empty>;
        const current = sel && students.some((x) => x.id === sel) ? sel : students[0].id;
        return (
          <div className="grid gap-4 lg:grid-cols-[1fr_2.2fr]">
            <Panel title={`Students (${students.length})`}>
              <ul className="space-y-1">{students.map((x) => (
                <li key={x.id}><Button variant={x.id === current ? 'secondary' : 'ghost'} className="h-auto w-full justify-start py-2 text-left" aria-current={x.id === current ? 'true' : undefined} onClick={() => setSel(x.id)}>
                  <span><span className="block font-medium">{x.name}</span><span className="block text-xs text-muted-foreground">{x.categories.join(', ')} · until {fmtDay(x.expiresOn)}</span></span>
                </Button></li>))}</ul>
            </Panel>
            <StudentView key={current} id={current} />
          </div>
        );
      }}</Loadable>
    </>
  );
}
