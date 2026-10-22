function PrivacyScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [del, setDel] = React.useState(false);
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">You · Privacy & data</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Your data</h1><p style={{ color: 'var(--text-secondary)', marginTop: 6, maxWidth: '62ch' }}>What Semester holds, why, who can see it, and how to take it with you or remove it.</p></div><N.Button icon="export">Export everything</N.Button></div>
      <div className="cols">
        <div className="stack">
          <N.DataTable caption="What Semester holds" columns={[{ key: 'w', label: 'What' }, { key: 'f', label: 'From', render: (r) => <N.SourceBadge source={r.f} /> }, { key: 'wh', label: 'Kept' }, { key: 's', label: 'Who else can see it' }]} rows={[{ w: 'Courses, schedule, holds', f: 'official', wh: 'While enrolled', s: 'Nobody new — your school already has it' }, { w: 'Assignments and due dates', f: 'connected', wh: 'Until you disconnect Canvas', s: 'Nobody' }, { w: 'Notes, drafts, plans', f: 'personal', wh: 'Until you delete them', s: 'Only people you share with' }, { w: 'Ask Semester history', f: 'ai', wh: '30 days, then deleted', s: 'Nobody' }]} />
          <N.SectionLabel>Assistant</N.SectionLabel>
          <N.Switch label="Let Ask Semester read my calendar" checked onChange={() => {}} /><N.Switch label="Let Ask Semester read my notes" onChange={() => {}} /><N.Switch label="Keep Ask Semester history" checked onChange={() => {}} />
        </div>
        <aside className="stack"><N.SectionLabel>Leaving</N.SectionLabel>
          <div className="object-card"><div className="object-card-title" style={{ fontSize: 'var(--type-md)' }}>Delete your Semester account</div><p className="object-card-why" style={{ fontSize: 'var(--type-sm)' }}>Removes everything you made here. Your school’s records stay with your school.</p><div className="object-card-actions"><N.Button variant="danger" size="sm" onClick={() => setDel(true)}>Delete account…</N.Button></div></div>
        </aside>
      </div>
      {del && <N.Dialog title="Delete your Semester account?" confirmLabel="Delete account" cancelLabel="Keep my account" destructive onCancel={() => setDel(false)} onConfirm={() => setDel(false)}>
        <N.ActionPreview subject="maya.lindqvist@northfield.edu" says="Your notes, drafts, plans, shares and Ask Semester history are deleted within 30 days. Shares stop opening now." doesNotChange="Grades, transcripts, billing and enrollment stay with Northfield University." recovery={{ kind: 'request', how: 'cancel within 30 days by signing in again.' }} subjectTo="Export first if you want a copy." />
      </N.Dialog>}
    </div>
  );
}
Object.assign(window, { PrivacyScreen });
