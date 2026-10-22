function RegistrationScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [reviewing, setReviewing] = React.useState(null); const [mine, setMine] = React.useState([{ id: 'BIO 330-01', state: 'Enrolled' }, { id: 'CHEM 220-02', state: 'On the waitlist — number 3 in line' }]);
  const [said, setSaid] = React.useState(null);
  const sections = [
    { id: 'BIO 330-01', title: 'Genetics', cr: 4, meets: 'Mon Wed 10:00–11:15', taken: 38, cap: 40, wait: 0, note: 'In your plan' },
    { id: 'CHEM 220-02', title: 'Organic Chemistry I', cr: 4, meets: 'Tue Thu 13:00–14:15', taken: 60, cap: 60, wait: 2, note: 'Needs CHEM 120 first · met' },
    { id: 'ENGL 245-03', title: 'Writing about Science', cr: 3, meets: 'Fri 09:00–11:45', taken: 14, cap: 18, wait: 0, note: 'Counts toward Core · writing-intensive' },
    { id: 'BIO 410-01', title: 'Research Seminar', cr: 2, meets: 'Wed 16:00–17:50', taken: 9, cap: 12, wait: 0, note: 'Needs the registrar’s approval', approval: true },
  ];
  const landing = (s) => s.approval ? 'This section needs the registrar’s approval. Confirming sends a request; you are not enrolled until they approve it.' : s.taken >= s.cap ? `The section is full. Confirming puts you on the waitlist, number ${s.wait + 1} in line. You are not enrolled until a seat comes to you.` : `There is a seat (${s.taken} of ${s.cap} taken). Confirming enrolls you now.`;
  const label = (s) => s.approval ? 'Send the request' : s.taken >= s.cap ? 'Join the waitlist' : 'Confirm enrollment';
  const live = new Set(mine.map((m) => m.id));
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Plan · Registration · Spring 2027</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Registration</h1><p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Add/drop is open until Fri 23 Jan, 17:00. You can enroll and drop without a W until then.</p></div><N.StatusChip status="live" label="Window open" /></div>
      <div style={{ marginBottom: 20 }}><N.Notice head="Hold">A hold on your account stops you adding courses. Student Health can clear it; you can still drop or withdraw.</N.Notice></div>
      {said && <div style={{ marginBottom: 16 }}><N.SuccessState title={said} nextLabel="See your spring week" /></div>}
      <N.SectionLabel aside={'4 credits of 18'}>Your courses</N.SectionLabel>
      <div style={{ marginBottom: 28 }}>{mine.map((m) => <div className="row-item" key={m.id} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}><div><b style={{ fontWeight: 600 }}>{m.id}</b><div style={{ fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>{m.state}</div></div><N.Button size="sm">{m.state.startsWith('On the') ? 'Leave the waitlist' : 'Drop'} {m.id}</N.Button></div>)}</div>
      <N.SectionLabel aside={<N.SourceBadge source="official" updated="Updated just now" />}>Sections this term</N.SectionLabel>
      {sections.map((s) => (
        <div key={s.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
            <div><div><b style={{ fontWeight: 600 }}>{s.id}</b> · {s.title}</div><div className="nums" style={{ fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>{s.cr} credits · {s.meets} · {s.taken} of {s.cap} seats taken{s.wait ? ` · ${s.wait} waiting` : ''}</div><div style={{ fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>{s.note}</div></div>
            {!live.has(s.id) && reviewing !== s.id && <N.Button size="sm" onClick={() => setReviewing(s.id)}>Review {s.id}</N.Button>}
            {live.has(s.id) && <N.StatusChip status="verified" label="In your courses" />}
          </div>
          {reviewing === s.id && (
            <section className="state" style={{ marginTop: 12 }} aria-label="Review before you enroll">
              <div className="state-title">Review before you enroll</div><p className="state-body">{landing(s)}</p>
              <div className="state-actions"><N.Button variant="primary" onClick={() => { setMine((m) => [...m, { id: s.id, state: s.approval ? 'Waiting for the registrar’s approval' : 'Enrolled' }]); setReviewing(null); setSaid(s.approval ? `Request for ${s.id} sent` : `Enrolled in ${s.id}`); }}>{label(s)}</N.Button><N.Button onClick={() => setReviewing(null)}>Cancel</N.Button></div>
            </section>
          )}
        </div>
      ))}
    </div>
  );
}
Object.assign(window, { RegistrationScreen });
