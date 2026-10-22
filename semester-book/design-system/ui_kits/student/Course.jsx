function CourseScreen() {
  const N = window.SemesterDesignSystem_e9f3ba; const d = window.studentData;
  const [tab, setTab] = React.useState('Assignments');
  return (
    <div className="page">
      <div className="pagehead" style={{ alignItems: 'flex-start' }}>
        <div><div className="kicker">BIO 210 · Section 02 · Prof. A. Okafor</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Cell Biology</h1>
          <div style={{ marginTop: 10 }}><N.ProvenanceChips origin="official" by="Canvas via Northfield" cues={['synced']} age="Updated 12 min ago" /></div></div>
        <div className="row" style={{ display: 'flex', gap: 8 }}><N.Button icon="sources">Materials</N.Button><N.Button variant="primary" icon="ask">Study with Semester</N.Button></div>
      </div>
      <div style={{ marginBottom: 20 }}><N.Segmented label="Course sections" options={['Overview', 'Assignments', 'Materials', 'Grades']} value={tab} onChange={setTab} /></div>
      <div className="cols">
        <div className="stack">
          <N.ContextBar kicker="Assignment · Due Thu 9 Oct · 23:59" title="Lab report 3: Enzyme kinetics" states={<><N.StatusChip status="draft" /><N.SourceBadge source="official" by="Prof. Okafor" /><N.SaveState status="saved" /></>} actions={<><N.Button variant="primary">Continue writing</N.Button><N.Button>Submit…</N.Button></>} />
          <N.DataTable caption="Assignments" columns={[{ key: 'title', label: 'Assignment' }, { key: 'due', label: 'Due' }, { key: 'weight', label: 'Weight', numeric: true }, { key: 'status', label: 'State', render: (r) => <N.StatusChip status={r.status} /> }]} rows={d.assignments.filter((a) => a.course === 'BIO 210')} />
        </div>
        <aside className="stack">
          <div className="object-card"><div className="object-card-eyebrow">Course AI policy · set by instructor</div><div className="object-card-title">AI allowed for outlining and feedback</div><p className="object-card-why">Not for writing results or discussion. Semester enforces this in Write and Study for this course.</p><N.SourceBadge source="official" by="Syllabus §6" /></div>
          <div className="object-card"><div className="object-card-eyebrow">Rubric · 40 pts</div>
            <N.Fields items={[{ field: 'Data & figures', value: '15 pts' }, { field: 'Methods', value: '10 pts' }, { field: 'Discussion', value: '10 pts' }, { field: 'Citations', value: '5 pts' }]} /></div>
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { CourseScreen });
