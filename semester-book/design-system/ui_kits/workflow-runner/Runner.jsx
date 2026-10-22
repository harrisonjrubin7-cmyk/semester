const N = window.SemesterDesignSystem_e9f3ba;
const C = window.CATALOG, R = window.RUNNER;
const STOP = new Set(['with', 'from', 'through', 'into', 'your', 'their', 'review', 'create', 'manage', 'request', 'build', 'official', 'approved', 'student', 'course']);
const stem = (w) => w.replace(/ies$/, 'y').replace(/ing$/, '').replace(/s$/, '').replace(/e$/, '');
const words = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter((w) => w.length > 3 && !STOP.has(w)).map(stem);
const SCREENS = Object.entries(C.screens).flatMap(([g, list]) => list.map((n) => ({ n, g: g[0], group: g, w: words(n) })));
const first = (rules, s) => { for (const [re, v] of rules) if (re.test(s)) return v; return null; };
const firstK = (rules, s) => { for (const [k, re] of rules) if (re.test(s)) return k; return 'form'; };
function matchScreen(name, groups) {
  const w = words(name); let best = null, score = 0;
  for (const sc of SCREENS) { let s = 0; for (const x of w) if (sc.w.includes(x)) s += 1; if (!s) continue; if (groups.includes(sc.g)) s += 0.5 + (groups.length - groups.indexOf(sc.g)) * 0.01; if (s > score) { score = s; best = sc; } }
  return score >= 1.5 || (best && w.length === 1) ? best : null;
}
const FLOWS = R.flows.map((f) => ({ ...f, steps: (f.list || C.workflows[f.key] || []).map((name, i) => {
  const l = name.toLowerCase();
  let kind = firstK(R.kinds, l); if (f.key === 'AI' && kind === 'form') kind = 'ai';
  return { i, name, actor: first(f.lanes, l), to: first(f.to, l), kind, system: first(R.systems, l), screen: matchScreen(name, f.groups), proto: C.protoW.includes(name) };
}) }));
const TOTAL = FLOWS.reduce((a, f) => a + f.steps.length, 0);
const ALL_ROLES = [...new Set(C.roles.map((r) => r[0]).concat(FLOWS.flatMap((f) => f.steps.flatMap((s) => [s.actor, s.to]).filter(Boolean))))];
const KLABEL = { ai: 'AI gateway', milestone: 'Milestone', decide: 'Decision', consent: 'Consent', sync: 'Sync / data', handoff: 'Hand-off', comms: 'Message', review: 'Review', form: 'Create / edit' };
const SAMPLE = {
  Registration: [['HIST 2140 · Section 01', 'SIS', '4 min ago', 'Open · 3 seats'], ['MATH 1300 · Section 04', 'SIS', '4 min ago', 'Waitlist 6'], ['Time ticket · Nov 11 08:00', 'SIS', '1 h ago', 'Issued']],
  Gradebook: [['Essay 2 · 41 submissions', 'Course', 'Today', '12 to grade'], ['Midterm · 44', 'Course', 'Yesterday', 'Ready to release'], ['Regrade · 2 open', 'Course', 'Today', 'Waiting']],
  'Student Success': [['Caseload · 118 students', 'Read model', '6 min ago', '9 need follow-up'], ['Referrals open · 4', 'Read model', '6 min ago', '2 overdue'], ['Check-ins this week · 23', 'Read model', '6 min ago', 'On track']],
  Integration: [['SIS read sync', 'Connector', '3 min ago', 'Live'], ['LMS roster (OneRoster)', 'Connector', '12 min ago', 'Recent'], ['Holds feed', 'Connector', '2 h ago', 'Delayed']],
  Support: [['T-2041 · Sign-in loop', 'Support desk', '8 min ago', 'S2 · assigned'], ['T-2039 · Hold not cleared', 'Support desk', '1 h ago', 'S3 · registrar'], ['T-2035 · How do I share?', 'Support desk', '3 h ago', 'S4 · answered']],
  Security: [['Error rate · app', 'Monitoring', '1 min ago', '0.4%'], ['SSO failures · 15 min', 'Monitoring', '1 min ago', '3'], ['Gateway blocks · today', 'AI gateway', '5 min ago', '7']]
};
const sampleRows = (sys) => SAMPLE[sys] || [[sys + ' · item 1', 'Semester', '5 min ago', 'Current'], [sys + ' · item 2', 'Connected system', '1 h ago', 'Review'], [sys + ' · item 3', 'Semester', 'Yesterday', 'Done']];
const M = window.OSMAP; const LAYERS = M.layers;
const modCovered = (m) => { const w = words(m); return w.length > 0 && SCREENS.some((sc) => w.every((x) => sc.w.includes(x))); };
const CLASS = { Registration: 'Education record', 'Academic Record': 'Education record', Gradebook: 'Education record', Assessment: 'Education record', 'Degree Audit': 'Education record', Transfer: 'Education record', 'Financial Account': 'Education record · financial', 'Payment Plan': 'Education record · financial', 'Student Success': 'Education record · sensitive', Privacy: 'Personal · consent-bound', Identity: 'Directory', 'AI Gateway': 'Classified per request', Billing: 'Company internal', Security: 'Restricted', Release: 'Company internal', Support: 'Personal (minimum context)' };
function chain(flow, step) {
  const studentData = /record/i.test(CLASS[step.system] || '');
  const needsGrant = step.kind === 'consent' || (studentData && step.actor !== 'Student' && !/Registrar|Faculty|advisor|success|Teaching/i.test(step.actor));
  return [
    ['Identity', step.actor === 'AI gateway (system)' ? 'Service identity, signed request' : step.actor + ' · SSO session'], ['Tenant scope', /^Semester/.test(step.actor) ? 'Semester operator · tenant chosen explicitly' : 'Institution tenant (pilot)'],
    ['Membership', 'Active, not expired'], ['Role', step.actor], ['Capability', step.system.toLowerCase().replace(/ /g, '_') + '.' + step.kind], ['Scope', step.name],
    ['Policy', R.guard[step.kind]], ['Data classification', CLASS[step.system] || 'Internal'], ['Consent / grant', needsGrant ? 'Required: scoped, time-limited grant' : 'Not required for this role'],
    ['Source authority', /Registration|Academic Record|Gradebook|Financial|Degree|Transfer/.test(step.system) ? 'Official system (SIS/LMS) is authoritative' : 'Semester is authoritative'], ['Workflow', flow.name + ' · step ' + (step.i + 1)],
    ['Audit event', step.system.toLowerCase().replace(/ /g, '_') + '.' + step.name.toLowerCase().replace(/[^a-z]+/g, '_').replace(/_$/, '')], ['Evidence', step.kind === 'milestone' ? 'Attached document' : 'Event + before/after state'], ['Outcome', step.to ? 'Hand-off visible to ' + step.to : 'Step complete; next step unlocked']
  ].map(([k, v], n) => [M.chain[n] || k, v]);
}
const STORE = 'sem-runner-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } };

