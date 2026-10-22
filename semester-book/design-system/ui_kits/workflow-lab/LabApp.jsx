function LabApp() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [v, setV] = React.useState(() => localStorage.getItem('sem-lab-view') || 'router');
  const go = (x) => { setV(x); localStorage.setItem('sem-lab-view', x); };
  const T = { router: ['RouterView', 'Workflow router', 'Where should this be built?'], matrix: ['MatrixView', 'Feature matrix', 'Claude Artifacts vs ChatGPT Canvas vs v0'], bench: ['BenchmarkView', 'Benchmark lab', 'Twelve workflows × three platforms'] };
  const [c, title, h] = T[v]; const View = window[c];
  return (
    <div className="shell">
      <N.SideRail current={v} onNavigate={(id) => T[id] && go(id)} foot={<><div style={{ color: 'var(--chrome-text)' }}>AI Workflow Router</div><div>Prototype mode · runs saved on this device</div></>} groups={[{ items: [{ id: 'router', label: 'Workflow router', icon: 'pathway' }, { id: 'matrix', label: 'Feature matrix', icon: 'sheet' }, { id: 'bench', label: 'Benchmark lab', icon: 'analyse' }] }]} />
      <div className="main"><N.SystemContextBar location={title} term="Semester · internal tool" sync="device-only" />
        <div className="scroll" key={v}><div className="page" style={{ maxWidth: 1280 }}><div className="pagehead"><div><div className="kicker">{title}</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>{h}</h1></div></div><View /></div></div></div>
    </div>
  );
}
window.__labRoot = window.__labRoot || ReactDOM.createRoot(document.getElementById('root'));
window.__labRoot.render(<LabApp />);
