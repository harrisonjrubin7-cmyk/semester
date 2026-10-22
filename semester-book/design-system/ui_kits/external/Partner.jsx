function PartnerScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Marketplace partner · Northside Tutoring</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Your listing</h1></div><N.StatusChip status="pending" label="In review · not visible to students" /></div>
      <div className="cols">
        <div className="stack">
          <N.ObjectCard kind="Listing preview" statuses={['beta']} title="Organic chemistry tutoring · $40 / hour" provenance={{ origin: 'external', by: 'Northside Tutoring · Sponsored' }} explanation="One-to-one, online or at Laird Library. Cancellation up to 24 hours before." primary={{ label: 'Book a session' }} secondary={{ label: 'Report this listing' }} />
          <N.SectionLabel>Review checklist</N.SectionLabel>
          <N.DecisionTrail items={[{ title: 'Publisher identity verified', when: 'Sep 30' }, { title: 'Accessibility of listing', when: 'Oct 2' }, { title: 'Pricing and refund terms', state: 'current', who: 'Marketplace team' }, { title: 'Sponsorship label confirmed', state: 'waiting' }, { title: 'Visible to students', state: 'waiting' }]} />
        </div>
        <aside className="stack"><N.SectionLabel>How students see you</N.SectionLabel>
          <N.Notice head="Labels">Every listing shows its provider, a Sponsored label if paid, the refund route and a Report link. Partners can’t restyle these.</N.Notice>
          <N.Fields items={[{ field: 'Data you receive', value: 'Name and school email at booking only' }, { field: 'Payments', value: 'Through the provider; Semester doesn’t hold funds' }, { field: 'Disputes', value: 'Marketplace team · 5 business days' }]} />
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { PartnerScreen });
