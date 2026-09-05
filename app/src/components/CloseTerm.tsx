import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { backupOf } from '../lib/export';
import { takeSnapshot } from '../lib/snapshots';
import { readTerm } from '../lib/term';
import { ARCHIVED_LINE, asTaken, closing, isArchived, nextTerm, offerLine, readyLine } from '../lib/rollover';

/**
 * The five minutes at the end of a semester that makes the degree screen work.
 *
 * Without it, `taken` never accumulates and a cumulative GPA can only ever
 * describe this term. See `lib/rollover.ts` for the two things it refuses to
 * do — guess a grade, and delete anything.
 *
 * Closed until asked for, and offered on the term deadlines screen, which is
 * where somebody already goes at the end of a semester.
 */
export function CloseTerm() {
  const { state, dispatch, catalog } = useStore();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState<Record<string, string>>({});

  const term = state.term;
  const done = isArchived(term, state.archivedTerms);
  const rows = useMemo(
    () => closing(catalog.modules, term, typed),
    [catalog.modules, term, typed],
  );

  if (done) {
    return (
      <div style={{ marginTop: 18 }}>
        <div className="kicker">{readTerm(term).label}</div>
        <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginTop: 6, lineHeight: 1.5, textWrap: 'pretty' }}>
          {ARCHIVED_LINE}
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <div style={{ marginTop: 18 }}>
        <div className="kicker">Closing the term</div>
        <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginTop: 6, lineHeight: 1.5, textWrap: 'pretty' }}>
          {offerLine(rows, term)}
        </div>
        {rows.length > 0 && (
          <button
            type="button"
            className="bare tappable"
            onClick={() => setOpen(true)}
            style={{
              width: 'auto',
              padding: '6px 10px',
              marginTop: 8,
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--app-line)',
              fontSize: 'calc(11px * var(--text-scale, 1))',
              fontFamily: 'var(--font-heading)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Close out {readTerm(term).label}
          </button>
        )}
      </div>
    );
  }

  const after = nextTerm(term);

  return (
    <div style={{ marginTop: 18 }}>
      <div className="kicker">Closing {readTerm(term).label}</div>
      <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.65, marginTop: 6, lineHeight: 1.5, textWrap: 'pretty' }}>
        The grade your registrar posted, as they wrote it — a letter, or whatever your school
        awards. Leave one blank if it has not come back yet.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {rows.map((r) => (
          <div key={r.courseId} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 'calc(13.5px * var(--text-scale, 1))' }}>
                {r.code}
              </span>
              <span style={{ display: 'block', fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.5, marginTop: 2 }}>
                {r.hours > 0 ? `${r.hours} credit ${r.hours === 1 ? 'hour' : 'hours'}` : 'No credit hours stated'}
              </span>
            </span>
            <input
              className="input"
              value={r.grade}
              onChange={(e) => setTyped({ ...typed, [r.courseId]: e.target.value })}
              placeholder="—"
              aria-label={`Grade awarded for ${r.code}`}
              style={{ width: 76, flex: 'none', height: 38, textAlign: 'center' }}
            />
          </div>
        ))}
      </div>

      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.6, marginTop: 12, lineHeight: 1.45, textWrap: 'pretty' }}>
        {readyLine(rows)}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setOpen(false)}
          style={{ flex: 1, height: 44, letterSpacing: '0.08em', textTransform: 'uppercase' }}
        >
          Not yet
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            // Closing a term rewrites the transcript and empties the switcher.
            // Nothing is deleted, but "nothing is deleted" is easier to
            // believe when there is a copy of five seconds ago to check it
            // against. Not awaited: the close happens either way.
            void takeSnapshot('close', backupOf(state) as unknown as Record<string, unknown>);
            dispatch({
              type: 'closeTerm',
              term,
              taken: asTaken(rows, term),
              next: after.id,
            });
            setOpen(false);
          }}
          style={{ flex: 1, height: 44, letterSpacing: '0.08em', textTransform: 'uppercase' }}
        >
          Close it
        </button>
      </div>
      <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.5, marginTop: 8, lineHeight: 1.45, textWrap: 'pretty' }}>
        Then {after.label} is the term you are in, and it starts empty.
      </div>
    </div>
  );
}
