function StudentAffairsScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Student affairs · Basic needs</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Requests for support</h1><p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Students asked for help. Only what each student chose to share is shown.</p></div><N.Button icon="support">Resource directory</N.Button></div>
      <div className="cols">
        <div className="stack">
          <N.DataTable caption="Support requests" columns={[{ key: 'w', label: 'Received' }, { key: 'k', label: 'Asked for' }, { key: 's', label: 'Shared by student' }, { key: 'st', label: 'State', render: (r) => <N.StatusChip status={r.st} label={r.l} /> }]} rows={[{ w: 'Oct 7 · 08:40', k: 'Emergency meal swipes', s: 'Name, email', st: 'pending', l: 'Reply within 1 business day' }, { w: 'Oct 6 · 19:12', k: 'Short-term housing', s: 'Name only', st: 'pending', l: 'Assigned to you' }, { w: 'Oct 5 · 11:03', k: 'Book costs', s: 'Anonymous', st: 'approved', l: 'Resolved · grant sent' }]} />
          <div className="object-card"><div className="object-card-eyebrow">Request · Oct 7 · 08:40</div><div className="object-card-title">Emergency meal swipes</div><p className="object-card-why">“My meal plan ran out and aid hasn’t come through yet.”</p><N.ProvenanceChips origin="personal" by="Shared by the student" age="Name and email only" />
            <div className="object-card-actions"><N.Button variant="primary">Offer 14 swipes…</N.Button><N.Button>Reply</N.Button><button className="link-quiet">Refer to Financial Aid</button></div></div>
        </div>
        <aside className="stack"><N.SectionLabel>Never shown here</N.SectionLabel>
          <N.Notice head="Privacy">Counseling, health and disability records are never visible in this workspace. Grades and billing appear only if the student shares them for this request.</N.Notice>
          <N.DecisionTrail items={[{ title: 'Request received', who: 'Student', when: '08:40' }, { title: 'Assigned to you', who: 'Queue rule · Basic needs', when: '08:41' }, { title: 'First reply', state: 'current', who: 'Due by Oct 8 · 08:40' }]} />
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { StudentAffairsScreen });
