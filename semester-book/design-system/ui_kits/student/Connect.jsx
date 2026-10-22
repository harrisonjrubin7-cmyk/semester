function ConnectScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const rows = [['Northfield University', 'Courses, schedule, degree audit, holds', 'official', 'synced', 'Updated 07:55'], ['Canvas', 'Assignments and due dates', 'connected', 'synced', 'Updated 12 min ago'], ['TeamApp', 'Rowing practice calendar', 'connected', 'syncing', 'Checking now'], ['Google Calendar', 'Personal events (read-only)', 'stale', 'sync-error', 'Not checked for 4 days']];
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">You · Connect</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Connected accounts</h1><p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>What Semester reads, from where, and how fresh it is. Disconnect anything at any time.</p></div><N.Button variant="primary" icon="plus">Connect an account</N.Button></div>
      <div className="stack">
        {rows.map(([n, w, src, st, age]) => (
          <div key={n} className="object-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <N.Icon name="connect" size={22} style={{ color: 'var(--text-secondary)' }} />
            <div style={{ flex: 1, display: 'grid', gap: 4 }}><div style={{ fontWeight: 600 }}>{n}</div><div style={{ fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>{w}</div><div style={{ display: 'flex', gap: 8 }}><N.SourceBadge source={src} updated={age} /><N.StatusChip status={st} /></div></div>
            {st === 'sync-error' ? <N.Button size="sm" variant="primary">Reconnect</N.Button> : <N.Button size="sm">Manage</N.Button>}
          </div>
        ))}
        <N.Notice head="Google Calendar">Your Google calendar hasn’t updated since Friday. Personal events below may have moved. Reconnect it, or check Google Calendar directly.</N.Notice>
      </div>
    </div>
  );
}
Object.assign(window, { ConnectScreen });
