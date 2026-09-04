import { useStore } from '../state/store';
import { FirstRun } from './FirstRun';
import { Blueprint } from '../components/Blueprint';
import { Meter, SectionLabel } from '../components/ui';
import { key, needCaveat, needFor, reaches, standing } from '../lib/grades';
import { against, forCourse, trend, trendLine } from '../lib/sitting';

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
      <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.7, lineHeight: 1.5, textWrap: 'pretty' }}>
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
                <div className="chrome-text" style={{ fontSize: 'calc(34px * var(--text-scale, 1))', lineHeight: 1 }}>
                  {s.current === null ? '—' : `${Math.round(s.current)}%`}
                </div>
                <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.7 }}>
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
                <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.7, marginTop: 8 }}>
                  Plus {s.extraCredit.toFixed(1)} points of extra credit.
                </div>
              )}
              {needCaveat(s) ? (
                <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.6, marginTop: 8, lineHeight: 1.45 }}>
                  {/* Names the number the weights actually add to. "Do not add
                      to 100" leaves the student to work out by how much, from
                      a table they cannot easily sum in their head. */}
                  {needCaveat(s)} Rows the app could not read a weight from are marked below.
                </div>
              ) : null}
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
                  <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))', lineHeight: 1.3 }}>{r.what}</div>
                  <div
                    style={{
                      fontSize: 'calc(11px * var(--text-scale, 1))',
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
                  style={{ width: 84, flex: 'none', height: 38, fontSize: 'calc(14px * var(--text-scale, 1))', textAlign: 'center' }}
                />
              </div>
            ))}

            {s.remaining > 0 && s.counted > 0 && (
              <>
                <div
                  style={{
                    fontSize: 'calc(11px * var(--text-scale, 1))',
                    opacity: 0.5,
                    margin: '14px 0 6px',
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  To finish with, you need
                </div>
                {reaches(s).map((t) => {
                  if (t.need === null) return null;
                  // `reachFor` decides what the number means; this only draws
                  // it. The old test here was `need > 100`, which showed a
                  // required average of 98.5% as an ordinary target — it is
                  // arithmetically available and it is not a plan.
                  const impossible = t.reach === 'unreachable';
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
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(15px * var(--text-scale, 1))' }}>
                        {t.label}
                        <span style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.5 }}> · {t.target}%</span>
                      </span>
                      <span
                        style={{
                          fontSize: 'calc(13.5px * var(--text-scale, 1))',
                          textAlign: 'right',
                          maxWidth: '62%',
                          lineHeight: 1.4,
                          color: t.reach === 'hard' ? 'var(--app-warn)' : undefined,
                        }}
                      >
                        {t.says}
                      </span>
                    </div>
                  );
                })}
              </>
            )}

            {/*
              Practice, beside the projection and deliberately not inside it.
              The projection is arithmetic on weights a syllabus states; a
              practice score is evidence about you. Averaging the two makes a
              number that is neither, and it would be the number people quote.
            */}
            {(() => {
              const sat = forCourse(state.sittings, c.id);
              if (sat.length === 0) return null;
              const t = trend(sat);
              const target = s.remaining > 0 && s.counted > 0 ? needFor(s, 90) : null;
              return (
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      fontSize: 'calc(11px * var(--text-scale, 1))',
                      opacity: 0.5,
                      marginBottom: 6,
                      fontFamily: 'var(--font-heading)',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    On practice papers
                  </div>
                  <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.5, textWrap: 'pretty' }}>
                    {trendLine(t, sat)}
                  </div>
                  {target !== null && t.papers > 0 ? (
                    <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginTop: 5, lineHeight: 1.45 }}>
                      {against(t.average, target)}
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
                    {sat.slice(0, 6).map((paper) => (
                      <span
                        key={paper.id}
                        className="tag tag-outline"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {paper.pct}%
                        <span style={{ opacity: 0.5 }}>
                          {' '}
                          · {new Date(paper.at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </span>
                    ))}
                  </div>
                  {t.missed > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-block"
                      onClick={() => dispatch({ type: 'go', screen: 'exam' })}
                      style={{ height: 40, marginTop: 10 }}
                    >
                      Sit another
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })}

      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 22, lineHeight: 1.5 }}>
        This is your own arithmetic, not a gradebook — nothing here is read from Brightspace, and
        nothing is sent anywhere. A syllabus that drops your lowest score, curves, or rounds will
        not match exactly.
      </div>
      <div style={{ height: 22 }} />
    </div>
  );
}
