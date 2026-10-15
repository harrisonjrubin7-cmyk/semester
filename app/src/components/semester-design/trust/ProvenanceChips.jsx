import React from 'react';
import { SOURCES, STATUSES } from './vocabulary.js';
/** Origin chip, then at most two cues, then age. Read to assistive tech as one sentence. */
export function ProvenanceChips({ origin = 'official', by, cues = [], age }) {
  const o = SOURCES[origin] || SOURCES.external;
  const shown = cues.slice(0, 2).map((c) => ({ key: c, ...(STATUSES[c] || { label: c, glyph: '·', tone: 'neutral' }) }));
  const sentence = [o.label + (by ? ' by ' + by : ''), ...shown.map((c) => c.label.toLowerCase()), age].filter(Boolean).join(', ');
  return (
    <span className="prov" data-origin={origin} title={o.meaning}>
      <span className="prov" aria-hidden="true">
        <span className="status-chip" data-tone={o.tone} data-fill={o.fill}><span className="status-glyph">{o.glyph}</span>{o.short}{by ? ' · ' + by : ''}</span>
        {shown.map((c) => <span key={c.key} className="status-chip" data-tone={c.tone}><span className="status-glyph">{c.glyph}</span>{c.label}</span>)}
        {age && <span className="prov-age">{age}</span>}
      </span>
      <span className="sr-only">{sentence}</span>
    </span>
  );
}
