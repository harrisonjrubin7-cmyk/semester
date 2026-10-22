function WriteScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  return (
    <div className="page" style={{ maxWidth: 1180 }}>
      <div className="pagehead"><div><div className="kicker">Learn · Write · BIO 210</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Lab report 3: Enzyme kinetics</h1></div><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><N.SaveState status="saved" /><N.Button icon="export">Export</N.Button><N.Button variant="primary">Submit to BIO 210…</N.Button></div></div>
      <div className="cols">
        <div style={{ padding: '32px 40px', border: '1px solid var(--border-default)', borderRadius: 6, background: 'var(--surface-raised)', fontSize: 16, lineHeight: 1.7, maxWidth: '72ch' }}>
          <div style={{ display: 'flex', gap: 6, paddingBottom: 12, marginBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>{['alignLeft', 'alignCenter', 'alignJustify'].map((i) => <N.IconButton key={i} icon={i} label={i} size="sm" />)}<span style={{ width: 1, background: 'var(--border-subtle)', margin: '0 6px' }}></span><N.IconButton icon="equations" label="Insert equation" size="sm" /><N.IconButton icon="sources" label="Cite a source" size="sm" /></div>
          <h2 style={{ fontSize: 20, marginBottom: 10 }}>Methods</h2>
          <p>Catalase activity was measured at five hydrogen peroxide concentrations (5–80 mM) using a spectrophotometer at 240 nm, three trials each.</p>
          <h2 style={{ fontSize: 20, margin: '20px 0 10px' }}>Results</h2>
          <p style={{ color: 'var(--text-tertiary)' }}>Start with the data table — it’s the part the rubric weighs most.</p>
        </div>
        <aside className="stack"><N.SectionLabel>Rubric · 40 pts</N.SectionLabel>
          <N.Fields items={[{ field: 'Data & figures', value: '15 · not started' }, { field: 'Methods', value: '10 · drafted' }, { field: 'Discussion', value: '10 · not started' }, { field: 'Citations', value: '5 · 1 of 3' }]} />
          <div className="object-card"><div className="object-card-eyebrow">Course AI policy · set by instructor</div><p className="object-card-why" style={{ fontSize: 'var(--type-sm)' }}>AI allowed for outlining and feedback in BIO 210 — not for writing results or discussion.</p><div className="object-card-actions"><N.Button size="sm" icon="ask">Get feedback on Methods</N.Button></div></div>
          <N.VisibilityPicker value="only-me" allowed={['only-me', 'collaborators']} locked />
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { WriteScreen });
