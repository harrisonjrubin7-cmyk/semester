function AdvisingScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [share, setShare] = React.useState(false); const [shared, setShared] = React.useState(false);
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">My Path · Advisor meeting</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Spring planning with Dr. Okafor</h1><p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Thu 16 Oct · 10:30 · Hensel 312</p></div><N.SaveState status="saved" /></div>
      <div className="cols">
        <div className="stack" style={{ gap: 20 }}>
          <div><N.SectionLabel>Agenda</N.SectionLabel><ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}><li>Confirm BIO 330 and CHEM 220 for spring</li><li>Data Science minor — worth it?</li><li>Summer research options</li></ol></div>
          <div><N.SectionLabel>What to bring</N.SectionLabel><p style={{ fontSize: 'var(--type-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>Only what you tick here can be shared. Nothing else — not your study history, grades, notes or anything else — ever is.</p>
            <N.Choice type="checkbox" label="Plan scenario: Add a Data Science minor" checked onChange={() => {}} /><N.Choice type="checkbox" label="Saved courses: BIO 330 · CHEM 220 · ENGL 245" checked onChange={() => {}} /><N.Choice type="checkbox" label="Include my follow-up actions when I share" onChange={() => {}} /></div>
          <N.TextField multiline label="Private notes — only on this device, never shared or exported" defaultValue="Ask whether the minor delays the research seminar." />
        </div>
        <aside className="stack"><N.SectionLabel>Share with your advisor</N.SectionLabel>
          <p style={{ fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>Your advisor signs in to Semester to see it. The share ends when you say, you can revoke it any time, and you see when it was opened.</p>
          <N.TextField label="Advisor’s school email" defaultValue="a.okafor@northfield.edu" />
          <N.Select label="Access ends after" options={['7 days', '30 days', 'End of term']} defaultValue="30 days" />
          <N.Button variant="primary" onClick={() => setShare(true)}>Preview and share…</N.Button>
          {shared && <N.PermissionNotice changed="Shared with a.okafor@northfield.edu until 5 Nov 2026" why="Not opened yet. You can revoke it at any time." controlLabel="Revoke…" />}
        </aside>
      </div>
      {share && <N.Dialog title="Share this with your advisor?" confirmLabel="Share" onCancel={() => setShare(false)} onConfirm={() => { setShare(false); setShared(true); }}>
        <N.ActionPreview subject="a.okafor@northfield.edu" says="will see exactly your agenda, one plan scenario and three saved courses, as “Maya Lindqvist”, until 5 Nov 2026." doesNotChange="Private notes, grades and study history are not shared." recovery={{ kind: 'undo', how: 'Revoke from Your shares at any time.' }} />
      </N.Dialog>}
    </div>
  );
}
Object.assign(window, { AdvisingScreen });
