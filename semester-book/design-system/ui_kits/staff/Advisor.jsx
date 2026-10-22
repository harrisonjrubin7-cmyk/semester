function AdvisorScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Advisor · Biology · 42 advisees</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Shared with you</h1><p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Students choose what to share and for how long. You see only what they ticked.</p></div><N.Button icon="calendar">Office hours</N.Button></div>
      <div className="cols">
        <div className="stack">
          <N.ObjectCard kind="Meeting share" statuses={['updated-today']} title="Maya Lindqvist · Spring planning" provenance={{ origin: 'personal', by: 'Shared by the student', age: 'Open until 5 Nov' }} metadata="Thu 16 Oct · 10:30 · Hensel 312" explanation="Agenda (3), one plan scenario, three saved courses. Opened by you: not yet." primary={{ label: 'Open share' }} secondary={{ label: 'Propose a time' }} />
          <N.SectionLabel aside="4">Upcoming</N.SectionLabel>
          <N.DataTable caption="Advising appointments" columns={[{ key: 'w', label: 'When' }, { key: 's', label: 'Student' }, { key: 'r', label: 'Reason' }, { key: 'sh', label: 'Shared', render: (r) => r.sh ? <N.StatusChip status="verified" label="Agenda shared" /> : <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--type-sm)' }}>Nothing shared</span> }]} rows={[{ w: 'Thu 10:30', s: 'Maya Lindqvist', r: 'Spring planning', sh: true }, { w: 'Thu 11:15', s: 'Omar Haddad', r: 'Major declaration', sh: false }, { w: 'Fri 09:00', s: 'Lena Brooks', r: 'Study abroad', sh: true }, { w: 'Fri 13:30', s: 'Jae Park', r: 'Withdrawal question', sh: false }]} />
        </div>
        <aside className="stack"><N.SectionLabel>Your authority</N.SectionLabel>
          <N.Fields items={[{ field: 'Can see', value: 'Shares students make with you; degree audit for advisees' }, { field: 'Can approve', value: 'Major/minor declarations, spring plans' }, { field: 'Cannot', value: 'Grades, billing, health, counseling' }]} />
          <N.Notice head="Note">Semester doesn’t flag or rank students. Alerts come from your institution’s early-alert policy, with its source shown.</N.Notice>
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { AdvisorScreen });
