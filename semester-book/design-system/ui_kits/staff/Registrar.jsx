function RegistrarScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [decide, setDecide] = React.useState(null); const [done, setDone] = React.useState({});
  const reqs = [{ id: 'r1', st: 'Maya Lindqvist', sec: 'BIO 410-01 · Research Seminar', why: 'Instructor consent required', at: 'Oct 6 · 14:20' }, { id: 'r2', st: 'Omar Haddad', sec: 'CHEM 220-02 · Organic Chem I', why: 'Over credit limit (20 of 18)', at: 'Oct 6 · 15:02' }, { id: 'r3', st: 'Lena Brooks', sec: 'ENGL 245-03', why: 'Time conflict with SPAN 201', at: 'Oct 7 · 08:11' }];
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Registrar · Spring 2027</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Registration desk</h1></div><div style={{ display: 'flex', gap: 8 }}><N.StatusChip status="live" label="Add/drop open until 23 Jan" /></div></div>
      <div className="cols">
        <div className="stack">
          <N.SectionLabel aside={reqs.length - Object.keys(done).length + ' waiting'}>Approval requests</N.SectionLabel>
          <N.DataTable caption="Requests" columns={[{ key: 'st', label: 'Student' }, { key: 'sec', label: 'Section' }, { key: 'why', label: 'Needs approval because' }, { key: 'at', label: 'Asked' }, { key: 'a', label: '', render: (r) => done[r.id] ? <N.StatusChip status={done[r.id]} /> : <N.Button size="sm" onClick={() => setDecide(r)}>Decide…</N.Button> }]} rows={reqs} />
          <N.SectionLabel>Section capacity</N.SectionLabel>
          <N.DataTable caption="Capacity" columns={[{ key: 's', label: 'Section' }, { key: 'c', label: 'Seats', numeric: true }, { key: 'w', label: 'Waitlist', numeric: true }, { key: 'x', label: 'State', render: (r) => <N.StatusChip status={r.x} label={r.l} /> }]} rows={[{ s: 'CHEM 220-02', c: '60 / 60', w: '2 / 10', x: 'pending', l: 'Full' }, { s: 'BIO 330-01', c: '38 / 40', w: '0 / 5', x: 'live', l: 'Open' }, { s: 'ENGL 245-03', c: '14 / 18', w: '—', x: 'live', l: 'Open' }]} />
        </div>
        <aside><N.SectionLabel>Record changes today</N.SectionLabel>
          <N.DecisionTrail items={[{ title: 'Grade change · BIO 210 · Ben Hartley', who: 'Prof. Okafor', when: '08:40', detail: 'Quiz 4: 16 → 18 after regrade' }, { title: 'Withdrawal recorded · PSYC 101', who: 'J. Park', when: '08:12' }, { title: 'Hold cleared · Immunization', who: 'Student Health', when: '07:55' }]} />
        </aside>
      </div>
      {decide && <N.Dialog title={'Approve ' + decide.sec.split(' · ')[0] + '?'} confirmLabel="Approve and enroll" onCancel={() => setDecide(null)} onConfirm={() => { setDone((d) => ({ ...d, [decide.id]: 'approved' })); setDecide(null); }}>
        <N.ActionPreview subject={decide.st + ' · ' + decide.sec} says="The student is enrolled and told in Semester and by email." exactly={decide.why + '.'} doesNotChange="The section’s waitlist order is unchanged." recovery={{ kind: 'request', how: 'drop the student from the section; it is recorded in the audit log.' }} subjectTo="Written to the institution’s record of registration before the student is told." />
      </N.Dialog>}
    </div>
  );
}
Object.assign(window, { RegistrarScreen });
