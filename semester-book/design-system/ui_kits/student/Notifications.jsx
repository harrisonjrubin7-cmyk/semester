function NotificationsScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const n = [['Grade released', 'Quiz 4 · ECON 1020 · 8.5 / 10', '09:40', 'official'], ['Date moved', 'BIO 210 midterm moved to Wed 22 Oct', 'Yesterday', 'official'], ['Share opened', 'Dr. Okafor opened your advising agenda', 'Yesterday', 'personal'], ['Sync trouble', 'Google Calendar hasn’t updated since Friday', 'Mon', 'stale']];
  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="pagehead"><div><div className="kicker">Today · Notifications</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Notifications</h1><p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Only what is due or changed. Badges count only what you can act on today.</p></div><N.Button size="sm">Settings</N.Button></div>
      {n.map(([t, b, w, s]) => <div key={t} className="row-item" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}><div><div style={{ fontWeight: 600 }}>{t}</div><div style={{ fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>{b}</div><div style={{ marginTop: 4 }}><N.SourceBadge source={s} updated={w} /></div></div><N.Button size="sm" variant="ghost">Open</N.Button></div>)}
    </div>
  );
}
Object.assign(window, { NotificationsScreen });
