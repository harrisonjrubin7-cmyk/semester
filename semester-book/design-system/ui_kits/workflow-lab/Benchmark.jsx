function BenchmarkView() {
  const N = window.SemesterDesignSystem_e9f3ba, L = window.LAB;
  const KEY = 'sem-lab-runs';
  const [runs, setRuns] = React.useState(() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } });
  const save = (n) => { setRuns(n); localStorage.setItem(KEY, JSON.stringify(n)); };
  const [sel, setSel] = React.useState({ w: 9, p: 'v0' });
  const id = sel.w + ':' + sel.p; const wf = L.WORKFLOWS.find((w) => w.number === sel.w); const run = runs[id] || { status: 'manual-review-required', grades: {}, pTested: wf.requiresPersistence, pSurvived: null, pMode: 'none', pEvidence: '', url: '', evidence: '' };
  const g = L.guard(sel.p, wf); const cap = L.ceiling(run, wf.requiresPersistence); const sc = L.score(run.grades, wf.weights);
  const set = (patch) => save({ ...runs, [id]: { ...run, ...patch } });
  const cell = (w, p) => { const r = runs[w.number + ':' + p]; if (!r) return null; return L.score(r.grades, w.weights).outOf100; };
  const board = Object.keys(L.PL).map((p) => { const v = L.WORKFLOWS.map((w) => cell(w, p)).filter((x) => x != null); return { p, graded: v.length, s: v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null }; }).sort((a, b) => (b.s ?? -1) - (a.s ?? -1));
  const rows = L.WORKFLOWS.flatMap((w) => Object.keys(L.PL).map((p) => ({ workflow: w.number, title: w.title, platform: L.PL[p], status: (runs[w.number + ':' + p] || {}).status || 'no-run', outOf100: cell(w, p) })));
  return (
    <div className="stack" style={{ gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>{board.map((b, i) => <N.MetricTile key={b.p} label={(i + 1) + ' · ' + L.PL[b.p]} value={b.s == null ? '—' : String(b.s)} unit="/ 100" delta={b.graded + ' of 12 tasks graded'} />)}</div>
      <div className="table-wrap"><table className="table"><thead><tr><th>#</th><th>Workflow</th>{Object.keys(L.PL).map((p) => <th key={p}>{L.PL[p]}</th>)}</tr></thead><tbody>{L.WORKFLOWS.map((w) => <tr key={w.number}><td className="nums">{w.number}</td><td>{w.title}</td>{Object.keys(L.PL).map((p) => { const r = runs[w.number + ':' + p]; const v = cell(w, p); const on = sel.w === w.number && sel.p === p; return <td key={p}><button type="button" onClick={() => setSel({ w: w.number, p })} style={{ all: 'unset', cursor: 'pointer', padding: '2px 6px', borderRadius: 3, outline: on ? '2px solid var(--focus-color)' : 'none' }}>{!r ? <span style={{ color: 'var(--text-tertiary)' }}>No run</span> : v == null ? <N.StatusChip status={r.status === 'unsupported' ? 'rejected' : 'pending'} label={r.status} /> : <span className="nums">{v}</span>}</button></td>; })}</tr>)}</tbody></table></div>
      <div className="cols">
        <div className="object-card">
          <div className="object-card-eyebrow">Run · #{wf.number} {wf.title} · {L.PL[sel.p]}</div>
          {!g.ok && <N.Notice head="Unsupported">{g.reason}</N.Notice>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><N.Select label="Status" options={['completed', 'manual-review-required', 'unsupported', 'failed']} value={run.status} onChange={(e) => set({ status: e.target.value })} /><N.TextField label="Output URL" value={run.url} onChange={(e) => set({ url: e.target.value })} /></div>
          <fieldset style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 12, display: 'grid', gap: 8 }}><legend className="kicker" style={{ padding: '0 4px' }}>Persistence test{wf.requiresPersistence ? ' · required' : ''}</legend>
            <N.Switch label="Tested reload" checked={!!run.pTested} onChange={(v) => set({ pTested: v })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 10 }}><N.Select label="Survived reload" options={[{ value: '', label: 'Not recorded' }, { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} value={run.pSurvived == null ? '' : run.pSurvived ? 'yes' : 'no'} onChange={(e) => set({ pSurvived: e.target.value === '' ? null : e.target.value === 'yes' })} /><N.Select label="Storage mode" options={['none', 'local-preview', 'browser-local', 'session', 'database', 'project-backed']} value={run.pMode} onChange={(e) => set({ pMode: e.target.value })} /><N.TextField label="Evidence (row id, URL, log)" value={run.pEvidence} onChange={(e) => set({ pEvidence: e.target.value })} /></div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Persistence grade capped at {cap}. Local UI state never earns more than 2.</span></fieldset>
        </div>
        <aside className="object-card">
          <div className="object-card-eyebrow">Grade 0–5 · {wf.weights ? 'task weights' : 'default weights'}</div>
          {L.CRIT.map((c) => <div key={c} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 13 }}>{L.CRIT_L[c]}</span><div style={{ display: 'flex', gap: 4 }}>{[0, 1, 2, 3, 4, 5].map((n) => { const dis = c === 'persistence' && n > cap; return <button key={n} type="button" disabled={dis} aria-pressed={run.grades[c] === n} onClick={() => set({ grades: { ...run.grades, [c]: n } })} className="nums" style={{ width: 30, height: 30, border: '1px solid var(--border-default)', borderRadius: 3, background: run.grades[c] === n ? 'var(--text-primary)' : 'var(--surface-raised)', color: run.grades[c] === n ? 'var(--surface-canvas)' : 'var(--text-primary)', opacity: dis ? .35 : 1, cursor: dis ? 'not-allowed' : 'pointer' }}>{n}</button>; })}</div></div>)}
          <N.TextField multiline label="Evidence and notes" value={run.evidence} onChange={(e) => set({ evidence: e.target.value })} />
          <div className="nums" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22 }}>{sc.outOf5 ?? '—'} / 5 · {sc.outOf100 ?? '—'} / 100</div>
          {sc.missing.length > 0 && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Missing: {sc.missing.map((m) => L.CRIT_L[m]).join(', ')}</span>}
          <div className="object-card-actions"><N.Button size="sm" icon="export" onClick={() => L.download('semester-benchmark.csv', 'text/csv', L.csv(rows, ['workflow', 'title', 'platform', 'status', 'outOf100']))}>CSV</N.Button><N.Button size="sm" icon="export" onClick={() => L.download('semester-benchmark.md', 'text/markdown', ['# Semester benchmark report', '', '| # | Workflow | Platform | Status | /100 |', '| --- | --- | --- | --- | --- |', ...rows.map((r) => '| ' + [r.workflow, r.title, r.platform, r.status, r.outOf100 ?? '—'].join(' | ') + ' |')].join('\n'))}>Markdown</N.Button></div>
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { BenchmarkView });
