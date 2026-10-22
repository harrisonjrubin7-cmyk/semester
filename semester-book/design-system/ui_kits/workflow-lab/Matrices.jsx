function MatrixView() {
  const N = window.SemesterDesignSystem_e9f3ba, L = window.LAB;
  const rows = [
    { platform: 'Claude Artifacts', use: 'Self-contained tools, diagrams, prototypes', exec: 'Client-side sandbox', limits: 'Approved CDNs only; storage/fetch may be restricted', react: 4, state: 4, persist: 1, multi: 1, server: 0, db: 0, auth: 0, doc: 3, code: 4, gh: 1, deploy: 1, best: 'Decision tools, catalog, diagrams' },
    { platform: 'ChatGPT Canvas', use: 'Revision-centred writing, code iteration', exec: 'Isolated React/HTML preview; Python', limits: 'Isolated preview; not a host', react: 3, state: 3, persist: 1, multi: 2, server: 1, db: 0, auth: 0, doc: 5, code: 3, gh: 1, deploy: 0, best: 'PRDs, TDDs, CSV analysis' },
    { platform: 'v0', use: 'Multi-file Next.js apps', exec: 'VM-backed Node.js sandbox', limits: 'Isolated VM; server code, API routes, DB', react: 5, state: 5, persist: 4, multi: 5, server: 5, db: 4, auth: 4, doc: 1, code: 5, gh: 5, deploy: 5, best: 'Authenticated, DB-backed features' },
  ];
  const [sort, setSort] = React.useState({ k: 'platform', d: 1 });
  const word = (n) => ['None', 'Minimal', 'Partial', 'Good', 'Strong', 'Native'][n];
  const C = [['platform', 'Platform'], ['use', 'Primary use'], ['exec', 'Execution'], ['limits', 'Sandbox limits'], ['react', 'React'], ['state', 'Client state'], ['persist', 'Persistent'], ['multi', 'Multi-file'], ['server', 'Server/API'], ['db', 'Database'], ['auth', 'Auth'], ['doc', 'Doc export'], ['code', 'Code export'], ['gh', 'GitHub'], ['deploy', 'Deploy'], ['best', 'Best Semester use']];
  const s = [...rows].sort((a, b) => (a[sort.k] > b[sort.k] ? 1 : a[sort.k] < b[sort.k] ? -1 : 0) * sort.d);
  return (
    <div className="stack" style={{ gap: 28 }}>
      <div className="table-wrap" role="region" aria-label="Feature matrix" tabIndex={0}><table className="table" style={{ minWidth: 1500 }}><thead><tr>{C.map(([k, l]) => <th key={k} aria-sort={sort.k === k ? (sort.d === 1 ? 'ascending' : 'descending') : 'none'}><button type="button" style={{ all: 'unset', cursor: 'pointer' }} onClick={() => setSort((x) => ({ k, d: x.k === k ? -x.d : 1 }))}>{l}{sort.k === k ? (sort.d === 1 ? ' ↑' : ' ↓') : ''}</button></th>)}</tr></thead>
        <tbody>{s.map((r) => <tr key={r.platform}>{C.map(([k]) => <td key={k} className={typeof r[k] === 'number' ? 'nums' : undefined}>{typeof r[k] === 'number' ? word(r[k]) + ' · ' + r[k] : k === 'platform' ? <b style={{ fontWeight: 600 }}>{r[k]}</b> : r[k]}</td>)}</tr>)}</tbody></table></div>
      <div><N.SectionLabel aside="12">Canonical workflows</N.SectionLabel>
        <N.DataTable caption="Workflows" columns={[{ key: 'number', label: '#', numeric: true }, { key: 'title', label: 'Workflow' }, { key: 'category', label: 'Category' }, { key: 'rec', label: 'Recommended', render: (w) => L.PL[w.recommended] }, { key: 'p', label: 'Persistence', render: (w) => w.requiresPersistence ? <N.StatusChip status="action-required" label="Required" /> : '—' }, { key: 'w', label: 'Weights', render: (w) => w.weights ? 'Override' : 'Default' }]} rows={L.WORKFLOWS} /></div>
    </div>
  );
}
Object.assign(window, { MatrixView });
