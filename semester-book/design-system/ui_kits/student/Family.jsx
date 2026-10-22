function FamilyScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [share, setShare] = React.useState({ grades: true, billing: true, schedule: false, wellbeing: false });
  const t = (k) => (v) => setShare((s) => ({ ...s, [k]: v }));
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Family sharing · you decide</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>What Jonas Lindqvist can see</h1><p style={{ color: 'var(--text-secondary)', marginTop: 6, maxWidth: '60ch' }}>Guardians see nothing by default. Each item below is shared only because you turned it on, and you can turn it off at any time.</p></div><N.Button icon="family">Invite another guardian</N.Button></div>
      <div className="cols">
        <div className="stack">
          {[['grades', 'Final grades', 'Course letter grades once posted by the Registrar. Not assignment scores or feedback.'], ['billing', 'Billing milestones', 'Balance due dates and payment confirmations. Not line items or aid details.'], ['schedule', 'Class schedule', 'Days and times of classes. Not locations.'], ['wellbeing', 'Support appointments', 'Never shared automatically. Counseling is always private.']].map(([k, l, a]) => (
            <div key={k} className="object-card" style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
              <div style={{ display: 'grid', gap: 4 }}><div className="object-card-title" style={{ fontSize: 'var(--type-md)' }}>{l}</div><p className="object-card-why" style={{ fontSize: 'var(--type-sm)' }}>{a}</p></div>
              <N.Switch label={<span className="sr-only">Share {l}</span>} checked={share[k]} onChange={t(k)} disabled={k === 'wellbeing'} />
            </div>
          ))}
          <N.PermissionNotice changed="Jonas can see final grades and billing milestones" why="You shared these on Aug 28. Sharing ends automatically when you graduate or turn it off." controlLabel="Review sharing history" />
        </div>
        <aside><N.SectionLabel>Access history</N.SectionLabel>
          <N.DecisionTrail items={[{ title: 'Viewed billing milestone', who: 'Jonas Lindqvist', when: 'Oct 5 · 20:14' }, { title: 'Viewed final grades (Spring 2026)', who: 'Jonas Lindqvist', when: 'Sep 30 · 08:02' }, { title: 'You turned on Billing milestones', who: 'You', when: 'Aug 28 · 16:40' }, { title: 'Guardian invitation accepted', who: 'Jonas Lindqvist', when: 'Aug 28 · 16:31' }]} />
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { FamilyScreen });
