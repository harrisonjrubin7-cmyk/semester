function ApplicantScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Applicant · Northfield University · Fall 2027</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Your application</h1><p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Two items left. Decisions are made by the Admissions Office; Semester shows their status.</p></div><N.StatusChip status="pending" label="In progress · due 15 Jan" /></div>
      <div className="cols">
        <div className="stack">
          <N.DecisionTrail items={[{ title: 'Application started', when: 'Sep 12' }, { title: 'Essay submitted', when: 'Oct 2' }, { title: 'Transcript', who: 'Requested from Lincoln High · not received yet', state: 'current' }, { title: 'Recommendation (1 of 2)', who: 'Ms. Ortega submitted Oct 4', state: 'current' }, { title: 'Submit application', state: 'waiting' }, { title: 'Decision', who: 'Admissions Office · by 1 Apr', state: 'waiting' }]} />
          <N.ObjectCard kind="Checklist item" statuses={['action-required']} title="Second recommendation" provenance={{ origin: 'official', by: 'Admissions checklist' }} explanation="Mr. Huang hasn’t opened the request yet. You can send a reminder or choose someone else." primary={{ label: 'Send a reminder' }} secondary={{ label: 'Choose another recommender' }} />
        </div>
        <aside className="stack"><N.SectionLabel>Cost and aid</N.SectionLabel>
          <N.MetricTile label="Estimated net price" value="$18,400" unit="/ year" source="estimated" updated="From the net price calculator" />
          <N.Notice head="Note">An estimate, not an offer. Your official aid offer comes from Financial Aid after you’re admitted.</N.Notice>
          <N.NextSteps steps={[{ label: 'Visit campus · Oct 18', why: 'Tour + info session · 2 seats left', icon: 'campus' }, { label: 'Ask Admissions', why: 'Replies within 2 business days', icon: 'mail' }]} />
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { ApplicantScreen });
