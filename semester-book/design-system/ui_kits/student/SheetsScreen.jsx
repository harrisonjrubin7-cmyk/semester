function SheetScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const rows = [['5', '0.012', '0.011', '0.013'], ['10', '0.021', '0.023', '0.022'], ['20', '0.034', '0.036', '0.033'], ['40', '0.046', '0.044', '0.047'], ['80', '0.052', '0.053', '0.051']];
  const avg = (r) => ((+r[1] + +r[2] + +r[3]) / 3).toFixed(4);
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Learn · Sheets · BIO 210</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Catalase rate data</h1></div><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><N.SaveState status="saved" /><N.Button icon="analyse">Chart</N.Button></div></div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, fontSize: 13 }}><span className="mono" style={{ padding: '4px 8px', border: '1px solid var(--border-default)', borderRadius: 3, background: 'var(--surface-raised)' }}>E2</span><span className="mono" style={{ flex: 1, padding: '4px 8px', border: '1px solid var(--border-default)', borderRadius: 3, background: 'var(--surface-raised)' }}>=AVERAGE(B2:D2)</span></div>
      <div className="table-wrap"><table className="table nums" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}><thead><tr><th style={{ width: 36 }}></th>{['A · [H₂O₂] mM', 'B · Trial 1', 'C · Trial 2', 'D · Trial 3', 'E · Mean rate'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}><td style={{ color: 'var(--text-tertiary)' }}>{i + 2}</td>{r.map((c, j) => <td key={j}>{c}</td>)}<td style={i === 0 ? { outline: '2px solid var(--focus-color)', outlineOffset: -2 } : undefined}>{avg(r)}</td></tr>)}</tbody></table></div>
      <div className="cols sec"><div><N.ProvenanceChart title="Rate levels off above 40 mM — consistent with saturation" unit="" source="Your trials, Oct 1" rows={rows.map((r) => ({ label: r[0] + ' mM', value: +avg(r), source: 'personal' }))} /></div><aside><N.Notice head="Source">Values typed by you from lab notes. Semester hasn’t checked them.</N.Notice></aside></div>
    </div>
  );
}
Object.assign(window, { SheetScreen });
