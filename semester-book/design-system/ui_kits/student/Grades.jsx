function GradesScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [asking, setAsking] = React.useState(null); const [sent, setSent] = React.useState({});
  const lines = [{ id: 'q3', title: 'Quiz 3', score: '18 of 20', rel: 'Sep 19' }, { id: 'l1', title: 'Lab report 1', score: '34 of 40', rel: 'Sep 24', c: 'Strong figures; discussion thin.' }, { id: 'l2', title: 'Lab report 2', score: '31 of 40 · Late', rel: 'Oct 1' }, { id: 'q4', title: 'Quiz 4', score: '16 of 20', rel: 'Oct 3' }];
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">BIO 210 · Fall 2026</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Grades</h1></div><N.Button icon="analyse">Work out what you need on the final</N.Button></div>
      <div className="cols">
        <div>
          <N.SectionLabel aside={<N.SourceBadge source="official" updated="Updated today" />}>Released grades</N.SectionLabel>
          <N.DataTable caption="Released grades" columns={[{ key: 'title', label: 'Item' }, { key: 'score', label: 'Grade', render: (l) => <div>{l.score}{l.c && <div style={{ fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>{l.c}</div>}</div> }, { key: 'rel', label: 'Released' }, { key: 'rg', label: 'Regrade', render: (l) => sent[l.id] ? <span style={{ fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>Asked — waiting for an answer</span> : <N.Button size="sm" onClick={() => setAsking(l)}>Ask about {l.title}</N.Button> }]} rows={lines} />
          {asking && <section className="state" style={{ marginTop: 16 }}><div className="state-title">Ask for {asking.title} to be looked at again</div><N.TextField multiline label="What should be looked at" hint="Your instructor reads this. Say which part, and why." /><div className="state-actions"><N.Button variant="primary" onClick={() => { setSent((s) => ({ ...s, [asking.id]: true })); setAsking(null); }}>Send the regrade request</N.Button><N.Button onClick={() => setAsking(null)}>Cancel</N.Button></div></section>}
        </div>
        <aside className="stack">
          <N.SectionLabel aside={<N.SourceBadge source="estimated" />}>Course total so far</N.SectionLabel>
          <div className="metric" style={{ padding: 16, border: '1px solid var(--status-pending-line)', borderRadius: 6, background: 'var(--surface-base)' }}><div className="nums" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 'var(--type-2xl)' }}>82.5%</div><p style={{ fontSize: 'var(--type-sm)', color: 'var(--text-secondary)', marginTop: 6 }}>Worked out by Semester from released grades only; your instructor’s final grade is the one that counts.</p></div>
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { GradesScreen });
