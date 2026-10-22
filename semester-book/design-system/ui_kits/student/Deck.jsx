function DeckScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [s, setS] = React.useState(0);
  const slides = [['Enzyme kinetics', 'Group 4 · BIO 210'], ['Methods', '5 concentrations · 3 trials · 240 nm'], ['Results', 'Rate saturates above 40 mM'], ['Discussion', 'Competitive inhibition explains trial 3']];
  return (
    <div className="page" style={{ maxWidth: 'none' }}>
      <div className="pagehead"><div><div className="kicker">Learn · Decks · Group work</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Lab 3 presentation</h1></div><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><N.SaveState status="synced" /><div style={{ display: 'flex' }}>{['Amara Diallo', 'Rui Tanaka'].map((n) => <N.Avatar key={n} name={n} size={28} />)}</div><N.Button variant="primary" icon="play">Present</N.Button></div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(0,1fr) 260px', gap: 20 }}>
        <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>{slides.map((x, i) => <button key={i} type="button" onClick={() => setS(i)} style={{ aspectRatio: '16/9', border: i === s ? '2px solid var(--focus-color)' : '1px solid var(--border-default)', borderRadius: 4, background: 'var(--surface-raised)', fontSize: 9, padding: 6, textAlign: 'left', cursor: 'pointer' }}><span className="nums" style={{ color: 'var(--text-tertiary)' }}>{i + 1}</span> {x[0]}</button>)}</div>
        <div style={{ aspectRatio: '16/9', background: 'var(--ink-bg)', color: 'var(--ink-fg)', borderRadius: 6, padding: '8%', display: 'grid', alignContent: 'center', gap: 16 }}><div className="editorial" style={{ fontSize: 44 }}>{slides[s][0]}</div><div style={{ fontSize: 20, color: 'rgba(236,238,242,.64)' }}>{slides[s][1]}</div></div>
        <aside className="stack"><N.SectionLabel>Speaker notes</N.SectionLabel><textarea className="input" defaultValue="Point at the plateau; mention trial 3 outlier." /><N.SectionLabel>Shared with</N.SectionLabel><N.VisibilityPicker value="collaborators" locked /></aside>
      </div>
    </div>
  );
}
Object.assign(window, { DeckScreen });
