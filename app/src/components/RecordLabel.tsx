import { formatDate } from '../lib/locale';
import { RECORD_FACTS, type RecordKind } from '../lib/record-kinds';
import type { TrustKind } from '../lib/source';
import { SourceBadge } from './SourceBadge';

/**
 * What kind of record this is, whose it is, and what to do next — beside the
 * record, so it is never read as more than it is.
 *
 * Six things, always the same six in the same order (`lib/record-kinds.ts`):
 * the record type, its authority, its source, when it was last verified, what
 * Semester can and cannot do with it, and the official next step. "Last
 * verified" is the school's verification, not Semester's last write: with no
 * date it says so, in words, rather than showing nothing.
 */
export function RecordLabel({
  kind,
  source,
  verifiedAt,
  now,
}: {
  kind: RecordKind;
  /** Overrides the kind's usual source when the screen knows better. */
  source?: TrustKind;
  /** When the record's owner last confirmed it, epoch ms. Omit when never. */
  verifiedAt?: number | null;
  now?: number;
}) {
  const facts = RECORD_FACTS[kind];
  const verified =
    typeof verifiedAt === 'number' && Number.isFinite(verifiedAt) && verifiedAt > 0
      ? formatDate(verifiedAt, { year: 'numeric', month: 'short', day: 'numeric' })
      : 'Not verified by the record’s owner';
  const row = { display: 'grid', gridTemplateColumns: 'minmax(7rem, 30%) 1fr', gap: 'var(--sp-2)', margin: 0, alignItems: 'baseline' } as const;
  return (
    <dl
      className="record-label"
      data-record={kind}
      aria-label={`About this record: ${facts.type}`}
      style={{ display: 'grid', gap: 'var(--sp-1)', margin: 'var(--sp-3) 0', fontSize: 'var(--type-xs)', color: 'var(--app-dim)' }}
    >
      <div style={row}>
        <dt>Record type</dt>
        <dd style={{ margin: 0, color: 'var(--app-fg)' }}>{facts.type}</dd>
      </div>
      <div style={row}>
        <dt>Authority</dt>
        <dd style={{ margin: 0, color: 'var(--app-fg)' }}>{facts.authority}</dd>
      </div>
      <div style={row}>
        <dt>Source</dt>
        <dd style={{ margin: 0 }}>
          <SourceBadge label={source ?? facts.source} at={verifiedAt} now={now} />
        </dd>
      </div>
      <div style={row}>
        <dt>Last verified</dt>
        <dd style={{ margin: 0, color: 'var(--app-fg)' }}>{verified}</dd>
      </div>
      <div style={row}>
        <dt>Semester can</dt>
        <dd style={{ margin: 0, color: 'var(--app-fg)' }}>{facts.can}</dd>
      </div>
      <div style={row}>
        <dt>Semester cannot</dt>
        <dd style={{ margin: 0, color: 'var(--app-fg)' }}>{facts.cannot}</dd>
      </div>
      <div style={row}>
        <dt>Official next step</dt>
        <dd style={{ margin: 0, color: 'var(--app-fg)' }}>{facts.next}</dd>
      </div>
    </dl>
  );
}
