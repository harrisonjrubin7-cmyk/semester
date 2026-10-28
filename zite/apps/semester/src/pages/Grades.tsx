import { progress, regrade } from 'zitejs/api';
import { RegradeButton, MyRegrade } from '../components/RegradeButton';
import { PageHeader, Panel, Empty, Loadable, useLoad, Metric, SourceTag, SourceLine } from '../components/kit';
import { SourceDetails } from '../components/overlays';

type G = { id: string; code: string; title: string; grade: string; term: string; source: string };

export default function Grades() {
  const s = useLoad(() => Promise.all([progress({ action: 'get' }), regrade({ action: 'mine' })]).then(([p, r]) => ({ ...p, regrades: r.items as MyRegrade[] })));
  return (
    <>
      <PageHeader eyebrow="Progress" title="Released course grades" sub="Final grades your instructors have released. Unreleased grades never show here." />
      <Loadable state={s}>{(d) => {
        const byTerm = (d.grades as G[]).reduce<Record<string, G[]>>((acc, g) => { (acc[g.term || 'Other'] ||= []).push(g); return acc; }, {});
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label="Estimated GPA" value={d.gpa ?? '—'} unit="released grades only" source="Made Here" />
              <Metric label="Credits earned" value={d.totalEarned} unit={`of ${d.totalReq}`} source={d.grades[0]?.source ?? 'Official'} />
              <Metric label="Courses graded" value={d.grades.length} />
            </div>
            <SourceLine source="Made Here" by="Worked out by Semester">
              <p className="text-sm">Your GPA here is an estimate from released grades only; your instructor’s final grade and the Registrar’s transcript are the ones that count.</p>
            </SourceLine>
            {Object.keys(byTerm).length ? Object.entries(byTerm).map(([term, gs]) => (
              <Panel key={term} title={term}>
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground"><th className="py-1">Course</th><th>Title</th><th>Grade</th><th>Source</th><th><span className="sr-only">Regrade</span></th></tr></thead>
                  <tbody>{gs.map((g) => (
                    <tr key={g.id} className="border-t border-border"><td className="py-2 font-mono">{g.code}</td><td>{g.title}</td><td className="font-display text-lg tabular-nums">{g.grade}</td>
                      <td><div className="flex items-center gap-2"><SourceTag source={g.source} /><SourceDetails source={g.source} usedIn="Grades · Degree path · GPA estimate" visibility="Only you, your instructor and the Registrar" /></div></td>
                      <td className="text-right"><RegradeButton enrollmentId={g.id} code={g.code} grade={g.grade} existing={d.regrades.find((r) => r.enrollmentId === g.id)} onDone={s.reload} /></td></tr>
                  ))}</tbody>
                </table>
              </Panel>
            )) : <Empty>No grades released yet. Grades appear here once your instructors release them.</Empty>}
          </div>
        );
      }}</Loadable>
    </>
  );
}
