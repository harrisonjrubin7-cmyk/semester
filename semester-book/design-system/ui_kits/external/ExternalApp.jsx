function ExternalApp() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [screen, setScreen] = React.useState(() => localStorage.getItem('sem-external-screen') || 'applicant');
  const go = (s) => { setScreen(s); localStorage.setItem('sem-external-screen', s); };
  const S = { applicant: ['ApplicantScreen', 'Application', 'Alex Moreno', 'Applicant'], guardian: ['GuardianScreen', 'Family portal', 'Jonas Lindqvist', 'Guardian'], alumni: ['AlumniScreen', 'Alumni', 'Priya Raman', 'Alumni'], employer: ['EmployerScreen', 'Postings', 'Genvia Bio · D. Park', 'Employer'], partner: ['PartnerScreen', 'Listing', 'Northside Tutoring', 'Marketplace partner'] };
  const [comp, name, who, role] = S[screen]; const Screen = window[comp];
  return (
    <div className="shell">
      <N.SideRail current={screen} onNavigate={(id) => S[id] && go(id)} foot={<><div style={{ color: 'var(--chrome-text)' }}>{who}</div><div>{role}</div></>}
        groups={[{ label: 'Before', items: [{ id: 'applicant', label: 'Applicant', icon: 'applying' }] }, { label: 'Around the student', items: [{ id: 'guardian', label: 'Guardian', icon: 'family' }] }, { label: 'After', items: [{ id: 'alumni', label: 'Alumni', icon: 'university' }] }, { label: 'Partners', items: [{ id: 'employer', label: 'Employer', icon: 'career' }, { id: 'partner', label: 'Marketplace partner', icon: 'hub' }] }]} />
      <div className="main">
        <div className="scope"><span>Signed in as <b>{who}</b></span><span>Role <b>{role}</b></span><span style={{ marginLeft: 'auto' }}>You see only what students and the institution share with you</span></div>
        <N.SystemContextBar location={name} term="Northfield University" sync="synced" />
        <div className="scroll" key={screen}><Screen go={go} /></div>
      </div>
    </div>
  );
}
window.__extRoot = window.__extRoot || ReactDOM.createRoot(document.getElementById('root'));
window.__extRoot.render(<ExternalApp />);
