function MToday({ go }) {
  const N = window.SemesterDesignSystem_e9f3ba;
  return (<div className="mscroll">
    <div className="kicker">Tue 7 Oct · Week 6</div><div className="mtitle">Today</div>
    <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 16 }}>Three classes, one thing to begin.</p>
    <N.ObjectCard kind="Begin today" statuses={['action-required']} title="Lab report 3: Enzyme kinetics" provenance={{ origin: 'official', by: 'BIO 210' }} metadata="Due Thu · 23:59 · about 3h left" primary={{ label: 'Open draft', onClick: () => go('path') }} />
    <div style={{ marginTop: 20 }}><N.SectionLabel aside="3">Schedule</N.SectionLabel>
      {[['09:00', 'BIO 210 · Cell Biology', 'Hensel 204', 'official'], ['13:00', 'ECON 1020 · Recitation', 'Laird 110', 'official'], ['16:00', 'Rowing practice', 'Boathouse', 'connected']].map(([t, n, w, s]) => <div className="mrow" key={t}><span className="nums" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17 }}>{t}</span><div><div style={{ fontSize: 16 }}>{n}</div><div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginTop: 2 }}><span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{w}</span><N.SourceBadge source={s} /></div></div></div>)}</div>
    <div style={{ marginTop: 20 }}><N.SectionLabel aside="1">Needs you</N.SectionLabel><N.NextSteps steps={[{ label: 'Clear immunization hold', why: 'Blocks registration Oct 14.', icon: 'registrar' }]} /></div>
  </div>);
}
function MPath() {
  const N = window.SemesterDesignSystem_e9f3ba;
  return (<div className="mscroll">
    <div className="kicker">My Path</div><div className="mtitle">Degree</div>
    <div style={{ margin: '12px 0 20px' }}><N.SourceLine source="official" by="Registrar" when="3 Oct"><p className="editorial" style={{ fontSize: 28, lineHeight: 1.1 }}>94 of 120 credits. On track for May 2028.</p></N.SourceLine></div>
    {[['Core curriculum', 36, 40], ['Biology major', 32, 48], ['Chemistry minor', 12, 18]].map(([n, d, o]) => <div key={n} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)', display: 'grid', gap: 6 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{n}</span><span className="nums" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{d}/{o}</span></div><div style={{ height: 4, background: 'var(--surface-sunken)', borderRadius: 2 }}><div style={{ width: d / o * 100 + '%', height: '100%', background: 'var(--action-primary)', borderRadius: 2 }}></div></div></div>)}
    <div style={{ marginTop: 20 }}><N.Button variant="primary" block icon="meet">Prepare for advising</N.Button></div>
  </div>);
}
function MSearch() {
  const N = window.SemesterDesignSystem_e9f3ba;
  return (<div className="mscroll">
    <div className="mtitle">Search</div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0 16px', padding: '0 12px', minHeight: 44, border: '1px solid var(--border-default)', borderRadius: 6, background: 'var(--surface-raised)' }}><N.Icon name="search" size={17} style={{ color: 'var(--text-secondary)' }} /><span style={{ color: 'var(--text-tertiary)' }}>Search or ask Semester</span></div>
    <N.AIResponse scope={['BIO 210', 'Your calendar']} confidence="High" cost="1 request" sources={[{ title: 'BIO 210 Syllabus §4', kind: 'official' }]} actions={<N.Button size="sm" variant="primary">Add 3 blocks…</N.Button>}><p>About 3 hours remain on Lab report 3<span className="ai-cite">1</span>. Today 11:30 and Wednesday evening are free.</p></N.AIResponse>
  </div>);
}
function MPlan() {
  const N = window.SemesterDesignSystem_e9f3ba;
  return (<div className="mscroll">
    <div className="kicker">Plan</div><div className="mtitle">This week</div>
    {[['Tue', 'Lab report 3 · results', '11:30–13:00', 'personal'], ['Wed', 'Discussion outline', '19:00–20:00', 'personal'], ['Thu', 'Lab report 3 due', '23:59', 'official'], ['Fri', 'Problem set 5 due', '17:00', 'connected']].map(([d, n, t, s]) => <div className="mrow" key={n}><span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17 }}>{d}</span><div><div>{n}</div><div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}><span className="nums" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t}</span><N.SourceBadge source={s} /></div></div></div>)}
    <div style={{ marginTop: 16 }}><N.OfflineStrip queued={1} /></div>
  </div>);
}
function MMe() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [g, setG] = React.useState(true);
  return (<div className="mscroll">
    <div className="mtitle">Me</div><p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>Maya Lindqvist · Northfield University</p>
    <N.SectionLabel>Sharing with Jonas (guardian)</N.SectionLabel>
    <N.Switch label="Final grades" checked={g} onChange={setG} /><N.Switch label="Billing milestones" checked onChange={() => {}} /><N.Switch label="Class schedule" onChange={() => {}} />
    <div style={{ marginTop: 16 }}><N.NextSteps steps={[{ label: 'Billing', why: '$1,240.00 due Oct 31', icon: 'costs' }, { label: 'Privacy & data', why: 'Export or delete your data', icon: 'privacy' }, { label: 'Appearance', why: 'Parchment · Text size Normal', icon: 'settings' }]} /></div>
  </div>);
}
Object.assign(window, { MToday, MPath, MSearch, MPlan, MMe });
