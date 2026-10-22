function Atlas() {
  const N = window.SemesterDesignSystem_e9f3ba; const D = window.ATLAS;
  const [role, setRole] = React.useState(() => localStorage.getItem('sem-atlas-role') || 'Student'); const [q, setQ] = React.useState('');
  const pick = (r) => { setRole(r); localStorage.setItem('sem-atlas-role', r); };
  const R = D.find((r) => r.role === role) || D[0];
  const tot = (r) => r.features.reduce((n, f) => n + f[1].length, 0);
  const match = (s) => s.toLowerCase().includes(q.toLowerCase());
  const all = D.reduce((n, r) => n + tot(r), 0);
  return (<div className="shell"><N.SideRail current={role} onNavigate={pick} groups={[{ label: 'Roles', items: D.map((r) => ({ id: r.role, label: r.role, icon: 'person', count: tot(r) })) }]} foot={<><div style={{ color: 'var(--chrome-text)' }}>Atlas</div><div>{D.length} roles · {all} screens</div></>} />
    <div className="main"><N.SystemContextBar location={'Atlas · ' + role} term="Every role, feature, screen and function" sync="device-only" />
      <div className="scroll" key={role}><div className="page">
        <div className="pagehead"><div><div className="kicker">{role} · {R.features.length} features · {tot(R)} screens</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Everything a {role.toLowerCase()} can do</h1></div><div style={{ display: 'flex', gap: 10, alignItems: 'end' }}><div style={{ width: 240 }}><N.TextField label="Filter" value={q} onChange={(e) => setQ(e.target.value)} /></div><N.Button variant="primary" icon="chevronRight" onClick={() => window.open(R.kit)}>Open live screens</N.Button></div></div>
        <div style={{ display: 'grid', gap: 22 }}>{R.features.map(([f, screens, fns]) => { const s = screens.filter(match), x = fns.filter(match); if (q && !s.length && !x.length && !match(f)) return null; return <section key={f} className="object-card"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><div className="object-card-title">{f}</div><span className="kicker">{screens.length} screens</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 20 }}><div><div className="kicker" style={{ marginBottom: 6 }}>Screens</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{(q ? s : screens).map((n) => <button key={n} type="button" className="pill-soft" onClick={() => window.open(R.kit)}>{n}</button>)}</div></div>
          <div><div className="kicker" style={{ marginBottom: 6 }}>Functions</div><ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 14 }}>{(q ? x : fns).map((n) => <li key={n}>{n}</li>)}</ul></div></div></section>; })}</div>
        <div style={{ marginTop: 24 }}><N.ScreenGuide items={[{ q: 'What is this?', a: 'A catalogue of every role in Semester, the features each uses, the screens behind them and what each lets that role do. “Open live screens” opens the kit that renders them.' }, { q: 'Where do access rules live?', a: 'Role lens shows each screen’s access level, tables, RLS and API for every role.' }]} /></div>
      </div></div></div></div>);
}
window.__atlasRoot = window.__atlasRoot || ReactDOM.createRoot(document.getElementById('root'));
window.__atlasRoot.render(<Atlas />);
