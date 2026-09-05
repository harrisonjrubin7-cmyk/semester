/**
 * A piece of work marked as back, and the clock that starts when it is.
 *
 * The panel sits under the deadline it belongs to, because that is where
 * somebody is standing at the moment a grade appears. Everything it says comes
 * from `lib/returned.ts`, which counts days and holds no opinion whatever
 * about the mark — there is no "this looks low for you", because the app has
 * no business editorialising about somebody's coursework, and the consequences
 * of getting that wrong land on the student in a room with their professor.
 *
 * The window is entered rather than assumed. Seven days is common and is not a
 * rule, and a default would be wrong quietly and in the dangerous direction.
 */

import { useStore } from '../state/store';
import { NO_WINDOW, windowLine, windowSummary } from '../lib/returned';
import type { DatedItem } from '../lib/types';
import { PostMortem } from './PostMortem';

export function CameBack({ item }: { item: DatedItem }) {
  const { state, dispatch, now, catalog } = useStore();
  const record = state.returned.find((r) => r.id === item.id);
  const window = state.regradeWindows[item.c] ?? NO_WINDOW;
  const code = catalog.byId[item.c]?.code ?? item.c;

  // Nothing to say about work that is not graded, or that has not been handed
  // in yet. A regrade window on a reading is a field nobody can use.
  if (!record) {
    if (!item.weight || item.daysAway > 0) return null;
    return (
      <button
        type="button"
        className="bare tappable"
        onClick={() => dispatch({ type: 'markReturned', id: item.id, courseId: item.c })}
        style={{
          width: 'auto',
          padding: '8px 0 2px',
          fontSize: 'calc(12px * var(--text-scale, 1))',
          opacity: 0.6,
          textAlign: 'left',
        }}
      >
        This came back
      </button>
    );
  }

  const open = windowLine(record, window, now);

  return (
    <div
      style={{
        marginTop: 10,
        padding: '12px 13px',
        border: `1px solid ${window.days > 0 && !record.raised ? 'var(--app-warn-line)' : 'var(--app-line)'}`,
        background: window.days > 0 && !record.raised ? 'var(--app-warn-wash)' : 'transparent',
        borderRadius: 'var(--r-md)',
      }}
    >
      <div className="kicker">Back on {new Date(record.at).toDateString().slice(4)}</div>
      <div
        style={{
          fontSize: 'calc(13px * var(--text-scale, 1))',
          marginTop: 5,
          lineHeight: 1.45,
          textWrap: 'pretty',
        }}
      >
        {open}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 11, flexWrap: 'wrap' }}>
        <input
          className="input"
          value={record.score}
          onChange={(e) =>
            dispatch({ type: 'patchReturned', id: item.id, patch: { score: e.target.value } })
          }
          placeholder="17/20"
          aria-label={`What ${item.title} scored`}
          style={{ width: 96, height: 38, textAlign: 'center' }}
        />
        <button
          type="button"
          className="bare tappable"
          aria-pressed={record.raised}
          onClick={() =>
            dispatch({ type: 'patchReturned', id: item.id, patch: { raised: !record.raised } })
          }
          style={{
            width: 'auto',
            padding: '9px 13px',
            borderRadius: 'var(--r-sm)',
            border: `1px solid ${record.raised ? 'var(--app-accent)' : 'var(--app-line)'}`,
            fontSize: 'calc(12px * var(--text-scale, 1))',
          }}
        >
          {record.raised ? 'Raised' : 'I have raised it'}
        </button>
      </div>

      {/* Beside the record rather than in front of it: what starts the
          regrade clock is the record, and that matters more than this. See
          `lib/postmortem.ts`. */}
      <PostMortem record={record} courseId={item.c} />

      <textarea
        className="input"
        value={record.note}
        onChange={(e) =>
          dispatch({ type: 'patchReturned', id: item.id, patch: { note: e.target.value } })
        }
        placeholder="What the feedback said, or what you want to ask about."
        aria-label={`Notes on ${item.title} coming back`}
        spellCheck
        style={{
          width: '100%',
          minHeight: 56,
          marginTop: 8,
          resize: 'vertical',
          fontSize: 'calc(13px * var(--text-scale, 1))',
          lineHeight: 1.5,
        }}
      />

      <div className="kicker" style={{ marginTop: 13 }}>
        {code}&rsquo;s window
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="input"
          inputMode="numeric"
          value={window.days || ''}
          placeholder="—"
          onChange={(e) =>
            dispatch({
              type: 'setRegradeWindow',
              courseId: item.c,
              window: { ...window, days: Number.parseInt(e.target.value, 10) || 0 },
            })
          }
          aria-label={`How many days ${code} allows for raising a grade`}
          style={{ width: 72, height: 36, textAlign: 'center' }}
        />
        <button
          type="button"
          className="bare tappable"
          aria-pressed={window.business}
          onClick={() =>
            dispatch({
              type: 'setRegradeWindow',
              courseId: item.c,
              window: { ...window, business: !window.business },
            })
          }
          style={{
            width: 'auto',
            padding: '7px 12px',
            borderRadius: 'var(--r-sm)',
            border: `1px solid ${window.business ? 'var(--app-accent)' : 'var(--app-line)'}`,
            fontSize: 'calc(11.5px * var(--text-scale, 1))',
          }}
        >
          Business days
        </button>
        <span style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55 }}>
          {windowSummary(window)}
        </span>
      </div>
      {/* Said where the figure is set rather than in a help screen: a window
          that crosses Thanksgiving is a day short, and being confidently a day
          out is worse than saying so. The same refusal `lib/runway.ts` makes
          about testing-centre lead times. */}
      {window.business ? (
        <div
          style={{
            fontSize: 'calc(11.5px * var(--text-scale, 1))',
            opacity: 0.55,
            marginTop: 7,
            lineHeight: 1.5,
            textWrap: 'pretty',
          }}
        >
          Weekends are skipped. The app has no holiday calendar and will not invent one, so a
          window crossing a break is a day short.
        </div>
      ) : null}

      <button
        type="button"
        className="bare"
        onClick={() => dispatch({ type: 'unmarkReturned', id: item.id })}
        style={{
          width: 'auto',
          marginTop: 11,
          fontSize: 'calc(11.5px * var(--text-scale, 1))',
          opacity: 0.5,
        }}
      >
        It has not come back
      </button>
    </div>
  );
}
