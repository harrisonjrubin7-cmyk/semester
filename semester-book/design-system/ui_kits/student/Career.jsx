function CareerScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Career</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Toward research and lab work</h1></div><div style={{ display: 'flex', gap: 8 }}><N.Button icon="export">Export portfolio</N.Button><N.Button variant="primary" icon="opportunities">Browse opportunities</N.Button></div></div>
      <div className="cols">
        <div className="stack">
          <N.SectionLabel aside="3 open">Applications</N.SectionLabel>
          <N.DataTable caption="Applications" columns={[{ key: 'r', label: 'Role' }, { key: 'o', label: 'Organisation' }, { key: 's', label: 'State', render: (r) => <N.StatusChip status={r.s} label={r.l} /> }, { key: 'd', label: 'Next' }]} rows={[{ r: 'Summer research assistant', o: 'Okafor Lab, Northfield', s: 'pending', l: 'Interview Oct 15', d: 'Prepare' }, { r: 'Lab technician intern', o: 'Genvia Bio', s: 'queued', l: 'Submitted', d: 'Wait' }, { r: 'Peer tutor · BIO 110', o: 'Learning Center', s: 'approved', l: 'Offer', d: 'Reply by Oct 12' }]} />
          <N.SectionLabel>Evidence</N.SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <N.ObjectCard kind="Artifact" title="Enzyme kinetics lab report" provenance={{ origin: 'official', by: 'BIO 210 · graded' }} metadata="34 / 40 · Sep 24" secondary={{ label: 'Add to portfolio' }} />
            <N.ObjectCard kind="Skill" title="Spectrophotometry" provenance={{ origin: 'personal' }} explanation="You added this. Link it to a graded artifact to have it verified." secondary={{ label: 'Link evidence' }} />
          </div>
        </div>
        <aside className="stack"><N.SectionLabel>People</N.SectionLabel>
          <N.NextSteps steps={[{ label: 'Dr. Priya Raman · alumna ’19', why: 'Genvia Bio. Open to 20-minute chats.', icon: 'people' }, { label: 'Career Center drop-in', why: 'Résumé review · Thu 14:00–16:00', icon: 'career' }]} />
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { CareerScreen });
