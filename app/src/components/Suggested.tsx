import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { FIELDS, YEARS, type Year } from '../data/fellowships';
import { NO_DATES, emptyLine, suggest, trackPatch, whenLine } from '../lib/suggest';
import { safeUrl } from '../lib/apply';

/**
 * Programmes worth knowing exist, months before they close.
 *
 * Almost every major fellowship is lost to not having heard of it in time, and
 * the ones with the longest lead — a recommendation chain, a language
 * requirement, a campus endorsement — are exactly the ones nobody stumbles
 * onto in October of their final year.
 *
 * ## Suggested, never added
 *
 * Nothing appears in the pipeline without a tap. An application that arrived
 * because an app thought it looked relevant is one nobody trusts, and the
 * pipeline is the screen that has to stay trustworthy.
 *
 * ## And never with a date
 *
 * See `lib/suggest.ts`. Tracking one creates an application with the date
 * blank and one instruction: go and find the real deadline. The caveat is on
 * every row rather than once at the top, because the months are the thing
 * somebody would otherwise take for a fact.
 */
export function Suggested() {
  const { state, dispatch, now } = useStore();
  const [open, setOpen] = useState(false);

  const want = state.wanted;
  const found = useMemo(() => suggest(want, now), [want, now]);

  // Already in the pipeline, so it is not a suggestion any more.
  const tracked = new Set(state.applications.map((a) => `${a.org}|${a.role}`.toLowerCase()));
  const rows = found.filter((p) => !tracked.has(`${p.org}|${p.role}`.toLowerCase()));

  const chip = (on: boolean) => ({
    width: 'auto' as const,
    padding: '6px 10px',
    borderRadius: 'var(--r-sm)',
    border: `1px solid ${on ? 'var(--app-accent)' : 'var(--app-line)'}`,
    background: on ? 'var(--app-accent-wash)' : 'transparent',
    fontSize: 'calc(11.5px * var(--text-scale, 1))',
  });

  const toggleField = (f: string) =>
    dispatch({
      type: 'setWanted',
      patch: {
        fields: want.fields.includes(f) ? want.fields.filter((x) => x !== f) : [...want.fields, f],
      },
    });

  return (
    <div style={{ marginTop: 22 }}>
      <div className="kicker">Worth knowing about</div>
      <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginTop: 6, lineHeight: 1.5, textWrap: 'pretty' }}>
        {NO_DATES}
      </div>

      <button
        type="button"
        className="bare tappable"
        onClick={() => setOpen(!open)}
        style={{
          width: 'auto',
          padding: '6px 10px',
          marginTop: 9,
          borderRadius: 'var(--r-sm)',
          border: '1px solid var(--app-line)',
          fontSize: 'calc(11px * var(--text-scale, 1))',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        {open ? 'Done' : 'Who you are'}
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.7 }}>
            Which year are you in?
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
            {YEARS.map((y) => (
              <button
                key={y.id}
                type="button"
                className="bare tappable"
                aria-pressed={want.year === y.id}
                onClick={() =>
                  dispatch({
                    type: 'setWanted',
                    patch: { year: want.year === y.id ? '' : (y.id as Year) },
                  })
                }
                style={chip(want.year === y.id)}
              >
                {y.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.7, marginTop: 12 }}>
            What are you interested in? Leaving these alone shows everything.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
            {FIELDS.map((f) => (
              <button
                key={f}
                type="button"
                className="bare tappable"
                aria-pressed={want.fields.includes(f)}
                onClick={() => toggleField(f)}
                style={chip(want.fields.includes(f))}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, marginTop: 12, lineHeight: 1.5, textWrap: 'pretty' }}>
          {emptyLine(want)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {rows.map((p) => (
            <div
              key={p.id}
              style={{
                padding: '12px 13px',
                border: '1px solid var(--app-line)',
                borderRadius: 'var(--r-sm)',
              }}
            >
              <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))', lineHeight: 1.3 }}>
                {p.role}
              </div>
              <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.55, marginTop: 2 }}>
                {p.org}
              </div>
              <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.78, marginTop: 6, lineHeight: 1.45, textWrap: 'pretty' }}>
                {p.what}
              </div>
              <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.4, textWrap: 'pretty' }}>
                {whenLine(p, now)}
              </div>
              <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="bare tappable"
                  onClick={() =>
                    dispatch({ type: 'addApplication', patch: trackPatch(p) })
                  }
                  style={{ ...chip(false), borderColor: 'var(--app-accent)' }}
                >
                  Track this
                </button>
                <a
                  className="bare tappable"
                  href={safeUrl(p.url)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...chip(false), display: 'inline-block', textDecoration: 'none' }}
                >
                  Official page
                </a>
                <button
                  type="button"
                  className="bare tappable"
                  onClick={() => dispatch({ type: 'dismissProgramme', id: p.id })}
                  style={{ ...chip(false), opacity: 0.6 }}
                >
                  Not for me
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
