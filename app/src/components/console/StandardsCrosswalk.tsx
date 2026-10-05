import { useState } from 'react';
import { CROSSWALK_SOURCES, STANDARD_CONTROLS, crosswalkExport, filterControls } from '../../lib/trust/standards-crosswalk';
import { download } from '../../lib/deliver';

export function StandardsCrosswalk() {
  const [query, setQuery] = useState('');
  const [standard, setStandard] = useState('');
  const rows = filterControls(query, standard);
  return <section aria-label="1EdTech and NIST control crosswalk">
    <h2>1EdTech and NIST SP 800-53 Rev. 5</h2>
    <p>Engineering mappings with implementation references and the evidence needed for activation. A mapping is not an assessment, certification or permission to process data.</p>
    <p>Legacy Appendix J labels such as AR, AP, DM, IP, SE, TR and UL are not Rev. 5 family identifiers. This view uses Rev. 5 control IDs; institutions select and assess their baseline.</p>
    <label>Search controls, purpose or evidence<input className="input" value={query} onChange={e => setQuery(e.target.value)} /></label>
    <label>Standard or capability<select className="input" value={standard} onChange={e => setStandard(e.target.value)}>
      <option value="">All capabilities</option>
      {STANDARD_CONTROLS.map(r => <option key={r.id} value={r.id}>{r.standard}</option>)}
    </select></label>
    <p role="status">{rows.length} mappings shown.</p>
    {rows.length === 0 && <p>No mappings match. Change the search or select all capabilities.</p>}
    {rows.map(row => <details key={row.id}>
      <summary>{row.standard} · {row.controls.join(', ')}</summary>
      <dl>
        <dt>Status</dt><dd>{row.status}</dd>
        <dt>Owner to assign</dt><dd>{row.owner}</dd>
        <dt>Purpose</dt><dd>{row.purpose}</dd>
        <dt>Data</dt><dd>{row.data}</dd>
        <dt>Boundary</dt><dd>{row.boundary}</dd>
        <dt>Implementation</dt><dd>{row.code.map(p => <p key={p}><a href={`https://github.com/harrisonjrubin7-cmyk/semester/blob/main/${p}`}>{p}</a></p>)}</dd>
        <dt>Verification references</dt><dd>{row.tests.map(p => <p key={p}><a href={`https://github.com/harrisonjrubin7-cmyk/semester/blob/main/${p}`}>{p}</a></p>)}</dd>
        <dt>Remaining activation evidence</dt><dd>{row.activation}</dd>
      </dl>
    </details>)}
    <button className="btn" type="button" onClick={() => download({ name: 'semester-standards-crosswalk.json', body: crosswalkExport(rows), mime: 'application/json' })}>Export shown mappings</button>
    <ul>{CROSSWALK_SOURCES.map(s => <li key={s.url}><a href={s.url}>{s.label}</a></li>)}</ul>
  </section>;
}
