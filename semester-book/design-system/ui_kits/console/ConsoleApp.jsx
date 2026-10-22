function ConsoleApp() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [screen, setScreen] = React.useState(() => localStorage.getItem('sem-console-screen') || 'overview');
  const go = (s) => { setScreen(s); localStorage.setItem('sem-console-screen', s); };
  const map = { overview: [window.OverviewScreen, 'Overview'], approvals: [window.ApprovalsScreen, 'Approvals'], integrations: [window.IntegrationsScreen, 'Integrations'], audit: [window.AuditScreen, 'Audit log'], security: [window.SecurityScreen, 'Security operations'], support: [window.SupportQueueScreen, 'Support queue'] };
  const [Screen, name] = map[screen] || map.overview;
  return (
    <div className="shell">
      <N.SideRail current={screen} onNavigate={(id) => map[id] && go(id)} foot={<><div style={{ color: 'var(--chrome-text)' }}>Institution Console</div><div>Northfield University</div></>}
        groups={[{ items: [{ id: 'overview', label: 'Overview', icon: 'data' }, { id: 'approvals', label: 'Approvals', icon: 'yes', count: 3 }, { id: 'support', label: 'Support queue', icon: 'support', count: 27 }] },
          { label: 'Configure', items: [{ id: 'roles', label: 'Roles & permissions', icon: 'people' }, { id: 'policies', label: 'Policies', icon: 'privacy' }, { id: 'integrations', label: 'Integrations', icon: 'connect' }, { id: 'flags', label: 'Feature flags', icon: 'settings' }] },
          { label: 'Govern', items: [{ id: 'security', label: 'Security operations', icon: 'privacy' }, { id: 'audit', label: 'Audit log', icon: 'proof' }, { id: 'evidence', label: 'Compliance evidence', icon: 'sources' }] }]} />
      <div className="main">
        <div className="envbar"><span>Environment <b>◆ Production</b></span><span>Scope <b>nfu-prod</b></span><span>Operator <b>k.osei@northfield.edu</b></span><span>MFA <b>Fresh — verified 4 min ago</b></span><span style={{ marginLeft: 'auto' }}>Session expires 12:40</span></div>
        <N.SystemContextBar location={name} term="Fall 2026" sync="synced" />
        <div className="scroll"><Screen go={go} /></div>
      </div>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<ConsoleApp />);
