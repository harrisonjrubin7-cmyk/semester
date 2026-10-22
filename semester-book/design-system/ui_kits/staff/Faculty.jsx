function FacultyScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [rows, setRows] = React.useState([{ id: 's1', name: 'Amara Diallo', score: '36', state: 'released' }, { id: 's2', name: 'Ben Hartley', score: '29', state: 'draft' }, { id: 's3', name: 'Maya Lindqvist', score: '', state: 'missing' }, { id: 's4', name: 'Rui Tanaka', score: '38', state: 'draft' }]);
  const [release, setRelease] = React.useState(false); const [done, setDone] = React.useState(false);
  const drafts = rows.filter((r) => r.state === 'draft').length;
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Faculty · BIO 210 · Section 02</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Gradebook</h1></div><div style={{ display: 'flex', gap: 8 }}><N.Button icon="export">Export</N.Button><N.Button variant="primary" onClick={() => setRelease(true)} disabled={!drafts}>Release {drafts} drafts…</N.Button></div></div>
      {done && <div style={{ marginBottom: 16 }}><N.SuccessState title="Scores released for Lab report 2" body="Students see them now. They can ask for a regrade from their Grades screen." /></div>}
      <div className="cols">
        <div className="stack">
          <N.SectionLabel aside="40 points · Lab reports 30%">Scores for Lab report 2</N.SectionLabel>
          <N.DataTable caption="Scores" columns={[{ key: 'name', label: 'Student' }, { key: 'score', label: 'Score', numeric: true, render: (r) => <input className="input score nums" aria-label={'Score for ' + r.name} value={r.score} placeholder="—" onChange={(e) => setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, score: e.target.value, state: 'draft' } : x))} /> }, { key: 'state', label: 'State', render: (r) => <N.StatusChip status={r.state === 'released' ? 'live' : r.state === 'missing' ? 'action-required' : 'draft'} label={r.state === 'released' ? 'Released' : r.state === 'missing' ? 'Missing' : 'Draft'} /> }]} rows={rows} />
          <p style={{ fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>Drafts are visible only to you and your TAs. Semester checks a student is enrolled before it saves a score.</p>
        </div>
        <aside className="stack"><N.SectionLabel aside="1 open">Regrade requests</N.SectionLabel>
          <div className="object-card"><div className="object-card-eyebrow">Quiz 4 · Ben Hartley · Oct 4</div><p style={{ fontSize: 'var(--type-base)' }}>“Question 3 accepts either inhibitor type per the lecture slide on Sep 29.”</p><N.Select label="Decision" options={['Keep the grade', 'Change the grade']} /><N.TextField label="Note to the student" /><div className="object-card-actions"><N.Button variant="primary" size="sm">Send decision</N.Button></div></div>
          <N.SectionLabel>Grading scheme</N.SectionLabel>
          <N.Fields items={[{ field: 'Lab reports', value: '30%' }, { field: 'Quizzes', value: '20%' }, { field: 'Midterm', value: '20%' }, { field: 'Final', value: '30%' }]} />
        </aside>
      </div>
      {release && <N.Dialog title="Release 2 draft scores?" confirmLabel="Release scores" onCancel={() => setRelease(false)} onConfirm={() => { setRelease(false); setDone(true); setRows((rs) => rs.map((r) => r.state === 'draft' ? { ...r, state: 'released' } : r)); }}>
        <N.ActionPreview subject="Lab report 2 · BIO 210-02" says="Ben Hartley and Rui Tanaka see their scores and comments now." doesNotChange="Maya Lindqvist stays Missing; nothing is released for her." recovery={{ kind: 'request', how: 'change a released score; the student sees the change and its date.' }} />
      </N.Dialog>}
    </div>
  );
}
Object.assign(window, { FacultyScreen });
