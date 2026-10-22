const N = window.SemesterDesignSystem_e9f3ba;
const C = window.CATALOG, R = window.RUNNER, P = window.ROLEPAGES;
const STOP = new Set(['with', 'from', 'through', 'into', 'your', 'their', 'review', 'create', 'manage', 'request', 'build', 'official', 'approved', 'student', 'course']);
const stem = (w) => w.replace(/ies$/, 'y').replace(/ing$/, '').replace(/s$/, '').replace(/e$/, '');
const words = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter((w) => w.length > 3 && !STOP.has(w)).map(stem);
const SCREENS = Object.entries(C.screens).flatMap(([g, list]) => list.map((n) => ({ n, g: g[0], group: g, w: words(n) })));
const first = (rules, s) => { for (const [re, v] of rules) if (re.test(s)) return v; return null; };
const firstK = (rules, s) => { for (const [k, re] of rules) if (re.test(s)) return k; return 'form'; };
const match = (name, groups) => { const w = words(name); let best = null, score = 0; for (const sc of SCREENS) { let s = 0; for (const x of w) if (sc.w.includes(x)) s++; if (!s) continue; if (groups.includes(sc.g)) s += 0.5 + (groups.length - groups.indexOf(sc.g)) * 0.01; if (s > score) { score = s; best = sc; } } return score >= 1.5 || (best && w.length === 1) ? best : null; };
const FLOWS = R.flows.map((f) => ({ ...f, steps: (f.list || C.workflows[f.key] || []).map((name, i) => { const l = name.toLowerCase(); let kind = firstK(R.kinds, l); if (f.key === 'AI' && kind === 'form') kind = 'ai'; return { i, name, actor: first(f.lanes, l), to: first(f.to, l), kind, system: first(R.systems, l), screen: match(name, f.groups) }; }) }));
const ONB = { Applicant: 'Applicant', Student: 'Student', Guardian: 'Guardian', Alumni: 'Alumni', Faculty: 'Faculty', TA: 'TA', Advisor: 'Advisor', Registrar: 'Registrar', Finance: 'Finance', 'Student affairs': 'StudentAffairs', 'IT security': 'ITSecurity', Support: 'Support', Employer: 'Employer' };
const ICON = { learner: 'today', family: 'family', academic: 'courses', service: 'campus', institution: 'university', external: 'career', company: 'brief' };
const ROLE_NAMES = C.roles.map((r) => r[0]);
function openRunner(fk, si) { try { const s = JSON.parse(localStorage.getItem('sem-runner-v1') || '{}'); localStorage.setItem('sem-runner-v1', JSON.stringify({ ...s, view: 'run', fk, si })); } catch (e) {} window.open('../workflow-runner/index.html', '_blank'); }
function App() {
  const [role, setRole] = React.useState(() => { const h = decodeURIComponent((location.hash || '').slice(1)); return ROLE_NAMES.includes(h) ? h : (localStorage.getItem('sem-rolepages') || 'Student'); });
  React.useEffect(() => { localStorage.setItem('sem-rolepages', role); history.replaceState(null, '', '#' + encodeURIComponent(role)); const m = document.querySelector('.scroll'); if (m) m.scrollTop = 0; }, [role]);
  const meta = P.roles[role] || ['learner', 'B', null, [], []];
  const [cat, groups, onb, kpis, day] = meta;
  const cd = P.cats[cat];
  const purpose = (C.roles.find((r) => r[0] === role) || [, ''])[1];
  const acts = [], gets = [];
  FLOWS.forEach((f) => f.steps.forEach((s) => { if (s.actor === role) acts.push({ f, s }); if (s.to === role) gets.push({ f, s }); }));
  const touched = [...new Map(acts.concat(gets).filter((x) => x.s.screen).map((x) => [x.s.screen.n, x.s.screen])).values()];
  const homeGroups = groups.split('').map((g) => Object.entries(C.screens).find(([k]) => k[0] === g)).filter(Boolean);
  const railGroups = Object.keys(P.cats).map((c) => ({ label: P.cats[c][0], items: ROLE_NAMES.filter((r) => (P.roles[r] || [])[0] === c).map((r) => ({ id: r, label: r, icon: ICON[c] })) }));
  const flowsIn = [...new Set(acts.concat(gets).map((x) => x.f.name))];
  return <div className="shell"><N.SideRail current={role} onNavigate={setRole} groups={railGroups} />
    <div className="main"><N.SystemContextBar location={'Roles · ' + role} term={ROLE_NAMES.length + ' roles'} sync="device-only" />
      <div className="scroll"><article className="page" data-screen-label={role}>
        <header className="ph"><div><div className="kicker">{cd[0]}</div><h1>{role}</h1><p className="lead">{purpose}</p></div>
          <div className="row">{onb && <a className="btn btn-sm" href={'../../templates/role-onboarding/Onboarding' + ONB[onb] + '.dc.html'} target="_blank" rel="noreferrer">Open onboarding ↗</a>}<button className="btn btn-sm" onClick={() => window.print()}>Print</button></div></header>
        <div className="tiles"><N.MetricTile label="Workflow steps acted" value={String(acts.length)} /><N.MetricTile label="Hand-offs received" value={String(gets.length)} /><N.MetricTile label="Workflows" value={String(flowsIn.length)} /><N.MetricTile label="Screens in workflows" value={String(touched.length)} /></div>
        <div className="cols">
          <section className="stack"><N.SectionLabel>A day in the life</N.SectionLabel><ol className="day">{day.map((d, i) => <li key={i}><span className="mono">{['Morning', 'Midday', 'Afternoon', 'Later'][i] || ''}</span><span>{d}</span></li>)}</ol></section>
          <section className="stack"><N.SectionLabel>What success looks like</N.SectionLabel><ul className="kpi">{kpis.map((k) => <li key={k}>{k}</li>)}</ul><p className="muted">KPIs are design-level targets to agree per institution; measure in aggregate.</p></section>
        </div>
        <section className="stack"><N.SectionLabel>Permissions</N.SectionLabel><N.Notice head="Data boundary">{cd[1]}</N.Notice><div className="cols"><div><div className="kicker">Can</div><ul className="kpi">{cd[2].map((x) => <li key={x}>{x}</li>)}</ul></div><div><div className="kicker">Never</div><ul className="kpi never">{cd[3].map((x) => <li key={x}>{x}</li>)}</ul></div></div></section>
        <section className="stack"><N.SectionLabel aside={<span className="muted">Opens the workflow runner at that step</span>}>Workflows</N.SectionLabel>
          {acts.length + gets.length === 0 ? <N.Notice head="No workflow yet">This role has screens in the catalog but no workflow steps. Add its workflow to the runner data and it appears here.</N.Notice> : <div className="list">{[['Acts', acts], ['Receives', gets]].map(([h, l]) => l.map(({ f, s }) => <button key={h + f.key + s.i} className="st" onClick={() => openRunner(f.key, s.i)}><span className="tag">{h}</span><span><b>{s.name}</b><small>{f.name} · step {s.i + 1}{s.screen ? ' · ' + s.screen.n : ' · screen gap'}</small></span></button>))}</div>}</section>
        <section className="stack"><N.SectionLabel>Screens</N.SectionLabel><div className="grid">{homeGroups.map(([g, list]) => <div key={g} className="card"><b>{g}</b><span className="muted">{list.length} screens</span><a href={R.kits[g[0]]} target="_blank" rel="noreferrer">Open kit ↗</a></div>)}</div>
          {touched.length > 0 && <p className="small"><span className="kicker">Used in this role’s workflows</span><br />{touched.map((s) => s.n).join(' · ')}</p>}</section>
      </article></div></div></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
