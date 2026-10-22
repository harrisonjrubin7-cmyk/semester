function MailScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const msgs = [['Prof. A. Okafor', 'Lab report 3 — rubric clarification', 'Figures need error bars; see section 4.', '09:12', 'official', true], ['Registrar', 'Spring registration opens Oct 14', 'Your time ticket: Oct 14, 07:00.', 'Yesterday', 'official', false], ['Rowing club', 'Erg night moved to Thursday', 'Boathouse, 19:00.', 'Mon', 'connected', false], ['Career Center', 'Résumé drop-in this week', 'Thu 14:00–16:00.', 'Mon', 'official', false]];
  const [o, setO] = React.useState(0);
  return (
    <div className="page" style={{ maxWidth: 'none' }}>
      <h1 className="sr-only">Mail</h1>
      <div className="mail-grid" style={{ minHeight: 560, border: '1px solid var(--border-default)', borderRadius: 6, overflow: 'hidden', background: 'var(--surface-base)' }}>
        <div style={{ padding: 12, borderRight: '1px solid var(--border-subtle)', display: 'grid', gap: 2, alignContent: 'start' }}><N.Button variant="primary" icon="write" block>Compose</N.Button><div style={{ height: 8 }}></div>{[['inbox', 'Inbox', 3], ['send', 'Sent'], ['archive', 'Archive'], ['spam', 'Junk']].map(([i, l, c]) => <button key={l} className="next-step" style={{ border: 0, background: l === 'Inbox' ? 'var(--action-secondary)' : 'transparent', minHeight: 36, padding: '6px 10px' }}><N.Icon name={i} size={17} /><span className="next-step-text">{l}</span>{c && <span className="nums" style={{ fontSize: 12 }}>{c}</span>}</button>)}</div>
        <div style={{ borderRight: '1px solid var(--border-subtle)', overflow: 'auto' }}>{msgs.map((m, i) => <button key={i} onClick={() => setO(i)} style={{ display: 'grid', gap: 2, width: '100%', textAlign: 'left', padding: '12px 14px', border: 0, borderBottom: '1px solid var(--border-subtle)', borderInlineStart: '3px solid ' + (i === o ? 'var(--focus-color)' : 'transparent'), background: i === o ? 'var(--surface-quiet)' : 'transparent', cursor: 'pointer', font: 'inherit' }}><span style={{ display: 'flex', justifyContent: 'space-between', fontWeight: m[5] ? 600 : 400 }}><span>{m[0]}</span><span className="nums" style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400 }}>{m[3]}</span></span><span style={{ fontSize: 14 }}>{m[1]}</span><span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{m[2]}</span></button>)}</div>
        <div style={{ padding: '20px 28px', overflow: 'auto' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><h2 style={{ fontSize: 'var(--type-display-xs)', fontFamily: 'var(--font-body)', fontWeight: 600, letterSpacing: 0, minWidth: 0 }}>{msgs[o][1]}</h2><div style={{ display: 'flex' }}>{['reply', 'forward', 'archive', 'trash'].map((i) => <N.IconButton key={i} icon={i} label={i} size="sm" />)}</div></div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '10px 0 18px' }}><N.Avatar name={msgs[o][0]} size={32} /><div><div style={{ fontSize: 14 }}>{msgs[o][0]}</div><N.SourceBadge source={msgs[o][4]} /></div></div>
          <p style={{ maxWidth: '62ch', lineHeight: 1.6 }}>{msgs[o][2]} Let me know at office hours if anything is unclear.</p>
          <div style={{ marginTop: 20 }}><N.OpenIn about="this message" targets={['Add to Plan', 'Open BIO 210']} /></div></div>
      </div>
    </div>
  );
}
Object.assign(window, { MailScreen });
