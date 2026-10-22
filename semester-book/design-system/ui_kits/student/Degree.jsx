function DegreeScreen({ go }) {
  const N = window.SemesterDesignSystem_e9f3ba;
  const reqs = [
    { name: 'Core curriculum', done: 36, of: 40, state: 'current', note: 'One writing-intensive course left' },
    { name: 'Biology major', done: 32, of: 48, state: 'current', note: 'BIO 330 and two 400-level electives' },
    { name: 'Chemistry minor', done: 12, of: 18, state: 'current', note: 'CHEM 220 planned for spring' },
    { name: 'Free electives', done: 14, of: 14, state: 'done', note: 'Complete' },
  ];
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">My Path · Degree</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>B.S. Biology, minor in Chemistry</h1></div>
        <div style={{ display: 'flex', gap: 8 }}><N.Button icon="meet" onClick={() => go('advising')}>Prepare for advising</N.Button><N.Button variant="primary" icon="calendar" onClick={() => go('registration')}>Plan spring</N.Button></div></div>
      <N.SourceLine source="official" by="Degree audit · Registrar" when="Updated 3 Oct">
        <p className="editorial" style={{ fontSize: 'var(--type-4xl)', lineHeight: 1.1, maxWidth: '20ch' }}>94 of 120 credits. On track for May 2028.</p>
      </N.SourceLine>
      <div className="cols sec">
        <div>
          <N.SectionLabel aside="4 requirement groups">Requirements</N.SectionLabel>
          {reqs.map((r) => (
            <div key={r.name} style={{ padding: '14px 0', borderBottom: '1px solid var(--border-subtle)', display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}><span style={{ fontSize: 'var(--type-md)', fontWeight: 500 }}>{r.name}</span><span className="nums" style={{ fontSize: 'var(--type-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.done} / {r.of} credits</span></div>
              <div aria-hidden="true" style={{ height: 4, background: 'var(--surface-sunken)', borderRadius: 2 }}><div style={{ width: (r.done / r.of) * 100 + '%', height: '100%', background: r.state === 'done' ? 'var(--status-success)' : 'var(--action-primary)', borderRadius: 2 }}></div></div>
              <div style={{ fontSize: 'var(--type-sm)', color: 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'baseline' }}>{r.state === 'done' ? <N.StatusChip status="verified" label="Complete" /> : null}{r.note}</div>
            </div>
          ))}
        </div>
        <aside className="stack">
          <N.SectionLabel>What-if</N.SectionLabel>
          <N.ObjectCard kind="Scenario" statuses={[]} title="Add a Data Science minor" provenance={{ origin: 'estimated', age: 'Worked out by Semester' }} explanation="Adds 18 credits. Graduation likely moves to December 2028 unless you take two summer courses." primary={{ label: 'Compare plans' }} secondary={{ label: 'Bring to advising', onClick: () => go('advising') }} />
          <N.Notice head="Note">The Registrar’s degree audit is the official record. Plans and what-ifs are yours until an advisor approves them.</N.Notice>
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { DegreeScreen });
