function SupportScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Help · Support</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Who can help</h1><p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Describe the problem. Semester points you to the office that owns it — there’s no wrong door.</p></div></div>
      <div className="cols">
        <div className="stack">
          <N.TextField multiline label="What’s happening?" defaultValue="My financial aid hasn’t come through and my meal plan ran out." />
          <div className="state"><div className="state-title">This sounds like two things</div><p className="state-body">Aid timing is Financial Aid’s. Meals now is Basic Needs — they can help today, before aid arrives.</p><div className="state-actions"><N.Button variant="primary">Ask Basic Needs for meals</N.Button><N.Button>Message Financial Aid</N.Button></div><p className="state-note">Never sent to anyone until you choose. You decide what to share.</p></div>
          <N.SectionLabel>Offices</N.SectionLabel>
          <N.NextSteps steps={[{ label: 'Financial Aid', why: 'Open now · replies within 1 business day', icon: 'costs' }, { label: 'Counseling (confidential)', why: '24/7 line · nothing is shared with Semester', icon: 'support' }, { label: 'Disability Services', why: 'Accommodations · appointments Mon–Fri', icon: 'help' }, { label: 'IT help desk', why: 'Account and Wi-Fi · open until 20:00', icon: 'settings' }]} />
        </div>
        <aside className="stack"><N.SectionLabel>Your requests</N.SectionLabel><N.DecisionTrail items={[{ title: 'Semester support · T-5531', who: 'ECON deadlines missing', when: 'Waiting on support', state: 'current' }, { title: 'Housing · window latch', who: 'Resolved', when: 'Sep 28' }]} /></aside>
      </div>
    </div>
  );
}
Object.assign(window, { SupportScreen });
