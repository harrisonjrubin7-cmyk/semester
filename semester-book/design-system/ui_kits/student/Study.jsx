function StudyScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const cards = [['What does Km measure?', 'The substrate concentration at which the reaction rate is half of Vmax.'], ['Competitive inhibitor effect on Km and Vmax?', 'Km rises; Vmax is unchanged.'], ['Lineweaver–Burk x-intercept', '−1/Km']];
  const [i, setI] = React.useState(0); const [show, setShow] = React.useState(false); const [done, setDone] = React.useState(0);
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Learn · Study · BIO 210</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Enzyme kinetics — practice</h1></div><N.Segmented label="Mode" options={['Cards', 'Quiz', 'Guide']} value="Cards" /></div>
      <div className="cols">
        <div className="stack">
          <div style={{ minHeight: 260, padding: 28, border: '1px solid var(--border-default)', borderRadius: 10, background: 'var(--surface-raised)', display: 'grid', alignContent: 'space-between', gap: 20 }}>
            <div className="kicker nums">Card {i + 1} of {cards.length}</div>
            <div style={{ fontSize: 26, fontFamily: 'var(--font-heading)', fontWeight: 600, lineHeight: 1.2 }}>{cards[i][0]}</div>
            {show ? <p style={{ fontSize: 18, lineHeight: 1.5 }}>{cards[i][1]}</p> : <span></span>}
            <N.ProvenanceChips origin="made" by="From Lecture 8 slides" age="slide 14" />
          </div>
          <div className="object-card-actions">
            {!show ? <N.Button variant="primary" onClick={() => setShow(true)}>Show answer</N.Button> : <><N.Button onClick={() => { setShow(false); setI((x) => (x + 1) % cards.length); }}>Again</N.Button><N.Button variant="primary" onClick={() => { setShow(false); setDone((d) => d + 1); setI((x) => (x + 1) % cards.length); }}>I knew it</N.Button></>}
            <span style={{ fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>Space to flip · 1 Again · 2 Knew it</span>
          </div>
        </div>
        <aside className="stack"><N.SectionLabel>This session</N.SectionLabel>
          <N.MetricTile label="Reviewed" value={String(done)} unit={'of ' + cards.length} delta="No streaks. Stop whenever." />
          <N.Notice head="Cards">Made here from Lecture 8 slides by rule-based extraction — not an AI draft. Edit any card.</N.Notice>
          <N.OpenIn about="Enzyme kinetics" targets={['Guide', 'Quiz', 'Ask Semester']} />
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { StudyScreen });