function Chip({ children, tone }) {
  const t = { done: ['var(--status-done-ink, #3d6b4f)', 'var(--status-done-wash, rgba(61,107,79,.08))'], gap: ['var(--status-attention-ink, #8a4b2a)', 'rgba(138,75,42,.08)'], proto: ['var(--blue-700, #416180)', 'rgba(65,97,128,.08)'] }[tone] || ['var(--text-secondary)', 'transparent'];
  return <span className="chip" style={{ color: t[0], background: t[1], borderColor: 'currentColor' }}>{children}</span>;
}

function Stage({ flow, step, done, onDone }) {
  const [txt, setTxt] = React.useState(''); const [vis, setVis] = React.useState('only-me'); const [run, setRun] = React.useState(-1);
  React.useEffect(() => { setTxt(''); setRun(-1); }, [flow.key, step.i]);
  const syncSteps = ['Connect (read-only)', 'Fetch', 'Validate', 'Reconcile', 'Record evidence'];
  const go = () => { if (step.kind === 'sync' && !done) { let k = 0; setRun(0); const t = setInterval(() => { k += 1; setRun(k); if (k >= syncSteps.length) { clearInterval(t); onDone(); } }, 260); } else onDone(); };
  const official = /Registration|Academic Record|Gradebook|Financial Account|Degree Audit|Transfer/.test(step.system);
  let body;
  switch (step.kind) {
    case 'form': body = <div className="stack"><N.TextField label={step.name.replace(/^(Create|Configure|Publish|Define|Add|Build|Record|Enter|Select|Complete|Manage|Issue|Assign|Hold|Join|Order|Organize)\s*/i, '') || step.name} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Title or value" /><N.TextField label="Notes for reviewers" multiline value="" onChange={() => {}} placeholder="Optional" /><N.Notice head="Draft">Saved as version 1. Publishing makes it visible to the roles this step names.</N.Notice></div>; break;
    case 'review': body = <div className="stack"><N.DataTable caption={step.system + ' · read model'} columns={[{ key: 0, label: 'Item' }, { key: 1, label: 'Source' }, { key: 2, label: 'Updated' }, { key: 3, label: 'State' }]} rows={sampleRows(step.system).map((r) => Object.assign({}, r))} /><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><N.SourceBadge source={official ? 'official' : 'connected'} updated="4 min ago" /><span className="muted">Freshness: Live. Read-only view.</span></div></div>; break;
    case 'decide': body = <div className="stack"><N.ActionPreview subject={step.name} says={step.name + ' for the selected record.'} exactly={'Applies to one ' + step.system.toLowerCase() + ' item, written as an audit event first.'} doesNotChange={official ? 'The official record in the SIS until the registrar sync confirms it.' : 'Anything outside this item.'} recovery={{ kind: 'request', how: 'Reverse by a new decision with a reason; both stay in the audit log.' }} /><N.DecisionTrail items={[{ title: 'Requested', who: step.to || 'Requester', when: 'Today 09:12', state: 'done' }, { title: 'Decision', who: step.actor, when: done ? 'Today 09:20' : 'Now', state: done ? 'done' : 'current' }, { title: 'Second approver (if consequential)', who: 'Named approver', state: done ? 'done' : 'waiting' }, { title: 'Applied + notified', who: 'System', state: done ? 'done' : 'waiting' }]} /></div>; break;
    case 'consent': body = <div className="stack"><N.VisibilityPicker value={vis} onChange={setVis} origin="student-entered" /><N.Fields items={[{ field: 'Shared with', value: step.to || 'Chosen person' }, { field: 'What', value: 'Only the items picked here' }, { field: 'Expires', value: '30 days, or when revoked' }, { field: 'Revoke', value: 'You → Privacy & data → Sharing' }]} /></div>; break;
    case 'sync': body = <div className="stack"><N.StepStatus label="Run" steps={syncSteps.map((s, k) => ({ label: s, state: done || run > k ? 'done' : run === k ? 'working' : 'waiting' }))} /><div className="tiles"><N.MetricTile label="Rows checked" value={done ? '4,812' : '—'} source="made" /><N.MetricTile label="Unexplained mismatches" value={done ? '0' : '—'} source="made" /><N.MetricTile label="Direction" value="Read" /></div></div>; break;
    case 'handoff': body = <div className="stack"><N.DecisionTrail items={[{ title: 'Sent from Semester', who: step.actor, when: done ? 'Today 10:02' : 'Now', state: done ? 'done' : 'current' }, { title: 'Received', who: step.to || 'Owning office', state: done ? 'current' : 'waiting' }, { title: 'Resolved in the official system', who: step.to || 'Owning office', state: 'waiting' }, { title: 'Status shown back to the requester', who: 'Semester', state: 'waiting' }]} /><N.Notice head="Hand-off">{(step.to || 'The owning office') + ' acts in their own system. Semester shows the status and never edits it.'}</N.Notice></div>; break;
    case 'comms': body = <div className="stack"><N.TextField label="Message" multiline value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Approved template · plain language" /><N.Fields items={[{ field: 'Audience', value: step.to || 'Named group' }, { field: 'Channel', value: 'In-app, then email (no record content)' }, { field: 'Sender', value: step.actor }]} /></div>; break;
    case 'ai': body = <N.AIResponse scope={[step.actor === 'Student' ? 'Your courses' : 'Course policy', 'Approved sources']} sources={[{ title: 'Course guidance', kind: 'official' }, { title: 'Registration FAQ', kind: 'official' }]} confidence="Medium" policy="Course AI rules: allowed for planning, not for graded work" model="Approved model">{'Gateway step: ' + step.name + '. Student records are not sent to the model.'}</N.AIResponse>; break;
    default: body = <div className="stack"><N.Fields items={[{ field: 'Evidence', value: done ? 'evidence-' + flow.key.split(' ')[0].toLowerCase() + '-' + (step.i + 1) + '.pdf' : 'Not attached' }, { field: 'Owner', value: step.actor }, { field: 'Logged as', value: step.system.toLowerCase().replace(/ /g, '_') + '.milestone', mono: true }]} /></div>;
  }
  return (<div className="frame">
    <div className="framebar"><span><b>{step.screen ? step.screen.n : 'No catalogued screen'}</b> <span className="muted">{step.screen ? '· ' + step.screen.group : '· gap: needs a screen'}</span></span>{step.screen && <a href={R.kits[step.screen.g]} target="_blank" rel="noreferrer">Open kit ↗</a>}</div>
    <div className="framebody">{body}</div>
    <div className="framefoot"><span className="muted">{R.guard[step.kind]}</span><N.Button variant={done ? 'secondary' : 'primary'} onClick={go} disabled={run >= 0 && !done}>{done ? 'Done ✓' : R.verb[step.kind]}</N.Button></div>
  </div>);
}

