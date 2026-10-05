import { useMemo, useState } from 'react';
import { download } from '../../lib/deliver';
import { CLASS_LABEL } from '../../lib/integration/classification';
import { EDUCATION_DATA_MAP } from '../../lib/trust/education-data-map';
import { auditEvidencePack, auditRows, auditSummary, filterAudit, rfpCsv, RFP_QUESTIONS, STANDARD_REFERENCES, type AuditMode } from '../../lib/trust/standards-audit';
import { SectionLabel } from '../ui';

export function StandardsAudit() {
  const [view, setView] = useState('matrix');
  const [search, setSearch] = useState('');
  const [standard, setStandard] = useState('');
  const [family, setFamily] = useState('');
  const [owner, setOwner] = useState('');
  const [blockersOnly, setBlockersOnly] = useState(false);
  const [mode, setMode] = useState<AuditMode>('Observe');
  const rows = useMemo(() => auditRows(), []);
  // Filters change the view, never the release calculation or export scope.
  const summary = auditSummary(rows, mode);
  const shown = filterAudit(rows, { search, standard, family, owner, blockersOnly });
  const select = (label: string, value: string, update: (value: string) => void, values: string[]) => (
    <label>{label}<select value={value} onChange={(e) => update(e.target.value)}>
      <option value="">All</option>{values.map((item) => <option key={item}>{item}</option>)}
    </select></label>
  );
  return <section className="standards-audit" aria-label="Standards and privacy audit">
    <SectionLabel>1EdTech and NIST readiness</SectionLabel>
    <p>Product capability assessment from the current control register. Institution activation requires reviewed tenant evidence and accountable approval.</p>
    <div className="standards-audit-summary">
      <label>Workflow mode<select value={mode} onChange={(e) => setMode(e.target.value as AuditMode)}>
        {(['Observe', 'Assist', 'Operate'] as const).map((item) => <option key={item}>{item}</option>)}
      </select></label>
      <p role="status">{summary.percent}% capability maturity · {summary.blockers.length} mandatory blockers · {summary.capabilityReady ? 'Capability evidence ready' : 'Release blocked'}</p>
      <p>Official-record writes: not authorized by this assessment.</p>
      <button type="button" onClick={() => download({ name: 'semester-standards-evidence.json', body: auditEvidencePack(), mime: 'application/json' })}>Export evidence pack</button>
      <button type="button" onClick={() => download({ name: 'semester-rfp-questionnaire.csv', body: rfpCsv(), mime: 'text/csv' })}>Export RFP questionnaire</button>
    </div>
    <div className="standards-audit-views" role="group" aria-label="Audit views">
      {[['matrix', 'Control matrix'], ['data', 'Education data map'], ['rfp', 'Procurement questions']].map(([id, title]) =>
        <button type="button" key={id} aria-pressed={view === id} onClick={() => setView(id)}>{title}</button>)}
    </div>
    {view === 'matrix' && <>
      <div className="standards-audit-filters">
        <label>Search controls<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="LTI, consent, AC-3…" /></label>
        {select('Standard', standard, setStandard, [...new Set(rows.map((r) => r.standard))].sort())}
        {select('NIST family', family, setFamily, [...new Set(rows.flatMap((r) => r.controls.map((c) => c.split('-')[0])))].sort())}
        {select('Owner', owner, setOwner, [...new Set(rows.map((r) => r.owner))].sort())}
        <label><input type="checkbox" checked={blockersOnly} onChange={(e) => setBlockersOnly(e.target.checked)} /> Show capability blockers</label>
      </div>
      <p aria-live="polite">{shown.length} of {rows.length} requirements shown</p>
      {shown.length === 0 && <p>No requirements match these filters.</p>}
      <div className="standards-audit-table" tabIndex={0} role="region" aria-label="Control matrix table">
        <table><caption>Readiness and evidence by capability</caption><thead><tr>
          <th scope="col">Capability</th><th scope="col">Standard / controls</th><th scope="col">Maturity</th><th scope="col">Owner / mode</th><th scope="col">Evidence and next action</th>
        </tr></thead><tbody>{shown.map((r) => <tr key={r.id}>
          <th scope="row">{r.title}</th><td>{r.standard}<br />{r.controls.join(' · ')}</td><td>{r.maturity}/4 · {r.status}</td><td>{r.owner}<br />{r.mode}</td>
          <td><details><summary>Review {r.rows.join(', ')}</summary>
            <p>Required proof: {r.evidenceNeeded}</p>
            <ul>{r.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
            <p>Implementation references:</p><ul>{r.evidence.map((e, i) => <li key={`${e.path}-${i}`}><a href={`https://github.com/harrisonjrubin7-cmyk/semester/blob/main/${e.path}`} target="_blank" rel="noreferrer">{e.path}</a> — {e.shows}</li>)}</ul>
          </details></td>
        </tr>)}</tbody></table>
      </div>
    </>}
    {view === 'data' && <>
      <p>Logical domains mapped to Semester concepts. Vendor extensions and endpoint support require a separately validated adapter; restricted records are excluded from routine AI.</p>
      <div className="standards-audit-table" tabIndex={0} role="region" aria-label="Education data mapping table">
        <table><caption>Data purpose and privacy boundaries</caption><thead><tr><th scope="col">Domain / fields</th><th scope="col">Canonical entity</th><th scope="col">Class / purpose</th><th scope="col">AI boundary / controls</th></tr></thead><tbody>
          {EDUCATION_DATA_MAP.map((r) => <tr key={r.entity}><th scope="row">{r.entity}<br />{r.fields}</th><td>{r.canonical}</td><td>{CLASS_LABEL[r.classification]}<br />{r.purpose}</td><td>{r.aiBoundary}<br />{r.controls.join(' · ')}</td></tr>)}
        </tbody></table>
      </div>
    </>}
    {view === 'rfp' && <>
      <p>{RFP_QUESTIONS.length} procurement questions. The CSV includes response, evidence ID/date, accountable owner, limitation, remediation target and production applicability. Answers require review.</p>
      <ol>{RFP_QUESTIONS.map((q) => <li key={q.id}><strong>{q.category}</strong> — {q.question}</li>)}</ol>
    </>}
    <details><summary>Framework versions and mapping limits</summary>
      <p>NIST SP 800-53 Rev. 5 uses an integrated security and privacy catalog. AR/AP/DI/DM/IP/SE/TR/UL in the supplied source documents are legacy Rev. 4 Appendix J families. This matrix uses Rev. 5 control IDs. A mapping is not certification, equivalency or a completed assessment. Accessibility requires direct WCAG assessment.</p>
      <ul>{STANDARD_REFERENCES.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noreferrer">{r.title}</a></li>)}</ul>
    </details>
  </section>;
}
