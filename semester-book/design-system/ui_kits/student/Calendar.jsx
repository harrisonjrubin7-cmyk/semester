function CalendarScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const days = ['Mon 6', 'Tue 7', 'Wed 8', 'Thu 9', 'Fri 10'];
  const ev = [[0, 9, 1.25, 'BIO 210 · Lecture', 'official'], [1, 9, 1.25, 'BIO 210 · Lecture', 'official'], [1, 11.5, 1.5, 'Lab report · results', 'personal'], [1, 13, 1, 'ECON 1020 · Recitation', 'official'], [1, 16, 2, 'Rowing', 'connected'], [2, 10, 1.25, 'ECON 1020', 'official'], [2, 19, 1, 'Discussion outline', 'personal'], [3, 9, 1.25, 'BIO 210 · Lecture', 'official'], [3, 14, .5, 'Citations + submit', 'personal'], [3, 16, 2, 'Rowing', 'connected'], [4, 10, 1.25, 'ECON 1020', 'official'], [4, 15, 1, 'Office hours · Okafor', 'official']];
  const tone = { official: ['var(--source-official-wash)', 'var(--source-official-line)', 'solid'], connected: ['var(--source-connected-wash)', 'var(--source-connected-line)', 'solid'], personal: ['transparent', 'var(--source-personal-line)', 'dashed'] };
  const H0 = 8, H1 = 20, ph = 38;
  return (
    <div className="page" style={{ maxWidth: 'none' }}>
      <div className="pagehead"><div><div className="kicker">Plan · Calendar</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Week of 6 October</h1></div><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><N.Segmented label="View" options={['Day', 'Week', 'Month']} value="Week" /><N.Button variant="primary" icon="plus">Add</N.Button></div></div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 12, alignItems: 'center' }}><N.SourceBadge source="official" by="Northfield" /><N.SourceBadge source="connected" by="TeamApp" updated="Updated 40 min ago" /><N.SourceBadge source="personal" /><span style={{ fontSize: 'var(--type-xs)', color: 'var(--text-secondary)' }}>Dashed = yours · Solid = from a source</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(5,1fr)', border: '1px solid var(--border-default)', borderRadius: 6, background: 'var(--surface-base)', overflow: 'hidden' }}>
        <div></div>{days.map((d, i) => <div key={d} style={{ padding: '8px 10px', borderLeft: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-default)', fontFamily: 'var(--font-heading)', fontWeight: 600, background: i === 1 ? 'var(--action-secondary)' : undefined }}>{d}</div>)}
        <div style={{ position: 'relative', height: (H1 - H0) * ph }}>{Array.from({ length: H1 - H0 }, (_, i) => <div key={i} className="nums" style={{ position: 'absolute', top: i * ph - 6, right: 6, fontSize: 10, color: 'var(--text-tertiary)' }}>{i ? (H0 + i) + ':00' : ''}</div>)}</div>
        {days.map((d, di) => (
          <div key={d} style={{ position: 'relative', height: (H1 - H0) * ph, borderLeft: '1px solid var(--border-subtle)', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent ' + (ph - 1) + 'px,var(--border-subtle) ' + (ph - 1) + 'px,var(--border-subtle) ' + ph + 'px)' }}>
            {ev.filter((e) => e[0] === di).map(([, s, len, t, src], k) => { const [bg, bd, st] = tone[src]; return <div key={k} style={{ position: 'absolute', left: 4, right: 4, top: (s - H0) * ph + 2, height: Math.max(len * ph - 4, 32), zIndex: 1, background: bg, border: '1px ' + st + ' ' + bd, borderRadius: 3, padding: '3px 6px', fontSize: 11.5, lineHeight: 1.25, overflow: 'hidden' }}><div style={{ whiteSpace: len < 1 ? 'nowrap' : undefined, overflow: 'hidden', textOverflow: 'ellipsis' }}><span className="nums" style={{ color: 'var(--text-secondary)', fontSize: 10.5, marginRight: 4 }}>{Math.floor(s)}:{s % 1 ? '30' : '00'}</span>{len < 1 ? t : <div>{t}</div>}</div></div>; })}
            {di === 3 && <div style={{ position: 'absolute', left: 0, right: 0, top: (H1 - H0) * ph - 18, fontSize: 10.5, color: 'var(--status-pending)', padding: '0 6px' }}>◆ Lab report 3 due 23:59</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
Object.assign(window, { CalendarScreen });
