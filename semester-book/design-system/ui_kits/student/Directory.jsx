function DirectoryScreen({ go, built }) {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [q, setQ] = React.useState('');
  const total = window.NAV_AREAS.reduce((n, a) => n + a.screens.length, 0);
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">App directory · {total} screens in 7 areas</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Everything Semester can do</h1><p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Each area answers one question. Every screen lives in exactly one.</p></div>
        <div style={{ width: 280 }}><input className="input" placeholder="Filter screens" aria-label="Filter screens" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      <div style={{ display: 'grid', gap: 28 }}>
        {window.NAV_AREAS.map((a) => {
          const s = a.screens.filter(([, l]) => l.toLowerCase().includes(q.toLowerCase()));
          if (!s.length) return null;
          return (
            <section key={a.id}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}><h2 style={{ fontSize: 'var(--type-display-sm)' }}>{a.label}</h2><span style={{ color: 'var(--text-secondary)', fontSize: 'var(--type-sm)' }}>{a.q}</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
                {s.map(([id, l, ic]) => (
                  <button key={id} type="button" className="next-step" style={{ minHeight: 52 }} onClick={() => go(id)}>
                    <N.Icon name={ic} size={19} style={{ color: 'var(--text-secondary)' }} /><span className="next-step-text"><span style={{ fontSize: 'var(--type-control)' }}>{l}</span>{!built[id] && <span className="next-step-why" style={{ fontSize: 'var(--type-xs)' }}>Outline only in this kit</span>}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
function OutlineScreen({ id, go }) {
  const N = window.SemesterDesignSystem_e9f3ba;
  const area = window.NAV_AREAS.find((a) => a.screens.some(([s]) => s === id)) || window.NAV_AREAS[0];
  const [, label, icon] = area.screens.find(([s]) => s === id) || ['', id, 'apps'];
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">{area.label} · {area.q}</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>{label}</h1></div><N.Button variant="primary">{area.primary}</N.Button></div>
      <N.EmptyState title={label + ' isn’t recreated in this kit yet'} body={'It exists in the Semester app (app/src/screens). This placeholder shows its area and primary action so flows stay navigable.'} action={<N.Button size="sm" onClick={() => go('directory')}>Back to the directory</N.Button>} />
      <div style={{ marginTop: 24 }}><N.ScreenGuide items={[{ q: 'Which area is this?', a: area.label + ' — ' + area.q }, { q: 'What does a screen here lead with?', a: area.primary + '.' }]} /></div>
    </div>
  );
}
Object.assign(window, { DirectoryScreen, OutlineScreen });