function Runner() {
  const init = load();
  const [view, setView] = React.useState(init.view || 'map');
  const [fk, setFk] = React.useState(init.fk || FLOWS[0].key);
  const [si, setSi] = React.useState(init.si || 0);
  const [prog, setProg] = React.useState(init.prog || {});
  const [log, setLog] = React.useState(init.log || []);
  const [auto, setAuto] = React.useState(false);
  const [role, setRole] = React.useState(init.role || 'Student');
  React.useEffect(() => { localStorage.setItem(STORE, JSON.stringify({ view, fk, si, prog, log: log.slice(0, 60), role })); }, [view, fk, si, prog, log, role]);
  const flow = FLOWS.find((f) => f.key === fk) || FLOWS[0];
  const step = flow.steps[Math.min(si, flow.steps.length - 1)];
  const doneSet = prog[fk] || [];
  const isDone = (k, i) => (prog[k] || []).includes(i);
  const complete = () => {
    if (!isDone(fk, step.i)) { setProg((p) => ({ ...p, [fk]: [...(p[fk] || []), step.i] })); setLog((l) => [{ t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), f: flow.name, s: step.name, a: step.actor, k: step.kind }, ...l]); }
    if (step.i < flow.steps.length - 1) setTimeout(() => setSi(step.i + 1), 250);
  };
  const ref = React.useRef(complete); ref.current = complete;
  React.useEffect(() => { if (!auto) return; const t = setInterval(() => { if (step.i >= flow.steps.length - 1 && isDone(fk, step.i)) { setAuto(false); return; } ref.current(); }, 1500); return () => clearInterval(t); }, [auto, fk, step.i, prog]);
  const jump = (k, i) => { setFk(k); setSi(i); setView('run'); };
  const resetFlow = (k) => { setProg((p) => ({ ...p, [k]: [] })); if (k === fk) setSi(0); };
  const doneTotal = FLOWS.reduce((a, f) => a + (prog[f.key] || []).length, 0);
  const gaps = FLOWS.flatMap((f) => f.steps.filter((s) => !s.screen).map((s) => ({ f, s })));

  const roleStats = ALL_ROLES.map((r) => { const acts = [], gets = []; FLOWS.forEach((f) => f.steps.forEach((s) => { if (s.actor === r) acts.push({ f, s }); if (s.to === r) gets.push({ f, s }); })); return { r, acts, gets }; });
  const rs = roleStats.find((x) => x.r === role) || roleStats[0];
  const used = new Set(FLOWS.flatMap((f) => f.steps.filter((s) => s.screen).map((s) => s.screen.group + '|' + s.screen.n)));

  const T = [['map', 'OS map · 21 layers', 'map'], ['run', 'Run a workflow', 'runway'], ['flows', 'All workflows', 'pathway'], ['roles', 'By role', 'people'], ['screens', 'Screen coverage', 'apps']];
  const cur = T.find((t) => t[0] === view);
  const nav = (id) => { if (id.startsWith('f:')) jump(id.slice(2), 0); else setView(id); };
  return (<div className="shell"><N.SideRail current={view === 'run' ? 'f:' + fk : view} onNavigate={nav} groups={[{ label: 'Workflow runner', items: T.map(([id, label, icon]) => ({ id, label, icon })) }, { label: 'Workflows', items: FLOWS.map((f) => ({ id: 'f:' + f.key, label: f.name, icon: f.icon, count: f.steps.length })) }]}
    foot={<div style={{ fontSize: 12, color: 'var(--chrome-text-secondary)' }}>{doneTotal} / {TOTAL} steps run · sample data</div>} />
    <div className="main"><N.SystemContextBar location={'Workflow runner · ' + (cur ? cur[1] : flow.name)} term="Every workflow, every role" sync="device-only" />
      <div className="scroll"><div className="page">
        <div className="pagehead"><div><div className="kicker">Workflow runner · {FLOWS.length} workflows · {TOTAL} steps · {C.roles.length} catalogued roles</div><h1>{view === 'run' ? flow.name : cur[1]}</h1></div>
          {view === 'run' && <div className="row"><N.Button variant="ghost" size="sm" onClick={() => resetFlow(fk)}>Reset</N.Button><N.Button variant="secondary" size="sm" onClick={() => setAuto(!auto)}>{auto ? 'Pause' : 'Auto-run'}</N.Button></div>}</div>

        {view === 'run' && <div className="run">
          <ol className="steps" aria-label="Steps">{flow.steps.map((s) => <li key={s.i}><button className={'st' + (s.i === step.i ? ' on' : '')} onClick={() => setSi(s.i)}><span className="g">{isDone(fk, s.i) ? '✓' : s.i === step.i ? '●' : '○'}</span><span><b>{s.i + 1}. {s.name}</b><small>{s.actor}{s.to ? ' → ' + s.to : ''}</small></span></button></li>)}</ol>
          <section className="stack">
            <div><div className="kicker">Step {step.i + 1} of {flow.steps.length} · {KLABEL[step.kind]}</div><h2 className="h2">{step.name}</h2>
              <div className="row" style={{ marginTop: 8 }}><Chip>{step.actor}</Chip>{step.to && <Chip>→ {step.to}</Chip>}<Chip>{step.system}</Chip>{step.proto ? <Chip tone="proto">Designed (prototype)</Chip> : flow.added && !C.workflows[flow.key] ? <Chip tone="gap">Added · not in catalog yet</Chip> : <Chip>Catalogued</Chip>}{!step.screen && <Chip tone="gap">Screen gap</Chip>}</div></div>
            <Stage flow={flow} step={step} done={isDone(fk, step.i)} onDone={complete} />
            <div className="row" style={{ justifyContent: 'space-between' }}><N.Button variant="ghost" onClick={() => setSi(Math.max(0, step.i - 1))} disabled={step.i === 0}>← Back</N.Button><N.Button variant="ghost" onClick={() => setSi(Math.min(flow.steps.length - 1, step.i + 1))} disabled={step.i === flow.steps.length - 1}>Next →</N.Button></div>
          </section>
          <aside className="stack"><N.SectionLabel>Authorization chain</N.SectionLabel><ol className="chain">{chain(flow, step).map(([k, v], n) => <li key={k}><span>{isDone(fk, step.i) || n < 10 ? '✓' : '○'}</span><div><b>{k}</b><br /><span>{v}</span></div></li>)}</ol><details className="card" style={{ padding: '8px 12px' }}><summary><b style={{ fontWeight: 500 }}>Completion</b><span className="mono">{M.done.filter((d) => d[1]).length}/22 design · 0 verified</span></summary><ol className="chain">{M.done.map(([k, d]) => <li key={k}><span>{d ? '◐' : '○'}</span><div>{k}</div></li>)}</ol></details><N.MetricTile label="This workflow" value={doneSet.length + ' / ' + flow.steps.length} delta={Math.round(doneSet.length / flow.steps.length * 100) + '% run'} /><N.SectionLabel>Audit log</N.SectionLabel>
            <div className="log">{log.length ? log.slice(0, 14).map((e, k) => <div key={k}><span className="mono">{e.t}</span> <b>{e.a}</b> · {e.s}<br /><span className="muted">{e.f} · {KLABEL[e.k]}</span></div>) : <span className="muted">Run a step to write the first event.</span>}</div></aside>
        </div>}

        {view === 'map' && <div className="stack" style={{ gap: 22 }}>
          <N.Notice head="Doctrine">{M.doctrine}</N.Notice>
          <div className="stack"><N.SectionLabel>Control chain · every module, every step</N.SectionLabel><div className="row" style={{ gap: 4 }}>{M.chain.map((k, n, a) => <React.Fragment key={k}><span className="chip">{k}</span>{n < a.length - 1 && <span className="muted">→</span>}</React.Fragment>)}</div><p className="muted" style={{ margin: 0 }}>This is what keeps Semester one system instead of a collection of apps. Open any step in Run a workflow to see the chain resolved for it.</p></div>
          <div className="stack"><N.SectionLabel aside={<span className="muted">{LAYERS.reduce((a, l) => a + l[4].length, 0)} modules · {LAYERS.reduce((a, l) => a + l[4].filter(modCovered).length, 0)} matched to a catalog screen</span>}>21 layers</N.SectionLabel>
            {LAYERS.map(([name, g, wf, kit, mods], n) => { const sc = g.split('').map((x) => Object.entries(C.screens).find(([k]) => k[0] === x)).filter(Boolean); const cnt = sc.reduce((a, [, l]) => a + l.length, 0); const fl = FLOWS.filter((f) => wf.includes(f.key)); const cov = mods.filter(modCovered).length; return <details key={name} className="card" style={{ padding: '10px 14px' }}><summary><span><span className="mono" style={{ marginRight: 10 }}>{String(n + 1).padStart(2, '0')}</span><b style={{ fontWeight: 500 }}>{name}</b></span><span className="mono">{cov}/{mods.length} modules · {cnt} screens · {fl.reduce((a, f) => a + f.steps.length, 0)} steps</span></summary>
              <div className="bar"><i style={{ width: (cov / mods.length * 100) + '%' }}></i></div>
              <div className="row" style={{ gap: 6 }}>{mods.map((m) => <span key={m} className="chip" style={modCovered(m) ? {} : { color: 'var(--text-tertiary)', borderStyle: 'dashed' }}>{m}</span>)}</div>
              <div className="row">{sc.length ? <span className="muted">Screens: {sc.map(([k]) => k).join(' + ')}</span> : <Chip tone="gap">No screen group</Chip>}{fl.length ? fl.map((f) => <N.Button key={f.key} size="sm" variant="ghost" onClick={() => jump(f.key, 0)}>Run {f.name}</N.Button>) : <Chip tone="gap">No workflow yet</Chip>}<a href={'../' + kit + '/index.html'} target="_blank" rel="noreferrer">ui_kits/{kit} ↗</a></div></details>; })}
            <p className="muted" style={{ margin: 0 }}>Solid chips match a catalogued screen; dashed chips are modules with no screen yet.</p></div>
          <div className="stack"><N.SectionLabel>Journeys</N.SectionLabel><div className="grid">{M.journeys.map(([h, st]) => <div key={h} className="card"><b className="h3">{h}</b><ol className="chain">{st.map((x, k) => <li key={x}><span className="mono">{k + 1}</span><div>{x}</div></li>)}</ol></div>)}</div></div>
          <div className="stack"><N.SectionLabel aside={<span className="muted">{M.shared.length} required</span>}>Required shared workflows</N.SectionLabel>
            <table className="tbl"><thead><tr><th>Shared workflow</th><th>Runs as</th><th></th></tr></thead><tbody>{M.shared.map(([w, fkk, sn]) => { const f = FLOWS.find((x) => x.key === fkk); const st = f && f.steps.find((x) => x.name === sn); return <tr key={w}><td>{w}</td><td>{st ? f.name + ' · step ' + (st.i + 1) + ' · ' + st.name : <Chip tone="gap">Not catalogued</Chip>}</td><td>{st && <N.Button size="sm" variant="ghost" onClick={() => jump(f.key, st.i)}>Open</N.Button>}</td></tr>; })}</tbody></table></div>
          <div className="stack"><N.SectionLabel>Completion definition · 22 points</N.SectionLabel><p className="muted" style={{ margin: 0 }}>Nothing is complete until all 22 exist. In this project a catalogued step reaches the design-level points below; the rest need repo code, tests and release evidence.</p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))' }}>{M.done.map(([k, d], n) => <div key={k} className="row" style={{ gap: 8 }}><span className="mono">{String(n + 1).padStart(2, '0')}</span><span>{k}</span>{d ? <Chip tone="proto">Design level</Chip> : <Chip tone="gap">Needs repo evidence</Chip>}</div>)}</div></div>
        </div>}

        {view === 'flows' && <div className="grid">{FLOWS.map((f) => { const d = (prog[f.key] || []).length; const lanes = [...new Set(f.steps.map((s) => s.actor))]; return <div key={f.key} className="card"><div className="row" style={{ justifyContent: 'space-between' }}><b className="h3">{f.name}</b><span className="mono">{d}/{f.steps.length}</span></div><div className="bar"><i style={{ width: (d / f.steps.length * 100) + '%' }}></i></div><p className="muted" style={{ margin: 0 }}>{lanes.length} roles act: {lanes.join(', ')}</p><p className="muted" style={{ margin: 0 }}>{f.steps.filter((s) => s.proto).length} steps designed · {f.steps.filter((s) => !s.screen).length} screen gaps</p><div className="row"><N.Button size="sm" onClick={() => jump(f.key, (f.steps.find((s) => !isDone(f.key, s.i)) || f.steps[0]).i)}>{d ? 'Continue' : 'Start'}</N.Button><N.Button size="sm" variant="ghost" onClick={() => resetFlow(f.key)}>Reset</N.Button></div></div>; })}</div>}

        {view === 'roles' && <div className="cols">
          <div className="rolelist">{roleStats.map((x) => <button key={x.r} className={'st' + (x.r === role ? ' on' : '')} onClick={() => setRole(x.r)}><span className="g">{x.acts.length ? '●' : x.gets.length ? '◐' : '○'}</span><span><b>{x.r}</b><small>{x.acts.length} steps act · {x.gets.length} receive</small></span></button>)}</div>
          <section className="stack"><h2 className="h2">{rs.r}</h2><p className="muted" style={{ margin: 0 }}>{(C.roles.find((r) => r[0] === rs.r) || [, 'System actor: the AI gateway checks scope and policy for every request.'])[1]}</p>
            {!rs.acts.length && !rs.gets.length && <N.Notice head="No workflow yet">This role has screens in the catalog but no catalogued workflow steps. Add its workflow to catalog-data.js and it appears here.</N.Notice>}
            {[['Acts in', rs.acts], ['Receives hand-offs in', rs.gets]].map(([h, list]) => list.length > 0 && <div key={h} className="stack"><N.SectionLabel>{h} · {list.length}</N.SectionLabel><div className="list">{list.map(({ f, s }) => <button key={f.key + s.i} className="st" onClick={() => jump(f.key, s.i)}><span className="g">{isDone(f.key, s.i) ? '✓' : '○'}</span><span><b>{s.name}</b><small>{f.name} · step {s.i + 1} · {KLABEL[s.kind]}{s.screen ? ' · ' + s.screen.n : ' · screen gap'}</small></span></button>)}</div></div>)}
          </section></div>}

        {view === 'screens' && <div className="stack">
          <p className="muted" style={{ margin: 0 }}>Each catalog screen group, with the screens at least one workflow step runs through. Unused screens are standalone views (settings, directories, marketing) or missing workflows.</p>
          <div className="grid">{Object.entries(C.screens).map(([g, list]) => { const u = list.filter((n) => used.has(g + '|' + n)); return <details key={g} className="card"><summary><b>{g}</b> <span className="mono">{u.length}/{list.length} in a workflow</span></summary><div className="bar"><i style={{ width: (u.length / list.length * 100) + '%' }}></i></div><p className="small">{list.map((n, k) => <span key={n} style={{ color: used.has(g + '|' + n) ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{n}{k < list.length - 1 ? ' · ' : ''}</span>)}</p><a href={R.kits[g[0]]} target="_blank" rel="noreferrer">Open kit ↗</a></details>; })}</div>
          <N.SectionLabel>Steps with no catalogued screen · {gaps.length}</N.SectionLabel>
          <div className="list">{gaps.map(({ f, s }) => <button key={f.key + s.i} className="st" onClick={() => jump(f.key, s.i)}><span className="g">!</span><span><b>{s.name}</b><small>{f.name} · step {s.i + 1} · {s.actor}</small></span></button>)}</div>
        </div>}
      </div></div></div></div>);
}
function App() { return <Runner />; }
Object.assign(window, { RunnerStage: Stage, RUNNER_FLOWS: FLOWS, runnerChain: chain });
if (!window.NO_RUNNER_MOUNT) ReactDOM.createRoot(document.getElementById('root')).render(<App />);
