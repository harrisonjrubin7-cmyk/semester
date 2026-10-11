import React from 'react';
const ENC = { official: 'solid', connected: 'solid', personal: 'outline', estimated: 'hatched', ai: 'hatched', stale: 'dotted' };
const SAID = { solid: 'Official or connected', outline: 'Yours', hatched: 'Estimated or AI-derived', dotted: 'Out of date' };
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** Bar chart that encodes provenance, not just value: solid = official/connected, outline = yours, hatched = estimated/AI, dotted = stale.
 * Every bar is labelled directly; a visually hidden table carries the same data for screen readers. Handles empty, missing and negative values without breaking. */
export function ProvenanceChart({ title, rows = [], unit = '', max, source, demo = false, target, targetLabel = 'Target', sort, format, emptyText = 'No data for this period', summary }) {
  const clean = rows.map((r, i) => ({ ...r, _k: (r.id ?? r.label) + '-' + i, _v: num(r.value) }));
  const list = sort === 'desc' ? [...clean].sort((a, b) => (b._v ?? -1) - (a._v ?? -1)) : sort === 'asc' ? [...clean].sort((a, b) => (a._v ?? Infinity) - (b._v ?? Infinity)) : clean;
  const vals = list.map((r) => r._v).filter((v) => v !== null && v > 0);
  const m = num(max) && max > 0 ? max : Math.max(...vals, num(target) || 0, 0) || 1;
  const f = (v) => (v === null ? '—' : format ? format(v) : v + unit);
  const used = [...new Set(list.map((r) => ENC[r.source] || 'solid'))];
  const pct = (v) => Math.max(0, Math.min(100, ((v || 0) / m) * 100));
  return (
    <figure className="chart" style={{ margin: 0 }}>
      <figcaption className="chart-title">{title}</figcaption>
      {summary && <p className="chart-summary" style={{ margin: '0 0 var(--sp-4)', fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>{summary}</p>}
      {!list.length ? <div className="chart-empty" style={{ padding: 'var(--sp-6) 0', fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>{emptyText}</div> : (
        <div className="chart-bars" aria-hidden="true" style={{ position: 'relative' }}>
          {list.map((r) => (
            <div className="chart-row" key={r._k} title={r.note || undefined}>
              <span>{r.label}</span>
              <div className="chart-track" style={{ position: 'relative' }}>{r._v !== null && <div className="chart-bar" data-enc={ENC[r.source] || 'solid'} style={{ width: pct(r._v) + '%' }}></div>}{num(target) !== null && <span className="chart-target" style={{ left: pct(target) + '%' }}></span>}</div>
              <span className="nums" style={{ textAlign: 'right' }}>{f(r._v)}</span>
            </div>
          ))}
        </div>
      )}
      {!!list.length && <table className="sr-only"><caption>{title}</caption><thead><tr><th scope="col">Item</th><th scope="col">Value</th><th scope="col">Provenance</th></tr></thead><tbody>{list.map((r) => <tr key={r._k}><th scope="row">{r.label}</th><td>{f(r._v)}</td><td>{SAID[ENC[r.source] || 'solid']}</td></tr>)}</tbody></table>}
      <div className="chart-foot">{used.map((e) => <span key={e}><span className="chart-bar legend-swatch" data-enc={e}></span>{SAID[e]}</span>)}{num(target) !== null && <span><span className="chart-target legend" aria-hidden="true"></span>{targetLabel}: {f(target)}</span>}{source && <span>Source: {source}</span>}{demo && <span>Illustrative demo data</span>}</div>
    </figure>
  );
}
