function GuardianScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Family portal · Jonas Lindqvist</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>What Maya has shared with you</h1><p style={{ color: 'var(--text-secondary)', marginTop: 6, maxWidth: '62ch' }}>Maya decides what appears here and can change it at any time. Anything not listed is private to her.</p></div></div>
      <div className="cols">
        <div className="stack">
          <N.ObjectCard kind="Billing milestone" title="Fall balance due 31 Oct" provenance={{ origin: 'official', by: 'Bursar', age: 'Shared by Maya since Aug 28' }} metadata="$1,240.00 · payment plan available" primary={{ label: 'Make a payment' }} secondary={{ label: 'How payments work' }} />
          <N.ObjectCard kind="Final grades" title="Spring 2026 · 3.62 term GPA" provenance={{ origin: 'official', by: 'Registrar', age: 'Shared by Maya since Aug 28' }} explanation="Final course grades only. Assignment scores and feedback are not shared." />
          <div className="state" data-kind="permission"><div className="state-title"><span className="status-glyph" aria-hidden="true">⊙</span>Class schedule · not shared</div><p className="state-body">Maya hasn’t shared her schedule. You can ask — she’ll see your request and decide.</p><div className="state-actions"><N.Button size="sm">Ask Maya to share</N.Button></div></div>
        </div>
        <aside className="stack"><N.SectionLabel>Support for families</N.SectionLabel>
          <N.NextSteps steps={[{ label: 'Family guide to billing and aid', why: 'From the Bursar and Financial Aid', icon: 'costs' }, { label: 'If you’re worried about your student', why: 'Who to contact, and what they can share', icon: 'support' }]} />
          <N.Notice head="Privacy">Counseling, health and disability information is never shared here, whatever the settings.</N.Notice>
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { GuardianScreen });
