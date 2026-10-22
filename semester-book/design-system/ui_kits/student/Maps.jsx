function MapsScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Campus · Maps</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Hensel Hall 204</h1><p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>BIO 210 · 09:00 · 7 min walk from North Hall</p></div><N.Button variant="primary" icon="map">Directions</N.Button></div>
      <div className="cols">
        <div style={{ aspectRatio: '4/3', border: '1px solid var(--border-default)', borderRadius: 6, display: 'grid', placeItems: 'center', background: 'var(--surface-sunken)', color: 'var(--text-tertiary)', fontSize: 'var(--type-sm)' }}>Campus map tiles</div>
        <aside className="stack"><N.SectionLabel>Accessible route</N.SectionLabel><N.Notice head="Elevator">Hensel Hall elevator out of service until Oct 9. Step-free entrance via the Laird link bridge.</N.Notice>
          <N.SectionLabel>Nearby now</N.SectionLabel><N.NextSteps steps={[{ label: 'Laird Café', why: 'Open until 16:00 · 2 min', icon: 'meals' }, { label: 'Shuttle Route B', why: 'Delayed ~15 min', icon: 'runway' }]} /></aside>
      </div>
    </div>
  );
}
Object.assign(window, { MapsScreen });
