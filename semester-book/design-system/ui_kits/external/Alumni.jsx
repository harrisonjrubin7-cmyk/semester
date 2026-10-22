function AlumniScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Alumni · B.S. Biology ’19</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Dr. Priya Raman</h1></div><div style={{ display: 'flex', gap: 8 }}><N.Button icon="export">Download records</N.Button><N.Button variant="primary" icon="people">Mentor a student</N.Button></div></div>
      <div className="cols">
        <div className="stack"><N.SectionLabel>Verified achievements</N.SectionLabel>
          <N.DataTable caption="Credentials" columns={[{ key: 'c', label: 'Credential' }, { key: 'd', label: 'Awarded' }, { key: 's', label: 'Verification', render: (r) => <N.SourceBadge source={r.s} /> }]} rows={[{ c: 'B.S. Biology, magna cum laude', d: 'May 2019', s: 'official' }, { c: 'Undergraduate research fellowship', d: '2018', s: 'official' }, { c: 'Lab safety certification', d: '2023', s: 'personal' }]} />
          <N.SectionLabel aside="2">Mentoring requests</N.SectionLabel>
          <N.ObjectCard kind="Request" title="Maya Lindqvist · Biology ’28" provenance={{ origin: 'personal', by: 'Sent by the student' }} explanation="“I’m applying to lab technician internships and would value 20 minutes on what Genvia looks for.”" primary={{ label: 'Accept and pick a time' }} secondary={{ label: 'Decline politely' }} />
        </div>
        <aside className="stack"><N.SectionLabel>Your visibility</N.SectionLabel><N.VisibilityPicker value="course" allowed={['only-me', 'course', 'portfolio']} origin="institution-provided" /></aside>
      </div>
    </div>
  );
}
Object.assign(window, { AlumniScreen });
