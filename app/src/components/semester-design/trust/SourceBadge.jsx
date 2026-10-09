import React from 'react';
import { SOURCES } from './vocabulary.js';
/** Where a fact came from and how old it is, beside the fact. Text first — never icon or colour alone.
 * Hardened: unknown sources render as "External" (never as Official), stale={true} switches to the "Out of date" treatment, <time> for machine-readable dates, report action names what it reports. */
export function SourceBadge({ source = 'official', updated, by, onReport, datetime, stale, about }) {
  const key = SOURCES[source] ? source : 'external';
  const isStale = stale === true && key !== 'stale';
  const s = SOURCES[isStale ? 'stale' : key] || SOURCES.external;
  return (
    <span className="source-badge" data-source={isStale ? 'stale' : key} title={s.meaning}>
      <span className="status-chip" data-tone={s.tone} data-fill={s.fill}><span className="status-glyph" aria-hidden="true">{s.glyph}</span>{s.label}{by ? ' · ' + by : ''}</span>
      <span className="sr-only">{s.meaning}</span>
      {updated && (datetime ? <time dateTime={datetime}>{updated}</time> : <span>{updated}</span>)}
      {onReport && <button type="button" className="source-report" onClick={onReport} aria-label={'Report incorrect information' + (about ? ' about ' + about : '')}>Report incorrect information</button>}
    </span>
  );
}
