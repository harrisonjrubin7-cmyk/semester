function StaffApp() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [screen, setScreen] = React.useState(() => localStorage.getItem('sem-staff-screen') || 'faculty');
  const go = (s) => { setScreen(s); localStorage.setItem('sem-staff-screen', s); };
  const S = { faculty: ['FacultyScreen', 'Gradebook', 'Prof. A. Okafor', 'Faculty'], advisor: ['AdvisorScreen', 'Advising', 'Dr. A. Okafor', 'Advisor'], registrar: ['RegistrarScreen', 'Registration desk', 'R. Alvarez', 'Registrar'], finance: ['FinanceScreen', 'Student accounts', 'M. Chen', 'Student Accounts'], ta: ['TAScreen', 'Grading queue', 'J. Okonkwo', 'Teaching assistant'], affairs: ['StudentAffairsScreen', 'Support requests', 'L. Ferreira', 'Student affairs'] };
  const [comp, name, who, role] = S[screen]; const Screen = window[comp];
  return (
    <div className="shell">
      <N.SideRail current={screen} onNavigate={(id) => S[id] && go(id)} foot={<><div style={{ color: 'var(--chrome-text)' }}>{who}</div><div>Northfield University</div></>}
        groups={[{ label: 'Teaching', items: [{ id: 'faculty', label: 'Gradebook', icon: 'proof' }, { id: 'ta', label: 'TA grading queue', icon: 'check', count: 16 }] }, { label: 'Advisor', items: [{ id: 'advisor', label: 'Advisees', icon: 'people', count: 42 }] }, { label: 'Registrar', items: [{ id: 'registrar', label: 'Registration desk', icon: 'registrar', count: 3 }] }, { label: 'Finance', items: [{ id: 'finance', label: 'Student accounts', icon: 'costs' }] }, { label: 'Student affairs', items: [{ id: 'affairs', label: 'Support requests', icon: 'support', count: 2 }] }]} />
      <div className="main">
        <div className="scope"><span>Role <b>{role}</b></span><span>Scope <b>nfu-prod</b></span><span>Signed in <b>{who}</b></span><span style={{ marginLeft: 'auto' }}>Every record view is logged</span></div>
        <N.SystemContextBar location={name} term="Fall 2026 · Week 6" sync="synced" />
        <div className="scroll" key={screen}><Screen go={go} /></div>
      </div>
    </div>
  );
}
window.__staffRoot = window.__staffRoot || ReactDOM.createRoot(document.getElementById('root'));
window.__staffRoot.render(<StaffApp />);
