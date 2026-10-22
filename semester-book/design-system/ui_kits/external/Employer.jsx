function EmployerScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Employer · Genvia Bio · Verified partner</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Lab technician intern · Summer 2027</h1></div><div style={{ display: 'flex', gap: 8 }}><N.StatusChip status="live" label="Posting live · closes 1 Dec" /><N.Button>Edit posting</N.Button></div></div>
      <div className="cols">
        <div className="stack"><N.SectionLabel aside="23">Applicants</N.SectionLabel>
          <N.DataTable caption="Applicants" columns={[{ key: 'n', label: 'Applicant' }, { key: 'p', label: 'Program' }, { key: 'e', label: 'Evidence shared' }, { key: 's', label: 'Stage', render: (r) => <N.StatusChip status={r.s} label={r.l} /> }]} rows={[{ n: 'Maya Lindqvist', p: 'Biology ’28', e: '2 verified artifacts', s: 'queued', l: 'New' }, { n: 'Omar Haddad', p: 'Chemistry ’27', e: 'Résumé only', s: 'pending', l: 'Interview Oct 20' }, { n: 'Lena Brooks', p: 'Biology ’27', e: '1 verified artifact', s: 'approved', l: 'Offer sent' }]} />
        </div>
        <aside className="stack"><N.SectionLabel>What you can see</N.SectionLabel>
          <N.Fields items={[{ field: 'Shared by applicants', value: 'Name, program, résumé, artifacts they attach' }, { field: 'Never shared', value: 'Grades (unless attached), aid, disability, contact beyond school email' }, { field: 'Verified', value: 'Artifacts with ◆ were graded by Northfield faculty' }]} />
          <N.Notice head="Partner rules">Verified means Northfield’s partner review passed on 12 Aug 2026. It isn’t an endorsement of the role.</N.Notice>
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { EmployerScreen });
