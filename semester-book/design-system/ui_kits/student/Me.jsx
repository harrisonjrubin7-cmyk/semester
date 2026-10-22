function MeScreen({ go }) {
  const N = window.SemesterDesignSystem_e9f3ba;
  return (
    <div className="page">
      <div className="pagehead"><div style={{ display: 'flex', gap: 16, alignItems: 'center' }}><N.Avatar name="Maya Lindqvist" size={56} /><div><div className="kicker">Progress · Me</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 4 }}>Maya Lindqvist</h1><p style={{ color: 'var(--text-secondary)' }}>Biology ’28 · Northfield University</p></div></div></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
        <N.MetricTile label="Credits" value="94" unit="of 120" source="official" updated="3 Oct" />
        <N.MetricTile label="Term GPA (Spring)" value="3.62" source="official" updated="Registrar" />
        <N.MetricTile label="This term so far" value="82.5%" unit="BIO 210" source="estimated" />
        <N.MetricTile label="Study time · week" value="11.5" unit="h" source="personal" />
      </div>
      <div className="cols sec"><div><N.SectionLabel>Recommended next step</N.SectionLabel><N.NextSteps steps={[{ label: 'Prepare for advising on Thu', why: 'Bring your Data Science what-if', icon: 'meet', onClick: () => go('advising') }, { label: 'Review your degree', why: '26 credits left', icon: 'degree', onClick: () => go('degree') }]} /></div><aside><N.Notice head="Note">No streaks, ranks or comparisons with other students — ever.</N.Notice></aside></div>
    </div>
  );
}
Object.assign(window, { MeScreen });
