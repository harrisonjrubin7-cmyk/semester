import { useStore } from '../state/store';
import { FirstRun } from './FirstRun';
import { Blueprint } from '../components/Blueprint';
import { Meter, SectionLabel } from '../components/ui';
import { TARGETS, key, needFor, standing } from '../lib/grades';

/**
 * What you have, and what the rest has to be.
 *
 * The grading table was already in the app, shown read-only under each course.
 * That answers "how is this marked" and not the question anybody actually asks
 * in week ten, which is what they need on the final. Type what you have and
 * the arithmetic is done — including when the answer is that an A is no longer
 * reachable, which is worth knowing in October rather than December.
 */
/**
 * @param bare - rendered inside the Courses switcher, which already supplies
 *   the page padding and the empty-state guard. Standalone it supplies its own.
 */
export function Grades({ bare = false }: { bare?: boolean } = {}) {
  const { state, dispatch, catalog } = useStore();
  if (catalog.empty) return <FirstRun where="to track grades" />;

  return (
    <div style={{ padding: bare ? 0 : 18 }}>
      <div style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.5, textWrap: 'pretty' }}>
        Weights come from each syllabus. Put in what you have so far — a percentage, or something
        like 17/20 — and the rest is arithmetic.
      </div>

      {catalog.courses.map((c) => {
        const s = standing(c, state.grades);
        return (
          <div key={c.id}>
            <SectionLabel style={{ margin: '26px 0 8px' }}>{c.code}</SectionLabel>

            <Blueprint style={{ padding: 15, background: 'var(--app-hero)' }}>
              <div className="kicker">
                {s.current === null ? 'Nothing graded yet' : `Across ${Math.round(s.counted)}% of the grade`}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
                <div className="chrome-text" style={{ fontSize: 34, lineHeight: 1 }}>
                  {s.current === null ? '—' : `${Math.round(s.current)}%`}
                </div>
                <div style={{ fontSize: 12.5, opacity: 0.7 }}>
                  {s.remaining > 0
                    ? `${Math.round(s.remaining)}% still to play for`
                    : 'Everything is in'}
                </div>
              </div>
              {s.current !== null && (
                <div style={{ marginTop: 10 }}>
                  <Meter pct={Math.min(100, Math.round(s.current))} />
                </div>
              )}
              {s.extraCredit > 0 && (
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                  Plus {s.extraCredit.toFixed(1)} points of extra credit.
                </div>
              )}
              {s.incomplete && (
                <div style={{ fontSize: 11.5, opacity: 0.6, marginTop: 8, lineHeight: 1.45 }}>
                  The weights in this syllabus do not add to 100, so treat these as indicative.
                  Rows the app could not read a weight from are marked below.
                </div>
              )}
            </Blueprint>

            {s.rows.map((r, i) => (
              <div
                key={r.what}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  padding: '11px 0',
                  borderBottom: '1px solid var(--app-line)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, lineHeight: 1.3 }}>{r.what}</div>
                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.5,
                      marginTop: 2,
                      fontFamily: 'var(--font-heading)',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {r.pct}
                    {r.weight === null ? ' · not weighted' : r.extra ? ' · extra credit' : ''}
                  </div>
                </div>
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="—"
                  value={state.grades[key(c.id, i)] ?? ''}
                  onChange={(e) =>
                    dispatch({ type: 'setGrade', key: key(c.id, i), value: e.target.value })
                  }
                  aria-label={`Your score for ${r.what} in ${c.code}`}
                  style={{ width: 84, flex: 'none', height: 38, fontSize: 14, textAlign: 'center' }}
                />
              </div>
            ))}

            {s.remaining > 0 && s.counted > 0 && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    opacity: 0.5,
                    margin: '14px 0 6px',
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  To finish with, you need
                </div>
                {TARGETS.map((t) => {
                  const need = needFor(s, t.at);
                  if (need === null) return null;
                  const impossible = need > 100;
                  const done = need <= 0;
                  return (
                    <div
                      key={t.label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        padding: '8px 0',
                        borderBottom: '1px solid var(--app-line-soft)',
                        opacity: impossible ? 0.45 : 1,
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15 }}>
                        {t.label}
                        <span style={{ fontSize: 11, opacity: 0.5 }}> · {t.at}%</span>
                      </span>
                      <span style={{ fontSize: 13.5 }}>
                        {done
                          ? 'already yours'
                          : impossible
                            ? `${Math.round(need)}% — out of reach`
                            : `${Math.round(need)}% on the rest`}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        );
      })}

      <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 22, lineHeight: 1.5 }}>
        This is your own arithmetic, not a gradebook — nothing here is read from Brightspace, and
        nothing is sent anywhere. A syllabus that drops your lowest score, curves, or rounds will
        not match exactly.
      </div>
      <div style={{ height: 22 }} />
    </div>
  );
}
